import { improvementPct, num } from './math';
import type { MetricsRecord } from './types';

/** Values computed from what the user entered. Shown read-only and used by success rules. */
export interface DerivedValue {
  key: string;
  label: string;
  value: number | boolean | null;
  unit?: string;
}

export function derivedValues(challengeId: string, m: MetricsRecord): DerivedValue[] {
  const out: DerivedValue[] = [];
  const wpm = (words: string, secs: string) => {
    const w = num(m[words]);
    const s = num(m[secs]);
    return w !== null && s !== null && s > 0 ? Math.round(w / (s / 60)) : null;
  };
  switch (challengeId) {
    case 'day-02': {
      const b = wpm('baseWords', 'baseSeconds');
      const f = wpm('finalWords', 'finalSeconds');
      if (b !== null) out.push({ key: 'baseWpm', label: 'Baseline speed', value: b, unit: 'wpm' });
      if (f !== null) out.push({ key: 'finalWpm', label: 'Final speed', value: f, unit: 'wpm' });
      const bb = b ?? num(m.baseWpm);
      const ff = f ?? num(m.finalWpm);
      if (bb !== null && ff !== null && bb > 0) out.push({ key: 'speedChange', label: 'Speed change', value: round1(improvementPct(bb, ff)), unit: '%' });
      break;
    }
    case 'day-08': {
      const h = num(m.serveHits);
      const t = num(m.serveTotal);
      if (h !== null && t !== null && t > 0) out.push({ key: 'serveAccuracy', label: 'Serve accuracy', value: Math.round((h / t) * 100), unit: '%' });
      break;
    }
    case 'day-10': {
      const sc = num(m.score);
      const acc = sc !== null ? Math.round((sc / 30) * 1000) / 10 : num(m.accuracy);
      if (sc !== null) out.push({ key: 'accuracy', label: 'Accuracy', value: acc, unit: '%' });
      const secs = num(m.seconds);
      out.push({ key: 'perfectUnder5', label: '100% in under 5 min', value: acc !== null && acc >= 100 && secs !== null && secs <= 300 });
      break;
    }
    case 'day-13': {
      const b = num(m.baseHits);
      const f = num(m.finalHits);
      if (b !== null) out.push({ key: 'baseAccuracy', label: 'Baseline accuracy', value: Math.round((b / 30) * 100), unit: '%' });
      if (f !== null) out.push({ key: 'finalAccuracy', label: 'Final accuracy', value: Math.round((f / 30) * 100), unit: '%' });
      if (b !== null && f !== null && b > 0) out.push({ key: 'accuracyChange', label: 'Improvement vs baseline', value: round1(improvementPct(b, f)), unit: '%' });
      break;
    }
    case 'day-28': {
      const w = num(m.wins) ?? 0;
      const d = num(m.draws) ?? 0;
      const l = num(m.losses) ?? 0;
      out.push({ key: 'gamesPlayed', label: 'Games played', value: w + d + l });
      const s = num(m.startRating);
      const e = num(m.endRating);
      if (s !== null && e !== null) out.push({ key: 'ratingChange', label: 'Rating change', value: e - s });
      const target = num(m.targetRating);
      if (e !== null && target !== null) out.push({ key: 'reachedTarget', label: 'Rating target reached', value: e >= target });
      break;
    }
    case 'day-29': {
      const b = num(m.baseline);
      const f = num(m.final);
      const target = num(m.targetPct);
      const better = m.better === 'lower' ? 'lower' : 'higher';
      if (b !== null && f !== null && b !== 0) {
        const pct = round1(improvementPct(b, f, better));
        out.push({ key: 'improvement', label: 'Improvement', value: pct, unit: '%' });
        if (target !== null) out.push({ key: 'improvementAchieved', label: 'Target met', value: pct >= target ? 1 : 0 });
      }
      break;
    }
  }
  return out;
}

const round1 = (x: number) => Math.round(x * 10) / 10;

/** User metrics merged with derived values (derived wins for computed keys). */
export function withDerived(challengeId: string, m: MetricsRecord): MetricsRecord {
  const out: MetricsRecord = { ...m };
  for (const d of derivedValues(challengeId, m)) out[d.key] = d.value;
  return out;
}
