import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, ChevronUp, ChevronDown, Users, XCircle, MapPin, MoveVertical } from 'lucide-react';
import { Disclosure } from '../ui/PortalUI';
import type { AttendanceRecord } from '../../types';

type Props = {
  records: AttendanceRecord[];
  deciding: string | null;
  sessionOpen: boolean;
  hasSubmissions: boolean;
  preview?: boolean;
  onConfirm: (id: string) => void;
  onReject: (record: AttendanceRecord) => void;
};

function ReviewPhoto({ src, alt }: { src: string; alt: string }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) return <div className="review-photo-unavailable"><Users size={24}/><span>{src ? 'Photo unavailable' : 'Photo not provided'}</span></div>;
  return <img src={src} alt={alt} onError={() => setFailed(true)}/>;
}

export function SubmissionReviewFeed({ records, deciding, sessionOpen, hasSubmissions, preview = false, onConfirm, onReject }: Props) {
  const feedRef = useRef<HTMLDivElement>(null);
  const scrollTargetRef = useRef<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const recordIds = records.map(record => record.id).join(',');
  const activeIndex = Math.max(0, records.findIndex(record => record.id === activeId));
  const rulerTicks = Array.from({length: Math.max(1, records.length) * 4 + 25}, (_, index) => index - 12);

  useEffect(() => {
    const feed = feedRef.current;
    if (!feed) return;
    if (scrollTargetRef.current && !recordIds.split(',').includes(scrollTargetRef.current)) scrollTargetRef.current = null;
    const observer = new IntersectionObserver(entries => {
      const visible = entries.filter(entry => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (visible) {
        const id = (visible.target as HTMLElement).dataset.reviewId || null;
        if (scrollTargetRef.current && scrollTargetRef.current !== id) return;
        scrollTargetRef.current = null;
        setActiveId(id);
      }
    }, { root: feed, threshold: 0.45 });
    feed.querySelectorAll('[data-review-id]').forEach(card => observer.observe(card));
    return () => observer.disconnect();
  }, [recordIds]);

  const goTo = (index: number) => {
    const feed = feedRef.current;
    const card = feed?.querySelectorAll<HTMLElement>('[data-review-id]')[index];
    if (!feed || !card || !records[index]) return;
    scrollTargetRef.current = records[index].id;
    setActiveId(records[index].id);
    feed.scrollTo({ top: Math.max(0, card.offsetTop - (feed.clientHeight - card.offsetHeight) / 2), behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  };

  return <div className="submission-review-feed">
    <div className="review-feed-heading"><span>Photo review</span><small><MoveVertical size={12} aria-hidden="true"/>Scroll for the next student</small></div>
    <div className="review-reel">
      <div ref={feedRef} className="submission-deck" tabIndex={records.length ? 0 : -1} role="region" aria-label="Pending student photo comparisons" onWheel={() => {scrollTargetRef.current = null;}} onTouchStart={() => {scrollTargetRef.current = null;}} onKeyDown={event => {
        if (event.target !== event.currentTarget) return;
        if (event.key === 'ArrowDown' || event.key === 'PageDown') { event.preventDefault(); goTo(Math.min(records.length - 1, activeIndex + 1)); }
        if (event.key === 'ArrowUp' || event.key === 'PageUp') { event.preventDefault(); goTo(Math.max(0, activeIndex - 1)); }
        if (event.key === 'Home') { event.preventDefault(); goTo(0); }
        if (event.key === 'End') { event.preventDefault(); goTo(records.length - 1); }
      }}>
        {!records.length ? <div className="review-empty"><span className="review-empty-mark"><Users size={25}/></span><h2>{hasSubmissions ? 'You’re up to date' : 'Ready for your students'}</h2><p>{hasSubmissions ? 'New submissions will appear here for review.' : 'Each student’s profile photo and selfie will appear here after they submit.'}</p><span className="review-empty-caption">{sessionOpen ? 'Check-in is open' : 'Check-in is closed'}</span></div> : records.map((record, index) => <article className={`identity-review ${index === activeIndex ? "is-current" : index < activeIndex ? "is-before" : "is-after"}`} data-review-id={record.id} key={record.id} inert={index !== activeIndex} aria-hidden={index !== activeIndex} aria-label={`Review ${record.studentName}, roll ${record.studentClassRollNumber || 'not set'}`}>
          <div className="review-card-layout">
            <aside className="review-student-details"><span className="review-card-position">Student {String(index + 1).padStart(2, '0')}</span><h2>{record.studentName}</h2><p className="review-usn">{record.studentRollNumber}</p><dl><div><dt>Roll no.</dt><dd>{record.studentClassRollNumber || '—'}</dd></div><div><dt>Section</dt><dd>{record.studentSection || '—'}</dd></div></dl><span className="review-student-state">{preview ? 'Design preview' : 'Awaiting review'}</span><time dateTime={record.submittedAt}>{new Date(record.submittedAt).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</time></aside>
            <div className="review-student-images">
          <div className="review-photo-pair"><figure><figcaption>{preview ? "Sample profile" : "Profile photo"}</figcaption><div><ReviewPhoto key={record.studentAvatarUrl} src={record.studentAvatarUrl} alt={`Registered profile photo of ${record.studentName}`}/></div></figure><figure><figcaption>{preview ? "Sample selfie" : "Attendance selfie"}</figcaption><div><ReviewPhoto key={record.verificationPhotoUrl} src={record.verificationPhotoUrl} alt={`Attendance selfie of ${record.studentName}`}/></div></figure></div>
          {record.checkinLocation && <Disclosure title="Location details" description={record.checkinLocation.campusRestricted ? `${record.checkinLocation.distanceM} m from campus centre` : 'Campus restriction off'}><p><MapPin size={13} className="inline"/> {record.checkinLocation.submission.platform} · GPS accuracy ±{Math.round(record.checkinLocation.submission.accuracy)} m</p><p>Mock GPS: {record.checkinLocation.submission.mocked === false ? 'not reported by device' : 'check unavailable'} · Developer Options: unavailable</p><p>Scan: {record.checkinLocation.scan.latitude.toFixed(5)}, {record.checkinLocation.scan.longitude.toFixed(5)}</p><p>Submission: {record.checkinLocation.submission.latitude.toFixed(5)}, {record.checkinLocation.submission.longitude.toFixed(5)}</p><p>Received {new Date(record.checkinLocation.receivedAt).toLocaleTimeString()}</p></Disclosure>}
            </div>
          </div>
          <footer className="review-decisions"><p>{preview ? "Design preview · decisions are disabled" : "Compare both photos before deciding."}</p><div><button className="p-button secondary" disabled={preview || !!deciding} onClick={() => onReject(record)}><XCircle size={15}/>Reject</button><button className="p-button" disabled={preview || !!deciding} onClick={() => onConfirm(record.id)}><CheckCircle2 size={15}/>{deciding === record.id ? 'Saving…' : 'Confirm present'}</button></div></footer>
        </article>)}
      </div>
      <div className="review-scrubber" aria-label="Review navigation">
        <button className="scrubber-step" aria-label="Previous student" disabled={!records.length || activeIndex === 0} onClick={() => goTo(activeIndex - 1)}><ChevronUp size={16}/></button>
        <div className="scrubber-ruler"><div className="scrubber-ruler-window" aria-hidden="true"><div className="scrubber-ruler-scale" style={{transform:`translateY(-${(12 + activeIndex * 4) * 7 + 3.5}px)`}}>{rulerTicks.map(tick => <span key={tick} className={tick % 4 === 0 ? "is-major" : ""}/>)}</div><span className="scrubber-centre-mark"/></div><input type="range" aria-label="Select student to review" aria-valuetext={records.length ? `Student ${activeIndex + 1} of ${records.length}: ${records[activeIndex]?.studentName}` : 'No students waiting'} min={0} max={Math.max(1, records.length - 1)} step={1} value={activeIndex} disabled={records.length < 2} onChange={event => goTo(Number(event.target.value))} onKeyDown={event => {if(event.key === 'ArrowDown'){event.preventDefault();goTo(Math.min(records.length - 1,activeIndex + 1));}if(event.key === 'ArrowUp'){event.preventDefault();goTo(Math.max(0,activeIndex - 1));}}}/></div>
        <span className="scrubber-position" aria-live="polite" aria-atomic="true"><span className="sr-only">Student </span>{String(records.length ? activeIndex + 1 : 0).padStart(2,'0')}<small><span className="sr-only"> of </span>{String(records.length).padStart(2,'0')}</small></span>
        <button className="scrubber-step" aria-label="Next student" disabled={!records.length || activeIndex >= records.length - 1} onClick={() => goTo(activeIndex + 1)}><ChevronDown size={16}/></button>
      </div>
    </div>
    {records.length > 1 && <label className="review-jump"><span>Jump to student</span><select value={records[activeIndex]?.id || ''} onChange={event => goTo(records.findIndex(record => record.id === event.target.value))}>{records.map(record => <option key={record.id} value={record.id}>{record.studentName} · Roll {record.studentClassRollNumber || '—'}</option>)}</select></label>}
  </div>;
}
