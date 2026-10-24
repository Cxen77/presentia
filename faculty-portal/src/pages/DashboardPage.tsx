import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BookOpen, Users, Plus, QrCode, FileSpreadsheet, Clock, ChevronRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { attendanceDataService } from '../services/attendanceDataService';
import type { ClassItem, AttendanceSession } from '../types';
import { EmptyState, InlineError, PageHeading } from '../components/ui/PortalUI';

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
  const enrollmentCount = classes.reduce((sum, cls) => sum + cls.enrolledStudentsCount, 0);
  return <div className="page-stack teaching-desk">
    <PageHeading title="Teaching desk" description={`Hello, ${user?.name || 'Faculty'}. Your courses and attendance for this semester.`}
      action={<Link className="p-button secondary" to="/create-class"><Plus size={15} aria-hidden="true"/>Create class</Link>}/>
    <InlineError message={error}/>
    <div className="desk-summary" aria-label="Workspace summary"><span><strong>{loading ? '—' : classes.length}</strong> {classes.length === 1 ? 'class' : 'classes'}</span><span><strong>{loading ? '—' : enrollmentCount}</strong> {enrollmentCount === 1 ? 'enrollment' : 'enrollments'}</span><span className="desk-session-state"><span className="desk-state-mark"/>{session ? 'Attendance in progress' : 'No active session'}</span></div>
    <section className="desk-courses">
      <div className="desk-section-heading"><div><h2>Your classes</h2><p>{session ? 'Continue your live session, or open a class.' : 'Choose a course to manage students and attendance.'}</p></div><Link className="text-link" to="/classes">View all<ChevronRight size={14}/></Link></div>
      {loading ? <p className="desk-loading" role="status">Loading your courses…</p> : !classes.length ? <EmptyState icon={BookOpen} title="Add your first class" description="Create a class and share its enrollment code with your students." action={<Link className="p-button" to="/create-class"><Plus size={14}/>Create class</Link>}/> : <div className="desk-course-list">{classes.map(cls => <div className={`desk-course ${session?.classId === cls.id ? "is-live" : ""}`} key={cls.id}><span className="desk-course-code">{cls.courseCode}</span><div className="desk-course-title"><Link to="/classes" title={cls.className}>{cls.className}</Link><span><Clock size={12}/>{cls.scheduleInfo || 'Schedule not set'}<span className="desk-course-room">{cls.room || ''}</span></span></div>{session?.classId === cls.id && <Link className="desk-course-live" to="/live-attendance">Resume<ArrowRight size={14}/></Link>}<span className="desk-enrolled"><Users size={14}/>{cls.enrolledStudentsCount}</span><Link className="desk-course-open" to="/classes" aria-label={`Open ${cls.className}`}><ChevronRight size={17}/></Link></div>)}</div>}
      <div className="desk-course-footer"><span>Scan, review, confirm.</span><Link to="/live-attendance" className="p-button"><QrCode size={15}/>{session ? 'Open live attendance' : 'Take attendance'}</Link></div>
    </section>
    <nav className="desk-utilities" aria-label="Teaching tools"><Link to="/students"><Users size={17}/><span>Student register</span><ArrowRight size={14}/></Link><Link to="/reports"><FileSpreadsheet size={17}/><span>Attendance reports</span><ArrowRight size={14}/></Link></nav>
  </div>;
}
