import clsx from 'clsx';
import { ArrowRight, Bell, CalendarClock, ChevronRight, Hourglass, MoonStar, PartyPopper, ShieldAlert, Sparkles, Target, Timer, Trophy, Wrench, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { Badge, Button, Card, Difficulty, Disclosure, ProgressBar, ProgressRing, SectionTitle } from '../../components/ui';
import { EQUIPMENT } from '../../data/challenges';
import { togglePrep } from '../../db/actions';
import { endOfDayEpoch, formatDate, nowTimeIn } from '../../domain/dates';
import { dayAdherence } from '../../domain/habits';
import { challengeNudge } from '../../domain/messages';
import { PROGRAM_DAYS } from '../../domain/schedule';
import type { Challenge } from '../../domain/types';
import { useAction, useApp, useNow } from '../../lib/appData';
import { useReminders } from '../../lib/reminderScheduler';
import { habitGroupsFor, useProgramView, useStatusOf, type ProgramView } from '../../lib/selectors';
import { ChallengeActions, EstTime, StatusBadge } from '../challenges/shared';
import { HabitRow } from '../habits/HabitRow';
import { EveningCheckin } from './EveningCheckin';
import { MissedAcknowledgement } from './MissedAcknowledgement';

export function TodayPage() {
  const { data, today } = useApp();
  const view = useProgramView();
  if (!view) return null;
  const greeting = greetingFor(nowTimeIn(data.settings.timezone));
  const name = data.settings.displayName;
  const hard = data.settings.hardMode;

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-medium text-ink-3">{formatDate(today)}</p>
          <h1 className="mt-0.5 text-[28px] font-bold leading-tight tracking-tight md:text-[32px]">
            {view.phase === 'active' ? `Day ${view.day}` : view.phase === 'before' ? `${greeting}${name ? `, ${name}` : ''}` : 'Program complete'}
            {view.phase === 'active' && <span className="text-ink-3"> / {PROGRAM_DAYS}</span>}
          </h1>
          {view.phase === 'active' && (
            <p className="mt-1 text-sm text-ink-2">
              {greeting}
              {name ? `, ${name}` : ''}. {view.counts.completed} completed · {view.counts.attempted} attempted{view.counts.missed ? ` · ${view.counts.missed} missed` : ''}
            </p>
          )}
        </div>
        <Link to="/tools" className="mt-1 hidden rounded-lg p-2 text-ink-3 hover:bg-surface-2 hover:text-ink sm:block" aria-label="Tools and timers" title="Tools and timers">
          <Timer className="size-5" />
        </Link>
        {view.phase === 'active' && (
          <ProgressRing value={view.day / PROGRAM_DAYS} size={60} stroke={5} label={`Day ${view.day} of ${PROGRAM_DAYS}`}>
            <span className="tnum text-sm font-bold">{Math.round((view.day / PROGRAM_DAYS) * 100)}%</span>
          </ProgressRing>
        )}
      </header>

      <ReminderBanners />
      {hard && view.phase === 'active' && <HardModeBar view={view} />}
      {view.unacknowledgedMissed.length > 0 && <MissedAcknowledgement challenges={view.unacknowledgedMissed} required={hard} />}

      {view.phase === 'before' && <BeforeStart view={view} />}
      {view.phase === 'after' && <AfterProgram view={view} />}
      {view.todayChallenge && <ChallengeHero challenge={view.todayChallenge} />}
      {view.catchUps.length > 0 && (
        <section aria-labelledby="catchup-title">
          <SectionTitle id="catchup-title">Rescheduled to today</SectionTitle>
          <div className="space-y-2">
            {view.catchUps.map((c) => (
              <MiniChallenge key={c.id} challenge={c} />
            ))}
          </div>
        </section>
      )}

      <HabitChecklist />

      {view.tomorrowChallenge && view.phase !== 'after' && (
        <section aria-labelledby="tomorrow-title">
          <SectionTitle id="tomorrow-title">Tomorrow</SectionTitle>
          <MiniChallenge challenge={view.tomorrowChallenge} showPrep />
        </section>
      )}
    </div>
  );
}

