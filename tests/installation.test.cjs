const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');const ts=require('typescript');
function installation(os,store=new Map(),fail=false){let generated=0;const context=vm.createContext({exports:{},Error,localStorage:{getItem:key=>store.get(key),setItem:(key,value)=>store.set(key,value)},require:name=>{
  if(name==='react-native')return {Platform:{OS:os}};
  if(name==='expo-crypto')return {randomUUID:()=>`11111111-1111-4111-8111-${String(++generated).padStart(12,'0')}`};
  if(name==='expo-secure-store')return {WHEN_UNLOCKED_THIS_DEVICE_ONLY:1,getItemAsync:async key=>{if(fail)throw Error('Storage unavailable');return store.get(key);},setItemAsync:async(key,value)=>store.set(key,value)};
  throw Error(name);
}});vm.runInContext(ts.transpileModule(fs.readFileSync('src/services/installation.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,context);return context.exports;}
test('native installation is created once under concurrent requests and survives runtime restart',async()=>{
  const store=new Map();const first=installation('android',store);const values=await Promise.all(Array.from({length:30},()=>first.getInstallationId()));assert.equal(new Set(values).size,1);assert.equal(store.size,1);assert.equal(await installation('android',store).getInstallationId(),values[0]);
});
test('storage failures fail closed instead of minting an ephemeral or shared fallback ID',async()=>{
  const blocked=installation('android',new Map(),true);await assert.rejects(blocked.getInstallationId(),/storage is unavailable/);await assert.rejects(blocked.getInstallationId(),/storage is unavailable/);
});
test('web uses a persistent browser signal without claiming SecureStore protection',async()=>{
  const store=new Map();const first=installation('web',store);const id=await first.getInstallationId();assert.equal(await installation('web',store).getInstallationId(),id);assert.equal(first.installationPlatform(),'web');
});
