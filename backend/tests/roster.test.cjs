const {test}=require('node:test');
const assert=require('node:assert/strict');
const {compareRoster}=require('../dist/services/roster');
test('class rolls sort numerically, with USN fallback and missing identifiers last',()=>{
  const rows=[{class_roll_number:'10',full_name:'A'},{class_roll_number:'2',full_name:'B'},{roll_number:'USN100'},{roll_number:'USN20'},{}];
  rows.sort(compareRoster);
  assert.deepEqual(rows.map(p=>p.class_roll_number||p.roll_number||''),['2','10','USN20','USN100','']);
});
