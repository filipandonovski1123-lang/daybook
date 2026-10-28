import { describe, expect, it } from 'vitest';
import { instantiate } from '../data/challenges';
import { getLibraryItem, LIBRARY, SIGNATURE_PLAN } from '../data/library';
import { generatePlan, sortByDifficulty, targetDifficulty } from './planner';
import { challengeSchema } from './types';

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
