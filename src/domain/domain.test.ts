import { describe, expect, it } from 'vitest';
import { buildChallenges, CHALLENGE_COUNT } from '../data/challenges';
import { buildHabits, STARTER_HABITS } from '../data/habits';
import { checkPi, makeTest, PI_100, rng } from './arithmetic';
import { checkCompletion, improvementPct, personalBests } from './criteria';
import { addDays, diffDays, endOfDayEpoch, hoursBetween, inWindow, isValidIso, todayIn, weekdayOf, zonedToEpoch } from './dates';
import { withDerived } from './derived';
import { dayAdherence, statusFor } from './habits';
import { buildIcs, fold, icsEscape } from './ics';
import { dueReminders, reminderMessage, upcomingSchedule } from './reminders';
import { displayStatus, endDateFor, isFuture, programDayFor, programPhase, scheduledDateFor } from './schedule';
import { challengeCounts, deriveAchievements, mostSkipped, statusesFor, weeklyStats } from './stats';
import { challengeSchema, habitSchema, type Attempt, type ChallengeProgress, type HabitEntry, type Reminder } from './types';
import { backupDue } from './backupReminder';

const SYD = 'Australia/Sydney';

describe('dates', () => {
  it('adds days across month, year and leap boundaries', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2028-02-29', 1)).toBe('2028-03-01');
    expect(addDays('2027-02-28', 1)).toBe('2027-03-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(diffDays('2026-12-15', '2027-01-13')).toBe(29);
  });

  it('is unaffected by Sydney DST transitions', () => {
    // DST starts Sun 4 Oct 2026, ends Sun 5 Apr 2026.
    expect(addDays('2026-10-03', 1)).toBe('2026-10-04');
    expect(addDays('2026-10-04', 1)).toBe('2026-10-05');
    expect(diffDays('2026-09-20', '2026-10-19')).toBe(29);
    expect(diffDays('2026-03-20', '2026-04-18')).toBe(29);
  });

  it('validates ISO dates', () => {
    expect(isValidIso('2028-02-29')).toBe(true);
    expect(isValidIso('2027-02-29')).toBe(false);
    expect(isValidIso('2026-13-01')).toBe(false);
    expect(isValidIso('26-1-1')).toBe(false);
  });

  it('computes today in a timezone, including near midnight', () => {
    // 2026-10-28T13:30Z = 00:30 on 29 Oct in Sydney (AEDT, +11).
    const t = Date.UTC(2026, 9, 28, 13, 30);
    expect(todayIn(SYD, t)).toBe('2026-10-29');
    expect(todayIn('UTC', t)).toBe('2026-10-28');
    expect(todayIn('America/Los_Angeles', t)).toBe('2026-10-28');
  });

  it('converts local wall time to an instant across DST', () => {
    // Before DST (AEST +10) and after (AEDT +11).
    expect(new Date(zonedToEpoch('2026-10-03', '08:00', SYD)).toISOString()).toBe('2026-10-02T22:00:00.000Z');
    expect(new Date(zonedToEpoch('2026-10-05', '08:00', SYD)).toISOString()).toBe('2026-10-04T21:00:00.000Z');
    // 02:30 doesn't exist on 4 Oct 2026 in Sydney (clocks jump 02:00 → 03:00): resolve to the instant after the gap.
    const gap = zonedToEpoch('2026-10-04', '02:30', SYD);
    expect(new Date(gap).toISOString()).toBe('2026-10-03T16:30:00.000Z');
    // Fall back: 02:30 on 5 Apr 2026 happens twice; we pick the first (AEDT).
    expect(new Date(zonedToEpoch('2026-04-05', '02:30', SYD)).toISOString()).toBe('2026-04-04T15:30:00.000Z');
  });

  it('end of day across DST is 23 h / 25 h after start of day', () => {
    const start = zonedToEpoch('2026-10-04', '00:00', SYD);
    expect((endOfDayEpoch('2026-10-04', SYD) - start) / 3_600_000).toBe(23);
    const start2 = zonedToEpoch('2026-04-05', '00:00', SYD);
    expect((endOfDayEpoch('2026-04-05', SYD) - start2) / 3_600_000).toBe(25);
  });

  it('handles windows that wrap midnight and sleep duration', () => {
    expect(inWindow('23:00', '22:30', '07:00')).toBe(true);
    expect(inWindow('06:59', '22:30', '07:00')).toBe(true);
    expect(inWindow('07:00', '22:30', '07:00')).toBe(false);
    expect(inWindow('12:00', '09:00', '17:00')).toBe(true);
    expect(hoursBetween('22:30', '07:00')).toBe(8.5);
  });

  it('knows weekdays', () => {
    expect(weekdayOf('2026-10-28')).toBe(3); // Wednesday
    expect(weekdayOf('2026-11-01')).toBe(0); // Sunday
  });
});

