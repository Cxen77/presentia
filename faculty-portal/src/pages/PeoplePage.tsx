import { DeviceManagement } from '../components/DeviceManagement';
import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  Search,
  Pencil,
  KeyRound,
  UserPlus,
  Copy,
  ShieldCheck,
  Users,
  RefreshCw,
  Trash2,
  RotateCcw,
  MoreHorizontal,
  ChevronRight,
  BookOpen,
} from "lucide-react";
import {
  Dialog,
  EmptyState,
  InlineError,
  PageHeading,
} from "../components/ui/PortalUI";
import {
  createFacultyAccount,
  deleteFaculty,
  restoreFaculty,
  getManagedPeople,
  getManagedStudents,
  resetFacultyPassword,
  saveManagedFaculty,
  saveManagedStudent,
  type ManagedPerson,
  type FacultyCredentials,
} from "../services/api";
import { supabase } from "../services/supabase";
export function PeoplePage({ admin = false }: { admin?: boolean }) {
  const [people, setPeople] = useState<ManagedPerson[]>([]),
    [tab, setTab] = useState<"faculty" | "student">("faculty"),
    [search, setSearch] = useState(""),
    [error, setError] = useState<string | null>(null),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [showDeleted, setShowDeleted] = useState(false);
  const [editing, setEditing] = useState<ManagedPerson | null>(null),
    [adding, setAdding] = useState(false),
    [credentials, setCredentials] = useState<FacultyCredentials | null>(null),
    [copied, setCopied] = useState(false);
  const [deviceStudent,setDeviceStudent]=useState<ManagedPerson|null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [section, setSection] = useState("");
  const studentView = !admin || tab === "student";
  const sections = [...new Set(people.filter(p => p.role === "student" && !p.archivedAt).map(p => p.section).filter((value): value is string => !!value))].sort((a,b) => a.localeCompare(b, "en", {numeric:true}));
  const [actionsFor, setActionsFor] = useState<ManagedPerson | null>(null);
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    department: "",
    rollNumber: "",
    semester: "",
    classRollNumber: "",
    section: "",
  });
  const load = useCallback(async () => {
    try {
      setPeople(await (admin ? getManagedPeople() : getManagedStudents()));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load people.");
    } finally {
      setLoading(false);
    }
  }, [admin]);
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    if (!credentials) return;
    const timer = setTimeout(() => setCredentials(null), 180000);
    return () => clearTimeout(timer);
  }, [credentials]);
  const shown = people.filter(
    (p) =>
      p.role === (admin ? tab : "student") &&
      !!p.archivedAt === showDeleted &&
      (!studentView || !section || p.section === section) &&
      `${p.name} ${p.email} ${p.loginId} ${p.classRollNumber || ""} ${p.section || ""} ${(p.classes || []).map((c) => c.name + " " + c.code).join(" ")}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  shown.sort((a, b) =>
    (a.classRollNumber || a.loginId || "").localeCompare(
      b.classRollNumber || b.loginId || "",
      "en",
      { numeric: true, sensitivity: "base" },
    ),
  );
  const removeFaculty = async (person: ManagedPerson) => {
    if (
      !window.confirm(
        `Delete faculty access for ${person.name}? They will be blocked from the portal. Reassign or delete their active classes first. Existing attendance history is retained; an admin can restore access.`,
      )
    )
      return;
    setBusy(true);
    try {
      await deleteFaculty(person.id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete faculty.");
    } finally {
      setBusy(false);
    }
  };
  const restore = async (person: ManagedPerson) => {
    setBusy(true);
    try {
      await restoreFaculty(person.id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not restore faculty.");
    } finally {
      setBusy(false);
    }
  };
  const edit = (person: ManagedPerson) => {
    setError(null);
    setEditing(person);
    setForm({
      fullName: person.name,
      email: person.email,
      department: person.department,
      rollNumber: person.loginId || "",
      semester: person.semester || "",
      classRollNumber: person.classRollNumber || "",
      section: person.section || "",
    });
  };
  const save = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (adding) {
        const result = await createFacultyAccount({
          fullName: form.fullName,
          department: form.department,
          email: form.email,
        });
        setAdding(false);
        setCredentials(result);
      } else if (editing?.role === "faculty")
        await saveManagedFaculty(editing.id, {
          fullName: form.fullName,
          department: form.department,
        });
      else if (editing)
        await saveManagedStudent(editing.id, {
          fullName: form.fullName,
          department: form.department,
          rollNumber: form.rollNumber,
          semester: form.semester,
          classRollNumber: form.classRollNumber,
          section: form.section,
        });
      setEditing(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save account.");
    } finally {
      setBusy(false);
    }
  };
  const reset = async (person: ManagedPerson) => {
    if (
      !window.confirm(
        `Issue a new initial password for ${person.name}? Their current password will stop working and they must choose a new one.`,
      )
    )
      return;
    setBusy(true);
    try {
      setCredentials(await resetFacultyPassword(person.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not reset credentials.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="page-stack register-page">
      <PageHeading
        eyebrow={admin ? "ADMINISTRATION" : "YOUR CLASSES"}
        title={admin ? "People & access" : "Students"}
        description={
          admin
            ? "Manage faculty access and student records. The administrator role is reserved for the single owner."
            : "Your class register. Select a student for details."
        }
        action={
          <div className="flex gap-2">
            <button
              className="p-button secondary small"
              onClick={() => void load()}
            >
              <RefreshCw size={13} />
              Refresh
            </button>
            {admin && (
              <button
                className="p-button small"
                onClick={() => {
                  setAdding(true);
                  setError(null);
                  setForm({
                    fullName: "",
                    email: "",
                    department: "",
                    rollNumber: "",
                    semester: "",
                    classRollNumber: "",
                    section: "",
                  });
                }}
              >
                <UserPlus size={14} />
                Add faculty
              </button>
            )}
          </div>
        }
      />
      <InlineError message={!editing && !adding ? error : null} />
      <section className="directory-controls">
        {admin && <div className="directory-tabs" aria-label="Account type">
          {(["faculty", "student"] as const).map(kind => <button key={kind} className={tab === kind ? "is-selected" : ""} aria-pressed={tab === kind} onClick={() => {setTab(kind);setShowDeleted(false);setSection("");setExpandedId(null);}}>
            {kind === "faculty" ? "Faculty" : "Students"}<span>{people.filter(p => p.role === kind && !p.archivedAt).length}</span>
          </button>)}
          <span className="directory-owner"><ShieldCheck size={13}/> {people.filter(p => p.role === "admin").length} administrator</span>
        </div>}
        <div className="directory-toolbar">
          <label className="search-field"><Search size={16}/><input aria-label="Search people" placeholder={studentView ? "Find a student by name or USN…" : "Find faculty by name or ID…"} value={search} onChange={e => setSearch(e.target.value)}/></label>
          {admin && tab === "faculty" && <label className="archive-filter"><input type="checkbox" checked={showDeleted} onChange={e => setShowDeleted(e.target.checked)}/> Show deleted faculty</label>}
          {studentView && sections.length > 0 && <label className="section-filter"><span className="sr-only">Filter by section</span><select aria-label="Filter by section" value={section} onChange={e => {setSection(e.target.value);setExpandedId(null);}}><option value="">All sections</option>{sections.map(value => <option key={value} value={value}>Section {value}</option>)}</select></label>}
          <span className="directory-count" role="status">{loading ? "Loading…" : `${shown.length} ${studentView ? (shown.length === 1 ? "student" : "students") : (shown.length === 1 ? "faculty member" : "faculty members")}`}</span>
        </div>
      </section>
      {loading ? (
        <div className="panel p-6 text-sm text-slate-400">
          Loading accounts…
        </div>
      ) : !shown.length ? (
        <section className="panel">
          <EmptyState
            icon={Users}
            title={studentView ? "No matching students" : "No matching faculty"}
            description={
              search || section ? "Try another name or ID, or clear your filters." : admin
                ? "Add a faculty account or adjust your search."
                : "Students will appear after enrolling in your classes."
            }
            action={search || section ? <button className="p-button secondary small" onClick={() => {setSearch("");setSection("");}}>Clear search and filters</button> : undefined}
          />
        </section>
      ) : (
        <section className="class-register" aria-label={studentView ? "Student register" : "Faculty directory"}>
          <div className="register-columns" aria-hidden="true"><span>{studentView ? "Student" : "Faculty member"}</span><span>{studentView ? "Roll" : "Department"}</span><span>{studentView ? "Section" : "Access"}</span><span/></div>
          <ul className="register-list">
            {shown.map(p => {
              const expanded = expandedId === p.id;
              const detailsId = `person-${p.id}`;
              return <li key={p.id} className={`register-entry ${expanded ? "is-expanded" : ""}`}>
                <div className="register-row">
                  <button className="register-summary" aria-label={`Details for ${p.name}${p.role === "student" ? `, USN ${p.loginId || "not set"}, roll ${p.classRollNumber || "not set"}, section ${p.section || "not set"}` : ""}`} aria-expanded={expanded} aria-controls={detailsId} onClick={() => setExpandedId(expanded ? null : p.id)}>
                    <span className="register-identity"><span className="register-avatar" aria-hidden="true">{p.name.slice(0,1).toUpperCase()}</span><span className="register-name"><strong>{p.name}</strong><small>{p.loginId || p.email}</small></span></span>
                    <span className="register-roll" title={studentView ? `Roll ${p.classRollNumber || "not set"}` : p.department}>{studentView ? p.classRollNumber || "—" : p.department || "—"}</span>
                    <span className="register-section">{studentView ? p.section || "—" : p.archivedAt ? "Deleted" : "Active"}</span>
                    <ChevronRight className="register-chevron" size={15}/>
                  </button>
                  {admin && p.role === "faculty" && <button className="icon-button register-more" aria-label={`More actions for ${p.name}`} disabled={busy} onClick={() => setActionsFor(p)}><MoreHorizontal size={17}/></button>}
                </div>
                <div id={detailsId} className="register-reveal" aria-hidden={!expanded} inert={!expanded}>
                  <div className="register-reveal-inner">
                    <div className="register-detail-bar"><span>{p.name}<small>{p.role === "student" ? "Student details" : "Faculty details"}</small></span><button className="p-button secondary small" onClick={() => edit(p)} aria-label={`Edit ${p.name}`}><Pencil size={12}/>Edit details</button></div>
                    <dl className="register-facts"><div><dt>Email</dt><dd>{p.email}</dd></div><div><dt>Department</dt><dd>{p.department || "—"}</dd></div>{p.role === "student" && <><div><dt>University USN</dt><dd>{p.loginId || "—"}</dd></div><div><dt>Roll / section</dt><dd>{p.classRollNumber || "—"} / {p.section || "—"}</dd></div><div><dt>Semester</dt><dd>{p.semester || "—"}</dd></div></>}</dl>
                    {p.role === "student" && <div className="register-memberships"><h3><BookOpen size={13}/> Enrolled classes <span>{p.classes?.length || 0}</span></h3>{p.classes?.length ? <ul>{p.classes.map(c => <li key={c.id}><span>{c.code}</span><strong>{c.name}</strong><small>{c.semester}</small></li>)}</ul> : <p>No active class enrollments.</p>}</div>}
                    {admin && p.role==="student" && <button className="p-button secondary small" onClick={()=>setDeviceStudent(p)}>Manage devices</button>}
                    {p.archivedAt && <button className="p-button secondary small" disabled={busy} onClick={() => void restore(p)}><RotateCcw size={12}/>Restore faculty access</button>}
                  </div>
                </div>
              </li>;
            })}
          </ul>
          <div className="register-footnote">{studentView ? "Sorted by roll number" : "Select a faculty member to view details"}<span>{studentView ? "Select a row to view details" : "Account access is managed by the administrator"}</span></div>
        </section>
      )}
      {admin && deviceStudent && <DeviceManagement student={deviceStudent} students={people.filter(p=>p.role==="student"&&!p.archivedAt)} onClose={()=>setDeviceStudent(null)}/>}
      {actionsFor && <Dialog title={`Actions for ${actionsFor.name}`} onClose={() => setActionsFor(null)}>
        <div className="account-actions">
          {actionsFor.archivedAt ? <button disabled={busy} onClick={() => {const person=actionsFor;setActionsFor(null);void restore(person);}}><RotateCcw size={18}/><span><strong>Restore faculty access</strong><small>Allow this faculty member to sign in again.</small></span></button> : <>
          <button onClick={() => {const person=actionsFor;setActionsFor(null);void reset(person);}}><KeyRound size={18}/><span><strong>Issue new password</strong><small>Replace their current password with a new initial password.</small></span></button>
          <button className="destructive-action" onClick={() => {const person=actionsFor;setActionsFor(null);void removeFaculty(person);}}><Trash2 size={18}/><span><strong>Delete faculty access</strong><small>Block portal access while retaining attendance history.</small></span></button>
          </>}
        </div>
      </Dialog>}
      {(adding || editing) && (
        <Dialog
          title={adding ? "Add faculty" : `Edit ${editing?.name}`}
          onClose={() => {
            if (!busy) {
              setAdding(false);
              setEditing(null);
            }
          }}
        >
          <form onSubmit={save} className="space-y-4">
            <InlineError message={error} />
            <label className="field">
              Full name
              <input
                required
                minLength={2}
                maxLength={100}
                value={form.fullName}
                onChange={(e) => setForm({ ...form, fullName: e.target.value })}
              />
            </label>
            <label className="field">
              Email
              <input
                type="email"
                required
                disabled={!adding}
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </label>
            <label className="field">
              Department
              <input
                required
                minLength={2}
                maxLength={100}
                value={form.department}
                onChange={(e) =>
                  setForm({ ...form, department: e.target.value })
                }
              />
            </label>
            {editing?.role === "student" && (
              <div className="field-grid">
                <label className="field">
                  Class roll number
                  <input
                    maxLength={20}
                    value={form.classRollNumber}
                    onChange={(e) =>
                      setForm({ ...form, classRollNumber: e.target.value })
                    }
                  />
                </label>
                <label className="field">
                  Section
                  <input
                    maxLength={30}
                    value={form.section}
                    onChange={(e) =>
                      setForm({ ...form, section: e.target.value })
                    }
                  />
                </label>
                <label className="field">
                  University USN
                  <input
                    required
                    value={form.rollNumber}
                    onChange={(e) =>
                      setForm({ ...form, rollNumber: e.target.value })
                    }
                  />
                </label>
                <label className="field">
                  Semester
                  <input
                    required
                    value={form.semester}
                    onChange={(e) =>
                      setForm({ ...form, semester: e.target.value })
                    }
                  />
                </label>
              </div>
            )}
            {adding && (
              <p className="text-xs leading-relaxed text-slate-400">
                A unique faculty ID and initial password will be generated. The
                faculty member must confirm their email and choose their own
                password before portal access.
              </p>
            )}
            <button type="submit" disabled={busy} className="p-button">
              {busy
                ? "Saving…"
                : adding
                  ? "Create faculty account"
                  : "Save details"}
            </button>
          </form>
        </Dialog>
      )}
      {credentials && (
        <Dialog
          title="Initial login credentials"
          subtitle="VISIBLE ONCE · SHARE PRIVATELY"
          onClose={() => {
            setCredentials(null);
            setCopied(false);
          }}
        >
          <div className="space-y-4">
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 flex gap-2 text-xs text-emerald-200">
              <ShieldCheck size={17} />
              <p>
                These credentials disappear when this window closes. The user
                must set a new password on first access.
              </p>
            </div>
            <dl className="space-y-3">
              {[
                ["Email", credentials.email],
                ["Faculty ID", credentials.loginId],
                ["Initial password", credentials.temporaryPassword],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="text-[10px] text-slate-400 uppercase mb-1">
                    {label}
                  </dt>
                  <dd className="font-mono text-xs break-all select-all bg-slate-800/50 p-3 rounded-lg">
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
            {credentials.confirmationSent !== undefined && (
              <p className="text-xs text-slate-400">
                {credentials.confirmationSent
                  ? "A confirmation code was sent to the faculty inbox."
                  : "The account was created, but the confirmation email could not be sent yet."}
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <button
                className="p-button small"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(
                      `Email: ${credentials.email}\nFaculty ID: ${credentials.loginId}\nInitial password: ${credentials.temporaryPassword}`,
                    );
                    setCopied(true);
                  } catch {
                    setError("Select and copy the credentials manually.");
                  }
                }}
              >
                <Copy size={13} />
                {copied ? "Copied" : "Copy credentials"}
              </button>
              <button
                className="p-button secondary small"
                onClick={async () => {
                  const { error } = await supabase.auth.resend({
                    type: "signup",
                    email: credentials.email,
                  });
                  if (error) setError(error.message);
                  else setError("Confirmation email sent.");
                }}
              >
                Resend confirmation
              </button>
            </div>
            <InlineError message={error} />
          </div>
        </Dialog>
      )}
    </div>
  );
}
