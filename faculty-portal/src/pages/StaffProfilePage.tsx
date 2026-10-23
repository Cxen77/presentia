import { useState, type FormEvent } from 'react';
import { useAuth } from '../context/AuthContext';
import { saveStaffProfile } from '../services/api';
import { InlineError, PageHeading } from '../components/ui/PortalUI';
export function StaffProfilePage() {
  const { user, refreshUser } = useAuth();
  const [name, setName] = useState(user?.name || ''),
    [department, setDepartment] = useState(user?.department || ''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null),
    [saved, setSaved] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      await saveStaffProfile({ fullName: name, department });
      await refreshUser();
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save profile.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="page-stack">
      <PageHeading
        title="My profile"
        description="Manage your name and department. Your account role is controlled by the administrator."
      />
      <form onSubmit={submit} className="panel p-5 max-w-xl space-y-4">
        <InlineError message={error} />
        <div className="detail-grid">
          <div>
            <dt>Email</dt>
            <dd>{user?.email}</dd>
          </div>
          <div>
            <dt>Login ID</dt>
            <dd>{user?.loginId}</dd>
          </div>
          <div>
            <dt>Access</dt>
            <dd>{user?.role === 'admin' ? 'Administrator' : 'Faculty'}</dd>
          </div>
        </div>
        <label className="field">
          Full name
          <input
            required
            minLength={2}
            maxLength={100}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label className="field">
          Department
          <input
            required
            minLength={2}
            maxLength={100}
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
          />
        </label>
        {saved && (
          <p role="status" className="text-xs text-emerald-300">
            Your profile was updated.
          </p>
        )}
        <button disabled={busy} className="p-button" type="submit">
          {busy ? 'Saving…' : 'Save profile'}
        </button>
      </form>
    </div>
  );
}
