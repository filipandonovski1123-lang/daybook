import { buildChallenges, dayId, instantiate } from '../data/challenges';
import { customToItem, getLibraryItem, type LibraryItem } from '../data/library';
import { REST_ID } from '../domain/planner';
import { buildHabits } from '../data/habits';
import { BACKUP_SNOOZE } from '../domain/backupReminder';
import { addDays, detectTimeZone, isValidIso, isValidTimeZone, todayIn } from '../domain/dates';
import { entryId, isPlannedOn, statusFor, type EntryInput } from '../domain/habits';
import { endDateFor, isFuture } from '../domain/schedule';
import {
  challengeSchema,
  habitSchema,
  MAX_PROGRAM_DAYS,
  MIN_PROGRAM_DAYS,
  customChallengeSchema,
  type ChallengeTheme,
  type CustomChallenge,
  type DifficultyCurve,
  type LifeStage,
  type Achievement,
  type Attempt,
  type Challenge,
  type ChallengeProgress,
  type Habit,
  type HabitEntry,
  type HabitEntryStatus,
  type IsoDate,
  type MetricValue,
  type MissedAdjustment,
  type MissedReason,
  type Program,
  type Reflection,
  type Reminder,
  type Settings,
  type TimerState,
} from '../domain/types';
import { db, newId } from './db';

export class UserError extends Error {}

// ---------------------------------------------------------------- defaults & seeding

export function defaultSettings(now = Date.now()): Settings {
  return {
    id: 'settings',
    displayName: '',
    timezone: detectTimeZone(),
    wakeTime: '07:30',
    sleepTargetHours: 8.5,
    bedtime: '22:30',
    quietHours: { enabled: true, start: '22:30', end: '07:00' },
    theme: 'light',
    palette: 'editorial',
    hardMode: false,
    reducedMotion: 'system',
    hideSensitiveOnToday: false,
    // Nearly everyone has these; the rest is ticked in Settings so setup stays short.
    equipment: ['recorder', 'camera', 'kitchen'],
    constraints: '',
    onboarded: false,
    lifeStage: 'early',
    lastBackupAt: null,
    backupSnoozedUntil: null,
    createdAt: now,
  };
}

export function defaultReminders(): Reminder[] {
  return [
    { id: 'morning', type: 'morning', time: '08:00', enabled: true, delivery: 'system' },
    { id: 'evening', type: 'evening', time: '20:30', enabled: true, delivery: 'system' },
    { id: 'bedtime', type: 'bedtime', time: '22:00', enabled: false, delivery: 'system' },
  ];
}

/** Seed missing data. Idempotent and never overwrites existing records. */
export async function ensureSeeded(now = Date.now()): Promise<void> {
  await db.transaction('rw', [db.settings, db.challenges, db.habits, db.reminders], async () => {
    if (!(await db.settings.get('settings'))) await db.settings.add(defaultSettings(now));
    if ((await db.challenges.count()) === 0) await db.challenges.bulkAdd(buildChallenges(now));
    if ((await db.habits.count()) === 0) await db.habits.bulkAdd(buildHabits());
    if ((await db.reminders.count()) === 0) await db.reminders.bulkAdd(defaultReminders());
  });
}

async function requireSettings(): Promise<Settings> {
  const s = await db.settings.get('settings');
  if (!s) throw new UserError('Settings missing — reload the app.');
  return s;
}

async function requireProgram(): Promise<Program> {
  const p = await db.program.get('program');
  if (!p) throw new UserError('Set a start date first.');
  return p;
}

export async function today(): Promise<IsoDate> {
  return todayIn((await requireSettings()).timezone);
}

// ---------------------------------------------------------------- onboarding & settings

export interface OnboardingInput {
  displayName: string;
  startDate: IsoDate;
  timezone: string;
  wakeTime: string;
  morningTime: string;
  eveningTime: string;
  bedtime: string;
  sleepTargetHours: number | null;
  notifications: boolean;
  bedtimeReminder: boolean;
  enabledHabits: string[];
  equipment: string[];
  constraints: string;
  hardMode: boolean;
  /** Library ids in day order (day 1 first). Its length is the program length. */
  plan: string[];
  mode: Program['mode'];
  themes: ChallengeTheme[];
  curve: DifficultyCurve;
  restEvery: number;
  lifeStage: LifeStage;
  tracks: string[];
  timeBudget: Program['timeBudget'];
  wildcards: Program['wildcards'];
  includeFun: boolean;
}

