import { useCallback, useEffect, useState, type FormEvent } from 'react';
import {
  Search,
  Pencil,
  KeyRound,
  UserPlus,
  Copy,
  ShieldCheck,
  Users,
  RefreshCw,
} from 'lucide-react';
import {
  Dialog,
  EmptyState,
  InlineError,
  PageHeading,
} from '../components/ui/PortalUI';
import {
  createFacultyAccount,
  getManagedPeople,
  getManagedStudents,
  resetFacultyPassword,
  saveManagedFaculty,
  saveManagedStudent,
  type ManagedPerson,
  type FacultyCredentials,
} from '../services/api';
import { supabase } from '../services/supabase';
export function PeoplePage({ admin = false }: { admin?: boolean }) {
  const [people, setPeople] = useState<ManagedPerson[]>([]),
    [tab, setTab] = useState<'faculty' | 'student'>('faculty'),
    [search, setSearch] = useState(''),
    [error, setError] = useState<string | null>(null),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<ManagedPerson | null>(null),
    [adding, setAdding] = useState(false),
    [credentials, setCredentials] = useState<FacultyCredentials | null>(null),
    [copied, setCopied] = useState(false);
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    department: '',
    rollNumber: '',
    semester: '',
  });
  const load = useCallback(async () => {
    try {
      setPeople(await (admin ? getManagedPeople() : getManagedStudents()));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load people.');
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
      p.role === (admin ? tab : 'student') &&
      `${p.name} ${p.email} ${p.loginId}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const edit = (person: ManagedPerson) => {
    setError(null);
    setEditing(person);
    setForm({
      fullName: person.name,
      email: person.email,
      department: person.department,
      rollNumber: person.loginId || '',
      semester: person.semester || '',
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
      } else if (editing?.role === 'faculty')
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
        });
      setEditing(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save account.');
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
      setError(e instanceof Error ? e.message : 'Could not reset credentials.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="page-stack">
      <PageHeading
        eyebrow={admin ? 'ADMINISTRATION' : 'YOUR CLASSES'}
        title={admin ? 'People & access' : 'Students'}
        description={
          admin
            ? 'Manage faculty access and student records. The administrator role is reserved for the single owner.'
            : 'Edit details for students enrolled in classes you manage.'
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
                    fullName: '',
                    email: '',
                    department: '',
                    rollNumber: '',
                    semester: '',
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
              ['Faculty', people.filter((p) => p.role === 'faculty').length],
              ['Students', people.filter((p) => p.role === 'student').length],
              [
                'Administrator',
                people.filter((p) => p.role === 'admin').length,
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
              className={`p-button small ${tab === 'faculty' ? '' : 'secondary'}`}
              onClick={() => setTab('faculty')}
            >
              Faculty
            </button>
            <button
              className={`p-button small ${tab === 'student' ? '' : 'secondary'}`}
              onClick={() => setTab('student')}
            >
              Students
            </button>
          </div>
        </>
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
                ? 'Add a faculty account or adjust your search.'
                : 'Students will appear after enrolling in your classes.'
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
                  <th className="p-4">Department</th>
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
                      {p.loginId || '—'}
                    </td>
                    <td className="p-4 text-slate-400">{p.department}</td>
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
                        {admin && p.role === 'faculty' && (
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
          title={adding ? 'Add faculty' : `Edit ${editing?.name}`}
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
            {editing?.role === 'student' && (
              <div className="field-grid">
                <label className="field">
                  USN / Roll number
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
                ? 'Saving…'
                : adding
                  ? 'Create faculty account'
                  : 'Save details'}
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
                ['Email', credentials.email],
                ['Faculty ID', credentials.loginId],
                ['Initial password', credentials.temporaryPassword],
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
                  ? 'A confirmation code was sent to the faculty inbox.'
                  : 'The account was created, but the confirmation email could not be sent yet.'}
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
                    setError('Select and copy the credentials manually.');
                  }
                }}
              >
                <Copy size={13} />
                {copied ? 'Copied' : 'Copy credentials'}
              </button>
              <button
                className="p-button secondary small"
                onClick={async () => {
                  const { error } = await supabase.auth.resend({
                    type: 'signup',
                    email: credentials.email,
                  });
                  if (error) setError(error.message);
                  else setError('Confirmation email sent.');
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
