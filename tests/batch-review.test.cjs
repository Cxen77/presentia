const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');const ts=require('typescript');
const context=vm.createContext({exports:{},Set,Error});vm.runInContext(ts.transpileModule(fs.readFileSync('faculty-portal/src/utils/batchReview.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,context);
const prepare=context.exports.prepareBatchReview;
test('class confirmation freezes all reviewed records even when another submission arrives later',()=>{
 const records=[{id:'one',status:'PENDING'},{id:'two',status:'PENDING'}];const excluded=new Set(['two']);const snapshot=prepare(records,excluded,'request');records.push({id:'three',status:'PENDING'});excluded.clear();assert.deepEqual(JSON.parse(JSON.stringify(snapshot)),{requestId:'request',expectedRecords:[{id:'one',status:'PENDING'},{id:'two',status:'PENDING'}],excludedRecordIds:['two']});
});
test('invalid client snapshots cannot silently confirm a subset or include an unknown exclusion',()=>{
 assert.throws(()=>prepare([{id:'one',status:'PENDING'}],new Set(['other']),'request'),/Refresh/);
 assert.throws(()=>prepare([{id:'one',status:'PENDING'},{id:'one',status:'PENDING'}],new Set(),'request'),/Refresh/);
 assert.throws(()=>prepare([{id:'one',status:'ABSENT'}],new Set(),'request'),/Unexpected/);
 assert.equal(prepare([],new Set(),'request').expectedRecords.length,0);
});
