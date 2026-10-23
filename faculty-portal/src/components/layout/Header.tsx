import { Menu, ChevronRight, ShieldCheck } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import {useAuth} from '../../context/AuthContext';
export function Header({ onMenuToggle, menuOpen }: { onMenuToggle: () => void; menuOpen: boolean }) {
  const { pathname } = useLocation();
  const {user}=useAuth();
  const pages: Record<string, string> = { '/admin':'Admin console','/students':'Students','/profile':'My profile','/': 'Overview', '/classes': user?.role==='admin'?'All classes':'My classes', '/create-class': 'Create class', '/live-attendance': 'Live attendance', '/reports': 'Reports' };
  return <header className="portal-header">
    <div className="flex min-w-0 items-center gap-3"><button className="icon-button mobile-menu" onClick={onMenuToggle} aria-label="Open navigation" aria-expanded={menuOpen} aria-controls="portal-navigation"><Menu size={19} /></button>
      <div className="breadcrumb"><span>Workspace</span><ChevronRight size={13} /><strong>{pages[pathname] || 'Faculty'}</strong></div></div>
    <div className="header-status"><ShieldCheck size={15} /><span>{user?.role==='admin'?'Admin access':'Faculty access'}</span><span className="header-divider" /><span className="status-dot" /><span className="hidden sm:inline">Connected</span></div>
  </header>;
}
