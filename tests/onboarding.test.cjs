const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
function moduleAt(file,storage){const context=vm.createContext({exports:{},require:()=>({__esModule:true,default:storage})});vm.runInContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,context);return context.exports;}
test('the first unauthenticated visit gets welcome once, subsequent visits get login',async()=>{
  const entries=new Map(),storage={getItem:async key=>entries.get(key)||null,setItem:async(key,value)=>entries.set(key,value)};
  const m=moduleAt('src/services/welcomeState.ts',storage);
  assert.equal(await m.getUnauthenticatedEntry(),'onboarding');
  assert.equal(await m.getUnauthenticatedEntry(),'login');
});
test('a previously authenticated user goes straight to login after sign-out',async()=>{
  const entries=new Map(),storage={getItem:async key=>entries.get(key)||null,setItem:async(key,value)=>entries.set(key,value)};
  const m=moduleAt('src/services/welcomeState.ts',storage);await m.markWelcomeSeen();assert.equal(await m.getUnauthenticatedEntry(),'login');
});
test('unavailable preference storage cannot block access to sign-in',async()=>{
  const m=moduleAt('src/services/welcomeState.ts',{getItem:async()=>{throw new Error('unavailable')},setItem:async()=>{throw new Error('unavailable')}});
  assert.equal(await m.getUnauthenticatedEntry(),'login');await m.markWelcomeSeen();
});
test('roll number and section have independent required questions',()=>{
  const m=moduleAt('src/services/profileSetup.ts');const fields={fullName:'Student',usn:'USN-42',classRollNumber:'',section:''};
  assert.equal(m.PROFILE_SETUP_STEPS,7);assert.match(m.profileStepError(4,fields),/roll number/);assert.match(m.profileStepError(5,fields),/section/);
  assert.equal(m.profileStepError(4,{...fields,classRollNumber:' 12 '}),null);assert.equal(m.profileStepError(5,{...fields,section:' A '}),null);
  assert.match(m.profileStepError(4,{...fields,classRollNumber:' '.repeat(5)}),/roll number/);
  assert.match(m.profileStepError(5,{...fields,section:'A'.repeat(31)}),/30 characters/);
});
