import clsx from 'clsx';
import { CalendarClock, Check, CircleCheck, CircleDashed, CircleDot, CircleX, Clock, Flag, Pause, Play, RotateCcw, TriangleAlert, Undo2 } from 'lucide-react';
import { useState } from 'react';
import { Badge, Button, Checkbox, ConfirmDialog, Dialog, Field, Input, Textarea, type Tone } from '../../components/ui';
import { completeChallenge, pauseChallenge, rescheduleChallenge, startChallenge, toggleCriterion, undoCompletion } from '../../db/actions';
import { checkCompletion } from '../../domain/criteria';
import { addDays, formatDate, formatMinutes } from '../../domain/dates';
import { STATUS_LABEL } from '../../domain/schedule';
import type { Challenge, DisplayStatus } from '../../domain/types';
import { useAction, useApp } from '../../lib/appData';
import { useStatusOf } from '../../lib/selectors';

export const STATUS_TONE: Record<DisplayStatus, Tone> = {
  upcoming: 'neutral',
  available: 'accent',
  in_progress: 'info',
  completed: 'success',
  attempted: 'violet',
  missed: 'danger',
  rescheduled: 'warn',
};

export const STATUS_ICON: Record<DisplayStatus, typeof Check> = {
  upcoming: CircleDashed,
  available: CircleDot,
  in_progress: Clock,
  completed: CircleCheck,
  attempted: Flag,
  missed: CircleX,
  rescheduled: CalendarClock,
};

export function StatusBadge({ status }: { status: DisplayStatus }) {
  const Icon = STATUS_ICON[status];
  return (
    <Badge tone={STATUS_TONE[status]} icon={<Icon className="size-3" aria-hidden />}>
      {STATUS_LABEL[status]}
    </Badge>
  );
}

export function EstTime({ minutes }: { minutes: number }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs text-ink-3">
      <Clock className="size-3.5" aria-hidden />~{formatMinutes(minutes)}
    </span>
  );
}

