import clsx from 'clsx';
import { ArrowRight, Bell, Check, ChevronLeft, ChevronRight, Flag, MoonStar, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { quoteFor, QuoteCard, Scene, usePhoto } from '../../components/Scene';
import { Button, Disclosure, ProgressRing } from '../../components/ui';
import { addDays, endOfDayEpoch, formatDate, nowTimeIn } from '../../domain/dates';
import { dayAdherence } from '../../domain/habits';
import { challengeNudge } from '../../domain/messages';
import { PROGRAM_DAYS, programDayFor } from '../../domain/schedule';
import { activeStreak } from '../../domain/stats';
import type { Challenge, IsoDate } from '../../domain/types';
import { useApp, useNow } from '../../lib/appData';
import { useReminders } from '../../lib/reminderScheduler';
import { habitGroupsFor, useProgramView, useStatusOf, type ProgramView } from '../../lib/selectors';
import { ChallengeActions, StatusBadge } from '../challenges/shared';
import { HabitRow } from '../habits/HabitRow';
import { MissedAcknowledgement } from './MissedAcknowledgement';

export function TodayPage() {
  const { data, today } = useApp();
  const view = useProgramView();
  const [viewDate, setViewDate] = useState<IsoDate | null>(null);
  const hero = usePhoto('coast') === 'ok';
  if (!view) return null;
  const date = viewDate ?? today;
  const isToday = date === today;
  const day = programDayFor(view.startDate, date);
  const inProgram = day >= 1 && day <= PROGRAM_DAYS;
  const challenge = inProgram ? (data.challenges.find((c) => c.day === day) ?? null) : null;
  const hard = data.settings.hardMode;
  const minDate = addDays(view.startDate, -7);
  const maxDate = addDays(view.endDate, 1) > addDays(today, 1) ? addDays(view.endDate, 1) : addDays(today, 1);
  const name = data.settings.displayName;
  const greeting = greetingFor(nowTimeIn(data.settings.timezone));
  const eyebrow = inProgram ? `Day ${day} of ${PROGRAM_DAYS}` : day < 1 ? `Starts ${formatDate(view.startDate, 'short')}` : 'Program complete';

  return (
    <div>
      {/* Desktop greeting row */}
      <div className="mb-6 hidden items-baseline justify-between md:flex">
        <p className="font-display text-[15px] text-ink-2">
          {greeting}
          {name ? `, ${name}` : ''}.
        </p>
        {view.phase === 'active' && (
          <p className="font-display text-[17px]">
            Day {view.day} <span className="text-[13px] text-ink-3">of {PROGRAM_DAYS}</span>
          </p>
        )}
      </div>

      <div className="flex items-center justify-between">
        <p className="eyebrow">
          {eyebrow}
          {!isToday && <span className="ml-2 normal-case tracking-normal">· {formatDate(date, 'short')}</span>}
        </p>
        <div className="flex items-center gap-1">
          {!isToday && (
            <button type="button" className="mr-1 text-xs text-slate hover:underline" onClick={() => setViewDate(null)}>
              Back to today
            </button>
          )}
          <button type="button" aria-label="Previous day" disabled={date <= minDate} onClick={() => setViewDate(addDays(date, -1))} className="rounded p-1.5 text-ink-2 hover:text-ink disabled:opacity-30">
            <ChevronLeft className="size-[18px]" strokeWidth={1.6} />
          </button>
          <button type="button" aria-label="Next day" disabled={date >= maxDate} onClick={() => setViewDate(addDays(date, 1) === today ? null : addDays(date, 1))} className="rounded p-1.5 text-ink-2 hover:text-ink disabled:opacity-30">
            <ChevronRight className="size-[18px]" strokeWidth={1.6} />
          </button>
        </div>
      </div>

      <Headline view={view} challenge={challenge} day={day} isToday={isToday} />

      {isToday && (
        <div className="mt-5 space-y-3 empty:hidden">
          <ReminderBanners />
          {hard && view.phase === 'active' && <HardModeLine view={view} />}
          {view.unacknowledgedMissed.length > 0 && <MissedAcknowledgement challenges={view.unacknowledgedMissed} required={hard} />}
        </div>
      )}

      {/* Hero + overlapping checklist */}
      <div className="relative mt-6">
        <Scene kind="coast" className="-mx-5 h-[210px] md:mx-0 md:h-[240px] md:rounded-xl" />
        <div className={clsx('relative md:grid md:grid-cols-[1.35fr_1fr] md:items-start md:gap-4', hero && '-mt-8 md:-mt-10 md:px-4')}>
          <Checklist date={date} challenge={challenge} isToday={isToday} />
          <ProgressSummary date={date} challenge={challenge} className="hidden md:block" />
        </div>
      </div>

      <ProgressSummary date={date} challenge={challenge} className="mt-4 md:hidden" />

      {view.catchUps.length > 0 && isToday && (
        <section className="mt-8" aria-labelledby="catchup-title">
          <h2 id="catchup-title" className="font-display mb-3 text-[19px]">
            Rescheduled to today
          </h2>
          <div className="divide-y divide-line rounded-xl border border-line bg-surface">
            {view.catchUps.map((c) => (
              <MiniChallenge key={c.id} challenge={c} />
            ))}
          </div>
        </section>
      )}

      {isToday && view.tomorrowChallenge && (
        <section className="mt-8" aria-labelledby="tomorrow-title">
          <h2 id="tomorrow-title" className="font-display mb-3 text-[19px]">
            Tomorrow
          </h2>
          <div className="rounded-xl border border-line bg-surface">
            <MiniChallenge challenge={view.tomorrowChallenge} showPrep />
          </div>
        </section>
      )}
      {view.phase === 'before' && isToday && data.challenges[0] && (
        <section className="mt-8" aria-labelledby="first-title">
          <h2 id="first-title" className="font-display mb-3 text-[19px]">
            Day 1
          </h2>
          <div className="rounded-xl border border-line bg-surface">
            <MiniChallenge challenge={data.challenges[0]} showPrep prepLabel="Preparation checklist" />
          </div>
        </section>
      )}

      <QuoteCard quote={quoteFor(view.day)} scene="peaks" className="mt-8" />
    </div>
  );
}

function greetingFor(time: string) {
  const h = Number(time.slice(0, 2));
  return h < 5 ? 'Late night' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

const hours = (mins: number) => {
  const h = Math.round((mins / 60) * 4) / 4;
  return h < 1 ? `${mins} min` : `${h} h`;
};

function Headline({ view, challenge, day, isToday }: { view: ProgramView; challenge: Challenge | null; day: number; isToday: boolean }) {
  const { data, today, now } = useApp();
  if (!challenge) {
    if (day < 1) {
      const days = 1 - programDayFor(view.startDate, today);
      return (
        <div className="mt-3">
          <h1 className="font-display text-[34px] leading-[1.08] md:text-[44px]">Small steps create real change.</h1>
          <p className="mt-3 max-w-md text-[14px] leading-relaxed text-ink-2">
            Your challenge starts in {days} day{days === 1 ? '' : 's'}, on {formatDate(view.startDate)}. Habits can be logged from today if you want a head start.
          </p>
        </div>
      );
    }
    return (
      <div className="mt-3">
        <h1 className="font-display text-[34px] leading-[1.08] md:text-[44px]">{view.counts.completed} of 30 completed.</h1>
        <p className="mt-3 max-w-md text-[14px] leading-relaxed text-ink-2">
          The 30 days are over{view.counts.attempted ? `, with ${view.counts.attempted} more honestly attempted` : ''}. Open challenges can still be finished — they’ll be recorded with their real dates.{' '}
          <Link to="/progress" className="text-slate underline-offset-2 hover:underline">
            Review your progress
          </Link>
        </p>
      </div>
    );
  }
  const status = view.statuses.get(challenge.id) ?? 'upcoming';
  const hoursLeft = (endOfDayEpoch(today, data.settings.timezone) - now) / 3_600_000;
  const nudge = isToday ? challengeNudge(status, data.settings.hardMode, challenge.day, hoursLeft) : null;
  return (
    <div className="mt-3">
      <h1 className="font-display text-[34px] leading-[1.08] md:text-[44px]">{challenge.title}</h1>
      <p className="mt-3 max-w-xl text-[14px] leading-relaxed text-ink-2">{challenge.objective}</p>
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-[12.5px] text-ink-3">
        <span>{challenge.category}</span>
        <span aria-hidden>·</span>
        <span>~{hours(challenge.estimatedMinutes)}</span>
        <StatusBadge status={status} />
      </div>
      {nudge && <p className={clsx('font-display mt-3 text-[16px] italic', data.settings.hardMode ? 'text-ink' : 'text-ink-2')}>{nudge}</p>}
      <div className="mt-5 flex flex-wrap items-center gap-4">
        <ChallengeActions challenge={challenge} compact />
        <Link to={`/challenges/${challenge.id}`} className="inline-flex items-center gap-1 text-[13px] text-ink-2 hover:text-ink">
          Details <ArrowRight className="size-3.5" />
        </Link>
      </div>
    </div>
  );
}

function ReminderBanners() {
  const { inApp, dismiss } = useReminders();
  if (!inApp.length) return null;
  return (
    <div className="space-y-2" aria-live="polite">
      {inApp.map((r) => (
        <div key={r.key} className="flex items-start gap-3 rounded-xl border border-line bg-surface px-4 py-3">
          <Bell className="mt-0.5 size-4 shrink-0 text-slate" strokeWidth={1.7} aria-hidden />
          <div className="min-w-0 flex-1 text-[13.5px]">
            <p className="font-medium text-ink">{r.title}</p>
            <p className="text-ink-2">{r.body}</p>
          </div>
          <button type="button" className="text-ink-3 hover:text-ink" aria-label="Dismiss reminder" onClick={() => dismiss(r.key)}>
            <X className="size-4" />
          </button>
        </div>
      ))}
    </div>
  );
}

function HardModeLine({ view }: { view: ProgramView }) {
  const { data, today } = useApp();
  const now = useNow(15_000);
  const left = Math.max(0, endOfDayEpoch(today, data.settings.timezone) - now);
  const h = Math.floor(left / 3_600_000);
  const m = Math.floor((left % 3_600_000) / 60_000);
  const adherence = dayAdherence(data.habits, data.entries, today);
  const challengeOpen = view.todayChallenge && !['completed', 'attempted'].includes(view.statuses.get(view.todayChallenge.id) ?? '');
  const open = adherence.planned - adherence.done + (challengeOpen ? 1 : 0) + view.catchUps.length;
  return (
    <div className="flex items-center justify-between border-y border-line py-2.5">
      <p className="eyebrow !text-ink">
        <span className="tnum">
          {h} h {String(m).padStart(2, '0')} min
        </span>{' '}
        left today
      </p>
      <p className="eyebrow">{open > 0 ? `${open} open · Hard Mode` : 'All closed · Hard Mode'}</p>
    </div>
  );
}

function Checklist({ date, challenge, isToday }: { date: IsoDate; challenge: Challenge | null; isToday: boolean }) {
  const { data, today } = useApp();
  const navigate = useNavigate();
  const future = date > today;
  const groups = useMemo(() => habitGroupsFor(data.habits, date, data.settings.hideSensitiveOnToday), [data.habits, date, data.settings.hideSensitiveOnToday]);
  const adherence = dayAdherence(data.habits, data.entries, date);
  const challengeDone = challenge ? ['completed', 'attempted'].includes(data.progress.get(challenge.id)?.status ?? '') : false;
  const total = adherence.planned + (challenge ? 1 : 0);
  const done = adherence.done + (challengeDone ? 1 : 0);
  const reflection = data.reflections.find((r) => r.date === date);
  const sections = [
    { key: 'essential', title: 'Essentials', items: groups.essential },
    { key: 'scheduled', title: 'Scheduled today', items: groups.scheduled },
    { key: 'personal', title: 'Personal habit goals', items: groups.personal },
    { key: 'evening', title: 'Evening routine', items: groups.evening },
  ] as const;

  return (
    <section aria-labelledby="checklist-title" className="rounded-xl border border-line bg-surface px-4 pb-1 pt-4 shadow-card md:px-5">
      <div className="flex items-baseline justify-between">
        <h2 id="checklist-title" className="font-display text-[19px]">
          {isToday ? 'Today’s Checklist' : `${formatDate(date, 'short')} checklist`}
        </h2>
        <p className="tnum text-[13px] text-ink-3" aria-label={`${done} of ${total} done`}>
          {done} / {total}
        </p>
      </div>
      {future && <p className="mt-1 text-xs text-ink-3">A preview — future days can’t be logged yet.</p>}

      {challenge && (
        <ul className="mt-2">
          <ChallengeRow challenge={challenge} />
        </ul>
      )}
      {sections.map((s) =>
        s.items.length ? (
          <div key={s.key} className="border-t border-line">
            <h3 className="eyebrow pt-3 !text-[10px]">{s.title}</h3>
            <ul className="divide-y divide-line">
              {s.items.map((h) => (
                <HabitRow key={h.id} habit={h} date={date} readOnly={future} />
              ))}
            </ul>
          </div>
        ) : null,
      )}
      <div className="border-t border-line">
        <button type="button" onClick={() => navigate(`/reflection${date === today ? '' : `?date=${date}`}`)} disabled={future} className="flex min-h-[46px] w-full items-center gap-3 py-1.5 text-left disabled:opacity-50">
          <span className={clsx('flex size-[22px] shrink-0 items-center justify-center rounded-full border-[1.5px]', reflection?.updatedAt ? 'border-slate bg-slate text-white dark:text-[#14181c]' : 'border-line-strong text-ink-3')}>
            {reflection?.updatedAt ? <Check className="size-3" strokeWidth={3} /> : <MoonStar className="size-3" />}
          </span>
          <span className="flex-1 text-[14px]">Evening reflection</span>
          <span className="text-[12px] text-ink-3">{reflection?.updatedAt ? 'Saved' : 'Optional'}</span>
        </button>
      </div>
      {groups.unplanned.length > 0 && !future && (
        <Disclosure className="border-t border-line" summary={<span className="text-[13px] font-normal text-ink-2">Not planned today ({groups.unplanned.length})</span>}>
          <p className="pb-1 text-xs text-ink-3">Log any of these as extras. They don’t change the day’s adherence.</p>
          <ul className="divide-y divide-line pb-2">
            {groups.unplanned.map((h) => (
              <HabitRow key={h.id} habit={h} date={date} unplanned />
            ))}
          </ul>
        </Disclosure>
      )}
    </section>
  );
}

function ChallengeRow({ challenge }: { challenge: Challenge }) {
  const status = useStatusOf(challenge);
  const done = status === 'completed';
  const attempted = status === 'attempted';
  return (
    <li>
      <Link to={`/challenges/${challenge.id}`} className="flex min-h-[46px] items-center gap-3 py-1.5">
        <span className={clsx('flex size-[22px] shrink-0 items-center justify-center rounded-full border-[1.5px]', done ? 'border-slate bg-slate text-white dark:text-[#14181c]' : attempted ? 'border-slate bg-slate-soft text-slate' : status === 'in_progress' ? 'border-slate' : 'border-line-strong')} aria-hidden>
          {done && <Check className="size-3" strokeWidth={3} />}
          {attempted && <Flag className="size-2.5" />}
          {status === 'in_progress' && <span className="size-2 rounded-full bg-slate" />}
        </span>
        <span className={clsx('min-w-0 flex-1 truncate text-[14px]', done && 'text-ink-2')}>{challenge.title}</span>
        <span className="shrink-0 text-[12px] text-ink-3">{status === 'in_progress' ? 'In progress' : status === 'completed' ? 'Done' : status === 'attempted' ? 'Attempted' : 'Challenge'}</span>
      </Link>
    </li>
  );
}

function ProgressSummary({ date, challenge, className }: { date: IsoDate; challenge: Challenge | null; className?: string }) {
  const { data, today } = useApp();
  const view = useProgramView();
  const adherence = dayAdherence(data.habits, data.entries, date);
  const challengeDone = challenge ? ['completed', 'attempted'].includes(data.progress.get(challenge.id)?.status ?? '') : false;
  const total = adherence.planned + (challenge ? 1 : 0);
  const done = adherence.done + (challengeDone ? 1 : 0);
  const pct = total ? Math.round((done / total) * 100) : 0;
  const streak = activeStreak(data.entries, [...data.progress.values()], today);
  const overall = Math.round(((view?.counts.completed ?? 0) / PROGRAM_DAYS) * 100);
  return (
    <section aria-label="Your progress" className={clsx('rounded-xl border border-line bg-surface p-4 shadow-card md:p-5', className)}>
      <h2 className="font-display mb-4 hidden text-[19px] md:block">Your Progress</h2>
      <div className="flex items-center gap-5">
        <ProgressRing value={pct / 100} size={86} stroke={6} label={`${pct}% of the day done`}>
          <span className="font-display tnum text-[22px]">{pct}%</span>
        </ProgressRing>
        <dl className="space-y-2">
          <Fact value={`${done} / ${total}`} label="tasks completed" />
          <Fact value={String(streak)} label="day streak" />
          <Fact value={`${overall}%`} label="overall progress" />
        </dl>
      </div>
    </section>
  );
}

export function Fact({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex items-baseline gap-2">
      <dt className="sr-only">{label}</dt>
      <dd className="font-display tnum text-[17px] leading-none">{value}</dd>
      <span className="text-[12px] text-ink-3" aria-hidden>
        {label}
      </span>
    </div>
  );
}

function MiniChallenge({ challenge, showPrep = false, prepLabel = 'Prepare for tomorrow' }: { challenge: Challenge; showPrep?: boolean; prepLabel?: string }) {
  const { data } = useApp();
  const status = useStatusOf(challenge);
  const missing = challenge.equipment.filter((e) => !data.settings.equipment.includes(e));
  const progress = data.progress.get(challenge.id);
  return (
    <div className="px-4 py-3.5">
      <Link to={`/challenges/${challenge.id}`} className="flex items-center gap-3">
        <span className="font-display tnum w-8 text-center text-[22px] leading-none text-ink-2">{challenge.day}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14.5px]">{challenge.title}</span>
          <span className="block text-[12px] text-ink-3">
            {challenge.category} · ~{hours(challenge.estimatedMinutes)}
          </span>
        </span>
        <StatusBadge status={status} />
        <ChevronRight className="size-4 text-ink-3" aria-hidden />
      </Link>
      {showPrep && challenge.preparation.length > 0 && (
        <Disclosure className="mt-2 border-t border-line" summary={<span className="text-[13px] font-normal text-ink-2">{prepLabel}</span>} badge={missing.length ? <span className="text-[11px] font-normal text-warn">{missing.length} item{missing.length > 1 ? 's' : ''} needed</span> : undefined}>
          <ul className="space-y-2 pb-2 pt-1">
            {challenge.preparation.map((p, i) => (
              <li key={i} className="flex items-start gap-2.5 text-[13.5px] text-ink-2">
                <span className={clsx('mt-1.5 size-1.5 shrink-0 rounded-full', progress?.prepDone.includes(i) ? 'bg-slate' : 'bg-line-strong')} aria-hidden />
                {p}
              </li>
            ))}
            <li>
              <Link to={`/challenges/${challenge.id}`}>
                <Button size="sm" variant="ghost" className="-ml-3">
                  Open preparation checklist
                </Button>
              </Link>
            </li>
          </ul>
        </Disclosure>
      )}
    </div>
  );
}
