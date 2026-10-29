import { rng } from './arithmetic';
import { restCount, withRestDays, type PlanCandidate } from './planner';
import type { DifficultyCurve } from './types';

export interface GrowthCandidate extends PlanCandidate {
  pack: 'growth' | 'fun';
  track?: string;
  step?: number;
}

export type TimeBudget = 'short' | 'medium' | 'long';
export type WildcardRate = 'none' | 'some' | 'many';

export interface GrowthOptions {
  length: number;
  tracks: readonly string[];
  timeBudget: TimeBudget;
  wildcards: WildcardRate;
  includeFun: boolean;
  curve?: DifficultyCurve;
  restEvery?: number;
  equipment: readonly string[];
  seed: number;
}

/** Normal ceiling on a day's estimated minutes. A track's final step is always allowed (a "boss" day). */
export const TIME_CAP: Record<TimeBudget, number> = { short: 45, medium: 90, long: 300 };
const WILD_SHARE: Record<WildcardRate, number> = { none: 0, some: 1 / 6, many: 1 / 4 };
const CURVE_POWER: Record<DifficultyCurve, number> = { gentle: 1.6, steady: 1, steep: 0.6 };

/** Split `total` into `n` near-equal parts, bounded by each part's capacity. Leftover is returned. */
function distribute(total: number, caps: readonly number[]): { parts: number[]; leftover: number } {
  const parts = caps.map(() => 0);
  let left = total;
  let progress = true;
  while (left > 0 && progress) {
    progress = false;
    for (let i = 0; i < caps.length && left > 0; i++) {
      if (parts[i]! < caps[i]!) {
        parts[i]!++;
        left--;
        progress = true;
      }
    }
  }
  return { parts, leftover: left };
}

/** Pick `k` of `n` ladder positions, spread by the curve, always ending on the top step. */
export function pickLadderSteps(n: number, k: number, curve: DifficultyCurve = 'steady'): number[] {
  if (k >= n) return Array.from({ length: n }, (_, i) => i);
  if (k <= 0) return [];
  if (k === 1) return [n - 1];
  const out: number[] = [];
  for (let j = 0; j < k; j++) {
    let pos = Math.round(Math.pow(j / (k - 1), CURVE_POWER[curve]) * (n - 1));
    const prev = out.at(-1);
    if (prev !== undefined && pos <= prev) pos = prev + 1;
    out.push(pos);
  }
  // If bumping pushed past the top, pull earlier ones back down while keeping the order.
  for (let j = k - 1; j >= 0; j--) {
    const max = n - (k - j);
    if (out[j]! > max) out[j] = max;
  }
  return out;
}

/**
 * Build a growth plan: chosen tracks are woven together (each keeps its own order, so steps build
 * on each other), standalone wildcard days are spread through, optionally including fun ones, and
 * days are chosen to fit the time budget. Deterministic per seed.
 */
export function growthPlan(library: readonly GrowthCandidate[], o: GrowthOptions): string[] {
  const r = rng(o.seed);
  const every = o.restEvery ?? 0;
  const slots = Math.max(1, o.length - restCount(o.length, every));
  const cap = TIME_CAP[o.timeBudget];
  const curve = o.curve ?? 'steady';
  const has = new Set(o.equipment);

  const ladders = o.tracks
    .map((t) => library.filter((i) => i.track === t).sort((a, b) => (a.step ?? 0) - (b.step ?? 0)))
    .filter((l) => l.length > 0)
    .map((l) => l.filter((s, idx) => s.estimatedMinutes <= cap || idx === l.length - 1));

  let wildCount = ladders.length ? Math.round(slots * WILD_SHARE[o.wildcards]) : slots;
  const { parts, leftover } = distribute(slots - wildCount, ladders.map((l) => l.length));
  wildCount += leftover;

  type Placed = { id: string; frac: number; order: number; difficulty: number };
  const placed: Placed[] = [];
  const used = new Set<string>();
  ladders.forEach((ladder, ti) => {
    const k = parts[ti] ?? 0;
    pickLadderSteps(ladder.length, k, curve).forEach((idx, j) => {
      const item = ladder[idx]!;
      used.add(item.id);
      placed.push({ id: item.id, frac: (j + 0.5) / k, order: ti, difficulty: item.difficulty });
    });
  });

  // Wildcards: standalone growth challenges (and fun ones if allowed), matched to where they fall.
  const wildPool = library.filter((i) => !i.track && i.id !== 'rest' && (i.pack === 'growth' || o.includeFun));
  const recentCats: string[] = [];
  for (let j = 0; j < wildCount; j++) {
    // Evenly spaced strictly inside the plan, so it opens on track step 1 and ends on capstones.
    const frac = ladders.length ? (j + 1) / (wildCount + 1) : (j + 0.5) / wildCount;
    const target = 1 + 4 * Math.pow(frac, CURVE_POWER[curve]);
    const wantFun = o.includeFun && r() < 0.35;
    let best: GrowthCandidate | null = null;
    let bestScore = Infinity;
    for (const c of wildPool) {
      if (used.has(c.id)) continue;
      let score = Math.abs(c.difficulty - target) * 2;
      // Over-budget days only if nothing within budget is left.
      if (c.estimatedMinutes > cap) score += 100;
      if (!c.equipment.every((e) => has.has(e))) score += 2.5;
      if (recentCats.includes(c.category)) score += 1.5;
      if (o.includeFun && (c.pack === 'fun') !== wantFun) score += 1.2;
      score += r() * 0.9;
      if (score < bestScore) {
        bestScore = score;
        best = c;
      }
    }
    if (!best) break;
    used.add(best.id);
    recentCats.push(best.category);
    if (recentCats.length > 2) recentCats.shift();
    placed.push({ id: best.id, frac, order: ladders.length + j, difficulty: best.difficulty });
  }

  // Top up if the library ran short (tiny libraries or extreme lengths).
  for (const c of library) {
    if (placed.length >= slots) break;
    if (used.has(c.id) || c.id === 'rest') continue;
    used.add(c.id);
    placed.push({ id: c.id, frac: 1, order: 999, difficulty: c.difficulty });
  }

  placed.sort((a, b) => a.frac - b.frac || a.order - b.order);
  const ids = placed.slice(0, slots).map((p) => p.id);
  // Open on a track's first step, not a wildcard.
  const firstTrack = ids.findIndex((id) => used.has(id) && placed.find((p) => p.id === id)!.order < ladders.length);
  if (firstTrack > 0) ids.unshift(...ids.splice(firstTrack, 1));
  return withRestDays(ids, every);
}
