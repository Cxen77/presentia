import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  BookOpen, 
  Users, 
  QrCode, 
  PlusCircle, 
  Radio, 
  Calendar, 
  Clock, 
  ArrowRight, 
  CheckCircle2, 
  MapPin, 
  BarChart3,
  Sparkles,
  FileSpreadsheet
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { attendanceDataService } from '../services/attendanceDataService';
import { ClassItem, AttendanceSession, AttendanceRecord } from '../types';

export const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [activeSession, setActiveSession] = useState<AttendanceSession | null>(null);
  const [sessionRecords, setSessionRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    if (!user) return;
    const classList = await attendanceDataService.getClasses(user.id);
    const session = await attendanceDataService.getActiveSession(user.id);
    setClasses(classList);
    setActiveSession(session);

    if (session) {
      const records = await attendanceDataService.getSessionRecords(session.id);
      setSessionRecords(records);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
    const unsubscribe = attendanceDataService.subscribe(() => {
      loadData();
    });
    return () => unsubscribe();
  }, [user]);

  const handleStartSession = async (classId: string) => {
    if (!user) return;
    const session = await attendanceDataService.startSession(classId, user.id, user.name);
    navigate('/live-attendance');
  };

  const totalEnrolled = classes.reduce((sum, c) => sum + (c.enrolledStudentsCount || 0), 0);
  const pendingCount = sessionRecords.filter(r => r.status === 'PENDING').length;
  const verifiedCount = sessionRecords.filter(r => r.status === 'PRESENT').length;

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Welcome Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-[#293D53]/60">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#9AB9EC] mb-1">
            <span>Faculty Management Workspace</span>
            <span>•</span>
            <span>{user?.department}</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-[#F4F5F7] tracking-tight">
            Welcome back, {user?.name}
          </h1>
          <p className="text-sm text-[#A8B9D0] mt-1">
            Manage your departmental course cohorts, launch live QR attendance, and review verification photos.
          </p>
        </div>

        {/* Quick action buttons */}
        <div className="flex flex-wrap items-center gap-3">
          <Link
            to="/create-class"
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#182D43] hover:bg-[#202D39] border border-[#293D53] text-sm font-semibold text-[#F4F5F7] transition-colors shadow-sm"
          >
            <PlusCircle size={17} className="text-[#9AB9EC]" />
            <span>Create Class</span>
          </Link>
          <Link
            to="/live-attendance"
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#F3F2EF] hover:bg-white text-sm font-semibold text-[#101D2C] transition-all shadow-md"
          >
            <QrCode size={17} />
            <span>Start Attendance</span>
          </Link>
        </div>
      </div>

      {/* Active Session Callout Banner */}
      {activeSession && (
        <div className="bg-gradient-to-r from-[#081B2A] to-[#12283D] border-2 border-emerald-500/40 rounded-2xl p-6 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 transform translate-x-8 -translate-y-8 w-48 h-48 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none" />
          
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-bold border border-emerald-500/30">
                <Radio size={14} className="animate-pulse" />
                <span>ATTENDANCE SESSION IN PROGRESS</span>
              </div>
              <div>
                <h2 className="text-xl font-bold text-[#F4F5F7]">
                  {activeSession.className} ({activeSession.courseCode})
                </h2>
                <div className="flex flex-wrap items-center gap-4 text-xs text-[#A8B9D0] mt-1.5">
                  <span className="flex items-center gap-1.5">
                    <MapPin size={14} className="text-[#9AB9EC]" />
                    {activeSession.room}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Clock size={14} className="text-[#9AB9EC]" />
                    {activeSession.startTime} - {activeSession.endTime}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Sparkles size={14} className="text-emerald-400" />
                    Dynamic QR Auto-Rotating
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-6 px-4 py-2.5 rounded-xl bg-[#081B2A]/80 border border-[#293D53]">
                <div className="text-center">
                  <p className="text-xs text-[#A8B9D0]">Awaiting Review</p>
                  <p className="text-lg font-bold text-amber-400">{pendingCount}</p>
                </div>
                <div className="w-[1px] h-8 bg-[#293D53]" />
                <div className="text-center">
                  <p className="text-xs text-[#A8B9D0]">Verified Present</p>
                  <p className="text-lg font-bold text-emerald-400">{verifiedCount}</p>
                </div>
              </div>

              <Link
                to="/live-attendance"
                className="px-5 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-[#061522] font-bold text-sm transition-all shadow-lg flex items-center gap-2"
              >
                <span>Open Live Verification</span>
                <ArrowRight size={16} />
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#12283D] border border-[#293D53] rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#A8B9D0] uppercase tracking-wider">Assigned Classes</span>
            <div className="p-2 rounded-lg bg-[#182D43] text-[#9AB9EC]">
              <BookOpen size={18} />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-bold text-[#F4F5F7]">{classes.length}</p>
            <p className="text-xs text-[#7F94B0] mt-1">Active courses this semester</p>
          </div>
        </div>

        <div className="bg-[#12283D] border border-[#293D53] rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#A8B9D0] uppercase tracking-wider">Enrolled Students</span>
            <div className="p-2 rounded-lg bg-[#182D43] text-[#9AB9EC]">
              <Users size={18} />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-bold text-[#F4F5F7]">{totalEnrolled}</p>
            <p className="text-xs text-[#7F94B0] mt-1">Across all registered cohorts</p>
          </div>
        </div>

        <div className="bg-[#12283D] border border-[#293D53] rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#A8B9D0] uppercase tracking-wider">Active QR Sessions</span>
            <div className="p-2 rounded-lg bg-[#182D43] text-emerald-400">
              <Radio size={18} />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-bold text-[#F4F5F7]">{activeSession ? '1 Live' : '0 Idle'}</p>
            <p className="text-xs text-[#7F94B0] mt-1">
              {activeSession ? 'Accepting student scans' : 'Ready to start'}
            </p>
          </div>
        </div>

        <div className="bg-[#12283D] border border-[#293D53] rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#A8B9D0] uppercase tracking-wider">Average Attendance</span>
            <div className="p-2 rounded-lg bg-[#182D43] text-[#9AB9EC]">
              <BarChart3 size={18} />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-bold text-[#F4F5F7]">88.5%</p>
            <p className="text-xs text-[#7F94B0] mt-1">Consistent departmental benchmark</p>
          </div>
        </div>
      </div>

      {/* Main Grid: Today's Scheduled Classes & Quick Class Management */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column (2 Cols): Today's Classes */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-[#F4F5F7]">Today's Scheduled Classes</h2>
              <p className="text-xs text-[#A8B9D0]">Scheduled course lectures and practical sessions for today</p>
            </div>
            <Link
              to="/classes"
              className="text-xs font-semibold text-[#9AB9EC] hover:text-[#B4CBF5] flex items-center gap-1"
            >
              <span>View All Classes</span>
              <ArrowRight size={14} />
            </Link>
          </div>

          <div className="space-y-3">
            {classes.map((cls, idx) => {
              const isCurrentSessionActive = activeSession?.classId === cls.id;
              return (
                <div
                  key={cls.id}
                  className={`p-5 rounded-xl border transition-all ${
                    isCurrentSessionActive
                      ? 'bg-[#182D43] border-emerald-500/50 shadow-md'
                      : 'bg-[#12283D] border-[#293D53] hover:border-[#293D53]/80'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-[#182D43] border border-[#293D53] text-[#9AB9EC]">
                          {cls.courseCode}
                        </span>
                        <span className="text-xs font-medium text-[#7F94B0]">
                          {cls.classType} • {cls.credits} Credits
                        </span>
                        {isCurrentSessionActive && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                            <Radio size={10} className="animate-pulse" />
                            Live Now
                          </span>
                        )}
                      </div>

                      <h3 className="text-base font-semibold text-[#F4F5F7]">{cls.className}</h3>

                      <div className="flex flex-wrap items-center gap-4 text-xs text-[#A8B9D0]">
                        <span className="flex items-center gap-1.5">
                          <Clock size={13} className="text-[#9AB9EC]" />
                          {cls.scheduleInfo}
                        </span>
                        <span className="flex items-center gap-1.5">
                          <MapPin size={13} className="text-[#9AB9EC]" />
                          {cls.room}
                        </span>
                        <span className="flex items-center gap-1.5">
                          <Users size={13} className="text-[#9AB9EC]" />
                          {cls.enrolledStudentsCount} Enrolled
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {isCurrentSessionActive ? (
                        <Link
                          to="/live-attendance"
                          className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-[#061522] font-semibold text-xs transition-colors shadow flex items-center gap-1.5"
                        >
                          <QrCode size={14} />
                          <span>View Live QR</span>
                        </Link>
                      ) : (
                        <button
                          onClick={() => handleStartSession(cls.id)}
                          className="px-4 py-2 rounded-lg bg-[#F3F2EF] hover:bg-white text-[#101D2C] font-semibold text-xs transition-all shadow-sm flex items-center gap-1.5"
                        >
                          <QrCode size={14} />
                          <span>Start Attendance</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column (1 Col): Quick Links & Recent Attendance Actions */}
        <div className="space-y-6">
          {/* Quick Actions Panel */}
          <div className="bg-[#12283D] border border-[#293D53] rounded-xl p-5 space-y-4">
            <h3 className="text-sm font-bold text-[#F4F5F7] tracking-tight">Faculty Quick Actions</h3>
            <div className="space-y-2">
              <Link
                to="/create-class"
                className="w-full p-3 rounded-lg bg-[#182D43] hover:bg-[#202D39] border border-[#293D53]/70 text-left transition-colors flex items-center justify-between group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[#12283D] flex items-center justify-center text-[#9AB9EC]">
                    <PlusCircle size={18} />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-[#F4F5F7]">Create New Class</p>
                    <p className="text-[11px] text-[#A8B9D0]">Setup schedule and course code</p>
                  </div>
                </div>
                <ArrowRight size={15} className="text-[#7F94B0] group-hover:text-[#F4F5F7] group-hover:translate-x-0.5 transition-all" />
              </Link>

              <Link
                to="/classes"
                className="w-full p-3 rounded-lg bg-[#182D43] hover:bg-[#202D39] border border-[#293D53]/70 text-left transition-colors flex items-center justify-between group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[#12283D] flex items-center justify-center text-[#9AB9EC]">
                    <Users size={18} />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-[#F4F5F7]">Class Enrollment Codes</p>
                    <p className="text-[11px] text-[#A8B9D0]">Share student join codes</p>
                  </div>
                </div>
                <ArrowRight size={15} className="text-[#7F94B0] group-hover:text-[#F4F5F7] group-hover:translate-x-0.5 transition-all" />
              </Link>

              <Link
                to="/reports"
                className="w-full p-3 rounded-lg bg-[#182D43] hover:bg-[#202D39] border border-[#293D53]/70 text-left transition-colors flex items-center justify-between group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[#12283D] flex items-center justify-center text-emerald-400">
                    <FileSpreadsheet size={18} />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-[#F4F5F7]">Export Attendance Excel</p>
                    <p className="text-[11px] text-[#A8B9D0]">Download finalized .xlsx records</p>
                  </div>
                </div>
                <ArrowRight size={15} className="text-[#7F94B0] group-hover:text-[#F4F5F7] group-hover:translate-x-0.5 transition-all" />
              </Link>
            </div>
          </div>

          {/* Verification Protocol Card */}
          <div className="bg-[#081B2A] border border-[#293D53] rounded-xl p-5 space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-[#9AB9EC]">
              <CheckCircle2 size={16} />
              <span>Two-Factor Photo Verification Protocol</span>
            </div>
            <p className="text-xs text-[#A8B9D0] leading-relaxed">
              When students scan the dynamically rotating QR in class, their live snapshot is transmitted for faculty side-by-side inspection against their registered university identity.
            </p>
            <div className="pt-2 border-t border-[#293D53]/60 flex items-center justify-between text-[11px] text-[#7F94B0]">
              <span>QR Rotation Interval: <strong>25 seconds</strong></span>
              <span className="text-emerald-400 font-medium">Replay Protected</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
