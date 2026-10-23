import { useEffect,useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, BookOpen, CalendarClock, Check, KeyRound } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { attendanceDataService } from '../services/attendanceDataService';
import { Disclosure, InlineError, PageHeading } from '../components/ui/PortalUI';
import {getManagedPeople,type ManagedPerson} from '../services/api';
export function CreateClassPage() {
  const { user } = useAuth(); const navigate = useNavigate();
  const [step, setStep] = useState(1); const [submitting, setSubmitting] = useState(false); const [error, setError] = useState<string | null>(null);
  const [faculty,setFaculty]=useState<ManagedPerson[]>([]),[facultyId,setFacultyId]=useState('');
  useEffect(()=>{if(user?.role==='admin')void getManagedPeople().then(people=>setFaculty(people.filter(p=>p.role==='faculty'))).catch(e=>setError(e.message));},[user?.role]);
  const [form, setForm] = useState({ courseCode:'', className:'', department:user?.department || '', semester:'', room:'', startTime:'', endTime:'', classType:'Theory' as 'Theory'|'Practical'|'Seminar', credits:4, description:'' });
  const update = (key: keyof typeof form, value: string | number) => setForm(previous => ({ ...previous, [key]:value }));
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setError(null);
    if (step === 1) { setStep(2); return; }
    if (!user) { setError('Please sign in before creating a class.'); return; }
    if(user.role==='admin'&&!facultyId){setError('Assign this class to a faculty account.');return;}
    if (form.endTime <= form.startTime) { setError('End time must be later than start time.'); return; }
    setSubmitting(true);
    try {
      await attendanceDataService.createClass({ ...form, courseCode:form.courseCode.trim().toUpperCase(), className:form.className.trim(), department:form.department.trim(), semester:form.semester.trim(), room:form.room.trim(), facultyId:user.role==='admin'?facultyId:user.id, facultyName:user.name });
      navigate('/classes');
    } catch (err) { setError(err instanceof Error ? err.message : 'Unable to create the class. Please try again.'); }
    finally { setSubmitting(false); }
  };
  return <div className="page-stack"><PageHeading eyebrow="TEACHING" title="Create a class" description="Start with the essentials. You can share the enrollment code once it’s ready."
    action={<Link className="p-button ghost small" to="/classes"><ArrowLeft size={13} />Back to classes</Link>} />
    <div className="form-layout"><form className="form-body" onSubmit={submit}>
      <div className="form-steps" aria-label="Class creation progress"><span className={step === 1 ? 'current' : 'complete'} aria-current={step === 1 ? 'step' : undefined}><span>{step > 1 ? <Check size={12} /> : '1'}</span>Course details</span><div /><span className={step === 2 ? 'current' : ''} aria-current={step === 2 ? 'step' : undefined}><span>2</span>Schedule & finish</span></div>
      <InlineError message={error} />
      {user?.role==='admin'&&<label className="field panel p-4">Assigned faculty<select required value={facultyId} onChange={e=>setFacultyId(e.target.value)}><option value="">Choose faculty…</option>{faculty.map(person=><option key={person.id} value={person.id}>{person.name} · {person.loginId}</option>)}</select></label>}
      {step === 1 ? <section className="panel form-section"><h2 className="section-heading"><BookOpen />Course details</h2><div className="field-grid">
        <label className="field" htmlFor="course-code">Course code<input id="course-code" required minLength={2} maxLength={20} placeholder="e.g. CS201" value={form.courseCode} onChange={e => update('courseCode',e.target.value.toUpperCase())} autoFocus /></label>
        <label className="field" htmlFor="class-type">Class type<select id="class-type" value={form.classType} onChange={e => update('classType',e.target.value)}><option>Theory</option><option>Practical</option><option>Seminar</option></select></label>
        <label className="field col-span-2" htmlFor="class-name">Class name<input id="class-name" required minLength={2} maxLength={100} placeholder="e.g. Data Structures" value={form.className} onChange={e => update('className',e.target.value)} /></label>
        <label className="field" htmlFor="department">Department<input id="department" required minLength={2} maxLength={100} value={form.department} onChange={e => update('department',e.target.value)} /></label>
        <label className="field" htmlFor="semester">Semester / section<input id="semester" required minLength={2} maxLength={50} placeholder="e.g. Semester 3 · Section A" value={form.semester} onChange={e => update('semester',e.target.value)} /></label>
      </div></section> : <><section className="panel form-section"><h2 className="section-heading"><CalendarClock />Schedule & location</h2><div className="field-grid">
        <label className="field col-span-2" htmlFor="room">Room / venue<input id="room" required maxLength={100} placeholder="e.g. Room 305" value={form.room} onChange={e => update('room',e.target.value)} autoFocus /></label>
        <label className="field" htmlFor="start-time">Start time<input id="start-time" type="time" required value={form.startTime} onChange={e => update('startTime',e.target.value)} /></label>
        <label className="field" htmlFor="end-time">End time<input id="end-time" type="time" required value={form.endTime} onChange={e => update('endTime',e.target.value)} /></label>
      </div></section><Disclosure title="Additional details" description="Credits and an optional course description"><div className="field-grid">
        <label className="field" htmlFor="credits">Academic credits<input id="credits" type="number" min={1} max={10} value={form.credits} onChange={e => update('credits',Number(e.target.value))} /></label>
        <label className="field col-span-2" htmlFor="description">Description <span className="field-note">Optional · up to 500 characters</span><textarea id="description" rows={3} maxLength={500} placeholder="A short introduction to the course…" value={form.description} onChange={e => update('description',e.target.value)} /></label>
      </div></Disclosure></>}
      <div className="form-footer">{step === 1 ? <Link className="p-button secondary" to="/classes">Cancel</Link> : <button className="p-button secondary" type="button" disabled={submitting} onClick={() => { setStep(1); setError(null); }}><ArrowLeft size={13} />Back</button>}
        <button type="submit" className="p-button" disabled={submitting}>{submitting ? 'Creating…' : step === 1 ? 'Continue' : 'Create class'}{step === 1 ? <ArrowRight size={14} /> : <Check size={14} />}</button></div>
    </form><aside className="panel form-preview"><p className="eyebrow">CLASS PREVIEW</p><span className="course-badge">{form.courseCode || 'COURSE CODE'}</span><h2 className="preview-course">{form.className || 'Your class name'}</h2><p>{form.department || 'Department'}<br />{form.semester || 'Semester / section'}</p><div className="preview-rule" /><div className="flex items-center gap-2 mb-2"><KeyRound size={15} className="text-indigo-300" /><h2>Ready to share</h2></div><p>A unique enrollment code is created when you save. Find it by opening the class.</p></aside></div>
  </div>;
}
