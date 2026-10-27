import { useState } from 'react';
import type { AttendanceRecord } from '../../types';
import { verifyAttendance } from '../../services/api';
import { Disclosure } from '../ui/PortalUI';

export function AuditReview({record,sessionOpen,onReviewed}:{record:AttendanceRecord;sessionOpen:boolean;onReviewed:()=>Promise<void>}) {
  const [reason,setReason]=useState('');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const findings=record.auditFindings;
  const decide=async(status:'PRESENT'|'REJECTED')=>{
    if(reason.trim().length<5){setError('Enter a reason with at least 5 characters.');return;}
    setBusy(true);setError('');
    try {await verifyAttendance(record.id,{status,rejectionReason:reason.trim()});await onReviewed();setReason('');}
    catch(error){setError(error instanceof Error?error.message:'Could not save review.');}
    finally{setBusy(false);}
  };
  return <Disclosure title={findings?.requiresSignalReview ? 'Signal review required' : 'Verification details'} description={findings ? `${findings.deviceStatus.replace(/_/g,' ')} · Location: ${findings.mockStatus.replace(/_/g,' ')}` : 'Post-session audit pending'}>
    <p>Registered device: {findings?.deviceStatus.replace(/_/g,' ') || record.deviceStatus || 'unknown'}</p>
    <p>Mock location: {findings?.mockStatus==='detected'?'detected':findings?.mockStatus==='not_detected'?'not detected by device':'unknown'}</p>
    {findings?.deviceConflict && <p role="note">Device ownership conflict requires review.</p>}
    {findings?.reasons.map(reason=><p key={reason}>{reason}</p>)}
    {record.checkinLocation && <>
      <p>Campus restriction: {record.checkinLocation.campusRestricted?'enabled':'off'} · GPS accuracy: {record.checkinLocation.submission?`±${Math.round(record.checkinLocation.submission.accuracy)} m`:'unknown'}</p>
      {record.checkinLocation.scan && <p>Scan: {record.checkinLocation.scan.latitude.toFixed(5)}, {record.checkinLocation.scan.longitude.toFixed(5)}</p>}
      {record.checkinLocation.submission && <p>Submission: {record.checkinLocation.submission.latitude.toFixed(5)}, {record.checkinLocation.submission.longitude.toFixed(5)} · {record.checkinLocation.submission.platform}</p>}
      <p>Received: {new Date(record.checkinLocation.receivedAt).toLocaleString()}</p>
    </>}
    <p>These are risk signals, not proof of fraud or liveness.</p>
    {record.riskReviewDecision && <p>Reviewed: {record.riskReviewDecision==='PRESENT'?'confirmed':'rejected'} · {record.riskReviewReason}</p>}
    {findings?.requiresSignalReview && !sessionOpen && <div className="space-y-2 mt-2">
      <label className="field">Review reason<textarea aria-describedby={`audit-error-${record.id}`} value={reason} onChange={event=>setReason(event.target.value)} minLength={5} maxLength={500} rows={2}/></label>
      <p id={`audit-error-${record.id}`} role={error?'alert':undefined}>{error || 'Explain the decision before saving (5–500 characters).'}</p>
      <div className="flex flex-wrap gap-2"><button className="p-button secondary small" disabled={busy} onClick={()=>void decide('REJECTED')}>Reject with reason</button><button className="p-button small" disabled={busy} onClick={()=>void decide('PRESENT')}>{busy?'Saving…':'Confirm after review'}</button></div>
    </div>}
  </Disclosure>;
}
