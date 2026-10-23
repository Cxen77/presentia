import { useEffect, useState, type FormEvent } from 'react';
import type { ClassItem } from '../types';
import { Dialog, InlineError } from '../components/ui/PortalUI';
import {
  getManagedPeople,
  updateClass,
  type ManagedPerson,
} from '../services/api';
import { useAuth } from '../context/AuthContext';
export function EditClassDialog({
  classItem,
  onClose,
  onSaved,
}: {
  classItem: ClassItem;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { user } = useAuth();
  const [form, setForm] = useState({
    courseCode: classItem.courseCode,
    className: classItem.className,
    department: classItem.department,
    semester: classItem.semester,
    room: classItem.room,
    startTime: classItem.startTime,
    endTime: classItem.endTime,
    classType: classItem.classType,
    credits: classItem.credits,
    description: classItem.description || '',
    facultyId: classItem.facultyId,
    isActive: classItem.isActive,
  });
  const [faculty, setFaculty] = useState<ManagedPerson[]>([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (user?.role === 'admin')
      void getManagedPeople()
        .then((people) =>
          setFaculty(people.filter((p) => p.role === 'faculty')),
        )
        .catch((e) => setError(e.message));
  }, [user?.role]);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await updateClass(classItem.id, form);
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save class.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog
      title="Edit class"
      subtitle={classItem.courseCode}
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <form onSubmit={submit} className="space-y-4">
        <InlineError message={error} />
        <div className="field-grid">
          {[
            ['courseCode', 'Course code'],
            ['className', 'Class name'],
            ['department', 'Department'],
            ['semester', 'Semester / section'],
            ['room', 'Room'],
          ].map(([key, label]) => (
            <label className="field" key={key}>
              {label}
              <input
                required
                value={String(form[key as keyof typeof form])}
                onChange={(e) => setForm({ ...form, [key]: e.target.value })}
              />
            </label>
          ))}
          <label className="field">
            Start time
            <input
              type="time"
              required
              value={form.startTime}
              onChange={(e) => setForm({ ...form, startTime: e.target.value })}
            />
          </label>
          <label className="field">
            End time
            <input
              type="time"
              required
              value={form.endTime}
              onChange={(e) => setForm({ ...form, endTime: e.target.value })}
            />
          </label>
          <label className="field">
            Credits
            <input
              type="number"
              min="1"
              max="10"
              required
              value={form.credits}
              onChange={(e) =>
                setForm({ ...form, credits: Number(e.target.value) })
              }
            />
          </label>
          <label className="field">
            Class type
            <select
              value={form.classType}
              onChange={(e) =>
                setForm({
                  ...form,
                  classType: e.target.value as typeof form.classType,
                })
              }
            >
              <option>Theory</option>
              <option>Practical</option>
              <option>Seminar</option>
            </select>
          </label>
          {user?.role === 'admin' && (
            <label className="field">
              Assigned faculty
              <select
                required
                value={form.facultyId}
                onChange={(e) =>
                  setForm({ ...form, facultyId: e.target.value })
                }
              >
                {faculty.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} · {p.loginId}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
        <label className="field">
          Description
          <textarea
            maxLength={500}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </label>
        <label className="flex gap-2 items-center text-xs text-slate-300">
          <input
            type="checkbox"
            checked={form.isActive}
            onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
          />
          Class active
        </label>
        <button type="submit" disabled={busy} className="p-button">
          {busy ? 'Saving…' : 'Save class'}
        </button>
      </form>
    </Dialog>
  );
}
