const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const signed = { cloudName:'test-cloud', apiKey:'public-key', timestamp:123, signature:'upload-signature', folder:'attendance_verification', publicId:'owner/asset', type:'authenticated', overwrite:false };
function uploader(uploadResult, signatureError) {
  const calls=[];
  const context=vm.createContext({exports:{},URL,Blob,FormData,AbortController,setTimeout,clearTimeout,
    require(name){
      if(name==='react-native') return {Platform:{OS:'web'}};
      if(name==='./api') return {getCloudinarySignature:async()=>{if(signatureError)throw new Error(signatureError);return signed;}};
      throw new Error(name);
    },
    fetch:async(url,options)=>{
      calls.push({url,options});
      if(!options) return {ok:true,blob:async()=>new Blob(['test'],{type:'image/png'})};
      return uploadResult;
    },
  });
  vm.runInContext(ts.transpileModule(fs.readFileSync('src/services/cloudinary.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,context);
  return {upload:context.exports.uploadCloudinaryImage,calls};
}
test('stores an unsigned private location instead of the response delivery signature',async()=>{
  const {upload,calls}=uploader({ok:true,json:async()=>({secure_url:'https://res.cloudinary.com/test-cloud/image/authenticated/s--delivery--/v123/attendance_verification/owner/asset.png',public_id:'attendance_verification/owner/asset',version:123,format:'png',type:'authenticated',signature:'a'.repeat(40)})});
  const receipt=await upload('blob:test','attendance_verification');
  assert.equal(receipt.url,'https://res.cloudinary.com/test-cloud/image/authenticated/v123/attendance_verification/owner/asset.png');
  assert.equal(receipt.signature,'a'.repeat(40));
  assert.equal(calls[1].options.body.get('type'),'authenticated');
  assert.equal(calls[1].options.body.get('overwrite'),'false');
  assert.equal(calls[1].options.body.get('api_secret'),null);
});
test('failed configuration and upload never return a local URI as success',async()=>{
  const noConfig=uploader(null,'Photo uploads are not configured');
  await assert.rejects(noConfig.upload('blob:local','attendance_verification'),/not configured/);
  assert.equal(noConfig.calls.length,0);
  const failed=uploader({ok:false,json:async()=>({error:{message:'Upload denied'}})});
  await assert.rejects(failed.upload('blob:local','attendance_verification'),/Upload denied/);
});
test('rejects a Cloudinary receipt from another account',async()=>{
  const {upload}=uploader({ok:true,json:async()=>({secure_url:'https://res.cloudinary.com/other/image/upload/test.png',public_id:'attendance_verification/owner/asset',signature:'a'.repeat(40)})});
  await assert.rejects(upload('blob:local','attendance_verification'),/valid upload receipt/);
});
