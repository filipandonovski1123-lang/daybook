import clsx from 'clsx';
import { ArrowLeft, Calculator, ChevronLeft, ChevronRight, Hourglass, Mountain, Pencil, ShieldAlert, Target, Timer, Wrench } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { Badge, Button, Card, Checkbox, Difficulty, Disclosure, RatingPicker, SectionTitle, Textarea } from '../../components/ui';
import { EQUIPMENT } from '../../data/challenges';
import { setNotes, setSelfAssessment, toggleCriterion, togglePrep } from '../../db/actions';
import { checkCompletion } from '../../domain/criteria';
import { formatDate, formatDuration, formatInstant } from '../../domain/dates';
import { scheduledDateFor } from '../../domain/schedule';
import type { Challenge, ToolId } from '../../domain/types';
import { useAction, useApp, useNow } from '../../lib/appData';
import { useStatusOf } from '../../lib/selectors';
import { AttemptLog } from './AttemptLog';
import { EditChallengeDialog } from './EditChallengeDialog';
import { EvidenceGallery } from './EvidenceGallery';
import { MetricsForm } from './MetricsForm';
import { ChallengeActions, EstTime, StatusBadge } from './shared';

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

export function ChallengeDetailPage() {
  const { id } = useParams();
  const { data } = useApp();
  const navigate = useNavigate();
  const challenge = data.challenges.find((c) => c.id === id);
  if (!challenge)
    return (
      <div className="py-20 text-center">
        <p className="font-semibold">Challenge not found</p>
        <Button className="mt-4" onClick={() => navigate('/challenges')}>
          Back to challenges
        </Button>
      </div>
    );
  return <Detail key={challenge.id} challenge={challenge} />;
}

