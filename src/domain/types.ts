import { z } from 'zod';

/** Calendar date in the user's timezone, `YYYY-MM-DD`. Never a Date object, so DST can't shift it. */
export const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD');
/** Local wall-clock time `HH:MM` (24h). */
export const localTime = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Expected HH:MM');
/** Epoch milliseconds. */
export const timestamp = z.number().int().nonnegative();

export type IsoDate = z.infer<typeof isoDate>;
export type LocalTime = z.infer<typeof localTime>;

// ---------------------------------------------------------------- Settings

export const reminderType = z.enum(['morning', 'evening', 'bedtime']);
export type ReminderType = z.infer<typeof reminderType>;

export const reminderSchema = z.object({
  id: reminderType,
  type: reminderType,
  time: localTime,
  enabled: z.boolean(),
  /** `system` = OS notification via the service worker; `in-app` = banner inside the app only. */
  delivery: z.enum(['system', 'in-app']),
});
export type Reminder = z.infer<typeof reminderSchema>;

export const settingsSchema = z.object({
  id: z.literal('settings'),
  displayName: z.string().max(60),
  timezone: z.string().min(1),
  wakeTime: localTime,
  sleepTargetHours: z.number().min(4).max(12).nullable(),
  bedtime: localTime,
  quietHours: z.object({ enabled: z.boolean(), start: localTime, end: localTime }),
  theme: z.enum(['dark', 'light', 'system']),
  hardMode: z.boolean(),
  reducedMotion: z.enum(['system', 'reduce', 'full']),
  /** Hide sensitive habit goals from the Today screen (still trackable in Habits). */
  hideSensitiveOnToday: z.boolean(),
  equipment: z.array(z.string()),
  constraints: z.string().max(2000),
  onboarded: z.boolean(),
  createdAt: timestamp,
});
export type Settings = z.infer<typeof settingsSchema>;

// ---------------------------------------------------------------- Program

export const programSchema = z.object({
  id: z.literal('program'),
  name: z.string(),
  startDate: isoDate,
  /** Always startDate + 29 days. Stored for export readability; recomputed on change. */
  endDate: isoDate,
  /** Set once the user has actually begun (first started/completed challenge or start date passed). */
  startedAt: timestamp.nullable(),
  history: z.array(
    z.object({ at: timestamp, from: isoDate, to: isoDate, reason: z.string() }),
  ),
});
export type Program = z.infer<typeof programSchema>;

// ---------------------------------------------------------------- Challenges

export const metricFieldSchema = z.object({
  key: z.string(),
  label: z.string(),
  type: z.enum(['number', 'text', 'longtext', 'boolean', 'list', 'select']),
  unit: z.string().optional(),
  help: z.string().optional(),
  min: z.number().optional(),
  max: z.number().optional(),
  step: z.number().optional(),
  options: z.array(z.string()).optional(),
  /** Visual group heading, e.g. "Baseline" / "Final". */
  group: z.string().optional(),
});
export type MetricField = z.infer<typeof metricFieldSchema>;

export const ruleSchema = z.discriminatedUnion('op', [
  z.object({ op: z.literal('gte'), key: z.string(), value: z.number() }),
  z.object({ op: z.literal('lte'), key: z.string(), value: z.number() }),
  z.object({ op: z.literal('true'), key: z.string() }),
  /** final >= baseline * (1 + pct/100). For `lower` metrics: final <= baseline * (1 - pct/100). */
  z.object({ op: z.literal('improve'), baseline: z.string(), final: z.string(), pct: z.number(), better: z.enum(['higher', 'lower']).default('higher') }),
  /** num/den*100 >= pct */
  z.object({ op: z.literal('ratio'), num: z.string(), den: z.string(), pct: z.number() }),
  z.object({ op: z.literal('listMin'), key: z.string(), count: z.number() }),
  z.object({ op: z.literal('evidenceMin'), count: z.number(), tag: z.string().optional() }),
]);
export type Rule = z.infer<typeof ruleSchema>;

export const criterionSchema = z.object({
  id: z.string(),
  label: z.string(),
  bonus: z.boolean().optional(),
  /** Without a rule the criterion is self-certified with a checkbox. */
  rule: ruleSchema.optional(),
});
export type Criterion = z.infer<typeof criterionSchema>;

export const pbKeySchema = z.object({
  key: z.string(),
  label: z.string(),
  better: z.enum(['higher', 'lower']),
  unit: z.string().optional(),
  /** If set, PB comparison is baseline field → final field rather than across attempts. */
  baselineKey: z.string().optional(),
});
export type PbKey = z.infer<typeof pbKeySchema>;

export const toolId = z.enum([
  'stopwatch',
  'countdown',
  'focus',
  'arithmetic30',
  'arithmetic60',
  'pi',
  'solveTimer',
  'logicTimer',
  'pbCalc',
  'readingTest',
]);
export type ToolId = z.infer<typeof toolId>;