describe('schedule', () => {
  const start = '2026-11-20';
  it('maps Day 1 to the start date and Day 30 to 29 days later', () => {
    expect(scheduledDateFor(start, 1)).toBe('2026-11-20');
    expect(scheduledDateFor(start, 30)).toBe('2026-12-19');
    expect(endDateFor(start)).toBe('2026-12-19');
    expect(programDayFor(start, '2026-11-20')).toBe(1);
    expect(programDayFor(start, '2026-12-19')).toBe(30);
    expect(programPhase(start, '2026-11-19')).toBe('before');
    expect(programPhase(start, '2026-12-20')).toBe('after');
  });

  it('maps across a leap day', () => {
    expect(scheduledDateFor('2028-02-15', 30)).toBe('2028-03-15');
    expect(scheduledDateFor('2028-02-15', 15)).toBe('2028-02-29');
  });

  it('derives display status without silently completing or shifting', () => {
    const c = { day: 3 };
    expect(displayStatus(start, '2026-11-21', c, null)).toBe('upcoming');
    expect(displayStatus(start, '2026-11-22', c, null)).toBe('available');
    expect(displayStatus(start, '2026-11-23', c, null)).toBe('missed');
    expect(displayStatus(start, '2026-11-23', c, { status: 'not_started', rescheduledTo: '2026-11-25' })).toBe('rescheduled');
    expect(displayStatus(start, '2026-11-25', c, { status: 'not_started', rescheduledTo: '2026-11-25' })).toBe('available');
    expect(displayStatus(start, '2026-11-23', c, { status: 'completed', rescheduledTo: null })).toBe('completed');
    expect(displayStatus(start, '2026-11-23', c, { status: 'paused', rescheduledTo: null })).toBe('in_progress');
    // Missing day 3 does not move day 4.
    expect(displayStatus(start, '2026-11-23', { day: 4 }, null)).toBe('available');
    expect(isFuture(start, '2026-11-20', { day: 2 }, null)).toBe(true);
  });
});

describe('seed data', () => {
  const challenges = buildChallenges(0);
  it('has exactly 30 challenges in order with valid schema', () => {
    expect(CHALLENGE_COUNT).toBe(30);
    expect(challenges.map((c) => c.day)).toEqual(Array.from({ length: 30 }, (_, i) => i + 1));
    for (const c of challenges) expect(() => challengeSchema.parse(c)).not.toThrow();
    expect(new Set(challenges.map((c) => c.id)).size).toBe(30);
  });

  it('keeps the canonical titles', () => {
    expect(challenges[0]?.title).toBe('Learn to Juggle Three Balls');
    expect(challenges[2]?.title).toBe('Learn Basic Sign Language');
    expect(challenges[12]?.title).toBe('The Throwing Accuracy Challenge');
    expect(challenges[27]?.title).toBe('Become a Chess Competitor');
    expect(challenges[29]?.title).toBe('THE FINAL BOSS: Solve a 12-Sided Megaminx');
  });

  it('difficulty never decreases by more than one step', () => {
    for (let i = 1; i < challenges.length; i++) {
      expect((challenges[i]?.difficulty ?? 0) - (challenges[i - 1]?.difficulty ?? 0)).toBeGreaterThanOrEqual(-1);
    }
  });

  it('every criterion rule references a known metric, derived key or evidence', () => {
    const derivedKeys = ['baseWpm', 'finalWpm', 'accuracy', 'perfectUnder5', 'gamesPlayed', 'ratingChange', 'improvementAchieved', 'serveAccuracy'];
    for (const c of challenges) {
      const keys = new Set([...c.metrics.map((m) => m.key), ...derivedKeys]);
      for (const cr of c.criteria) {
        const r = cr.rule;
        if (!r) continue;
        const refs = r.op === 'improve' ? [r.baseline, r.final] : r.op === 'ratio' ? [r.num, r.den] : r.op === 'evidenceMin' ? [] : [r.key];
        for (const k of refs) expect(keys.has(k), `${c.id} → ${k}`).toBe(true);
      }
      expect(c.criteria.some((cr) => !cr.bonus), `${c.id} has a main criterion`).toBe(true);
    }
  });

  it('day 28 separates the stretch goal from the daily task', () => {
    const chess = challenges[27];
    expect(chess?.stretchGoal).toMatch(/target you set/);
    expect(chess?.objective).not.toMatch(/target/);
  });

  it('seeds valid habits with the sensitive habit discreet', () => {
    const habits = buildHabits();
    for (const h of habits) expect(() => habitSchema.parse(h)).not.toThrow();
    const personal = habits.find((h) => h.id === 'personal');
    expect(personal?.sensitive).toBe(true);
    expect(personal?.visibility).toBe('discreet');
    expect(habits.filter((h) => h.enabled).map((h) => h.id)).toEqual(STARTER_HABITS); // new users start small
  });
});

