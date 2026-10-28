/** Deterministic PRNG (mulberry32) so tests and replays are reproducible. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface Question {
  text: string;
  answer: number;
  op: '+' | '−' | '×' | '÷';
}

const int = (r: () => number, lo: number, hi: number) => lo + Math.floor(r() * (hi - lo + 1));

/** Mixed arithmetic with whole-number answers. `level` 1 = sprint-friendly, 2 = harder test questions. */
export function makeQuestion(r: () => number, level: 1 | 2 = 2): Question {
  const op = (['+', '−', '×', '÷'] as const)[int(r, 0, 3)] ?? '+';
  switch (op) {
    case '+': {
      const a = level === 1 ? int(r, 2, 60) : int(r, 12, 499);
      const b = level === 1 ? int(r, 2, 40) : int(r, 12, 399);
      return { text: `${a} + ${b}`, answer: a + b, op };
    }
    case '−': {
      const a = level === 1 ? int(r, 10, 99) : int(r, 50, 999);
      const b = int(r, 2, a - 1);
      return { text: `${a} − ${b}`, answer: a - b, op };
    }
    case '×': {
      const a = level === 1 ? int(r, 2, 12) : int(r, 3, 25);
      const b = level === 1 ? int(r, 2, 12) : int(r, 3, 19);
      return { text: `${a} × ${b}`, answer: a * b, op };
    }
    case '÷': {
      const b = level === 1 ? int(r, 2, 12) : int(r, 3, 19);
      const q = level === 1 ? int(r, 2, 12) : int(r, 3, 25);
      return { text: `${b * q} ÷ ${b}`, answer: q, op };
    }
  }
}

export function makeTest(seed: number, count: number, level: 1 | 2 = 2): Question[] {
  const r = rng(seed);
  return Array.from({ length: count }, () => makeQuestion(r, level));
}

export function parseAnswer(s: string): number | null {
  const t = s.trim().replace(/^−/, '-');
  if (!/^-?\d+$/.test(t)) return null;
  return Number(t);
}

// ---------------------------------------------------------------- pi

export const PI_100 = '1415926535897932384626433832795028841971693993751058209749445923078164062862089986280348253421170679';

export interface PiResult {
  /** Digits correct from the start until the first error. */
  streak: number;
  /** Positions correct anywhere in the attempt. */
  positionsCorrect: number;
  firstErrorAt: number | null;
  entered: number;
}

export function checkPi(attempt: string): PiResult {
  const digits = attempt.replace(/^3\.?/, '').replace(/[^0-9]/g, '').slice(0, 100);
  let streak = 0;
  let firstErrorAt: number | null = null;
  let positionsCorrect = 0;
  for (let i = 0; i < digits.length; i++) {
    const ok = digits[i] === PI_100[i];
    if (ok) positionsCorrect++;
    if (ok && firstErrorAt === null) streak++;
    if (!ok && firstErrorAt === null) firstErrorAt = i + 1;
  }
  return { streak, positionsCorrect, firstErrorAt, entered: digits.length };
}
