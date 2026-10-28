import { useLiveQuery } from 'dexie-react-hooks';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { UserError } from '../db/actions';
import { db } from '../db/db';
import { todayIn } from '../domain/dates';
import type { Achievement, CustomChallenge, Attempt, Challenge, ChallengeProgress, EvidenceMeta, Habit, HabitEntry, IsoDate, Program, Reflection, Reminder, Settings } from '../domain/types';
import { useToast } from './toast';

export interface AppData {
  settings: Settings;
  program: Program | null;
  challenges: Challenge[];
  progress: Map<string, ChallengeProgress>;
  habits: Habit[];
  entries: HabitEntry[];
  attempts: Attempt[];
  evidence: EvidenceMeta[];
  reflections: Reflection[];
  reminders: Reminder[];
  achievements: Achievement[];
  customChallenges: CustomChallenge[];
}

async function load(): Promise<AppData | null> {
  const settings = await db.settings.get('settings');
  if (!settings) return null;
  const [program, challenges, progress, habits, entries, attempts, evidence, reflections, reminders, achievements, customChallenges] = await Promise.all([
    db.program.get('program'),
    db.challenges.orderBy('day').toArray(),
    db.progress.toArray(),
    db.habits.orderBy('order').toArray(),
    db.habitEntries.toArray(),
    db.attempts.orderBy('at').toArray(),
    db.evidence.orderBy('createdAt').toArray(),
    db.reflections.toArray(),
    db.reminders.toArray(),
    db.achievements.toArray(),
    db.customChallenges.orderBy('updatedAt').reverse().toArray(),
  ]);
  return {
    settings,
    program: program ?? null,
    challenges,
    progress: new Map(progress.map((p) => [p.challengeId, p])),
    habits,
    entries,
    attempts,
    evidence,
    reflections,
    reminders: reminders.sort((a, b) => a.time.localeCompare(b.time)),
    achievements,
    customChallenges,
  };
}

interface Ctx {
  data: AppData;
  today: IsoDate;
  now: number;
}

const DataCtx = createContext<Ctx | null>(null);

/** Ticks so "today" rolls over at local midnight and countdowns stay live. */
export function useNow(intervalMs: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const id = window.setInterval(tick, intervalMs);
    document.addEventListener('visibilitychange', tick);
    window.addEventListener('focus', tick);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', tick);
      window.removeEventListener('focus', tick);
    };
  }, [intervalMs]);
  return now;
}

export function AppDataProvider({ children, fallback }: { children: (state: 'loading' | 'missing' | 'ready') => ReactNode; fallback?: ReactNode }) {
  const data = useLiveQuery(load, [], undefined);
  const now = useNow(30_000);
  const tz = data?.settings.timezone ?? 'UTC';
  const today = useMemo(() => todayIn(tz, now), [tz, now]);
  const value = useMemo(() => (data ? { data, today, now } : null), [data, today, now]);
  if (data === undefined) return <>{fallback ?? children('loading')}</>;
  if (data === null) return <>{children('missing')}</>;
  return <DataCtx.Provider value={value}>{children('ready')}</DataCtx.Provider>;
}

export function useApp(): Ctx {
  const c = useContext(DataCtx);
  if (!c) throw new Error('useApp outside AppDataProvider');
  return c;
}

/**
 * Run a mutation with busy state, duplicate-click protection and visible errors.
 * Storage failures are surfaced — data is never silently dropped.
 */
export function useAction<A extends unknown[], R>(fn: (...args: A) => Promise<R>, opts: { success?: string | ((r: R) => string | null) } = {}) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const fnRef = useRef(fn);
  const optsRef = useRef(opts);
  useEffect(() => {
    fnRef.current = fn;
    optsRef.current = opts;
  });
  const run = useCallback(
    async (...args: A): Promise<R | undefined> => {
      if (inFlight.current) return undefined;
      inFlight.current = true;
      setBusy(true);
      try {
        const r = await fnRef.current(...args);
        const s = optsRef.current.success;
        const msg = typeof s === 'function' ? s(r) : s;
        if (msg) toast.show(msg);
        return r;
      } catch (e) {
        toast.show(errorMessage(e), { tone: 'error' });
        return undefined;
      } finally {
        inFlight.current = false;
        setBusy(false);
      }
    },
    [toast],
  );
  return { run, busy };
}

export function errorMessage(e: unknown): string {
  if (e instanceof UserError) return e.message;
  if (e instanceof Error) {
    if (e.name === 'QuotaExceededError' || /quota/i.test(e.message)) return 'Browser storage is full. Export your data and remove large attachments, then try again.';
    if (e.name === 'InvalidStateError' || e.name === 'DatabaseClosedError') return 'Storage is unavailable (private browsing or blocked site data?). Changes can’t be saved.';
    return `Couldn’t save: ${e.message}`;
  }
  return 'Something went wrong. Nothing was changed.';
}
