const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');const ts=require('typescript');
const context=vm.createContext({exports:{},require:name=>{
  if(name==='express'||name==='zod')return require(name);
  if(name==='../middleware/auth')return {requireAuth:()=>{},requireRole:()=>()=>{}};
  if(name==='../services/geofence')return require('../dist/services/geofence');
  if(name==='../services/deviceBinding')return {installationSchema:require('zod').z.string().uuid()};
  if(name==='../services/cloudinary')return {isCloudinaryConfigured:()=>true};
  if(name==='../services/supabase')return {supabaseAdmin:{from:()=>{throw Error('Invalid scans must not query Supabase');}}};
  return {};
}});
vm.runInContext(ts.transpileModule(fs.readFileSync('src/routes/attendance.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,esModuleInterop:true}}).outputText,context);
async function request(path,body,profileId='student'){
  const route=context.exports.default.stack.find(layer=>layer.route?.path===path).route;
  let code,result;const res={status(value){code=value;return this;},json(value){result=value;return this;}};
  await route.stack.at(-1).handle({body,user:{profileId,authUserId:'auth-student'}},res);
  return {code,result};
}
test('old APK scan and submit requests explain the required device-registration update',async()=>{
  for(const path of ['/scan','/submit']){const r=await request(path,{qrToken:'ATT-TEST'});assert.equal(r.code,426);assert.match(r.result.error,/latest Presentia APK/);}
});
test('malformed current requests and incomplete profiles retain their normal errors',async()=>{
  for(const path of ['/scan','/submit'])assert.equal((await request(path,{installationId:'11111111-1111-4111-8111-111111111111'})).code,400);
  const incomplete=await request('/scan',{qrToken:'ATT-TEST'},'');assert.equal(incomplete.code,400);assert.match(incomplete.result.error,/Complete your profile/);
});
