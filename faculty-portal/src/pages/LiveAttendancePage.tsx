import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { QrCode, Clock, Users, CheckCircle2, XCircle, RefreshCw, StopCircle, FileSpreadsheet, Play, Maximize2, ChevronRight } from 'lucide-react';
import { Dialog, Disclosure, InlineError, PageHeading } from '../components/ui/PortalUI';
import { useAuth } from '../context/AuthContext';
import { attendanceDataService } from '../services/attendanceDataService';
import { supabase, isSupabaseConfigured } from '../services/supabase';
import { AttendanceSession, ClassItem, AttendanceRecord } from '../types';
import { SubmissionReviewFeed } from '../components/attendance/SubmissionReviewFeed';
import { downloadSessionReport } from '../services/api';

const PreviewSubmissionReview = import.meta.env.DEV ? React.lazy(() => import('../components/attendance/PreviewSubmissionReview')) : null;

export const LiveAttendancePage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [activeSession, setActiveSession] = useState<AttendanceSession | null>(null);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [secondsRemaining, setSecondsRemaining] = useState<number>(25);
  const [rejectModalRecord, setRejectModalRecord] = useState<AttendanceRecord | null>(null);
  const [rejectReason, setRejectReason] = useState<string>('Visual photo mismatch with student profile');
  const [confirmEndModal, setConfirmEndModal] = useState<boolean>(false);
  const [exporting,setExporting]=useState(false);
  const [view, setView] = useState<'PENDING'|'PRESENT'|'REJECTED'>('PENDING');
  const [loading, setLoading] = useState(true);
  const [previewEnabled, setPreviewEnabled] = useState(import.meta.env.DEV);
  const [projectQR, setProjectQR] = useState(false);
  const [ending, setEnding] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [deciding,setDeciding]=useState<string|null>(null);
  const rotating=useRef(false);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const activeSessionId=activeSession?.id;

  // Load classes and active session
  const refreshData = useCallback(async () => {
    if (!user) return;
    try {
    const classList = await attendanceDataService.getClasses(user.id);
    const activeClasses = classList.filter(c=>c.isActive);
    setClasses(activeClasses);
    setSelectedClassId(previous=>activeClasses.some(cls=>cls.id===previous) ? previous : activeClasses[0]?.id || '');

    const session = await attendanceDataService.getActiveSession(user.id);
    setActiveSession(session);

    if (session) {
      const sessionRecs = await attendanceDataService.getSessionRecords(session.id);
      setRecords(sessionRecs);
    } else setRecords([]);
    setStartError(null);
    } catch(error) { setStartError(error instanceof Error ? error.message : 'Could not load attendance.'); }
    finally {setLoading(false);}
  },[user]);

  useEffect(() => {
    refreshData();
    const unsubscribe = attendanceDataService.subscribe(() => {
      refreshData();
    });
    return () => unsubscribe();
  }, [refreshData]);

  // Real-time Supabase attendance_records live updates
  useEffect(() => {
    if (!activeSessionId || !isSupabaseConfigured()) return;

    const channel = supabase
      .channel(`live_attendance_${activeSessionId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'attendance_records',
          filter: `session_id=eq.${activeSessionId}`,
        },
        async () => {
          try { setRecords(await attendanceDataService.getSessionRecords(activeSessionId)); }
          catch(error) {setStartError(error instanceof Error?error.message:'Could not refresh submissions.');}
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeSessionId]);

  useEffect(()=>{
    if(!activeSession?.id)return;
    const id=activeSession.id;
    const timer=setInterval(()=>{void attendanceDataService.getSessionRecords(id).then(setRecords).catch(error=>setStartError(error.message));},5000);
    return()=>clearInterval(timer);
  },[activeSession?.id]);

  // Periodic QR Code Rotation & Countdown Timer (every 25 seconds)
  useEffect(() => {
    if (!activeSession || activeSession.status !== 'ACTIVE') return;

    const timer = setInterval(async () => {
      const now = Date.now();
      const diff = Math.max(0, Math.ceil((activeSession.tokenExpiresAt - now) / 1000));

      if (diff <= 0 && !rotating.current) {
        rotating.current=true;
        try {
        // Rotate token!
        const updated = await attendanceDataService.rotateQRToken(activeSession.id);
        if (updated) {
          setActiveSession(previous=>previous?.id===activeSession.id?{...previous,...updated}:previous);
          setSecondsRemaining(25);
        }
        } catch(error) {setStartError(error instanceof Error?error.message:'QR refresh failed. Please retry.');}
        finally {rotating.current=false;}
      } else {
        setSecondsRemaining(diff);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [activeSession]);

  const handleStartSession = async (classIdToStart?: string) => {
    if (!user) return;
    const targetId = classIdToStart || selectedClassId;
    if (!targetId) return;

    setStarting(true); setStartError(null);
    try {
      const session = await attendanceDataService.startSession(targetId, user.id, user.name);
      setActiveSession(session); setSecondsRemaining(25);
    } catch (error) { setStartError(error instanceof Error ? error.message : 'Unable to start attendance.'); }
    finally { setStarting(false); }
  };

  const handleConfirmStudent = async (recordId: string) => {
    if (!user || deciding) return;
    setDeciding(recordId);setStartError(null);
    try {await attendanceDataService.verifySubmission(recordId, 'PRESENT', user.id, user.name);if(activeSession)setRecords(await attendanceDataService.getSessionRecords(activeSession.id));}
    catch(error){setStartError(error instanceof Error?error.message:'Could not confirm attendance.');}
    finally{setDeciding(null);}
  };

  const handleRejectStudent = async () => {
    if (!user || !rejectModalRecord || deciding) return;
    setDeciding(rejectModalRecord.id);setStartError(null);
    try {
    await attendanceDataService.verifySubmission(
      rejectModalRecord.id,
      'REJECTED',
      user.id,
      user.name,
      rejectReason
    );
    setRejectModalRecord(null);
    if(activeSession)setRecords(await attendanceDataService.getSessionRecords(activeSession.id));
    }catch(error){setStartError(error instanceof Error?error.message:'Could not reject attendance.');}
    finally{setDeciding(null);}
  };

  const handleEndSession = async () => {
    if (!activeSession || ending) return;
    setEnding(true);
    try {await attendanceDataService.endSession(activeSession.id);setConfirmEndModal(false);navigate('/reports');}
    catch(error){setStartError(error instanceof Error?error.message:'Could not end session.');setConfirmEndModal(false);}
    finally {setEnding(false);}
  };

  const handleDownload=async()=>{if(!activeSession)return;setExporting(true);try{await downloadSessionReport(activeSession.id);}catch(error){setStartError(error instanceof Error?error.message:'Download failed.');}finally{setExporting(false);}};

  // Metrics
  const pendingRecords = records.filter(r => r.status === 'PENDING');
  const presentRecords = records.filter(r => r.status === 'PRESENT');
  const rejectedRecords = records.filter(r => r.status === 'REJECTED');
  const totalEnrolled = classes.find(cls => cls.id === activeSession?.classId)?.enrolledStudentsCount ?? 0;

  // QR Code Payload (JSON formatted with token, session id, and cryptographic timestamp)
  const qrPayload = activeSession ? JSON.stringify({
    type: 'ATTENDANCE_CHECKIN',
    sessionId: activeSession.id,
    classId: activeSession.classId,
    courseCode: activeSession.courseCode,
    token: activeSession.currentToken,
    expiresAt: activeSession.tokenExpiresAt,
    sequence: activeSession.tokenRotationCount,
  }) : '';

  const decidedRecords = view === 'PRESENT' ? presentRecords : rejectedRecords;
  return <div className="page-stack attendance-desk">
    <PageHeading title="Live attendance" description={loading ? 'Loading your attendance session…' : activeSession ? `${activeSession.courseCode} · ${activeSession.className}` : 'Choose a class to open student check-in.'}
      action={<div className="flex flex-wrap gap-2"><button className={`p-button secondary ${refreshing ? "is-refreshing" : ""}`} disabled={refreshing} onClick={async () => {setRefreshing(true);try {await refreshData();} finally {setRefreshing(false);}}} aria-label="Refresh attendance"><RefreshCw size={14}/><span className="attendance-refresh-label">Refresh</span></button>{activeSession && <><button className="p-button secondary" disabled={exporting || !records.length} onClick={handleDownload}><FileSpreadsheet size={14}/>{exporting ? 'Downloading…' : 'Download sheet'}</button>{activeSession.status === 'ACTIVE' && <button className="p-button secondary" onClick={() => setConfirmEndModal(true)}><StopCircle size={14}/>End session</button>}</>}</div>}/>
    <InlineError message={startError}/>
    {loading ? <div className="attendance-loading" role="status"><RefreshCw size={18} className="loading-turn"/>Loading attendance…</div> : !activeSession ? <section className="attendance-start"><div className="attendance-start-mark"><QrCode size={28}/></div><h2>Open your class for check-in</h2><p>Students scan the code and send a selfie. You compare it with their profile photo before confirming attendance.</p><label className="field">Class<select aria-label="Class for attendance" value={selectedClassId} onChange={event => setSelectedClassId(event.target.value)}>{!classes.length && <option value="">No classes available</option>}{classes.map(cls => <option key={cls.id} value={cls.id}>{cls.courseCode} — {cls.className}</option>)}</select></label>{!classes.length && <Link to="/create-class" className="text-link">Create a class first</Link>}<button className="p-button" disabled={!selectedClassId || starting} onClick={() => void handleStartSession()}><Play size={15}/>{starting ? 'Starting…' : 'Start attendance'}</button><Disclosure title="How attendance works"><p>Share the rotating QR with your class. Review each profile photo and selfie, confirm or reject the submission, then download your sheet.</p></Disclosure></section> : <>
      <div className="attendance-session-meta"><span className="session-state"><span className="desk-state-mark"/>{activeSession.status === 'ACTIVE' ? 'Check-in open' : 'Check-in closed'}</span><span><strong>{totalEnrolled}</strong> enrolled</span><span><strong>{records.length}</strong> submitted</span><span className="session-room">{activeSession.room}</span></div>
      <div className="attendance-workbench">
        <aside className="qr-station"><div className="qr-station-heading"><h2>Scan to check in</h2><button className="icon-button" aria-label="Enlarge QR code" onClick={() => setProjectQR(true)}><Maximize2 size={16}/></button></div>
          <div className="qr-paper">{activeSession.status === 'ACTIVE' ? <div key={activeSession.tokenRotationCount} className="qr-rollover"><QRCodeSVG role="img" aria-label={`Attendance QR code for ${activeSession.courseCode}`} value={qrPayload} size={228} level="H" includeMargin={false}/></div> : <p>Scanning is closed.<br/>You can still review submissions.</p>}</div>
          {activeSession.status === 'ACTIVE' && <div className="qr-timing"><div><span><Clock size={13}/>Next code</span><strong>{secondsRemaining}s</strong></div><div className="qr-timer-track" role="progressbar" aria-label="QR code validity" aria-valuenow={Math.min(25,secondsRemaining)} aria-valuemin={0} aria-valuemax={25}><span style={{transform:`scaleX(${Math.max(0,Math.min(1,secondsRemaining/25))})`}}/></div><p>The code refreshes every 25 seconds.</p></div>}
          <div className="qr-course-meta"><span>{activeSession.courseCode}</span><p>{activeSession.className}</p></div>
          <Disclosure title="Session details"><p>Code rotation {activeSession.tokenRotationCount}. Students must submit a selfie for your review; scanning alone does not mark them present.</p></Disclosure>
        </aside>
        <section className="review-workspace" aria-label="Student submission review">
          <div className="review-tabs" style={{"--review-tab-index": view === "PENDING" ? 0 : view === "PRESENT" ? 1 : 2} as React.CSSProperties} aria-label="Submission status">{([{value:'PENDING',label:'To review',count:pendingRecords.length},{value:'PRESENT',label:'Confirmed',count:presentRecords.length},{value:'REJECTED',label:'Rejected',count:rejectedRecords.length}] as const).map(tab => <button key={tab.value} className={view === tab.value ? 'is-active' : ''} aria-pressed={view === tab.value} onClick={() => setView(tab.value)}>{tab.label}<span>{tab.count}</span></button>)}</div>
          <div key={view} className="review-view">
            {view === 'PENDING' ? <>{PreviewSubmissionReview && pendingRecords.length === 0 && <div className="review-preview-notice"><span>{previewEnabled ? 'Design preview · sample photos, not an attendance record' : 'No live submissions waiting'}</span><button onClick={() => setPreviewEnabled(enabled => !enabled)}>{previewEnabled ? 'Show real queue' : 'Show test review'}</button></div>}{PreviewSubmissionReview && previewEnabled && pendingRecords.length === 0 ? <React.Suspense fallback={<p className="desk-loading">Loading test review…</p>}><PreviewSubmissionReview/></React.Suspense> : <SubmissionReviewFeed records={pendingRecords} deciding={deciding} sessionOpen={activeSession.status === 'ACTIVE'} hasSubmissions={records.length > 0} onConfirm={id => void handleConfirmStudent(id)} onReject={record => {setRejectModalRecord(record);setRejectReason('Visual photo mismatch with student profile');}}/>}</> : <div className="decision-register">{!decidedRecords.length ? <div className="review-empty"><span className="review-empty-mark">{view === 'PRESENT' ? <CheckCircle2 size={25}/> : <XCircle size={25}/>}</span><h2>{view === 'PRESENT' ? 'No confirmations yet' : 'No rejected submissions'}</h2><p>{view === 'PRESENT' ? 'Students appear here after you confirm their photos.' : 'Rejected submissions and their reasons appear here.'}</p></div> : <ul>{decidedRecords.map(record => <li key={record.id}><span className="decision-avatar">{record.studentName.slice(0,1).toUpperCase()}</span><div><strong>{record.studentName}</strong><small>{record.studentRollNumber} · Roll {record.studentClassRollNumber || '—'} · Section {record.studentSection || '—'}</small>{view === 'REJECTED' && <p>{record.rejectionReason || 'Photo mismatch'}</p>}</div><span className="decision-result"><span className="decision-label">{view === 'PRESENT' ? <CheckCircle2 size={14}/> : <XCircle size={14}/>} {view === 'PRESENT' ? 'Present' : 'Rejected'}</span>{record.verifiedAt && <time dateTime={new Date(record.verifiedAt).toISOString()}>{new Date(record.verifiedAt).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</time>}</span></li>)}</ul>}</div>}
          </div>
        </section>
      </div>
    </>}
    {projectQR && activeSession && <Dialog title={activeSession.courseCode + ' check-in'} onClose={() => setProjectQR(false)}><div className="projected-qr">{activeSession.status === 'ACTIVE' ? <QRCodeSVG role="img" aria-label={`Attendance QR code for ${activeSession.courseCode}`} value={qrPayload} size={460} level="H" includeMargin/> : <p>Scanning is closed.</p>}<p>{activeSession.className}</p><span>Scan with the student app</span></div></Dialog>}
    {rejectModalRecord && <Dialog title="Reject submission" onClose={() => {if(!deciding)setRejectModalRecord(null);}}><p className="review-dialog-copy">{rejectModalRecord.studentName} will not be marked present. Choose a reason for the attendance record.</p><label className="field">Reason<select value={rejectReason} onChange={event => setRejectReason(event.target.value)}><option>Visual photo mismatch with student profile</option><option>Student not physically present in classroom</option><option>Photo blurry, dark, or obscured</option><option>Proxy attempt or screen replay photo</option></select></label><div className="review-dialog-actions"><button className="p-button secondary" disabled={!!deciding} onClick={() => setRejectModalRecord(null)}>Cancel</button><button className="p-button" disabled={!!deciding} onClick={() => void handleRejectStudent()}>{deciding ? 'Saving…' : 'Reject submission'}</button></div></Dialog>}
    {confirmEndModal && <Dialog title="End this session?" onClose={() => {if(!ending)setConfirmEndModal(false);}}><p className="review-dialog-copy">Students will no longer be able to scan or submit. Your attendance records will remain available.</p>{pendingRecords.length > 0 && <p className="review-dialog-copy">{pendingRecords.length} submissions still need your review.</p>}<div className="review-dialog-actions"><button className="p-button secondary" disabled={ending} onClick={() => setConfirmEndModal(false)}>Keep session open</button><button className="p-button" disabled={ending} onClick={() => void handleEndSession()}>{ending ? 'Ending…' : 'End session and view report'}<ChevronRight size={14}/></button></div></Dialog>}
  </div>;
};
