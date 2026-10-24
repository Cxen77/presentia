import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, FileSpreadsheet, LayoutDashboard, QrCode, Search, ShieldCheck, Users, UserRound } from 'lucide-react';
import { Dialog } from '../ui/PortalUI';
import { useAuth } from '../../context/AuthContext';

export function QuickNavigation({onClose}:{onClose:()=>void}) {
  const [query,setQuery]=useState('');
  const {user}=useAuth();
  const navigate=useNavigate();
  const pages=[
    ...(user?.role==='admin'?[{path:'/admin',label:'People & access',description:'Faculty accounts and student details',Icon:ShieldCheck}]:[{path:'/',label:'Overview',description:'Your classes and today’s attendance',Icon:LayoutDashboard}]),
    {path:'/classes',label:user?.role==='admin'?'All classes':'My classes',description:'Class details, students and campus settings',Icon:BookOpen},
    ...(user?.role==='faculty'?[{path:'/live-attendance',label:'Live attendance',description:'Start a QR session and review selfies',Icon:QrCode},{path:'/students',label:'Students',description:'Roll numbers, sections and enrollments',Icon:Users}]:[]),
    {path:'/reports',label:'Reports',description:'Review decisions and download sheets',Icon:FileSpreadsheet},
    {path:'/profile',label:'My profile',description:'Your name and department',Icon:UserRound},
  ].filter(p=>(p.label+' '+p.description).toLowerCase().includes(query.trim().toLowerCase()));
  const go=(path:string)=>{onClose();navigate(path);};
  return <Dialog title="Go to a page" onClose={onClose}>
    <label className="search-field command-search"><Search size={17}/><input data-dialog-autofocus autoFocus aria-label="Find a page" placeholder="Classes, reports, students…" value={query} onChange={e=>setQuery(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&pages[0]){e.preventDefault();go(pages[0].path);}}}/><kbd>Esc</kbd></label>
    <div className="command-results">{pages.length?pages.map(({path,label,description,Icon})=><button type="button" className="command-result" key={path} onClick={()=>go(path)}><span className="command-icon"><Icon size={18} strokeWidth={1.6}/></span><span><strong>{label}</strong><small>{description}</small></span></button>):<p className="command-empty">No matching page. Try “classes” or “reports”.</p>}</div>
    <p className="command-hint">Press Enter to open the first result, or Tab to choose a page.</p>
  </Dialog>;
}
