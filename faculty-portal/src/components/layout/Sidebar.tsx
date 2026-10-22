import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  GraduationCap, 
  PlusCircle, 
  QrCode, 
  FileSpreadsheet, 
  LogOut, 
  ChevronLeft, 
  ChevronRight,
  Radio,
  BookOpen
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { attendanceDataService } from '../../services/attendanceDataService';
import { AttendanceSession } from '../../types';

interface SidebarProps {
  collapsed: boolean;
  setCollapsed: (c: boolean) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ collapsed, setCollapsed }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [activeSession, setActiveSession] = useState<AttendanceSession | null>(null);

  useEffect(() => {
    const checkActive = async () => {
      if (user) {
        const sess = await attendanceDataService.getActiveSession(user.id);
        setActiveSession(sess);
      }
    };
    checkActive();

    const unsubscribe = attendanceDataService.subscribe(() => {
      checkActive();
    });
    return () => unsubscribe();
  }, [user]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const navItems = [
    {
      label: 'Dashboard',
      path: '/',
      icon: LayoutDashboard,
      badge: null,
    },
    {
      label: 'My Classes',
      path: '/classes',
      icon: BookOpen,
      badge: null,
    },
    {
      label: 'Create Class',
      path: '/create-class',
      icon: PlusCircle,
      badge: null,
    },
    {
      label: 'Live Attendance',
      path: '/live-attendance',
      icon: QrCode,
      badge: activeSession ? 'LIVE' : null,
    },
    {
      label: 'Attendance Reports',
      path: '/reports',
      icon: FileSpreadsheet,
      badge: null,
    },
  ];

  return (
    <aside 
      className={`fixed top-0 left-0 h-screen z-40 bg-[#081B2A] border-r border-[#293D53] transition-all duration-300 flex flex-col justify-between ${
        collapsed ? 'w-20' : 'w-64'
      }`}
    >
      {/* Top Header Section */}
      <div>
        <div className="h-16 flex items-center justify-between px-4 border-b border-[#293D53]">
          {!collapsed ? (
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 rounded-lg bg-[#182D43] border border-[#293D53] flex items-center justify-center text-[#9AB9EC]">
                <GraduationCap size={20} />
              </div>
              <div>
                <h1 className="text-sm font-bold text-[#F4F5F7] tracking-tight leading-none">FACULTY PORTAL</h1>
                <p className="text-[11px] text-[#A8B9D0] font-medium mt-1">Class Attendance System</p>
              </div>
            </div>
          ) : (
            <div className="w-full flex justify-center">
              <div className="w-10 h-10 rounded-lg bg-[#182D43] border border-[#293D53] flex items-center justify-center text-[#9AB9EC]">
                <GraduationCap size={22} />
              </div>
            </div>
          )}

          <button
            onClick={() => setCollapsed(!collapsed)}
            className="hidden md:flex p-1.5 rounded-md hover:bg-[#12283D] text-[#A8B9D0] hover:text-[#F4F5F7] transition-colors"
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </button>
        </div>

        {/* Navigation links */}
        <nav className="p-3 space-y-1.5 mt-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-[#182D43] text-[#F4F5F7] shadow-sm border border-[#293D53]/60'
                      : 'text-[#A8B9D0] hover:text-[#F4F5F7] hover:bg-[#12283D]'
                  }`
                }
              >
                <Icon size={19} className="flex-shrink-0" />
                {!collapsed && (
                  <span className="flex-1 truncate">{item.label}</span>
                )}
                {!collapsed && item.badge && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 animate-pulse">
                    <Radio size={10} />
                    {item.badge}
                  </span>
                )}
              </NavLink>
            );
          })}
        </nav>
      </div>

      {/* User profile footer */}
      <div className="p-3 border-t border-[#293D53]">
        <div className={`flex items-center gap-3 p-2 rounded-lg bg-[#12283D] border border-[#293D53]/70 ${
          collapsed ? 'justify-center' : ''
        }`}>
          <img
            src={user?.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=120'}
            alt="Faculty avatar"
            className="w-9 h-9 rounded-full object-cover border border-[#293D53]"
          />
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-[#F4F5F7] truncate">{user?.name}</p>
              <p className="text-[10px] text-[#A8B9D0] truncate">{user?.department}</p>
            </div>
          )}
          {!collapsed && (
            <button
              onClick={handleLogout}
              className="p-1.5 rounded-md text-[#A8B9D0] hover:text-red-400 hover:bg-[#182D43] transition-colors"
              title="Sign Out"
            >
              <LogOut size={16} />
            </button>
          )}
        </div>
      </div>
    </aside>
  );
};
