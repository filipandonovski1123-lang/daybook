import clsx from 'clsx';
import { ArrowLeft, Calculator, Check, ChevronLeft, ChevronRight, ClipboardList, Hourglass, Mountain, Pencil, ShieldAlert, Shuffle, Medal, Target, Timer, Wrench } from 'lucide-react';
import { lazy, Suspense, useEffect, useState, type ReactNode } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router';
import { QuoteCard, quoteFor } from '../../components/Scene';
import { Badge, Button, Difficulty, ProgressRing, RatingPicker, Textarea } from '../../components/ui';
import { EQUIPMENT } from '../../data/challenges';
import { challengeKey } from '../../data/library';
import { setNotes, setSelfAssessment, swapDay, toggleCriterion, togglePrep } from '../../db/actions';
import { LibraryPicker } from '../plan/PlanBuilder';
import { useDayLocked } from '../plan/PlanPage';
import { RestDayPanel } from '../today/RestDay';
import { checkCompletion, num, personalBests } from '../../domain/criteria';
import { formatDate, formatDuration, formatInstant } from '../../domain/dates';
import { scheduledDateFor } from '../../domain/schedule';
import type { Challenge, ToolId } from '../../domain/types';
import { useAction, useApp, useNow } from '../../lib/appData';
import { AnimatedNumber } from '../../lib/motion';
import { useProgramView, useStatusOf } from '../../lib/selectors';
import { Fact } from '../today/TodayPage';
import { AttemptLog } from './AttemptLog';
import { EditChallengeDialog } from './EditChallengeDialog';
import { EvidenceGallery } from './EvidenceGallery';
import { MetricsForm } from './MetricsForm';
import { ChallengeActions, StatusBadge } from './shared';
import { challengeLabel } from '../../data/tracks';

const ProgressLine = lazy(() => import('../progress/Charts').then((m) => ({ default: m.ProgressLine })));

export const TOOL_META: Record<ToolId, { label: string; icon: typeof Timer }> = {
  stopwatch: { label: 'Stopwatch', icon: Timer },
  countdown: { label: 'Countdown timer', icon: Hourglass },
  focus: { label: 'Focus timer', icon: Timer },
  arithmetic30: { label: '30-question arithmetic test', icon: Calculator },
  arithmetic60: { label: '60-second sprint', icon: Calculator },
  pi: { label: 'Pi verification test', icon: Calculator },
  solveTimer: { label: 'Solve timer', icon: Timer },
  logicTimer: { label: 'Problem timer & score', icon: Timer },
  pbCalc: { label: 'Before/after calculator', icon: Calculator },
  readingTest: { label: 'Reading speed timer', icon: Timer },
};

/** /challenge → the challenge for today (or Day 1 before the start, Day 30 after). */
export function CurrentChallengeRedirect() {
  const view = useProgramView();
  const { data } = useApp();
  const target = view?.todayChallenge ?? (view?.phase === 'after' ? data.challenges.at(-1) : data.challenges[0]);
  return <Navigate to={target ? `/challenges/${target.id}` : '/calendar'} replace />;
}

export function ChallengeDetailPage() {
  const { id } = useParams();
  const { data } = useApp();
  const navigate = useNavigate();
  const challenge = data.challenges.find((c) => c.id === id);
  if (!challenge)
    return (
      <div className="py-20 text-center">
        <p className="font-display text-xl">Challenge not found</p>
        <Button className="mt-4" onClick={() => navigate('/calendar')}>
          Back to calendar
        </Button>
      </div>
    );
  return <Detail key={challenge.id} challenge={challenge} />;
}

type Tab = 'plan' | 'log' | 'notes';

