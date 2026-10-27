const {test}=require('node:test');
const assert=require('node:assert/strict');
Object.assign(process.env,{SUPABASE_URL:'https://yurdfoblkaclivxqfpjt.supabase.co',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_test',SUPABASE_SECRET_KEY:'sb_secret_test'});
const {analyzeSubmission}=require('../dist/services/proxySignals');
const {runAuditBatch}=require('../dist/services/proxyAudit');
const base={id:'record',student_id:'student-a',installation_id:'device-1',device_status_at_submission:'active',registered_student_id:'student-a',registered_status:'active',cross_account_reuse:false,checkin_location:{scan:{mocked:false},submission:{mocked:false,accuracy:12,capturedAt:123}},avatar_url:'profile',verification_photo_url:'selfie'};

test('registered devices never fabricate face matches; location and identity remain separate',async()=>{
  const result=await analyzeSubmission(base);
  assert.equal(result.deviceStatus,'registered');assert.equal(result.mockStatus,'not_detected');
  assert.equal(result.face.status,'review_required');assert.equal(result.face.provider,'faculty');
  assert.equal(result.requiresSignalReview,false);assert.equal(result.status,'faculty_review_required');
});
test('same device across accounts, ownership changes and revoked registrations need reasoned review',async()=>{
  for(const input of [{...base,cross_account_reuse:true},{...base,registered_student_id:'student-b'},{...base,registered_status:'revoked'},{...base,installation_id:null}]) {
    const result=await analyzeSubmission(input);assert.equal(result.requiresSignalReview,true);assert.ok(result.reasons.length>1);
  }
});
test('mock at either scan or submission is retained; missing status is unknown',async()=>{
  for(const evidence of [{scan:{mocked:true},submission:{mocked:false}},{scan:{mocked:false},submission:{mocked:true}}])assert.equal((await analyzeSubmission({...base,checkin_location:evidence})).mockStatus,'detected');
  for(const evidence of [null,{scan:{mocked:false},submission:null},{scan:{mocked:null},submission:{mocked:false}}]) {
    const result=await analyzeSubmission({...base,checkin_location:evidence});assert.equal(result.mockStatus,'unknown');assert.equal(result.requiresSignalReview,true);
  }
});
test('configured comparison is deferred and a match cannot clear device or location flags',async()=>{
  let called=0;const provider={name:'test-adapter',compare:async input=>{called++;assert.equal(input.profilePhoto,'profile');return {status:'match',reason:'Provider comparison'};}};
  const result=await analyzeSubmission({...base,cross_account_reuse:true,checkin_location:{scan:{mocked:true},submission:{mocked:true}}},provider);
  assert.equal(called,1);assert.equal(result.face.status,'match');assert.equal(result.requiresSignalReview,true);assert.equal(result.mockStatus,'detected');
});
test('audit persists bounded progress, records failures for retry, and rejects lost leases',async()=>{
  const calls=[];let failure=false,lost=false;
  const client={rpc:async(name,args)=>{calls.push({name,args});if(name==='claim_attendance_audit')return {data:[{session_id:'session',lease_id:'lease'}]};if(name==='attendance_audit_batch')return failure?{error:{}}:{data:[base]};if(args.p_error)return {data:true};return {data:!lost};}};
  assert.equal(await runAuditBatch(client),true);
  assert.equal(calls.at(-1).args.p_results.length,1);
  assert.equal(calls.at(-1).args.p_results[0].findings.face.status,'review_required');
  failure=true;await assert.rejects(runAuditBatch(client),/retry scheduled/);assert.ok(calls.at(-1).args.p_error);
  failure=false;assert.equal(await runAuditBatch(client),true);
  lost=true;await assert.rejects(runAuditBatch(client),/retry scheduled/);
});
test('a portal read or empty queue does not run photo comparisons or invent a job',async()=>{
  let calls=0;assert.equal(await runAuditBatch({rpc:async()=>{calls++;return {data:[]};}}),false);assert.equal(calls,1);
});

test('missing photos and invalid provider responses cannot fabricate verification',async()=>{
  const missing=await analyzeSubmission({...base,avatar_url:null});assert.equal(missing.face.status,'review_required');assert.equal(missing.requiresSignalReview,true);
  await assert.rejects(analyzeSubmission(base,{name:'bad-adapter',compare:async()=>({status:'safe',reason:'Unrecognized result'})}),/Invalid comparison response/);
});

test('a stuck comparison is aborted within the lease budget and leaves the job retryable',async()=>{
  let aborted=false;
  await assert.rejects(analyzeSubmission(base,{name:'stuck-adapter',compare:({signal})=>new Promise(()=>signal.addEventListener('abort',()=>{aborted=true;}))}),/timed out/);
  assert.equal(aborted,true);
});
