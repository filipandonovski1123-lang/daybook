import Dexie, { type EntityTable } from 'dexie';
import { buildChallenges, SIGNATURE_KEYS } from '../data/challenges';
import { buildHabits } from '../data/habits';
import type {
  Achievement,
  Attempt,
  Challenge,
  ChallengeProgress,
  ChallengeRevision,
  CustomChallenge,
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
export const SCHEMA_VERSION = 4;

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
  customChallenges!: EntityTable<CustomChallenge, 'id'>;

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
    // v2: general-purpose content. Replaces person-specific seed text on existing installs,
    // only for challenges/habits the user never edited. Progress and logs are untouched.
    this.version(2)
      .stores({})
      .upgrade(async (tx) => {
        const seeds = new Map(buildChallenges().map((c) => [c.id, c]));
        const OLD_TITLES: Record<string, string> = {
          'day-03': 'Learn Basic Auslan',
          'day-13': 'The Quarterback Accuracy Challenge',
          'day-17': 'Learn to Analyse Data',
          'day-28': 'Become a Chess Competitor: 1500 Rapid Elo Goal',
        };
        for (const [id, oldTitle] of Object.entries(OLD_TITLES)) {
          const current = (await tx.table('challenges').get(id)) as Challenge | undefined;
          const seed = seeds.get(id);
          const edited = (await tx.table('revisions').where('challengeId').equals(id).count()) > 0;
          if (current && seed && !edited && current.title === oldTitle) await tx.table('challenges').put(seed);
        }
        const qb = (await tx.table('habits').get('quarterback')) as Habit | undefined;
        const skill = buildHabits().find((h) => h.id === 'skill');
        if (qb && skill && qb.name === 'Quarterback development') {
          await tx.table('habits').put({ ...qb, name: skill.name, category: skill.category, description: skill.description, options: skill.options });
        }
        const settings = (await tx.table('settings').get('settings')) as Settings | undefined;
        if (settings?.equipment.includes('football')) {
          await tx.table('settings').put({ ...settings, equipment: settings.equipment.map((e) => (e === 'football' ? 'throwing' : e)) });
        }
      });
    // v3: configurable program length and plans built from the challenge library.
    // Existing programs were always the 30-day Signature plan.
    this.version(3)
      .stores({})
      .upgrade(async (tx) => {
        await tx.table('program').toCollection().modify((p: Partial<Program>) => {
          p.length ??= 30;
          p.mode ??= 'signature';
          p.themes ??= [];
        });
        await tx.table('challenges').toCollection().modify((c: Partial<Challenge>) => {
          if (c.libraryId === undefined) c.libraryId = c.day ? (SIGNATURE_KEYS[c.day - 1] ?? null) : null;
        });
      });
    // v4: user-made challenges, difficulty curves and rest days.
    this.version(4)
      .stores({ customChallenges: 'id, updatedAt' })
      .upgrade(async (tx) => {
        await tx.table('program').toCollection().modify((p: Partial<Program>) => {
          p.curve ??= 'steady';
          p.restEvery ??= 0;
        });
        await tx.table('challenges').toCollection().modify((c: Partial<Challenge>) => {
          c.kind ??= 'challenge';
        });
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
  'customChallenges',
] as const;
export type TableName = (typeof ALL_TABLES)[number];

export function newId(prefix: string): string {
  const rand = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}_${rand}`;
}
