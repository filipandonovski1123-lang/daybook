import clsx from 'clsx';
import { ArrowLeft, Check, Pause, Play, RotateCcw, Square, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { Badge, Button, Card, Field, Input, PageHeader, Segmented, Textarea } from '../../components/ui';
import { logAttempt, logHabit, setMetrics } from '../../db/actions';
import { checkPi, makeTest, parseAnswer, PI_100, type Question } from '../../domain/arithmetic';
import { improvementPct, num } from '../../domain/criteria';
import { formatDuration } from '../../domain/dates';
import { entryId } from '../../domain/habits';
import type { Challenge, MetricValue, ToolId } from '../../domain/types';
import { useAction, useApp } from '../../lib/appData';
import { useToast } from '../../lib/toast';
import { challengeKey } from '../../data/library';
import { TOOL_META } from '../challenges/ChallengeDetailPage';
import { usePersistentTimer } from './timer';

const ORDER: ToolId[] = ['focus', 'stopwatch', 'countdown', 'pbCalc', 'arithmetic30', 'arithmetic60', 'pi', 'readingTest', 'solveTimer', 'logicTimer'];

export default function ToolsPage() {
  const { tool } = useParams();
  const [params] = useSearchParams();
  const { data } = useApp();
  const challenge = data.challenges.find((c) => c.id === params.get('challenge')) ?? null;
  const t = ORDER.includes(tool as ToolId) ? (tool as ToolId) : null;

  if (!t)
    return (
      <div>
        <PageHeader title="Tools" subtitle="Timers and tests that save straight into your challenges and habits." />
        <div className="grid gap-2.5 sm:grid-cols-2">
          {ORDER.map((id) => {
            const M = TOOL_META[id];
            return (
              <Link key={id} to={`/tools/${id}`}>
                <Card className="flex items-center gap-3 p-4 transition-colors hover:border-line-strong">
                  <span className="flex size-9 items-center justify-center rounded-lg bg-surface-2 text-slate">
                    <M.icon className="size-4" />
                  </span>
                  <span className="font-medium">{M.label}</span>
                </Card>
              </Link>
            );
          })}
        </div>
      </div>
    );

  return (
    <div>
      <Link to={challenge ? `/challenges/${challenge.id}` : '/tools'} className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-ink-2 hover:text-ink">
        <ArrowLeft className="size-4" /> {challenge ? `Day ${challenge.day}: ${challenge.title}` : 'All tools'}
      </Link>
      <PageHeader title={TOOL_META[t].label} subtitle={challenge ? 'Results are saved to this challenge.' : undefined} />
      {t === 'focus' && <FocusTimer />}
      {t === 'stopwatch' && <Stopwatch challenge={challenge} />}
      {t === 'countdown' && <Countdown />}
      {t === 'pbCalc' && <PbCalculator />}
      {t === 'arithmetic30' && <ArithmeticTest challenge={challenge ?? data.challenges.find((c) => challengeKey(c) === 'mental-arithmetic') ?? null} />}
      {t === 'arithmetic60' && <Sprint challenge={challenge ?? data.challenges.find((c) => challengeKey(c) === 'maths-sprint') ?? null} />}
      {t === 'pi' && <PiTest challenge={challenge ?? data.challenges.find((c) => challengeKey(c) === 'pi-digits') ?? null} />}
      {t === 'readingTest' && <ReadingTimer challenge={challenge ?? data.challenges.find((c) => challengeKey(c) === 'speed-reading') ?? null} />}
      {t === 'solveTimer' && <SolveTimer challenge={challenge ?? data.challenges.find((c) => challengeKey(c) === 'megaminx') ?? null} />}
      {t === 'logicTimer' && <LogicTimer challenge={challenge ?? data.challenges.find((c) => challengeKey(c) === 'logic-problems') ?? null} />}
    </div>
  );
}

function BigTime({ ms, label }: { ms: number; label?: string }) {
  return (
    <div className="py-6 text-center">
      <p className="tnum font-display text-6xl md:text-7xl" aria-live="off">
        {formatDuration(ms)}
      </p>
      {label && <p className="mt-2 text-sm text-ink-3">{label}</p>}
    </div>
  );
}

function useChime() {
  return () => {
    try {
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return;
      const ctx = new Ctx();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = 880;
      g.gain.setValueAtTime(0.12, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 1.2);
      o.connect(g).connect(ctx.destination);
      o.start();
      o.stop(ctx.currentTime + 1.2);
    } catch {
      /* audio unavailable */
    }
    navigator.vibrate?.(200);
  };
}

// ---------------------------------------------------------------- Focus

function FocusTimer() {
  const { data, today } = useApp();
  const toast = useToast();
  const [minutes, setMinutes] = useState(30);
  const timer = usePersistentTimer('focus', 'focus', minutes * 60_000);
  const chime = useChime();
  const done = timer.remaining === 0 && timer.exists;
  const notified = useRef(false);
  const focusHabit = data.habits.find((h) => h.id === 'focus');
  const existing = data.entries.find((e) => e.id === entryId('focus', today));
  const logIt = useAction((mins: number) => logHabit('focus', today, { value: (existing?.value ?? 0) + mins }), { success: (e) => `Focus logged: ${e?.value ?? 0} min today.` });

  useEffect(() => {
    if (done && !notified.current) {
      notified.current = true;
      if (timer.running) void timer.pause();
      chime();
      toast.show('Focus session complete.', { tone: 'success' });
    }
    if (!done) notified.current = false;
  }, [done, timer, chime, toast]);

  const elapsedMin = Math.floor(timer.elapsed / 60_000);
  return (
    <Card className="p-5 md:p-7">
      {!timer.exists && (
        <div className="mb-2 flex justify-center">
          <Segmented label="Session length" value={String(minutes)} onChange={(v) => setMinutes(Number(v))} options={[15, 25, 30, 45, 60].map((m) => ({ value: String(m), label: `${m}m` }))} />
        </div>
      )}
      <BigTime ms={timer.remaining ?? 0} label={timer.running ? 'Distraction-free. Phone away.' : timer.exists ? (done ? 'Done' : 'Paused — progress saved') : `${minutes}-minute session`} />
      <div className="flex flex-wrap justify-center gap-2">
        {!timer.running && !done && (
          <Button variant="primary" size="lg" icon={<Play className="size-4" />} onClick={() => void timer.start(timer.exists ? undefined : minutes * 60_000)}>
            {timer.exists ? 'Resume' : 'Start'}
          </Button>
        )}
        {timer.running && (
          <Button size="lg" icon={<Pause className="size-4" />} onClick={() => void timer.pause()}>
            Pause
          </Button>
        )}
        {timer.exists && (
          <Button size="lg" variant="ghost" icon={<RotateCcw className="size-4" />} onClick={() => void timer.reset()}>
            Reset
          </Button>
        )}
        {focusHabit && timer.exists && elapsedMin > 0 && (
          <Button
            size="lg"
            variant="success"
            icon={<Check className="size-4" />}
            busy={logIt.busy}
            onClick={async () => {
              await logIt.run(elapsedMin);
              await timer.reset();
            }}
          >
            Log {elapsedMin} min to Focus
          </Button>
        )}
      </div>
      <p className="mt-5 text-center text-xs text-ink-3">The timer keeps running across refreshes and app switches. Today so far: {existing?.value ?? 0} of {focusHabit?.target ?? 30} min.</p>
    </Card>
  );
}

// ---------------------------------------------------------------- Stopwatch / countdown

function Stopwatch({ challenge }: { challenge: Challenge | null }) {
  const timer = usePersistentTimer(`stopwatch-${challenge?.id ?? 'free'}`, 'stopwatch');
  const [laps, setLaps] = useState<number[]>([]);
  const log = useAction(() => logAttempt({ challengeId: challenge!.id, kind: 'practice', label: 'Timed session', metrics: {}, durationSec: Math.round(timer.elapsed / 1000), note: '' }), { success: 'Session logged to the challenge.' });
  return (
    <Card className="p-5 md:p-7">
      <BigTime ms={timer.elapsed} label={timer.running ? 'Running' : timer.exists ? 'Paused' : 'Ready'} />
      <div className="flex flex-wrap justify-center gap-2">
        {!timer.running ? (
          <Button variant="primary" size="lg" icon={<Play className="size-4" />} onClick={() => void timer.start()}>
            {timer.exists ? 'Resume' : 'Start'}
          </Button>
        ) : (
          <>
            <Button size="lg" icon={<Pause className="size-4" />} onClick={() => void timer.pause()}>
              Pause
            </Button>
            <Button size="lg" variant="ghost" onClick={() => setLaps([timer.elapsed, ...laps])}>
              Lap
            </Button>
          </>
        )}
        {timer.exists && (
          <Button size="lg" variant="ghost" icon={<RotateCcw className="size-4" />} onClick={() => { void timer.reset(); setLaps([]); }}>
            Reset
          </Button>
        )}
        {challenge && timer.exists && !timer.running && timer.elapsed > 1000 && (
          <Button size="lg" variant="success" busy={log.busy} onClick={async () => { await log.run(); await timer.reset(); setLaps([]); }}>
            Log session
          </Button>
        )}
      </div>
      {laps.length > 0 && (
        <ol className="tnum mx-auto mt-5 max-w-xs space-y-1 text-sm">
          {laps.map((l, i) => (
            <li key={i} className="flex justify-between text-ink-2">
              <span>Lap {laps.length - i}</span>
              <span>{formatDuration(l)}</span>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}

function Countdown() {
  const [mins, setMins] = useState('5');
  const [secs, setSecs] = useState('0');
  const ms = (Number(mins) || 0) * 60_000 + (Number(secs) || 0) * 1000;
  const timer = usePersistentTimer('countdown', 'countdown', ms);
  const chime = useChime();
  const done = timer.exists && timer.remaining === 0;
  const fired = useRef(false);
  useEffect(() => {
    if (done && !fired.current) {
      fired.current = true;
      chime();
      if (timer.running) void timer.pause();
    }
    if (!done) fired.current = false;
  }, [done, chime, timer]);
  return (
    <Card className="p-5 md:p-7">
      {!timer.exists && (
        <div className="flex flex-wrap items-end justify-center gap-2">
          <Field label="Minutes" htmlFor="cd-m" className="w-24">
            <Input id="cd-m" type="number" min={0} max={600} value={mins} onChange={(e) => setMins(e.target.value)} />
          </Field>
          <Field label="Seconds" htmlFor="cd-s" className="w-24">
            <Input id="cd-s" type="number" min={0} max={59} value={secs} onChange={(e) => setSecs(e.target.value)} />
          </Field>
          {[1, 3, 5, 10].map((m) => (
            <Button key={m} size="sm" onClick={() => { setMins(String(m)); setSecs('0'); }}>
              {m}m
            </Button>
          ))}
        </div>
      )}
      <BigTime ms={timer.exists ? (timer.remaining ?? 0) : ms} label={done ? 'Time!' : timer.running ? 'Counting down' : timer.exists ? 'Paused' : undefined} />
      <div className="flex justify-center gap-2">
        {!timer.running && !done && (
          <Button variant="primary" size="lg" icon={<Play className="size-4" />} disabled={!timer.exists && ms <= 0} onClick={() => void timer.start(timer.exists ? undefined : ms)}>
            {timer.exists ? 'Resume' : 'Start'}
          </Button>
        )}
        {timer.running && (
          <Button size="lg" icon={<Pause className="size-4" />} onClick={() => void timer.pause()}>
            Pause
          </Button>
        )}
        {timer.exists && (
          <Button size="lg" variant="ghost" icon={<RotateCcw className="size-4" />} onClick={() => void timer.reset()}>
            Reset
          </Button>
        )}
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------- PB calculator

function PbCalculator() {
  const [b, setB] = useState('');
  const [f, setF] = useState('');
  const [better, setBetter] = useState<'higher' | 'lower'>('higher');
  const bn = num(b);
  const fn = num(f);
  const pct = bn !== null && fn !== null && bn !== 0 ? improvementPct(bn, fn, better) : null;
  return (
    <Card className="p-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Before (baseline)" htmlFor="pb-b">
          <Input id="pb-b" type="number" inputMode="decimal" value={b} onChange={(e) => setB(e.target.value)} />
        </Field>
        <Field label="After (final)" htmlFor="pb-f">
          <Input id="pb-f" type="number" inputMode="decimal" value={f} onChange={(e) => setF(e.target.value)} />
        </Field>
        <div>
          <p className="mb-1.5 text-[13px] font-medium text-ink-2">Better is</p>
          <Segmented label="Better is" value={better} onChange={setBetter} options={[{ value: 'higher', label: 'Higher' }, { value: 'lower', label: 'Lower' }]} />
        </div>
      </div>
      <div className="mt-6 rounded-xl bg-surface-2 p-5 text-center">
        {pct === null ? (
          <p className="text-sm text-ink-3">{bn === 0 ? 'Baseline can’t be zero for a percentage.' : 'Enter both values.'}</p>
        ) : (
          <>
            <p className={clsx('tnum font-display text-4xl', pct > 0 ? 'text-success' : pct < 0 ? 'text-danger' : 'text-ink')}>
              {pct > 0 ? '+' : ''}
              {pct.toFixed(1)}%
            </p>
            <p className="mt-1 text-sm text-ink-2">
              {pct > 0 ? 'Improvement' : pct < 0 ? 'Worse than baseline' : 'No change'} · absolute change {fn !== null && bn !== null ? (fn - bn).toFixed(2).replace(/\.00$/, '') : ''}
            </p>
            <p className="mt-2 text-xs text-ink-3">
              25% target: {better === 'higher' ? '≥' : '≤'} {bn !== null ? +(bn * (better === 'higher' ? 1.25 : 0.75)).toFixed(2) : ''} · 15% target: {better === 'higher' ? '≥' : '≤'} {bn !== null ? +(bn * (better === 'higher' ? 1.15 : 0.85)).toFixed(2) : ''}
            </p>
          </>
        )}
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------- Arithmetic

function useSaveToChallenge(challenge: Challenge | null) {
  return useAction(async (metrics: Record<string, MetricValue>, attempt: { label: string; metrics: Record<string, number>; durationSec: number | null; note?: string }) => {
    if (!challenge) return;
    await setMetrics(challenge.id, metrics);
    await logAttempt({ challengeId: challenge.id, kind: 'test', label: attempt.label, metrics: attempt.metrics, durationSec: attempt.durationSec, note: attempt.note ?? '' });
  }, { success: challenge ? `Saved to Day ${challenge.day}.` : undefined });
}

function ArithmeticTest({ challenge }: { challenge: Challenge | null }) {
  const { data } = useApp();
  const [seed, setSeed] = useState(() => Date.now() % 1e9);
  const questions = useMemo(() => makeTest(seed, 30, 2), [seed]);
  const [answers, setAnswers] = useState<string[]>([]);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [result, setResult] = useState<{ score: number; seconds: number; wrong: { q: Question; a: string }[] } | null>(null);
  const [i, setI] = useState(0);
  const [cur, setCur] = useState('');
  const save = useSaveToChallenge(challenge);
  const inputRef = useRef<HTMLInputElement>(null);
  const prev = challenge ? data.progress.get(challenge.id)?.metrics : undefined;

  const submit = (all: string[]) => {
    const seconds = Math.round((Date.now() - (startedAt ?? Date.now())) / 1000);
    const wrong = questions.map((q, k) => ({ q, a: all[k] ?? '' })).filter(({ q, a }) => parseAnswer(a) !== q.answer);
    const score = 30 - wrong.length;
    setResult({ score, seconds, wrong });
    const accuracy = Math.round((score / 30) * 1000) / 10;
    const better = num(prev?.accuracy) === null || accuracy > (num(prev?.accuracy) ?? 0) || (accuracy === num(prev?.accuracy) && seconds < (num(prev?.seconds) ?? Infinity));
    void save.run(better ? { score, accuracy, seconds } : {}, { label: `30-question test: ${score}/30`, metrics: { accuracy, seconds }, durationSec: seconds });
  };

  if (result)
    return (
      <Card className="p-5 md:p-7">
        <p className="text-center text-sm font-medium text-ink-3">Result</p>
        <p className="tnum font-display mt-1 text-center text-5xl">{result.score}/30</p>
        <p className="tnum mt-1 text-center text-sm text-ink-2">
          {Math.round((result.score / 30) * 100)}% accuracy · {formatDuration(result.seconds * 1000)}
          {result.score / 30 >= 0.9 ? <Badge tone="success" className="ml-2">Target met</Badge> : <Badge tone="warn" className="ml-2">Below 90%</Badge>}
        </p>
        {result.wrong.length > 0 && (
          <div className="mt-5">
            <p className="mb-2 text-sm font-semibold">Review</p>
            <ul className="tnum grid gap-1 text-sm sm:grid-cols-2">
              {result.wrong.map(({ q, a }, k) => (
                <li key={k} className="flex justify-between rounded-lg bg-surface-2 px-3 py-1.5">
                  <span>{q.text} = {q.answer}</span>
                  <span className="text-danger">{a || '—'}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        <p className="mt-4 text-center text-xs text-ink-3">{challenge ? 'Every test is logged as an attempt; the best result is kept in the challenge measurements.' : ''}</p>
        <div className="mt-4 flex justify-center">
          <Button variant="primary" onClick={() => { setSeed(Date.now() % 1e9); setAnswers([]); setI(0); setCur(''); setResult(null); setStartedAt(null); }}>
            New test
          </Button>
        </div>
      </Card>
    );

  if (startedAt === null)
    return (
      <Card className="p-5 text-center md:p-7">
        <p className="text-sm leading-relaxed text-ink-2">30 mixed questions (+ − × ÷), whole-number answers. Timed from the first question. 90% (27/30) passes Day 10.</p>
        <Button className="mt-5" variant="primary" size="lg" icon={<Play className="size-4" />} onClick={() => { setStartedAt(Date.now()); setTimeout(() => inputRef.current?.focus(), 0); }}>
          Start test
        </Button>
      </Card>
    );

  const q = questions[i]!;
  const next = () => {
    const all = [...answers, cur];
    setAnswers(all);
    setCur('');
    if (i + 1 >= questions.length) submit(all);
    else setI(i + 1);
  };
  return (
    <Card className="p-5 md:p-7">
      <div className="flex justify-between text-xs text-ink-3">
        <span className="tnum">Question {i + 1} / 30</span>
        <ElapsedSince start={startedAt} />
      </div>
      <form className="mt-6 text-center" onSubmit={(e) => { e.preventDefault(); next(); }}>
        <p className="tnum font-display text-5xl" aria-live="polite">{q.text}</p>
        <Input ref={inputRef} autoFocus aria-label="Answer" inputMode="numeric" className="tnum mx-auto mt-6 h-14 max-w-[200px] text-center text-2xl" value={cur} onChange={(e) => setCur(e.target.value.replace(/[^0-9-]/g, ''))} />
        <div className="mt-4 flex justify-center gap-2">
          <Button type="submit" variant="primary">{i + 1 >= 30 ? 'Finish' : 'Next'}</Button>
        </div>
      </form>
    </Card>
  );
}

function ElapsedSince({ start }: { start: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);
  return <span className="tnum">{formatDuration(now - start)}</span>;
}

function Sprint({ challenge }: { challenge: Challenge | null }) {
  const { data } = useApp();
  const [phase, setPhase] = useState<'ready' | 'run' | 'done'>('ready');
  const [seed, setSeed] = useState(1);
  const questions = useMemo(() => makeTest(seed, 120, 1), [seed]);
  const [i, setI] = useState(0);
  const [cur, setCur] = useState('');
  const [correct, setCorrect] = useState(0);
  const [wrong, setWrong] = useState<{ q: Question; a: string }[]>([]);
  const [endAt, setEndAt] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const save = useSaveToChallenge(challenge);
  const metrics = challenge ? data.progress.get(challenge.id)?.metrics : undefined;
  const stateRef = useRef({ correct: 0, wrong: [] as { q: Question; a: string }[], answered: 0 });

  useEffect(() => {
    if (phase !== 'run') return;
    const id = setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (t >= endAt) {
        clearInterval(id);
        setPhase('done');
        const s = stateRef.current;
        const best = Math.max(num(metrics?.bestCorrect) ?? 0, s.correct);
        void save.run({ bestCorrect: best, rounds: (num(metrics?.rounds) ?? 0) + 1 }, { label: `60-second sprint: ${s.correct} correct`, metrics: { correct: s.correct }, durationSec: 60, note: `${s.answered} answered, ${s.wrong.length} wrong` });
      }
    }, 100);
    return () => clearInterval(id);
  }, [phase, endAt, metrics, save]);

  const start = () => {
    setSeed(Date.now() % 1e9);
    setI(0);
    setCur('');
    setCorrect(0);
    setWrong([]);
    stateRef.current = { correct: 0, wrong: [], answered: 0 };
    setEndAt(Date.now() + 60_000);
    setNow(Date.now());
    setPhase('run');
  };
  const q = questions[i]!;
  const answer = (value: string) => {
    if (phase !== 'run') return;
    const ok = parseAnswer(value) === q.answer;
    const s = stateRef.current;
    s.answered++;
    if (ok) s.correct++;
    else s.wrong = [...s.wrong, { q, a: value }];
    setCorrect(s.correct);
    setWrong(s.wrong);
    setCur('');
    setI((x) => x + 1);
  };

  if (phase === 'ready')
    return (
      <Card className="p-5 text-center md:p-7">
        <p className="text-sm leading-relaxed text-ink-2">Answer as many as you can in 60 seconds. Press Enter to submit each answer — the next question appears instantly. Target: 25 correct.</p>
        {metrics?.bestCorrect !== undefined && <p className="mt-2 text-sm text-ink-3">Best so far: {String(metrics.bestCorrect)}</p>}
        <Button className="mt-5" variant="primary" size="lg" icon={<Play className="size-4" />} onClick={start}>
          Start 60 seconds
        </Button>
      </Card>
    );
  const left = Math.max(0, endAt - now);
  if (phase === 'done')
    return (
      <Card className="p-5 md:p-7">
        <p className="tnum font-display text-center text-5xl">{correct}</p>
        <p className="text-center text-sm text-ink-2">
          correct in 60 s · {correct + wrong.length} answered · {wrong.length} wrong
          {correct >= 25 ? <Badge tone="success" className="ml-2">Target met</Badge> : <Badge tone="warn" className="ml-2">Below 25</Badge>}
        </p>
        {wrong.length > 0 && (
          <ul className="tnum mx-auto mt-4 grid max-w-md gap-1 text-sm sm:grid-cols-2">
            {wrong.slice(0, 12).map(({ q: w, a }, k) => (
              <li key={k} className="flex justify-between rounded-lg bg-surface-2 px-3 py-1.5">
                <span>{w.text} = {w.answer}</span>
                <span className="text-danger">{a || '—'}</span>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-5 flex justify-center">
          <Button variant="primary" onClick={start} icon={<RotateCcw className="size-4" />}>Another round</Button>
        </div>
      </Card>
    );
  return (
    <Card className="p-5 md:p-7">
      <div className="flex items-center justify-between text-sm">
        <span className="tnum font-semibold text-success">{correct} correct</span>
        <span className={clsx('tnum font-semibold', left < 10_000 ? 'text-danger' : 'text-ink')}>{(left / 1000).toFixed(1)} s</span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-3">
        <div className="h-full bg-slate" style={{ width: `${(left / 60_000) * 100}%` }} />
      </div>
      <form className="mt-8 text-center" onSubmit={(e) => { e.preventDefault(); answer(cur); }}>
        <p className="tnum font-display text-5xl">{q.text}</p>
        <Input autoFocus aria-label="Answer" inputMode="numeric" className="tnum mx-auto mt-6 h-14 max-w-[200px] text-center text-2xl" value={cur} onChange={(e) => setCur(e.target.value.replace(/[^0-9-]/g, ''))} />
        <Button type="submit" className="mt-4" variant="primary">Submit</Button>
      </form>
    </Card>
  );
}

// ---------------------------------------------------------------- Pi

function PiTest({ challenge }: { challenge: Challenge | null }) {
  const { data } = useApp();
  const [attempt, setAttempt] = useState('');
  const [result, setResult] = useState<ReturnType<typeof checkPi> | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const save = useSaveToChallenge(challenge);
  const best = num(challenge ? data.progress.get(challenge.id)?.metrics.digitsCorrect : null) ?? 0;
  const digits = attempt.replace(/[^0-9]/g, '');
  const submit = () => {
    const r = checkPi(attempt);
    setResult(r);
    const secs = startedAt ? Math.round((Date.now() - startedAt) / 1000) : null;
    void save.run(r.streak > best ? { digitsCorrect: r.streak } : {}, { label: `Pi recall: ${r.streak} digits`, metrics: { digitsCorrect: r.streak }, durationSec: secs });
  };
  return (
    <Card className="p-5 md:p-7">
      {!result ? (
        <>
          <p className="text-sm leading-relaxed text-ink-2">Type the digits after “3.” from memory. Nothing is checked or shown until you submit. Spaces are fine.</p>
          <Textarea
            aria-label="Digits of pi after the decimal point"
            className="tnum mt-4 min-h-[140px] font-mono text-lg tracking-widest"
            value={attempt}
            autoComplete="off"
            spellCheck={false}
            inputMode="numeric"
            onChange={(e) => {
              if (startedAt === null) setStartedAt(Date.now());
              setAttempt(e.target.value.replace(/[^0-9\s]/g, ''));
            }}
          />
          <div className="mt-3 flex items-center justify-between">
            <span className="tnum text-sm text-ink-3">{digits.length} / 100 digits entered</span>
            <Button variant="primary" disabled={!digits.length} onClick={submit}>
              Submit attempt
            </Button>
          </div>
        </>
      ) : (
        <>
          <p className="tnum font-display text-center text-5xl">{result.streak}</p>
          <p className="text-center text-sm text-ink-2">
            digits correct before the first error
            {result.streak >= 100 ? <Badge tone="success" className="ml-2">100 — target met</Badge> : null}
          </p>
          <p className="tnum mt-1 text-center text-xs text-ink-3">{result.positionsCorrect} of {result.entered} entered digits in the right position{result.firstErrorAt ? ` · first error at digit ${result.firstErrorAt}` : ''}</p>
          <div className="tnum mt-5 break-all rounded-xl bg-surface-2 p-4 font-mono text-sm leading-7 tracking-wider">
            <span className="text-ink-3">3.</span>
            {PI_100.split('').map((d, k) => {
              const typed = digits[k];
              return (
                <span key={k} className={clsx(typed === undefined ? 'text-ink-3' : typed === d ? 'text-success' : 'rounded bg-danger-soft text-danger', (k + 1) % 10 === 0 && 'mr-2')} title={typed !== undefined && typed !== d ? `You typed ${typed}` : undefined}>
                  {d}
                </span>
              );
            })}
          </div>
          <p className="mt-2 text-xs text-ink-3">Green: correct · red: wrong at that position · grey: not reached.</p>
          <div className="mt-4 flex justify-center">
            <Button variant="primary" onClick={() => { setAttempt(''); setResult(null); setStartedAt(null); }}>
              Try again
            </Button>
          </div>
        </>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------- Reading

function ReadingTimer({ challenge }: { challenge: Challenge | null }) {
  const [which, setWhich] = useState<'base' | 'final'>('base');
  const [words, setWords] = useState('');
  const [comp, setComp] = useState('');
  const [start, setStart] = useState<number | null>(null);
  const [secs, setSecs] = useState<number | null>(null);
  const save = useAction(async () => {
    if (!challenge || secs === null) return;
    const w = Number(words) || 0;
    const c = comp === '' ? null : Math.min(100, Math.max(0, Number(comp)));
    await setMetrics(challenge.id, which === 'base' ? { baseWords: w, baseSeconds: secs, baseComp: c } : { finalWords: w, finalSeconds: secs, finalComp: c });
    await logAttempt({ challengeId: challenge.id, kind: 'test', label: which === 'base' ? 'Baseline reading test' : 'Final reading test', metrics: { wpm: Math.round(w / (secs / 60)), ...(c !== null ? { comprehension: c } : {}) }, durationSec: secs, note: '' });
  }, { success: 'Saved to Day 2.' });
  const wpm = secs && Number(words) ? Math.round(Number(words) / (secs / 60)) : null;
  return (
    <Card className="p-5 md:p-7">
      <div className="flex justify-center">
        <Segmented label="Test" value={which} onChange={setWhich} options={[{ value: 'base', label: 'Baseline (passage A)' }, { value: 'final', label: 'Final (passage B)' }]} />
      </div>
      {start !== null && secs === null ? <BigTime ms={0} label="Reading… press Stop when you finish the last word" /> : <BigTime ms={(secs ?? 0) * 1000} label={secs ? 'Reading time' : 'Press Start as you begin reading'} />}
      {start !== null && secs === null && <ElapsedCenter start={start} />}
      <div className="flex justify-center gap-2">
        {start === null || secs !== null ? (
          <Button variant="primary" size="lg" icon={<Play className="size-4" />} onClick={() => { setStart(Date.now()); setSecs(null); }}>
            Start
          </Button>
        ) : (
          <Button size="lg" variant="success" icon={<Square className="size-4" />} onClick={() => setSecs(Math.round((Date.now() - start) / 1000))}>
            Stop
          </Button>
        )}
      </div>
      {secs !== null && (
        <div className="mx-auto mt-6 grid max-w-md gap-3 sm:grid-cols-2">
          <Field label="Passage word count" htmlFor="rt-w">
            <Input id="rt-w" type="number" min={1} value={words} onChange={(e) => setWords(e.target.value)} />
          </Field>
          <Field label="Comprehension (%)" htmlFor="rt-c" hint="Share of questions answered correctly">
            <Input id="rt-c" type="number" min={0} max={100} value={comp} onChange={(e) => setComp(e.target.value)} />
          </Field>
          <p className="tnum text-center text-lg font-semibold sm:col-span-2">{wpm ? `${wpm} words per minute` : 'Enter the word count'}</p>
          {challenge && (
            <Button variant="primary" className="sm:col-span-2" disabled={!Number(words)} busy={save.busy} onClick={() => void save.run()}>
              Save as {which === 'base' ? 'baseline' : 'final'}
            </Button>
          )}
        </div>
      )}
    </Card>
  );
}

function ElapsedCenter({ start }: { start: number }) {
  return (
    <p className="-mt-4 mb-4 text-center text-2xl font-semibold text-ink-2">
      <ElapsedSince start={start} />
    </p>
  );
}

// ---------------------------------------------------------------- Megaminx solve timer

function SolveTimer({ challenge }: { challenge: Challenge | null }) {
  const { data } = useApp();
  const timer = usePersistentTimer('solve', 'stopwatch');
  const [independent, setIndependent] = useState(false);
  const attempts = challenge ? data.attempts.filter((a) => a.challengeId === challenge.id && num(a.metrics.solveSeconds) !== null) : [];
  const metrics = challenge ? data.progress.get(challenge.id)?.metrics : undefined;
  const save = useAction(async (dnf: boolean) => {
    if (!challenge) return;
    const secs = Math.round(timer.elapsed / 1000);
    if (!dnf) {
      const best = num(metrics?.bestSeconds);
      const patch: Record<string, MetricValue> = {};
      if (best === null || secs < best) patch.bestSeconds = secs;
      if (independent) patch.independent = true;
      await setMetrics(challenge.id, patch);
    }
    await logAttempt({ challengeId: challenge.id, kind: 'attempt', label: dnf ? 'Solve attempt (DNF)' : `Solve${independent ? ' (no tutorial)' : ''}`, metrics: dnf ? {} : { solveSeconds: secs }, durationSec: secs, note: independent ? 'Independent solve — no tutorial' : 'With reference' });
    await timer.reset();
  }, { success: 'Solve logged.' });
  return (
    <Card className="p-5 md:p-7">
      <BigTime ms={timer.elapsed} label={timer.running ? 'Solving…' : timer.exists ? 'Stopped' : 'Scramble fully, then start'} />
      <div className="flex flex-wrap justify-center gap-2">
        {!timer.running ? (
          <Button variant="primary" size="lg" icon={<Play className="size-4" />} onClick={() => void timer.start()}>
            {timer.exists ? 'Resume' : 'Start solve'}
          </Button>
        ) : (
          <Button size="lg" variant="success" icon={<Square className="size-4" />} onClick={() => void timer.pause()}>
            Stop
          </Button>
        )}
        {timer.exists && !timer.running && (
          <Button size="lg" variant="ghost" icon={<RotateCcw className="size-4" />} onClick={() => void timer.reset()}>
            Discard
          </Button>
        )}
      </div>
      {challenge && timer.exists && !timer.running && (
        <div className="mx-auto mt-5 max-w-sm space-y-3 rounded-xl border border-line p-4">
          <label className="flex items-start gap-2.5 text-sm">
            <input type="checkbox" className="mt-0.5 size-4 accent-[var(--success)]" checked={independent} onChange={(e) => setIndependent(e.target.checked)} />
            I solved it completely without following a tutorial or notes.
          </label>
          <div className="flex gap-2">
            <Button variant="success" className="flex-1" busy={save.busy} onClick={() => void save.run(false)}>
              Solved
            </Button>
            <Button className="flex-1" busy={save.busy} icon={<X className="size-4" />} onClick={() => void save.run(true)}>
              Did not finish
            </Button>
          </div>
        </div>
      )}
      {attempts.length > 0 && (
        <ol className="tnum mx-auto mt-5 max-w-sm space-y-1 text-sm">
          {[...attempts].reverse().slice(0, 10).map((a) => (
            <li key={a.id} className="flex justify-between text-ink-2">
              <span>{a.label}</span>
              <span>{formatDuration((num(a.metrics.solveSeconds) ?? 0) * 1000)}</span>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------- Logic problems

function LogicTimer({ challenge }: { challenge: Challenge | null }) {
  const { data } = useApp();
  const metrics = challenge ? data.progress.get(challenge.id)?.metrics : undefined;
  const timer = usePersistentTimer('logic', 'stopwatch', 30 * 60_000);
  const solved = num(metrics?.solved) ?? 0;
  const total = num(metrics?.totalMinutes) ?? 0;
  const record = useAction(async (wasSolved: boolean) => {
    if (!challenge) return;
    const mins = Math.round(timer.elapsed / 60_000);
    await setMetrics(challenge.id, { solved: Math.min(6, solved + (wasSolved ? 1 : 0)), totalMinutes: total + mins });
    await logAttempt({ challengeId: challenge.id, kind: 'attempt', label: wasSolved ? `Problem solved (${solved + 1}/6)` : 'Problem parked', metrics: {}, durationSec: Math.round(timer.elapsed / 1000), note: '' });
    await timer.reset();
  }, { success: (_r) => 'Recorded.' });
  return (
    <Card className="p-5 md:p-7">
      <div className="flex justify-center gap-6 text-center">
        <div>
          <p className="tnum font-display text-3xl">{solved}/6</p>
          <p className="text-xs text-ink-3">solved</p>
        </div>
        <div>
          <p className="tnum font-display text-3xl">{total}</p>
          <p className="text-xs text-ink-3">minutes total</p>
        </div>
      </div>
      <BigTime ms={timer.elapsed} label={`Current problem · suggested time-box 30 min${timer.remaining === 0 ? ' — time to move on and come back' : ''}`} />
      <div className="flex flex-wrap justify-center gap-2">
        {!timer.running ? (
          <Button variant="primary" size="lg" icon={<Play className="size-4" />} onClick={() => void timer.start()}>
            {timer.exists ? 'Resume' : 'Start problem'}
          </Button>
        ) : (
          <Button size="lg" icon={<Pause className="size-4" />} onClick={() => void timer.pause()}>
            Pause
          </Button>
        )}
        {challenge && timer.exists && (
          <>
            <Button size="lg" variant="success" busy={record.busy} onClick={() => void record.run(true)}>
              Solved
            </Button>
            <Button size="lg" busy={record.busy} onClick={() => void record.run(false)}>
              Park it
            </Button>
          </>
        )}
      </div>
      <p className="mt-5 text-center text-xs text-ink-3">“Solved” means verified against the problem without consulting outside solutions.</p>
    </Card>
  );
}
