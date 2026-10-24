import { useState, type FormEvent } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { BadgeCheck, Check, Mail, ShieldCheck, UserRound } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { saveStaffProfile } from '../services/api';
import { InlineError, PageHeading } from '../components/ui/PortalUI';
import { Stagger, StaggerItem } from '../components/ui/Motion';
import { easeOut } from '../components/ui/motionEase';
import { notify } from '../services/toast';

export function StaffProfilePage() {
  const { user, refreshUser } = useAuth();
  const [name, setName] = useState(user?.name || ''),
    [department, setDepartment] = useState(user?.department || ''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null),
    [savedPulse, setSavedPulse] = useState(false);
  const unchanged = name === (user?.name || '') && department === (user?.department || '');
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSavedPulse(false);
    try {
      await saveStaffProfile({ fullName: name, department });
      await refreshUser();
      setSavedPulse(true);
      notify.success('Profile updated', 'Your details were saved.');
      setTimeout(() => setSavedPulse(false), 2600);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save profile.');
    } finally {
      setBusy(false);
    }
  };
  const facts = [
    { icon: Mail, label: 'Email', value: user?.email || '—' },
    { icon: BadgeCheck, label: 'Login ID', value: user?.loginId || '—' },
    { icon: ShieldCheck, label: 'Access', value: user?.role === 'admin' ? 'Administrator' : 'Faculty' },
  ];
  return (
    <div className="page-stack profile-page">
      <PageHeading
        title="My profile"
        description="Manage your name and department. Your account role is controlled by the administrator."
      />
      <Stagger className="panel profile-card" gap={0.07}>
        <StaggerItem>
          <div className="profile-head">
            <span className="profile-avatar" aria-hidden="true">{user?.name?.slice(0, 1).toUpperCase() || 'F'}</span>
            <div className="profile-head-text">
              <h2>{user?.name || 'Faculty'}</h2>
              <span className="role-chip">{user?.role === 'admin' ? <ShieldCheck size={13} /> : <UserRound size={13} />}{user?.role === 'admin' ? 'Administrator' : 'Faculty'}</span>
            </div>
          </div>
          <dl className="profile-meta">
            {facts.map(({ icon: Icon, label, value }) =>
              <div className="profile-fact" key={label}><dt><Icon size={14} aria-hidden="true" />{label}</dt><dd>{value}</dd></div>)}
          </dl>
        </StaggerItem>
        <StaggerItem>
          <form onSubmit={submit} className="profile-form">
            <InlineError message={error} />
            <div className="profile-fields">
              <label className="field">Full name<input required minLength={2} maxLength={100} value={name} onChange={(e) => setName(e.target.value)} /></label>
              <label className="field">Department<input required minLength={2} maxLength={100} value={department} onChange={(e) => setDepartment(e.target.value)} /></label>
            </div>
            <div className="profile-form-foot">
              <AnimatePresence mode="wait" initial={false}>
                <motion.span key={savedPulse ? 'saved' : unchanged ? 'clean' : 'dirty'} className="profile-save-state"
                  initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.2, ease: easeOut }}>
                  {savedPulse ? <><Check size={14} />Saved</> : unchanged ? 'All changes saved' : 'Unsaved changes'}
                </motion.span>
              </AnimatePresence>
              <button disabled={busy || unchanged} className="p-button" type="submit">
                {busy ? 'Saving…' : 'Save profile'}
              </button>
            </div>
          </form>
        </StaggerItem>
      </Stagger>
    </div>
  );
}
