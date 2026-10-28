import { personalBests, type PbEvent } from './criteria';
import { addDays, diffDays, startOfDayEpoch } from './dates';
import { dayAdherence, displayName, isPlannedOn, type DayAdherence } from './habits';
import { DEFAULT_PROGRAM_DAYS, displayStatus, programDayFor, scheduledDateFor } from './schedule';
import type { Achievement, AchievementType, Attempt, Challenge, ChallengeProgress, DisplayStatus, Habit, HabitEntry, IsoDate, Reflection } from './types';

export type ProgressMap = ReadonlyMap<string, ChallengeProgress>;

export interface ChallengeCounts {
  completed: number;
  attempted: number;
  missed: number;
  inProgress: number;
  upcoming: number;
  available: number;
  rescheduled: number;
  remaining: number;
  rest: number;
}

export function statusesFor(startDate: IsoDate, today: IsoDate, challenges: readonly Challenge[], progress: ProgressMap): Map<string, DisplayStatus> {
  return new Map(challenges.map((c) => [c.id, displayStatus(startDate, today, c, progress.get(c.id))]));
}

export function challengeCounts(statuses: ReadonlyMap<string, DisplayStatus>): ChallengeCounts {
  const c: ChallengeCounts = { completed: 0, attempted: 0, missed: 0, inProgress: 0, upcoming: 0, available: 0, rescheduled: 0, remaining: 0, rest: 0 };
  for (const s of statuses.values()) {
    if (s === 'completed') c.completed++;
    else if (s === 'attempted') c.attempted++;
    else if (s === 'missed') c.missed++;
    else if (s === 'in_progress') c.inProgress++;
    else if (s === 'upcoming') c.upcoming++;
    else if (s === 'available') c.available++;
    else if (s === 'rescheduled') c.rescheduled++;
    else if (s === 'rest') c.rest++;
  }
  // Rest days aren't challenges: they never count as remaining or missed.
  c.remaining = statuses.size - c.rest - c.completed;
  return c;
}

/** Program dates from Day 1 up to and including `today` (capped at the last day). */
export function elapsedProgramDates(startDate: IsoDate, today: IsoDate, length: number = DEFAULT_PROGRAM_DAYS): IsoDate[] {
  const days = Math.min(length, programDayFor(startDate, today));
  return Array.from({ length: Math.max(0, days) }, (_, i) => addDays(startDate, i));
}

export function habitSeries(habits: readonly Habit[], entries: readonly HabitEntry[], dates: readonly IsoDate[], includeSensitive = false): DayAdherence[] {
  return dates.map((d) => dayAdherence(habits, entries, d, includeSensitive));
}

export interface WeekStats {
  week: number;
  label: string;
  from: IsoDate;
  to: IsoDate;
  habitRate: number | null;
  challengesDue: number;
  challengesCompleted: number;
  challengesAttempted: number;
  /** Combined commitment completion: planned habits + due challenges. */
  commitmentRate: number | null;
  complete: boolean;
}

/** Program weeks: days 1–7, 8–14, … up to the program length (one challenge per day). Only elapsed days count. */
export function weeklyStats(startDate: IsoDate, today: IsoDate, challenges: readonly Challenge[], progress: ProgressMap, habits: readonly Habit[], entries: readonly HabitEntry[]): WeekStats[] {
  const out: WeekStats[] = [];
  const length = challenges.length || DEFAULT_PROGRAM_DAYS;
  for (let w = 0; w * 7 < length; w++) {
    const firstDay = w * 7 + 1;
    const lastDay = Math.min(length, firstDay + 6);
    const from = scheduledDateFor(startDate, firstDay);
    const to = scheduledDateFor(startDate, lastDay);
    if (from > today) break;
    let planned = 0;
    let score = 0;
    for (let d = from; d <= to && d <= today; d = addDays(d, 1)) {
      const a = dayAdherence(habits, entries, d);
      planned += a.planned;
      score += a.score;
    }
    let due = 0;
    let completed = 0;
    let attempted = 0;
    for (const c of challenges) {
      if (c.day < firstDay || c.day > lastDay || c.kind === 'rest') continue;
      const date = scheduledDateFor(startDate, c.day);
      if (date > today) continue;
      due++;
      const s = progress.get(c.id)?.status;
      if (s === 'completed') completed++;
      else if (s === 'attempted') attempted++;
    }
    const totalPlanned = planned + due;
    out.push({
      week: w + 1,
      label: `Week ${w + 1}`,
      from,
      to,
      habitRate: planned ? score / planned : null,
      challengesDue: due,
      challengesCompleted: completed,
      challengesAttempted: attempted,
      commitmentRate: totalPlanned ? (score + completed) / totalPlanned : null,
      complete: to < today,
    });
  }
  return out;
}

