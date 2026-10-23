import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { 
  QrCode, 
  Clock, 
  Users, 
  CheckCircle2, 
  XCircle, 
  RefreshCw, 
  StopCircle, 
  ShieldAlert,
  FileSpreadsheet,
  Play
} from 'lucide-react';
import { Disclosure, InlineError, PageHeading } from '../components/ui/PortalUI';
import { useAuth } from '../context/AuthContext';
import { attendanceDataService } from '../services/attendanceDataService';
import { supabase, isSupabaseConfigured } from '../services/supabase';
import { AttendanceSession, ClassItem, AttendanceRecord } from '../types';
import { downloadSessionReport } from '../services/api';

function ReviewPhoto({src,alt}:{src:string;alt:string}) {
  const [failed,setFailed]=useState(false);
  if(!src||failed)return <div className="h-full flex flex-col items-center justify-center gap-2 p-3 text-slate-400"><Users size={28}/><span className="text-xs">{!src?'Photo not provided':'Photo unavailable'}</span></div>;
  return <img src={src} alt={alt} onError={()=>setFailed(true)} className="w-full h-full object-cover"/>;
}

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
    setClasses(classList);
    setSelectedClassId(previous=>previous || classList[0]?.id || '');

    const session = await attendanceDataService.getActiveSession(user.id);
    setActiveSession(session);

    if (session) {
      const sessionRecs = await attendanceDataService.getSessionRecords(session.id);
      setRecords(sessionRecs);
    } else setRecords([]);
    setStartError(null);
    } catch(error) { setStartError(error instanceof Error ? error.message : 'Could not load attendance.'); }
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
    if (!activeSession) return;
    try {await attendanceDataService.endSession(activeSession.id);setConfirmEndModal(false);navigate('/reports');}
    catch(error){setStartError(error instanceof Error?error.message:'Could not end session.');setConfirmEndModal(false);}
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

  return (
    <div className="legacy-page page-stack">
      <PageHeading eyebrow="ATTENDANCE" title={activeSession ? activeSession.className : 'Live attendance'} description={activeSession ? `${activeSession.courseCode} · Review incoming submissions below.` : 'Choose a class, share its QR, and review student submissions.'}
        action={<div className="flex flex-wrap gap-2"><button className="p-button secondary" onClick={()=>void refreshData()}><RefreshCw size={14}/>Refresh</button>{activeSession&&<><button className="p-button secondary" disabled={exporting||!records.length} onClick={handleDownload}><FileSpreadsheet size={14}/>{exporting?'Downloading…':'Download sheet'}</button>{activeSession.status==='ACTIVE'&&<button className="p-button danger" onClick={() => setConfirmEndModal(true)}><StopCircle size={14} />End session</button>}</>}</div>} />
      <InlineError message={startError} />
      {/* No Active Session State: Class Selector */}
      {!activeSession ? (
        <div className="session-selector panel space-y-5">
          <div className="session-icon bg-[#202c3e] border border-[#273548] text-[#b5bafa] flex items-center justify-center">
            <QrCode size={32} />
          </div>

          <div>
            <h2 className="text-xl font-bold text-[#eef2f8]">Start a session</h2>
            <p className="text-xs text-[#9aabc1] mt-1.5 max-w-md mx-auto">
              Students use the QR code to submit their attendance for review.
            </p>
          </div>

          <div className="space-y-3 text-left">
            <label className="block text-xs font-semibold text-[#9aabc1] uppercase tracking-wider">
              Class
            </label>
            <select
              aria-label="Class for attendance"
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-[#111b28] border border-[#273548] text-sm text-[#eef2f8] focus:outline-none focus:border-[#b5bafa]"
            >
              {!classes.length && <option value="">No classes available</option>}
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.courseCode} — {c.className} ({c.room})
                </option>
              ))}
            </select>
          </div>

          {!classes.length && <p className="text-xs text-slate-400">Create a class before starting attendance. <Link to="/create-class" className="text-link">Create class</Link></p>}
          <button
            disabled={!selectedClassId || starting}
            onClick={() => handleStartSession()}
            className="w-full py-3.5 px-6 rounded-xl bg-[#F3F2EF] hover:bg-white text-[#101D2C] font-bold text-sm transition-all shadow-lg flex items-center justify-center gap-2"
          >
            <Play size={17} />
            <span>{starting ? 'Starting…' : 'Start attendance'}</span>
          </button>
          <Disclosure title="How it works"><p>Students scan the rotating QR code and submit a photo. Review each submission before confirming attendance, then end the session to open its report.</p></Disclosure>
        </div>
      ) : (
        /* Active Live Attendance View */
        <div className="space-y-6">
          {/* Top Session Stats Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="bg-[#172333] border border-[#273548] rounded-xl p-4 text-center">
              <span className="text-[11px] text-[#9aabc1] font-semibold uppercase">Enrolled</span>
              <p className="text-xl font-bold text-[#eef2f8] mt-0.5">{totalEnrolled}</p>
            </div>

            <div className="bg-[#172333] border border-[#273548] rounded-xl p-4 text-center">
              <span className="text-[11px] text-[#9aabc1] font-semibold uppercase">Submissions</span>
              <p className="text-xl font-bold text-[#b5bafa] mt-0.5">{records.length}</p>
            </div>

            <div className="bg-[#172333] border border-amber-500/40 rounded-xl p-4 text-center bg-amber-950/10">
              <span className="text-[11px] text-amber-300 font-semibold uppercase">Pending Review</span>
              <p className="text-xl font-bold text-amber-400 mt-0.5">{pendingRecords.length}</p>
            </div>

            <div className="bg-[#172333] border border-emerald-500/40 rounded-xl p-4 text-center bg-emerald-950/10">
              <span className="text-[11px] text-emerald-300 font-semibold uppercase">Confirmed</span>
              <p className="text-xl font-bold text-emerald-400 mt-0.5">{presentRecords.length}</p>
            </div>

            <div className="bg-[#172333] border border-red-500/40 rounded-xl p-4 text-center bg-red-950/10">
              <span className="text-[11px] text-red-300 font-semibold uppercase">Rejected</span>
              <p className="text-xl font-bold text-red-400 mt-0.5">{rejectedRecords.length}</p>
            </div>
          </div>

          {/* Main Attendance Split Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Left Column (5 Cols): Dynamic QR Code Projector */}
            <div className="lg:col-span-5 space-y-4">
              <div className="bg-[#111b28] border-2 border-[#273548] rounded-2xl p-6 text-center space-y-4 shadow-xl sticky top-24">
                {/* Header status */}
                <div className="flex items-center justify-between text-xs border-b border-[#273548]/70 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="font-bold text-emerald-400">{activeSession.status==='ACTIVE'?'ACTIVE SESSION':'REVIEW ONLY · SCANNING CLOSED'}</span>
                  </div>
                  <span className="text-[11px] text-[#9aabc1] font-mono">
                    Token #{activeSession.tokenRotationCount}
                  </span>
                </div>

                {/* Course Metadata */}
                <div>
                  <h3 className="text-lg font-bold text-[#eef2f8]">{activeSession.className}</h3>
                  <p className="text-xs text-[#b5bafa] font-semibold mt-0.5">
                    {activeSession.courseCode} • {activeSession.room}
                  </p>
                </div>

                {/* QR Display Card */}
                <div className="bg-white p-4 rounded-xl inline-block mx-auto">
                  {activeSession.status==='ACTIVE'?<QRCodeSVG
                    value={qrPayload}
                    size={210}
                    level="H"
                    includeMargin={false}
                  />:<p className="text-sm text-slate-800 p-5">Session ended.<br/>Review remaining submissions.</p>}
                </div>

                {/* Countdown and Progress */}
                <div className="space-y-2 pt-2">
                  <div className="flex items-center justify-between text-xs text-[#9aabc1]">
                    <span className="flex items-center gap-1.5 font-medium">
                      <Clock size={13} className="text-[#b5bafa]" />
                      QR Code Validity:
                    </span>
                    <span className="font-mono font-bold text-emerald-400 text-sm">
                      {secondsRemaining}s remaining
                    </span>
                  </div>

                  {/* Countdown Progress Bar */}
                  <div className="w-full h-2 rounded-full bg-[#172333] overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-emerald-500 to-[#b5bafa] transition-all duration-1000 ease-linear"
                      style={{ width: `${(secondsRemaining / 25) * 100}%` }}
                    />
                  </div>

                  <p className="text-[11px] text-[#74869d] pt-1">
                    Auto-refreshes every 25s with anti-replay signature. Screenshots are invalidated automatically.
                  </p>
                </div>
              </div>
            </div>

            {/* Right Column (7 Cols): Side-by-Side Verification Queue & Confirmed Roster */}
            <div className="lg:col-span-7 space-y-6">
              {/* Section 1: Pending Visual Verification Requests */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-bold text-[#eef2f8] flex items-center gap-2">
                      <span>Pending Identity Verification</span>
                      <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                        {pendingRecords.length} Awaiting
                      </span>
                    </h2>
                    <p className="text-xs text-[#9aabc1] mt-0.5">
                      Visually inspect the student's registered university photo side-by-side with their live camera verification photo.
                    </p>
                  </div>
                </div>

                {pendingRecords.length === 0 ? (
                  <div className="p-8 text-center rounded-2xl bg-[#172333] border border-dashed border-[#273548]">
                    <CheckCircle2 size={32} className="mx-auto text-emerald-400 mb-2" />
                    <p className="text-sm font-semibold text-[#eef2f8]">All Submissions Reviewed</p>
                    <p className="text-xs text-[#9aabc1] mt-1">
                      No incoming student scans are currently awaiting photo verification.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {pendingRecords.map((record) => (
                      <div
                        key={record.id}
                        className="bg-[#172333] border-2 border-amber-500/50 rounded-2xl p-5 shadow-lg space-y-4"
                      >
                        {/* Student Name Header */}
                        <div className="flex items-center justify-between pb-3 border-b border-[#273548]/60">
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="text-base font-bold text-[#eef2f8]">{record.studentName}</h3>
                              <span className="font-mono text-xs text-[#b5bafa] bg-[#202c3e] px-2 py-0.5 rounded border border-[#273548]">
                                {record.studentRollNumber}
                              </span>
                            </div>
                            <p className="text-[11px] text-[#9aabc1] mt-0.5">
                              Scanned at {new Date(record.submittedAt).toLocaleTimeString()}
                            </p>
                          </div>

                          <span className="px-2.5 py-1 rounded-md text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                            Awaiting Decision
                          </span>
                        </div>

                        {/* Side-by-Side Photo Comparison */}
                        <div className="grid grid-cols-2 gap-4">
                          {/* Left: Registered University Profile Photo */}
                          <div className="space-y-1.5 text-center">
                            <span className="text-[11px] font-semibold text-[#9aabc1] uppercase tracking-wider block">
                              1. Registered Profile
                            </span>
                            <div className="relative aspect-square rounded-xl overflow-hidden border-2 border-[#273548] bg-[#111b28]">
                              <ReviewPhoto key={record.studentAvatarUrl} src={record.studentAvatarUrl} alt={`Registered profile photo of ${record.studentName}`}/>
                              <div className="absolute bottom-1 left-1 right-1 bg-[#0b111b]/80 backdrop-blur-sm py-0.5 text-[10px] text-[#9aabc1] rounded">
                                Database Record
                              </div>
                            </div>
                          </div>

                          {/* Right: Live Current Attendance Verification Photo */}
                          <div className="space-y-1.5 text-center">
                            <span className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider block">
                              2. Live Camera Snapshot
                            </span>
                            <div className="relative aspect-square rounded-xl overflow-hidden border-2 border-emerald-500/60 bg-[#111b28]">
                              <ReviewPhoto key={record.verificationPhotoUrl} src={record.verificationPhotoUrl} alt={`Attendance selfie of ${record.studentName}`}/>
                              <div className="absolute bottom-1 left-1 right-1 bg-emerald-950/80 backdrop-blur-sm py-0.5 text-[10px] text-emerald-300 rounded font-medium">
                                Captured in Classroom
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Decision Buttons */}
                        <div className="grid grid-cols-2 gap-3 pt-2">
                          <button
                            disabled={!!deciding}
                            onClick={() => {
                              setRejectModalRecord(record);
                              setRejectReason('Visual photo mismatch with registered student profile');
                            }}
                            className="py-2.5 px-4 rounded-xl bg-red-500/15 hover:bg-red-500/25 border border-red-500/40 text-red-300 text-xs font-bold transition-all flex items-center justify-center gap-2"
                          >
                            <XCircle size={16} />
                            <span>Reject Submission</span>
                          </button>

                          <button
                            disabled={!!deciding}
                            onClick={() => handleConfirmStudent(record.id)}
                            className="py-2.5 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-[#0b111b] text-xs font-bold transition-all shadow-md flex items-center justify-center gap-2"
                          >
                            <CheckCircle2 size={16} />
                            <span>{deciding===record.id?'Saving…':'Confirm Present'}</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Section 2: Confirmed Present Roster */}
              <div className="space-y-3 pt-4 border-t border-[#273548]/60">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-[#eef2f8] flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-emerald-400" />
                    <span>Confirmed Present ({presentRecords.length})</span>
                  </h3>
                  <span className="text-xs text-[#74869d]">Verified & Authoritative</span>
                </div>

                {presentRecords.length === 0 ? (
                  <div className="p-4 rounded-xl bg-[#172333] border border-[#273548] text-center text-xs text-[#9aabc1]">
                    No students have been confirmed present yet.
                  </div>
                ) : (
                  <div className="rounded-xl border border-[#273548] overflow-hidden bg-[#172333]">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-[#202c3e] text-[#9aabc1] border-b border-[#273548] uppercase font-semibold text-[11px]">
                        <tr>
                          <th className="py-2 px-4">Student</th>
                          <th className="py-2 px-4">USN / Roll No</th>
                          <th className="py-2 px-4">Verified Time</th>
                          <th className="py-2 px-4 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#273548]/60 text-[#eef2f8]">
                        {presentRecords.map((r) => (
                          <tr key={r.id} className="hover:bg-[#202c3e]/40 transition-colors">
                            <td className="py-2 px-4 flex items-center gap-2.5">
                              {r.studentAvatarUrl&&<img
                                src={r.studentAvatarUrl}
                                alt={r.studentName}
                                className="w-6 h-6 rounded-full object-cover border border-[#273548]"
                              />}
                              <span className="font-semibold">{r.studentName}</span>
                            </td>
                            <td className="py-2 px-4 font-mono text-[#b5bafa]">{r.studentRollNumber}</td>
                            <td className="py-2 px-4 text-[#9aabc1]">
                              {r.verifiedAt ? new Date(r.verifiedAt).toLocaleTimeString() : 'Just now'}
                            </td>
                            <td className="py-2 px-4 text-center">
                              <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                                Present
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Section 3: Rejected Submissions (Audit log) */}
              {rejectedRecords.length > 0 && (
                <div className="space-y-3 pt-2">
                  <h3 className="text-sm font-bold text-red-300 flex items-center gap-2">
                    <XCircle size={16} />
                    <span>Rejected Submissions ({rejectedRecords.length})</span>
                  </h3>
                  <div className="rounded-xl border border-red-500/30 bg-red-950/10 divide-y divide-red-500/20 text-xs">
                    {rejectedRecords.map((r) => (
                      <div key={r.id} className="p-3 flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-[#eef2f8]">{r.studentName} ({r.studentRollNumber})</p>
                          <p className="text-[11px] text-red-300/80 mt-0.5">Reason: {r.rejectionReason || 'Photo mismatch'}</p>
                        </div>
                        <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-red-500/20 text-red-400 border border-red-500/30">
                          Rejected
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Reject Reason Confirmation Modal */}
      {rejectModalRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="bg-[#111b28] border border-[#273548] rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-red-400">
              <ShieldAlert size={22} />
              <h3 className="text-base font-bold text-[#eef2f8]">Reject Attendance Submission</h3>
            </div>

            <p className="text-xs text-[#9aabc1]">
              Rejecting attendance for <strong>{rejectModalRecord.studentName}</strong> ({rejectModalRecord.studentRollNumber}). This record will not be counted as present.
            </p>

            <div>
              <label className="block text-xs font-semibold text-[#9aabc1] uppercase tracking-wider mb-2">
                Rejection Reason
              </label>
              <select
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg bg-[#172333] border border-[#273548] text-xs text-[#eef2f8] focus:outline-none"
              >
                <option value="Visual photo mismatch with student profile">Visual photo mismatch with student profile</option>
                <option value="Student not physically present in classroom">Student not physically present in classroom</option>
                <option value="Photo blurry, dark, or obscured">Photo blurry, dark, or obscured</option>
                <option value="Proxy attempt or screen replay photo">Proxy attempt or screen replay photo</option>
              </select>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3">
              <button
                onClick={() => setRejectModalRecord(null)}
                className="px-4 py-2 rounded-lg bg-[#172333] hover:bg-[#202c3e] text-xs font-semibold text-[#9aabc1]"
              >
                Cancel
              </button>
              <button
                disabled={!!deciding}
                onClick={handleRejectStudent}
                className="px-5 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition-all shadow"
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* End Session Confirmation Modal */}
      {confirmEndModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="bg-[#111b28] border border-[#273548] rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-[#eef2f8]">End Live Attendance Session?</h3>
            <p className="text-xs text-[#9aabc1] leading-relaxed">
              This will stop the dynamic QR generator and prevent any new student submissions. 
              {pendingRecords.length > 0 && (
                <span className="block mt-2 font-semibold text-amber-300">
                  Note: There are still {pendingRecords.length} pending submissions awaiting your photo review.
                </span>
              )}
            </p>

            <div className="flex items-center justify-end gap-3 pt-3">
              <button
                onClick={() => setConfirmEndModal(false)}
                className="px-4 py-2 rounded-lg bg-[#172333] hover:bg-[#202c3e] text-xs font-semibold text-[#9aabc1]"
              >
                Continue Session
              </button>
              <button
                onClick={handleEndSession}
                className="px-5 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition-all shadow"
              >
                Yes, End Session & View Report
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
