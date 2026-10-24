import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BookOpen, Users, Radio, Plus, QrCode, FileSpreadsheet, Clock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { attendanceDataService } from '../services/attendanceDataService';
import type { ClassItem, AttendanceSession } from '../types';
import { Disclosure, EmptyState, InlineError, PageHeading } from '../components/ui/PortalUI';

export function DashboardPage() {
  const { user } = useAuth();
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [session, setSession] = useState<AttendanceSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    if (!user) return;
    try {
      const [list, active] = await Promise.all([attendanceDataService.getClasses(user.id), attendanceDataService.getActiveSession(user.id)]);
      setClasses(list.filter(c=>c.isActive)); setSession(active); setError(null);
    } catch (err) { setError(err instanceof Error ? err.message : 'Unable to load your workspace.'); }
    finally { setLoading(false); }
  }, [user]);
  useEffect(() => { void load(); return attendanceDataService.subscribe(() => { void load(); }); }, [load]);
  const stats = [
    { label: 'Your classes', value: classes.length, caption: 'Assigned courses', icon: BookOpen },
    { label: 'Enrollments', value: classes.reduce((sum, cls) => sum + cls.enrolledStudentsCount, 0), caption: 'Across your classes', icon: Users },
    { label: 'Live sessions', value: session ? 1 : 0, caption: session ? 'Accepting student scans' : 'No session in progress', icon: Radio },
  ];
  return <div className="page-stack">
    <PageHeading eyebrow="YOUR WORKSPACE" title={`Welcome back, ${user?.name || 'Faculty'}`} description="Your classes and attendance, without the extra noise."
      action={<Link className="p-button" to="/create-class"><Plus size={15} />Create class</Link>} />
    <InlineError message={error} />
    {session && <div className="live-callout"><div className="flex items-center gap-2"><span className="status-dot" /><strong>{session.courseCode} is live</strong><span className="hidden sm:inline">{session.className}</span></div><Link to="/live-attendance" className="text-link">Open attendance<ArrowRight size={14} /></Link></div>}
    <section className="stat-grid" aria-label="Workspace summary">{stats.map(({ label, value, caption, icon: Icon }) => <div className="panel stat-card" key={label}><div className="stat-card-top"><span>{label}</span><Icon size={17} strokeWidth={1.5} /></div><p className="stat-card-value">{loading ? '—' : value}</p><p className="stat-card-caption">{caption}</p></div>)}</section>
    <div className="overview-grid"><section className="panel"><div className="panel-heading"><h2 className="panel-title">Your classes <span className="count-badge">{classes.length}</span></h2><Link to="/classes" className="text-link">View all<ArrowRight size={13} /></Link></div>
      {loading ? <p className="p-6 text-xs text-slate-400" role="status">Loading classes…</p> : classes.length === 0 ? <EmptyState icon={BookOpen} title="A fresh start for your semester" description="Create your first class, then share its enrollment code with students."
        action={<Link className="p-button secondary small" to="/create-class"><Plus size={14} />Create your first class</Link>} />
        : classes.slice(0, 4).map(cls => <div className="schedule-row" key={cls.id}><span className="course-badge">{cls.courseCode}</span><div className="min-w-0 flex-1"><h3>{cls.className}</h3><p className="flex items-center gap-1.5"><Clock size={11} />{cls.scheduleInfo || 'Schedule not set'}<span>· {cls.enrolledStudentsCount} enrolled</span></p></div><Link className="p-button ghost small" to="/classes">Details<ArrowRight size={12} /></Link></div>)}
    </section><aside className="space-y-4"><section className="panel"><div className="panel-heading"><h2 className="panel-title">Quick actions</h2></div><div className="action-list">
      <Link className="action-row" to="/live-attendance"><QrCode size={17} /><div><strong>Take attendance</strong><p>Choose a class to begin</p></div><ArrowRight /></Link>
      <Link className="action-row" to="/classes"><Users size={17} /><div><strong>Manage your classes</strong><p>Rosters and enrollment codes</p></div><ArrowRight /></Link>
      <Link className="action-row" to="/reports"><FileSpreadsheet size={17} /><div><strong>View reports</strong><p>Review and export attendance</p></div><ArrowRight /></Link>
    </div></section><Disclosure title="How attendance works"><ol className="list-decimal space-y-2 pl-4"><li>Start a session for your class.</li><li>Students scan the QR and submit a photo.</li><li>Review submissions, then finalize the report.</li></ol></Disclosure></aside></div>
  </div>;
}