describe('criteria & personal bests', () => {
  const challenges = buildChallenges(0);
  const byDay = (d: number) => challenges[d - 1]!;

  it('day 1 juggling: 10 catches meets main, 30 the bonus', () => {
    expect(checkCompletion(byDay(1), { metrics: { bestCatches: 9 }, checked: [] }, []).mainMet).toBe(false);
    const r = checkCompletion(byDay(1), { metrics: { bestCatches: 12 }, checked: [] }, []);
    expect(r.mainMet).toBe(true);
    expect(r.bonusMet).toBe(false);
    expect(checkCompletion(byDay(1), { metrics: { bestCatches: 30 }, checked: [] }, []).bonusMet).toBe(true);
  });

  it('day 2 speed reading needs +15% AND ≥80% comprehension, computing WPM', () => {
    const m = { baseWords: 1000, baseSeconds: 240, finalWords: 1000, finalSeconds: 200, finalComp: 85 }; // 250 → 300 wpm (+20%)
    expect(withDerived('speed-reading', m).baseWpm).toBe(250);
    expect(withDerived('speed-reading', m).finalWpm).toBe(300);
    expect(checkCompletion(byDay(2), { metrics: m, checked: [] }, []).mainMet).toBe(true);
    expect(checkCompletion(byDay(2), { metrics: { ...m, finalComp: 70 }, checked: [] }, []).mainMet).toBe(false);
    expect(checkCompletion(byDay(2), { metrics: { ...m, finalSeconds: 230 }, checked: [] }, []).mainMet).toBe(false);
  });

  it('day 13 throwing accuracy requires +25% and comparable conditions', () => {
    const c = byDay(13);
    expect(checkCompletion(c, { metrics: { baseHits: 12, finalHits: 15 }, checked: ['comparable'] }, []).mainMet).toBe(true); // +25%
    expect(checkCompletion(c, { metrics: { baseHits: 12, finalHits: 14 }, checked: ['comparable'] }, []).mainMet).toBe(false);
    expect(checkCompletion(c, { metrics: { baseHits: 12, finalHits: 15 }, checked: [] }, []).mainMet).toBe(false);
  });

  it('day 28 chess derives games and rating change against the user’s own target', () => {
    const m = withDerived('chess-competitor', { startRating: 1200, endRating: 1235, wins: 4, draws: 1, losses: 3, analysed: 8 });
    expect(m.gamesPlayed).toBe(8);
    expect(m.ratingChange).toBe(35);
    expect(m.reachedTarget).toBeUndefined(); // no target set
    expect(withDerived('chess-competitor', { endRating: 1235, targetRating: 1200 }).reachedTarget).toBe(true);
    expect(checkCompletion(byDay(28), { metrics: { wins: 4, draws: 1, losses: 3, analysed: 8 }, checked: [] }, []).mainMet).toBe(true);
  });

  it('day 29 uses the user-defined target and direction', () => {
    const c = byDay(29);
    const m = { better: 'lower', baseline: 100, final: 80, targetPct: 15, hoursUsed: 7.5 };
    expect(checkCompletion(c, { metrics: m, checked: ['defined'] }, []).mainMet).toBe(true);
    expect(checkCompletion(c, { metrics: { ...m, final: 90 }, checked: ['defined'] }, []).mainMet).toBe(false);
    expect(checkCompletion(c, { metrics: { ...m, hoursUsed: 9 }, checked: ['defined'] }, []).mainMet).toBe(false);
  });

  it('evidence rules count tagged files', () => {
    const ev = (tag: string | null) => ({ id: Math.random().toString(), challengeId: 'day-06', name: 'x.jpg', mime: 'image/jpeg', size: 1, tag, caption: '', createdAt: 0 });
    const c = byDay(6);
    const checked = ['proportion', 'shading'];
    expect(checkCompletion(c, { metrics: {}, checked }, [ev('before')]).mainMet).toBe(false);
    expect(checkCompletion(c, { metrics: {}, checked }, [ev('before'), ev('after')]).mainMet).toBe(true);
  });

  it('improvement handles direction', () => {
    expect(improvementPct(100, 125)).toBe(25);
    expect(improvementPct(100, 80, 'lower')).toBe(20);
  });

  it('personal bests only count real improvements over previous values', () => {
    const c = byDay(1);
    const mk = (v: number, at: number): Attempt => ({ id: String(at), challengeId: c.id, at, date: '2026-11-20', kind: 'attempt', label: '', metrics: { catches: v }, durationSec: null, note: '' });
    const { events, summaries } = personalBests(c, null, [mk(4, 1), mk(3, 2), mk(8, 3), mk(8, 4), mk(15, 5)]);
    expect(events.map((e) => [e.previous, e.value])).toEqual([[4, 8], [8, 15]]);
    expect(summaries[0]?.best).toBe(15);
    expect(summaries[0]?.first).toBe(4);
    // Lower-is-better metric
    const c30 = byDay(30);
    const t = (v: number, at: number): Attempt => ({ ...mk(0, at), challengeId: c30.id, metrics: { solveSeconds: v } });
    expect(personalBests(c30, null, [t(1500, 1), t(1200, 2), t(1300, 3)]).events.map((e) => e.value)).toEqual([1200]);
  });

  it('baseline → final personal bests', () => {
    const c = byDay(13);
    const r = personalBests(c, { metrics: { baseHits: 10, finalHits: 14 }, updatedAt: 5 }, []);
    expect(r.events).toHaveLength(1);
    expect(r.events[0]?.improvementPct).toBe(40);
  });
});

