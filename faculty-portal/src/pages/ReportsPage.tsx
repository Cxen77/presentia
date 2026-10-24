import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Calendar, ChevronDown, Download, FileSpreadsheet, RefreshCw, CheckCircle2, ArrowRight } from 'lucide-react';
import { EmptyState, InlineError, PageHeading } from '../components/ui/PortalUI';
import { attendanceDataService } from '../services/attendanceDataService';
import { downloadSessionReport } from '../services/api';
import type { AttendanceSession } from '../types';

type FullRosterData = NonNullable<Awaited<ReturnType<typeof attendanceDataService.getSessionFullRoster>>>;
type ResultFilter = 'ALL'|'PRESENT'|'ABSENT'|'PENDING';

export function ReportsPage() {
  const [params] = useSearchParams();
  const [sessions, setSessions] = useState<AttendanceSession[]>([]);
  const [expandedId, setExpandedId] = useState<string|null>(params.get('session'));
  const [roster, setRoster] = useState<FullRosterData|null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState<string|null>(null);
  const [error, setError] = useState<string|null>(null);
  const [filter, setFilter] = useState<ResultFilter>('ALL');
  const loadSessions = useCallback(async () => {
    try {setSessions(await attendanceDataService.getAllSessions());}
    catch(reason) {setError(reason instanceof Error ? reason.message : 'Could not load reports.');}
  }, []);
  useEffect(() => {void loadSessions();return attendanceDataService.subscribe(() => void loadSessions());}, [loadSessions]);
  useEffect(() => {
    let cancelled = false;
    if (!expandedId) return;
    setLoading(true);setError(null);
    void attendanceDataService.getSessionFullRoster(expandedId).then(data => {if(!cancelled)setRoster(data);})
      .catch(reason => {if(!cancelled)setError(reason instanceof Error ? reason.message : 'Could not load this report.');})
      .finally(() => {if(!cancelled)setLoading(false);});
    return () => {cancelled = true;};
  }, [expandedId]);
  useEffect(() => {
    if (!roster?.session.finalizedAt || !roster.session.selfieCleanupPending) return;
    let cancelled = false;
    const id = roster.session.id;
    const timer = setInterval(() => {void attendanceDataService.getSessionFullRoster(id).then(data => {if(!cancelled)setRoster(data);}).catch(() => {});}, 5000);
    return () => {cancelled = true;clearInterval(timer);};
  }, [roster?.session.id, roster?.session.finalizedAt, roster?.session.selfieCleanupPending]);
  const download = async (id:string) => {
    setExporting(id);setError(null);
    try {await downloadSessionReport(id);}
    catch(reason) {setError(reason instanceof Error ? reason.message : 'Could not download the sheet.');}
    finally {setExporting(null);}
  };
  const shown = roster?.roster.filter(item => filter === 'ALL' || item.status === filter) || [];

  return <div className="page-stack attendance-reports">
    <PageHeading title="Attendance reports" description="Present and absent students, saved for each class session." action={<button className="p-button secondary" onClick={() => void loadSessions()}><RefreshCw size={14}/>Refresh</button>}/>
    <InlineError message={error}/>
    {!sessions.length ? <section className="panel"><EmptyState icon={FileSpreadsheet} title="No attendance reports yet" description="End a check-in session and confirm its photo-verification list to save attendance." action={<Link className="p-button" to="/live-attendance">Open attendance</Link>}/></section> : <div className="report-sessions">{sessions.map(session => {
      const expanded = session.id === expandedId;
      const current = expanded && roster?.session.id === session.id ? roster : null;
      return <section className={`report-session ${expanded ? 'is-expanded' : ''}`} key={session.id}>
        <header className="report-session-header"><button className="report-session-title" aria-expanded={expanded} aria-controls={`report-${session.id}`} onClick={() => {setExpandedId(expanded ? null : session.id);setFilter('ALL');}}><span className="course-badge">{session.courseCode}</span><span><strong>{session.className}</strong><small><Calendar size={12}/>{session.date}<span>{session.startTime} – {session.endTime}</span></small></span><ChevronDown size={16}/></button><div className="report-session-actions"><span className="report-state">{session.status === 'ACTIVE' ? 'Check-in open' : session.status === 'AWAITING_VERIFICATION' ? 'Needs confirmation' : 'Confirmed'}</span>{session.status !== 'CLOSED' ? <Link className="p-button secondary small" to={`/live-attendance?session=${session.id}`}>Review class<ArrowRight size={12}/></Link> : <button className="p-button secondary small" disabled={exporting === session.id} onClick={() => void download(session.id)}><Download size={13}/>{exporting === session.id ? 'Downloading…' : 'Download sheet'}</button>}</div></header>
        {expanded && <div id={`report-${session.id}`} className="report-session-body">{loading ? <p className="desk-loading" role="status">Loading the class roster…</p> : current ? <>
          <div className="report-result-summary"><span><strong>{current.metrics.totalEnrolled}</strong> students</span><span><strong>{current.metrics.present}</strong> present</span><span><strong>{current.metrics.absent}</strong> absent</span>{current.metrics.pending > 0 && <span><strong>{current.metrics.pending}</strong> awaiting confirmation</span>}</div>
          {current.session.finalizedAt && <p className="report-cleanup-status"><CheckCircle2 size={14}/>{current.session.selfieCleanupPending ? `Attendance saved. Deleting ${current.session.selfieCleanupPending} session selfies…` : 'Session selfies deleted. Profile photos and attendance history are retained.'}</p>}
          <div className="report-result-filters" aria-label="Filter attendance result">{(['ALL','PRESENT','ABSENT',...(current.metrics.pending ? ['PENDING'] : [])] as ResultFilter[]).map(value => <button key={value} aria-pressed={filter === value} className={filter === value ? 'is-selected' : ''} onClick={() => setFilter(value)}>{value === 'ALL' ? 'All students' : value === 'PRESENT' ? 'Present' : value === 'ABSENT' ? 'Absent' : 'Pending'}</button>)}</div>
          <div className="report-roster-scroll"><table className="report-roster"><thead><tr><th>Student</th><th>USN</th><th>Roll / section</th><th>Attendance</th><th>Details</th></tr></thead><tbody>{shown.map(item => <tr key={item.student.id}><td><strong>{item.student.fullName}</strong></td><td>{item.student.rollNumber}</td><td>{item.student.classRollNumber || '—'} / {item.student.section || '—'}</td><td><span className="report-state">{item.status === 'PRESENT' ? 'Present' : item.status === 'ABSENT' ? 'Absent' : 'Pending'}</span></td><td>{item.status === 'ABSENT' ? item.record?.rejectionReason || 'No submission' : item.status === 'PRESENT' ? 'Confirmed by teacher' : 'Awaiting class confirmation'}</td></tr>)}</tbody></table>{!shown.length && <p className="desk-loading">No students in this result.</p>}</div>
        </> : <p className="desk-loading">Could not load the class roster.</p>}</div>}
      </section>;
    })}</div>}
  </div>;
}