export interface CategoryStat {
  category: string;
  total: number;
  completed: number;
  attempted: number;
}

export function categoryBreakdown(challenges: readonly Challenge[], progress: ProgressMap): CategoryStat[] {
  const map = new Map<string, CategoryStat>();
  for (const c of challenges) {
    if (c.kind === 'rest') continue;
    const s = map.get(c.category) ?? { category: c.category, total: 0, completed: 0, attempted: 0 };
    s.total++;
    const st = progress.get(c.id)?.status;
    if (st === 'completed') s.completed++;
    if (st === 'attempted') s.attempted++;
    map.set(c.category, s);
  }
  return [...map.values()].sort((a, b) => b.completed + b.attempted - (a.completed + a.attempted) || a.category.localeCompare(b.category));
}

export function allPbEvents(challenges: readonly Challenge[], progress: ProgressMap, attempts: readonly Attempt[]): PbEvent[] {
  return challenges.flatMap((c) => personalBests(c, progress.get(c.id) ?? null, attempts).events).sort((a, b) => a.at - b.at);
}

export interface SkippedStat {
  habitId: string;
  name: string;
  planned: number;
  missed: number;
  rate: number;
}

/** Planned-but-not-done counts for fully elapsed days (today excluded). Sensitive habits excluded. */
export function mostSkipped(habits: readonly Habit[], entries: readonly HabitEntry[], dates: readonly IsoDate[], today: IsoDate): SkippedStat[] {
  const byKey = new Map(entries.map((e) => [`${e.habitId}|${e.date}`, e]));
  const out: SkippedStat[] = [];
  for (const h of habits) {
    if (h.sensitive || !h.enabled) continue;
    let planned = 0;
    let missed = 0;
    for (const d of dates) {
      if (d >= today || !isPlannedOn(h, d)) continue;
      const e = byKey.get(`${h.id}|${d}`);
      if (e?.status === 'rest') continue;
      planned++;
      if (!e || e.status === 'missed' || e.status === 'skipped') missed++;
    }
    if (planned) out.push({ habitId: h.id, name: displayName(h), planned, missed, rate: missed / planned });
  }
  return out.filter((s) => s.missed > 0).sort((a, b) => b.rate - a.rate || b.missed - a.missed);
}

export function suggestions(args: { skipped: SkippedStat[]; weeks: WeekStats[]; missedChallenges: number; habits: readonly Habit[]; entries: readonly HabitEntry[] }): string[] {
  const out: string[] = [];
  const top = args.skipped[0];
  if (top && top.rate >= 0.5) {
    out.push(`“${top.name}” was missed on ${top.missed} of ${top.planned} planned days. Shrink it (smaller target) or move it to fewer days so the plan matches reality.`);
  }
  if (args.missedChallenges > 0) {
    out.push(`${args.missedChallenges} challenge${args.missedChallenges > 1 ? 's are' : ' is'} marked missed. Pick a catch-up date for each, or log an honest attempt — don't leave them open.`);
  }
  const done = args.weeks.filter((w) => w.complete && w.commitmentRate !== null);
  if (done.length >= 2) {
    const [a, b] = done.slice(-2);
    if (a && b && b.commitmentRate !== null && a.commitmentRate !== null && b.commitmentRate < a.commitmentRate - 0.1) {
      out.push(`Consistency dropped from ${pct(a.commitmentRate)} to ${pct(b.commitmentRate)} last week. Identify the one day that went worst and plan it first this week.`);
    }
  }
  const sleep = args.habits.find((h) => h.id === 'sleep');
  if (sleep) {
    const recent = args.entries.filter((e) => e.habitId === 'sleep' && e.value !== null).slice(-7);
    const short = recent.filter((e) => (e.value ?? 0) < (sleep.target ?? 8));
    if (recent.length >= 3 && short.length / recent.length > 0.5) {
      out.push('Sleep is under target on most recent nights. Protect sleep before adding training volume — it drives everything else.');
    }
  }
  if (!out.length) out.push('No obvious weak spot yet. Keep logging honestly so the patterns become visible.');
  return out;
}

export const pct = (x: number | null) => (x === null ? '—' : `${Math.round(x * 100)}%`);

// ---------------------------------------------------------------- achievements

