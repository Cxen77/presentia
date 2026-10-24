import { useEffect, useId, useRef, type CSSProperties, type ReactNode } from 'react';
import { ChevronDown, X, type LucideIcon } from 'lucide-react';

/** Shimmer placeholder block. Compose into page-shaped skeletons while data loads. */
export function Skeleton({ className, style }: { className?: string; style?: CSSProperties }) {
  return <span aria-hidden="true" className={`skeleton ${className ?? ''}`} style={style} />;
}

function SkeletonStatus({ label, children }: { label: string; children: ReactNode }) {
  return <div role="status" aria-label={label}><span className="sr-only">{label}</span>{children}</div>;
}

/** Mirrors the dashboard desk-course list while classes load. */
export function CourseRowsSkeleton({ rows = 3 }: { rows?: number }) {
  return <SkeletonStatus label="Loading your courses">
    <div className="desk-course-list">
      {Array.from({ length: rows }, (_, i) => <div className="desk-course" key={i}>
        <Skeleton className="skeleton-line" style={{ width: 54, height: 12 }} />
        <div className="desk-course-title"><Skeleton className="skeleton-line" style={{ width: '42%', height: 13 }} />
          <Skeleton className="skeleton-line" style={{ width: '30%', height: 10, marginTop: 9 }} /></div>
        <Skeleton className="skeleton-line" style={{ width: 26, height: 12 }} />
        <Skeleton className="skeleton-disc" style={{ width: 34, height: 34 }} />
      </div>)}
    </div>
  </SkeletonStatus>;
}

/** Mirrors the class-card grid on the classes page. */
export function ClassGridSkeleton({ cards = 4 }: { cards?: number }) {
  return <SkeletonStatus label="Loading your classes">
    <div className="class-grid">
      {Array.from({ length: cards }, (_, i) => <div className="panel class-card" key={i}>
        <Skeleton className="skeleton-line" style={{ width: 74, height: 18 }} />
        <Skeleton className="skeleton-line" style={{ width: '85%', height: 15, marginTop: 16 }} />
        <Skeleton className="skeleton-line" style={{ width: '55%', height: 11, marginTop: 8 }} />
        <div className="class-card-footer"><Skeleton className="skeleton-line" style={{ width: 90, height: 11 }} />
          <Skeleton className="skeleton-box" style={{ width: 92, height: 30 }} /></div>
      </div>)}
    </div>
  </SkeletonStatus>;
}

/** Mirrors roster tables (reports, class details). */
export function RosterSkeleton({ rows = 5 }: { rows?: number }) {
  return <SkeletonStatus label="Loading the roster">
    <div className="roster-skeleton">
      {Array.from({ length: rows }, (_, i) => <div className="roster-skeleton-row" key={i}>
        <Skeleton className="skeleton-disc" style={{ width: 26, height: 26 }} />
        <Skeleton className="skeleton-line" style={{ width: '32%', height: 11 }} />
        <Skeleton className="skeleton-line" style={{ width: '16%', height: 11 }} />
        <Skeleton className="skeleton-line" style={{ width: '20%', height: 11 }} />
      </div>)}
    </div>
  </SkeletonStatus>;
}

/** Mirrors the live-attendance workbench (QR station + review panel). */
export function WorkbenchSkeleton() {
  return <SkeletonStatus label="Loading attendance">
    <div className="attendance-workbench">
      <div className="qr-station">
        <Skeleton className="skeleton-box" style={{ width: 130, height: 14 }} />
        <Skeleton className="skeleton-box" style={{ aspectRatio: '1' }} />
        <Skeleton className="skeleton-line" style={{ width: '60%', height: 11 }} />
      </div>
      <div className="batch-verification-panel">
        <Skeleton className="skeleton-line" style={{ width: 160, height: 15 }} />
        <Skeleton className="skeleton-line" style={{ width: '70%', height: 11, marginTop: 10 }} />
        {Array.from({ length: 3 }, (_, i) => <div className="roster-skeleton-row" style={{ marginTop: 14 }} key={i}>
          <Skeleton className="skeleton-box" style={{ width: 96, height: 96 }} />
          <div style={{ flex: 1, display: 'grid', gap: 8 }}>
            <Skeleton className="skeleton-line" style={{ width: '55%', height: 12 }} />
            <Skeleton className="skeleton-line" style={{ width: '38%', height: 10 }} />
            <Skeleton className="skeleton-line" style={{ width: '46%', height: 10 }} />
          </div>
        </div>)}
      </div>
    </div>
  </SkeletonStatus>;
}

export function PageHeading({ title, description, action, eyebrow }: {
  title: string; description: string; action?: ReactNode; eyebrow?: string;
}) {
  return <div className="page-heading"><div className="min-w-0">{eyebrow && <span className="sr-only">{eyebrow}</span>}
    <h1>{title}</h1><p className="page-description">{description}</p></div>{action && <div className="page-actions">{action}</div>}
  </div>;
}
export function EmptyState({ icon: Icon, title, description, action }: {
  icon: LucideIcon; title: string; description: string; action?: ReactNode;
}) {
  return <div className="empty-state"><div className="empty-icon"><Icon size={22} strokeWidth={1.6} /></div>
    <h2>{title}</h2><p>{description}</p>{action && <div className="mt-4">{action}</div>}</div>;
}
export function Disclosure({ title, description, children, defaultOpen = false }: {
  title: string; description?: string; children: ReactNode; defaultOpen?: boolean;
}) {
  return <details className="disclosure" open={defaultOpen || undefined}>
    <summary><span><span className="font-medium">{title}</span>{description && <span className="disclosure-description">{description}</span>}</span><ChevronDown size={16} /></summary>
    <div className="disclosure-body">{children}</div></details>;
}
export function Dialog({ title, subtitle, onClose, children, footer }: {
  title: string; subtitle?: string; onClose: () => void; children: ReactNode; footer?: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    const dialog = ref.current;
    dialog?.showModal();
    dialog?.querySelector<HTMLElement>('[autofocus], [data-dialog-autofocus]')?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { dialog?.close(); document.body.style.overflow = previousOverflow; previousFocus?.focus(); };
  }, []);
  return <dialog ref={ref} className="portal-dialog" aria-labelledby={titleId} onCancel={onClose}
    onClick={event => { if (event.target === event.currentTarget) {
      const bounds = event.currentTarget.getBoundingClientRect();
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) onClose();
    } }}>
    <div className="dialog-heading"><div className="min-w-0">{subtitle && <p className="eyebrow">{subtitle}</p>}<h2 id={titleId}>{title}</h2></div>
      <button type="button" className="icon-button" aria-label="Close details" onClick={onClose}><X size={18} /></button></div>
    <div className="dialog-body">{children}</div>{footer && <div className="dialog-footer">{footer}</div>}</dialog>;
}
export function InlineError({ message }: { message: string | null }) {
  return message ? <div className="inline-error" role="alert">{message}</div> : null;
}
