import clsx from 'clsx';
import { Award, BarChart3, BookHeart, CalendarCheck, Lightbulb, Lock, ShieldAlert, Trophy } from 'lucide-react';
import { useMemo } from 'react';
import { Link } from 'react-router';
import { Badge, Card, EmptyState, PageHeader, ProgressBar, SectionTitle, Stat } from '../../components/ui';
import { formatDate, formatInstant } from '../../domain/dates';
import { PROGRAM_DAYS, STATUS_LABEL } from '../../domain/schedule';
import { ACHIEVEMENTS, allPbEvents, categoryBreakdown, elapsedProgramDates, habitSeries, mostSkipped, pct, suggestions, weeklyStats } from '../../domain/stats';
import type { AchievementType } from '../../domain/types';
import { useApp } from '../../lib/appData';
import { useProgramView } from '../../lib/selectors';
import { STATUS_ICON } from '../challenges/shared';
import { CategoryBars, PbBars, PercentBars } from './Charts';

const STRIP: Record<string, string> = {
  upcoming: 'bg-surface-3 text-ink-2',
  available: 'bg-surface text-ink ring-2 ring-inset ring-slate',
  in_progress: 'bg-surface text-ink ring-1 ring-inset ring-slate',
  completed: 'bg-slate text-white dark:text-[#14181c]',
  attempted: 'bg-slate-soft text-slate',
  missed: 'bg-danger-soft text-danger',
  rescheduled: 'bg-warn-soft text-warn',
};

