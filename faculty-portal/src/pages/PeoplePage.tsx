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
    <div className="page-stack">
      <PageHeading
        eyebrow={admin ? "ADMINISTRATION" : "YOUR CLASSES"}
        title={admin ? "People & access" : "Students"}
        description={
          admin
            ? "Manage faculty access and student records. The administrator role is reserved for the single owner."
            : "Edit details for students enrolled in classes you manage."
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
      {admin && (
        <>
          <div className="stats-grid">
            {[
              ["Faculty", people.filter((p) => p.role === "faculty" && !p.archivedAt).length],
              ["Students", people.filter((p) => p.role === "student").length],
              [
                "Administrator",
                people.filter((p) => p.role === "admin").length,
              ],
            ].map(([label, count]) => (
              <div className="panel p-4" key={label}>
                <p className="text-xs text-slate-400">{label}</p>
                <p className="text-2xl font-semibold mt-2">{count}</p>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <button
              className={`p-button small ${tab === "faculty" ? "" : "secondary"}`}
              onClick={() => {
                setTab("faculty");
                setShowDeleted(false);
              }}
            >
              Faculty
            </button>
            <button
              className={`p-button small ${tab === "student" ? "" : "secondary"}`}
              onClick={() => {
                setTab("student");
                setShowDeleted(false);
              }}
            >
              Students
            </button>
          </div>
        </>
      )}
      {admin && tab === "faculty" && (
        <label className="text-xs text-slate-400 flex gap-2 items-center">
          <input
            type="checkbox"
            checked={showDeleted}
            onChange={(e) => setShowDeleted(e.target.checked)}
          />
          Show deleted faculty
        </label>
      )}
      <label className="search-field">
        <Search size={16} />
        <input
          aria-label="Search people"
          placeholder="Search name, ID or email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </label>
      {loading ? (
        <div className="panel p-6 text-sm text-slate-400">
          Loading accounts…
        </div>
      ) : !shown.length ? (
        <section className="panel">
          <EmptyState
            icon={Users}
            title="No matching accounts"
            description={
              admin
                ? "Add a faculty account or adjust your search."
                : "Students will appear after enrolling in your classes."
            }
          />
        </section>
      ) : (
        <div className="panel overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-800/40 text-slate-400">
                <tr>
                  <th className="p-4">Name</th>
                  <th className="p-4">ID / USN</th>
                  <th className="p-4">Roll / Section</th>
                  <th className="p-4">Department & classes</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {shown.map((p) => (
                  <tr key={p.id}>
                    <td className="p-4">
                      <p className="font-medium text-slate-100">{p.name}</p>
                      <p className="text-[11px] text-slate-400 mt-1">
                        {p.email}
                      </p>
                    </td>
                    <td className="p-4 font-mono text-indigo-200">
                      {p.loginId || "—"}
                    </td>
                    <td className="p-4 text-slate-400">
                      {p.role === "student" ? (
                        <>
                          <p>Roll {p.classRollNumber || "—"}</p>
                          <p className="mt-1 text-[10px]">
                            Section {p.section || "—"}
                          </p>
                        </>
                      ) : (
                        "Staff"
                      )}
                    </td>
                    <td className="p-4 text-slate-400">
                      {p.department}
                      <p className="text-[10px] mt-1">{p.semester}</p>
                      {p.role === "student" && (
                        <details className="mt-2">
                          <summary className="cursor-pointer text-indigo-200">
                            {p.classes?.length || 0} {p.classes?.length === 1 ? 'class' : 'classes'}
                          </summary>
                          <ul className="mt-2 space-y-2">
                            {p.classes?.map((c) => (
                              <li key={c.id}>
                                {c.code} · {c.name}
                                <span className="block text-[10px]">
                                  {c.semester}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </details>
                      )}
                    </td>
                    <td className="p-4">
                      <div className="flex gap-2 justify-end">
                        <button
                          className="p-button secondary small"
                          aria-label={`Edit ${p.name}`}
                          onClick={() => edit(p)}
                        >
                          <Pencil size={12} />
                          Edit
                        </button>
                        {admin &&
                          p.role === "faculty" &&
                          (p.archivedAt ? (
                            <button
                              disabled={busy}
                              className="p-button secondary small"
                              onClick={() => void restore(p)}
                            >
                              <RotateCcw size={12} />
                              Restore
                            </button>
                          ) : (
                            <button
                              disabled={busy}
                              className="p-button ghost small text-red-300"
                              aria-label={`Delete ${p.name}`}
                              onClick={() => void removeFaculty(p)}
                            >
                              <Trash2 size={12} />
                            </button>
                          ))}
                        {admin && p.role === "faculty" && !p.archivedAt && (
                          <button
                            disabled={busy}
                            className="p-button secondary small"
                            onClick={() => void reset(p)}
                          >
                            <KeyRound size={12} />
                            New password
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
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
