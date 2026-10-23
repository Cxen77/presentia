const {test}=require('node:test');const assert=require('node:assert/strict');
Object.assign(process.env,{SUPABASE_URL:'https://yurdfoblkaclivxqfpjt.supabase.co',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_test',SUPABASE_SECRET_KEY:'sb_secret_test',CLOUDINARY_API_SECRET:'test-secret'});
const {createScanTicket,verifyScanTicket}=require('../dist/services/scanTicket');
test('a valid scan grants three minutes for a selfie, bound to user/token/session',()=>{
  const {ticket,expiresAt}=createScanTicket('student','qr','session',1000);
  assert.equal(expiresAt,181000);assert.equal(verifyScanTicket(ticket,'student','qr','session',180999),true);
  for(const args of [['other','qr','session',2000],['student','other','session',2000],['student','qr','other',2000],['student','qr','session',181000]])assert.equal(verifyScanTicket(ticket,...args),false);
  assert.equal(verifyScanTicket('x'+ticket,'student','qr','session',2000),false);
  assert.equal(verifyScanTicket(ticket+'.extra','student','qr','session',2000),false);
});
