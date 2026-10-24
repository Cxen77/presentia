import { useEffect, useRef, useState, type ReactNode } from 'react';
import { motion, useSpring, useTransform, type HTMLMotionProps } from 'motion/react';
import { easeOut } from './motionEase';

/** Parent that reveals its children one after another. */
export function Stagger({ children, className, delay = 0, gap = 0.06 }: {
  children: ReactNode; className?: string; delay?: number; gap?: number;
}) {
  return <motion.div className={className} initial="hidden" animate="show" variants={{
    hidden: {}, show: { transition: { staggerChildren: gap, delayChildren: delay } },
  }}>{children}</motion.div>;
}

export function StaggerItem({ children, className, y = 14, ...rest }: {
  children: ReactNode; className?: string; y?: number;
} & HTMLMotionProps<'div'>) {
  return <motion.div className={className} variants={{
    hidden: { opacity: 0, y },
    show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: easeOut } },
  }} {...rest}>{children}</motion.div>;
}

/** Single element that fades/slides in on mount. */
export function Reveal({ children, className, delay = 0, y = 12 }: {
  children: ReactNode; className?: string; delay?: number; y?: number;
}) {
  return <motion.div className={className} initial={{ opacity: 0, y }} animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.45, delay, ease: easeOut }}>{children}</motion.div>;
}

/** Number that counts up to its value with a spring. */
export function AnimatedNumber({ value, className }: { value: number; className?: string }) {
  const spring = useSpring(0, { stiffness: 90, damping: 22, mass: 0.8 });
  const display = useTransform(spring, v => Math.round(v).toLocaleString());
  useEffect(() => { spring.set(value); }, [value, spring]);
  return <motion.span className={className} style={{ fontVariantNumeric: 'tabular-nums' }}>{display}</motion.span>;
}

/** Card wrapper that lifts on hover. */
export function HoverCard({ children, className, ...rest }: {
  children: ReactNode; className?: string;
} & HTMLMotionProps<'div'>) {
  return <motion.div className={className} whileHover={{ y: -3 }} transition={{ duration: 0.25, ease: easeOut }} {...rest}>{children}</motion.div>;
}

/** Signature "spotlight" card: a soft glow follows the cursor across the surface. */
export function SpotlightCard({ children, className, ...rest }: {
  children: ReactNode; className?: string;
} & HTMLMotionProps<'div'>) {
  const ref = useRef<HTMLDivElement>(null);
  const [spot, setSpot] = useState<{ x: number; y: number } | null>(null);
  return <motion.div ref={ref} className={`spotlight-card ${className ?? ''}`} whileHover={{ y: -3 }}
    transition={{ duration: 0.25, ease: easeOut }}
    onMouseMove={event => {
      const bounds = ref.current?.getBoundingClientRect();
      if (bounds) setSpot({ x: event.clientX - bounds.left, y: event.clientY - bounds.top });
    }}
    onMouseLeave={() => setSpot(null)} {...rest}>
    {spot && <span aria-hidden="true" className="spotlight-glow"
      style={{ left: spot.x, top: spot.y }} />}
    {children}
  </motion.div>;
}

/** Signature "aurora" backdrop: slow drifting light blobs behind the login card. */
export function AuroraBackdrop() {
  return <div aria-hidden="true" className="aurora-backdrop">
    <motion.span className="aurora-blob aurora-a"
      animate={{ x: [0, 60, -30, 0], y: [0, -40, 30, 0], scale: [1, 1.15, 0.95, 1] }}
      transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }} />
    <motion.span className="aurora-blob aurora-b"
      animate={{ x: [0, -50, 40, 0], y: [0, 35, -25, 0], scale: [1, 0.9, 1.12, 1] }}
      transition={{ duration: 22, repeat: Infinity, ease: 'easeInOut' }} />
    <motion.span className="aurora-blob aurora-c"
      animate={{ x: [0, 30, -45, 0], y: [0, -25, 20, 0], scale: [1, 1.1, 0.92, 1] }}
      transition={{ duration: 26, repeat: Infinity, ease: 'easeInOut' }} />
  </div>;
}
