import { describe, expect, it } from 'vitest';
import { instantiate } from '../data/challenges';
import { getLibraryItem, LIBRARY, SIGNATURE_PLAN } from '../data/library';
import { growthPlan, pickLadderSteps } from './growth';
import { generatePlan, isRestDay, REST_ID, restCount, sortByDifficulty, stripRest, targetDifficulty, withRestDays } from './planner';
import { displayStatus } from './schedule';
import { challengeCounts } from './stats';
import { longestStreak } from './summary';
import { challengeSchema, type DisplayStatus, type HabitEntry } from './types';

const DERIVED = ['baseWpm', 'finalWpm', 'accuracy', 'perfectUnder5', 'gamesPlayed', 'ratingChange', 'improvementAchieved', 'serveAccuracy'];

describe('challenge library', () => {
  it('has well over 100 unique, valid challenges', () => {
    expect(LIBRARY.length).toBeGreaterThanOrEqual(140);
    expect(new Set(LIBRARY.map((i) => i.id)).size).toBe(LIBRARY.length);
    for (const item of LIBRARY) expect(() => challengeSchema.parse(instantiate(item, 1, 0)), item.id).not.toThrow();
  });

  it('covers every difficulty level and every theme', () => {
    for (const d of [1, 2, 3, 4, 5]) expect(LIBRARY.filter((i) => i.difficulty === d).length, `difficulty ${d}`).toBeGreaterThanOrEqual(10);
    for (const t of ['mind', 'body', 'creative', 'social', 'practical', 'wellbeing']) expect(LIBRARY.filter((i) => i.theme === t).length, t).toBeGreaterThanOrEqual(12);
  });

  it('every rule-based criterion references a recorded or derived value', () => {
    for (const item of LIBRARY) {
      const keys = new Set([...item.metrics.map((m) => m.key), ...DERIVED]);
      expect(item.criteria.some((c) => !c.bonus), `${item.id} has a main criterion`).toBe(true);
      for (const c of item.criteria) {
        const r = c.rule;
        if (!r) continue;
        const refs = r.op === 'improve' ? [r.baseline, r.final] : r.op === 'ratio' ? [r.num, r.den] : r.op === 'evidenceMin' ? [] : [r.key];
        for (const k of refs) expect(keys.has(k), `${item.id} → ${k}`).toBe(true);
      }
    }
  });

  it('keeps the Signature 30 intact and in order', () => {
    expect(SIGNATURE_PLAN).toHaveLength(30);
    expect(getLibraryItem(SIGNATURE_PLAN[0]!)?.title).toBe('Learn to Juggle Three Balls');
    expect(getLibraryItem(SIGNATURE_PLAN[29]!)?.title).toBe('THE FINAL BOSS: Solve a 12-Sided Megaminx');
  });
});

describe('plan generator', () => {
  const diff = (ids: string[]) => ids.map((id) => getLibraryItem(id)!.difficulty);

  it('returns exactly the requested number of unique challenges', () => {
    for (const length of [3, 7, 14, 30, 60, 100]) {
      const plan = generatePlan(LIBRARY, { length, themes: [], equipment: [], seed: length });
      expect(plan).toHaveLength(length);
      expect(new Set(plan).size).toBe(length);
    }
  });

  it('never gets easier from one day to the next, and ramps from easy to hard', () => {
    for (const seed of [1, 2, 3, 99]) {
      const d = diff(generatePlan(LIBRARY, { length: 30, themes: [], equipment: [], seed }));
      for (let i = 1; i < d.length; i++) expect(d[i]!).toBeGreaterThanOrEqual(d[i - 1]!);
      expect(d[0]).toBeLessThanOrEqual(2);
      expect(d.at(-1)).toBeGreaterThanOrEqual(4);
    }
  });

  it('is deterministic per seed, and shuffling gives a different plan', () => {
    const a = generatePlan(LIBRARY, { length: 21, themes: [], equipment: [], seed: 7 });
    expect(generatePlan(LIBRARY, { length: 21, themes: [], equipment: [], seed: 7 })).toEqual(a);
    expect(generatePlan(LIBRARY, { length: 21, themes: [], equipment: [], seed: 8 })).not.toEqual(a);
  });

  it('prefers the chosen themes and available equipment', () => {
    const plan = generatePlan(LIBRARY, { length: 14, themes: ['creative'], equipment: [], seed: 5 });
    const items = plan.map((id) => getLibraryItem(id)!);
    expect(items.filter((i) => i.theme === 'creative').length).toBeGreaterThanOrEqual(10);
    expect(items.filter((i) => i.equipment.length > 0).length).toBeLessThanOrEqual(3);
  });

  it('honours exclusions and caps at the library size', () => {
    const plan = generatePlan(LIBRARY, { length: 10, themes: [], equipment: [], seed: 1, exclude: ['juggling'] });
    expect(plan).not.toContain('juggling');
    expect(generatePlan(LIBRARY.slice(0, 5), { length: 10, themes: [], equipment: [], seed: 1 })).toHaveLength(5);
  });

  it('targets and sorts sensibly', () => {
    expect(targetDifficulty(0, 30)).toBe(1);
    expect(targetDifficulty(29, 30)).toBe(5);
    expect(targetDifficulty(0, 1)).toBe(1);
    const sorted = sortByDifficulty([{ difficulty: 3, estimatedMinutes: 10 }, { difficulty: 1, estimatedMinutes: 90 }, { difficulty: 1, estimatedMinutes: 30 }]);
    expect(sorted.map((s) => s.estimatedMinutes)).toEqual([30, 90, 10]);
  });
});