function Detail({ challenge }: { challenge: Challenge }) {
  const { data } = useApp();
  const navigate = useNavigate();
  const status = useStatusOf(challenge);
  const progress = data.progress.get(challenge.id);
  const evidence = data.evidence.filter((e) => e.challengeId === challenge.id);
  const check = checkCompletion(challenge, progress ?? { metrics: {}, checked: [] }, evidence);
  const [editOpen, setEditOpen] = useState(false);
  const [swapOpen, setSwapOpen] = useState(false);
  const dayLocked = useDayLocked();
  const swap = useAction((id: string) => swapDay(challenge.day, id), { success: `Day ${challenge.day} swapped.` });
  const [tab, setTab] = useState<Tab>('plan');
  const original = data.program ? scheduledDateFor(data.program.startDate, challenge.day) : null;
  const prev = data.challenges.find((c) => c.day === challenge.day - 1);
  const next = data.challenges.find((c) => c.day === challenge.day + 1);
  const view = useProgramView();

  const main = check.results.filter((r) => !r.criterion.bonus);
  const metMain = main.filter((r) => r.result.met).length;
  const pct = main.length ? Math.round((metMain / main.length) * 100) : 0;
  const prepDone = progress?.prepDone.length ?? 0;
  const sessions = data.attempts.filter((a) => a.challengeId === challenge.id).length;
  const length = view?.length ?? data.challenges.length;
  const overall = Math.round(((view?.counts.completed ?? 0) / (length || 1)) * 100);

  return (
    <div>
      {/* Top bar: back · Day N of 30 · prev/next */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-center">
        <button type="button" onClick={() => navigate(-1)} aria-label="Back" className="justify-self-start rounded p-1.5 text-ink-2 hover:text-ink">
          <ArrowLeft className="size-5" strokeWidth={1.6} />
        </button>
        <div className="text-center">
          <p className="font-display text-[28px] leading-none">Day {challenge.day}</p>
          <p className="mt-1 text-[11px] text-ink-3">of {length}</p>
        </div>
        <div className="flex items-center justify-self-end">
          {prev ? (
            <Link to={`/challenges/${prev.id}`} className="rounded p-1.5 text-ink-2 hover:text-ink" aria-label={`Previous: Day ${prev.day}`}>
              <ChevronLeft className="size-[18px]" strokeWidth={1.6} />
            </Link>
          ) : (
            <span className="p-1.5 opacity-30" aria-hidden>
              <ChevronLeft className="size-[18px]" strokeWidth={1.6} />
            </span>
          )}
          {next ? (
            <Link to={`/challenges/${next.id}`} className="rounded p-1.5 text-ink-2 hover:text-ink" aria-label={`Next: Day ${next.day}`}>
              <ChevronRight className="size-[18px]" strokeWidth={1.6} />
            </Link>
          ) : (
            <span className="p-1.5 opacity-30" aria-hidden>
              <ChevronRight className="size-[18px]" strokeWidth={1.6} />
            </span>
          )}
        </div>
      </div>

      <header className="mt-8">
        <div className="flex items-center justify-between gap-3">
          <p className="eyebrow">{challengeLabel(challenge)}</p>
          <span className="flex items-center gap-4">
            {!dayLocked(challenge.id) && (
              <button type="button" onClick={() => setSwapOpen(true)} className="inline-flex items-center gap-1.5 text-[12.5px] text-ink-3 hover:text-ink">
                <Shuffle className="size-3.5" strokeWidth={1.6} /> Swap
              </button>
            )}
            <button type="button" onClick={() => setEditOpen(true)} className="inline-flex items-center gap-1.5 text-[12.5px] text-ink-3 hover:text-ink">
              <Pencil className="size-3.5" strokeWidth={1.6} /> Edit
            </button>
          </span>
        </div>
        <h1 className="font-display mt-2 text-[32px] leading-[1.1] md:text-[40px]">{challenge.title}</h1>
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-[12.5px] text-ink-3">
          <StatusBadge status={status} />
          <span className="flex items-center gap-1.5">
            Difficulty <Difficulty value={challenge.difficulty} />
          </span>
          <span>~{Math.round(challenge.estimatedMinutes / 15) / 4} h</span>
          {original && <span>Scheduled {formatDate(original, 'short')}</span>}
          {progress?.rescheduledTo && <span className="text-warn">Moved to {formatDate(progress.rescheduledTo, 'short')}</span>}
          {progress?.completedOn && (
            <span className="text-slate">
              {progress.status === 'attempted' ? 'Attempted' : 'Completed'} {formatDate(progress.completedOn, 'short')}
              {progress.completedEarly ? ' (early)' : ''}
            </span>
          )}
        </div>
        <p className="mt-4 max-w-2xl text-[14.5px] leading-relaxed text-ink-2">{challenge.description}</p>
        <ActiveTimer challenge={challenge} />
        <div className="mt-5">
          <ChallengeActions challenge={challenge} />
        </div>
      </header>

      {challenge.kind === 'rest' ? (
        <RestDayPanel />
      ) : (
      <>
      {/* Today's progress */}
      <section className="mt-10" aria-labelledby="tp-title">
        <h2 id="tp-title" className="font-display text-[20px]">
          Challenge Progress
        </h2>
        <div className="mt-4 flex items-center gap-6">
          <ProgressRing value={pct / 100} size={104} stroke={7} label={`${pct}% of main criteria met`}>
            <span className="font-display tnum text-[26px]">
              <AnimatedNumber value={pct} from={0} />%
            </span>
          </ProgressRing>
          <dl className="space-y-2.5">
            <Fact value={`${metMain} / ${main.length}`} label="criteria met" />
            <Fact value={`${prepDone} / ${challenge.preparation.length}`} label="preparation done" />
            <Fact value={String(sessions)} label={sessions === 1 ? 'entry logged' : 'entries logged'} />
            <Fact value={`${overall}%`} label="overall progress" />
          </dl>
        </div>
      </section>

      {/* Tabs */}
      <div role="tablist" aria-label="Challenge sections" className="mt-10 flex gap-6 border-b border-line">
        {(
          [
            ['plan', 'Plan'],
            ['log', 'Log & results'],
            ['notes', 'Notes'],
          ] as const
        ).map(([k, label]) => (
          <button key={k} role="tab" type="button" aria-selected={tab === k} aria-controls={`panel-${k}`} id={`tab-${k}`} onClick={() => setTab(k)} className={clsx('-mb-px border-b-2 pb-2.5 text-[13.5px] transition-colors', tab === k ? 'border-ink text-ink' : 'border-transparent text-ink-3 hover:text-ink')}>
            {label}
          </button>
        ))}
      </div>

      <div key={tab} role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="animate-fade-up pt-6">
        {tab === 'plan' && <PlanTab challenge={challenge} check={check} />}
        {tab === 'log' && <LogTab challenge={challenge} />}
        {tab === 'notes' && <NotesTab challenge={challenge} />}
      </div>

      </>
      )}

      <QuoteCard quote={quoteFor(challenge.day + 1)} scene="peaks" layout="overlay" className="mt-12 h-[150px]" />
      <EditChallengeDialog challenge={challenge} open={editOpen} onClose={() => setEditOpen(false)} />
      <LibraryPicker
        open={swapOpen}
        title={`Swap Day ${challenge.day}`}
        current={challengeKey(challenge)}
        exclude={data.challenges.filter((c) => c.id !== challenge.id).map((c) => challengeKey(c))}
        equipment={data.settings.equipment}
        onClose={() => setSwapOpen(false)}
        onPick={(id) => {
          setSwapOpen(false);
          if (id !== challengeKey(challenge)) void swap.run(id);
        }}
      />
    </div>
  );
}

function Block({ title, children, aside }: { title: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="mb-9">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h3 className="font-display text-[19px]">{title}</h3>
        {aside}
      </div>
      {children}
    </section>
  );
}

function IconSquare({ children }: { children: ReactNode }) {
  return <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-surface-2 text-ink-2 [&>svg]:size-4">{children}</span>;
}

function CheckCircle({ on, auto, onToggle, label }: { on: boolean; auto?: boolean; onToggle?: () => void; label: string }) {
  const cls = clsx('flex size-[22px] shrink-0 items-center justify-center rounded-full border-[1.5px]', on ? 'border-slate bg-slate text-white dark:text-[#14181c]' : auto ? 'border-dashed border-line-strong' : 'border-line-strong hover:border-slate');
  if (!onToggle)
    return (
      <span className={cls} role="img" aria-label={`${label}: ${on ? 'met' : 'not met'} (automatic)`}>
        {on && <Check className="size-3" strokeWidth={3} />}
      </span>
    );
  return (
    <button type="button" role="checkbox" aria-checked={on} aria-label={label} onClick={onToggle} className={clsx(cls, 'relative before:absolute before:-inset-2.5 before:content-[""]')}>
      {on && <Check className="size-3" strokeWidth={3} />}
    </button>
  );
}

function PlanTab({ challenge, check }: { challenge: Challenge; check: ReturnType<typeof checkCompletion> }) {
  const { data } = useApp();
  const progress = data.progress.get(challenge.id);
  const prep = useAction((i: number, on: boolean) => togglePrep(challenge.id, i, on));
  const crit = useAction((cid: string, on: boolean) => toggleCriterion(challenge.id, cid, on));
  const missing = challenge.equipment.filter((e) => !data.settings.equipment.includes(e));
  return (
    <div>
      <Block title="Goals">
        <div className="divide-y divide-line rounded-xl border border-line bg-surface">
          <GoalRow icon={<Target />} label="Main goal" text={challenge.objective} met={check.mainMet} />
          {challenge.bonus && <GoalRow icon={<Medal />} label="Bonus" text={challenge.bonus} met={check.bonusMet} />}
          {challenge.stretchGoal && <GoalRow icon={<Mountain />} label="Long-term stretch goal — separate from today’s task" text={challenge.stretchGoal} met={false} hideState />}
        </div>
      </Block>

      {challenge.safety.length > 0 && (
        <Block title="Safety">
          <div className="rounded-xl border border-warn/30 bg-warn-soft/50 p-4">
            <ul className="space-y-1.5 text-[13.5px] leading-relaxed text-ink-2">
              {challenge.safety.map((s) => (
                <li key={s} className="flex gap-2.5">
                  <ShieldAlert className="mt-0.5 size-4 shrink-0 text-warn" strokeWidth={1.7} aria-hidden />
                  {s}
                </li>
              ))}
            </ul>
          </div>
        </Block>
      )}

      <Block title="Success Criteria" aside={<span className="tnum text-[12.5px] text-ink-3">{check.results.filter((r) => r.result.met).length} / {check.results.length}</span>}>
        <ul className="divide-y divide-line border-y border-line">
          {check.results.map(({ criterion, result }) => (
            <li key={criterion.id} className="flex items-center gap-3 py-3">
              <IconSquare>{criterion.bonus ? <Medal /> : <Target />}</IconSquare>
              <span className="min-w-0 flex-1">
                <span className="block text-[14px]">{criterion.label}</span>
                <span className="block text-[12px] text-ink-3">
                  {criterion.bonus ? 'Bonus · ' : ''}
                  {result.auto ? `Automatic${result.detail ? ` · ${result.detail}` : ''}` : 'Self-certified — tick only if true'}
                </span>
              </span>
              <CheckCircle on={result.met} auto={result.auto} label={criterion.label} onToggle={result.auto ? undefined : () => void crit.run(criterion.id, !result.met)} />
            </li>
          ))}
        </ul>
      </Block>

      <Block title="Preparation" aside={<span className="tnum text-[12.5px] text-ink-3">{progress?.prepDone.length ?? 0} / {challenge.preparation.length}</span>}>
        <ul className="divide-y divide-line border-y border-line">
          {challenge.preparation.map((p, i) => {
            const on = progress?.prepDone.includes(i) ?? false;
            return (
              <li key={i} className="flex items-center gap-3 py-3">
                <IconSquare>
                  <ClipboardList />
                </IconSquare>
                <span className={clsx('min-w-0 flex-1 text-[14px]', on && 'text-ink-2')}>{p}</span>
                <CheckCircle on={on} label={p} onToggle={() => void prep.run(i, !on)} />
              </li>
            );
          })}
        </ul>
        {challenge.equipment.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {challenge.equipment.map((e) => (
              <Badge key={e} tone={missing.includes(e) ? 'warn' : 'neutral'} icon={missing.includes(e) ? <Wrench className="size-3" /> : undefined}>
                {EQUIPMENT[e] ?? e}
                {missing.includes(e) ? ' · needed' : ''}
              </Badge>
            ))}
          </div>
        )}
      </Block>

      <Block title="Learning Plan">
        <ol className="space-y-3">
          {challenge.learningPlan.map((s, i) => (
            <li key={i} className="flex gap-4 text-[14px] leading-snug">
              <span className="font-display tnum w-5 shrink-0 text-[17px] leading-none text-ink-3">{i + 1}</span>
              <span>{s}</span>
            </li>
          ))}
        </ol>
        {challenge.tools.length > 0 && (
          <div className="mt-5 flex flex-wrap gap-2">
            {challenge.tools.map((t) => {
              const M = TOOL_META[t];
              return (
                <Link key={t} to={`/tools/${t}?challenge=${challenge.id}`}>
                  <Button size="sm" icon={<M.icon className="size-3.5" strokeWidth={1.7} />}>
                    {M.label}
                  </Button>
                </Link>
              );
            })}
          </div>
        )}
      </Block>
    </div>
  );
}

