const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');const ts=require('typescript');
const context=vm.createContext({exports:{},Set,Error});vm.runInContext(ts.transpileModule(fs.readFileSync('faculty-portal/src/utils/reportVisibility.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,context);
const {ignoredReportIds,loadIgnoredReports,setReportIgnored}=context.exports;
const a='11111111-1111-4111-8111-111111111111',b='22222222-2222-4222-8222-222222222222';
function account(metadata){const calls=[];return {calls,getUser:async()=>({data:{user:{id:'teacher',user_metadata:metadata}},error:null}),updateUser:async value=>{calls.push(value);Object.assign(metadata,value.data);return {data:{user:{user_metadata:metadata}},error:null};}};}
test('ignored reports are scoped to each teacher and can be restored without changing attendance',async()=>{
 const first=account({presentia_ignored_report_sessions:[a],full_name:'Teacher'}),second=account({});
 assert.deepEqual([...await setReportIgnored(first,b,true)],[a,b]);assert.equal((await loadIgnoredReports(second)).size,0);
 assert.deepEqual([...await setReportIgnored(first,a,false)],[b]);
 assert.deepEqual(Object.keys(first.calls[0].data),['presentia_ignored_report_sessions']);
});
test('invalid preferences and failed writes cannot silently hide reports',async()=>{
 assert.equal(ignoredReportIds({presentia_ignored_report_sessions:'all'}).size,0);
 assert.deepEqual([...ignoredReportIds({presentia_ignored_report_sessions:[a,'bad',a,123]})],[a]);
 await assert.rejects(setReportIgnored(account({}),'bad',true),/Invalid/);
 const broken=account({});broken.updateUser=async()=>({error:new Error('Offline')});await assert.rejects(setReportIgnored(broken,a,true),/Could not save/);
 const signedOut=account({});signedOut.getUser=async()=>({data:{user:null},error:null});await assert.rejects(loadIgnoredReports(signedOut),/sign in again/);
});
