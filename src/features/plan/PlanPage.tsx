import { useState } from 'react';
import { Button, ConfirmDialog, PageHeader } from '../../components/ui';
import { challengeKey } from '../../data/library';
import { replacePlan, swapDay } from '../../db/actions';
import { formatDate } from '../../domain/dates';
import { useAction, useApp } from '../../lib/appData';
import { PlanBuilder, PlanList, type PlanDraft } from './PlanBuilder';

/** True if a day has anything logged against it (then it can't be swapped). */
export function useDayLocked() {
  const { data } = useApp();
  return (challengeId: string) => {
    const s = data.progress.get(challengeId)?.status;
    return (s !== undefined && s !== 'not_started') || data.attempts.some((a) => a.challengeId === challengeId) || data.evidence.some((e) => e.challengeId === challengeId);
  };
}

export function PlanPage() {
  const { data } = useApp();
  const program = data.program;
  const isLocked = useDayLocked();
  const anyActivity = data.challenges.some((c) => isLocked(c.id));
  const [draft, setDraft] = useState<PlanDraft>(() => ({
    length: program?.length ?? data.challenges.length,
    mode: program?.mode ?? 'signature',
    themes: program?.themes ?? [],
    curve: program?.curve ?? 'steady',
    restEvery: program?.restEvery ?? 0,
    tracks: program?.tracks ?? [],
    timeBudget: program?.timeBudget ?? 'medium',
    wildcards: program?.wildcards ?? 'some',
    includeFun: program?.includeFun ?? true,
    plan: data.challenges.map((c) => challengeKey(c)),
    seed: Math.floor(Math.random() * 1e9),
  }));
  const [confirm, setConfirm] = useState(false);
  const save = useAction(() => replacePlan(draft.plan, { mode: draft.mode, themes: draft.themes, curve: draft.curve, restEvery: draft.restEvery, tracks: draft.tracks, timeBudget: draft.timeBudget, wildcards: draft.wildcards, includeFun: draft.includeFun }), { success: 'Plan saved.' });
  const swap = useAction((day: number, id: string) => swapDay(day, id), { success: 'Day swapped.' });
  if (!program) return null;
  const current = data.challenges.map((c) => challengeKey(c));
  const changed = draft.plan.join() !== current.join();

  return (
    <div>
      <PageHeader title="Your plan" subtitle={`${program.length} days · ${formatDate(program.startDate, 'dm')} – ${formatDate(program.endDate, 'dm')}`} />
      {anyActivity ? (
        <>
          <p className="mb-4 text-sm leading-relaxed text-ink-2">You’ve started, so the length is fixed. You can still swap any day that has nothing logged yet — the old challenge is kept in that day’s history.</p>
          <PlanList plan={current} equipment={data.settings.equipment} locked={(day) => isLocked(data.challenges[day - 1]?.id ?? '')} onSwap={(day, id) => void swap.run(day, id)} />
        </>
      ) : (
        <>
          <p className="mb-5 text-sm leading-relaxed text-ink-2">Nothing has been logged yet, so you can change everything — length, style and individual days.</p>
          <PlanBuilder draft={draft} onChange={setDraft} equipment={data.settings.equipment} startDate={program.startDate} stage={data.settings.lifeStage} />
          <div className="sticky bottom-[calc(68px+env(safe-area-inset-bottom))] -mx-2 mt-6 flex justify-end gap-2 rounded-xl border border-line bg-surface/95 p-2 shadow-pop backdrop-blur md:bottom-4">
            <Button variant="ghost" disabled={!changed} onClick={() => setDraft({ ...draft, plan: current, length: program.length, mode: program.mode, themes: program.themes, curve: program.curve, restEvery: program.restEvery, tracks: program.tracks, timeBudget: program.timeBudget, wildcards: program.wildcards, includeFun: program.includeFun })}>
              Reset
            </Button>
            <Button variant="primary" disabled={!changed} busy={save.busy} onClick={() => setConfirm(true)}>
              Save plan
            </Button>
          </div>
          <ConfirmDialog
            open={confirm}
            onClose={() => setConfirm(false)}
            title="Replace your plan?"
            confirmLabel="Save plan"
            onConfirm={() => {
              setConfirm(false);
              void save.run();
            }}
          >
            Your program becomes {draft.plan.length} days with these challenges. Preparation ticks on the old plan are cleared; habits, reflections and settings are kept.
          </ConfirmDialog>
        </>
      )}
    </div>
  );
}
