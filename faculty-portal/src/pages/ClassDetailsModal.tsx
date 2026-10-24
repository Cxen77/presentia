import { useEffect, useState } from "react";
import { Copy, Check, RefreshCw, QrCode, Users } from "lucide-react";
import type { ClassItem, StudentProfile, GeofencePolicy } from "../types";
import { attendanceDataService } from "../services/attendanceDataService";
import { Dialog, Disclosure, InlineError } from "../components/ui/PortalUI";
import { removeEnrollment } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { GeofencePanel } from "../components/GeofencePanel";
interface Props {
  classItem: ClassItem;
  onClose: () => void;
  onStartAttendance: (classId: string) => Promise<void>;
}
export function ClassDetailsModal({
  classItem,
  onClose,
  onStartAttendance,
}: Props) {
  const { user } = useAuth();
  const [geofence, setGeofence] = useState<GeofencePolicy>(
    classItem.geofence || { enabled: false },
  );
  const [sectionFilter, setSectionFilter] = useState("ALL");
  const [tab, setTab] = useState<"details" | "students">("details");
  const [code, setCode] = useState(classItem.enrollmentCode);
  const [copied, setCopied] = useState(false);
  const [students, setStudents] = useState<StudentProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (tab !== "students") return;
    let disposed = false;
    setLoading(true);
    attendanceDataService
      .getEnrolledStudents(classItem.id)
      .then((roster) => {
        if (!disposed) setStudents(roster);
      })
      .catch((err) => {
        if (!disposed)
          setError(
            err instanceof Error ? err.message : "Unable to load roster.",
          );
      })
      .finally(() => {
        if (!disposed) setLoading(false);
      });
    return () => {
      disposed = true;
    };
  }, [classItem.id, tab]);
  const remove = async (student: StudentProfile) => {
    if (
      !window.confirm(
        `Remove ${student.fullName} from ${classItem.courseCode}? Their attendance history stays. They can join again using the enrollment code.`,
      )
    )
      return;
    setBusy(true);
    setError(null);
    try {
      await removeEnrollment(classItem.id, student.id);
      setStudents((current) => current.filter((p) => p.id !== student.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not remove student.");
    } finally {
      setBusy(false);
    }
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Could not copy the code. Select and copy it manually.");
    }
  };
  const regenerate = async () => {
    if (
      !window.confirm(
        "Generate a new enrollment code? Students already enrolled will stay in the class. The old code will stop working.",
      )
    )
      return;
    setBusy(true);
    setError(null);
    try {
      setCode(
        await attendanceDataService.regenerateEnrollmentCode(classItem.id),
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to regenerate code.",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog
      title={classItem.className}
      subtitle={classItem.courseCode}
      onClose={onClose}
      footer={
        <>
          <button className="p-button secondary" onClick={onClose}>
            Close
          </button>
          {user?.role === "faculty" && (
            <button
              className="p-button"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setError(null);
                try {
                  await onStartAttendance(classItem.id);
                } catch (err) {
                  setError(
                    err instanceof Error
                      ? err.message
                      : "Unable to start attendance.",
                  );
                } finally {
                  setBusy(false);
                }
              }}
            >
              <QrCode size={14} />
              {busy ? "Please wait…" : "Take attendance"}
            </button>
          )}
        </>
      }
    >
      <div className="flex gap-2" role="group" aria-label="Class view">
        <button
          className={`p-button small ${tab === "details" ? "" : "secondary"}`}
          aria-pressed={tab === "details"}
          onClick={() => setTab("details")}
        >
          Overview
        </button>
        <button
          className={`p-button small ${tab === "students" ? "" : "secondary"}`}
          aria-pressed={tab === "students"}
          onClick={() => setTab("students")}
        >
          <Users size={13} />
          Students {classItem.enrolledStudentsCount}
        </button>
      </div>
      <InlineError message={error} />
      {tab === "details" ? (
        <>
          <dl className="detail-grid">
            {[
              ["Department", classItem.department],
              ["Semester", classItem.semester],
              ["Room", classItem.room],
              ["Schedule", classItem.scheduleInfo],
              ["Class type", classItem.classType],
              ["Credits", String(classItem.credits)],
            ].map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value || "Not set"}</dd>
              </div>
            ))}
          </dl>
          <Disclosure
            title="Enrollment code"
            description="Share with students to join this class"
          >
            <div className="code-box">
              <div>
                <span className="text-[10px]">CLASS CODE</span>
                <code className="code-value">{code}</code>
              </div>
              <button className="p-button secondary small" onClick={copy}>
                {copied ? <Check size={13} /> : <Copy size={13} />}
                {copied ? "Copied" : "Copy code"}
              </button>
            </div>
            <button
              className="text-link mt-4"
              disabled={busy}
              onClick={regenerate}
            >
              <RefreshCw size={12} />
              Generate a new code
            </button>
          </Disclosure>
          {classItem.description && (
            <Disclosure title="Course description">
              <p>{classItem.description}</p>
            </Disclosure>
          )}
          <Disclosure
            title="Campus check-in area"
            description={
              geofence.enabled
                ? "Campus restriction enabled"
                : "Set a campus centre and radius"
            }
          >
            <GeofencePanel
              classItem={{ ...classItem, geofence }}
              onSaved={setGeofence}
            />
          </Disclosure>
        </>
      ) : loading ? (
        <p className="text-xs text-slate-400" role="status">
          Loading students…
        </p>
      ) : !students.length ? (
        <div className="py-6 text-center">
          <Users size={24} className="mx-auto mb-3 text-slate-500" />
          <h3 className="text-sm">No students enrolled yet</h3>
          <p className="mt-2 text-xs text-slate-400">
            Share the enrollment code from the Overview tab.
          </p>
        </div>
      ) : (
        <>
          <div className="flex justify-between items-center gap-2">
            <p className="text-[11px] text-slate-400">
              Sorted by class roll number
            </p>
            <label className="text-xs text-slate-400">
              Section{" "}
              <select
                className="filter-select"
                value={sectionFilter}
                onChange={(e) => setSectionFilter(e.target.value)}
              >
                <option value="ALL">All sections</option>
                {[...new Set(students.map((p) => p.section || "Not set"))]
                  .sort()
                  .map((section) => (
                    <option key={section}>{section}</option>
                  ))}
              </select>
            </label>
          </div>
          <div className="roster-list">
            {students
              .filter(
                (student) =>
                  sectionFilter === "ALL" ||
                  (student.section || "Not set") === sectionFilter,
              )
              .map((student) => (
                <div className="roster-row" key={student.id}>
                  <div className="avatar-initial text-xs">
                    {student.classRollNumber || student.fullName.slice(0, 1)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium">{student.fullName}</p>
                    <p className="text-[10px] text-slate-400 mt-1">
                      {student.rollNumber} · Roll{" "}
                      {student.classRollNumber || "—"} · Section{" "}
                      {student.section || "—"}
                    </p>
                    <p className="truncate text-[10px] text-slate-500 mt-1">
                      {student.degree} · {student.semester}
                    </p>
                  </div>
                  <button
                    className="p-button ghost small text-red-300"
                    aria-label={`Remove ${student.fullName} from class`}
                    disabled={busy}
                    onClick={() => void remove(student)}
                  >
                    Remove
                  </button>
                </div>
              ))}
          </div>
        </>
      )}
    </Dialog>
  );
}
