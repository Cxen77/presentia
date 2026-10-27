const {test}=require('node:test');const assert=require('node:assert/strict');
const {allowedBrowserOrigins}=require('../dist/services/portalOrigins');
test('production portal aliases and configured development origins are allowed exactly',()=>{
 const allowed=allowedBrowserOrigins('http://localhost:5173, http://localhost:8081,');
 for(const origin of ['https://faculty-portal-chi.vercel.app','https://faculty-portal-git-main-cxen77s-projects.vercel.app','https://faculty-portal-cxen77s-projects.vercel.app','http://localhost:5173'])assert.equal(allowed.has(origin),true);
 for(const origin of ['https://unrelated.vercel.app','https://faculty-portal-chi.vercel.app.attacker.example','http://faculty-portal-chi.vercel.app','null',''])assert.equal(allowed.has(origin),false);
});
