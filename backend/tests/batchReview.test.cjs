const {test}=require('node:test');const assert=require('node:assert/strict');
Object.assign(process.env,{SUPABASE_URL:'https://yurdfoblkaclivxqfpjt.supabase.co',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_test',SUPABASE_SECRET_KEY:'sb_secret_test'});
const {batchReviewSchema,reviewDatabaseError}=require('../dist/services/batchReview');
const a='11111111-1111-4111-8111-111111111111',b='22222222-2222-4222-8222-222222222222';
const review={requestId:a,expectedRecords:[{id:a,status:'PENDING'},{id:b,status:'PENDING'}],excludedRecordIds:[b]};
test('batch validation accepts a complete snapshot and rejects unknown or duplicate exclusions',()=>{
 assert.equal(batchReviewSchema.safeParse(review).success,true);
 for(const bad of [{...review,excludedRecordIds:[a,a]},{...review,expectedRecords:[review.expectedRecords[0],review.expectedRecords[0]]},{...review,expectedRecords:[review.expectedRecords[0]],excludedRecordIds:[b]},{...review,requestId:'bad'},{...review,expectedRecords:[{id:a,status:'ABSENT'}]}])assert.equal(batchReviewSchema.safeParse(bad).success,false);
 assert.equal(batchReviewSchema.safeParse({...review,expectedRecords:[],excludedRecordIds:[]}).success,true);
});
test('authorization and stale-list failures are explicit and never treated as successful confirmation',()=>{
 for(const [code,message,status] of [['42501','SESSION_FORBIDDEN',403],['P0002','SESSION_NOT_FOUND',404],['40001','REVIEW_CHANGED',409],['40001','STOP_SESSION_FIRST',409],['40001','SESSION_ALREADY_CONFIRMED',409],['22023','INVALID_EXCLUSIONS',400]])assert.equal(reviewDatabaseError({code,message}).status,status);
 assert.equal(reviewDatabaseError({code:'PT409',message:'FLAGGED_REVIEW_REQUIRED'}).status,409);
 assert.equal(reviewDatabaseError({code:'PT409',message:'AUDIT_NOT_READY'}).status,409);
 assert.equal(reviewDatabaseError({code:'PGRST202',message:'missing RPC'}).status,503);
});
