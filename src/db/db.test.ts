import { beforeEach, describe, expect, it } from 'vitest';
import { todayIn, addDays } from '../domain/dates';
import * as A from './actions';
import { deleteAllData, exportData, importData, parseBackup } from './backup';
import { db } from './db';

const TZ = 'Australia/Sydney';

async function freshProgram(startOffset: number) {
  await db.delete();
  await db.open();
  await A.ensureSeeded();
  await A.updateSettings({ timezone: TZ });
  const t = todayIn(TZ);
  const start = addDays(t, startOffset);
  await A.completeOnboarding({
    displayName: 'Test',
    startDate: start,
    timezone: TZ,
    wakeTime: '07:00',
    morningTime: '08:00',
    eveningTime: '20:30',
    bedtime: '22:30',
    sleepTargetHours: 9,
    notifications: true,
    bedtimeReminder: false,
    enabledHabits: ['sleep', 'reading', 'focus', 'personal'],
    equipment: ['balls'],
    constraints: '',
    hardMode: false,
  });
  return { today: t, start };
}

describe('seeding & onboarding', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  it('seeds once and is idempotent', async () => {
    await A.ensureSeeded();
    await A.ensureSeeded();
    expect(await db.challenges.count()).toBe(30);
    expect(await db.habits.count()).toBeGreaterThan(15);
    expect(await db.reminders.count()).toBe(3);
  });

  it('onboarding with a future date stores the program and preferences', async () => {
    const { start } = await freshProgram(14);
    const p = await db.program.get('program');
    expect(p?.startDate).toBe(start);
    expect(p?.endDate).toBe(addDays(start, 29));
    const s = await db.settings.get('settings');
    expect(s?.onboarded).toBe(true);
    expect((await db.habits.get('fitness'))?.enabled).toBe(false);
    expect((await db.habits.get('sleep'))?.target).toBe(9);
    expect((await db.reminders.get('morning'))?.time).toBe('08:00');
    expect((await db.reminders.get('bedtime'))?.enabled).toBe(false);
  });
});

describe('start date changes', () => {
  it('free before start, needs confirmation once started', async () => {
    const { start } = await freshProgram(7);
    await A.changeStartDate(addDays(start, 3), { confirmed: false });
    expect((await db.program.get('program'))?.endDate).toBe(addDays(start, 32));
    // Start it by beginning today.
    await freshProgram(0);
    expect(await A.programHasStarted()).toBe(true);
    await expect(A.changeStartDate(addDays(todayIn(TZ), 2), { confirmed: false })).rejects.toThrow(/confirm/i);
    await A.changeStartDate(addDays(todayIn(TZ), 2), { confirmed: true, reason: 'test' });
    const p = await db.program.get('program');
    expect(p?.history.at(-1)?.reason).toBe('test');
  });
});

