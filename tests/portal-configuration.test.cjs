const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');const ts=require('typescript');
const ctx=vm.createContext({exports:{},URL,atob});vm.runInContext(ts.transpileModule(fs.readFileSync('faculty-portal/src/services/configuration.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,ctx);
const read=ctx.exports.readPortalConfiguration;
const valid={VITE_SUPABASE_URL:'https://yurdfoblkaclivxqfpjt.supabase.co',VITE_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_test_public_key',VITE_API_BASE_URL:'https://presentia-6zjr.onrender.com'};
const jwt=payload=>'header.'+Buffer.from(JSON.stringify(payload)).toString('base64url')+'.signature';
test('portal rejects the wrong deployed project and privileged/missing keys without echoing values',()=>{
 for(const input of [{...valid,VITE_SUPABASE_URL:'https://krdykejphzdnatxekerr.supabase.co'},{...valid,VITE_SUPABASE_PUBLISHABLE_KEY:'sb_secret_test_value'},{...valid,VITE_SUPABASE_PUBLISHABLE_KEY:''},{...valid,VITE_SUPABASE_PUBLISHABLE_KEY:jwt({ref:'other-project',role:'anon'})},{...valid,VITE_SUPABASE_PUBLISHABLE_KEY:jwt({ref:'yurdfoblkaclivxqfpjt',role:'service_role'})}]){
  assert.throws(()=>read(input),error=>{assert.equal(error.message.includes(input.VITE_SUPABASE_PUBLISHABLE_KEY||'NEVER'),false);return /VITE_SUPABASE/.test(error.message);});
 }
});
test('both intended public key formats work and production never falls back to localhost',()=>{
 assert.equal(read(valid).apiBaseUrl,'https://presentia-6zjr.onrender.com');
 assert.equal(read({VITE_SUPABASE_ANON_KEY:jwt({ref:'yurdfoblkaclivxqfpjt',role:'anon'})}).url,valid.VITE_SUPABASE_URL);
 assert.equal(read({VITE_SUPABASE_PUBLISHABLE_KEY:valid.VITE_SUPABASE_PUBLISHABLE_KEY}).apiBaseUrl,valid.VITE_API_BASE_URL);
 assert.throws(()=>read({...valid,VITE_API_BASE_URL:'http://localhost:4000'}),/VITE_API_BASE_URL/);
 assert.equal(read({...valid,DEV:true,VITE_API_BASE_URL:'http://localhost:4010'}).apiBaseUrl,'http://localhost:4010');
 assert.throws(()=>read({...valid,DEV:true,VITE_API_BASE_URL:'http://localhost.attacker.example'}),/VITE_API_BASE_URL/);
});
test('Vercel deep links route to the SPA while the favicon references a real asset',()=>{
 const config=JSON.parse(fs.readFileSync('faculty-portal/vercel.json','utf8'));
 for(const route of ['/login','/classes','/live-attendance','/admin','/reports']){
  const rewrite=config.rewrites.find(r=>new RegExp('^'+r.source+'$').test(route));assert.equal(rewrite?.destination,'/index.html');
 }
 const html=fs.readFileSync('faculty-portal/index.html','utf8');assert.ok(!html.includes('/vite.svg'));assert.ok(html.includes('/favicon.svg'));assert.ok(fs.existsSync('faculty-portal/public/favicon.svg'));
});