describe('habits', () => {
  const habits = buildHabits().map((h) => ({ ...h, enabled: true }));
  const h = (id: string) => habits.find((x) => x.id === id)!;

  it('scores inputs without rewarding less sleep', () => {
    expect(statusFor(h('sleep'), { value: 9 })).toBe('done');
    expect(statusFor(h('sleep'), { value: 11 })).toBe('done');
    expect(statusFor(h('sleep'), { value: 7.2 })).toBe('partial');
    expect(statusFor(h('sleep'), { value: 5 })).toBe('missed');
    expect(statusFor(h('reading'), { value: 20 })).toBe('done');
    expect(statusFor(h('reading'), { value: 5 })).toBe('partial');
    expect(statusFor(h('scrolling'), { value: 25 })).toBe('done');
    expect(statusFor(h('scrolling'), { value: 40 })).toBe('partial');
    expect(statusFor(h('scrolling'), { value: 120 })).toBe('missed');
    expect(statusFor(h('fitness'), { option: 'Rest / recovery' })).toBe('rest');
    expect(statusFor(h('fitness'), { option: 'Strength' })).toBe('done');
    expect(statusFor(h('snacking'), { option: 'Noticed afterwards' })).toBe('partial');
    expect(statusFor(h('tidy'), { done: false })).toBe(null);
  });

  it('adherence counts only planned habits, excludes rest and sensitive by default', () => {
    const date = '2026-11-23'; // Monday: fitness + skill practice planned, not mobility
    const entries: HabitEntry[] = [
      { id: 'a', habitId: 'reading', date, status: 'done', value: 20, text: '', extra: {}, notes: '', planned: true, updatedAt: 0 },
      { id: 'b', habitId: 'fitness', date, status: 'rest', value: null, text: '', extra: {}, notes: '', planned: true, updatedAt: 0 },
      { id: 'c', habitId: 'mobility', date, status: 'done', value: 10, text: '', extra: {}, notes: '', planned: false, updatedAt: 0 },
    ];
    const a = dayAdherence(habits, entries, date);
    const plannedMonday = habits.filter((x) => x.days.includes(1) && !x.sensitive && x.id !== 'fitness').length;
    expect(a.planned).toBe(plannedMonday);
    expect(a.score).toBe(1); // mobility is unplanned on Monday and doesn't inflate
    const withSensitive = dayAdherence(habits, entries, date, true);
    expect(withSensitive.planned).toBe(plannedMonday + 1);
  });
});

