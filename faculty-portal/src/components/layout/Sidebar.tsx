import { useEffect, useRef } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, GraduationCap, QrCode, FileSpreadsheet, LogOut, PanelLeftClose, PanelLeftOpen, BookOpen, X,Users,UserRound,ShieldCheck } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
interface SidebarProps { collapsed: boolean; setCollapsed: (value: boolean) => void; mobileOpen: boolean; onClose: () => void }
export function Sidebar({ collapsed, setCollapsed, mobileOpen, onClose }: SidebarProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const sidebarRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!mobileOpen) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    sidebarRef.current?.querySelector<HTMLButtonElement>('.mobile-close')?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'Tab') {
        const targets = Array.from(sidebarRef.current?.querySelectorAll<HTMLElement>('a, button') || []).filter(element => element.getClientRects().length > 0);
        const first = targets[0], last = targets[targets.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = oldOverflow; previousFocus?.focus(); };
  }, [mobileOpen, onClose]);
  const links = [
    ...(user?.role==='admin'?[{path:'/admin',label:'Admin console',icon:ShieldCheck}]:[{ path: '/', label: 'Overview', icon: LayoutDashboard }]),
    { path: '/classes', label: user?.role==='admin'?'All classes':'My classes', icon: BookOpen },
    ...(user?.role==='admin'?[]:[{ path: '/live-attendance', label: 'Live attendance', icon: QrCode },{path:'/students',label:'Students',icon:Users}]),
    { path: '/reports', label: 'Reports', icon: FileSpreadsheet },
    {path:'/profile',label:'My profile',icon:UserRound},
  ];
  return <>
    {mobileOpen && <button className="sidebar-overlay" aria-label="Close navigation" onClick={onClose} tabIndex={-1} />}
    <aside ref={sidebarRef} id="portal-navigation" className={`portal-sidebar ${collapsed ? 'is-collapsed' : ''} ${mobileOpen ? 'is-open' : ''}`} aria-label="Faculty workspace">
      <div className="sidebar-brand"><div className="brand-mark"><GraduationCap size={21} /></div><div className="sidebar-label"><strong>Presentia<span className="brand-dot">.</span></strong><span>{user?.role==='admin'?'Admin workspace':'Faculty workspace'}</span></div>
        <button className="icon-button mobile-close" onClick={onClose} aria-label="Close navigation"><X size={18} /></button></div>
      <div className="sidebar-section-label sidebar-label">Workspace</div>
      <nav aria-label="Main navigation">{links.map(({ path, label, icon: Icon }) =>
        <NavLink key={path} to={path} end={path === '/'} onClick={onClose} title={collapsed ? label : undefined}
          className={({ isActive }) => `sidebar-link ${isActive ? 'is-active' : ''}`}><Icon size={18} strokeWidth={1.7} /><span className="sidebar-label">{label}</span></NavLink>
      )}</nav>
      <div className="sidebar-bottom">
        <div className="sidebar-tip sidebar-label"><GraduationCap size={14}/><span>Class attendance workspace</span></div>
        <button className="sidebar-collapse" onClick={() => setCollapsed(!collapsed)} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
          {collapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}<span className="sidebar-label">Collapse sidebar</span></button>
        <div className="sidebar-account"><div className="avatar-initial" aria-hidden="true">{user?.name?.slice(0, 1).toUpperCase() || 'F'}</div><div className="sidebar-label min-w-0 flex-1"><strong>{user?.name}</strong><span>{user?.role==='admin'?'Administrator':'Faculty account'}</span></div>
          <button className="icon-button sign-out" aria-label="Sign out" title="Sign out" onClick={async () => { await logout(); navigate('/login'); }}><LogOut size={16} /></button></div>
      </div>
    </aside>
  </>;
}
