import Dexie, { type EntityTable } from 'dexie';
import type {
  Achievement,
  Attempt,
  Challenge,
  ChallengeProgress,
  ChallengeRevision,
  EvidenceFile,
  EvidenceMeta,
  Habit,
  HabitEntry,
  NotificationLog,
  Program,
  Reflection,
  Reminder,
  Settings,
  TimerState,
} from '../domain/types';

/** Bump with a new `this.version(n)` block (and an `.upgrade()` if data needs reshaping). */
export const SCHEMA_VERSION = 1;

export class ChallengeDB extends Dexie {
  settings!: EntityTable<Settings, 'id'>;
  program!: EntityTable<Program, 'id'>;
  challenges!: EntityTable<Challenge, 'id'>;
  revisions!: EntityTable<ChallengeRevision, 'id'>;
  progress!: EntityTable<ChallengeProgress, 'id'>;
  attempts!: EntityTable<Attempt, 'id'>;
  evidence!: EntityTable<EvidenceMeta, 'id'>;
  evidenceFiles!: EntityTable<EvidenceFile, 'id'>;
  habits!: EntityTable<Habit, 'id'>;
  habitEntries!: EntityTable<HabitEntry, 'id'>;
  reflections!: EntityTable<Reflection, 'id'>;
  reminders!: EntityTable<Reminder, 'id'>;
  achievements!: EntityTable<Achievement, 'id'>;
  notificationLog!: EntityTable<NotificationLog, 'id'>;
  timers!: EntityTable<TimerState, 'id'>;

  constructor(name = 'thirty-day-challenge') {
    super(name);
    this.version(1).stores({
      settings: 'id',
      program: 'id',
      challenges: 'id, day',
      revisions: 'id, challengeId, at',
      progress: 'id, challengeId, status',
      attempts: 'id, challengeId, date, at',
      evidence: 'id, challengeId, createdAt',
      evidenceFiles: 'id',
      habits: 'id, order',
      habitEntries: 'id, habitId, date',
      reflections: 'id, date',
      reminders: 'id',
      achievements: 'id',
      notificationLog: 'id, date',
      timers: 'id',
    });
  }
}

export const db = new ChallengeDB();

export const ALL_TABLES = [
  'settings',
  'program',
  'challenges',
  'revisions',
  'progress',
  'attempts',
  'evidence',
  'evidenceFiles',
  'habits',
  'habitEntries',
  'reflections',
  'reminders',
  'achievements',
  'notificationLog',
  'timers',
] as const;
export type TableName = (typeof ALL_TABLES)[number];

export function newId(prefix: string): string {
  const rand = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}_${rand}`;
}