describe('difficulty curves and rest days', () => {
  const avg = (ids: string[]) => {
    const d = ids.filter((id) => id !== REST_ID).map((id) => getLibraryItem(id)!.difficulty);
    return d.reduce((a, b) => a + b, 0) / d.length;
  };

  it('gentle plans are easier on average than steep ones', () => {
    const opts = { length: 30, themes: [] as never[], equipment: [], seed: 11 };
    const gentle = avg(generatePlan(LIBRARY, { ...opts, curve: 'gentle' }));
    const steady = avg(generatePlan(LIBRARY, { ...opts, curve: 'steady' }));
    const steep = avg(generatePlan(LIBRARY, { ...opts, curve: 'steep' }));
    expect(gentle).toBeLessThan(steady);
    expect(steady).toBeLessThan(steep);
    expect(targetDifficulty(15, 31, 'gentle')).toBeLessThan(targetDifficulty(15, 31, 'steep'));
  });

  it('places a rest day every 7th day, never last, and keeps the exact length', () => {
    for (const length of [7, 14, 21, 28, 30, 60]) {
      const plan = generatePlan(LIBRARY, { length, themes: [], equipment: [], seed: length, restEvery: 7 });
      expect(plan).toHaveLength(length);
      plan.forEach((id, i) => expect(id === REST_ID, `${length}: day ${i + 1}`).toBe(isRestDay(i + 1, length, 7)));
      expect(plan.at(-1)).not.toBe(REST_ID);
      expect(plan.filter((id) => id === REST_ID)).toHaveLength(restCount(length, 7));
    }
  });

  it('withRestDays and stripRest round-trip, and challenges still never get easier', () => {
    const plan = generatePlan(LIBRARY, { length: 30, themes: [], equipment: [], seed: 2, restEvery: 5 });
    const challenges = stripRest(plan);
    expect(withRestDays(challenges, 5)).toEqual(plan);
    const d = challenges.map((id) => getLibraryItem(id)!.difficulty);
    for (let i = 1; i < d.length; i++) expect(d[i]!).toBeGreaterThanOrEqual(d[i - 1]!);
    expect(withRestDays(SIGNATURE_PLAN, 7)).toHaveLength(34);
  });

  it('rest days show as rest, never missed, and are excluded from challenge counts', () => {
    expect(displayStatus('2026-11-01', '2026-12-01', { day: 7, kind: 'rest' }, null)).toBe('rest');
    const statuses = new Map<string, DisplayStatus>([['a', 'rest'], ['b', 'missed'], ['c', 'completed']]);
    const counts = challengeCounts(statuses);
    expect(counts.rest).toBe(1);
    expect(counts.remaining).toBe(1);
  });
});

describe('summary', () => {
  it('finds the longest run of active days', () => {
    const e = (date: string, status: HabitEntry['status'] = 'done'): HabitEntry => ({ id: date, habitId: 'h', date, status, value: null, text: '', extra: {}, notes: '', planned: true, updatedAt: 0 });
    const entries = [e('2026-11-01'), e('2026-11-02'), e('2026-11-03'), e('2026-11-05'), e('2026-11-06', 'missed')];
    expect(longestStreak(entries, [])).toBe(3);
    expect(longestStreak([], [])).toBe(0);
  });
});

