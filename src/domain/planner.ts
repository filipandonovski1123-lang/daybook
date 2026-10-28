import { rng } from './arithmetic';
import type { ChallengeTheme, DifficultyCurve } from './types';

/** Plan entry for a rest / catch-up day (may repeat). */
export const REST_ID = 'rest';

/** The parts of a library item the planner needs. */
export interface PlanCandidate {
  id: string;
  theme: ChallengeTheme;
  category: string;
  difficulty: number;
  estimatedMinutes: number;
  equipment: readonly string[];
}

export interface PlanOptions {
  length: number;
  /** Preferred themes; empty = no preference. */
  themes: readonly ChallengeTheme[];
  /** Equipment the user has. Items needing anything else are used only when nothing else fits. */
  equipment: readonly string[];
  seed: number;
  /** Ids that must not be chosen (e.g. days already locked in). */
  exclude?: readonly string[];
  curve?: DifficultyCurve;
  /** Insert a rest day every N days (0 = none). Counts towards `length`. */
  restEvery?: number;
}

const CURVE_POWER: Record<DifficultyCurve, number> = { gentle: 1.7, steady: 1, steep: 0.55 };

/**
 * Target difficulty for challenge index i of n, from 1 to 5. Gentle stays easier for longer,
 * steep gets hard quickly, steady is a straight line.
 */
export function targetDifficulty(i: number, n: number, curve: DifficultyCurve = 'steady'): number {
  if (n <= 1) return 1;
  return 1 + 4 * Math.pow(i / (n - 1), CURVE_POWER[curve]);
}

/** Number of rest days in a program of `length` days with a rest every `every` days. The last day is never rest. */
export function restCount(length: number, every: number): number {
  let n = 0;
  for (let d = 1; d <= length; d++) if (isRestDay(d, length, every)) n++;
  return n;
}

/** Is day `day` (1-based) of a `length`-day plan a rest day? Every `every`-th day, never the last. */
export function isRestDay(day: number, length: number, every: number): boolean {
  return every >= 2 && day % every === 0 && day !== length;
}

/**
 * Interleave rest days among challenges (same rule as isRestDay). The total length is the
 * smallest length whose non-rest days fit all the challenges, so the plan ends on a challenge.
 */
export function withRestDays(challengeIds: readonly string[], every: number): string[] {
  if (every < 2) return [...challengeIds];
  let length = challengeIds.length;
  while (length - restCount(length, every) < challengeIds.length) length++;
  const out: string[] = [];
  let next = 0;
  for (let d = 1; d <= length; d++) out.push(isRestDay(d, length, every) ? REST_ID : (challengeIds[next++] ?? REST_ID));
  return out;
}

export function stripRest(plan: readonly string[]): string[] {
  return plan.filter((id) => id !== REST_ID);
}

/**
 * Build an escalating plan. Each day picks the unused item closest to the day's target
 * difficulty, preferring the user's themes and available equipment and avoiding the same
 * category two days running. The result is then sorted so difficulty never decreases.
 * Deterministic for a given seed, so "shuffle" just changes the seed.
 */
export function generatePlan(library: readonly PlanCandidate[], o: PlanOptions): string[] {
  const r = rng(o.seed);
  const every = o.restEvery ?? 0;
  const n = Math.max(1, Math.min(o.length - restCount(o.length, every), library.length));
  const used = new Set(o.exclude ?? []);
  const has = new Set(o.equipment);
  const picked: PlanCandidate[] = [];
  for (let i = 0; i < n; i++) {
    const target = targetDifficulty(i, n, o.curve);
    const recentCats = picked.slice(-2).map((p) => p.category);
    let best: PlanCandidate | null = null;
    let bestScore = Infinity;
    for (const c of library) {
      if (used.has(c.id)) continue;
      let score = Math.abs(c.difficulty - target) * 2;
      if (o.themes.length && !o.themes.includes(c.theme)) score += 3;
      if (!c.equipment.every((e) => has.has(e))) score += 2.5;
      if (recentCats.includes(c.category)) score += 1.5;
      if (picked.at(-1)?.theme === c.theme) score += 0.4;
      score += r() * 0.9;
      if (score < bestScore) {
        bestScore = score;
        best = c;
      }
    }
    if (!best) break;
    used.add(best.id);
    picked.push(best);
  }
  return withRestDays(sortByDifficulty(picked).map((p) => p.id), every);
}

/** Easiest first; ties broken by shorter estimated time, then original order (stable). */
export function sortByDifficulty<T extends Pick<PlanCandidate, 'difficulty' | 'estimatedMinutes'>>(items: readonly T[]): T[] {
  return items
    .map((item, idx) => ({ item, idx }))
    .sort((a, b) => a.item.difficulty - b.item.difficulty || a.item.estimatedMinutes - b.item.estimatedMinutes || a.idx - b.idx)
    .map((x) => x.item);
}

export const LENGTH_PRESETS = [7, 14, 21, 30, 60, 90] as const;
