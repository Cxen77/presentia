// Explicit integration run only. Creates isolated disposable users/classes/assets,
// calls the local backend and real configured Supabase/Cloudinary, then removes fixtures.
// NODE_ENV=test PORT=4010 node dist/server.js (separate terminal)
// PRESENTIA_RUN_INTEGRATION=1 node --test tests/deviceAudit.integration.cjs
const {test}=require('node:test');const assert=require('node:assert/strict');const crypto=require('node:crypto');const fs=require('node:fs');
test('real device binding, private uploads, concurrency, deferred retries and review', {skip:process.env.PRESENTIA_RUN_INTEGRATION!=='1',timeout:180000},async()=>{
  require('dotenv').config({quiet:true});
  const {createClient}=require('@supabase/supabase-js');
  const {env}=require('../dist/config/env');const {runAuditBatch}=require('../dist/services/proxyAudit');
  const {deleteAttendanceSelfie}=require('../dist/services/cloudinary');
  const options={auth:{persistSession:false,autoRefreshToken:false}};
  const db=createClient(env.SUPABASE_URL,env.SUPABASE_SECRET_KEY,options);
  const clients=[];const people=[];const devices=[];const classes=[];const assets=[];
  const uid=()=>crypto.randomUUID();const tag=uid().slice(0,8);
  const base=process.env.PRESENTIA_TEST_API_URL||'http://localhost:4010';
  assert.match(base,/^http:\/\/(localhost|127\.0\.0\.1):\d+$/,'Use an isolated local test backend');
  const ok=async query=>{const result=await query;if(result.error)throw Error(result.error.message);return result.data;};
  const api=async(person,path,body,method='POST')=>{const res=await fetch(base+path,{method,headers:{Authorization:'Bearer '+person.token,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});const data=await res.json();return {status:res.status,data};};
  const fix=(mocked=false)=>({latitude:12.9,longitude:77.5,accuracy:10,capturedAt:Date.now(),platform:'android',mocked,developerOptions:'unavailable'});
  let cls,session;
  try {
    for(const role of ['student','student','faculty']) {
      const email=`presentia-audit-${tag}-${people.length}@example.com`,password=crypto.randomBytes(24).toString('base64url')+'!7a';
      const created=await ok(db.auth.admin.createUser({email,password,email_confirm:true}));
      const person={user:created.user.id,role};people.push(person);
      const profile=await ok(db.from('profiles').insert({user_id:person.user,email,full_name:'Disposable audit '+people.length,first_name:'Audit',roll_number:`AUDIT-${tag}-${people.length}`,role,avatar_url:'https://example.com/test-profile.jpg'}).select('id').single());person.id=profile.id;
      const client=createClient(env.SUPABASE_URL,env.SUPABASE_PUBLISHABLE_KEY,options);clients.push(client);
      const signed=await ok(client.auth.signInWithPassword({email,password}));person.token=signed.session.access_token;person.client=client;
    }
    const [a,b,faculty]=people;
    cls=await ok(db.from('classes').insert({class_name:'Disposable device audit',course_code:'AUDIT',department:'Testing',enrollment_code:'AUDIT-'+tag,faculty_id:faculty.id,geofence:{enabled:false}}).select('id').single());classes.push(cls.id);
    await ok(db.from('class_enrollments').insert([a,b].map(p=>({student_id:p.id,class_id:cls.id,status:'active'}))));
    session=await ok(db.from('attendance_sessions').insert({class_id:cls.id,faculty_id:faculty.id,status:'ACTIVE'}).select('*').single());
    const qr=await ok(db.from('qr_tokens').insert({session_id:session.id,token:'AUDIT-'+uid(),nonce:uid(),expires_at:new Date(Date.now()+150000).toISOString()}).select('*').single());
    const d1=uid(),d2=uid(),dbDevice=uid();devices.push(d1,d2,dbDevice);
    assert.equal((await api(a,'/api/devices/register',{installationId:d1,platform:'android'})).status,200);
    assert.equal((await api(a,'/api/devices/register',{installationId:d2,platform:'android'})).status,200);
    assert.equal((await api(b,'/api/devices/register',{installationId:d1,platform:'android'})).status,409);
    assert.equal((await ok(db.from('student_devices').select('student_id').eq('installation_id',d1).single())).student_id,a.id);
    assert.equal((await api(b,'/api/devices/register',{installationId:dbDevice,platform:'android'})).status,200);
    console.log('PASS: one owner, multiple legitimate devices, cross-account conflict persisted');
    assert.ok((await a.client.from('student_devices').update({student_id:b.id}).eq('installation_id',d1)).error);
    assert.ok((await a.client.rpc('register_student_device',{p_installation:uid(),p_student:a.id,p_platform:'android'})).error);
    assert.equal((await api(a,`/api/devices/${d1}/resolve`,{studentId:b.id,status:'active',reason:'Unauthorized ownership change'},'PUT')).status,403);
    console.log('PASS: students cannot write device ownership or invoke privileged RPCs');

    // A campus-restricted failure saves raw mock/unknown signals, without a Present record.
    await ok(db.from('classes').update({geofence:{enabled:true,latitude:12.9,longitude:77.5,radiusM:200}}).eq('id',cls.id));
    for(const location of [fix(true),null])assert.equal((await api(a,'/api/attendance/scan',{qrToken:qr.token,installationId:d1,platform:'android',location})).status,403);
    const blocked=await ok(db.from('attendance_risk_attempts').select('location').eq('session_id',session.id));
    assert.equal(blocked.length,2);assert.equal(blocked[0].location.mocked,true);assert.equal(blocked[1].location,null);
    await ok(db.from('classes').update({geofence:{enabled:false}}).eq('id',cls.id));
    const scans=await Promise.all([a,b].map((p,i)=>api(p,'/api/attendance/scan',{qrToken:qr.token,installationId:i?dbDevice:d1,platform:'android',location:i?null:fix(true)})));
    scans.forEach(r=>assert.equal(r.status,200));
    async function upload(person,scan,installationId) {
      const signed=await api(person,'/api/cloudinary/signature',{folder:'attendance_verification',qrToken:qr.token,scanTicket:scan.data.scanTicket,installationId});assert.equal(signed.status,200);
      const p=signed.data,form=new FormData();form.append('file',new Blob([fs.readFileSync('../assets/aryan.jpg')],{type:'image/jpeg'}),'test.jpg');
      for(const [key,value]of Object.entries({api_key:p.apiKey,timestamp:p.timestamp,signature:p.signature,folder:p.folder,public_id:p.publicId,type:p.type,overwrite:p.overwrite}))form.append(key,String(value));
      const res=await fetch(`https://api.cloudinary.com/v1_1/${p.cloudName}/image/upload`,{method:'POST',body:form});const receipt=await res.json();assert.equal(res.ok,true,'Real private Cloudinary upload must succeed');
      const url=`https://res.cloudinary.com/${p.cloudName}/image/authenticated/v${receipt.version}/${receipt.public_id}.${receipt.format}`;assets.push(url);return {verificationPhotoUrl:url,verificationPhotoSignature:receipt.signature};
    }
    const photos=await Promise.all([upload(a,scans[0],d1),upload(b,scans[1],dbDevice)]);
    const simultaneous=await Promise.all([a,b,a].map((p,n)=>{const i=n===1?1:0;return api(p,'/api/attendance/submit',{qrToken:qr.token,...photos[i],scanTicket:scans[i].data.scanTicket,installationId:i?dbDevice:d1,location:i?null:fix(true)});}));
    assert.deepEqual([simultaneous[0].status,simultaneous[2].status].sort(),[201,409]);
    const submissions=[simultaneous[0].status===201?simultaneous[0]:simultaneous[2],simultaneous[1]];
    submissions.forEach(r=>{assert.equal(r.status,201);assert.equal(r.data.record.status,'PENDING');});
    assert.equal((await api(a,'/api/attendance/submit',{qrToken:qr.token,...photos[0],scanTicket:scans[0].data.scanTicket,installationId:d1,location:fix()})).status,409);
    assert.equal((await ok(db.from('attendance_audit_jobs').select('session_id').eq('session_id',session.id))).length,0);
    console.log('PASS: simultaneous real private uploads remain pending; duplicate attendance blocked; no audit during collection');

    // Separate session proves Device 2 works for A. A signed receipt from another
    // session must be rejected, even though it belongs to the same student.
    const later=await ok(db.from('attendance_sessions').insert({class_id:cls.id,faculty_id:faculty.id,status:'ACTIVE'}).select('id').single());
    const laterQR=await ok(db.from('qr_tokens').insert({session_id:later.id,token:'AUDIT-'+uid(),nonce:uid(),expires_at:new Date(Date.now()+150000).toISOString()}).select('*').single());
    const laterScan=await api(a,'/api/attendance/scan',{qrToken:laterQR.token,installationId:d2,platform:'android',location:fix()});assert.equal(laterScan.status,200);
    assert.equal((await api(a,'/api/attendance/submit',{qrToken:laterQR.token,...photos[0],scanTicket:laterScan.data.scanTicket,installationId:d2,location:fix()})).status,400);
    await ok(db.from('attendance_records').insert({session_id:later.id,class_id:cls.id,student_id:a.id,installation_id:d2,status:'PENDING',checkin_location:{scan:fix(),submission:fix()}}));
    console.log('PASS: second device works in later session; Cloudinary receipts cannot cross sessions');

    // Genuine admin resolution enables B on Device 1, while immutable session
    // evidence lets the deferred auditor detect historical cross-account reuse.
    const admin=await ok(db.from('profiles').select('id').eq('role','admin').single());
    await ok(db.rpc('admin_resolve_student_device',{p_installation:d1,p_student:b.id,p_status:'active',p_actor:admin.id,p_reason:'Disposable integration test transfer'}));
    await ok(db.from('attendance_records').update({installation_id:d1}).eq('id',submissions[1].data.record.id));
    const closed=await db.rpc('stop_attendance_for_review',{p_session_id:session.id,p_actor_id:faculty.id});assert.equal(closed.error,null);
    assert.ok((await db.from('attendance_records').insert({session_id:session.id,class_id:cls.id,student_id:a.id,installation_id:d2,status:'PENDING'})).error);
    const claims=await Promise.all([db.rpc('claim_attendance_audit'),db.rpc('claim_attendance_audit')]);
    claims.forEach(r=>assert.equal(r.error,null));const jobs=claims.flatMap(r=>r.data);assert.equal(jobs.filter(j=>j.session_id===session.id).length,1);
    const job=jobs.find(j=>j.session_id===session.id);assert.ok(job);
    assert.equal((await db.rpc('save_attendance_audit_batch',{p_session:session.id,p_lease:uid(),p_results:[]})).data,false);
    await ok(db.rpc('save_attendance_audit_batch',{p_session:session.id,p_lease:job.lease_id,p_results:[],p_error:'Injected test failure'}));
    await ok(db.from('attendance_audit_jobs').update({retry_at:new Date(0).toISOString()}).eq('session_id',session.id));
    await runAuditBatch(db);await runAuditBatch(db);
    const findings=await ok(db.from('attendance_records').select('id,status,audit_findings').eq('session_id',session.id));
    findings.forEach(r=>{assert.equal(r.audit_findings.deviceConflict,true);assert.equal(r.audit_findings.face.status,'review_required');assert.equal(r.status,'PENDING');});
    assert.equal(findings.find(r=>r.id===submissions[0].data.record.id).audit_findings.mockStatus,'detected');
    assert.equal(findings.find(r=>r.id===submissions[1].data.record.id).audit_findings.mockStatus,'unknown');
    assert.equal((await ok(db.from('attendance_audit_jobs').select('status,attempts').eq('session_id',session.id).single())).status,'complete');
    console.log('PASS: one concurrent lease, closed-session guard, failed audit resumes, cross-account reuse/mock/unknown findings retained');
    const expected=findings.map(r=>({id:r.id,status:r.status}));
    const premature=await db.rpc('confirm_attendance_review',{p_session_id:session.id,p_actor_id:faculty.id,p_request_id:uid(),p_expected_records:expected,p_excluded_ids:[]});assert.match(premature.error.message,/FLAGGED_REVIEW_REQUIRED/);
    for(const [i,p]of [a,b].entries()) {
      const decision=i?'REJECTED':'PRESENT';const reviewed=await api(faculty,`/api/attendance/${submissions[i].data.record.id}/verify`,{status:decision,rejectionReason:'Reviewed disposable fixture signals and comparison'},'PUT');assert.equal(reviewed.status,200);
    }
    const ready=await ok(db.from('attendance_records').select('id,status').eq('session_id',session.id));
    const requestId=uid(),args={p_session_id:session.id,p_actor_id:faculty.id,p_request_id:requestId,p_expected_records:ready,p_excluded_ids:[submissions[1].data.record.id]};
    const result=await ok(db.rpc('confirm_attendance_review',args));assert.equal(result.present,1);assert.equal(result.excluded,1);
    assert.equal((await ok(db.rpc('confirm_attendance_review',args))).present,1);
    assert.equal((await ok(db.from('attendance_review_events').select('id').in('record_id',ready.map(r=>r.id)))).length,4);
    console.log('PASS: flagged confirmation blocked until reasoned review; reviewer journal saved; class confirmation idempotent');
    // Deadline expiry is swept without a browser refresh.
    await ok(db.from('attendance_sessions').update({submission_deadline:new Date(0).toISOString()}).eq('id',later.id));
    await runAuditBatch(db);await runAuditBatch(db);
    assert.equal((await ok(db.from('attendance_sessions').select('status').eq('id',later.id).single())).status,'AWAITING_VERIFICATION');
    console.log('PASS: deadline expiry closes collection and enqueues one audit');
    const raceSession=await ok(db.from('attendance_sessions').insert({class_id:cls.id,faculty_id:faculty.id,status:'ACTIVE'}).select('id').single());
    const racing=await Promise.all([
      db.from('attendance_records').insert({session_id:raceSession.id,class_id:cls.id,student_id:a.id,installation_id:d2,status:'PENDING'}),
      db.rpc('stop_attendance_for_review',{p_session_id:raceSession.id,p_actor_id:faculty.id}),
    ]);
    assert.equal(racing[1].error,null);
    if(racing[0].error)assert.match(racing[0].error.message,/ATTENDANCE_SESSION_CLOSED/);
    const raceRecords=await ok(db.from('attendance_records').select('id').eq('session_id',raceSession.id));
    assert.equal(raceRecords.length,racing[0].error?0:1);
    console.log('PASS: session close racing an in-flight submission is serialized without late records');
  } finally {
    for(const url of assets)await deleteAttendanceSelfie(url);
    if(classes.length)await ok(db.from('classes').delete().in('id',classes));
    if(devices.length){await ok(db.from('device_conflicts').delete().in('installation_id',devices));await ok(db.from('device_ownership_events').delete().in('installation_id',devices));await ok(db.from('student_devices').delete().in('installation_id',devices));}
    for(const p of people){if(p.id)await ok(db.from('profiles').delete().eq('id',p.id));await ok(db.auth.admin.deleteUser(p.user));}
    for(const c of clients)await c.auth.signOut({scope:'local'});
    console.log('CLEANUP: disposable users, classes, device records and private test assets removed');
  }
});
