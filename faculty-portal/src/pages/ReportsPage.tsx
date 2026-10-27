import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Calendar, ChevronDown, Download, FileSpreadsheet, RefreshCw, CheckCircle2, ArrowRight, EyeOff, RotateCcw, ListChecks, Images } from 'lucide-react';
import { EmptyState, InlineError, PageHeading } from '../components/ui/PortalUI';
import { SubmissionReviewFeed } from '../components/attendance/SubmissionReviewFeed';
import { attendanceDataService } from '../services/attendanceDataService';
import { downloadSessionReport, getSessionRecords } from '../services/api';
import type { AttendanceRecord, AttendanceSession } from '../types';
import { supabase } from '../services/supabase';
import { loadIgnoredReports, setReportIgnored } from '../utils/reportVisibility';
import { prepareBatchReview } from '../utils/batchReview';
import { notify } from '../services/toast';

type FullRosterData = NonNullable<Awaited<ReturnType<typeof attendanceDataService.getSessionFullRoster>>>;
type ResultFilter = 'ALL'|'PRESENT'|'ABSENT'|'PENDING';
type DownloadFilter = 'all'|'present'|'absent';

export function ReportsPage() {
  const [params] = useSearchParams();
  const [sessions, setSessions] = useState<AttendanceSession[]>([]);
  const [expandedId, setExpandedId] = useState<string|null>(params.get('session'));
  const [roster, setRoster] = useState<FullRosterData|null>(null);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState<string|null>(null);
  const [error, setError] = useState<string|null>(null);
  const [ignoredIds, setIgnoredIds] = useState<Set<string>>(new Set());
  const [showIgnored, setShowIgnored] = useState(false);
  const [visibilityBusy, setVisibilityBusy] = useState(false);
  const [visibilityLoaded, setVisibilityLoaded] = useState(false);
  const [filter, setFilter] = useState<ResultFilter>('ALL');
  const [actionTab, setActionTab] = useState<'submit'|'review'>('submit');
  const [selections, setSelections] = useState<Record<string, boolean>>({});
  const [excludedIds, setExcludedIds] = useState<Set<string>>(new Set());
  const [confirming, setConfirming] = useState(false);

  const loadSessions = useCallback(async () => {
    try {
      const [allSessions, ignored] = await Promise.all([attendanceDataService.getAllSessions(), loadIgnoredReports(supabase.auth)]);
      setSessions(allSessions);setIgnoredIds(ignored);setVisibilityLoaded(true);
    }
    catch(reason) {setError(reason instanceof Error ? reason.message : 'Could not load reports.');}
  }, []);
  useEffect(() => {void loadSessions();return attendanceDataService.subscribe(() => void loadSessions());}, [loadSessions]);

  const loadRoster = useCallback(async (id: string) => {
    const data = await attendanceDataService.getSessionFullRoster(id);
    setRoster(data);
    if (data && !data.session.finalizedAt && data.session.status === 'AWAITING_VERIFICATION') {
      setRecords(await getSessionRecords(id));
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!expandedId) return;
    setLoading(true);setError(null);setActionTab('submit');setExcludedIds(new Set());setSelections({});
    void loadRoster(expandedId)
      .catch(reason => {if(!cancelled)setError(reason instanceof Error ? reason.message : 'Could not load this report.');})
      .finally(() => {if(!cancelled)setLoading(false);});
    return () => {cancelled = true;};
  }, [expandedId, loadRoster]);
  useEffect(() => {
    if (!roster?.session.finalizedAt || !roster.session.selfieCleanupPending) return;
    let cancelled = false;
    const id = roster.session.id;
    const timer = setInterval(() => {void attendanceDataService.getSessionFullRoster(id).then(data => {if(!cancelled)setRoster(data);}).catch(() => {});}, 5000);
    return () => {cancelled = true;clearInterval(timer);};
  }, [roster?.session.id, roster?.session.finalizedAt, roster?.session.selfieCleanupPending]);

  const download = async (id:string, downloadFilter: DownloadFilter = 'all') => {
    setExporting(id + downloadFilter);setError(null);
    try {await downloadSessionReport(id, downloadFilter);}
    catch(reason) {setError(reason instanceof Error ? reason.message : 'Could not download the sheet.');}
    finally {setExporting(null);}
  };
  const changeVisibility = async (id:string, ignored:boolean) => {
    setVisibilityBusy(true);setError(null);
    try {
      setIgnoredIds(await setReportIgnored(supabase.auth,id,ignored));
      if (ignored && expandedId === id) setExpandedId(null);
    } catch(reason) {setError(reason instanceof Error ? reason.message : 'Could not save report visibility.');}
    finally {setVisibilityBusy(false);}
  };
  const refetchAfterConfirm = useCallback(async (id: string) => {
    await Promise.all([loadSessions(), loadRoster(id)]);
  }, [loadSessions, loadRoster]);

  const confirmReviewTab = async (sessionId: string) => {
    setConfirming(true);setError(null);
    try {
      const draft = prepareBatchReview(records, excludedIds, crypto.randomUUID());
      await attendanceDataService.finalizeSession(sessionId, draft);
      notify.success('Attendance confirmed', 'The present and absent lists are saved.');
      await refetchAfterConfirm(sessionId);
    } catch(reason) {setError(reason instanceof Error ? reason.message : 'Could not confirm the class.');}
    finally {setConfirming(false);}
  };

  const toggleSelection = (studentId: string, present: boolean) => {
    setSelections(previous => ({...previous, [studentId]: present}));
  };
  const submitBulk = async (sessionId: string) => {
    setConfirming(true);setError(null);
    try {
      // Fresh records: per-signal decisions (if any) change statuses server-side.
      const fresh = await getSessionRecords(sessionId);
      setRecords(fresh);
      const excluded = new Set<string>(fresh.filter((record: AttendanceRecord) => selections[record.studentId] === false).map((record: AttendanceRecord) => record.id));
      const draft = prepareBatchReview(fresh, excluded, crypto.randomUUID());
      await attendanceDataService.finalizeSession(sessionId, draft);
      notify.success('Attendance submitted', 'The sheet is ready to download below.');
      await refetchAfterConfirm(sessionId);
    } catch(reason) {setError(reason instanceof Error ? reason.message : 'Could not submit attendance.');}
    finally {setConfirming(false);}
  };

  const visibleSessions = sessions.filter(session => showIgnored || !ignoredIds.has(session.id));
  const ignoredCount = sessions.filter(session => ignoredIds.has(session.id)).length;
  const shown = roster?.roster.filter(item => filter === 'ALL' || item.status === filter) || [];
  const needsConfirmation = Boolean(roster && !roster.session.finalizedAt && roster.session.status === 'AWAITING_VERIFICATION');
  const presentCount = roster?.roster.filter(item => selections[item.student.id] !== false && item.status !== 'ABSENT').length ?? 0;
  const absentCount = (roster?.roster.length ?? 0) - presentCount;

  return <div className="page-stack attendance-reports">
    <PageHeading title="Attendance reports" description="Present and absent students, saved for each class session." action={<button className="p-button secondary" onClick={() => void loadSessions()}><RefreshCw size={14}/>Refresh</button>}/>
    <InlineError message={error}/>
    {ignoredCount > 0 && <div className="toolbar"><span className="toolbar-meta">{visibleSessions.length} visible reports</span><label className="archive-filter"><input type="checkbox" checked={showIgnored} onChange={event => setShowIgnored(event.target.checked)}/>Show ignored test sessions ({ignoredCount})</label></div>}
    {!sessions.length ? <section className="panel"><EmptyState icon={FileSpreadsheet} title="No attendance reports yet" description="End a check-in session and submit the class to save attendance." action={<Link className="p-button" to="/live-attendance">Open attendance</Link>}/></section> : <div className="report-sessions">{visibleSessions.map(session => {
      const expanded = session.id === expandedId;
      const current = expanded && roster?.session.id === session.id ? roster : null;
      return <section className={`report-session ${expanded ? 'is-expanded' : ''}`} key={session.id} data-session-id={session.id}>
        <header className="report-session-header"><button className="report-session-title" aria-expanded={expanded} aria-controls={`report-${session.id}`} onClick={() => {setExpandedId(expanded ? null : session.id);setFilter('ALL');}}><span className="course-badge">{session.courseCode}</span><span><strong>{session.className}</strong><small><Calendar size={12}/>{session.date}<span>{session.startTime} – {session.endTime}</span></small></span><ChevronDown size={16}/></button><div className="report-session-actions">{ignoredIds.has(session.id) ? <button className="p-button ghost small" disabled={visibilityBusy} onClick={() => void changeVisibility(session.id,false)}><RotateCcw size={12}/>Restore report</button> : session.status === 'AWAITING_VERIFICATION' && <button className="icon-button" title="Ignore test session" aria-label="Ignore test session" disabled={visibilityBusy || !visibilityLoaded} onClick={() => void changeVisibility(session.id,true)}><EyeOff size={15}/></button>}<span className="report-state">{ignoredIds.has(session.id) ? 'Ignored test session' : session.status === 'ACTIVE' ? 'Check-in open' : session.status === 'AWAITING_VERIFICATION' ? 'Needs submission' : 'Confirmed'}</span>{session.status === 'CLOSED' ? <button className="p-button secondary small" disabled={exporting === session.id} onClick={() => void download(session.id)}><Download size={13}/>{exporting === session.id ? 'Downloading…' : 'Download sheet'}</button> : <Link className="p-button secondary small" to={`/live-attendance?session=${session.id}`}>Open check-in<ArrowRight size={12}/></Link>}</div></header>
        {expanded && <div id={`report-${session.id}`} className="report-session-body">{loading ? <p className="desk-loading" role="status">Loading the class roster…</p> : current ? <>
          <div className="report-result-summary"><span><strong>{current.metrics.totalEnrolled}</strong> students</span><span><strong>{current.metrics.present}</strong> present</span><span><strong>{current.metrics.absent}</strong> absent</span>{current.metrics.pending > 0 && <span><strong>{current.metrics.pending}</strong> awaiting submission</span>}</div>
          {current.session.finalizedAt && <p className="report-cleanup-status"><CheckCircle2 size={14}/>{current.session.selfieCleanupPending ? `Attendance saved. Deleting ${current.session.selfieCleanupPending} session selfies…` : 'Session selfies deleted. Profile photos and attendance history are retained.'}</p>}
          {needsConfirmation && <div className="report-tabs" role="tablist" aria-label="Attendance actions">
            <button role="tab" aria-selected={actionTab === 'submit'} className={actionTab === 'submit' ? 'is-selected' : ''} onClick={() => setActionTab('submit')}><ListChecks size={14}/>Submit attendance</button>
            <button role="tab" aria-selected={actionTab === 'review'} className={actionTab === 'review' ? 'is-selected' : ''} onClick={() => setActionTab('review')}><Images size={14}/>Review photos (optional)</button>
          </div>}
          {needsConfirmation && actionTab === 'submit' ? <>
            <p className="desk-loading">Choose present or absent for each student — submissions default to present. Students without a submission are absent.</p>
            <div className="bulk-actions">
              <button className="p-button secondary small" disabled={confirming} onClick={() => setSelections(Object.fromEntries(current.roster.map(item => [item.student.id, item.status !== 'ABSENT'])))}>Mark all submitted present</button>
              <button className="p-button secondary small" disabled={confirming} onClick={() => setSelections(Object.fromEntries(current.roster.map(item => [item.student.id, false])))}>Mark all absent</button>
              <span className="toolbar-meta">{presentCount} present · {absentCount} absent</span>
              <button className="p-button" style={{marginLeft:'auto'}} disabled={confirming || !records.length} onClick={() => void submitBulk(session.id)}><CheckCircle2 size={14}/>{confirming ? 'Submitting…' : 'Submit attendance'}</button>
            </div>
            <div className="report-roster-scroll"><table className="report-roster"><thead><tr><th>Student</th><th>USN</th><th>Roll / section</th><th>Submitted</th><th>Attendance</th></tr></thead><tbody>{current.roster.map(item => {
              const hasRecord = Boolean(item.record);
              const present = selections[item.student.id] !== false && item.status !== 'ABSENT';
              return <tr key={item.student.id}><td><strong>{item.student.fullName}</strong></td><td>{item.student.rollNumber}</td><td>{item.student.classRollNumber || '—'} / {item.student.section || '—'}</td><td>{item.record ? new Date(item.record.submittedAt).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}) : '—'}</td><td><span className="submit-toggle" role="group" aria-label={`Attendance for ${item.student.fullName}`}>
                <button type="button" aria-pressed={present} disabled={!hasRecord || confirming} onClick={() => toggleSelection(item.student.id, true)}>Present</button>
                <button type="button" aria-pressed={!present} disabled={!hasRecord || confirming} onClick={() => toggleSelection(item.student.id, false)}>Absent</button>
              </span>{!hasRecord && <small className="submit-note">no submission</small>}</td></tr>;
            })}</tbody></table></div>
          </> : needsConfirmation && actionTab === 'review' ? <>
            <p className="desk-loading">Optional: compare each profile photo with the selfie and mark anyone absent. Skipping this is fine — the Submit tab handles everything.</p>
            <SubmissionReviewFeed records={records} deciding={confirming ? 'batch' : null} sessionOpen={false} hasSubmissions={records.length > 0} excludedIds={excludedIds} onToggleExcluded={(id) => setExcludedIds(previous => {const next = new Set(previous); if (next.has(id)) next.delete(id); else next.add(id); return next;})} onReviewed={async () => {await loadRoster(session.id);setRecords(await getSessionRecords(session.id));}}/>
            <div className="bulk-actions">
              <span className="toolbar-meta">{records.length - excludedIds.size} present · {excludedIds.size} absent</span>
              <button className="p-button" style={{marginLeft:'auto'}} disabled={confirming || !records.length} onClick={() => void confirmReviewTab(session.id)}><CheckCircle2 size={14}/>{confirming ? 'Confirming…' : 'Confirm as marked'}</button>
            </div>
          </> : <>
            {session.status === 'CLOSED' && <div className="bulk-actions" style={{marginBottom:14}}>
              <span className="toolbar-meta"><Download size={13}/> Download sheet:</span>
              <button className="p-button secondary small" disabled={exporting === session.id + 'all'} onClick={() => void download(session.id, 'all')}>{exporting === session.id + 'all' ? 'Downloading…' : 'All students'}</button>
              <button className="p-button secondary small" disabled={exporting === session.id + 'present'} onClick={() => void download(session.id, 'present')}>{exporting === session.id + 'present' ? 'Downloading…' : 'Present only'}</button>
              <button className="p-button secondary small" disabled={exporting === session.id + 'absent'} onClick={() => void download(session.id, 'absent')}>{exporting === session.id + 'absent' ? 'Downloading…' : 'Absent only'}</button>
            </div>}
            <div className="report-result-filters" aria-label="Filter attendance result">{(['ALL','PRESENT','ABSENT',...(current.metrics.pending ? ['PENDING'] : [])] as ResultFilter[]).map(value => <button key={value} aria-pressed={filter === value} className={filter === value ? 'is-selected' : ''} onClick={() => setFilter(value)}>{value === 'ALL' ? 'All students' : value === 'PRESENT' ? 'Present' : value === 'ABSENT' ? 'Absent' : 'Pending'}</button>)}</div>
            <div className="report-roster-scroll"><table className="report-roster"><thead><tr><th>Student</th><th>USN</th><th>Roll / section</th><th>Attendance</th><th>Details</th></tr></thead><tbody>{shown.map(item => <tr key={item.student.id}><td><strong>{item.student.fullName}</strong></td><td>{item.student.rollNumber}</td><td>{item.student.classRollNumber || '—'} / {item.student.section || '—'}</td><td><span className="report-state">{item.status === 'PRESENT' ? 'Present' : item.status === 'ABSENT' ? 'Absent' : 'Pending'}</span></td><td>{item.status === 'ABSENT' ? item.record?.rejectionReason || 'No submission' : item.status === 'PRESENT' ? 'Confirmed by teacher' : 'Awaiting class confirmation'}</td></tr>)}</tbody></table>{!shown.length && <p className="desk-loading">No students in this result.</p>}</div>
          </>}
        </> : <p className="desk-loading">Could not load the class roster.</p>}</div>}
      </section>;
    })}</div>}
  </div>;
}
