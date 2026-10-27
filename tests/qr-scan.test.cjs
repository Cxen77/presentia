const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');const path=require('node:path');const {createRequire}=require('node:module');const ts=require('typescript');
const context=vm.createContext({exports:{},Error,setTimeout,clearTimeout});vm.runInContext(ts.transpileModule(fs.readFileSync('src/services/qrScanRunner.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,context);
const createRunner=context.exports.createQRScanRunner;
function fixture(overrides={}){const updates=[],calls=[];const runner=createRunner({validate:async()=>({type:'attendance_session',attendanceToken:'ATT-TEST',courseCode:'TEST'}),permission:async()=>{calls.push('permission');return 'granted';},location:async()=>{calls.push('location');return null;},attendance:async(token,location)=>{calls.push({token,location});return {sessionId:'session',scanTicket:'real-server-ticket',expiresAt:123};},...overrides,update:value=>updates.push(value)});return {runner,updates,calls};}
test('camera frame bursts cause one validation and show each progress stage',async()=>{
  let count=0;const f=fixture({validate:async()=>{count++;await new Promise(resolve=>setTimeout(resolve,5));return {type:'attendance_session',attendanceToken:'ATT-TEST'};}});
  await Promise.all(Array.from({length:20},()=>f.runner.scan('qr')));
  assert.equal(count,1);assert.deepEqual(f.updates.map(x=>x.phase),['checking','locating','verifying','attendance']);assert.equal(f.updates.at(-1).scan.scanTicket,'real-server-ticket');
});
test('invitation scans do not wait for attendance location permissions',async()=>{
  const f=fixture({validate:async()=>({type:'class_invite',classData:{id:'class'}})});await f.runner.scan('invitation');assert.equal(f.updates.at(-1).phase,'invitation');assert.equal(f.calls.length,0);
});
test('permission denial is visible and granting permission can resume the same scan',async()=>{
  let permission='primer';const f=fixture({permission:async()=>permission});await f.runner.scan('qr');assert.equal(f.updates.at(-1).phase,'permission');assert.equal(f.updates.at(-1).payload,'qr');assert.equal(f.calls.length,0);
  permission='granted';f.runner.reset();await f.runner.scan('qr');assert.equal(f.updates.at(-1).phase,'attendance');
});
test('backend/permission failures surface errors and reset permits a real retry',async()=>{
  for(const failure of ['validate','permission','attendance']){
    const f=fixture({[failure]:async()=>{throw new Error('Test '+failure+' failure');}});await f.runner.scan('qr');assert.equal(f.updates.at(-1).phase,'error');assert.match(f.updates.at(-1).message,/failure/);
    const n=f.updates.length;await f.runner.scan('qr');assert.equal(f.updates.length,n);f.runner.reset();await f.runner.scan('qr');assert.ok(f.updates.length>n);
  }
});
test('closing the scanner cancels stale results; a new scan can proceed',async()=>{
  let release;const f=fixture({validate:()=>new Promise(resolve=>{release=resolve;})});const pending=f.runner.scan('old');f.runner.reset();release({type:'attendance_session',attendanceToken:'old'});await pending;assert.deepEqual(f.updates.map(x=>x.phase),['checking']);assert.equal(f.calls.length,0);
});
test('a stalled QR validation ends with a useful retry message',async()=>{
  const f=fixture({validate:()=>new Promise(()=>{}),validationTimeoutMs:5});await f.runner.scan('qr');assert.equal(f.updates.at(-1).phase,'error');assert.match(f.updates.at(-1).message,/timed out/);
});
test('missing GPS is sent as unknown; an actual backend rejection cannot open the selfie stage',async()=>{
  let received;const f=fixture({location:async()=>{throw Error('No GPS');},attendance:async(token,location)=>{received=location;throw Error('Campus location required');}});await f.runner.scan('qr');assert.equal(received,null);assert.equal(f.updates.at(-1).phase,'error');assert.equal(f.updates.some(x=>x.phase==='attendance'),false);
});

test('the actual compact portal QR decodes at card size and retains its white quiet zone',async()=>{
  const portalRequire=createRequire(path.resolve('faculty-portal/package.json'));
  const code=ts.transpileModule(fs.readFileSync('faculty-portal/src/components/attendance/AttendanceQRCode.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText;
  const portal=vm.createContext({exports:{},require:portalRequire});vm.runInContext(code,portal);
  const React=portalRequire('react'),{renderToStaticMarkup}=portalRequire('react-dom/server');
  const {readBarcodes,prepareZXingModule}=require('zxing-wasm/reader');prepareZXingModule({overrides:{wasmBinary:fs.readFileSync(require.resolve('zxing-wasm/reader/zxing_reader.wasm'))}});
  for(const token of ['ATT-CS209-1-A1B2C3D4-MH87QZZ1','ATT-CS209-99-ABCDEF12-MH87QZZ2']){
    const svg=renderToStaticMarkup(React.createElement(portal.exports.AttendanceQRCode,{token,courseCode:'CS209',size:228}));
    const grid=Number(/viewBox="0 0 (\d+)/.exec(svg)[1]);const modules=Array.from({length:grid},()=>Array(grid).fill(false));
    const black=/<path fill="#000000" d="([^"]+)"/.exec(svg)[1];
    for(const rect of black.matchAll(/M(\d+)[ ,](\d+)\s*h(\d+)v1H\d+z/g)){const [,x,y,w]=rect.map(Number);for(let i=x;i<x+w;i++)modules[y][i]=true;}
    assert.equal(modules.flatMap((row,y)=>row.map((black,x)=>black&&(x<4||y<4||x>=grid-4||y>=grid-4))).some(Boolean),false);
    const size=228,data=new Uint8ClampedArray(size*size*4).fill(255);
    for(let y=0;y<size;y++)for(let x=0;x<size;x++)if(modules[Math.floor(y*grid/size)][Math.floor(x*grid/size)]){const i=(y*size+x)*4;data[i]=data[i+1]=data[i+2]=0;}
    const results=await readBarcodes({data,width:size,height:size},{formats:['QRCode']});assert.equal(results[0]?.text,token);
    assert.ok(grid<=41,'Keep modules large enough for a normal card-size phone scan');
  }
});