export const challengeSchema = z.object({
  id: z.string(),
  day: z.number().int().min(1).max(30),
  title: z.string().min(1).max(120),
  category: z.string().min(1).max(60),
  difficulty: z.number().int().min(1).max(5),
  description: z.string(),
  objective: z.string(),
  bonus: z.string().nullable(),
  preparation: z.array(z.string()),
  equipment: z.array(z.string()),
  learningPlan: z.array(z.string()),
  safety: z.array(z.string()),
  estimatedMinutes: z.number().int().positive(),
  metrics: z.array(metricFieldSchema),
  criteria: z.array(criterionSchema),
  pbKeys: z.array(pbKeySchema),
  tools: z.array(toolId),
  evidence: z.object({
    enabled: z.boolean(),
    accept: z.string(),
    label: z.string(),
    /** Named slots like ["before", "after"] or the 10 photography themes. */
    tags: z.array(z.string()).optional(),
    max: z.number().optional(),
  }),
  /** Long-term stretch target shown separately from the one-day task (Day 28). */
  stretchGoal: z.string().nullable(),
  updatedAt: timestamp,
});
export type Challenge = z.infer<typeof challengeSchema>;

export const storedStatus = z.enum(['not_started', 'in_progress', 'paused', 'completed', 'attempted']);
export type StoredStatus = z.infer<typeof storedStatus>;

/** Derived status shown on calendar/list. */
export type DisplayStatus =
  | 'upcoming'
  | 'available'
  | 'in_progress'
  | 'completed'
  | 'attempted'
  | 'missed'
  | 'rescheduled';

export const metricValue = z.union([z.number(), z.string(), z.boolean(), z.array(z.string()), z.null()]);
export type MetricValue = z.infer<typeof metricValue>;
export const metricsRecord = z.record(z.string(), metricValue);
export type MetricsRecord = z.infer<typeof metricsRecord>;

export const missedReason = z.enum([
  'rest',
  'illness',
  'injury',
  'scheduling',
  'underestimated',
  'low_energy',
  'distraction',
  'equipment',
  'other',
]);
export type MissedReason = z.infer<typeof missedReason>;

export const missedAdjustment = z.enum(['reschedule', 'shorter_version', 'start_earlier', 'skip_with_note', 'remove_blocker']);
export type MissedAdjustment = z.infer<typeof missedAdjustment>;

export const progressSchema = z.object({
  id: z.string(), // = challengeId
  challengeId: z.string(),
  status: storedStatus,
  /** Set when rescheduled; the original scheduled date is always derivable from start date + day. */
  rescheduledTo: isoDate.nullable(),
  startedAt: timestamp.nullable(),
  completedAt: timestamp.nullable(),
  /** Calendar date (user tz) on which completion/attempt was recorded. */
  completedOn: isoDate.nullable(),
  /** User explicitly overrode the "future challenge" lock. */
  completedEarly: z.boolean(),
  pausedAt: timestamp.nullable(),
  /** When the current active stretch began (null while paused/not running). */
  activeSince: timestamp.nullable(),
  /** Accumulated active milliseconds excluding pauses. */
  activeMs: z.number().nonnegative(),
  notes: z.string(),
  metrics: metricsRecord,
  /** Self-certified criteria ids. */
  checked: z.array(z.string()),
  /** Preparation checklist item indexes checked. */
  prepDone: z.array(z.number().int()),
  selfAssessment: z.number().int().min(1).max(5).nullable(),
  missedAck: z
    .object({ at: timestamp, reason: missedReason, adjustment: missedAdjustment, note: z.string() })
    .nullable(),
  history: z.array(
    z.object({
      at: timestamp,
      action: z.string(),
      detail: z.string().optional(),
    }),
  ),
  updatedAt: timestamp,
});
export type ChallengeProgress = z.infer<typeof progressSchema>;

/** A logged practice session / attempt / test, append-only. */
export const attemptSchema = z.object({
  id: z.string(),
  challengeId: z.string(),
  at: timestamp,
  date: isoDate,
  kind: z.enum(['practice', 'attempt', 'test']),
  label: z.string().max(200),
  metrics: metricsRecord,
  durationSec: z.number().nonnegative().nullable(),
  note: z.string().max(4000),
});
export type Attempt = z.infer<typeof attemptSchema>;

export const evidenceMetaSchema = z.object({
  id: z.string(),
  challengeId: z.string(),
  name: z.string().max(255),
  mime: z.string(),
  size: z.number().nonnegative(),
  tag: z.string().nullable(),
  caption: z.string().max(500),
  createdAt: timestamp,
});
export type EvidenceMeta = z.infer<typeof evidenceMetaSchema>;
/** File contents live in their own table so listing evidence never loads the bytes. Raw bytes (not Blob) for the widest IndexedDB compatibility. */
export interface EvidenceFile {
  id: string;
  bytes: ArrayBuffer;
}

