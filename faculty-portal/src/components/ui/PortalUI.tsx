import { useEffect, useId, useRef, type ReactNode } from 'react';
import { ChevronDown, X, type LucideIcon } from 'lucide-react';

export function PageHeading({ title, description, action, eyebrow }: {
  title: string; description: string; action?: ReactNode; eyebrow?: string;
}) {
  return <div className="page-heading"><div className="min-w-0">{eyebrow && <p className="eyebrow">{eyebrow}</p>}
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
    const dialog = ref.current;
    dialog?.showModal();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { dialog?.close(); document.body.style.overflow = previousOverflow; };
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