function greetingFor(time: string) {
  const h = Number(time.slice(0, 2));
  return h < 5 ? 'Late night' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

function ReminderBanners() {
  const { inApp, dismiss } = useReminders();
  if (!inApp.length) return null;
  return (
    <div className="space-y-2" aria-live="polite">
      {inApp.map((r) => (
        <div key={r.key} className="animate-fade-up flex items-start gap-3 rounded-xl border border-info/30 bg-info-soft px-4 py-3">
          <Bell className="mt-0.5 size-4 shrink-0 text-info" aria-hidden />
          <div className="min-w-0 flex-1 text-sm">
            <p className="font-semibold text-ink">{r.title}</p>
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

function HardModeBar({ view }: { view: ProgramView }) {
  const { data, today } = useApp();
  const now = useNow(15_000);
  const left = Math.max(0, endOfDayEpoch(today, data.settings.timezone) - now);
  const h = Math.floor(left / 3_600_000);
  const m = Math.floor((left % 3_600_000) / 60_000);
  const adherence = dayAdherence(data.habits, data.entries, today);
  const challengeOpen = view.todayChallenge && !['completed', 'attempted'].includes(view.statuses.get(view.todayChallenge.id) ?? '');
  const open = adherence.planned - adherence.done + (challengeOpen ? 1 : 0) + view.catchUps.length;
  return (
    <Card className="flex items-center gap-4 border-accent/30 px-4 py-3">
      <Hourglass className="size-5 shrink-0 text-accent" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">
          <span className="tnum">
            {h} h {String(m).padStart(2, '0')} min
          </span>{' '}
          left today
        </p>
        <p className="text-xs text-ink-3">{open > 0 ? `${open} commitment${open > 1 ? 's' : ''} still open.` : 'Every planned commitment for today is closed out.'}</p>
      </div>
      <Badge tone="accent" icon={<ShieldAlert className="size-3" />}>
        Hard Mode
      </Badge>
    </Card>
  );
}

function ChallengeHero({ challenge }: { challenge: Challenge }) {
  const { data, today, now } = useApp();
  const status = useStatusOf(challenge);
  const progress = data.progress.get(challenge.id);
  const hard = data.settings.hardMode;
  const hoursLeft = (endOfDayEpoch(today, data.settings.timezone) - now) / 3_600_000;
  const nudge = challengeNudge(status, hard, challenge.day, hoursLeft);
  const isFinal = challenge.day === PROGRAM_DAYS;
  return (
    <Card className="hero-glow overflow-hidden p-5 md:p-6">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Badge tone="accent">Day {challenge.day}</Badge>
        <Badge>{challenge.category}</Badge>
        <StatusBadge status={status} />
        {isFinal && <Badge tone="violet">Final boss</Badge>}
        <span className="ml-auto">
          <Difficulty value={challenge.difficulty} />
        </span>
      </div>
      <h2 className="text-[22px] font-bold leading-tight tracking-tight md:text-2xl">{challenge.title}</h2>
      <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-ink-2">{challenge.description}</p>
      <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-line bg-surface-2/70 p-3">
        <Target className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />
        <div className="min-w-0 text-sm">
          <p className="font-medium">{challenge.objective}</p>
          {challenge.bonus && <p className="mt-1 text-xs text-ink-3">Bonus: {challenge.bonus}</p>}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1">
        <EstTime minutes={challenge.estimatedMinutes} />
        {progress?.startedAt && <span className="text-xs text-ink-3">{progress.history.filter((h) => h.action === 'started' || h.action === 'resumed').length} session(s)</span>}
        {progress?.rescheduledTo && <span className="text-xs text-warn">Rescheduled</span>}
      </div>
      {nudge && <p className={clsx('mt-3 text-sm font-medium', hard ? 'text-accent' : 'text-ink-2')}>{nudge}</p>}
      <div className="mt-5 flex flex-wrap items-center gap-2">
        <ChallengeActions challenge={challenge} compact />
        <Link to={`/challenges/${challenge.id}`} className="ml-auto inline-flex items-center gap-1 text-sm font-medium text-accent hover:underline">
          Log & details <ArrowRight className="size-4" />
        </Link>
      </div>
      {isFinal && <p className="mt-4 text-xs text-ink-3">Final day reached. This challenge stands on its own — finishing it records Day 30, nothing else.</p>}
    </Card>
  );
}

function MiniChallenge({ challenge, showPrep = false, prepLabel = 'Prepare for tomorrow' }: { challenge: Challenge; showPrep?: boolean; prepLabel?: string }) {
  const { data } = useApp();
  const status = useStatusOf(challenge);
  const progress = data.progress.get(challenge.id);
  const missing = challenge.equipment.filter((e) => !data.settings.equipment.includes(e));
  const prep = useAction((i: number, on: boolean) => togglePrep(challenge.id, i, on));
  return (
    <Card className="p-4">
      <Link to={`/challenges/${challenge.id}`} className="flex items-center gap-3">
        <div className="flex size-10 shrink-0 flex-col items-center justify-center rounded-lg bg-surface-2">
          <span className="text-[9px] font-semibold uppercase leading-none text-ink-3">Day</span>
          <span className="tnum text-[15px] font-bold leading-tight">{challenge.day}</span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{challenge.title}</p>
          <p className="flex items-center gap-2 text-xs text-ink-3">
            {challenge.category} · <EstTime minutes={challenge.estimatedMinutes} />
          </p>
        </div>
        <StatusBadge status={status} />
        <ChevronRight className="size-4 text-ink-3" aria-hidden />
      </Link>
      {showPrep && challenge.preparation.length > 0 && (
        <Disclosure className="mt-2 border-t border-line pt-1" summary={<span className="text-[13px]">{prepLabel}</span>} badge={missing.length ? <Badge tone="warn">{missing.length} item{missing.length > 1 ? 's' : ''} missing</Badge> : undefined}>
          <ul className="space-y-2 pb-1 pt-1">
            {challenge.preparation.map((p, i) => (
              <li key={i}>
                <label className="flex items-start gap-2.5 text-sm">
                  <input type="checkbox" className="mt-0.5 size-4 accent-[var(--success)]" checked={progress?.prepDone.includes(i) ?? false} onChange={(e) => void prep.run(i, e.target.checked)} />
                  <span>{p}</span>
                </label>
              </li>
            ))}
          </ul>
          {missing.length > 0 && (
            <p className="mt-2 flex items-start gap-1.5 text-xs text-warn">
              <Wrench className="mt-px size-3.5 shrink-0" aria-hidden /> You marked as not available: {missing.map((m) => EQUIPMENT[m] ?? m).join(', ')}.
            </p>
          )}
        </Disclosure>
      )}
    </Card>
  );
}

function HabitChecklist() {
  const { data, today } = useApp();
  const groups = useMemo(() => habitGroupsFor(data.habits, today, data.settings.hideSensitiveOnToday), [data.habits, today, data.settings.hideSensitiveOnToday]);
  const adherence = dayAdherence(data.habits, data.entries, today);
  const [checkinOpen, setCheckinOpen] = useState(false);
  const reflection = data.reflections.find((r) => r.date === today);
  const sections = [
    { key: 'essential', title: 'Essentials', items: groups.essential },
    { key: 'scheduled', title: 'Today’s scheduled activities', items: groups.scheduled },
    { key: 'personal', title: 'Personal habit goals', items: groups.personal },
    { key: 'evening', title: 'Evening routine', items: groups.evening },
  ] as const;

  return (
    <section aria-labelledby="habits-title" className="space-y-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 id="habits-title" className="text-lg font-bold tracking-tight">
            Daily habits
          </h2>
          <p className="text-xs text-ink-3">
            {adherence.planned ? `${adherence.done} of ${adherence.planned} planned done` : 'Nothing planned today'}
          </p>
        </div>
        <div className="w-28">
          <ProgressBar value={adherence.rate ?? 0} tone="success" label="Habits completed today" />
        </div>
      </div>
      {sections.map((s) =>
        s.items.length || s.key === 'evening' ? (
          <Card key={s.key} className="px-2 py-2">
            <h3 className="px-2 pb-1 pt-1.5 text-[12px] font-semibold uppercase tracking-[0.06em] text-ink-3">{s.title}</h3>
            <ul>
              {s.items.map((h) => (
                <HabitRow key={h.id} habit={h} date={today} />
              ))}
            </ul>
            {s.key === 'evening' && (
              <button type="button" onClick={() => setCheckinOpen(true)} className="mt-1 flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-surface-2/70">
                <span className={clsx('flex size-8 shrink-0 items-center justify-center rounded-full border-2', reflection?.updatedAt ? 'border-success bg-success text-[#04150d]' : 'border-line-strong text-ink-3')}>
                  <MoonStar className="size-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-medium">Evening check-in</span>
                  <span className="block text-xs text-ink-3">{reflection?.updatedAt ? 'Saved — tap to edit' : 'Optional · five quick questions'}</span>
                </span>
                <ChevronRight className="size-4 text-ink-3" aria-hidden />
              </button>
            )}
          </Card>
        ) : null,
      )}
      {groups.unplanned.length > 0 && (
        <Card className="px-4 py-1">
          <Disclosure summary={<span className="text-[13px] text-ink-2">Not planned today ({groups.unplanned.length})</span>}>
            <p className="px-0 pb-1 text-xs text-ink-3">Log any of these as extras. They’re recorded but don’t change today’s adherence.</p>
            <ul className="-mx-2 pb-2">
              {groups.unplanned.map((h) => (
                <HabitRow key={h.id} habit={h} date={today} unplanned />
              ))}
            </ul>
          </Disclosure>
        </Card>
      )}
      <EveningCheckin open={checkinOpen} onClose={() => setCheckinOpen(false)} date={today} />
    </section>
  );
}

function BeforeStart({ view }: { view: ProgramView }) {
  const { data } = useApp();
  const first = data.challenges[0];
  const days = 1 - view.dayRaw;
  const missingTotal = new Set(data.challenges.flatMap((c) => c.equipment).filter((e) => !data.settings.equipment.includes(e)));
  return (
    <Card className="hero-glow p-5 md:p-6">
      <div className="mb-3 flex items-center gap-2 text-accent">
        <Sparkles className="size-4" aria-hidden />
        <p className="text-sm font-semibold">
          Starts in {days} day{days > 1 ? 's' : ''} · {formatDate(view.startDate, 'short')}
        </p>
      </div>
      <h2 className="text-2xl font-bold tracking-tight">Get ready for Day 1</h2>
      <p className="mt-1.5 text-sm leading-relaxed text-ink-2">Habits can be logged from today if you want a head start. Challenges unlock on their scheduled dates.</p>
      {missingTotal.size > 0 && (
        <p className="mt-3 flex items-start gap-2 rounded-xl bg-warn-soft p-3 text-xs text-warn">
          <Wrench className="mt-px size-3.5 shrink-0" aria-hidden />
          {missingTotal.size} equipment item{missingTotal.size > 1 ? 's' : ''} across the program you said you don’t have yet. Each challenge’s preparation list shows what’s needed.
        </p>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        <Link to="/challenges">
          <Button variant="primary" icon={<CalendarClock className="size-4" />}>
            See the 30-day plan
          </Button>
        </Link>
      </div>
      {first && (
        <div className="mt-5">
          <MiniChallenge challenge={first} showPrep prepLabel="Preparation checklist" />
        </div>
      )}
    </Card>
  );
}

function AfterProgram({ view }: { view: ProgramView }) {
  const { data } = useApp();
  const done = view.counts.completed;
  const open = data.challenges.filter((c) => !['completed', 'attempted'].includes(view.statuses.get(c.id) ?? ''));
  return (
    <Card className="hero-glow p-5 md:p-6">
      <div className="mb-3 flex items-center gap-2 text-accent">
        {done === PROGRAM_DAYS ? <PartyPopper className="size-5" /> : <Trophy className="size-5" />}
        <p className="text-sm font-semibold">The 30 days are over</p>
      </div>
      <h2 className="text-2xl font-bold tracking-tight">
        {done} of 30 completed{view.counts.attempted ? `, ${view.counts.attempted} attempted` : ''}
      </h2>
      <p className="mt-1.5 text-sm leading-relaxed text-ink-2">
        {done === PROGRAM_DAYS ? 'Every challenge, completed. That’s the record — it’s yours.' : `${open.length} challenge${open.length === 1 ? '' : 's'} still open. You can keep working on any of them; they’ll be recorded with their actual completion dates.`}
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Link to="/progress">
          <Button variant="primary">Review your progress</Button>
        </Link>
        <Link to="/challenges">
          <Button>All challenges</Button>
        </Link>
      </div>
      {open.length > 0 && <p className="mt-3 text-xs text-ink-3">Open: {open.slice(0, 6).map((c) => `Day ${c.day}`).join(', ')}{open.length > 6 ? '…' : ''}</p>}
    </Card>
  );
}
