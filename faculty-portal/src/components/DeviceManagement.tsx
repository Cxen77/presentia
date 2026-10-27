import { useEffect,useState } from 'react';
import { getStudentDevices,getDeviceConflicts,resolveStudentDevice,type ManagedPerson,type RegisteredDevice } from '../services/api';
import { Dialog,InlineError } from './ui/PortalUI';

export function DeviceManagement({student,students,onClose}:{student:ManagedPerson;students:ManagedPerson[];onClose:()=>void}) {
  const [devices,setDevices]=useState<RegisteredDevice[]>([]);
  const [conflicts,setConflicts]=useState<Awaited<ReturnType<typeof getDeviceConflicts>>>([]);
  const [selected,setSelected]=useState('');
  const [owner,setOwner]=useState(student.id);
  const [status,setStatus]=useState<'active'|'revoked'>('active');
  const [reason,setReason]=useState('');
  const [error,setError]=useState<string|null>(null);
  const [busy,setBusy]=useState(false);
  const [loading,setLoading]=useState(true);
  useEffect(()=>{let active=true;Promise.all([getStudentDevices(student.id),getDeviceConflicts()]).then(([devices,conflicts])=>{if(active){setDevices(devices);setConflicts(conflicts);}}).catch(error=>{if(active)setError(error.message);}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[student.id]);
  const relevantConflicts=conflicts.filter(c=>c.attempted_student_id===student.id||devices.some(d=>d.installation_id===c.installation_id));
  const installations=[...new Set([...devices.map(d=>d.installation_id),...relevantConflicts.map(c=>c.installation_id)])];
  return <Dialog title={`Devices · ${student.name}`} onClose={()=>{if(!busy)onClose();}}><InlineError message={error}/>
    <p className="review-dialog-copy">Verify the student’s identity before changing ownership. Resetting does not delete attendance history. Browser and installation IDs can be reset or spoofed.</p>
    {loading?<p role="status">Loading registered devices…</p>:<>
      <ul className="space-y-2 my-3">{devices.map(d=><li key={d.installation_id}><strong>{d.platform} · {d.status}</strong><small className="block break-all">{d.installation_id} · Last seen {new Date(d.last_seen_at).toLocaleString()}</small></li>)}</ul>
      {relevantConflicts.length>0&&<p role="note">{relevantConflicts.length} cross-account conflict(s) recorded. Resolve only after verifying the legitimate owner.</p>}
      {!installations.length?<p>No registered installations or conflicts.</p>:<form className="space-y-3" onSubmit={async event=>{event.preventDefault();setBusy(true);setError(null);try{await resolveStudentDevice(selected,{studentId:owner,status,reason});onClose();}catch(error){setError(error instanceof Error?error.message:'Resolution failed.');}finally{setBusy(false);}}}>
        <label className="field">Installation<select required value={selected} onChange={e=>setSelected(e.target.value)}><option value="">Select an installation</option>{installations.map(id=><option key={id} value={id}>{id}</option>)}</select></label>
        <label className="field">Confirmed owner<select value={owner} onChange={e=>setOwner(e.target.value)}>{students.map(p=><option key={p.id} value={p.id}>{p.name} · {p.loginId}</option>)}</select></label>
        <label className="field">Access<select value={status} onChange={e=>setStatus(e.target.value as 'active'|'revoked')}><option value="active">Active / restore access</option><option value="revoked">Revoke attendance access</option></select></label>
        <label className="field">Resolution reason<textarea required minLength={5} maxLength={500} value={reason} onChange={e=>setReason(e.target.value)}/></label>
        <button className="p-button" disabled={busy||!selected}>{busy?'Saving…':'Save ownership resolution'}</button>
      </form>}
    </>}
  </Dialog>;
}
