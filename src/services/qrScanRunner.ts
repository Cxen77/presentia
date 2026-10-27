import type { CheckInLocation } from './api';

type Validation<T> = {type:'class_invite'|'attendance_session'|'invalid';classData?:T;attendanceToken?:string;courseCode?:string;message?:string};
type Scan = {scanTicket:string;expiresAt:number;sessionId:string};
export type ScanUpdate<T> = {phase:'checking'|'locating'|'verifying'}
  | {phase:'permission';gate:'primer'|'settings';payload:string}
  | {phase:'invitation';classData:T}
  | {phase:'attendance';token:string;courseCode?:string;scan:Scan}
  | {phase:'error';message:string};

async function bounded<T>(work:Promise<T>,ms:number,message:string):Promise<T> {
  let timer:ReturnType<typeof setTimeout>|undefined;
  try {return await Promise.race([work,new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new Error(message)),ms);})]);}
  finally {if(timer)clearTimeout(timer);}
}

/** One synchronous latch per scan, with cancellation when a modal closes/retries.
 * A camera may deliver several frames before React commits its next state. */
export function createQRScanRunner<T>(deps:{
  validate:(payload:string)=>Promise<Validation<T>>;
  permission:()=>Promise<'granted'|'primer'|'settings'>;
  location:()=>Promise<CheckInLocation|null>;
  attendance:(token:string,location:CheckInLocation|null)=>Promise<Scan>;
  update:(update:ScanUpdate<T>)=>void;
  validationTimeoutMs?:number;
}) {
  let locked=false,revision=0;
  return {
    reset(){revision++;locked=false;},
    async scan(payload:string) {
      if(locked)return;
      locked=true;
      const attempt=revision;
      const current=()=>revision===attempt;
      const update=(value:ScanUpdate<T>)=>{if(current())deps.update(value);};
      update({phase:'checking'});
      try {
        const result=await bounded(deps.validate(payload),deps.validationTimeoutMs??20000,'QR validation timed out. Check your connection and tap Scan again.');
        if(!current())return;
        if(result.type==='class_invite'&&result.classData){update({phase:'invitation',classData:result.classData});return;}
        if(result.type!=='attendance_session'||!result.attendanceToken)throw new Error(result.message||'This is not a valid Presentia QR code.');
        const permission=await bounded(deps.permission(),10000,'Could not check location permission. Tap Scan again to retry.');
        if(!current())return;
        if(permission!=='granted'){update({phase:'permission',gate:permission,payload});return;}
        update({phase:'locating'});
        // Failed fixes stay unknown; the backend still enforces campus policy.
        const location=await bounded(deps.location(),16000,'Location unavailable').catch(()=>null);
        if(!current())return;
        update({phase:'verifying'});
        const scan=await bounded(deps.attendance(result.attendanceToken,location),35000,'Attendance validation timed out. Tap Scan again and scan the latest code.');
        if(current())update({phase:'attendance',token:result.attendanceToken,courseCode:result.courseCode,scan});
      } catch(error) {
        update({phase:'error',message:error instanceof Error?error.message:'Could not read this QR. Tap Scan again.'});
      }
    },
  };
}
