export interface AuditInput {
  id:string;student_id:string;installation_id:string|null;device_status_at_submission:string|null;
  registered_student_id:string|null;registered_status:string|null;cross_account_reuse:boolean;
  checkin_location?:{scan?:{mocked?:boolean|null};submission?:{mocked?:boolean|null;accuracy?:number;capturedAt?:number}}|null;
  avatar_url:string|null;verification_photo_url:string|null;
}
export interface PhotoVerificationProvider {
  name:string;
  // Only invoked by the deferred worker. Implementations must bound memory/time and
  // document consent, thresholds and resource costs before being enabled.
  compare(input:{profilePhoto:string;selfie:string;signal:AbortSignal}):Promise<{status:'match'|'no_match'|'review_required';reason:string}>;
}
export async function analyzeSubmission(input:AuditInput,provider?:PhotoVerificationProvider) {
  const reasons:string[]=[];
  const deviceStatus=!input.installation_id?'unknown':input.registered_student_id!==input.student_id?'ownership_conflict':input.registered_status!=='active'?'revoked':'registered';
  if(deviceStatus!=='registered') reasons.push(`Device: ${deviceStatus.replace(/_/g,' ')}`);
  if(input.cross_account_reuse)reasons.push('Installation used by multiple accounts in this session');
  const mocked=[input.checkin_location?.scan?.mocked,input.checkin_location?.submission?.mocked];
  const mockStatus=mocked.includes(true)?'detected':mocked.every(value=>value===false)?'not_detected':'unknown';
  if(mockStatus==='detected')reasons.push('Mock-location provider reported by device');
  if(mockStatus==='unknown')reasons.push('Mock-location verification unavailable');
  let face:{status:string;reason:string;provider:string}={status:'review_required',reason:'Automatic photo comparison is not configured. Faculty must compare the profile and selfie.',provider:'faculty'};
  if(!input.avatar_url || !input.verification_photo_url) {
    face={...face,reason:'A photo is missing. Faculty review is required.'};
    reasons.push('A profile photo or attendance selfie is missing');
  } else if(provider) {
    const controller=new AbortController();
    let timer:ReturnType<typeof setTimeout>|undefined;
    try {
      const result=await Promise.race([
        provider.compare({profilePhoto:input.avatar_url,selfie:input.verification_photo_url,signal:controller.signal}),
        new Promise<never>((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(new Error('Photo verification timed out'));},2000);}),
      ]);
      if(!['match','no_match','review_required'].includes(result.status)||!result.reason?.trim())throw new Error('Invalid comparison response');
      face={...result,provider:provider.name};
    } finally {if(timer)clearTimeout(timer);}
  }
  return {version:1,auditedAt:new Date().toISOString(),deviceStatus,deviceConflict:input.cross_account_reuse||deviceStatus==='ownership_conflict',
    mockStatus,accuracy:input.checkin_location?.submission?.accuracy??null,locationCapturedAt:input.checkin_location?.submission?.capturedAt??null,
    face,reasons:[...reasons,...(face.status!=='match'?[face.reason]:[])],
    requiresSignalReview:reasons.length>0||face.status==='no_match',status:'faculty_review_required'};
}
