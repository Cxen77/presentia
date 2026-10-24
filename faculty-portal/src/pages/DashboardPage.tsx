import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BookOpen, Users, Plus, QrCode, FileSpreadsheet, Clock, ChevronRight } from 'lucide-react';
import { motion } from 'motion/react';
import { useAuth } from '../context/AuthContext';
import { attendanceDataService } from '../services/attendanceDataService';
import type { ClassItem, AttendanceSession } from '../types';
import { EmptyState, InlineError, PageHeading } from '../components/ui/PortalUI';
import { Stagger, StaggerItem, AnimatedNumber } from '../components/ui/Motion';
import { easeOut } from '../components/ui/motionEase';

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
    <Stagger className="desk-summary" aria-label="Workspace summary" gap={0.09}>
      <StaggerItem><span className="desk-stat"><strong><AnimatedNumber value={loading ? 0 : classes.length}/></strong> {classes.length === 1 ? 'class' : 'classes'}</span></StaggerItem>
      <StaggerItem><span className="desk-stat"><strong><AnimatedNumber value={loading ? 0 : enrollmentCount}/></strong> {enrollmentCount === 1 ? 'enrollment' : 'enrollments'}</span></StaggerItem>
      <StaggerItem className="desk-session-state">
        <span className={`desk-state-mark ${session ? 'is-live' : ''}`}/>{session ? 'Attendance in progress' : 'No active session'}
      </StaggerItem>
    </Stagger>
    <section className="desk-courses">
      <div className="desk-section-heading"><div><h2>Your classes</h2><p>{session ? 'Continue your live session, or open a class.' : 'Choose a course to manage students and attendance.'}</p></div><Link className="text-link" to="/classes">View all<ChevronRight size={14}/></Link></div>
      {loading ? <p className="desk-loading" role="status">Loading your courses…</p> : !classes.length ? <EmptyState icon={BookOpen} title="Add your first class" description="Create a class and share its enrollment code with your students." action={<Link className="p-button" to="/create-class"><Plus size={14}/>Create class</Link>}/> :
      <Stagger className="desk-course-list" gap={0.05}>{classes.map(cls =>
        <StaggerItem key={cls.id}>
          <motion.div className={`desk-course ${session?.classId === cls.id ? 'is-live' : ''}`} whileHover={{ x: 3 }} transition={{ duration: 0.2, ease: easeOut }}>
            <span className="desk-course-code">{cls.courseCode}</span>
            <div className="desk-course-title"><Link to="/classes" title={cls.className}>{cls.className}</Link><span><Clock size={12}/>{cls.scheduleInfo || 'Schedule not set'}<span className="desk-course-room">{cls.room || ''}</span></span></div>
            {session?.classId === cls.id && <motion.span className="desk-course-live" initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 320, damping: 20 }}><Link to="/live-attendance">Resume<ArrowRight size={14}/></Link></motion.span>}
            <span className="desk-enrolled"><Users size={14}/><AnimatedNumber value={cls.enrolledStudentsCount}/></span>
            <Link className="desk-course-open" to="/classes" aria-label={`Open ${cls.className}`}><ChevronRight size={17}/></Link>
          </motion.div>
        </StaggerItem>)}
      </Stagger>}
      <div className="desk-course-footer"><span>Scan, review, confirm.</span><Link to="/live-attendance" className="p-button shimmer"><QrCode size={15}/>{session ? 'Open live attendance' : 'Take attendance'}</Link></div>
    </section>
    <nav className="desk-utilities" aria-label="Teaching tools"><Link to="/students"><Users size={17}/><span>Student register</span><ArrowRight size={14}/></Link><Link to="/reports"><FileSpreadsheet size={17}/><span>Attendance reports</span><ArrowRight size={14}/></Link></nav>
  </div>;
}