/** Start / pause / complete / attempt / reschedule / undo. Used on Today and the detail page. */
export function ChallengeActions({ challenge, compact = false }: { challenge: Challenge; compact?: boolean }) {
  const { data, today } = useApp();
  const status = useStatusOf(challenge);
  const progress = data.progress.get(challenge.id);
  const isFutureDue = status === 'upcoming' || status === 'rescheduled';
  const [confirmEarly, setConfirmEarly] = useState(false);
  const [completeOpen, setCompleteOpen] = useState(false);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [confirmUndo, setConfirmUndo] = useState(false);
  const start = useAction((early: boolean) => startChallenge(challenge.id, { early }), { success: 'Challenge started. Timer running.' });
  const pause = useAction(() => pauseChallenge(challenge.id), { success: 'Paused. Progress saved.' });
  const undo = useAction(() => undoCompletion(challenge.id), { success: 'Completion undone.' });

  const running = progress?.status === 'in_progress';
  const paused = progress?.status === 'paused';
  const done = status === 'completed' || status === 'attempted';

  return (
    <div className={clsx('flex flex-wrap gap-2', compact && 'gap-1.5')}>
      {!done && !running && (
        <Button variant="primary" size={compact ? 'md' : 'lg'} icon={<Play className="size-4" />} busy={start.busy} onClick={() => (isFutureDue ? setConfirmEarly(true) : void start.run(false))}>
          {paused ? 'Resume' : isFutureDue ? 'Start early' : 'Start challenge'}
        </Button>
      )}
      {running && (
        <Button size={compact ? 'md' : 'lg'} icon={<Pause className="size-4" />} busy={pause.busy} onClick={() => void pause.run()}>
          Pause
        </Button>
      )}
      {!done && (progress?.startedAt || status === 'available' || status === 'missed') && (
        <Button variant={running || paused ? 'success' : 'secondary'} size={compact ? 'md' : 'lg'} icon={<Check className="size-4" />} onClick={() => setCompleteOpen(true)}>
          Finish…
        </Button>
      )}
      {!done && (
        <Button variant="ghost" size={compact ? 'md' : 'lg'} icon={<CalendarClock className="size-4" />} onClick={() => setRescheduleOpen(true)}>
          {progress?.rescheduledTo ? 'Change date' : 'Reschedule'}
        </Button>
      )}
      {done && (
        <Button variant="ghost" size={compact ? 'md' : 'lg'} icon={<Undo2 className="size-4" />} onClick={() => setConfirmUndo(true)}>
          Undo {status === 'completed' ? 'completion' : 'attempt'}
        </Button>
      )}
      {status === 'attempted' && (
        <Button size={compact ? 'md' : 'lg'} icon={<RotateCcw className="size-4" />} onClick={() => void start.run(true)}>
          Try again
        </Button>
      )}

      <ConfirmDialog
        open={confirmEarly}
        onClose={() => setConfirmEarly(false)}
        title="Start this challenge early?"
        confirmLabel="Start early"
        onConfirm={() => {
          setConfirmEarly(false);
          void start.run(true);
        }}
      >
        Day {challenge.day} is scheduled for {formatDate(data.program ? addDays(data.program.startDate, challenge.day - 1) : today)}. Starting it now is fine — it will be recorded as started early, and today’s scheduled challenge stays as it is.
      </ConfirmDialog>
      <ConfirmDialog
        open={confirmUndo}
        onClose={() => setConfirmUndo(false)}
        title="Undo this result?"
        confirmLabel="Undo"
        tone="danger"
        busy={undo.busy}
        onConfirm={() => {
          setConfirmUndo(false);
          void undo.run();
        }}
      >
        The challenge goes back to in progress. Measurements, notes, attempts and files are kept, and the undo is recorded in its history. Achievements and charts update automatically.
      </ConfirmDialog>
      <CompleteDialog challenge={challenge} open={completeOpen} onClose={() => setCompleteOpen(false)} future={isFutureDue} />
      <RescheduleDialog challenge={challenge} open={rescheduleOpen} onClose={() => setRescheduleOpen(false)} />
    </div>
  );
}