/** Plan settings stored on the program alongside the challenges. */
export type PlanSettings = Pick<Program, 'mode' | 'themes' | 'curve' | 'restEvery' | 'tracks' | 'timeBudget' | 'wildcards' | 'includeFun'>;

/** Look up a challenge by id: built-in, rest day, or one the user made. */
export async function resolveLibraryItem(id: string): Promise<LibraryItem | undefined> {
  const builtIn = getLibraryItem(id);
  if (builtIn) return builtIn;
  const custom = id.startsWith('custom:') ? await db.customChallenges.get(id) : undefined;
  return custom ? customToItem(custom) : undefined;
}

/** Turn a list of library ids into day rows. Throws on unknown ids or a bad length. */
async function planToChallenges(plan: readonly string[], now: number, stage?: LifeStage): Promise<Challenge[]> {
  if (plan.length < MIN_PROGRAM_DAYS || plan.length > MAX_PROGRAM_DAYS) throw new UserError(`A program must be ${MIN_PROGRAM_DAYS}–${MAX_PROGRAM_DAYS} days.`);
  const real = plan.filter((id) => id !== REST_ID);
  if (new Set(real).size !== real.length) throw new UserError('Each challenge can only appear once in a plan.');
  if (real.length === 0) throw new UserError('A plan needs at least one challenge.');
  const out: Challenge[] = [];
  for (const [i, id] of plan.entries()) {
    const item = await resolveLibraryItem(id);
    if (!item) throw new UserError('That challenge is no longer available. Pick another.');
    out.push(instantiate(item, i + 1, now, stage));
  }
  return out;
}

export async function completeOnboarding(input: OnboardingInput, now = Date.now()): Promise<void> {
  if (!isValidIso(input.startDate)) throw new UserError('Choose a valid start date.');
  if (!isValidTimeZone(input.timezone)) throw new UserError('Unknown timezone.');
  const challenges = await planToChallenges(input.plan, now, input.lifeStage);
  await db.transaction('rw', [db.settings, db.program, db.habits, db.reminders, db.challenges, db.progress], async () => {
    const s = await requireSettings();
    await db.settings.put({
      ...s,
      displayName: input.displayName.trim().slice(0, 60),
      timezone: input.timezone,
      wakeTime: input.wakeTime,
      bedtime: input.bedtime,
      sleepTargetHours: input.sleepTargetHours,
      equipment: input.equipment,
      constraints: input.constraints.slice(0, 2000),
      hardMode: input.hardMode,
      lifeStage: input.lifeStage,
      onboarded: true,
    });
    const existing = await db.program.get('program');
    await db.program.put({
      id: 'program',
      name: `${challenges.length}-Day Challenge`,
      startDate: input.startDate,
      endDate: endDateFor(input.startDate, challenges.length),
      length: challenges.length,
      mode: input.mode,
      themes: input.themes,
      curve: input.curve,
      restEvery: input.restEvery,
      tracks: input.tracks,
      timeBudget: input.timeBudget,
      wildcards: input.wildcards,
      includeFun: input.includeFun,
      startedAt: existing?.startedAt ?? null,
      history: existing?.history ?? [],
    });
    // A fresh plan: nothing has been logged yet during onboarding.
    await db.challenges.clear();
    await db.challenges.bulkAdd(challenges);
    await db.progress.clear();
    const habits = await db.habits.toArray();
    for (const h of habits) {
      const patch: Partial<Habit> = { enabled: input.enabledHabits.includes(h.id) };
      if (h.id === 'sleep' && input.sleepTargetHours) patch.target = input.sleepTargetHours;
      await db.habits.update(h.id, patch);
    }
    await db.reminders.update('morning', { time: input.morningTime, enabled: input.notifications, delivery: 'system' });
    await db.reminders.update('evening', { time: input.eveningTime, enabled: input.notifications, delivery: 'system' });
    const bed = minusMinutes(input.bedtime, 30);
    await db.reminders.update('bedtime', { time: bed, enabled: input.notifications && input.bedtimeReminder });
  });
  void now;
}