describe('growth plans (tracks + wildcards)', () => {
  const lib = LIBRARY;
  const base = { length: 30, tracks: ['focus', 'money', 'speaking'], timeBudget: 'long' as const, wildcards: 'some' as const, includeFun: true, equipment: [], seed: 9 };

  it('fills the exact length with unique challenges', () => {
    for (const length of [7, 14, 30, 60, 90]) {
      const plan = growthPlan(lib, { ...base, length });
      expect(plan).toHaveLength(length);
      expect(new Set(plan).size).toBe(length);
    }
  });

  it('keeps every track in step order and weaves tracks together', () => {
    const plan = growthPlan(lib, base);
    for (const t of base.tracks) {
      const steps = plan.map((id) => getLibraryItem(id)!).filter((i) => i.track === t).map((i) => i.step!);
      expect(steps.length).toBeGreaterThanOrEqual(5);
      for (let i = 1; i < steps.length; i++) expect(steps[i]!).toBeGreaterThan(steps[i - 1]!);
      expect(steps.at(-1)).toBe(8); // every track ends on its capstone
    }
    // No track three days running.
    const tracks = plan.map((id) => getLibraryItem(id)!.track ?? 'wild');
    for (let i = 2; i < tracks.length; i++) expect(tracks[i] === tracks[i - 1] && tracks[i] === tracks[i - 2] && tracks[i] !== 'wild').toBe(false);
  });

  it('adds wildcards at the chosen rate, with fun ones only when allowed', () => {
    const count = (p: string[]) => p.filter((id) => !getLibraryItem(id)!.track).length;
    // 3 tracks × 8 steps = 24 track days, so 'none' at 24 days has no wildcards…
    expect(count(growthPlan(lib, { ...base, length: 24, wildcards: 'none' }))).toBe(0);
    // …and a longer plan fills the extra days with wildcards rather than repeating tracks.
    expect(count(growthPlan(lib, { ...base, wildcards: 'none' }))).toBe(6);
    expect(count(growthPlan(lib, { ...base, wildcards: 'some' }))).toBeGreaterThanOrEqual(5);
    expect(count(growthPlan(lib, { ...base, wildcards: 'many' }))).toBeGreaterThan(5);
    const noFun = growthPlan(lib, { ...base, wildcards: 'many', includeFun: false });
    expect(noFun.every((id) => getLibraryItem(id)!.pack === 'growth')).toBe(true);
  });

  it('always opens on a track step, even when wildcards fill most days', () => {
    for (const wildcards of ['none', 'some', 'many'] as const)
      for (const length of [7, 30, 60, 90]) {
        const plan = growthPlan(lib, { ...base, tracks: ['focus'], wildcards, length });
        expect(getLibraryItem(plan[0]!)!.track, `${wildcards} ${length}`).toBe('focus');
      }
  });

  it('respects the time budget except for capstone days', () => {
    const plan = growthPlan(lib, { ...base, timeBudget: 'short', wildcards: 'none' });
    for (const id of plan) {
      const i = getLibraryItem(id)!;
      if (i.step !== 8) expect(i.estimatedMinutes, id).toBeLessThanOrEqual(45);
    }
  });

  it('picks ladder steps by curve and always ends on the top', () => {
    expect(pickLadderSteps(8, 8)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(pickLadderSteps(8, 3)).toEqual([0, 4, 7]);
    expect(pickLadderSteps(8, 1)).toEqual([7]);
    const gentle = pickLadderSteps(8, 4, 'gentle');
    const steep = pickLadderSteps(8, 4, 'steep');
    expect(gentle.reduce((a, b) => a + b)).toBeLessThan(steep.reduce((a, b) => a + b));
    for (const p of [gentle, steep]) expect(new Set(p).size).toBe(4);
  });

  it('every track has 8 steps that never get easier, and stage wording applies', async () => {
    const { TRACKS } = await import('../data/tracks');
    const { instantiate } = await import('../data/challenges');
    for (const t of TRACKS) {
      const steps = LIBRARY.filter((i) => i.track === t.id).sort((a, b) => a.step! - b.step!);
      expect(steps.map((s) => s.step), t.id).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
      for (let i = 1; i < 8; i++) expect(steps[i]!.difficulty, `${t.id} step ${i + 1}`).toBeGreaterThanOrEqual(steps[i - 1]!.difficulty);
    }
    const earn = getLibraryItem('money-7')!;
    expect(instantiate(earn, 1, 0, 'student').title).toBe('Earn Your First Real Money');
    expect(instantiate(earn, 1, 0, 'early').title).toBe(earn.title);
    expect(instantiate(earn, 1, 0, 'student').track).toBe('money');
  });
});