function Detail({ challenge }: { challenge: Challenge }) {
  const { data } = useApp();
  const status = useStatusOf(challenge);
  const progress = data.progress.get(challenge.id);
  const evidence = data.evidence.filter((e) => e.challengeId === challenge.id);
  const check = checkCompletion(challenge, progress ?? { metrics: {}, checked: [] }, evidence);
  const [editOpen, setEditOpen] = useState(false);
  const prep = useAction((i: number, on: boolean) => togglePrep(challenge.id, i, on));
  const crit = useAction((cid: string, on: boolean) => toggleCriterion(challenge.id, cid, on));
  const rate = useAction((v: number | null) => setSelfAssessment(challenge.id, v));
  const original = data.program ? scheduledDateFor(data.program.startDate, challenge.day) : null;
  const prev = data.challenges.find((c) => c.day === challenge.day - 1);
  const next = data.challenges.find((c) => c.day === challenge.day + 1);
  const missing = challenge.equipment.filter((e) => !data.settings.equipment.includes(e));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link to="/challenges" className="inline-flex items-center gap-1 text-sm font-medium text-ink-2 hover:text-ink">
          <ArrowLeft className="size-4" /> All challenges
        </Link>
        <div className="flex items-center gap-1">
          {prev && (
            <Link to={`/challenges/${prev.id}`} className="rounded-lg p-2 text-ink-3 hover:bg-surface-2 hover:text-ink" aria-label={`Previous: Day ${prev.day}`}>
              <ChevronLeft className="size-4" />
            </Link>
          )}
          {next && (
            <Link to={`/challenges/${next.id}`} className="rounded-lg p-2 text-ink-3 hover:bg-surface-2 hover:text-ink" aria-label={`Next: Day ${next.day}`}>
              <ChevronRight className="size-4" />
            </Link>
          )}
          <Button size="sm" variant="ghost" icon={<Pencil className="size-3.5" />} onClick={() => setEditOpen(true)}>
            Edit
          </Button>
        </div>
      </div>

      <Card className="hero-glow p-5 md:p-7">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Badge tone="accent">Day {challenge.day}</Badge>
          <Badge>{challenge.category}</Badge>
          <StatusBadge status={status} />
          {progress?.completedEarly && <Badge tone="warn">Completed early</Badge>}
        </div>
        <h1 className="text-[26px] font-bold leading-tight tracking-tight md:text-[32px]">{challenge.title}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-ink-3">
          <span className="flex items-center gap-1.5">
            Difficulty <Difficulty value={challenge.difficulty} />
          </span>
          <EstTime minutes={challenge.estimatedMinutes} />
          {original && <span>Scheduled {formatDate(original, 'short')}</span>}
          {progress?.rescheduledTo && <span className="text-warn">Rescheduled to {formatDate(progress.rescheduledTo, 'short')}</span>}
          {progress?.completedOn && <span className="text-success">{progress.status === 'attempted' ? 'Attempted' : 'Completed'} {formatDate(progress.completedOn, 'short')}</span>}
        </div>
        <p className="mt-4 text-[15px] leading-relaxed text-ink-2">{challenge.description}</p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <Goal icon={<Target className="size-4 text-accent" />} label="Main goal" text={challenge.objective} met={check.mainMet} />
          {challenge.bonus && <Goal icon={<Target className="size-4 text-violet" />} label="Bonus" text={challenge.bonus} met={check.bonusMet} />}
        </div>
        {challenge.stretchGoal && (
          <div className="mt-3 flex gap-2.5 rounded-xl border border-violet/30 bg-violet-soft p-3 text-sm">
            <Mountain className="mt-0.5 size-4 shrink-0 text-violet" aria-hidden />
            <p>
              <span className="font-semibold text-violet">Long-term stretch goal, separate from today’s task.</span> <span className="text-ink-2">{challenge.stretchGoal}</span>
            </p>
          </div>
        )}
        <ActiveTimer challenge={challenge} />
        <div className="mt-5">
          <ChallengeActions challenge={challenge} />
        </div>
      </Card>

      {challenge.safety.length > 0 && (
        <Card className="border-warn/40 p-5">
          <SectionTitle>
            <span className="flex items-center gap-1.5 text-warn">
              <ShieldAlert className="size-4" /> Safety
            </span>
          </SectionTitle>
          <ul className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-ink-2">
            {challenge.safety.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </Card>
      )}

      <Card className="p-5">
        <SectionTitle>Success criteria</SectionTitle>
        <ul className="space-y-2.5">
          {check.results.map(({ criterion, result }) =>
            result.auto ? (
              <li key={criterion.id} className="flex items-start gap-3 text-sm">
                <span className={clsx('mt-px flex size-5 shrink-0 items-center justify-center rounded-full border border-dashed text-[11px] font-bold', result.met ? 'border-success bg-success text-[#04150d]' : 'border-line-strong bg-surface-2 text-ink-3')} aria-hidden>
                  {result.met ? '✓' : ''}
                </span>
                <span>
                  {criterion.label} {criterion.bonus && <Badge tone="accent">Bonus</Badge>}
                  <span className="block text-xs text-ink-3">
                    Auto · checked from your measurements{result.detail ? ` · ${result.detail}` : ''}
                  </span>
                </span>
              </li>
            ) : (
              <li key={criterion.id}>
                <Checkbox
                  checked={result.met}
                  onChange={(on) => void crit.run(criterion.id, on)}
                  label={
                    <span>
                      {criterion.label} {criterion.bonus && <Badge tone="accent">Bonus</Badge>}
                      <span className="block text-xs text-ink-3">Self-certified</span>
                    </span>
                  }
                />
              </li>
            ),
          )}
        </ul>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="p-5">
          <SectionTitle>Preparation</SectionTitle>
          <ul className="space-y-2.5">
            {challenge.preparation.map((p, i) => (
              <li key={i}>
                <Checkbox checked={progress?.prepDone.includes(i) ?? false} onChange={(on) => void prep.run(i, on)} label={p} />
              </li>
            ))}
          </ul>
          {challenge.equipment.length > 0 && (
            <div className="mt-4 border-t border-line pt-3">
              <p className="mb-1.5 text-xs font-semibold text-ink-3">Equipment</p>
              <ul className="flex flex-wrap gap-1.5">
                {challenge.equipment.map((e) => (
                  <li key={e}>
                    <Badge tone={missing.includes(e) ? 'warn' : 'success'} icon={missing.includes(e) ? <Wrench className="size-3" /> : undefined}>
                      {EQUIPMENT[e] ?? e}
                      {missing.includes(e) ? ' · needed' : ''}
                    </Badge>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>
        <Card className="p-5">
          <SectionTitle>Learning plan</SectionTitle>
          <ol className="space-y-2.5">
            {challenge.learningPlan.map((s, i) => (
              <li key={i} className="flex gap-3 text-sm leading-snug">
                <span className="tnum flex size-5 shrink-0 items-center justify-center rounded-full bg-surface-3 text-[11px] font-bold text-ink-2">{i + 1}</span>
                <span>{s}</span>
              </li>
            ))}
          </ol>
          {challenge.tools.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-4">
              {challenge.tools.map((t) => {
                const M = TOOL_META[t];
                return (
                  <Link key={t} to={`/tools/${t}?challenge=${challenge.id}`}>
                    <Button size="sm" icon={<M.icon className="size-3.5" />}>
                      {M.label}
                    </Button>
                  </Link>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      <Card className="p-5">
        <SectionTitle>Measurements</SectionTitle>
        <MetricsForm challenge={challenge} />
      </Card>

      <Card className="p-5">
        <SectionTitle>{challenge.pbKeys.length ? 'Attempts & personal bests' : 'Practice log'}</SectionTitle>
        <AttemptLog challenge={challenge} />
      </Card>

      {challenge.evidence.enabled && (
        <Card className="p-5">
          <SectionTitle>{challenge.evidence.label}</SectionTitle>
          <EvidenceGallery challenge={challenge} />
        </Card>
      )}

      <Card className="p-5">
        <SectionTitle>Notes</SectionTitle>
        <NotesField challengeId={challenge.id} value={progress?.notes ?? ''} />
        <div className="mt-4">
          <p className="mb-2 text-[13px] font-medium text-ink-2">Self-assessment (optional)</p>
          <RatingPicker label="Self-assessment" value={progress?.selfAssessment ?? null} onChange={(v) => void rate.run(v)} low="Rough" high="Nailed it" />
        </div>
      </Card>

      {progress && progress.history.length > 0 && (
        <Card className="px-5 py-2">
          <Disclosure summary="History">
            <ol className="space-y-1.5 pb-3 text-xs text-ink-2">
              {progress.history.map((h, i) => (
                <li key={i} className="tnum flex gap-3">
                  <span className="w-36 shrink-0 text-ink-3">{formatInstant(h.at, data.settings.timezone)}</span>
                  <span>
                    <span className="font-medium capitalize text-ink">{h.action}</span>
                    {h.detail ? ` · ${h.detail}` : ''}
                  </span>
                </li>
              ))}
              {progress.missedAck && (
                <li className="text-ink-3">
                  Missed acknowledged: {progress.missedAck.reason} → {progress.missedAck.adjustment}
                  {progress.missedAck.note ? ` (“${progress.missedAck.note}”)` : ''}
                </li>
              )}
            </ol>
          </Disclosure>
        </Card>
      )}

      <EditChallengeDialog challenge={challenge} open={editOpen} onClose={() => setEditOpen(false)} />
    </div>
  );
}

function Goal({ icon, label, text, met }: { icon: React.ReactNode; label: string; text: string; met: boolean }) {
  return (
    <div className={clsx('rounded-xl border p-3.5', met ? 'border-success/40 bg-success-soft' : 'border-line bg-surface-2/70')}>
      <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-ink-3">
        {icon}
        {label}
        {met && <Badge tone="success">Met</Badge>}
      </p>
      <p className="text-sm leading-snug">{text}</p>
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
    <p className="mt-4 flex items-center gap-2 text-sm">
      <Timer className={clsx('size-4', p.activeSince ? 'text-info' : 'text-ink-3')} aria-hidden />
      <span className="tnum font-semibold">{formatDuration(total)}</span>
      <span className="text-ink-3">{p.activeSince ? 'active time · running' : 'active time · paused'}</span>
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
      <Textarea aria-label="Notes" value={local} onChange={(e) => setLocal(e.target.value)} onBlur={() => local !== value && void save.run(local)} maxLength={20000} className="min-h-[120px]" placeholder="What worked, what didn’t, what to try next…" />
      <p className="mt-1 text-right text-[11px] text-ink-3">{local === value ? 'Saved' : 'Saving…'}</p>
    </div>
  );
}
