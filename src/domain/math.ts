export function num(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) return Number(v);
  return null;
}

/** Signed % improvement; positive means better regardless of direction. */
export function improvementPct(baseline: number, final: number, better: 'higher' | 'lower' = 'higher'): number {
  if (baseline === 0) return 0;
  const raw = ((final - baseline) / Math.abs(baseline)) * 100;
  return better === 'higher' ? raw : -raw;
}