function minusMinutes(t: string, m: number): string {
  const [h, mm] = t.split(':').map(Number);
  const total = ((((h ?? 0) * 60 + (mm ?? 0) - m) % 1440) + 1440) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

export async function updateSettings(patch: Partial<Omit<Settings, 'id'>>): Promise<void> {
  if (patch.timezone !== undefined && !isValidTimeZone(patch.timezone)) throw new UserError('Unknown timezone.');
  const n = await db.settings.update('settings', patch);
  if (!n) throw new UserError('Settings missing — reload the app.');
}

export async function markBackedUp(now = Date.now()): Promise<void> {
  await updateSettings({ lastBackupAt: now, backupSnoozedUntil: null });
}

export async function snoozeBackupReminder(now = Date.now()): Promise<void> {
  await updateSettings({ backupSnoozedUntil: now + BACKUP_SNOOZE });
}

/** Has the program begun? Then date changes need explicit confirmation. */
export async function programHasStarted(): Promise<boolean> {
  const p = await db.program.get('program');
  if (!p) return false;
  if (p.startedAt) return true;
  const t = await today();
  if (t >= p.startDate) return true;
  const active = await db.progress.where('status').anyOf('in_progress', 'paused', 'completed', 'attempted').count();
  return active > 0;
}

/**
 * Move the program. Before it begins this is free; afterwards `confirmed` must be true.
 * Logged progress is kept intact — only the date mapping changes, and the change is recorded.
 */
export async function changeStartDate(newStart: IsoDate, opts: { confirmed: boolean; reason?: string }, now = Date.now()): Promise<void> {
  if (!isValidIso(newStart)) throw new UserError('Choose a valid date.');
  const started = await programHasStarted();
  if (started && !opts.confirmed) throw new UserError('The program has started — confirm before changing its dates.');
  await db.transaction('rw', db.program, async () => {
    const p = await requireProgram();
    if (p.startDate === newStart) return;
    await db.program.put({
      ...p,
      startDate: newStart,
      endDate: endDateFor(newStart, p.length),
      history: [...p.history, { at: now, from: p.startDate, to: newStart, reason: opts.reason ?? (started ? 'Changed after start' : 'Changed before start') }],
    });
  });
}

// ---------------------------------------------------------------- plan

/** True once anything has been logged against any challenge (then only single-day swaps are allowed). */
async function planHasActivity(): Promise<boolean> {
  const active = await db.progress.where('status').anyOf('in_progress', 'paused', 'completed', 'attempted').count();
  return active > 0 || (await db.attempts.count()) > 0 || (await db.evidence.count()) > 0;
}

/**
 * Replace the whole plan (and with it the program length). Only before anything has been logged —
 * afterwards individual future days can still be swapped.
 */
export async function replacePlan(plan: string[], opts: Partial<PlanSettings> & Pick<PlanSettings, 'mode'>, now = Date.now()): Promise<void> {
  const stage = (await db.settings.get('settings'))?.lifeStage;
  const challenges = await planToChallenges(plan, now, stage);
  if (await planHasActivity()) throw new UserError('You’ve already logged progress, so the plan can’t be rebuilt. Swap individual upcoming days instead.');
  await db.transaction('rw', [db.program, db.challenges, db.progress], async () => {
    const p = await requireProgram();
    await db.challenges.clear();
    await db.challenges.bulkAdd(challenges);
    await db.progress.clear();
    await db.program.put({ ...p, length: challenges.length, name: `${challenges.length}-Day Challenge`, endDate: endDateFor(p.startDate, challenges.length), mode: opts.mode, themes: opts.themes ?? p.themes ?? [], curve: opts.curve ?? p.curve ?? 'steady', restEvery: opts.restEvery ?? p.restEvery ?? 0, tracks: opts.tracks ?? p.tracks ?? [], timeBudget: opts.timeBudget ?? p.timeBudget ?? 'medium', wildcards: opts.wildcards ?? p.wildcards ?? 'some', includeFun: opts.includeFun ?? p.includeFun ?? true });
  });
}

/** Can this day still be swapped for a different challenge? */
export async function canSwapDay(day: number): Promise<boolean> {
  const id = dayId(day);
  const p = await db.progress.get(id);
  if (p && p.status !== 'not_started') return false;
  return (await db.attempts.where('challengeId').equals(id).count()) === 0 && (await db.evidence.where('challengeId').equals(id).count()) === 0;
}

/** Put a different library challenge on one day. The old definition is kept as a revision. */
export async function swapDay(day: number, libraryId: string, now = Date.now()): Promise<void> {
  const item = await resolveLibraryItem(libraryId);
  if (!item) throw new UserError('That challenge isn’t available.');
  if (!(await canSwapDay(day))) throw new UserError('This day already has progress logged, so it can’t be swapped.');
  const id = dayId(day);
  await db.transaction('rw', [db.challenges, db.revisions, db.progress, db.settings], async () => {
    const current = await db.challenges.get(id);
    if (!current) throw new UserError('Day not found.');
    const dupe = libraryId === REST_ID ? undefined : (await db.challenges.toArray()).find((c) => c.libraryId === libraryId && c.id !== id);
    if (dupe) throw new UserError(`That challenge is already on Day ${dupe.day}.`);
    await db.revisions.add({ id: newId('rev'), challengeId: id, at: now, previous: current });
    const stage = (await db.settings.get('settings'))?.lifeStage;
    await db.challenges.put(instantiate(item, day, now, stage));
    // Preparation ticks and notes belonged to the old challenge.
    await db.progress.delete(id);
  });
}

// ---------------------------------------------------------------- your own challenges

export type CustomChallengeInput = Omit<CustomChallenge, 'id' | 'createdAt' | 'updatedAt'>;

export async function saveCustomChallenge(input: CustomChallengeInput, id: string | null = null, now = Date.now()): Promise<CustomChallenge> {
  const existing = id ? await db.customChallenges.get(id) : undefined;
  const parsed = customChallengeSchema.safeParse({
    ...input,
    preparation: input.preparation.map((s) => s.trim()).filter(Boolean),
    learningPlan: input.learningPlan.map((s) => s.trim()).filter(Boolean),
    id: existing?.id ?? `custom:${newId('c').slice(2)}`,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  });
  if (!parsed.success) throw new UserError(parsed.error.issues[0]?.message ?? 'Check the challenge details.');
  await db.customChallenges.put(parsed.data);
  return parsed.data;
}

/** Remove a user-made challenge. Refused while it's in the plan, so no day loses its definition. */
export async function deleteCustomChallenge(id: string): Promise<void> {
  const used = await db.challenges.filter((c) => c.libraryId === id).first();
  if (used) throw new UserError(`It’s on Day ${used.day} of your plan. Swap that day first.`);
  await db.customChallenges.delete(id);
}

// ---------------------------------------------------------------- challenge progress

export function blankProgress(challengeId: string, now = Date.now()): ChallengeProgress {
  return {
    id: challengeId,
    challengeId,
    status: 'not_started',
    rescheduledTo: null,
    startedAt: null,
    completedAt: null,
    completedOn: null,
    completedEarly: false,
    pausedAt: null,
    activeSince: null,
    activeMs: 0,
    notes: '',
    metrics: {},
    checked: [],
    prepDone: [],
    selfAssessment: null,
    missedAck: null,
    history: [],
    updatedAt: now,
  };
}

async function mutateProgress(challengeId: string, fn: (p: ChallengeProgress, ctx: { challenge: Challenge; program: Program; today: IsoDate }) => ChallengeProgress | void, now = Date.now()): Promise<ChallengeProgress> {
  return db.transaction('rw', [db.progress, db.challenges, db.program, db.settings], async () => {
    const challenge = await db.challenges.get(challengeId);
    if (!challenge) throw new UserError('Challenge not found.');
    const program = await requireProgram();
    const t = await today();
    const current = (await db.progress.get(challengeId)) ?? blankProgress(challengeId, now);
    const draft: ChallengeProgress = structuredClone(current);
    const result = fn(draft, { challenge, program, today: t }) ?? draft;
    result.updatedAt = now;
    await db.progress.put(result);
    if (!program.startedAt && result.status !== 'not_started') await db.program.update('program', { startedAt: now });
    return result;
  });
}

const log = (p: ChallengeProgress, action: string, now: number, detail?: string) => p.history.push({ at: now, action, ...(detail ? { detail } : {}) });

export async function startChallenge(id: string, opts: { early?: boolean } = {}, now = Date.now()) {
  return mutateProgress(id, (p, { challenge, program, today: t }) => {
    if (p.status === 'in_progress') return; // duplicate click
    if (p.status === 'completed') throw new UserError('Already completed. Undo completion first to restart.');
    if (isFuture(program.startDate, t, challenge, p) && !opts.early) throw new UserError('This challenge is scheduled for a future date. Confirm to start it early.');
    if (p.status === 'attempted') {
      // Retrying after an honest attempt: the attempt stays in history.
      p.completedAt = null;
      p.completedOn = null;
    }
    log(p, p.history.some((h) => h.action === 'started') ? 'resumed' : 'started', now);
    p.status = 'in_progress';
    p.startedAt ??= now;
    p.pausedAt = null;
    p.activeSince = now;
  }, now);
}

export async function pauseChallenge(id: string, now = Date.now()) {
  return mutateProgress(id, (p) => {
    if (p.status !== 'in_progress') return;
    if (p.activeSince) p.activeMs += Math.max(0, now - p.activeSince);
    p.activeSince = null;
    p.status = 'paused';
    p.pausedAt = now;
    log(p, 'paused', now);
  }, now);
}

export async function completeChallenge(id: string, opts: { outcome: 'completed' | 'attempted'; early?: boolean; note?: string }, now = Date.now()) {
  return mutateProgress(id, (p, { challenge, program, today: t }) => {
    if (p.status === opts.outcome) return; // duplicate click
    const future = isFuture(program.startDate, t, challenge, p);
    if (future && !opts.early) throw new UserError('This challenge is scheduled for a future date. Use “Complete early” to confirm.');
    if (p.activeSince) p.activeMs += Math.max(0, now - p.activeSince);
    p.activeSince = null;
    p.pausedAt = null;
    p.status = opts.outcome;
    p.startedAt ??= now;
    p.completedAt = now;
    p.completedOn = t;
    p.completedEarly = future;
    log(p, opts.outcome === 'completed' ? 'completed' : 'attempted', now, [future ? 'early override' : '', opts.note ?? ''].filter(Boolean).join(' · ') || undefined);
  }, now);
}

export async function undoCompletion(id: string, now = Date.now()) {
  return mutateProgress(id, (p) => {
    if (p.status !== 'completed' && p.status !== 'attempted') return;
    log(p, 'undo', now, `was ${p.status}`);
    p.status = p.startedAt ? 'paused' : 'not_started';
    p.completedAt = null;
    p.completedOn = null;
    p.completedEarly = false;
  }, now);
}

export async function rescheduleChallenge(id: string, to: IsoDate | null, now = Date.now()) {
  if (to !== null && !isValidIso(to)) throw new UserError('Choose a valid date.');
  return mutateProgress(id, (p, { today: t }) => {
    if (p.status === 'completed') throw new UserError('Completed challenges can’t be rescheduled.');
    if (to !== null && to < t) throw new UserError('Pick today or a future date.');
    log(p, to ? 'rescheduled' : 'reschedule cleared', now, to ? `${p.rescheduledTo ?? 'original date'} → ${to}` : undefined);
    p.rescheduledTo = to;
  }, now);
}

export async function setMetric(id: string, key: string, value: MetricValue, now = Date.now()) {
  return mutateProgress(id, (p) => {
    p.metrics = { ...p.metrics, [key]: value };
  }, now);
}

export async function setMetrics(id: string, values: Record<string, MetricValue>, now = Date.now()) {
  return mutateProgress(id, (p) => {
    p.metrics = { ...p.metrics, ...values };
  }, now);
}

export async function toggleCriterion(id: string, criterionId: string, on: boolean, now = Date.now()) {
  return mutateProgress(id, (p) => {
    const set = new Set(p.checked);
    if (on) set.add(criterionId);
    else set.delete(criterionId);
    p.checked = [...set];
  }, now);
}

export async function togglePrep(id: string, index: number, on: boolean, now = Date.now()) {
  return mutateProgress(id, (p) => {
    const set = new Set(p.prepDone);
    if (on) set.add(index);
    else set.delete(index);
    p.prepDone = [...set].sort((a, b) => a - b);
  }, now);
}

export async function setNotes(id: string, notes: string, now = Date.now()) {
  return mutateProgress(id, (p) => {
    p.notes = notes.slice(0, 20000);
  }, now);
}

export async function setSelfAssessment(id: string, value: number | null, now = Date.now()) {
  return mutateProgress(id, (p) => {
    p.selfAssessment = value;
  }, now);
}

export async function acknowledgeMissed(id: string, ack: { reason: MissedReason; adjustment: MissedAdjustment; note: string; rescheduleTo?: IsoDate | null }, now = Date.now()) {
  return mutateProgress(id, (p, { today: t }) => {
    p.missedAck = { at: now, reason: ack.reason, adjustment: ack.adjustment, note: ack.note.slice(0, 1000) };
    log(p, 'missed acknowledged', now, `${ack.reason} → ${ack.adjustment}`);
    if (ack.adjustment === 'reschedule' && ack.rescheduleTo) {
      if (ack.rescheduleTo < t) throw new UserError('Pick today or a future date.');
      log(p, 'rescheduled', now, `${p.rescheduledTo ?? 'original date'} → ${ack.rescheduleTo}`);
      p.rescheduledTo = ack.rescheduleTo;
    }
  }, now);
}

// ---------------------------------------------------------------- attempts

export async function logAttempt(input: Omit<Attempt, 'id' | 'at' | 'date'> & { at?: number }): Promise<Attempt> {
  const at = input.at ?? Date.now();
  const s = await requireSettings();
  const a: Attempt = { ...input, id: newId('att'), at, date: todayIn(s.timezone, at), label: input.label.slice(0, 200), note: input.note.slice(0, 4000) };
  await db.attempts.add(a);
  return a;
}

export async function deleteAttempt(id: string): Promise<void> {
  await db.attempts.delete(id);
}

// ---------------------------------------------------------------- evidence

export const MAX_FILE_BYTES = 50 * 1024 * 1024;

export function acceptsFile(accept: string, file: { type: string; name: string }): boolean {
  const rules = accept.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  if (!rules.length) return true;
  const type = file.type.toLowerCase();
  const name = file.name.toLowerCase();
  return rules.some((r) => (r.startsWith('.') ? name.endsWith(r) : r.endsWith('/*') ? type.startsWith(r.slice(0, -1)) : type === r));
}

export async function addEvidence(challengeId: string, file: File, tag: string | null, now = Date.now()): Promise<string> {
  const c = await db.challenges.get(challengeId);
  if (!c) throw new UserError('Challenge not found.');
  if (!c.evidence.enabled) throw new UserError('This challenge doesn’t take attachments.');
  if (file.size === 0) throw new UserError(`“${file.name}” is empty.`);
  if (file.size > MAX_FILE_BYTES) throw new UserError(`“${file.name}” is larger than 50 MB.`);
  if (!acceptsFile(c.evidence.accept, file)) throw new UserError(`“${file.name}” isn’t an accepted file type here.`);
  if (c.evidence.max) {
    const count = await db.evidence.where('challengeId').equals(challengeId).count();
    if (count >= c.evidence.max) throw new UserError(`This gallery holds up to ${c.evidence.max} files. Remove one first.`);
  }
  if (typeof navigator !== 'undefined' && navigator.storage?.estimate) {
    try {
      const { quota, usage } = await navigator.storage.estimate();
      if (quota && usage !== undefined && usage + file.size > quota * 0.95) throw new UserError('Not enough browser storage for this file. Export and remove older attachments first.');
    } catch (e) {
      if (e instanceof UserError) throw e;
    }
  }
  const id = newId('ev');
  let bytes: ArrayBuffer;
  try {
    bytes = await file.arrayBuffer();
  } catch {
    throw new UserError(`Couldn’t read “${file.name}”. Try again or pick a different file.`);
  }
  await db.transaction('rw', [db.evidence, db.evidenceFiles], async () => {
    await db.evidenceFiles.add({ id, bytes });
    await db.evidence.add({ id, challengeId, name: file.name.slice(0, 255), mime: file.type || 'application/octet-stream', size: bytes.byteLength, tag, caption: '', createdAt: now });
  });
  return id;
}

export async function updateEvidence(id: string, patch: { caption?: string; tag?: string | null }): Promise<void> {
  await db.evidence.update(id, { ...(patch.caption !== undefined ? { caption: patch.caption.slice(0, 500) } : {}), ...(patch.tag !== undefined ? { tag: patch.tag } : {}) });
}

export async function deleteEvidence(id: string): Promise<void> {
  await db.transaction('rw', [db.evidence, db.evidenceFiles], async () => {
    await db.evidence.delete(id);
    await db.evidenceFiles.delete(id);
  });
}

export async function evidenceBlob(id: string, mime: string): Promise<Blob | null> {
  const f = await db.evidenceFiles.get(id);
  return f ? new Blob([f.bytes], { type: mime }) : null;
}

// ---------------------------------------------------------------- challenge definitions

/** Edit a challenge definition. The previous version is kept as a revision; logs and progress are untouched. */
export async function updateChallenge(id: string, patch: Partial<Pick<Challenge, 'title' | 'category' | 'difficulty' | 'description' | 'objective' | 'bonus' | 'preparation' | 'learningPlan' | 'estimatedMinutes'>>, now = Date.now()): Promise<void> {
  await db.transaction('rw', [db.challenges, db.revisions], async () => {
    const c = await db.challenges.get(id);
    if (!c) throw new UserError('Challenge not found.');
    const next = challengeSchema.safeParse({ ...c, ...patch, updatedAt: now });
    if (!next.success) throw new UserError(next.error.issues[0]?.message ?? 'Invalid challenge.');
    await db.revisions.add({ id: newId('rev'), challengeId: id, at: now, previous: c });
    await db.challenges.put(next.data);
  });
}

export async function restoreChallengeDefault(id: string, now = Date.now()): Promise<void> {
  const seed = buildChallenges(now).find((c) => c.id === id);
  if (!seed) throw new UserError('No default exists for this challenge.');
  await db.transaction('rw', [db.challenges, db.revisions], async () => {
    const c = await db.challenges.get(id);
    if (c) await db.revisions.add({ id: newId('rev'), challengeId: id, at: now, previous: c });
    await db.challenges.put(seed);
  });
}

// ---------------------------------------------------------------- habits

export async function logHabit(habitId: string, date: IsoDate, input: EntryInput & { extra?: Record<string, string>; notes?: string; status?: HabitEntryStatus | null }, now = Date.now()): Promise<HabitEntry | null> {
  if (!isValidIso(date)) throw new UserError('Invalid date.');
  return db.transaction('rw', [db.habits, db.habitEntries, db.settings], async () => {
    const h = await db.habits.get(habitId);
    if (!h) throw new UserError('Habit not found.');
    const t = await today();
    if (date > t) throw new UserError('You can’t log a habit for a future date.');
    const id = entryId(habitId, date);
    const prev = await db.habitEntries.get(id);
    const status = input.status !== undefined ? input.status : statusFor(h, input);
    const hasExtra = input.extra && Object.values(input.extra).some((v) => v.trim());
    if (status === null && !hasExtra && !input.notes) {
      if (prev) await db.habitEntries.delete(id);
      return null;
    }
    const entry: HabitEntry = {
      id,
      habitId,
      date,
      status: status ?? 'partial',
      value: input.value ?? (input.option !== undefined ? null : prev?.value ?? null),
      text: (input.option ?? input.text ?? (input.yes !== undefined ? (input.yes ? 'yes' : 'no') : prev?.text) ?? '').slice(0, 1000),
      extra: { ...(prev?.extra ?? {}), ...(input.extra ?? {}) },
      notes: (input.notes ?? prev?.notes ?? '').slice(0, 2000),
      planned: isPlannedOn(h, date),
      updatedAt: now,
    };
    await db.habitEntries.put(entry);
    return entry;
  });
}

export async function clearHabitEntry(habitId: string, date: IsoDate): Promise<void> {
  await db.habitEntries.delete(entryId(habitId, date));
}

export async function updateHabit(id: string, patch: Partial<Omit<Habit, 'id'>>): Promise<void> {
  await db.transaction('rw', db.habits, async () => {
    const h = await db.habits.get(id);
    if (!h) throw new UserError('Habit not found.');
    const next = habitSchema.safeParse({ ...h, ...patch });
    if (!next.success) throw new UserError(next.error.issues[0]?.message ?? 'Invalid habit.');
    await db.habits.put(next.data);
  });
}

export async function addCustomHabit(input: Pick<Habit, 'name' | 'kind' | 'input' | 'section' | 'days'> & Partial<Habit>): Promise<string> {
  const count = await db.habits.count();
  const habit: Habit = {
    id: newId('habit'),
    discreetName: null,
    description: '',
    category: 'Custom',
    target: null,
    targetMax: null,
    unit: null,
    options: [],
    definition: '',
    visibility: 'normal',
    sensitive: false,
    enabled: true,
    config: {},
    order: count,
    ...input,
  };
  const parsed = habitSchema.safeParse(habit);
  if (!parsed.success) throw new UserError(parsed.error.issues[0]?.message ?? 'Invalid habit.');
  await db.habits.add(parsed.data);
  return habit.id;
}

/** Deleting a habit keeps its history unless `withEntries`. */
export async function deleteHabit(id: string, withEntries: boolean): Promise<void> {
  await db.transaction('rw', [db.habits, db.habitEntries], async () => {
    await db.habits.delete(id);
    if (withEntries) await db.habitEntries.where('habitId').equals(id).delete();
  });
}

// ---------------------------------------------------------------- reflections

export function blankReflection(date: IsoDate): Reflection {
  return { id: date, date, completedChallenge: null, entry: '', takeaway: '', improvement: '', difficult: '', proud: '', change: '', mood: null, energy: null, updatedAt: 0 };
}

export async function saveReflection(date: IsoDate, patch: Partial<Omit<Reflection, 'id' | 'date'>>, now = Date.now()): Promise<void> {
  if (!isValidIso(date)) throw new UserError('Invalid date.');
  await db.transaction('rw', db.reflections, async () => {
    const prev = (await db.reflections.get(date)) ?? blankReflection(date);
    await db.reflections.put({ ...prev, ...patch, id: date, date, updatedAt: now });
  });
}

// ---------------------------------------------------------------- reminders & notifications

export async function updateReminder(id: Reminder['id'], patch: Partial<Omit<Reminder, 'id' | 'type'>>): Promise<void> {
  if (patch.time !== undefined && !/^([01]\d|2[0-3]):[0-5]\d$/.test(patch.time)) throw new UserError('Invalid time.');
  await db.reminders.update(id, patch);
}

/**
 * Atomically claim a reminder slot. Returns false if another tab (or an earlier run) already
 * delivered it, which is how duplicate notifications are prevented.
 */
export async function claimNotification(reminderId: string, date: IsoDate, method: 'system' | 'in-app' | 'suppressed', now = Date.now()): Promise<boolean> {
  try {
    await db.notificationLog.add({ id: `${reminderId}|${date}`, reminderId, date, at: now, method });
    return true;
  } catch (e) {
    if (e instanceof Error && e.name === 'ConstraintError') return false;
    throw e;
  }
}

export async function pruneNotificationLog(keepFrom: IsoDate): Promise<void> {
  await db.notificationLog.where('date').below(keepFrom).delete();
}

// ---------------------------------------------------------------- achievements

/** Persist derived achievements: keep the original earned time, drop ones no longer earned. */
export async function syncAchievements(derived: readonly Achievement[]): Promise<void> {
  await db.transaction('rw', db.achievements, async () => {
    const existing = new Map((await db.achievements.toArray()).map((a) => [a.id, a]));
    const keep = new Set(derived.map((d) => d.id));
    for (const d of derived) {
      const e = existing.get(d.id);
      if (!e || e.relatedEvent !== d.relatedEvent || e.earnedAt !== d.earnedAt) await db.achievements.put(e && e.earnedAt <= d.earnedAt && e.relatedEvent === d.relatedEvent ? e : d);
    }
    for (const id of existing.keys()) if (!keep.has(id)) await db.achievements.delete(id);
  });
}

// ---------------------------------------------------------------- timers

export async function saveTimer(t: TimerState): Promise<void> {
  await db.timers.put(t);
}

export async function clearTimer(id: string): Promise<void> {
  await db.timers.delete(id);
}

export async function catchUpDateSuggestion(): Promise<IsoDate> {
  return addDays(await today(), 1);
}
