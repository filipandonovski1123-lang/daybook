import { rng } from './arithmetic';
import type { ChallengeTheme } from './types';

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
}

/** Target difficulty for day index i of n: a straight ramp from 1 to 5. */
export function targetDifficulty(i: number, n: number): number {
  return n <= 1 ? 1 : 1 + (4 * i) / (n - 1);
}

/**
 * Build an escalating plan. Each day picks the unused item closest to the day's target
 * difficulty, preferring the user's themes and available equipment and avoiding the same
 * category two days running. The result is then sorted so difficulty never decreases.
 * Deterministic for a given seed, so "shuffle" just changes the seed.
 */
export function generatePlan(library: readonly PlanCandidate[], o: PlanOptions): string[] {
  const r = rng(o.seed);
  const n = Math.max(1, Math.min(o.length, library.length));
  const used = new Set(o.exclude ?? []);
  const has = new Set(o.equipment);
  const picked: PlanCandidate[] = [];
  for (let i = 0; i < n; i++) {
    const target = targetDifficulty(i, n);
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
  return sortByDifficulty(picked).map((p) => p.id);
}

/** Easiest first; ties broken by shorter estimated time, then original order (stable). */
export function sortByDifficulty<T extends Pick<PlanCandidate, 'difficulty' | 'estimatedMinutes'>>(items: readonly T[]): T[] {
  return items
    .map((item, idx) => ({ item, idx }))
    .sort((a, b) => a.item.difficulty - b.item.difficulty || a.item.estimatedMinutes - b.item.estimatedMinutes || a.idx - b.idx)
    .map((x) => x.item);
}

export const LENGTH_PRESETS = [7, 14, 21, 30, 60, 90] as const;
