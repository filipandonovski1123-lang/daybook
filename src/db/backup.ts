import { z } from 'zod';
import {
  achievementSchema,
  attemptSchema,
  challengeRevisionSchema,
  challengeSchema,
  customChallengeSchema,
  evidenceMetaSchema,
  habitEntrySchema,
  habitSchema,
  notificationLogSchema,
  programSchema,
  progressSchema,
  reflectionSchema,
  reminderSchema,
  settingsSchema,
  timerStateSchema,
} from '../domain/types';
import { db, SCHEMA_VERSION } from './db';

export const APP_ID = 'thirty-day-challenge';

const evidenceExportSchema = evidenceMetaSchema.extend({ data: z.string().nullable() });

export const backupSchema = z.object({
  app: z.literal(APP_ID),
  schemaVersion: z.number().int().min(1).max(SCHEMA_VERSION),
  exportedAt: z.number(),
  includesFiles: z.boolean(),
  data: z.object({
    settings: z.array(settingsSchema).max(1),
    program: z.array(programSchema).max(1),
    challenges: z.array(challengeSchema).max(200),
    revisions: z.array(challengeRevisionSchema),
    progress: z.array(progressSchema),
    attempts: z.array(attemptSchema),
    evidence: z.array(evidenceExportSchema),
    habits: z.array(habitSchema).max(200),
    habitEntries: z.array(habitEntrySchema),
    reflections: z.array(reflectionSchema),
    reminders: z.array(reminderSchema).max(10),
    achievements: z.array(achievementSchema),
    notificationLog: z.array(notificationLogSchema).optional().default([]),
    timers: z.array(timerStateSchema).optional().default([]),
    customChallenges: z.array(customChallengeSchema).optional().default([]),
  }),
});
export type Backup = z.infer<typeof backupSchema>;

function bytesToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  return btoa(bin);
}

function base64ToBytes(b64: string): ArrayBuffer {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

export async function exportData(includeFiles: boolean, now = Date.now()): Promise<Backup> {
  const evidence = await db.evidence.toArray();
  return {
    app: APP_ID,
    schemaVersion: SCHEMA_VERSION,
    exportedAt: now,
    includesFiles: includeFiles,
    data: {
      settings: await db.settings.toArray(),
      program: await db.program.toArray(),
      challenges: await db.challenges.toArray(),
      revisions: await db.revisions.toArray(),
      progress: await db.progress.toArray(),
      attempts: await db.attempts.toArray(),
      evidence: await Promise.all(
        evidence.map(async (meta) => {
          const file = includeFiles ? await db.evidenceFiles.get(meta.id) : undefined;
          return { ...meta, data: file ? bytesToBase64(file.bytes) : null };
        }),
      ),
      habits: await db.habits.toArray(),
      habitEntries: await db.habitEntries.toArray(),
      reflections: await db.reflections.toArray(),
      reminders: await db.reminders.toArray(),
      achievements: await db.achievements.toArray(),
      notificationLog: [],
      timers: await db.timers.toArray(),
      customChallenges: await db.customChallenges.toArray(),
    },
  };
}

export interface ImportSummary {
  challenges: number;
  progress: number;
  habitEntries: number;
  reflections: number;
  attempts: number;
  files: number;
  filesSkipped: number;
}

export type ParseResult = { ok: true; backup: Backup; summary: ImportSummary } | { ok: false; error: string };

/** Validate an uploaded backup without touching the database. */
export function parseBackup(text: string): ParseResult {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false, error: 'This file isn’t valid JSON.' };
  }
  const r = backupSchema.safeParse(json);
  if (!r.success) {
    const issue = r.error.issues[0];
    return { ok: false, error: issue ? `Invalid backup at “${issue.path.join('.') || 'root'}”: ${issue.message}` : 'Invalid backup.' };
  }
  const b = r.data;
  return {
    ok: true,
    backup: b,
    summary: {
      challenges: b.data.challenges.length,
      progress: b.data.progress.length,
      habitEntries: b.data.habitEntries.length,
      reflections: b.data.reflections.length,
      attempts: b.data.attempts.length,
      files: b.data.evidence.filter((e) => e.data).length,
      filesSkipped: b.data.evidence.filter((e) => !e.data).length,
    },
  };
}

/**
 * Replace all data with the backup, in one transaction: if anything fails nothing changes.
 * Evidence entries without file data (exported without files) are skipped rather than stored empty.
 */
export async function importData(backup: Backup): Promise<void> {
  const d = backup.data;
  const withData = d.evidence.filter((e) => e.data);
  const evidence = withData.map(({ data: _data, ...meta }) => meta);
  const files = withData.map((e) => ({ id: e.id, bytes: base64ToBytes(e.data ?? '') }));
  await db.transaction('rw', db.tables, async () => {
    await Promise.all(db.tables.map((t) => t.clear()));
    await db.settings.bulkAdd(d.settings);
    await db.program.bulkAdd(d.program);
    await db.challenges.bulkAdd(d.challenges);
    await db.revisions.bulkAdd(d.revisions);
    await db.progress.bulkAdd(d.progress);
    await db.attempts.bulkAdd(d.attempts);
    await db.evidence.bulkAdd(evidence);
    await db.evidenceFiles.bulkAdd(files);
    await db.habits.bulkAdd(d.habits);
    await db.habitEntries.bulkAdd(d.habitEntries);
    await db.reflections.bulkAdd(d.reflections);
    await db.reminders.bulkAdd(d.reminders);
    await db.achievements.bulkAdd(d.achievements);
    await db.timers.bulkAdd(d.timers);
    await db.customChallenges.bulkAdd(d.customChallenges);
  });
}

/** Permanently delete everything stored by this app on this device. */
export async function deleteAllData(): Promise<void> {
  await db.transaction('rw', db.tables, async () => {
    await Promise.all(db.tables.map((t) => t.clear()));
  });
  try {
    localStorage.clear();
  } catch {
    /* storage may be unavailable */
  }
}
