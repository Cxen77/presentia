import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AttendanceQRCode } from '../components/attendance/AttendanceQRCode';
import { QrCode, Clock, CheckCircle2, RefreshCw, StopCircle, FileSpreadsheet, Play, Maximize2, ChevronRight } from 'lucide-react';
import { Dialog, Disclosure, InlineError, PageHeading, WorkbenchSkeleton } from '../components/ui/PortalUI';
import { useAuth } from '../context/AuthContext';
import { attendanceDataService } from '../services/attendanceDataService';
import { supabase, isSupabaseConfigured } from '../services/supabase';
import { AttendanceSession, ClassItem, AttendanceRecord } from '../types';
import { SubmissionReviewFeed } from '../components/attendance/SubmissionReviewFeed';
import { downloadSessionReport, getSession, getSessionAudit, type SessionAudit, type BatchReview } from '../services/api';
import { prepareBatchReview } from '../utils/batchReview';
import { notify } from '../services/toast';
import { AnimatedNumber } from '../components/ui/Motion';

const PreviewSubmissionReview = import.meta.env.DEV ? React.lazy(() => import('../components/attendance/PreviewSubmissionReview')) : null;

export const LiveAttendancePage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const requestedSessionId = searchParams.get('session');

  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [activeSession, setActiveSession] = useState<AttendanceSession | null>(null);
  const [audit,setAudit]=useState<SessionAudit|null>(null);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [secondsRemaining, setSecondsRemaining] = useState<number>(25);
  const [choices, setChoices] = useState<{sessionId:string;values:Record<string,boolean>}>({sessionId:'',values:{}});
  const [reviewDraft, setReviewDraft] = useState<BatchReview | null>(null);
  const [finalizing, setFinalizing] = useState(false);
  const [confirmEndModal, setConfirmEndModal] = useState<boolean>(false);
  const [exporting,setExporting]=useState(false);
  const [loading, setLoading] = useState(true);
  const [previewEnabled, setPreviewEnabled] = useState(import.meta.env.DEV);
  const [projectQR, setProjectQR] = useState(false);
  const [ending, setEnding] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
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

    const session = requestedSessionId ? await getSession(requestedSessionId) : await attendanceDataService.getActiveSession(user.id);
    setActiveSession(session);

    if (session) {
      const sessionRecs = await attendanceDataService.getSessionRecords(session.id);
      setRecords(sessionRecs);
      setAudit(await getSessionAudit(session.id));
    } else setRecords([]);
    setStartError(null);
    } catch(error) { setStartError(error instanceof Error ? error.message : 'Could not load attendance.'); }
    finally {setLoading(false);}
  },[user, requestedSessionId]);

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

  const auditRequired=audit?.required;
  const auditStatus=audit?.status;
  useEffect(()=>{
    if(!activeSession?.id || activeSession.finalizedAt || (activeSession.status!=='ACTIVE' && auditRequired!==undefined && (!auditRequired || auditStatus==='complete')))return;
    const id=activeSession.id;
    let active=true,inFlight=false;
    const timer=setInterval(()=>{
      if(inFlight)return;
      inFlight=true;
      void Promise.all([attendanceDataService.getSessionRecords(id),getSessionAudit(id)]).then(([records,audit])=>{
        if(!active)return;
        setRecords(records);setAudit(audit);
        if(audit.status!=='collecting')setActiveSession(previous=>previous?.id===id&&previous.status==='ACTIVE'?{...previous,status:'AWAITING_VERIFICATION'}:previous);
      }).catch(error=>{if(active)setStartError(error.message);}).finally(()=>{inFlight=false;});
    },5000);
    return()=>{active=false;clearInterval(timer);};
  },[activeSession?.id,activeSession?.status,activeSession?.finalizedAt,auditRequired,auditStatus]);

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
      notify.success('Check-in is open', `${session.courseCode} is accepting scans.`);
    } catch (error) { setStartError(error instanceof Error ? error.message : 'Unable to start attendance.'); }
    finally { setStarting(false); }
  };

  const handleEndSession = async () => {
    if (!activeSession || ending) return;
    setEnding(true);
    try {const updated=await attendanceDataService.endSession(activeSession.id);setActiveSession(previous=>previous ? {...previous,...updated} : previous);setConfirmEndModal(false);await refreshData();notify.info('Check-in closed','Review the submissions, then confirm the class.');}
    catch(error){setStartError(error instanceof Error?error.message:'Could not end session.');setConfirmEndModal(false);}
    finally {setEnding(false);}
  };

  const handleDownload=async()=>{if(!activeSession)return;setExporting(true);try{await downloadSessionReport(activeSession.id);}catch(error){setStartError(error instanceof Error?error.message:'Download failed.');}finally{setExporting(false);}};

  const excludedIds = new Set(records.filter(record => choices.sessionId === activeSession?.id
    ? choices.values[record.id] ?? record.status === 'REJECTED' : record.status === 'REJECTED').map(record => record.id));
  const totalEnrolled = classes.find(cls => cls.id === activeSession?.classId)?.enrolledStudentsCount ?? 0;
  const previewShown = Boolean(PreviewSubmissionReview && previewEnabled && records.length === 0);
  const toggleExcluded = (id:string) => {
    if (!activeSession || finalizing || activeSession.finalizedAt) return;
    const wasExcluded = excludedIds.has(id);
    setChoices(previous => ({sessionId:activeSession.id,values:{...(previous.sessionId === activeSession.id ? previous.values : {}),[id]:!wasExcluded}}));
  };
  const auditBlocked=!!audit?.required && audit.status!=='complete';
  const pendingSignalReview=records.some(r=>r.auditFindings?.requiresSignalReview && (!r.riskReviewDecision || r.riskReviewDecision!==(excludedIds.has(r.id)?'REJECTED':'PRESENT')));
  const reviewedRecord=async()=>{if(!activeSession)return;const updated=await attendanceDataService.getSessionRecords(activeSession.id);setRecords(updated);setChoices(previous=>({sessionId:activeSession.id,values:{...(previous.sessionId===activeSession.id?previous.values:{}),...Object.fromEntries(updated.filter(r=>r.riskReviewDecision).map(r=>[r.id,r.riskReviewDecision==='REJECTED']))}}));};
  const openBatchConfirmation = () => {
    if(auditBlocked||pendingSignalReview){setStartError('Wait for the audit and save a reason for each flagged case.');return;}
    try {setStartError(null);setReviewDraft(prepareBatchReview(records,excludedIds,crypto.randomUUID()));}
    catch(error) {setStartError(error instanceof Error ? error.message : 'Refresh the list.');}
  };
  const confirmClass = async () => {
    if (!activeSession || !reviewDraft || finalizing || previewShown) return;
    setFinalizing(true);setStartError(null);
    try {
      await attendanceDataService.finalizeSession(activeSession.id,reviewDraft);
      notify.success('Attendance confirmed', 'The report for this session is ready.');
      navigate(`/reports?session=${activeSession.id}`);
    } catch(error) {setStartError(error instanceof Error ? error.message : 'Could not confirm the class. Retry safely.');}
    finally {setFinalizing(false);}
  };



  return <div className="page-stack attendance-desk">
    <PageHeading title="Live attendance" description={loading ? 'Loading your attendance session…' : activeSession ? `${activeSession.courseCode} · ${activeSession.className}` : 'Choose a class to open student check-in.'}
      action={<div className="flex flex-wrap gap-2"><button className={`p-button secondary ${refreshing ? "is-refreshing" : ""}`} disabled={refreshing} onClick={async () => {setRefreshing(true);try {await refreshData();} finally {setRefreshing(false);}}} aria-label="Refresh attendance"><RefreshCw size={14}/><span className="attendance-refresh-label">Refresh</span></button>{activeSession && <><button className="p-button secondary" disabled={exporting || !records.length} onClick={handleDownload}><FileSpreadsheet size={14}/>{exporting ? 'Downloading…' : 'Download sheet'}</button>{activeSession.status === 'ACTIVE' && <button className="p-button secondary" onClick={() => setConfirmEndModal(true)}><StopCircle size={14}/>End session</button>}</>}</div>}/>
    <InlineError message={startError}/>
    {activeSession && !activeSession.finalizedAt && audit && activeSession.status!=='ACTIVE' && <div className="panel p-3 text-sm" role="status">
      {audit.required ? audit.status==='complete' ? 'Post-session audit complete. Compare photos and review any flagged signals before confirming.' : audit.status==='failed' ? 'Audit interrupted. Saved progress will resume automatically; confirmation is paused.' : 'Post-session audit in progress. Confirmation becomes available when it finishes.' : 'Legacy session: faculty photo review.'}
      {pendingSignalReview && <p>Some submissions need a review decision and reason.</p>}
    </div>}
    {audit && audit.blockedAttempts.length>0 && <Disclosure title="Blocked check-in attempts" description={`${audit.blockedAttempts.length} location verification failures`}>
      {audit.blockedAttempts.map((attempt,index)=><p key={index}>{attempt.student?.full_name} · {attempt.student?.roll_number}: {attempt.reason}</p>)}
    </Disclosure>}
    {loading ? <WorkbenchSkeleton /> : !activeSession ? <section className="attendance-start"><div className="attendance-start-mark"><QrCode size={28}/></div><h2>Open your class for check-in</h2><p>Students scan the code and send a selfie. You compare it with their profile photo before confirming attendance.</p><label className="field">Class<select aria-label="Class for attendance" value={selectedClassId} onChange={event => setSelectedClassId(event.target.value)}>{!classes.length && <option value="">No classes available</option>}{classes.map(cls => <option key={cls.id} value={cls.id}>{cls.courseCode} — {cls.className}</option>)}</select></label>{!classes.length && <Link to="/create-class" className="text-link">Create a class first</Link>}<button className="p-button" disabled={!selectedClassId || starting} onClick={() => void handleStartSession()}><Play size={15}/>{starting ? 'Starting…' : 'Start attendance'}</button><Disclosure title="How attendance works"><p>Share the rotating QR with your class. Review each profile photo and selfie, confirm or reject the submission, then download your sheet.</p></Disclosure></section> : <>
      <div className="attendance-session-meta"><span className="session-state"><span className={`desk-state-mark ${activeSession.status === 'ACTIVE' ? 'is-live' : ''}`}/>{activeSession.status === 'ACTIVE' ? 'Check-in open' : 'Check-in closed'}</span><span><strong>{totalEnrolled}</strong> enrolled</span><span><strong><AnimatedNumber value={records.length}/></strong> submitted</span><span className="session-room">{activeSession.room}</span></div>
      <div className="attendance-workbench">
        <aside className="qr-station"><div className="qr-station-heading"><h2>Scan to check in</h2><button className="icon-button" aria-label="Enlarge QR code" onClick={() => setProjectQR(true)}><Maximize2 size={16}/></button></div>
          <div className="qr-paper">{activeSession.status === 'ACTIVE' ? <div key={activeSession.tokenRotationCount} className="qr-rollover"><AttendanceQRCode token={activeSession.currentToken} courseCode={activeSession.courseCode} size={228}/></div> : <p>Scanning is closed.<br/>You can still review submissions.</p>}</div>
          {activeSession.status === 'ACTIVE' && <div className="qr-timing"><div><span><Clock size={13}/>Next code</span><strong>{secondsRemaining}s</strong></div><div className="qr-timer-track" role="progressbar" aria-label="QR code validity" aria-valuenow={Math.min(25,secondsRemaining)} aria-valuemin={0} aria-valuemax={25}><span style={{transform:`scaleX(${Math.max(0,Math.min(1,secondsRemaining/25))})`}}/></div><p>The code refreshes every 25 seconds.</p></div>}
          <div className="qr-course-meta"><span>{activeSession.courseCode}</span><p>{activeSession.className}</p></div>
          <Disclosure title="Session details"><p>Code rotation {activeSession.tokenRotationCount}. Students must submit a selfie for your review; scanning alone does not mark them present.</p></Disclosure>
        </aside>
        <section className="review-workspace batch-verification-panel" aria-label="Photo verification">
          <header className="batch-panel-heading"><div><h2>Photo verification</h2><p>{activeSession.status === 'ACTIVE' ? 'Submissions appear here live. Exclude anyone who should be absent.' : 'Review the list, exclude any students, then confirm the remaining class together.'}</p></div><span>{records.length} submitted</span></header>
          {activeSession.finalizedAt ? <div className="review-empty"><CheckCircle2 size={28}/><h2>Attendance confirmed</h2><p>The present and absent lists are saved. Session selfies are no longer shown.</p><Link className="p-button mt-4" to={`/reports?session=${activeSession.id}`}>Open report</Link></div> : <>
            {PreviewSubmissionReview && records.length === 0 && <div className="review-preview-notice"><span>{previewShown ? 'Design preview · sample photos, not attendance' : 'No live submissions waiting'}</span><button onClick={() => setPreviewEnabled(enabled => !enabled)}>{previewShown ? 'Show real queue' : 'Show test review'}</button></div>}
            {PreviewSubmissionReview && previewShown ? <React.Suspense fallback={<p className="desk-loading">Loading test review…</p>}><PreviewSubmissionReview/></React.Suspense> : <SubmissionReviewFeed records={records} deciding={finalizing ? 'batch' : null} sessionOpen={activeSession.status === 'ACTIVE'} hasSubmissions={records.length > 0} excludedIds={excludedIds} onToggleExcluded={toggleExcluded} onReviewed={reviewedRecord}/>}
            <footer className="batch-panel-footer"><div><strong>{records.length - excludedIds.size} to confirm<span>{excludedIds.size} excluded</span></strong><p>{previewShown ? 'The sample cannot be saved as attendance.' : 'Excluded students and students without a submission will be absent.'}</p></div>{activeSession.status === 'ACTIVE' ? <button className="p-button" onClick={() => setConfirmEndModal(true)}><StopCircle size={14}/>End check-in & review</button> : <button className="p-button" disabled={finalizing || previewShown || !audit || auditBlocked || pendingSignalReview} onClick={openBatchConfirmation}><CheckCircle2 size={14}/>Confirm remaining students</button>}</footer>
          </>}
        </section>
      </div>
    </>}
    {projectQR && activeSession && <Dialog title={activeSession.courseCode + ' check-in'} onClose={() => setProjectQR(false)}><div className="projected-qr">{activeSession.status === 'ACTIVE' ? <AttendanceQRCode token={activeSession.currentToken} courseCode={activeSession.courseCode} size={460}/> : <p>Scanning is closed.</p>}<p>{activeSession.className}</p><span>Scan with the student app</span></div></Dialog>}
    {reviewDraft && <Dialog title="Confirm class attendance?" onClose={() => {if(!finalizing)setReviewDraft(null);}}><InlineError message={startError}/><div className="batch-confirm-counts"><span><strong>{reviewDraft.expectedRecords.length - reviewDraft.excludedRecordIds.length}</strong>Present</span><span><strong>{reviewDraft.excludedRecordIds.length}</strong>Excluded / absent</span></div><p className="review-dialog-copy">Students without a submission will also be absent. Attendance decisions will be saved together.</p><p className="review-dialog-copy">Session selfies will be permanently deleted after confirmation. Student profile photos and attendance history will remain.</p><div className="review-dialog-actions"><button className="p-button secondary" disabled={finalizing} onClick={() => setReviewDraft(null)}>Back to review</button><button className="p-button" disabled={finalizing} onClick={() => void confirmClass()}>{finalizing ? 'Confirming class…' : 'Confirm class & delete selfies'}</button></div></Dialog>}
    {confirmEndModal && <Dialog title="End check-in and review?" onClose={() => {if(!ending)setConfirmEndModal(false);}}><p className="review-dialog-copy">Students will no longer be able to submit. You can review all photos and exclude students before confirming the class.</p><div className="review-dialog-actions"><button className="p-button secondary" disabled={ending} onClick={() => setConfirmEndModal(false)}>Keep session open</button><button className="p-button" disabled={ending} onClick={() => void handleEndSession()}>{ending ? 'Ending…' : 'End check-in & review'}<ChevronRight size={14}/></button></div></Dialog>}
  </div>;
};
