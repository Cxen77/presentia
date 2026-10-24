import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  BookOpen,
  Search,
  Plus,
  Users,
  MapPin,
  SlidersHorizontal,
  ArrowUpRight,
  Clock,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { attendanceDataService } from "../services/attendanceDataService";
import type { ClassItem } from "../types";
import { ClassDetailsModal } from "./ClassDetailsModal";
import { deleteClass, updateClass } from "../services/api";
import { EditClassDialog } from "./EditClassDialog";
import {
  EmptyState,
  InlineError,
  PageHeading,
} from "../components/ui/PortalUI";

export function ClassesPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [search, setSearch] = useState("");
  const [type, setType] = useState("ALL");
  const [filtersOpen, setFiltersOpen] = useState(false),
    [showDeleted, setShowDeleted] = useState(false),
    [deleting, setDeleting] = useState<string | null>(null);
  const [selected, setSelected] = useState<ClassItem | null>(null);
  const [editing, setEditing] = useState<ClassItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    if (!user) return;
    try {
      setClasses(await attendanceDataService.getClasses(user.id));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load classes.");
    } finally {
      setLoading(false);
    }
  }, [user]);
  useEffect(() => {
    void load();
    return attendanceDataService.subscribe(() => {
      void load();
    });
  }, [load]);
  const filtered = classes.filter(
    (cls) =>
      (showDeleted ? !cls.isActive : cls.isActive) &&
      `${cls.className} ${cls.courseCode} ${cls.department} ${cls.enrollmentCode}`
        .toLowerCase()
        .includes(search.toLowerCase()) &&
      (type === "ALL" || cls.classType === type),
  );
  const remove = async (cls: ClassItem) => {
    if (
      !window.confirm(
        `Delete ${cls.courseCode}? It will be removed from active classes and student check-in. Attendance history is retained, and you can restore it from Deleted classes.`,
      )
    )
      return;
    setDeleting(cls.id);
    try {
      await deleteClass(cls.id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete class.");
    } finally {
      setDeleting(null);
    }
  };
  const restore = async (cls: ClassItem) => {
    try {
      await updateClass(cls.id, { isActive: true });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not restore class.");
    }
  };
  const startAttendance = async (classId: string) => {
    if (!user) return;
    await attendanceDataService.startSession(classId, user.id, user.name);
    navigate("/live-attendance");
  };
  return (
    <div className="page-stack">
      <PageHeading
        eyebrow="TEACHING"
        title={user?.role === "admin" ? "All classes" : "My classes"}
        description="A place for every course. Open a class for its roster and enrollment code."
        action={
          <Link className="p-button" to="/create-class">
            <Plus size={15} />
            Create class
          </Link>
        }
      />
      <InlineError message={error} />
      <div className="toolbar">
        <label className="search-field">
          <Search size={16} />
          <input
            aria-label="Search classes"
            placeholder="Search classes or course codes…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <div className="toolbar-meta">
          <span>
            {loading
              ? "Loading…"
              : `${filtered.length} ${filtered.length === 1 ? "class" : "classes"}`}
          </span>
          <button
            className="p-button secondary small"
            onClick={() => setFiltersOpen(!filtersOpen)}
            aria-expanded={filtersOpen}
            aria-controls="class-filters"
          >
            <SlidersHorizontal size={13} />
            Filters{type !== "ALL" && <span className="status-dot" />}
          </button>
        </div>
      </div>
      {filtersOpen && (
        <div
          id="class-filters"
          className="panel flex flex-wrap items-center gap-3 p-3"
        >
          <label className="text-xs text-slate-400" htmlFor="class-type-filter">
            Class type
          </label>
          <select
            id="class-type-filter"
            className="filter-select"
            value={type}
            onChange={(e) => setType(e.target.value)}
          >
            <option value="ALL">All types</option>
            <option>Theory</option>
            <option>Practical</option>
            <option>Seminar</option>
          </select>
          {type !== "ALL" && (
            <button className="text-link" onClick={() => setType("ALL")}>
              Reset filter
            </button>
          )}
        </div>
      )}
      <label className="text-xs text-slate-400 flex gap-2 items-center">
        <input
          type="checkbox"
          checked={showDeleted}
          onChange={(e) => setShowDeleted(e.target.checked)}
        />
        Deleted / inactive classes
      </label>
      {loading ? (
        <div className="panel p-6 text-xs text-slate-400" role="status">
          Loading your classes…
        </div>
      ) : filtered.length === 0 ? (
        <section className="panel">
          <EmptyState
            icon={BookOpen}
            title={
              classes.length
                ? "No matching classes"
                : "Your next class starts here"
            }
            description={
              classes.length
                ? "Try another search or clear your filters."
                : "Create a class to bring its students, enrollment code, and attendance together."
            }
            action={
              classes.length ? (
                <button
                  className="p-button secondary small"
                  onClick={() => {
                    setSearch("");
                    setType("ALL");
                  }}
                >
                  Clear search and filters
                </button>
              ) : (
                <Link className="p-button secondary small" to="/create-class">
                  <Plus size={14} />
                  Create your first class
                </Link>
              )
            }
          />
        </section>
      ) : (
        <div className="class-grid">
          {filtered.map((cls) => (
            <article className="panel class-card" key={cls.id}>
              <div className="flex items-center justify-between gap-3">
                <span className="course-badge">{cls.courseCode}</span>
                <span className="text-[10px] text-slate-400">
                  {cls.classType}
                </span>
              </div>
              <h2>{cls.className}</h2>
              <p className="mt-1 text-[11px] text-slate-400">
                {cls.semester} · {cls.department}
              </p>
              <div className="class-card-meta">
                <span>
                  <Clock size={12} />
                  {cls.scheduleInfo || "Schedule not set"}
                </span>
                {cls.room && (
                  <span>
                    <MapPin size={12} />
                    {cls.room}
                  </span>
                )}
              </div>
              <div className="class-card-footer">
                <span className="flex items-center gap-1.5 text-[11px] text-slate-400">
                  <Users size={13} />
                  {cls.enrolledStudentsCount ?? 0} enrolled
                </span>
                <button
                  className="p-button secondary small"
                  onClick={() => setSelected(cls)}
                  aria-label={`Open ${cls.className}`}
                >
                  Open class
                  <ArrowUpRight size={13} />
                </button>
              </div>
              <div className="flex items-center justify-between mt-3">
                <button className="text-link" onClick={() => setEditing(cls)}>
                  Edit class details
                </button>
                {showDeleted ? (
                  <button
                    className="text-link"
                    onClick={() => void restore(cls)}
                  >
                    Restore class
                  </button>
                ) : (
                  <button
                    className="text-xs text-red-300"
                    disabled={deleting === cls.id}
                    onClick={() => void remove(cls)}
                  >
                    {deleting === cls.id ? "Deleting…" : "Delete class"}
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
      {selected && (
        <ClassDetailsModal
          key={selected.id}
          classItem={selected}
          onClose={() => {
            setSelected(null);
            void load();
          }}
          onStartAttendance={startAttendance}
        />
      )}
      {editing && (
        <EditClassDialog
          classItem={editing}
          onClose={() => setEditing(null)}
          onSaved={() => void load()}
        />
      )}
    </div>
  );
}
