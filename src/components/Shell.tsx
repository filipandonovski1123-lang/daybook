import clsx from 'clsx';
import { BookOpen, CalendarDays, ChartNoAxesColumn, Ellipsis, LayoutGrid, ListChecks, NotebookPen, Settings as SettingsIcon, Target } from 'lucide-react';
import { useEffect, useRef, type ReactNode } from 'react';
import { Link, NavLink, useLocation } from 'react-router';
import { syncAchievements } from '../db/actions';
import { Backdrop, type BackdropKind } from './Scene';
import { ACHIEVEMENTS, deriveAchievements } from '../domain/stats';
import { useApp } from '../lib/appData';
import { useToast } from '../lib/toast';

const SIDEBAR = [
  { to: '/', label: 'Today', icon: LayoutGrid, end: true },
  { to: '/calendar', label: 'Calendar', icon: CalendarDays, end: false },
  { to: '/challenge', label: 'Challenge', icon: Target, end: false },
  { to: '/habits', label: 'Habits', icon: ListChecks, end: false },
  { to: '/progress', label: 'Progress', icon: ChartNoAxesColumn, end: false },
  { to: '/reflection', label: 'Reflections', icon: NotebookPen, end: false },
] as const;

const TABS = [
  { to: '/', label: 'Today', icon: LayoutGrid, end: true },
  { to: '/calendar', label: 'Calendar', icon: CalendarDays, end: false },
  { to: '/progress', label: 'Progress', icon: ChartNoAxesColumn, end: false },
  { to: '/more', label: 'More', icon: Ellipsis, end: false },
] as const;

/** Faint photo behind the top of these screens. Today, challenge pages, Settings and Tools stay plain. */
const BACKDROP_FOR: [string, BackdropKind][] = [
  ['/reflection', 'reflection'],
  ['/progress', 'progress'],
  ['/calendar', 'calendar'],
  ['/habits', 'habits'],
  ['/more', 'calendar'],
];

export function Wordmark({ compact = false, days = 30 }: { compact?: boolean; days?: number }) {
  return (
    <span className="flex items-baseline gap-1.5">
      <span className={clsx('font-display leading-none text-ink', compact ? 'text-[22px]' : 'text-[26px]')}>{days}</span>
      <span className="text-[11px] text-ink-2">Day Challenge</span>
    </span>
  );
}

/** Kept for onboarding. */
export function Logo({ days }: { days?: number }) {
  return <Wordmark days={days} />;
}

export function Shell({ children }: { children: ReactNode }) {
  const { data } = useApp();
  const location = useLocation();
  const mainRef = useRef<HTMLElement>(null);
  const initial = (data.settings.displayName.trim()[0] ?? '').toUpperCase();

  // Move focus to the page on navigation for screen-reader and keyboard users.
  useEffect(() => {
    window.scrollTo({ top: 0 });
    mainRef.current?.focus({ preventScroll: true });
  }, [location.pathname]);

  const more = ['/more', '/habits', '/settings', '/reflection', '/tools', '/plan'].some((p) => location.pathname.startsWith(p));
  const calendar = location.pathname.startsWith('/challenge');
  const backdrop = BACKDROP_FOR.find(([p]) => location.pathname.startsWith(p))?.[1];

  return (
    <div className="min-h-dvh md:flex">
      <a href="#main" className="sr-only z-50 rounded-lg bg-accent px-3 py-2 text-accent-ink focus:not-sr-only focus:fixed focus:left-3 focus:top-3">
        Skip to content
      </a>

      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh w-56 shrink-0 flex-col border-r border-line bg-surface px-4 py-6 md:flex lg:w-60">
        <Link to="/" className="mb-8 px-2">
          <Wordmark days={data.program?.length} />
        </Link>
        <nav aria-label="Main" className="flex flex-col gap-0.5">
          {SIDEBAR.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => clsx('flex items-center gap-3 rounded-md px-2.5 py-2 text-[13.5px] transition-colors', isActive ? 'bg-surface-2 text-ink' : 'text-ink-2 hover:text-ink')}>
              <n.icon className="size-[17px]" strokeWidth={1.6} aria-hidden />
              {n.label}
            </NavLink>
          ))}
        </nav>
        <nav aria-label="Secondary" className="mt-auto flex flex-col gap-0.5">
          <NavLink to="/tools" className={({ isActive }) => clsx('flex items-center gap-3 rounded-md px-2.5 py-2 text-[13.5px]', isActive ? 'bg-surface-2 text-ink' : 'text-ink-2 hover:text-ink')}>
            <BookOpen className="size-[17px]" strokeWidth={1.6} aria-hidden /> Tools
          </NavLink>
          <NavLink to="/settings" className={({ isActive }) => clsx('flex items-center gap-3 rounded-md px-2.5 py-2 text-[13.5px]', isActive ? 'bg-surface-2 text-ink' : 'text-ink-2 hover:text-ink')}>
            <SettingsIcon className="size-[17px]" strokeWidth={1.6} aria-hidden /> Settings
          </NavLink>
        </nav>
      </aside>

      <div className="relative isolate min-w-0 flex-1">
        {backdrop && <Backdrop key={backdrop} kind={backdrop} />}
        {/* Mobile top bar */}
        <header className="flex items-center justify-between px-5 pb-1 pt-[max(14px,env(safe-area-inset-top))] md:hidden">
          <Link to="/" aria-label="30 Day Challenge, Today">
            <Wordmark compact days={data.program?.length} />
          </Link>
          <Link to="/settings" aria-label="Settings" className="flex size-8 items-center justify-center rounded-full border border-line bg-surface-2 text-[13px] font-medium text-ink-2">
            {initial || <SettingsIcon className="size-4" strokeWidth={1.6} />}
          </Link>
        </header>

        <main id="main" ref={mainRef} tabIndex={-1} className="outline-none">
          <div className="mx-auto w-full max-w-[880px] px-5 pb-[calc(92px+env(safe-area-inset-bottom))] pt-4 md:px-10 md:pb-16 md:pt-10">{children}</div>
        </main>
      </div>

      {/* Mobile bottom navigation */}
      <nav aria-label="Main" className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 backdrop-blur md:hidden">
        <div className="mx-auto grid max-w-md grid-cols-4">
          {TABS.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) => clsx('flex min-h-[58px] flex-col items-center justify-center gap-1 text-[10.5px]', isActive || (n.to === '/more' && more) || (n.to === '/calendar' && calendar) ? 'text-ink' : 'text-ink-3')}
            >
              {({ isActive }) => (
                <>
                  <span className={clsx('flex size-7 items-center justify-center rounded-md', (isActive || (n.to === '/more' && more) || (n.to === '/calendar' && calendar)) && 'bg-accent text-accent-ink')}>
                    <n.icon className="size-[17px]" strokeWidth={1.7} aria-hidden />
                  </span>
                  {n.label}
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
      <AchievementSync />
    </div>
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
