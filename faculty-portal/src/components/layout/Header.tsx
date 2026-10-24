import { Menu, ChevronRight, ShieldCheck, Search } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import {useAuth} from '../../context/AuthContext';
export function Header({ onMenuToggle, menuOpen, onQuickNavigation }: { onMenuToggle: () => void; menuOpen: boolean; onQuickNavigation:()=>void }) {
  const { pathname } = useLocation();
  const {user}=useAuth();
  const pages: Record<string, string> = { '/admin':'Admin console','/students':'Students','/profile':'My profile','/': 'Overview', '/classes': user?.role==='admin'?'All classes':'My classes', '/create-class': 'Create class', '/live-attendance': 'Live attendance', '/reports': 'Reports' };
  return <header className="portal-header">
    <div className="flex min-w-0 items-center gap-3"><button className="icon-button mobile-menu" onClick={onMenuToggle} aria-label="Open navigation" aria-expanded={menuOpen} aria-controls="portal-navigation"><Menu size={19} /></button>
      <div className="breadcrumb"><span>Workspace</span><ChevronRight size={13} /><strong>{pages[pathname] || 'Faculty'}</strong></div></div>
    <div className="header-tools"><button type="button" className="header-search" onClick={onQuickNavigation} aria-label="Find a page"><Search size={15}/><span>Find a page</span><kbd>Ctrl K</kbd></button><div className="header-status"><ShieldCheck size={14} /><span>{user?.role==='admin'?'Administrator':'Faculty'}</span></div><Link to="/profile" className="header-avatar" aria-label="Open my profile" title={user?.name}>{user?.name?.slice(0,1).toUpperCase() || 'P'}</Link></div>
  </header>;
}