describe('challenge workflow', () => {
  beforeEach(async () => {
    await freshProgram(0);
  });

  it('start → pause → complete → undo, with persistence and audit', async () => {
    await A.startChallenge('day-01');
    await A.startChallenge('day-01'); // duplicate click is a no-op
    await A.pauseChallenge('day-01');
    await A.setMetric('day-01', 'bestCatches', 12);
    await A.completeChallenge('day-01', { outcome: 'completed' });
    await A.completeChallenge('day-01', { outcome: 'completed' }); // duplicate click
    let p = await db.progress.get('day-01');
    expect(p?.status).toBe('completed');
    expect(p?.completedOn).toBe(todayIn(TZ));
    expect(p?.history.filter((h) => h.action === 'completed')).toHaveLength(1);
    expect(p?.metrics.bestCatches).toBe(12);
    await A.undoCompletion('day-01');
    p = await db.progress.get('day-01');
    expect(p?.status).toBe('paused');
    expect(p?.completedAt).toBeNull();
    expect(p?.history.map((h) => h.action)).toEqual(['started', 'paused', 'completed', 'undo']);
  });

  it('refuses to complete a future challenge without an explicit override', async () => {
    await expect(A.completeChallenge('day-05', { outcome: 'completed' })).rejects.toThrow(/future/);
    const p = await A.completeChallenge('day-05', { outcome: 'completed', early: true });
    expect(p.completedEarly).toBe(true);
  });

  it('rescheduling keeps the original slot derivable and logs history', async () => {
    const t = todayIn(TZ);
    await A.rescheduleChallenge('day-01', addDays(t, 3));
    const p = await db.progress.get('day-01');
    expect(p?.rescheduledTo).toBe(addDays(t, 3));
    expect(p?.history.at(-1)?.detail).toContain('original date');
    await expect(A.rescheduleChallenge('day-01', addDays(t, -1))).rejects.toThrow();
  });

  it('editing a challenge keeps a revision and does not delete logs', async () => {
    await A.setNotes('day-02', 'my notes');
    await A.logAttempt({ challengeId: 'day-02', kind: 'test', label: 'baseline', metrics: { wpm: 240 }, durationSec: 60, note: '' });
    await A.updateChallenge('day-02', { title: 'Speed Reading (edited)', estimatedMinutes: 60 });
    expect((await db.challenges.get('day-02'))?.title).toBe('Speed Reading (edited)');
    expect(await db.revisions.where('challengeId').equals('day-02').count()).toBe(1);
    expect((await db.progress.get('day-02'))?.notes).toBe('my notes');
    expect(await db.attempts.where('challengeId').equals('day-02').count()).toBe(1);
    await expect(A.updateChallenge('day-02', { title: '' })).rejects.toThrow();
  });

  it('acknowledges a missed challenge with a reschedule', async () => {
    const t = todayIn(TZ);
    const p = await A.acknowledgeMissed('day-01', { reason: 'illness', adjustment: 'reschedule', note: '', rescheduleTo: addDays(t, 1) });
    expect(p.missedAck?.reason).toBe('illness');
    expect(p.rescheduledTo).toBe(addDays(t, 1));
  });

  it('validates evidence uploads', async () => {
    const big = { size: A.MAX_FILE_BYTES + 1, name: 'x.jpg', type: 'image/jpeg' } as File;
    await expect(A.addEvidence('day-06', big, 'before')).rejects.toThrow(/50 MB/);
    const pdf = new File(['%PDF'], 'a.pdf', { type: 'application/pdf' });
    await expect(A.addEvidence('day-06', pdf, null)).rejects.toThrow(/accepted/);
    await expect(A.addEvidence('day-02', new File(['x'], 'a.png', { type: 'image/png' }), null)).rejects.toThrow(/attachments/);
    const id = await A.addEvidence('day-06', new File(['img'], 'before.png', { type: 'image/png' }), 'before');
    expect((await db.evidence.get(id))?.tag).toBe('before');
    expect(A.acceptsFile('image/*,.csv', { type: '', name: 'data.CSV' })).toBe(true);
  });
});

describe('habits', () => {
  beforeEach(async () => {
    await freshProgram(0);
  });

  it('logs, updates and clears an entry; refuses future dates', async () => {
    const t = todayIn(TZ);
    const e = await A.logHabit('reading', t, { value: 25, extra: { book: 'Dune' } });
    expect(e?.status).toBe('done');
    expect((await db.habitEntries.get(`reading|${t}`))?.extra.book).toBe('Dune');
    await A.logHabit('reading', t, { value: 10 });
    expect((await db.habitEntries.get(`reading|${t}`))?.status).toBe('partial');
    expect((await db.habitEntries.get(`reading|${t}`))?.extra.book).toBe('Dune');
    await A.logHabit('tidy', t, { done: true });
    await A.logHabit('tidy', t, { done: false });
    expect(await db.habitEntries.get(`tidy|${t}`)).toBeUndefined();
    await expect(A.logHabit('reading', addDays(t, 1), { value: 20 })).rejects.toThrow(/future/);
  });

  it('editing a habit target validates and persists', async () => {
    await A.updateHabit('scrolling', { targetMax: 20 });
    expect((await db.habits.get('scrolling'))?.targetMax).toBe(20);
    await expect(A.updateHabit('scrolling', { name: '' })).rejects.toThrow();
  });
});

describe('notifications', () => {
  it('claims each reminder slot only once', async () => {
    await freshProgram(0);
    expect(await A.claimNotification('morning', '2026-11-20', 'system')).toBe(true);
    expect(await A.claimNotification('morning', '2026-11-20', 'system')).toBe(false);
    expect(await A.claimNotification('morning', '2026-11-21', 'system')).toBe(true);
  });
});