function GoalRow({ icon, label, text, met, hideState }: { icon: ReactNode; label: string; text: string; met: boolean; hideState?: boolean }) {
  return (
    <div className="flex items-start gap-3 p-4">
      <IconSquare>{icon}</IconSquare>
      <div className="min-w-0 flex-1">
        <p className="text-[11.5px] text-ink-3">{label}</p>
        <p className="mt-0.5 text-[14px] leading-snug">{text}</p>
      </div>
      {!hideState && <CheckCircle on={met} auto label={label} />}
    </div>
  );
}

function LogTab({ challenge }: { challenge: Challenge }) {
  const { data } = useApp();
  const attempts = data.attempts.filter((a) => a.challengeId === challenge.id);
  const key = challenge.pbKeys.find((k) => !k.baselineKey);
  const series = key
    ? attempts
        .map((a) => num(a.metrics[key.key]))
        .map((v, i) => (v === null ? null : { label: `#${i + 1}`, value: v }))
        .filter((x): x is { label: string; value: number } => x !== null)
    : [];
  const pbCount = personalBests(challenge, data.progress.get(challenge.id) ?? null, attempts).events.length;
  return (
    <div>
      <Block title="Measurements">
        <MetricsForm challenge={challenge} />
      </Block>
      {key && series.length >= 2 && (
        <Block title="Progress Over Time" aside={<span className="text-[12.5px] text-ink-3">{pbCount} personal best{pbCount === 1 ? '' : 's'}</span>}>
          <Suspense fallback={<div className="h-[170px]" />}>
            <ProgressLine data={series} unit={key.unit} label={key.label} />
          </Suspense>
        </Block>
      )}
      <Block title={challenge.pbKeys.length ? 'Attempts & Personal Bests' : 'Practice Log'}>
        <AttemptLog challenge={challenge} />
      </Block>
      {challenge.evidence.enabled && (
        <Block title={challenge.evidence.label}>
          <EvidenceGallery challenge={challenge} />
        </Block>
      )}
    </div>
  );
}

