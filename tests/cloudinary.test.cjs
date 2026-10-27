const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const signed = { cloudName:'test-cloud', apiKey:'public-key', timestamp:123, signature:'upload-signature', folder:'attendance_verification', publicId:'owner/asset', type:'authenticated', overwrite:false };
function expoModule(path, requireModule=()=>{throw new Error('Unexpected import');}) {
  const context=vm.createContext({exports:{},Blob,TextEncoder,Uint8Array,require:requireModule});
  vm.runInContext(ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,context);
  return context.exports;
}
// Use SDK 58's actual FormData patch and encoder. Node's standard FormData
// cannot reproduce Android's rejection of the former {uri,name,type} object.
class NativeFormData {constructor(){this._parts=[];}}
const PatchedFormData=expoModule('node_modules/expo/src/winter/FormData.ts').installFormDataPatch(NativeFormData);
const {convertFormDataAsync}=expoModule('node_modules/expo/src/winter/fetch/convertFormData.ts',()=>({blobToArrayBufferAsync:blob=>blob.arrayBuffer()}));
const photoBytes=Uint8Array.from([0xff,0xd8,0xff,0xe0,0x00,0x10,0xff,0xd9]);
function uploader(uploadResult, signatureError, options={}) {
  const calls=[];
  const files=[];
  const platform=options.platform||'web';
  class NativeFile {
    constructor(uri){this.uri=uri;this.name='photo.jpg';this.type='image/jpeg';this.size=photoBytes.length;this.exists=true;Object.assign(this,options.file);files.push(this);}
    async bytes(){return photoBytes;}
  }
  const transport=async(url,request)=>{
    const call={url,options:request};calls.push(call);
    if(!request) return {ok:true,blob:async()=>new Blob(['test'],{type:'image/png'})};
    if(platform!=='web')call.encoded=await convertFormDataAsync(request.body,'test-boundary');
    return uploadResult;
  };
  const context=vm.createContext({exports:{},URL,Blob,FormData:platform==='web'?FormData:PatchedFormData,AbortController,setTimeout,clearTimeout,
    require(name){
      if(name==='react-native') return {Platform:{OS:platform}};
      if(name==='expo-image-manipulator') return {SaveFormat:{JPEG:'jpeg'},manipulateAsync:async uri=>{if(options.resizeFails)throw new Error('resize failed');return {uri};}};
      if(name==='expo-file-system') return {File:NativeFile};
      if(name==='expo/fetch') return {fetch:transport};
      if(name==='./api') return {getCloudinarySignature:async()=>{if(signatureError)throw new Error(signatureError);return options.signed||signed;}};
      throw new Error(name);
    },
    fetch:transport,
  });
  vm.runInContext(ts.transpileModule(fs.readFileSync('src/services/cloudinary.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,context);
  return {upload:context.exports.uploadCloudinaryImage,calls,files};
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

test('SDK 58 rejects legacy URI parts but encodes Android and iOS photo bytes with signed fields',async()=>{
  const legacy=new PatchedFormData();legacy.append('file',{uri:'file:///camera/photo.jpg',name:'photo.jpg',type:'image/jpeg'});
  await assert.rejects(convertFormDataAsync(legacy),/Unsupported FormDataPart implementation/);
  for(const platform of ['android','ios']){
    const {upload,calls,files}=uploader({ok:true,json:async()=>({secure_url:'https://res.cloudinary.com/test-cloud/image/authenticated/v123/attendance_verification/owner/asset.jpg',public_id:'attendance_verification/owner/asset',version:123,format:'jpg',type:'authenticated',signature:'a'.repeat(40)})},null,{platform});
    const receipt=await upload('file:///camera/photo.jpg','attendance_verification');
    assert.equal(files[0].uri,'file:///camera/photo.jpg');
    assert.equal(calls.length,1);
    const encoded=Buffer.from(calls[0].encoded.body);
    assert.ok(encoded.includes(Buffer.from(photoBytes)),'actual photo bytes must enter the multipart body');
    const body=encoded.toString('latin1');
    assert.match(body,/name="file"; filename="photo.jpg"/);
    assert.match(body,/content-type: image\/jpeg/);
    for(const [key,value] of Object.entries({api_key:signed.apiKey,signature:signed.signature,public_id:signed.publicId,type:'authenticated',overwrite:'false'}))assert.ok(body.includes(`name="${key}"\r\n\r\n${value}`));
    assert.ok(!body.includes('api_secret'));assert.ok(!body.includes('file:///'));
    assert.equal(calls[0].options.headers,undefined,'fetch must generate the multipart boundary');
    assert.equal(receipt.signature,'a'.repeat(40));
  }
});

test('native photos that are missing, empty, oversized or non-images never start a network upload',async()=>{
  for(const [file,message] of [[{exists:false},/Retake/],[{size:0},/Retake/],[{size:11*1024*1024},/smaller than 10 MB/],[{type:'application/pdf'},/image file/]]){
    const {upload,calls}=uploader(null,null,{platform:'android',file,resizeFails:true});
    await assert.rejects(upload('file:///camera/original.jpg','attendance_verification'),message);
    assert.equal(calls.length,0);
  }
});

test('Android profile photos use the same supported multipart bytes and public profile signature',async()=>{
  const profileSigned={...signed,folder:'student_profiles',type:'upload'};
  const {upload,calls}=uploader({ok:true,json:async()=>({secure_url:'https://res.cloudinary.com/test-cloud/image/upload/v123/student_profiles/owner/asset.jpg',public_id:'student_profiles/owner/asset',signature:'a'.repeat(40)})},null,{platform:'android',signed:profileSigned});
  const receipt=await upload('file:///gallery/profile.jpg','student_profiles');
  const body=Buffer.from(calls[0].encoded.body);
  assert.ok(body.includes(Buffer.from(photoBytes)));
  assert.ok(body.toString().includes('name="folder"\r\n\r\nstudent_profiles'));
  assert.ok(body.toString().includes('name="type"\r\n\r\nupload'));
  assert.equal(receipt.url,'https://res.cloudinary.com/test-cloud/image/upload/v123/student_profiles/owner/asset.jpg');
});
