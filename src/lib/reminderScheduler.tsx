import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { claimNotification, pruneNotificationLog } from '../db/actions';
import { db } from '../db/db';
import { addDays } from '../domain/dates';
import { dayAdherence } from '../domain/habits';
import { dueReminders, reminderMessage } from '../domain/reminders';
import { programDayFor } from '../domain/schedule';
import type { ReminderType } from '../domain/types';
import { useApp } from './appData';
import { showSystemNotification } from './notifications';

export interface InAppReminder {
  key: string;
  type: ReminderType;
  title: string;
  body: string;
  at: number;
}

interface Ctx {
  inApp: InAppReminder[];
  dismiss: (key: string) => void;
  lastError: string | null;
}

const ReminderCtx = createContext<Ctx>({ inApp: [], dismiss: () => {}, lastError: null });

/**
 * Checks for due reminders every 30 s while the app is running (foreground or background tab).
 * Each reminder is claimed in IndexedDB before delivery, so it fires once per day even with
 * several tabs open. Quiet hours suppress delivery entirely; disabled reminders never fire.
 */
export function ReminderScheduler({ children }: { children: ReactNode }) {
  const { data, today, now } = useApp();
  const [inApp, setInApp] = useState<InAppReminder[]>([]);
  const [lastError, setLastError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 30_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!data.settings.onboarded) return;
    let cancelled = false;
    (async () => {
      const t = Date.now();
      const logs = await db.notificationLog.where('date').aboveOrEqual(addDays(today, -1)).toArray();
      const due = dueReminders(data.reminders, data.settings, t, new Set(logs.map((l) => l.id)));
      for (const d of due) {
        if (cancelled) return;
        const method = d.suppressed ? 'suppressed' : d.reminder.delivery;
        if (!(await claimNotification(d.reminder.id, d.date, method, t))) continue;
        if (d.suppressed) continue;
        const start = data.program?.startDate ?? null;
        const day = start ? programDayFor(start, d.date) : 0;
        const length = data.program?.length ?? data.challenges.length;
        const challenge = day >= 1 && day <= length ? data.challenges.find((c) => c.day === day) : undefined;
        const adherence = dayAdherence(data.habits, data.entries, d.date);
        const challengeOpen = challenge && !['completed', 'attempted'].includes(data.progress.get(challenge.id)?.status ?? '') ? 1 : 0;
        const msg = reminderMessage(d.reminder.type, {
          startDate: start,
          length,
          date: d.date,
          challengeTitle: challenge?.title ?? null,
          // Hard Mode pressure only applies while the program is actually running.
          hardMode: data.settings.hardMode && day >= 1 && day <= length,
          openItems: Math.max(0, adherence.planned - adherence.done) + challengeOpen,
        });
        let shownBySystem = false;
        if (d.reminder.delivery === 'system') {
          const r = await showSystemNotification(msg.title, msg.body, `reminder-${d.reminder.id}-${d.date}`);
          shownBySystem = r.ok;
          if (!r.ok) setLastError(r.reason);
        }
        // Always surface inside the app too when it's visible (OS banners are often hidden for the focused app).
        if (!shownBySystem || document.visibilityState === 'visible') {
          setInApp((cur) => [...cur.filter((x) => x.key !== `${d.reminder.id}|${d.date}`), { key: `${d.reminder.id}|${d.date}`, type: d.reminder.type, ...msg, at: d.fireAt }]);
        }
      }
      await pruneNotificationLog(addDays(today, -14));
    })().catch((e: unknown) => setLastError(e instanceof Error ? e.message : String(e)));
    return () => {
      cancelled = true;
    };
  }, [data, today, now, tick]);

  const dismiss = useCallback((key: string) => setInApp((cur) => cur.filter((x) => x.key !== key)), []);
  const value = useMemo(() => ({ inApp, dismiss, lastError }), [inApp, dismiss, lastError]);
  return <ReminderCtx.Provider value={value}>{children}</ReminderCtx.Provider>;
}

export const useReminders = () => useContext(ReminderCtx);