describe('backup', () => {
  it('round-trips data including files, and rejects invalid input', async () => {
    await freshProgram(0);
    const t = todayIn(TZ);
    await A.logHabit('reading', t, { value: 30 });
    await A.setMetric('day-01', 'bestCatches', 11);
    await A.completeChallenge('day-01', { outcome: 'completed' });
    await A.addEvidence('day-01', new File([new Uint8Array([1, 2, 3, 250])], 'v.png', { type: 'image/png' }), null);
    await A.saveReflection(t, { proud: 'Kept going' });

    const backup = await exportData(true);
    const text = JSON.stringify(backup);
    await deleteAllData();
    expect(await db.challenges.count()).toBe(0);

    const parsed = parseBackup(text);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.summary.files).toBe(1);
    await importData(parsed.backup);
    expect((await db.progress.get('day-01'))?.status).toBe('completed');
    expect((await db.habitEntries.get(`reading|${t}`))?.value).toBe(30);
    expect((await db.reflections.get(t))?.proud).toBe('Kept going');
    const ev = (await db.evidenceFiles.toArray())[0];
    expect(new Uint8Array(ev!.bytes)).toEqual(new Uint8Array([1, 2, 3, 250]));

    expect(parseBackup('not json').ok).toBe(false);
    expect(parseBackup(JSON.stringify({ app: 'other' })).ok).toBe(false);
    const broken = JSON.parse(text);
    broken.data.habitEntries[0].date = 'yesterday';
    const r = parseBackup(JSON.stringify(broken));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/habitEntries/);
    // Data untouched by the failed parse.
    expect(await db.habitEntries.count()).toBe(1);
  });
});

describe('v2 migration (general-purpose content)', () => {
  it('updates untouched person-specific seed text, keeps user edits and progress', async () => {
    const { default: Dexie } = await import('dexie');
    const { ChallengeDB } = await import('./db');
    const { buildChallenges } = await import('../data/challenges');
    const { buildHabits } = await import('../data/habits');
    const name = 'migration-test';
    await Dexie.delete(name);
    const v1 = new Dexie(name);
    v1.version(1).stores({
      settings: 'id', program: 'id', challenges: 'id, day', revisions: 'id, challengeId, at', progress: 'id, challengeId, status',
      attempts: 'id, challengeId, date, at', evidence: 'id, challengeId, createdAt', evidenceFiles: 'id', habits: 'id, order',
      habitEntries: 'id, habitId, date', reflections: 'id, date', reminders: 'id', achievements: 'id', notificationLog: 'id, date', timers: 'id',
    });
    const seeds = buildChallenges(0);
    const old = seeds.map((c) =>
      c.id === 'day-03' ? { ...c, title: 'Learn Basic Auslan' } : c.id === 'day-13' ? { ...c, title: 'The Quarterback Accuracy Challenge', category: 'American Football' } : c.id === 'day-28' ? { ...c, title: 'Become a Chess Competitor: 1500 Rapid Elo Goal' } : c,
    );
    await v1.table('challenges').bulkAdd(old);
    // The user edited Day 13 by hand → must be left alone.
    await v1.table('revisions').add({ id: 'r1', challengeId: 'day-13', at: 1, previous: old[12] });
    await v1.table('progress').add({ id: 'day-03', challengeId: 'day-03', status: 'completed', notes: 'kept' });
    const habits = buildHabits().filter((h) => h.id !== 'skill');
    await v1.table('habits').bulkAdd([...habits, { ...buildHabits().find((h) => h.id === 'skill')!, id: 'quarterback', name: 'Quarterback development', category: 'Football' }]);
    await v1.table('settings').add({ id: 'settings', equipment: ['football', 'chess'] });
    v1.close();

    const db2 = new ChallengeDB(name);
    await db2.open();
    expect((await db2.challenges.get('day-03'))?.title).toBe('Learn Basic Sign Language');
    expect((await db2.challenges.get('day-28'))?.title).toBe('Become a Chess Competitor');
    expect((await db2.challenges.get('day-13'))?.title).toBe('The Quarterback Accuracy Challenge');
    expect((await db2.progress.get('day-03'))?.notes).toBe('kept');
    const qb = await db2.habits.get('quarterback');
    expect(qb?.name).toBe('Skill practice');
    expect((await db2.settings.get('settings'))?.equipment).toEqual(['throwing', 'chess']);
    db2.close();
    await Dexie.delete(name);
  });
});