describe('stats & achievements', () => {
  const challenges = buildChallenges(0);
  const habits = buildHabits().map((h) => ({ ...h, enabled: true }));
  const start = '2026-11-20';
  const prog = (id: string, status: ChallengeProgress['status'], completedAt: number | null): ChallengeProgress => ({
    id, challengeId: id, status, rescheduledTo: null, startedAt: completedAt, completedAt, completedOn: null, completedEarly: false, pausedAt: null, activeSince: null, activeMs: 0, notes: '', metrics: {}, checked: [], prepDone: [], selfAssessment: null, missedAck: null, history: [], updatedAt: 0,
  });

  it('counts statuses honestly', () => {
    const progress = new Map([['day-01', prog('day-01', 'completed', 1)], ['day-02', prog('day-02', 'attempted', 2)]]);
    const counts = challengeCounts(statusesFor(start, '2026-11-23', challenges, progress));
    expect(counts.completed).toBe(1);
    expect(counts.attempted).toBe(1);
    expect(counts.missed).toBe(1); // day 3
    expect(counts.available).toBe(1); // day 4
    expect(counts.upcoming).toBe(26);
    expect(counts.remaining).toBe(29);
  });

  it('achievements derive from records and disappear when undone', () => {
    const base = { startDate: start, today: '2026-11-23', timezone: SYD, challenges, attempts: [], reflections: [], habits, entries: [] };
    const withDone = deriveAchievements({ ...base, progress: new Map([['day-01', prog('day-01', 'completed', 100)]]) });
    expect(withDone.map((a) => a.type)).toContain('first_completed');
    const undone = deriveAchievements({ ...base, progress: new Map([['day-01', prog('day-01', 'paused', null)]]) });
    expect(undone.map((a) => a.type)).not.toContain('first_completed');
    const day30 = deriveAchievements({ ...base, today: '2026-12-19', progress: new Map() });
    expect(day30.map((a) => a.type)).toEqual(expect.arrayContaining(['halfway', 'final_day']));
    expect(day30.map((a) => a.type)).not.toContain('all_completed');
  });

  it('weekly stats only include elapsed days and most-skipped excludes sensitive habits', () => {
    const weeks = weeklyStats(start, '2026-11-22', challenges, new Map(), habits, []);
    expect(weeks).toHaveLength(1);
    expect(weeks[0]?.challengesDue).toBe(3);
    expect(weeks[0]?.habitRate).toBe(0);
    const skipped = mostSkipped(habits, [], ['2026-11-20', '2026-11-21', '2026-11-22'], '2026-11-22');
    expect(skipped.find((s) => s.habitId === 'personal')).toBeUndefined();
    expect(skipped.find((s) => s.habitId === 'reading')?.planned).toBe(2);
  });
});