function NotesTab({ challenge }: { challenge: Challenge }) {
  const { data } = useApp();
  const progress = data.progress.get(challenge.id);
  const rate = useAction((v: number | null) => setSelfAssessment(challenge.id, v));
  return (
    <div>
      <Block title="Notes">
        <NotesField challengeId={challenge.id} value={progress?.notes ?? ''} />
      </Block>
      <Block title="Self-assessment">
        <RatingPicker label="Self-assessment" value={progress?.selfAssessment ?? null} onChange={(v) => void rate.run(v)} low="Rough" high="Nailed it" />
      </Block>
      {progress && progress.history.length > 0 && (
        <Block title="History">
          <ol className="divide-y divide-line border-y border-line text-[13px]">
            {progress.history.map((h, i) => (
              <li key={i} className="tnum flex gap-4 py-2.5">
                <span className="w-40 shrink-0 text-ink-3">{formatInstant(h.at, data.settings.timezone)}</span>
                <span>
                  <span className="capitalize">{h.action}</span>
                  {h.detail ? <span className="text-ink-2"> · {h.detail}</span> : null}
                </span>
              </li>
            ))}
            {progress.missedAck && (
              <li className="py-2.5 text-ink-2">
                Missed acknowledged: {progress.missedAck.reason} → {progress.missedAck.adjustment}
                {progress.missedAck.note ? ` (“${progress.missedAck.note}”)` : ''}
              </li>
            )}
          </ol>
        </Block>
      )}
    </div>
  );
}