function CompleteDialog({ challenge, open, onClose, future }: { challenge: Challenge; open: boolean; onClose: () => void; future: boolean }) {
  const { data } = useApp();
  const progress = data.progress.get(challenge.id);
  const evidence = data.evidence.filter((e) => e.challengeId === challenge.id);
  const check = checkCompletion(challenge, progress ?? { metrics: {}, checked: [] }, evidence);
  const hard = data.settings.hardMode;
  const [note, setNote] = useState('');
  const [earlyOk, setEarlyOk] = useState(false);
  const toggle = useAction((id: string, on: boolean) => toggleCriterion(challenge.id, id, on));
  const complete = useAction((outcome: 'completed' | 'attempted') => completeChallenge(challenge.id, { outcome, early: future, note }), {
    success: (p) => (p.status === 'completed' ? `Day ${challenge.day} complete.` : `Attempt on Day ${challenge.day} logged.`),
  });
  const blockedByCriteria = hard && !check.mainMet;
  const blockedByEarly = future && !earlyOk;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`Finish Day ${challenge.day}`}
      footer={
        <>
          <Button
            variant="secondary"
            icon={<Flag className="size-4" />}
            disabled={blockedByEarly}
            busy={complete.busy}
            onClick={async () => {
              if (await complete.run('attempted')) onClose();
            }}
          >
            Attempted, not finished
          </Button>
          <Button
            variant="success"
            icon={<Check className="size-4" />}
            disabled={blockedByCriteria || blockedByEarly}
            busy={complete.busy}
            onClick={async () => {
              if (await complete.run('completed')) onClose();
            }}
          >
            Mark completed
          </Button>
        </>
      }
    >
      <p className="mb-3 text-sm text-ink-2">{challenge.objective}</p>
      <ul className="space-y-2.5">
        {check.results.map(({ criterion, result }) => (
          <li key={criterion.id} className="flex items-start justify-between gap-3">
            {result.auto ? (
              <span className="flex items-start gap-3 text-sm">
                <span className={clsx('mt-px flex size-5 shrink-0 items-center justify-center rounded-full border border-dashed', result.met ? 'border-success bg-success text-[#04150d]' : 'border-line-strong bg-surface-2')} aria-hidden>
                  {result.met && <Check className="size-3.5" strokeWidth={3} />}
                </span>
                <span>
                  {criterion.label}
                  {criterion.bonus && (
                    <Badge tone="accent" className="ml-1.5">
                      Bonus
                    </Badge>
                  )}
                  <span className="block text-xs text-ink-3">Auto · {result.met ? 'met' : 'not met'} from your logged data{result.detail ? ` · ${result.detail}` : ''}</span>
                </span>
              </span>
            ) : (
              <Checkbox
                checked={result.met}
                onChange={(on) => void toggle.run(criterion.id, on)}
                label={
                  <span>
                    {criterion.label}
                    {criterion.bonus && (
                      <Badge tone="accent" className="ml-1.5">
                        Bonus
                      </Badge>
                    )}
                    <span className="block text-xs text-ink-3">Self-certified — tick only if true</span>
                  </span>
                }
              />
            )}
          </li>
        ))}
      </ul>
      {!check.mainMet && (
        <div className={clsx('mt-4 flex gap-2.5 rounded-xl p-3 text-sm', hard ? 'bg-danger-soft text-danger' : 'bg-warn-soft text-warn')}>
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          <p>{hard ? 'Hard Mode: completion has to be earned. Record the measurements that meet the criteria, or log this as an attempt.' : 'Not every main criterion is met yet. Record your measurements on the challenge page, or log this as an attempt.'}</p>
        </div>
      )}
      {future && (
        <div className="mt-4 rounded-xl border border-warn/40 bg-warn-soft p-3">
          <Checkbox checked={earlyOk} onChange={setEarlyOk} label={<span className="text-warn">This challenge is scheduled for a later date. I’m intentionally finishing it early.</span>} />
        </div>
      )}
      <Field label="Note (optional)" htmlFor="complete-note" className="mt-4">
        <Textarea id="complete-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder="What happened?" className="min-h-[64px]" />
      </Field>
    </Dialog>
  );
}

export function RescheduleDialog({ challenge, open, onClose }: { challenge: Challenge; open: boolean; onClose: () => void }) {
  const { data, today } = useApp();
  const progress = data.progress.get(challenge.id);
  const original = data.program ? addDays(data.program.startDate, challenge.day - 1) : today;
  const [date, setDate] = useState(progress?.rescheduledTo ?? addDays(today, 1));
  const save = useAction((to: string | null) => rescheduleChallenge(challenge.id, to), { success: (p) => (p.rescheduledTo ? `Rescheduled to ${formatDate(p.rescheduledTo, 'short')}.` : 'Back on its original date.') });
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`Reschedule Day ${challenge.day}`}
      size="sm"
      footer={
        <>
          {progress?.rescheduledTo && (
            <Button
              variant="ghost"
              onClick={async () => {
                if ((await save.run(null)) !== undefined) onClose();
              }}
            >
              Restore original
            </Button>
          )}
          <Button
            variant="primary"
            busy={save.busy}
            disabled={!date || date < today}
            onClick={async () => {
              if ((await save.run(date)) !== undefined) onClose();
            }}
          >
            Save date
          </Button>
        </>
      }
    >
      <p className="mb-4 text-sm leading-relaxed text-ink-2">
        Originally scheduled for <strong className="text-ink">{formatDate(original)}</strong>. That date stays in the record. Other challenges don’t move.
      </p>
      <Field label="New date" htmlFor="resched-date">
        <Input id="resched-date" type="date" min={today} value={date} onChange={(e) => setDate(e.target.value)} />
      </Field>
    </Dialog>
  );
}
