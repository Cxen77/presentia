import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { 
  QrCode, 
  Clock, 
  Users, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  RefreshCw, 
  Radio, 
  Sparkles, 
  StopCircle, 
  ArrowRight,
  ShieldAlert,
  FileSpreadsheet,
  Camera,
  Play
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { attendanceDataService } from '../services/attendanceDataService';
import { supabase, isSupabaseConfigured } from '../services/supabase';
import { AttendanceSession, ClassItem, AttendanceRecord } from '../types';

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
  const [simulating, setSimulating] = useState(false);

  // Load classes and active session
  const refreshData = async () => {
    if (!user) return;
    const classList = await attendanceDataService.getClasses(user.id);
    setClasses(classList);
    if (classList.length > 0 && !selectedClassId) {
      setSelectedClassId(classList[0].id);
    }

    const session = await attendanceDataService.getActiveSession(user.id);
    setActiveSession(session);

    if (session) {
      const sessionRecs = await attendanceDataService.getSessionRecords(session.id);
      setRecords(sessionRecs);
    }
  };

  useEffect(() => {
    refreshData();
    const unsubscribe = attendanceDataService.subscribe(() => {
      refreshData();
    });
    return () => unsubscribe();
  }, [user]);

  // Real-time Supabase attendance_records live updates
  useEffect(() => {
    if (!activeSession || !isSupabaseConfigured()) return;

    const channel = supabase
      .channel(`live_attendance_${activeSession.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'attendance_records',
          filter: `session_id=eq.${activeSession.id}`,
        },
        async () => {
          const sessionRecs = await attendanceDataService.getSessionRecords(activeSession.id);
          setRecords(sessionRecs);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeSession?.id]);

  // Periodic QR Code Rotation & Countdown Timer (every 25 seconds)
  useEffect(() => {
    if (!activeSession || activeSession.status === 'CLOSED') return;

    const timer = setInterval(async () => {
      const now = Date.now();
      const diff = Math.max(0, Math.ceil((activeSession.tokenExpiresAt - now) / 1000));

      if (diff <= 0) {
        // Rotate token!
        const updated = await attendanceDataService.rotateQRToken(activeSession.id);
        if (updated) {
          setActiveSession(updated);
          setSecondsRemaining(25);
        }
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

    const session = await attendanceDataService.startSession(targetId, user.id, user.name);
    setActiveSession(session);
    setSecondsRemaining(25);
  };

  const handleConfirmStudent = async (recordId: string) => {
    if (!user) return;
    await attendanceDataService.verifySubmission(recordId, 'PRESENT', user.id, user.name);
  };

  const handleRejectStudent = async () => {
    if (!user || !rejectModalRecord) return;
    await attendanceDataService.verifySubmission(
      rejectModalRecord.id,
      'REJECTED',
      user.id,
      user.name,
      rejectReason
    );
    setRejectModalRecord(null);
  };

  const handleEndSession = async () => {
    if (!activeSession) return;
    await attendanceDataService.endSession(activeSession.id);
    setConfirmEndModal(false);
    navigate('/reports');
  };

  const handleSimulateScan = async () => {
    if (!activeSession) return;
    setSimulating(true);
    await attendanceDataService.triggerSimulatedStudentScan(activeSession.id);
    setSimulating(false);
  };

  // Metrics
  const pendingRecords = records.filter(r => r.status === 'PENDING');
  const presentRecords = records.filter(r => r.status === 'PRESENT');
  const rejectedRecords = records.filter(r => r.status === 'REJECTED');
  const totalEnrolled = 8; // Department standard cohort size

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
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-[#293D53]/60">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#9AB9EC] mb-1">
            <span>Live Session Controller</span>
            <span>•</span>
            <span>Real-Time Biometric Photo Review</span>
          </div>
          <h1 className="text-2xl font-bold text-[#F4F5F7] tracking-tight">
            {activeSession ? `Live Attendance: ${activeSession.className}` : 'Conduct Live Attendance'}
          </h1>
          <p className="text-sm text-[#A8B9D0] mt-1">
            {activeSession
              ? `Displaying dynamic rotating QR for ${activeSession.courseCode} in ${activeSession.room}. Submissions update in real-time.`
              : 'Select a course to initialize a secured, dynamic QR attendance session with side-by-side verification.'}
          </p>
        </div>

        {activeSession && (
          <div className="flex items-center gap-3">
            <button
              onClick={handleSimulateScan}
              disabled={simulating}
              className="px-3.5 py-2 rounded-lg bg-[#182D43] hover:bg-[#202D39] border border-[#293D53] text-xs font-semibold text-[#9AB9EC] transition-all flex items-center gap-2 shadow-sm"
              title="Simulates a student scanning the QR code with their mobile camera"
            >
              <Camera size={15} />
              <span>{simulating ? 'Transmitting Scan...' : 'Simulate Student Scan'}</span>
            </button>

            <button
              onClick={() => setConfirmEndModal(true)}
              className="px-4 py-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 text-red-200 text-xs font-semibold transition-all flex items-center gap-2 shadow-sm"
            >
              <StopCircle size={16} />
              <span>End Attendance Session</span>
            </button>
          </div>
        )}
      </div>

      {/* No Active Session State: Class Selector */}
      {!activeSession ? (
        <div className="bg-[#12283D] border border-[#293D53] rounded-2xl p-8 max-w-2xl mx-auto text-center space-y-6 shadow-xl">
          <div className="w-16 h-16 rounded-2xl bg-[#182D43] border border-[#293D53] text-[#9AB9EC] flex items-center justify-center mx-auto shadow-md">
            <QrCode size={32} />
          </div>

          <div>
            <h2 className="text-xl font-bold text-[#F4F5F7]">Select Course to Launch Live Attendance</h2>
            <p className="text-xs text-[#A8B9D0] mt-1.5 max-w-md mx-auto">
              Dynamic QR codes prevent proxy attendance by automatically rotating every 25 seconds with single-use cryptographic tokens.
            </p>
          </div>

          <div className="space-y-3 text-left">
            <label className="block text-xs font-semibold text-[#A8B9D0] uppercase tracking-wider">
              Select Class Cohort
            </label>
            <select
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-[#081B2A] border border-[#293D53] text-sm text-[#F4F5F7] focus:outline-none focus:border-[#9AB9EC]"
            >
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.courseCode} — {c.className} ({c.room})
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={() => handleStartSession()}
            className="w-full py-3.5 px-6 rounded-xl bg-[#F3F2EF] hover:bg-white text-[#101D2C] font-bold text-sm transition-all shadow-lg flex items-center justify-center gap-2"
          >
            <Play size={17} />
            <span>Start Live Session & Display QR</span>
          </button>
        </div>
      ) : (
        /* Active Live Attendance View */
        <div className="space-y-6">
          {/* Top Session Stats Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="bg-[#12283D] border border-[#293D53] rounded-xl p-4 text-center">
              <span className="text-[11px] text-[#A8B9D0] font-semibold uppercase">Enrolled</span>
              <p className="text-xl font-bold text-[#F4F5F7] mt-0.5">{totalEnrolled}</p>
            </div>

            <div className="bg-[#12283D] border border-[#293D53] rounded-xl p-4 text-center">
              <span className="text-[11px] text-[#A8B9D0] font-semibold uppercase">Submissions</span>
              <p className="text-xl font-bold text-[#9AB9EC] mt-0.5">{records.length}</p>
            </div>

            <div className="bg-[#12283D] border border-amber-500/40 rounded-xl p-4 text-center bg-amber-950/10">
              <span className="text-[11px] text-amber-300 font-semibold uppercase">Pending Review</span>
              <p className="text-xl font-bold text-amber-400 mt-0.5">{pendingRecords.length}</p>
            </div>

            <div className="bg-[#12283D] border border-emerald-500/40 rounded-xl p-4 text-center bg-emerald-950/10">
              <span className="text-[11px] text-emerald-300 font-semibold uppercase">Confirmed</span>
              <p className="text-xl font-bold text-emerald-400 mt-0.5">{presentRecords.length}</p>
            </div>

            <div className="bg-[#12283D] border border-red-500/40 rounded-xl p-4 text-center bg-red-950/10">
              <span className="text-[11px] text-red-300 font-semibold uppercase">Rejected</span>
              <p className="text-xl font-bold text-red-400 mt-0.5">{rejectedRecords.length}</p>
            </div>
          </div>

          {/* Main Attendance Split Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Left Column (5 Cols): Dynamic QR Code Projector */}
            <div className="lg:col-span-5 space-y-4">
              <div className="bg-[#081B2A] border-2 border-[#293D53] rounded-2xl p-6 text-center space-y-4 shadow-xl sticky top-24">
                {/* Header status */}
                <div className="flex items-center justify-between text-xs border-b border-[#293D53]/70 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="font-bold text-emerald-400">ACTIVE SESSION</span>
                  </div>
                  <span className="text-[11px] text-[#A8B9D0] font-mono">
                    Token #{activeSession.tokenRotationCount}
                  </span>
                </div>

                {/* Course Metadata */}
                <div>
                  <h3 className="text-lg font-bold text-[#F4F5F7]">{activeSession.className}</h3>
                  <p className="text-xs text-[#9AB9EC] font-semibold mt-0.5">
                    {activeSession.courseCode} • {activeSession.room}
                  </p>
                </div>

                {/* QR Display Card */}
                <div className="bg-white p-5 rounded-2xl inline-block shadow-2xl mx-auto border-4 border-[#182D43]">
                  <QRCodeSVG
                    value={qrPayload}
                    size={240}
                    level="H"
                    includeMargin={false}
                  />
                </div>

                {/* Countdown and Progress */}
                <div className="space-y-2 pt-2">
                  <div className="flex items-center justify-between text-xs text-[#A8B9D0]">
                    <span className="flex items-center gap-1.5 font-medium">
                      <Clock size={13} className="text-[#9AB9EC]" />
                      QR Code Validity:
                    </span>
                    <span className="font-mono font-bold text-emerald-400 text-sm">
                      {secondsRemaining}s remaining
                    </span>
                  </div>

                  {/* Countdown Progress Bar */}
                  <div className="w-full h-2 rounded-full bg-[#12283D] overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-emerald-500 to-[#9AB9EC] transition-all duration-1000 ease-linear"
                      style={{ width: `${(secondsRemaining / 25) * 100}%` }}
                    />
                  </div>

                  <p className="text-[11px] text-[#7F94B0] pt-1">
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
                    <h2 className="text-base font-bold text-[#F4F5F7] flex items-center gap-2">
                      <span>Pending Identity Verification</span>
                      <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                        {pendingRecords.length} Awaiting
                      </span>
                    </h2>
                    <p className="text-xs text-[#A8B9D0] mt-0.5">
                      Visually inspect the student's registered university photo side-by-side with their live camera verification photo.
                    </p>
                  </div>
                </div>

                {pendingRecords.length === 0 ? (
                  <div className="p-8 text-center rounded-2xl bg-[#12283D] border border-dashed border-[#293D53]">
                    <CheckCircle2 size={32} className="mx-auto text-emerald-400 mb-2" />
                    <p className="text-sm font-semibold text-[#F4F5F7]">All Submissions Reviewed</p>
                    <p className="text-xs text-[#A8B9D0] mt-1">
                      No incoming student scans are currently awaiting photo verification.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {pendingRecords.map((record) => (
                      <div
                        key={record.id}
                        className="bg-[#12283D] border-2 border-amber-500/50 rounded-2xl p-5 shadow-lg space-y-4"
                      >
                        {/* Student Name Header */}
                        <div className="flex items-center justify-between pb-3 border-b border-[#293D53]/60">
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="text-base font-bold text-[#F4F5F7]">{record.studentName}</h3>
                              <span className="font-mono text-xs text-[#9AB9EC] bg-[#182D43] px-2 py-0.5 rounded border border-[#293D53]">
                                {record.studentRollNumber}
                              </span>
                            </div>
                            <p className="text-[11px] text-[#A8B9D0] mt-0.5">
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
                            <span className="text-[11px] font-semibold text-[#A8B9D0] uppercase tracking-wider block">
                              1. Registered Profile
                            </span>
                            <div className="relative aspect-square rounded-xl overflow-hidden border-2 border-[#293D53] bg-[#081B2A]">
                              <img
                                src={record.studentAvatarUrl}
                                alt="Registered university profile"
                                className="w-full h-full object-cover"
                              />
                              <div className="absolute bottom-1 left-1 right-1 bg-[#061522]/80 backdrop-blur-sm py-0.5 text-[10px] text-[#A8B9D0] rounded">
                                Database Record
                              </div>
                            </div>
                          </div>

                          {/* Right: Live Current Attendance Verification Photo */}
                          <div className="space-y-1.5 text-center">
                            <span className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider block">
                              2. Live Camera Snapshot
                            </span>
                            <div className="relative aspect-square rounded-xl overflow-hidden border-2 border-emerald-500/60 bg-[#081B2A]">
                              <img
                                src={record.verificationPhotoUrl}
                                alt="Live attendance verification snapshot"
                                className="w-full h-full object-cover"
                              />
                              <div className="absolute bottom-1 left-1 right-1 bg-emerald-950/80 backdrop-blur-sm py-0.5 text-[10px] text-emerald-300 rounded font-medium">
                                Captured in Classroom
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Decision Buttons */}
                        <div className="grid grid-cols-2 gap-3 pt-2">
                          <button
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
                            onClick={() => handleConfirmStudent(record.id)}
                            className="py-2.5 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-[#061522] text-xs font-bold transition-all shadow-md flex items-center justify-center gap-2"
                          >
                            <CheckCircle2 size={16} />
                            <span>Confirm Present</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Section 2: Confirmed Present Roster */}
              <div className="space-y-3 pt-4 border-t border-[#293D53]/60">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-[#F4F5F7] flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-emerald-400" />
                    <span>Confirmed Present ({presentRecords.length})</span>
                  </h3>
                  <span className="text-xs text-[#7F94B0]">Verified & Authoritative</span>
                </div>

                {presentRecords.length === 0 ? (
                  <div className="p-4 rounded-xl bg-[#12283D] border border-[#293D53] text-center text-xs text-[#A8B9D0]">
                    No students have been confirmed present yet.
                  </div>
                ) : (
                  <div className="rounded-xl border border-[#293D53] overflow-hidden bg-[#12283D]">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-[#182D43] text-[#A8B9D0] border-b border-[#293D53] uppercase font-semibold text-[11px]">
                        <tr>
                          <th className="py-2 px-4">Student</th>
                          <th className="py-2 px-4">USN / Roll No</th>
                          <th className="py-2 px-4">Verified Time</th>
                          <th className="py-2 px-4 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#293D53]/60 text-[#F4F5F7]">
                        {presentRecords.map((r) => (
                          <tr key={r.id} className="hover:bg-[#182D43]/40 transition-colors">
                            <td className="py-2 px-4 flex items-center gap-2.5">
                              <img
                                src={r.studentAvatarUrl}
                                alt={r.studentName}
                                className="w-6 h-6 rounded-full object-cover border border-[#293D53]"
                              />
                              <span className="font-semibold">{r.studentName}</span>
                            </td>
                            <td className="py-2 px-4 font-mono text-[#9AB9EC]">{r.studentRollNumber}</td>
                            <td className="py-2 px-4 text-[#A8B9D0]">
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
                          <p className="font-semibold text-[#F4F5F7]">{r.studentName} ({r.studentRollNumber})</p>
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
          <div className="bg-[#081B2A] border border-[#293D53] rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-red-400">
              <ShieldAlert size={22} />
              <h3 className="text-base font-bold text-[#F4F5F7]">Reject Attendance Submission</h3>
            </div>

            <p className="text-xs text-[#A8B9D0]">
              Rejecting attendance for <strong>{rejectModalRecord.studentName}</strong> ({rejectModalRecord.studentRollNumber}). This record will not be counted as present.
            </p>

            <div>
              <label className="block text-xs font-semibold text-[#A8B9D0] uppercase tracking-wider mb-2">
                Rejection Reason
              </label>
              <select
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg bg-[#12283D] border border-[#293D53] text-xs text-[#F4F5F7] focus:outline-none"
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
                className="px-4 py-2 rounded-lg bg-[#12283D] hover:bg-[#182D43] text-xs font-semibold text-[#A8B9D0]"
              >
                Cancel
              </button>
              <button
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
          <div className="bg-[#081B2A] border border-[#293D53] rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-[#F4F5F7]">End Live Attendance Session?</h3>
            <p className="text-xs text-[#A8B9D0] leading-relaxed">
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
                className="px-4 py-2 rounded-lg bg-[#12283D] hover:bg-[#182D43] text-xs font-semibold text-[#A8B9D0]"
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
