import { withDerived } from './derived';
import { improvementPct, num } from './math';
import type { Attempt, Challenge, ChallengeProgress, Criterion, EvidenceMeta, MetricsRecord, PbKey, Rule } from './types';

export { improvementPct, num };

export type CriterionResult = { met: boolean; auto: boolean; detail?: string };

export function evaluateRule(rule: Rule, metrics: MetricsRecord, evidence: readonly EvidenceMeta[]): CriterionResult {
  switch (rule.op) {
    case 'gte': {
      const v = num(metrics[rule.key]);
      return { met: v !== null && v >= rule.value, auto: true, detail: v === null ? 'Not recorded' : `${v} / ${rule.value}` };
    }
    case 'lte': {
      const v = num(metrics[rule.key]);
      return { met: v !== null && v <= rule.value, auto: true, detail: v === null ? 'Not recorded' : `${v} (≤ ${rule.value})` };
    }
    case 'true':
      return { met: metrics[rule.key] === true, auto: true };
    case 'improve': {
      const b = num(metrics[rule.baseline]);
      const f = num(metrics[rule.final]);
      if (b === null || f === null || b === 0) return { met: false, auto: true, detail: 'Needs baseline and final' };
      const change = improvementPct(b, f, rule.better);
      return { met: change >= rule.pct, auto: true, detail: `${change >= 0 ? '+' : ''}${change.toFixed(1)}% (need ${rule.pct}%)` };
    }
    case 'ratio': {
      const n = num(metrics[rule.num]);
      const d = num(metrics[rule.den]);
      if (n === null || d === null || d === 0) return { met: false, auto: true, detail: 'Not recorded' };
      const pct = (n / d) * 100;
      return { met: pct >= rule.pct, auto: true, detail: `${pct.toFixed(0)}% (need ${rule.pct}%)` };
    }
    case 'listMin': {
      const v = metrics[rule.key];
      const count = Array.isArray(v) ? v.filter((s) => s.trim()).length : 0;
      return { met: count >= rule.count, auto: true, detail: `${count} / ${rule.count}` };
    }
    case 'evidenceMin': {
      const count = evidence.filter((e) => !rule.tag || e.tag === rule.tag).length;
      return { met: count >= rule.count, auto: true, detail: `${count} / ${rule.count} files` };
    }
  }
}

export function evaluateCriterion(c: Criterion, progress: Pick<ChallengeProgress, 'metrics' | 'checked'>, evidence: readonly EvidenceMeta[]): CriterionResult {
  if (c.rule) return evaluateRule(c.rule, progress.metrics, evidence);
  return { met: progress.checked.includes(c.id), auto: false };
}

export interface CompletionCheck {
  mainMet: boolean;
  bonusMet: boolean;
  results: { criterion: Criterion; result: CriterionResult }[];
}

export function checkCompletion(challenge: Pick<Challenge, 'id' | 'criteria'>, progress: Pick<ChallengeProgress, 'metrics' | 'checked'>, evidence: readonly EvidenceMeta[]): CompletionCheck {
  const p = { checked: progress.checked, metrics: withDerived(challenge.id, progress.metrics) };
  const results = challenge.criteria.map((criterion) => ({ criterion, result: evaluateCriterion(criterion, p, evidence) }));
  const main = results.filter((r) => !r.criterion.bonus);
  const bonus = results.filter((r) => r.criterion.bonus);
  return {
    mainMet: main.length > 0 && main.every((r) => r.result.met),
    bonusMet: bonus.length > 0 && bonus.every((r) => r.result.met),
    results,
  };
}

// ---------------------------------------------------------------- personal bests

export interface PbEvent {
  challengeId: string;
  key: string;
  label: string;
  unit?: string;
  better: 'higher' | 'lower';
  previous: number;
  value: number;
  improvementPct: number;
  at: number;
  source: 'attempt' | 'baseline-final';
}

export interface PbSummary {
  key: string;
  label: string;
  unit?: string;
  better: 'higher' | 'lower';
  best: number | null;
  first: number | null;
  count: number;
}

/**
 * A personal best is a logged value that beats a previously logged value for the same metric,
 * or a final measurement that beats its baseline. The very first value is a starting point, not a PB.
 */
export function personalBests(challenge: Pick<Challenge, 'id' | 'pbKeys'>, progress: Pick<ChallengeProgress, 'metrics' | 'updatedAt'> | null, attempts: readonly Attempt[]): { events: PbEvent[]; summaries: PbSummary[] } {
  const events: PbEvent[] = [];
  const summaries: PbSummary[] = [];
  const pm = progress ? withDerived(challenge.id, progress.metrics) : {};
  const sorted = [...attempts].filter((a) => a.challengeId === challenge.id).sort((a, b) => a.at - b.at);
  for (const k of challenge.pbKeys) {
    const isBetter = (x: number, y: number) => (k.better === 'higher' ? x > y : x < y);
    if (k.baselineKey) {
      const b = num(pm[k.baselineKey]);
      const f = num(pm[k.key]);
      summaries.push({ key: k.key, label: k.label, unit: k.unit, better: k.better, first: b, best: f !== null && b !== null ? (isBetter(f, b) ? f : b) : f ?? b, count: (b !== null ? 1 : 0) + (f !== null ? 1 : 0) });
      if (b !== null && f !== null && isBetter(f, b)) {
        events.push({ challengeId: challenge.id, key: k.key, label: k.label, unit: k.unit, better: k.better, previous: b, value: f, improvementPct: improvementPct(b, f, k.better), at: progress?.updatedAt ?? 0, source: 'baseline-final' });
      }
      continue;
    }
    let best: number | null = null;
    let first: number | null = null;
    let count = 0;
    for (const a of sorted) {
      const v = num(a.metrics[k.key]);
      if (v === null) continue;
      count++;
      if (first === null) first = v;
      if (best !== null && isBetter(v, best)) {
        events.push({ challengeId: challenge.id, key: k.key, label: k.label, unit: k.unit, better: k.better, previous: best, value: v, improvementPct: improvementPct(best, v, k.better), at: a.at, source: 'attempt' });
      }
      if (best === null || isBetter(v, best)) best = v;
    }
    summaries.push({ key: k.key, label: k.label, unit: k.unit, better: k.better, best, first, count });
  }
  return { events, summaries };
}

export function pbKeyFor(challenge: Pick<Challenge, 'pbKeys'>, key: string): PbKey | undefined {
  return challenge.pbKeys.find((k) => k.key === key);
}
