import { Check } from 'lucide-react';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';

/** True when the user (app setting or OS) wants reduced motion. Read at call time. */
export function prefersReducedMotion(): boolean {
  if (typeof document === 'undefined') return true;
  const root = document.documentElement;
  if (root.classList.contains('reduce-motion')) return true;
  if (root.classList.contains('full-motion')) return false;
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Tweens a number towards `value` (ease-out cubic). Starts from `from` on first mount when given,
 * so rings and stats count up on load. Instant under reduced motion.
 */
export function AnimatedNumber({ value, from, duration = 650, format = (n: number) => String(Math.round(n)) }: { value: number; from?: number; duration?: number; format?: (n: number) => string }) {
  const [shown, setShown] = useState(from ?? value);
  const current = useRef(from ?? value);
  useEffect(() => {
    const start = performance.now();
    const a = current.current;
    const d = prefersReducedMotion() ? 0 : duration;
    let raf = 0;
    const tick = (t: number) => {
      const p = d === 0 ? 1 : Math.min(1, (t - start) / d);
      const v = a + (value - a) * (1 - Math.pow(1 - p, 3));
      current.current = v;
      setShown(v);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);
  // Reduced motion shows the real value immediately, without waiting for animation frames.
  return <>{format(prefersReducedMotion() ? value : shown)}</>;
}

/** Returns `value` one frame after mount so CSS transitions can animate from `initial`. */
export function useDeferredMount<T>(value: T, initial: T): T {
  const [v, setV] = useState(initial);
  useEffect(() => {
    const raf = requestAnimationFrame(() => setV(value));
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return v;
}

// ---------------------------------------------------------------- completion moment

interface Moment {
  id: number;
  day: number;
  title: string;
}

let moment: Moment | null = null;
const listeners = new Set<() => void>();
let seq = 0;

/** Show the brief "Day N complete" moment. */
export function celebrate(day: number, title: string) {
  moment = { id: ++seq, day, title };
  listeners.forEach((fn) => fn());
}

function dismiss(id: number) {
  if (moment?.id !== id) return;
  moment = null;
  listeners.forEach((fn) => fn());
}

const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

/** A quiet, centred card: the ring closes, a check appears, then it fades. Never blocks input. */
export function CompletionMoment() {
  const m = useSyncExternalStore(subscribe, () => moment, () => null);
  const [leaving, setLeaving] = useState<number | null>(null);
  useEffect(() => {
    if (!m) return;
    const stay = prefersReducedMotion() ? 1600 : 1900;
    const t1 = window.setTimeout(() => setLeaving(m.id), stay);
    const t2 = window.setTimeout(() => dismiss(m.id), stay + 320);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [m]);
  if (!m) return null;
  const r = 30;
  const len = 2 * Math.PI * r;
  return (
    <div className="pointer-events-none fixed inset-0 z-[60] flex items-center justify-center px-6" role="status" aria-live="polite">
      <div
        className="flex flex-col items-center rounded-2xl border border-line bg-surface px-9 py-7 text-center shadow-pop"
        style={{ animation: leaving === m.id ? 'moment-out 320ms ease-in forwards' : 'moment-in 420ms var(--ease-spring) both' }}
      >
        <div className="relative size-[76px]">
          <svg viewBox="0 0 76 76" className="size-full -rotate-90">
            <circle cx="38" cy="38" r={r} fill="none" stroke="var(--surface-3)" strokeWidth="4" />
            <circle
              cx="38"
              cy="38"
              r={r}
              fill="none"
              stroke="var(--slate)"
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray={len}
              strokeDashoffset={0}
              style={{ ['--len' as string]: `${len}`, animation: 'draw-ring 760ms var(--ease-out) both 80ms' }}
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-slate">
            <Check className="size-7" strokeWidth={2.4} style={{ animation: 'check-pop 360ms var(--ease-spring) both 620ms' }} />
          </span>
        </div>
        <p className="font-display mt-4 text-[22px] leading-tight">Day {m.day} complete</p>
        <p className="mt-1 max-w-[220px] text-[12.5px] text-ink-3">{m.title}</p>
      </div>
    </div>
  );
}
