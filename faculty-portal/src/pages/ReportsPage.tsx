import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { EmptyState, InlineError, PageHeading } from '../components/ui/PortalUI';
import { 
  FileSpreadsheet, 
  Download, 
  Calendar, 
  Clock, 
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  MapPin,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { attendanceDataService } from '../services/attendanceDataService';
import { downloadSessionReport } from '../services/api';
import { AttendanceSession, AttendanceRecord, ClassItem, StudentProfile } from '../types';

interface FullRosterData {
  session: AttendanceSession;
  classItem: ClassItem;
  roster: {
    serialNo: number;
    student: StudentProfile;
    status: 'PRESENT' | 'ABSENT' | 'PENDING' | 'REJECTED';
    record?: AttendanceRecord;
  }[];
  metrics: {
    totalEnrolled: number;
    present: number;
    absent: number;
    pending: number;
    rejected: number;
    attendancePercentage: number;
  };
}

export const ReportsPage: React.FC = () => {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<AttendanceSession[]>([]);
  const [expandedSessionId, setExpandedSessionId] = useState<string | null>(null);
  const [rosterData, setRosterData] = useState<FullRosterData | null>(null);
  const [loadingRoster, setLoadingRoster] = useState(false);
  const [exporting, setExporting] = useState<string | null>(null);
  const [error,setError]=useState<string|null>(null);

  const loadSessions = async () => {
    try {
    const allSessions = await attendanceDataService.getAllSessions();
    setSessions(allSessions);
    setError(null);
    }catch(error){setError(error instanceof Error?error.message:'Could not load reports.');}
  };

  useEffect(() => {
    loadSessions();
    const unsubscribe = attendanceDataService.subscribe(() => {
      loadSessions();
    });
    return () => unsubscribe();
  }, [user]);

  const handleExpandSession = async (sessionId: string) => {
    if (expandedSessionId === sessionId) {
      setExpandedSessionId(null);
      setRosterData(null);
      return;
    }

    setExpandedSessionId(sessionId);
    setLoadingRoster(true);
    try {setRosterData(await attendanceDataService.getSessionFullRoster(sessionId));}
    catch(error){setError(error instanceof Error?error.message:'Could not load roster.');}
    finally{setLoadingRoster(false);}
  };

  const handleFinalize = async (sessionId: string) => {
    if (!window.confirm('Finalize this session? Remaining PENDING submissions will be rejected as unverified. Review students first. This action cannot be undone.')) {
      return;
    }
    try {
    await attendanceDataService.finalizeSession(sessionId);
    loadSessions();
    if (expandedSessionId === sessionId) {
      const data = await attendanceDataService.getSessionFullRoster(sessionId);
      setRosterData(data);
    }
    }catch(error){setError(error instanceof Error?error.message:'Could not finalize.');}
  };

  const handleExportExcel = async (sessionId: string) => {
    setExporting(sessionId);
    try {
      await downloadSessionReport(sessionId);
    } catch (err) {
      setError(err instanceof Error?err.message:'Failed to download Excel file.');
    } finally {
      setExporting(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Active
          </span>
        );
      case 'AWAITING_VERIFICATION':
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
            Awaiting Review
          </span>
        );
      case 'CLOSED':
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-[#202c3e] text-[#9aabc1] border border-[#273548]">
            Finalized
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-[#202c3e] text-[#74869d] border border-[#273548]">
            {status}
          </span>
        );
    }
  };

  const getRecordStatusBadge = (status: string) => {
    switch (status) {
      case 'PRESENT':
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
            Present
          </span>
        );
      case 'ABSENT':
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-red-500/15 text-red-400 border border-red-500/25">
            Absent
          </span>
        );
      case 'PENDING':
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/25">
            Pending
          </span>
        );
      case 'REJECTED':
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-red-500/15 text-red-300 border border-red-500/25">
            Rejected
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="legacy-page page-stack">
      <PageHeading eyebrow="ATTENDANCE" title="Reports" description="Open a session to review its roster, then export when you’re ready." />
      <InlineError message={error}/>
      {/* Session List */}
      {sessions.length === 0 ? (
        <section className="panel"><EmptyState icon={FileSpreadsheet} title="Your reports will live here" description="After your first attendance session, open its report to review students and download an Excel sheet." action={<Link to="/live-attendance" className="p-button secondary small">Take attendance</Link>} /></section>
      ) : (
        <div className="space-y-4">
          {sessions.map((session) => {
            const isExpanded = expandedSessionId === session.id;

            return (
              <div
                key={session.id}
                className={`bg-[#172333] border rounded-2xl overflow-hidden shadow-sm transition-all ${
                  isExpanded ? 'border-[#b5bafa]/50' : 'border-[#273548]'
                }`}
              >
                {/* Session Row */}
                <div
                  className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-[#202c3e]/50 transition-colors"

                >
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded text-xs font-bold bg-[#202c3e] border border-[#273548] text-[#b5bafa]">
                        {session.courseCode}
                      </span>
                      {getStatusBadge(session.status)}
                    </div>

                    <h3 className="text-sm font-semibold text-[#eef2f8]"><button type="button" className="text-left hover:text-indigo-200" aria-expanded={isExpanded} aria-controls={`report-${session.id}`} onClick={() => handleExpandSession(session.id)}>{session.className}</button></h3>

                    <div className="flex flex-wrap items-center gap-4 text-xs text-[#9aabc1]">
                      <span className="flex items-center gap-1.5">
                        <Calendar size={13} className="text-[#b5bafa]" />
                        {session.date}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Clock size={13} className="text-[#b5bafa]" />
                        {session.startTime} - {session.endTime}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <MapPin size={13} className="text-[#b5bafa]" />
                        {session.room}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {session.status === 'AWAITING_VERIFICATION' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleFinalize(session.id);
                        }}
                        className="px-3.5 py-2 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-200 text-xs font-semibold transition-all flex items-center gap-1.5"
                      >
                        <AlertTriangle size={14} />
                        <span>Finalize</span>
                      </button>
                    )}

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleExportExcel(session.id);
                      }}
                      disabled={exporting === session.id}
                      className="px-4 py-2 rounded-lg bg-[#F3F2EF] hover:bg-white text-[#101D2C] text-xs font-bold transition-all shadow-sm flex items-center gap-2 disabled:opacity-50"
                    >
                      {exporting === session.id ? (
                        <span>Generating...</span>
                      ) : (
                        <>
                          <Download size={14} />
                          <span>Download Excel</span>
                        </>
                      )}
                    </button>

                    <button type="button" className="icon-button" aria-label={`${isExpanded ? 'Hide' : 'View'} report for ${session.className}`} aria-expanded={isExpanded} aria-controls={`report-${session.id}`} onClick={() => handleExpandSession(session.id)}>
                      {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                    </button>
                  </div>
                </div>

                {/* Expanded Full Roster Table */}
                {isExpanded && (
                  <div id={`report-${session.id}`} className="border-t border-[#273548]">
                    {loadingRoster ? (
                      <div className="p-8 text-center text-xs text-[#9aabc1]">
                        Loading session roster and verification records...
                      </div>
                    ) : rosterData ? (
                      <div className="p-5 space-y-5">
                        {/* Session Metrics Row */}
                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                          <div className="bg-[#111b28] border border-[#273548] rounded-lg p-3 text-center">
                            <p className="text-[11px] text-[#9aabc1] font-semibold uppercase">Total Enrolled</p>
                            <p className="text-lg font-bold text-[#eef2f8]">{rosterData.metrics.totalEnrolled}</p>
                          </div>
                          <div className="bg-[#111b28] border border-emerald-500/30 rounded-lg p-3 text-center">
                            <p className="text-[11px] text-emerald-300 font-semibold uppercase">Present</p>
                            <p className="text-lg font-bold text-emerald-400">{rosterData.metrics.present}</p>
                          </div>
                          <div className="bg-[#111b28] border border-red-500/30 rounded-lg p-3 text-center">
                            <p className="text-[11px] text-red-300 font-semibold uppercase">Absent</p>
                            <p className="text-lg font-bold text-red-400">{rosterData.metrics.absent}</p>
                          </div>
                          <div className="bg-[#111b28] border border-amber-500/30 rounded-lg p-3 text-center">
                            <p className="text-[11px] text-amber-300 font-semibold uppercase">Pending</p>
                            <p className="text-lg font-bold text-amber-400">{rosterData.metrics.pending}</p>
                          </div>
                          <div className="bg-[#111b28] border border-[#b5bafa]/30 rounded-lg p-3 text-center">
                            <p className="text-[11px] text-[#b5bafa] font-semibold uppercase">Attendance %</p>
                            <p className="text-lg font-bold text-[#b5bafa]">{rosterData.metrics.attendancePercentage}%</p>
                          </div>
                        </div>

                        {/* Full Roster Table */}
                        <div className="rounded-xl border border-[#273548] overflow-hidden">
                          <table className="w-full text-left text-xs">
                            <thead className="bg-[#202c3e] text-[#9aabc1] border-b border-[#273548] uppercase font-semibold text-[11px]">
                              <tr>
                                <th className="py-2.5 px-4 w-12">Sl.</th>
                                <th className="py-2.5 px-4">Student Name</th>
                                <th className="py-2.5 px-4">USN / Roll No</th>
                                <th className="py-2.5 px-4 text-center">Status</th>
                                <th className="py-2.5 px-4">Submitted At</th>
                                <th className="py-2.5 px-4">Verified By</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-[#273548]/60 text-[#eef2f8]">
                              {rosterData.roster.map((item) => (
                                <tr key={item.student.id} className="hover:bg-[#202c3e]/40 transition-colors">
                                  <td className="py-2.5 px-4 text-[#74869d] font-mono">{item.serialNo}</td>
                                  <td className="py-2.5 px-4">
                                    <div className="flex items-center gap-2.5">
                                      <img
                                        src={item.student.avatarUrl}
                                        alt={item.student.fullName}
                                        className="w-6 h-6 rounded-full object-cover border border-[#273548]"
                                      />
                                      <span className="font-semibold">{item.student.fullName}</span>
                                    </div>
                                  </td>
                                  <td className="py-2.5 px-4 font-mono text-[#b5bafa]">
                                    {item.student.rollNumber}<span className="block text-[10px] text-slate-400 mt-1">Roll {item.student.classRollNumber || '—'} · Section {item.student.section || '—'}</span>
                                  </td>
                                  <td className="py-2.5 px-4 text-center">
                                    {getRecordStatusBadge(item.status)}
                                  </td>
                                  <td className="py-2.5 px-4 text-[#9aabc1]">
                                    {item.record?.submittedAt
                                      ? new Date(item.record.submittedAt).toLocaleTimeString()
                                      : '—'}
                                  </td>
                                  <td className="py-2.5 px-4 text-[#9aabc1]">
                                    {item.record?.verifiedByName || '—'}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ) : (
                      <div className="p-6 text-center text-xs text-[#9aabc1]">
                        Could not load roster data.
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