export default function ProgressPage() {
  const { data, today } = useApp();
  const view = useProgramView();
  const stats = useMemo(() => {
    if (!view) return null;
    const dates = elapsedProgramDates(view.startDate, today);
    const series = habitSeries(data.habits, data.entries, dates);
    const weeks = weeklyStats(view.startDate, today, data.challenges, data.progress, data.habits, data.entries);
    const pbs = allPbEvents(data.challenges, data.progress, data.attempts);
    const skipped = mostSkipped(data.habits, data.entries, dates, today);
    const planned = series.reduce((a, d) => a + d.planned, 0);
    const score = series.reduce((a, d) => a + d.score, 0);
    // Best improvement per challenge+metric, for the PB chart.
    const bestByKey = new Map<string, (typeof pbs)[number]>();
    for (const e of pbs) {
      const k = `${e.challengeId}|${e.key}`;
      const cur = bestByKey.get(k);
      if (!cur || e.improvementPct > cur.improvementPct) bestByKey.set(k, e);
    }
    // Improvement vs the very first value (not just the previous PB).
    const pbRows = [...bestByKey.values()].map((e) => {
      const c = data.challenges.find((x) => x.id === e.challengeId);
      const firstEvent = pbs.find((p) => p.challengeId === e.challengeId && p.key === e.key);
      const first = firstEvent?.previous ?? e.previous;
      const total = first === 0 ? 0 : Math.round((((e.value - first) / Math.abs(first)) * 100 * (e.better === 'higher' ? 1 : -1)));
      return { label: `D${c?.day} ${e.label}`, pct: total, detail: `${first} → ${e.value}${e.unit ? ` ${e.unit}` : ''}` };
    });
    return {
      dates,
      series,
      weeks,
      pbs,
      pbRows: pbRows.sort((a, b) => b.pct - a.pct).slice(0, 10),
      skipped,
      habitRate: planned ? score / planned : null,
      plannedHabits: planned,
      doneHabits: series.reduce((a, d) => a + d.done, 0),
      sessions: data.attempts.length + [...data.progress.values()].reduce((a, p) => a + p.history.filter((h) => h.action === 'started' || h.action === 'resumed').length, 0),
      categories: categoryBreakdown(data.challenges, data.progress),
      tips: suggestions({ skipped, weeks, missedChallenges: view.counts.missed, habits: data.habits, entries: data.entries }),
    };
  }, [view, data, today]);

  if (!view || !stats) return null;
  const elapsed = stats.dates.length;
  const hard = data.settings.hardMode;
  const earned = new Map(data.achievements.map((a) => [a.type, a]));
  const reflections = [...data.reflections].filter((r) => r.updatedAt).sort((a, b) => b.date.localeCompare(a.date));
  const currentWeek = stats.weeks.at(-1);

  return (
    <div className="space-y-6">
      <PageHeader title="Progress" subtitle={view.phase === 'before' ? `Starts ${formatDate(view.startDate, 'short')} — charts fill in as you log real data.` : `Day ${view.day} of ${PROGRAM_DAYS} · every number below comes from what you logged.`} />

      <Card className="grid grid-cols-2 gap-x-4 gap-y-5 p-5 sm:grid-cols-4">
        <Stat label="Current day" value={view.phase === 'before' ? '—' : view.day} sub={view.phase === 'active' ? `${PROGRAM_DAYS - view.day} to go` : view.phase === 'after' ? 'Finished' : 'Not started'} />
        <Stat label="Completed" value={view.counts.completed} sub={`${view.counts.attempted} attempted`} tone="success" />
        <Stat label="Remaining" value={view.counts.remaining} sub={view.counts.missed ? `${view.counts.missed} missed` : 'none missed'} tone={view.counts.missed ? 'danger' : undefined} />
        <Stat label="Habit adherence" value={pct(stats.habitRate)} sub={`${stats.pbs.length} PBs · ${stats.sessions} sessions`} />
      </Card>

      <Card className="p-5">
        <SectionTitle>Challenge timeline</SectionTitle>
        <ol className="grid grid-cols-10 gap-1 sm:gap-1.5" aria-label="Status of each day">
          {data.challenges.map((c) => {
            const s = view.statuses.get(c.id) ?? 'upcoming';
            const Icon = STATUS_ICON[s];
            return (
              <li key={c.id}>
                <Link to={`/challenges/${c.id}`} className={clsx('flex h-9 flex-col items-center justify-center rounded-full text-[10px] font-bold sm:h-10', STRIP[s])} title={`Day ${c.day}: ${STATUS_LABEL[s]}`} aria-label={`Day ${c.day}: ${STATUS_LABEL[s]}`}>
                  <span className="tnum leading-none">{c.day}</span>
                  <Icon className="mt-0.5 size-3" aria-hidden />
                </Link>
              </li>
            );
          })}
        </ol>
      </Card>

      <Card className="p-5">
        <SectionTitle>Daily habit completion</SectionTitle>
        {elapsed === 0 ? (
          <EmptyState icon={<BarChart3 className="size-5" />} title="No program days yet">
            This chart starts on Day 1. Each bar is the share of that day’s planned habits you completed (rest days excluded).
          </EmptyState>
        ) : (
          <PercentBars data={stats.series.map((d, i) => ({ label: `D${i + 1}`, value: d.rate === null ? null : Math.round(d.rate * 100), detail: `${formatDate(d.date, 'dm')} · ${d.done}/${d.planned} done` }))} />
        )}
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="p-5">
          <SectionTitle>Weekly consistency</SectionTitle>
          {stats.weeks.length === 0 ? (
            <EmptyState icon={<CalendarCheck className="size-5" />} title="Week 1 hasn’t started">
              Combined habit and challenge commitments per program week.
            </EmptyState>
          ) : (
            <PercentBars height={170} data={stats.weeks.map((w) => ({ label: w.label.replace('Week ', 'W'), value: w.commitmentRate === null ? null : Math.round(w.commitmentRate * 100), detail: `Habits ${pct(w.habitRate)} · challenges ${w.challengesCompleted}/${w.challengesDue}${w.complete ? '' : ' (in progress)'}` }))} />
          )}
        </Card>
        <Card className="p-5">
          <SectionTitle>Personal-best improvements</SectionTitle>
          {stats.pbRows.length === 0 ? (
            <EmptyState icon={<Trophy className="size-5" />} title="No personal bests yet">
              A PB appears when you log a value that beats an earlier one, or a final measurement that beats its baseline.
            </EmptyState>
          ) : (
            <PbBars data={stats.pbRows} />
          )}
        </Card>
      </div>

      <Card className="p-5">
        <SectionTitle>By category</SectionTitle>
        {view.counts.completed + view.counts.attempted === 0 ? (
          <EmptyState icon={<BarChart3 className="size-5" />} title="Nothing finished yet">
            Completed and attempted challenges will be grouped by skill category here.
          </EmptyState>
        ) : (
          <CategoryBars data={stats.categories.filter((c) => c.completed + c.attempted > 0 || stats.categories.length <= 12)} />
        )}
      </Card>

      <Card className={clsx('p-5', hard && 'border-accent/30')}>
        <SectionTitle action={hard ? <Badge tone="accent" icon={<ShieldAlert className="size-3" />}>Hard Mode</Badge> : undefined}>Accountability</SectionTitle>
        <div className="grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-4">
          <Stat label="Completed vs missed" value={`${view.counts.completed} / ${view.counts.missed}`} sub={`${view.counts.attempted} attempted`} />
          <Stat label="Planned habits done" value={`${stats.doneHabits}/${stats.plannedHabits}`} sub="fully completed" />
          <Stat label="This week’s commitments" value={pct(currentWeek?.commitmentRate ?? null)} sub={currentWeek ? currentWeek.label : '—'} />
          <Stat label="Personal records" value={stats.pbs.length} />
        </div>
        {stats.skipped.length > 0 && (
          <div className="mt-6">
            <p className="mb-2 text-[13px] font-semibold text-ink-2">Most frequently skipped</p>
            <ul className="space-y-2.5">
              {stats.skipped.slice(0, 5).map((s) => (
                <li key={s.habitId}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span>{s.name}</span>
                    <span className="tnum text-ink-3">
                      missed {s.missed} of {s.planned}
                    </span>
                  </div>
                  <ProgressBar value={s.rate} tone="info" label={`${s.name} missed rate`} />
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-ink-3">Private habit goals are never included here.</p>
          </div>
        )}
        <div className="mt-6 space-y-2">
          {stats.tips.map((t) => (
            <p key={t} className="flex gap-2.5 rounded-xl bg-surface-2 p-3 text-sm leading-relaxed text-ink-2">
              <Lightbulb className="mt-0.5 size-4 shrink-0 text-slate" aria-hidden /> {t}
            </p>
          ))}
        </div>
      </Card>

      <section aria-labelledby="ach-title">
        <SectionTitle id="ach-title">Achievements</SectionTitle>
        <ul className="grid gap-2.5 sm:grid-cols-2">
          {(Object.keys(ACHIEVEMENTS) as AchievementType[]).map((t) => {
            const a = earned.get(t);
            return (
              <li key={t}>
                <Card className={clsx('flex items-start gap-3 p-4', !a && 'opacity-60')}>
                  <span className={clsx('flex size-9 shrink-0 items-center justify-center rounded-lg', a ? 'bg-surface-2 text-slate' : 'bg-surface-2 text-ink-3')}>{a ? <Award className="size-5" /> : <Lock className="size-4" />}</span>
                  <div className="min-w-0">
                    <p className="font-semibold">{ACHIEVEMENTS[t].title}</p>
                    <p className="text-xs text-ink-3">{a ? `${formatInstant(a.earnedAt, data.settings.timezone)} · ${a.relatedEvent}` : ACHIEVEMENTS[t].description}</p>
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-labelledby="refl-title">
        <SectionTitle id="refl-title">Reflections</SectionTitle>
        {reflections.length === 0 ? (
          <Card>
            <EmptyState icon={<BookHeart className="size-5" />} title="No check-ins yet">
              The optional evening check-in on Today saves here. Private, editable, never required.
            </EmptyState>
          </Card>
        ) : (
          <Card className="divide-y divide-line">
            {reflections.slice(0, 30).map((r) => (
              <details key={r.id} className="group px-4 py-3">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-medium">
                  {formatDate(r.date, 'short')}
                  <span className="flex gap-1.5">
                    {r.completedChallenge && <Badge>{r.completedChallenge === 'yes' ? 'Challenge done' : r.completedChallenge === 'partly' ? 'Partly' : r.completedChallenge === 'rest' ? 'Rest day' : 'Not done'}</Badge>}
                    {r.mood && <Badge tone="info">Mood {r.mood}/5</Badge>}
                    {r.energy && <Badge tone="accent">Energy {r.energy}/5</Badge>}
                  </span>
                </summary>
                <dl className="mt-3 space-y-2 text-sm">
                  {(
                    [
                      ['Biggest improvement', r.improvement],
                      ['Difficult', r.difficult],
                      ['Proud of', r.proud],
                      ['Change tomorrow', r.change],
                    ] as const
                  )
                    .filter(([, v]) => v)
                    .map(([k, v]) => (
                      <div key={k}>
                        <dt className="text-xs font-semibold text-ink-3">{k}</dt>
                        <dd className="whitespace-pre-wrap text-ink-2">{v}</dd>
                      </div>
                    ))}
                </dl>
              </details>
            ))}
          </Card>
        )}
      </section>
    </div>
  );
}
