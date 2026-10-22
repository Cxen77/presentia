import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Menu, Radio, Clock, ShieldCheck, ChevronRight } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { attendanceDataService } from '../../services/attendanceDataService';
import { AttendanceSession } from '../../types';

interface HeaderProps {
  onMenuToggle: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onMenuToggle }) => {
  const { user } = useAuth();
  const [activeSession, setActiveSession] = useState<AttendanceSession | null>(null);
  const [currentTime, setCurrentTime] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleDateString('en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const checkSession = async () => {
      if (user) {
        const sess = await attendanceDataService.getActiveSession(user.id);
        setActiveSession(sess);
      }
    };
    checkSession();

    const unsubscribe = attendanceDataService.subscribe(() => {
      checkSession();
    });
    return () => unsubscribe();
  }, [user]);

  return (
    <header className="h-16 bg-[#081B2A]/90 backdrop-blur-md border-b border-[#293D53] px-4 md:px-8 flex items-center justify-between sticky top-0 z-30">
      {/* Left side: Mobile menu toggle and institution badge */}
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuToggle}
          className="md:hidden p-2 rounded-lg bg-[#12283D] border border-[#293D53] text-[#A8B9D0] hover:text-[#F4F5F7]"
        >
          <Menu size={20} />
        </button>

        <div className="hidden sm:flex items-center gap-2 text-xs text-[#A8B9D0]">
          <span className="font-semibold text-[#F4F5F7]">University Academic Portal</span>
          <ChevronRight size={14} className="text-[#7F94B0]" />
          <span>Department of Computer Science & Engineering</span>
        </div>
      </div>

      {/* Middle/Right: Live Session Notice & Status */}
      <div className="flex items-center gap-4">
        {activeSession && (
          <Link
            to="/live-attendance"
            className="flex items-center gap-2.5 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-medium hover:bg-emerald-500/20 transition-all shadow-sm group"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <Radio size={14} className="text-emerald-400" />
            <span className="truncate max-w-[180px] sm:max-w-none">
              Live Attendance: <strong className="font-semibold text-[#F4F5F7]">{activeSession.courseCode}</strong>
            </span>
            <span className="hidden md:inline text-[11px] text-emerald-400/80 bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-500/20">
              Open Live QR
            </span>
          </Link>
        )}

        <div className="hidden lg:flex items-center gap-2 text-xs text-[#A8B9D0] bg-[#12283D] px-3 py-1.5 rounded-lg border border-[#293D53]">
          <Clock size={14} className="text-[#9AB9EC]" />
          <span>{currentTime}</span>
        </div>

        <div className="flex items-center gap-2 px-2.5 py-1 rounded-md bg-[#182D43] border border-[#293D53] text-xs">
          <ShieldCheck size={14} className="text-[#9AB9EC]" />
          <span className="text-[#F4F5F7] font-medium hidden sm:inline">Faculty Verified</span>
        </div>
      </div>
    </header>
  );
};
