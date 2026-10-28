import clsx from 'clsx';
import { CalendarDays, ChartColumn, House, ListChecks, Settings as SettingsIcon, Shield } from 'lucide-react';
import { useEffect, useRef, type ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router';
import { syncAchievements } from '../db/actions';
import { PROGRAM_DAYS } from '../domain/schedule';
import { ACHIEVEMENTS, deriveAchievements } from '../domain/stats';
import { useApp } from '../lib/appData';
import { useProgramView } from '../lib/selectors';
import { useToast } from '../lib/toast';
import { ProgressBar } from './ui';

const NAV = [
  { to: '/', label: 'Today', icon: House, end: true },
  { to: '/challenges', label: 'Challenges', icon: CalendarDays, end: false },
  { to: '/habits', label: 'Habits', icon: ListChecks, end: false },
  { to: '/progress', label: 'Progress', icon: ChartColumn, end: false },
  { to: '/settings', label: 'Settings', icon: SettingsIcon, end: false },
] as const;

export function Shell({ children }: { children: ReactNode }) {
  const view = useProgramView();
  const { data } = useApp();
  const location = useLocation();
  const mainRef = useRef<HTMLElement>(null);

  // Move focus to the page on navigation for screen-reader and keyboard users.
  useEffect(() => {
    window.scrollTo({ top: 0 });
    mainRef.current?.focus({ preventScroll: true });
  }, [location.pathname]);

  return (
    <div className="min-h-dvh md:flex">
      <a href="#main" className="sr-only z-50 rounded-lg bg-accent px-3 py-2 text-accent-ink focus:not-sr-only focus:fixed focus:left-3 focus:top-3">
        Skip to content
      </a>

      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-line bg-surface/60 px-3 py-5 md:flex lg:w-64">
        <div className="mb-7 flex items-center gap-2.5 px-2">
          <Logo />
          <div className="leading-tight">
            <p className="text-sm font-bold tracking-tight">30-Day Challenge</p>
            <p className="text-xs text-ink-3">{data.settings.displayName ? `${data.settings.displayName}’s program` : 'Personal program'}</p>
          </div>
        </div>
        <nav aria-label="Main" className="flex flex-col gap-0.5">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => clsx('flex items-center gap-3 rounded-[10px] px-3 py-2 text-sm font-medium transition-colors', isActive ? 'bg-surface-2 text-ink' : 'text-ink-2 hover:bg-surface-2/60 hover:text-ink')}>
              {({ isActive }) => (
                <>
                  <n.icon className={clsx('size-[18px]', isActive ? 'text-accent' : 'text-ink-3')} aria-hidden />
                  {n.label}
                </>
              )}
            </NavLink>
          ))}
        </nav>
        {view && (
          <div className="mt-auto rounded-xl border border-line bg-surface-2/60 p-3.5">
            <div className="mb-2 flex items-baseline justify-between">
              <p className="text-xs font-medium text-ink-3">{view.phase === 'before' ? 'Starts soon' : view.phase === 'after' ? 'Program finished' : `Day ${view.day} of ${PROGRAM_DAYS}`}</p>
              <p className="tnum text-xs font-semibold">{view.counts.completed}/30</p>
            </div>
            <ProgressBar value={view.counts.completed / PROGRAM_DAYS} tone="success" label="Challenges completed" />
            {data.settings.hardMode && (
              <p className="mt-2.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-accent">
                <Shield className="size-3.5" aria-hidden /> Hard Mode
              </p>
            )}
          </div>
        )}
      </aside>

      <main id="main" ref={mainRef} tabIndex={-1} className="min-w-0 flex-1 outline-none">
        <div className="mx-auto w-full max-w-3xl px-4 pb-[calc(96px+env(safe-area-inset-bottom))] pt-[max(20px,env(safe-area-inset-top))] md:px-8 md:pb-16 md:pt-10">{children}</div>
      </main>

      {/* Mobile bottom navigation */}
      <nav aria-label="Main" className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/90 backdrop-blur-lg md:hidden">
        <div className="mx-auto grid max-w-md grid-cols-5">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => clsx('flex min-h-[56px] flex-col items-center justify-center gap-0.5 text-[10.5px] font-medium', isActive ? 'text-accent' : 'text-ink-3')}>
              <n.icon className="size-[22px]" aria-hidden strokeWidth={1.9} />
              {n.label}
            </NavLink>
          ))}
        </div>
      </nav>
      <AchievementSync />
    </div>
  );
}

export function Logo({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden className="shrink-0">
      <rect width="32" height="32" rx="8" fill="var(--surface-3)" />
      <circle cx="16" cy="16" r="9.5" fill="none" stroke="var(--border-strong)" strokeWidth="2.5" />
      <path d="M16 6.5a9.5 9.5 0 1 1-8.2 4.7" fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" />
      <text x="16" y="19.6" textAnchor="middle" fontSize="9.5" fontWeight="800" fill="var(--text)" fontFamily="system-ui">30</text>
    </svg>
  );
}

/** Keeps stored achievements in step with the records that earn them, and announces new ones. */
function AchievementSync() {
  const { data, today } = useApp();
  const toast = useToast();
  const known = useRef<Set<string> | null>(null);
  useEffect(() => {
    const p = data.program;
    if (!p) return;
    const derived = deriveAchievements({ startDate: p.startDate, today, timezone: data.settings.timezone, challenges: data.challenges, progress: data.progress, attempts: data.attempts, reflections: data.reflections, habits: data.habits, entries: data.entries });
    const ids = new Set(derived.map((d) => d.id));
    if (known.current) {
      for (const d of derived) if (!known.current.has(d.id)) toast.show(`Achievement: ${ACHIEVEMENTS[d.type].title}`, { tone: 'info' });
    }
    known.current = ids;
    const stored = new Map(data.achievements.map((a) => [a.id, a]));
    const differs = derived.length !== stored.size || derived.some((d) => stored.get(d.id)?.relatedEvent !== d.relatedEvent);
    if (differs) void syncAchievements(derived).catch(() => {});
  }, [data, today, toast]);
  return null;
}