export const ACHIEVEMENTS: Record<AchievementType, { title: string; description: string }> = {
  first_completed: { title: 'First Challenge Completed', description: 'Met the criteria for your first challenge.' },
  seven_attempted: { title: 'Seven Challenges Attempted', description: 'Seven challenges completed or honestly attempted.' },
  first_pb: { title: 'First Personal Best', description: 'Beat a previously logged measurement.' },
  ten_completed: { title: 'Ten Challenges Completed', description: 'Ten challenges with their criteria met.' },
  halfway: { title: 'Halfway Through', description: 'Reached the halfway day of the program.' },
  final_day: { title: 'Final Day Reached', description: 'Reached the last day of the program.' },
  all_completed: { title: 'Every Challenge Completed', description: 'Every challenge in the program completed.' },
  first_reflection: { title: 'First Reflection', description: 'Completed an evening check-in.' },
  week_consistent: { title: 'Consistent Week', description: 'A full program week with at least 80% habit adherence.' },
};

/**
 * Achievements derived purely from stored records, so undoing a completion removes the achievement.
 * `relatedEvent` names the record that earned it.
 */
export function deriveAchievements(args: {
  startDate: IsoDate;
  today: IsoDate;
  timezone: string;
  challenges: readonly Challenge[];
  progress: ProgressMap;
  attempts: readonly Attempt[];
  reflections: readonly Reflection[];
  habits: readonly Habit[];
  entries: readonly HabitEntry[];
}): Achievement[] {
  const out: Achievement[] = [];
  const add = (type: AchievementType, earnedAt: number, relatedEvent: string) => out.push({ id: type, type, earnedAt, relatedEvent });
  const byId = new Map(args.challenges.map((c) => [c.id, c]));
  const finished = [...args.progress.values()]
    .filter((p) => (p.status === 'completed' || p.status === 'attempted') && p.completedAt !== null && byId.has(p.challengeId))
    .sort((a, b) => (a.completedAt ?? 0) - (b.completedAt ?? 0));
  const completed = finished.filter((p) => p.status === 'completed');
  const label = (p: ChallengeProgress) => `Day ${byId.get(p.challengeId)?.day}: ${byId.get(p.challengeId)?.title}`;

  if (completed[0]) add('first_completed', completed[0].completedAt ?? 0, label(completed[0]));
  if (finished[6]) add('seven_attempted', finished[6].completedAt ?? 0, label(finished[6]));
  if (completed[9]) add('ten_completed', completed[9].completedAt ?? 0, label(completed[9]));
  const length = args.challenges.length || DEFAULT_PROGRAM_DAYS;
  const realChallenges = args.challenges.filter((c) => c.kind !== 'rest').length;
  if (realChallenges > 0 && completed.length === realChallenges) {
    const last = completed[completed.length - 1];
    if (last) add('all_completed', last.completedAt ?? 0, label(last));
  }
  const pbs = allPbEvents(args.challenges, args.progress, args.attempts);
  if (pbs[0]) add('first_pb', pbs[0].at, `${byId.get(pbs[0].challengeId)?.title ?? ''}: ${pbs[0].label} ${pbs[0].previous} → ${pbs[0].value}`);

  const dayNow = programDayFor(args.startDate, args.today);
  const half = Math.ceil(length / 2);
  if (dayNow >= half) add('halfway', startOfDayEpoch(scheduledDateFor(args.startDate, half), args.timezone), `Program Day ${half} reached`);
  if (dayNow >= length) add('final_day', startOfDayEpoch(scheduledDateFor(args.startDate, length), args.timezone), `Program Day ${length} reached`);

  const firstReflection = [...args.reflections].filter((r) => r.entry || r.takeaway || r.mood || r.improvement || r.proud || r.difficult || r.change || r.completedChallenge).sort((a, b) => a.date.localeCompare(b.date))[0];
  if (firstReflection) add('first_reflection', firstReflection.updatedAt, `Reflection on ${firstReflection.date}`);

  const weeks = weeklyStats(args.startDate, args.today, args.challenges, args.progress, args.habits, args.entries);
  const good = weeks.find((w) => w.complete && w.to < args.today && diffDays(w.from, w.to) === 6 && (w.habitRate ?? 0) >= 0.8);
  if (good) add('week_consistent', startOfDayEpoch(addDays(good.to, 1), args.timezone), `${good.label}: ${pct(good.habitRate)} habit adherence`);

  return out.sort((a, b) => a.earnedAt - b.earnedAt);
}

/**
 * Consecutive days (ending today, or yesterday if today has nothing logged yet) with at least one
 * completed habit or a finished/attempted challenge. Informational only — nothing is reset or penalised.
 */
export function activeStreak(entries: readonly HabitEntry[], progress: readonly ChallengeProgress[], today: IsoDate): number {
  const active = new Set<IsoDate>();
  for (const e of entries) if (e.status === 'done' || e.status === 'partial') active.add(e.date);
  for (const p of progress) if (p.completedOn) active.add(p.completedOn);
  let d = active.has(today) ? today : addDays(today, -1);
  let n = 0;
  while (active.has(d)) {
    n++;
    d = addDays(d, -1);
  }
  return n;
}