/** Live session time while a challenge is in progress (persisted, survives refresh). */
function ActiveTimer({ challenge }: { challenge: Challenge }) {
  const { data } = useApp();
  const p = data.progress.get(challenge.id);
  const now = useNow(1000);
  if (!p || (!p.activeMs && !p.activeSince)) return null;
  const total = p.activeMs + (p.activeSince ? now - p.activeSince : 0);
  const capped = challenge.day === 29 && total > 8 * 3_600_000;
  return (
    <p className="mt-4 flex flex-wrap items-center gap-2 text-[13.5px]">
      <Timer className={clsx('size-4', p.activeSince ? 'text-slate' : 'text-ink-3')} strokeWidth={1.7} aria-hidden />
      <span className="font-display tnum text-[17px]">{formatDuration(total)}</span>
      <span className="text-ink-3">{p.activeSince ? 'active · running' : 'active · paused'}</span>
      {challenge.day === 29 && <span className={clsx('text-xs', capped ? 'text-danger' : 'text-ink-3')}>{capped ? 'Over the 8-hour window' : `${formatDuration(Math.max(0, 8 * 3_600_000 - total))} of 8 h left`}</span>}
    </p>
  );
}

function NotesField({ challengeId, value }: { challengeId: string; value: string }) {
  const [local, setLocal] = useState(value);
  const save = useAction((v: string) => setNotes(challengeId, v));
  const [synced, setSynced] = useState(value);
  if (synced !== value) {
    setSynced(value);
    setLocal(value);
  }
  // Debounced autosave so typing never loses text, plus save on blur.
  useEffect(() => {
    if (local === value) return;
    const t = window.setTimeout(() => void save.run(local), 800);
    return () => window.clearTimeout(t);
  }, [local, value, save]);
  return (
    <div>
      <Textarea
        aria-label="Notes"
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        onBlur={() => local !== value && void save.run(local)}
        maxLength={20000}
        className="min-h-[160px]"
        placeholder="What worked, what didn’t, what to try next…"
      />
      <p className="mt-1.5 text-right text-[11px] text-ink-3">{local === value ? 'Saved' : 'Saving…'}</p>
    </div>
  );
}
