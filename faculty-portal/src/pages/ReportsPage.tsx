import React, { useState, useEffect } from 'react';
import { 
  FileSpreadsheet, 
  Download, 
  Calendar, 
  Clock, 
  Users, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  MapPin,
  Filter,
  Eye
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { attendanceDataService } from '../services/attendanceDataService';
import { exportSessionAttendanceToExcel } from '../services/excelExportService';
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

  const loadSessions = async () => {
    const allSessions = await attendanceDataService.getAllSessions();
    setSessions(allSessions);
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
    const data = await attendanceDataService.getSessionFullRoster(sessionId);
    setRosterData(data);
    setLoadingRoster(false);
  };

  const handleFinalize = async (sessionId: string) => {
    if (!window.confirm('Finalize this session? All remaining PENDING submissions will be marked as ABSENT. This action cannot be undone.')) {
      return;
    }
    await attendanceDataService.finalizeSession(sessionId);
    loadSessions();
    if (expandedSessionId === sessionId) {
      const data = await attendanceDataService.getSessionFullRoster(sessionId);
      setRosterData(data);
    }
  };

  const handleExportExcel = async (sessionId: string) => {
    setExporting(sessionId);
    try {
      const data = await attendanceDataService.getSessionFullRoster(sessionId);
      if (!data) {
        alert('Could not load session data for export.');
        return;
      }
      await exportSessionAttendanceToExcel({
        session: data.session,
        classItem: data.classItem,
        roster: data.roster,
      });
    } catch (err) {
      console.error('Export error:', err);
      alert('Failed to generate Excel file.');
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
          <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-[#182D43] text-[#A8B9D0] border border-[#293D53]">
            Finalized
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-[#182D43] text-[#7F94B0] border border-[#293D53]">
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
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#293D53]/60">
        <div>
          <h1 className="text-2xl font-bold text-[#F4F5F7] tracking-tight">Attendance Reports</h1>
          <p className="text-sm text-[#A8B9D0] mt-1">
            Review past attendance sessions, verify remaining submissions, and export official .xlsx attendance sheets.
          </p>
        </div>
      </div>

      {/* Session List */}
      {sessions.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-[#081B2A] border border-dashed border-[#293D53]">
          <FileSpreadsheet size={36} className="mx-auto text-[#7F94B0] mb-3" />
          <h3 className="text-base font-semibold text-[#F4F5F7]">No Attendance Sessions Recorded</h3>
          <p className="text-xs text-[#A8B9D0] mt-1 max-w-sm mx-auto">
            Start a live QR attendance session from the Dashboard or Live Attendance page to see records here.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {sessions.map((session) => {
            const isExpanded = expandedSessionId === session.id;

            return (
              <div
                key={session.id}
                className={`bg-[#12283D] border rounded-2xl overflow-hidden shadow-sm transition-all ${
                  isExpanded ? 'border-[#9AB9EC]/50' : 'border-[#293D53]'
                }`}
              >
                {/* Session Row */}
                <div
                  className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer hover:bg-[#182D43]/50 transition-colors"
                  onClick={() => handleExpandSession(session.id)}
                >
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded text-xs font-bold bg-[#182D43] border border-[#293D53] text-[#9AB9EC]">
                        {session.courseCode}
                      </span>
                      {getStatusBadge(session.status)}
                    </div>

                    <h3 className="text-base font-bold text-[#F4F5F7]">{session.className}</h3>

                    <div className="flex flex-wrap items-center gap-4 text-xs text-[#A8B9D0]">
                      <span className="flex items-center gap-1.5">
                        <Calendar size={13} className="text-[#9AB9EC]" />
                        {session.date}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Clock size={13} className="text-[#9AB9EC]" />
                        {session.startTime} - {session.endTime}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <MapPin size={13} className="text-[#9AB9EC]" />
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

                    <div className="p-1.5 text-[#7F94B0]">
                      {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                    </div>
                  </div>
                </div>

                {/* Expanded Full Roster Table */}
                {isExpanded && (
                  <div className="border-t border-[#293D53]">
                    {loadingRoster ? (
                      <div className="p-8 text-center text-xs text-[#A8B9D0]">
                        Loading session roster and verification records...
                      </div>
                    ) : rosterData ? (
                      <div className="p-5 space-y-5">
                        {/* Session Metrics Row */}
                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                          <div className="bg-[#081B2A] border border-[#293D53] rounded-lg p-3 text-center">
                            <p className="text-[11px] text-[#A8B9D0] font-semibold uppercase">Total Enrolled</p>
                            <p className="text-lg font-bold text-[#F4F5F7]">{rosterData.metrics.totalEnrolled}</p>
                          </div>
                          <div className="bg-[#081B2A] border border-emerald-500/30 rounded-lg p-3 text-center">
                            <p className="text-[11px] text-emerald-300 font-semibold uppercase">Present</p>
                            <p className="text-lg font-bold text-emerald-400">{rosterData.metrics.present}</p>
                          </div>
                          <div className="bg-[#081B2A] border border-red-500/30 rounded-lg p-3 text-center">
                            <p className="text-[11px] text-red-300 font-semibold uppercase">Absent</p>
                            <p className="text-lg font-bold text-red-400">{rosterData.metrics.absent}</p>
                          </div>
                          <div className="bg-[#081B2A] border border-amber-500/30 rounded-lg p-3 text-center">
                            <p className="text-[11px] text-amber-300 font-semibold uppercase">Pending</p>
                            <p className="text-lg font-bold text-amber-400">{rosterData.metrics.pending}</p>
                          </div>
                          <div className="bg-[#081B2A] border border-[#9AB9EC]/30 rounded-lg p-3 text-center">
                            <p className="text-[11px] text-[#9AB9EC] font-semibold uppercase">Attendance %</p>
                            <p className="text-lg font-bold text-[#9AB9EC]">{rosterData.metrics.attendancePercentage}%</p>
                          </div>
                        </div>

                        {/* Full Roster Table */}
                        <div className="rounded-xl border border-[#293D53] overflow-hidden">
                          <table className="w-full text-left text-xs">
                            <thead className="bg-[#182D43] text-[#A8B9D0] border-b border-[#293D53] uppercase font-semibold text-[11px]">
                              <tr>
                                <th className="py-2.5 px-4 w-12">Sl.</th>
                                <th className="py-2.5 px-4">Student Name</th>
                                <th className="py-2.5 px-4">USN / Roll No</th>
                                <th className="py-2.5 px-4 text-center">Status</th>
                                <th className="py-2.5 px-4">Submitted At</th>
                                <th className="py-2.5 px-4">Verified By</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-[#293D53]/60 text-[#F4F5F7]">
                              {rosterData.roster.map((item) => (
                                <tr key={item.student.id} className="hover:bg-[#182D43]/40 transition-colors">
                                  <td className="py-2.5 px-4 text-[#7F94B0] font-mono">{item.serialNo}</td>
                                  <td className="py-2.5 px-4">
                                    <div className="flex items-center gap-2.5">
                                      <img
                                        src={item.student.avatarUrl}
                                        alt={item.student.fullName}
                                        className="w-6 h-6 rounded-full object-cover border border-[#293D53]"
                                      />
                                      <span className="font-semibold">{item.student.fullName}</span>
                                    </div>
                                  </td>
                                  <td className="py-2.5 px-4 font-mono text-[#9AB9EC]">
                                    {item.student.rollNumber}
                                  </td>
                                  <td className="py-2.5 px-4 text-center">
                                    {getRecordStatusBadge(item.status)}
                                  </td>
                                  <td className="py-2.5 px-4 text-[#A8B9D0]">
                                    {item.record?.submittedAt
                                      ? new Date(item.record.submittedAt).toLocaleTimeString()
                                      : '—'}
                                  </td>
                                  <td className="py-2.5 px-4 text-[#A8B9D0]">
                                    {item.record?.verifiedByName || '—'}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ) : (
                      <div className="p-6 text-center text-xs text-[#A8B9D0]">
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