describe('reminders', () => {
  const reminders: Reminder[] = [
    { id: 'morning', type: 'morning', time: '08:00', enabled: true, delivery: 'system' },
    { id: 'evening', type: 'evening', time: '20:30', enabled: true, delivery: 'system' },
    { id: 'bedtime', type: 'bedtime', time: '22:00', enabled: false, delivery: 'system' },
  ];
  const settings = { timezone: SYD, quietHours: { enabled: true, start: '22:30', end: '07:00' } };

  it('fires once per day within the grace window', () => {
    const at = zonedToEpoch('2026-11-20', '08:05', SYD);
    const due = dueReminders(reminders, settings, at, new Set());
    expect(due.map((d) => d.reminder.id)).toEqual(['morning']);
    expect(dueReminders(reminders, settings, at, new Set(['morning|2026-11-20']))).toHaveLength(0);
    const late = zonedToEpoch('2026-11-20', '11:00', SYD);
    expect(dueReminders(reminders, settings, late, new Set())).toHaveLength(0);
  });

  it('marks quiet-hour reminders as suppressed and skips disabled', () => {
    const r: Reminder[] = [{ ...reminders[2]!, enabled: true, time: '23:00' }];
    const due = dueReminders(r, settings, zonedToEpoch('2026-11-20', '23:01', SYD), new Set());
    expect(due[0]?.suppressed).toBe(true);
    expect(dueReminders(reminders, settings, zonedToEpoch('2026-11-20', '22:01', SYD), new Set()).map((d) => d.reminder.id)).toEqual(['evening']); // bedtime disabled
  });

  it('keeps local wall time across DST', () => {
    const now = zonedToEpoch('2026-10-03', '09:00', SYD);
    const items = upcomingSchedule(reminders, settings, now, 2).filter((i) => i.type === 'morning');
    expect(items.map((i) => new Date(i.at).toISOString())).toEqual(['2026-10-03T21:00:00.000Z', '2026-10-04T21:00:00.000Z']);
  });

  it('never includes habit names', () => {
    const m = reminderMessage('morning', { startDate: '2026-11-20', length: 30, date: '2026-11-27', challengeTitle: 'Learn to Play Table Tennis Competitively', hardMode: false, openItems: 0 });
    expect(m.body).toBe("Day 8/30 is ready. Today's challenge: Learn to Play Table Tennis Competitively. Open your checklist and plan your day.");
    const e = reminderMessage('evening', { startDate: '2026-11-20', length: 30, date: '2026-11-27', challengeTitle: null, hardMode: true, openItems: 3 });
    expect(e.body).not.toMatch(/personal|habit goal/i);
  });
});

describe('ics, arithmetic, pi', () => {
  it('escapes and folds', () => {
    expect(icsEscape('a,b;c\\d\ne')).toBe('a\\,b\\;c\\\\d\\ne');
    const f = fold('X'.repeat(160));
    expect(f.split('\r\n').every((l) => l.length <= 75)).toBe(true);
  });

  it('builds 60 events for two reminders', () => {
    const ics = buildIcs({ startDate: '2026-11-20', timezone: SYD, challenges: buildChallenges(0), reminders: [
      { id: 'morning', type: 'morning', time: '08:00', enabled: true, delivery: 'system' },
      { id: 'evening', type: 'evening', time: '20:30', enabled: true, delivery: 'system' },
    ], now: 0 });
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(60);
    expect(ics).toContain('DTSTART:20261119T210000Z'); // 08:00 AEDT on 20 Nov
    expect(ics).not.toMatch(/Personal habit/);
  });

  it('generates integer arithmetic deterministically', () => {
    const a = makeTest(42, 30);
    expect(makeTest(42, 30)).toEqual(a);
    for (const q of a) expect(Number.isInteger(q.answer)).toBe(true);
    const r = rng(1);
    expect(r()).toBeGreaterThanOrEqual(0);
  });

  it('checks pi attempts', () => {
    expect(PI_100).toHaveLength(100);
    expect(checkPi(PI_100).streak).toBe(100);
    expect(checkPi('3.14159').streak).toBe(5);
    const wrong = checkPi('14159265350');
    expect(wrong.streak).toBe(10);
    expect(wrong.firstErrorAt).toBe(11);
  });
});

describe('backup reminder', () => {
  const day = 86_400_000;
  const created = 1_700_000_000_000;
  const s = { createdAt: created, lastBackupAt: null as number | null, backupSnoozedUntil: null as number | null };

  it('waits a week and needs something worth keeping', () => {
    expect(backupDue(s, true, created + 6 * day)).toBe(false);
    expect(backupDue(s, false, created + 30 * day)).toBe(false);
    expect(backupDue(s, true, created + 7 * day)).toBe(true);
  });

  it('asks again two weeks after the last backup and respects "Later"', () => {
    const backed = { ...s, lastBackupAt: created + 10 * day };
    expect(backupDue(backed, true, created + 23 * day)).toBe(false);
    expect(backupDue(backed, true, created + 24 * day)).toBe(true);
    expect(backupDue({ ...backed, backupSnoozedUntil: created + 30 * day }, true, created + 25 * day)).toBe(false);
    expect(backupDue({ ...backed, backupSnoozedUntil: created + 30 * day }, true, created + 30 * day)).toBe(true);
  });
});
