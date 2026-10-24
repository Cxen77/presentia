import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, ChevronUp, ChevronDown, Users, XCircle, MapPin, MoveVertical } from 'lucide-react';
import { Dialog, Disclosure } from '../ui/PortalUI';
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
  const [photoRecord, setPhotoRecord] = useState<AttendanceRecord | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const recordIds = records.map(record => record.id).join(',');
  const activeIndex = Math.max(0, records.findIndex(record => record.id === activeId));
  const rulerTicks = Array.from({length: Math.max(1, records.length) * 4 + 25}, (_, index) => index - 12);

  useEffect(() => {
    const feed = feedRef.current;
    if (!feed) return;
    if (scrollTargetRef.current && !recordIds.split(',').includes(scrollTargetRef.current)) scrollTargetRef.current = null;
    let frame = 0;
    const update = () => {
      frame = 0;
      if (scrollTargetRef.current) return;
      const cards = Array.from(feed.querySelectorAll<HTMLElement>('[data-review-id]'));
      let closest: HTMLElement | undefined;
      let distance = Infinity;
      for (const card of cards) {
        const next = Math.abs(card.offsetTop - feed.scrollTop - 4);
        if (next < distance) { closest = card; distance = next; }
        else if (card.offsetTop > feed.scrollTop) break;
      }
      if (closest) setActiveId(closest.dataset.reviewId || null);
    };
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(update); };
    feed.addEventListener('scroll', onScroll, {passive: true});
    update();
    return () => { feed.removeEventListener('scroll', onScroll); cancelAnimationFrame(frame); };

  }, [recordIds]);

  const goTo = (index: number) => {
    const feed = feedRef.current;
    const card = feed?.querySelectorAll<HTMLElement>('[data-review-id]')[index];
    if (!feed || !card || !records[index]) return;
    scrollTargetRef.current = records[index].id;
    setActiveId(records[index].id);
    feed.scrollTo({ top: Math.max(0, card.offsetTop - 4), behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
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
        {!records.length ? <div className="review-empty"><span className="review-empty-mark"><Users size={25}/></span><h2>{hasSubmissions ? 'You’re up to date' : 'Ready for your students'}</h2><p>{hasSubmissions ? 'New submissions will appear here for review.' : 'Each student’s profile photo and selfie will appear here after they submit.'}</p><span className="review-empty-caption">{sessionOpen ? 'Check-in is open' : 'Check-in is closed'}</span></div> : records.map((record, index) => <article className={`identity-review ${index === activeIndex ? "is-current" : index < activeIndex ? "is-before" : "is-after"}`} data-review-id={record.id} key={record.id} onFocusCapture={() => setActiveId(record.id)} aria-label={`Review ${record.studentName}, roll ${record.studentClassRollNumber || 'not set'}`}>
          <div className="review-card-layout">
            <aside className="review-student-details"><span className="review-card-position">Student {String(index + 1).padStart(2, '0')}</span><h2>{record.studentName}</h2><p className="review-usn">{record.studentRollNumber}</p><dl><div><dt>Roll no.</dt><dd>{record.studentClassRollNumber || '—'}</dd></div><div><dt>Section</dt><dd>{record.studentSection || '—'}</dd></div></dl><span className="review-student-state">{preview ? 'Design preview' : 'Awaiting review'}</span><time dateTime={record.submittedAt}>{new Date(record.submittedAt).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</time></aside>
            <div className="review-student-images">
          <div className="review-photo-pair"><figure><figcaption>{preview ? "Sample profile" : "Profile photo"}</figcaption><div><button className="review-photo-expand" aria-label={`Enlarge profile and selfie for ${record.studentName}`} onClick={() => setPhotoRecord(record)}><ReviewPhoto key={record.studentAvatarUrl} src={record.studentAvatarUrl} alt={`Registered profile photo of ${record.studentName}`}/></button></div></figure><figure><figcaption>{preview ? "Sample selfie" : "Attendance selfie"}</figcaption><div><button className="review-photo-expand" aria-label={`Enlarge selfie and profile for ${record.studentName}`} onClick={() => setPhotoRecord(record)}><ReviewPhoto key={record.verificationPhotoUrl} src={record.verificationPhotoUrl} alt={`Attendance selfie of ${record.studentName}`}/></button></div></figure></div>
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
    {photoRecord && <Dialog title={photoRecord.studentName} subtitle="Photo comparison" onClose={() => setPhotoRecord(null)}><div className="review-photo-pair expanded-review-photos"><figure><figcaption>Profile photo</figcaption><div><ReviewPhoto src={photoRecord.studentAvatarUrl} alt={`Registered profile photo of ${photoRecord.studentName}`}/></div></figure><figure><figcaption>Attendance selfie</figcaption><div><ReviewPhoto src={photoRecord.verificationPhotoUrl} alt={`Attendance selfie of ${photoRecord.studentName}`}/></div></figure></div><p className="review-dialog-copy">{photoRecord.studentRollNumber} · Roll {photoRecord.studentClassRollNumber || '—'} · Section {photoRecord.studentSection || '—'}</p></Dialog>}
    {records.length > 1 && <label className="review-jump"><span>Jump to student</span><select value={records[activeIndex]?.id || ''} onChange={event => goTo(records.findIndex(record => record.id === event.target.value))}>{records.map(record => <option key={record.id} value={record.id}>{record.studentName} · Roll {record.studentClassRollNumber || '—'}</option>)}</select></label>}
  </div>;
}
