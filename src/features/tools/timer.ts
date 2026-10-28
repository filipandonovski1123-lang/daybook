import { useLiveQuery } from 'dexie-react-hooks';
import { clearTimer, saveTimer } from '../../db/actions';
import { db } from '../../db/db';
import type { TimerState } from '../../domain/types';
import { useNow } from '../../lib/appData';

/**
 * A timer whose state lives in IndexedDB as (startedAt, accumulatedMs), so refreshing the page,
 * closing the tab or the device sleeping never loses elapsed time.
 */
export function usePersistentTimer(id: string, kind: TimerState['kind'], durationMs: number | null = null) {
  const state = useLiveQuery(() => db.timers.get(id), [id]);
  const running = !!state?.startedAt;
  const now = useNow(running ? 250 : 60_000);
  const elapsed = state ? state.accumulatedMs + (state.startedAt ? Math.max(0, now - state.startedAt) : 0) : 0;
  const duration = state?.durationMs ?? durationMs;
  const remaining = duration !== null ? Math.max(0, duration - elapsed) : null;

  const base = (): TimerState => state ?? { id, kind, startedAt: null, accumulatedMs: 0, durationMs, label: '', linkedHabitId: null };
  return {
    exists: !!state,
    running,
    elapsed,
    remaining,
    duration,
    start: (overrideDuration?: number | null) => {
      const b = base();
      return saveTimer({ ...b, durationMs: overrideDuration !== undefined ? overrideDuration : b.durationMs, startedAt: Date.now() });
    },
    pause: () => {
      if (!state?.startedAt) return Promise.resolve();
      return saveTimer({ ...state, startedAt: null, accumulatedMs: state.accumulatedMs + (Date.now() - state.startedAt) });
    },
    reset: () => clearTimer(id),
    setDuration: (ms: number) => saveTimer({ ...base(), durationMs: ms, accumulatedMs: 0, startedAt: null }),
  };
}