export const challengeRevisionSchema = z.object({
  id: z.string(),
  challengeId: z.string(),
  at: timestamp,
  previous: challengeSchema,
});
export type ChallengeRevision = z.infer<typeof challengeRevisionSchema>;

// ---------------------------------------------------------------- Habits

export const habitInput = z.enum([
  'check', // tick box
  'minutes', // minutes done vs target
  'sleep', // hours slept vs range
  'activity', // select a training type, or rest
  'text', // short note (confidence action)
  'limit', // minutes spent vs max budget
  'yesno', // did/didn't
  'count', // number achieved vs target (phone-free periods)
  'awareness', // snacking awareness
  'private', // sensitive goal: on track / slipped
]);
export type HabitInput = z.infer<typeof habitInput>;

export const habitSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(80),
  /** Discreet label used everywhere when `visibility` is `discreet`. */
  discreetName: z.string().max(80).nullable(),
  description: z.string().max(1000),
  kind: z.enum(['build', 'reduce']),
  category: z.string(),
  input: habitInput,
  section: z.enum(['essential', 'scheduled', 'personal', 'evening']),
  /** Weekdays it is planned, 0=Sunday … 6=Saturday. Empty = optional/unplanned only. */
  days: z.array(z.number().int().min(0).max(6)),
  target: z.number().nullable(),
  targetMax: z.number().nullable(),
  unit: z.string().nullable(),
  options: z.array(z.string()),
  /** Free-text definition the user writes for a reduce goal (what they want to reduce). */
  definition: z.string().max(500),
  visibility: z.enum(['normal', 'discreet', 'hidden']),
  sensitive: z.boolean(),
  enabled: z.boolean(),
  order: z.number(),
  /** Configurable extra fields, e.g. the two phone-free periods. */
  config: z.record(z.string(), z.string()),
});
export type Habit = z.infer<typeof habitSchema>;

export const habitEntryStatus = z.enum(['done', 'partial', 'missed', 'skipped', 'rest']);
export type HabitEntryStatus = z.infer<typeof habitEntryStatus>;

export const habitEntrySchema = z.object({
  id: z.string(), // `${habitId}|${date}`
  habitId: z.string(),
  date: isoDate,
  status: habitEntryStatus,
  value: z.number().nullable(),
  text: z.string().max(1000),
  /** For sleep: bedtime & wake. For private: trigger/coping. */
  extra: z.record(z.string(), z.string()),
  notes: z.string().max(2000),
  /** Was this planned for the day when logged? Unplanned extras don't inflate adherence. */
  planned: z.boolean(),
  updatedAt: timestamp,
});
export type HabitEntry = z.infer<typeof habitEntrySchema>;

// ---------------------------------------------------------------- Reflections, achievements, logs

export const reflectionSchema = z.object({
  id: isoDate,
  date: isoDate,
  completedChallenge: z.enum(['yes', 'partly', 'no', 'rest']).nullable(),
  improvement: z.string().max(2000),
  difficult: z.string().max(2000),
  proud: z.string().max(2000),
  change: z.string().max(2000),
  mood: z.number().int().min(1).max(5).nullable(),
  energy: z.number().int().min(1).max(5).nullable(),
  updatedAt: timestamp,
});
export type Reflection = z.infer<typeof reflectionSchema>;

export const achievementType = z.enum([
  'first_completed',
  'seven_attempted',
  'first_pb',
  'ten_completed',
  'halfway',
  'final_day',
  'all_completed',
  'first_reflection',
  'week_consistent',
]);
export type AchievementType = z.infer<typeof achievementType>;

export const achievementSchema = z.object({
  id: achievementType,
  type: achievementType,
  earnedAt: timestamp,
  relatedEvent: z.string(),
});
export type Achievement = z.infer<typeof achievementSchema>;

export const notificationLogSchema = z.object({
  id: z.string(), // `${reminderId}|${date}`
  reminderId: z.string(),
  date: isoDate,
  at: timestamp,
  method: z.enum(['system', 'in-app', 'suppressed']),
});
export type NotificationLog = z.infer<typeof notificationLogSchema>;

/** Persisted running timer so a refresh or crash doesn't lose a focus session. */
export const timerStateSchema = z.object({
  id: z.string(),
  kind: z.enum(['focus', 'stopwatch', 'countdown', 'challenge']),
  startedAt: timestamp.nullable(),
  accumulatedMs: z.number().nonnegative(),
  durationMs: z.number().nonnegative().nullable(),
  label: z.string(),
  linkedHabitId: z.string().nullable(),
});
export type TimerState = z.infer<typeof timerStateSchema>;
