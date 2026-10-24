import { useState, type FormEvent } from 'react';
import { ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { changeInitialPassword } from '../services/api';
import { supabase } from '../services/supabase';
import { establishPasswordSession } from '../services/sessionRecovery';
export function InitialPasswordPage() {
  const { user, refreshUser, logout } = useAuth();
  const [password, setPassword] = useState(''),
    [confirm, setConfirm] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setBusy(true);
    try {
      if(!user?.email)throw new Error('Sign in again before setting your password.');
      await establishPasswordSession(supabase.auth,user.email,password,changeInitialPassword);
      setPassword('');
      setConfirm('');
      await refreshUser();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'Could not update your password.',
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="login-layout">
      <form onSubmit={submit} className="panel p-6 w-full max-w-sm space-y-4">
        <ShieldCheck className="text-indigo-300" size={28} />
        <div>
          <h1 className="text-xl font-semibold">Set your own password</h1>
          <p className="text-xs text-slate-400 mt-2">
            {user?.email}
            <br />
            Replace your initial credentials before opening the workspace.
          </p>
        </div>
        {error && (
          <p role="alert" className="text-xs text-red-300">
            {error}
          </p>
        )}
        <label className="field">
          New password
          <input
            required
            type="password"
            minLength={12}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <span className="field-note">
            At least 12 characters, including letters and numbers.
          </span>
        </label>
        <label className="field">
          Confirm new password
          <input
            required
            type="password"
            minLength={12}
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </label>
        <button disabled={busy} className="p-button w-full" type="submit">
          {busy ? 'Updating…' : 'Save password & continue'}
        </button>
        <button
          type="button"
          className="p-button ghost w-full"
          onClick={() => void logout()}
        >
          Sign out
        </button>
      </form>
    </div>
  );
}
