import clsx from 'clsx';
import { CalendarDays, ChevronLeft, ChevronRight, List } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { QuoteCard } from '../../components/Scene';
import { quoteFor } from '../../data/quotes';
import { addDays, formatDate, parseIso, toIso, weekdayOf } from '../../domain/dates';
import { programDayFor, STATUS_LABEL } from '../../domain/schedule';
import type { DisplayStatus, IsoDate } from '../../domain/types';
import { useApp } from '../../lib/appData';
import { useProgramView } from '../../lib/selectors';
import { StatusBadge } from './shared';
import { challengeLabel } from '../../data/tracks';

/** Circle treatment per status — the calendar's whole visual language. */
const CIRCLE: Record<DisplayStatus, string> = {
  completed: 'bg-slate text-white dark:text-[#14181c]',
  attempted: 'bg-slate-soft text-slate',
  in_progress: 'bg-surface text-ink border-[1.5px] border-slate',
  available: 'bg-surface text-ink border-[2.5px] border-slate',
  upcoming: 'bg-surface-3 text-ink-2',
  missed: 'bg-surface text-danger border border-danger/45',
  rescheduled: 'bg-surface text-ink-2 border border-dashed border-line-strong',
  rest: 'bg-transparent text-ink-3 border border-dotted border-line-strong',
};

const LEGEND_ORDER: DisplayStatus[] = ['completed', 'available', 'upcoming', 'in_progress', 'attempted', 'missed', 'rescheduled', 'rest'];
const LEGEND_LABEL: Partial<Record<DisplayStatus, string>> = { available: 'Today' };

const monthKey = (d: IsoDate) => d.slice(0, 7);
const firstOfMonth = (key: string): IsoDate => `${key}-01`;
function shiftMonth(key: string, by: number): string {
  const { year, month } = parseIso(firstOfMonth(key));
  const m = month - 1 + by;
  return toIso(year + Math.floor(m / 12), ((m % 12) + 12) % 12 + 1, 1).slice(0, 7);
}
const monthTitle = (key: string) => new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(Date.UTC(Number(key.slice(0, 4)), Number(key.slice(5, 7)) - 1, 1));

export function ChallengesPage() {
  const view = useProgramView();
  const { data, today } = useApp();
  const [mode, setMode] = useState<'calendar' | 'list'>(() => {
    try {
      return localStorage.getItem('challengesView') === 'list' ? 'list' : 'calendar';
    } catch {
      return 'calendar';
    }
  });
  const firstMonth = view ? monthKey(view.startDate) : monthKey(today);
  const lastMonth = view ? monthKey(view.endDate) : monthKey(today);
  const initial = monthKey(today) < firstMonth ? firstMonth : monthKey(today) > lastMonth ? lastMonth : monthKey(today);
  const [month, setMonthRaw] = useState(initial);
  const [monthDir, setMonthDir] = useState<'next' | 'prev' | null>(null);
  const setMonth = (m: string) => {
    setMonthDir(m > month ? 'next' : 'prev');
    setMonthRaw(m);
  };
  if (!view) return null;

  const toggle = () => {
    const m = mode === 'calendar' ? 'list' : 'calendar';
    setMode(m);
    try {
      localStorage.setItem('challengesView', m);
    } catch {
      /* ignore */
    }
  };

  const first = firstOfMonth(month);
  const lead = (weekdayOf(first) + 6) % 7; // Monday-first
  const { year, month: mm } = parseIso(first);
  const daysInMonth = new Date(Date.UTC(year, mm, 0)).getUTCDate();
  const byDate = new Map<IsoDate, (typeof data.challenges)[number]>();
  for (const c of data.challenges) byDate.set(view.originalDateOf(c), c);
  const present = new Set(view.statuses.values());
  // Hide whole weeks before the program starts / after it ends (the month still reads correctly).
  const cells = lead + daysInMonth;
  const weekHasProgram = (w: number) => Array.from({ length: 7 }, (_, k) => w * 7 + k - lead).some((i) => i >= 0 && i < daysInMonth && byDate.has(addDays(first, i)));
  const weeks = Math.ceil(cells / 7);
  let firstWeek = 0;
  while (firstWeek < weeks - 1 && !weekHasProgram(firstWeek)) firstWeek++;
  let lastWeek = weeks - 1;
  while (lastWeek > firstWeek && !weekHasProgram(lastWeek)) lastWeek--;
  const skipDays = firstWeek * 7;
  const trimDays = Math.max(0, cells - (lastWeek + 1) * 7);

  return (
    <div>
      <h1 className="sr-only">Challenge calendar</h1>
      <div className="mb-1 hidden items-center justify-between md:flex">
        <p className="font-display text-[26px]">Challenge Calendar</p>
      </div>

      <div className={clsx('md:rounded-xl md:border md:border-line md:bg-surface md:p-6')}>
        <div className="flex items-center justify-between">
          <h2 className="font-display text-[26px] md:text-[20px]">{mode === 'calendar' ? monthTitle(month) : `All ${view.length} challenges`}</h2>
          <div className="flex items-center gap-1">
            {mode === 'calendar' && (
              <>
                <button type="button" aria-label="Previous month" disabled={month <= firstMonth} onClick={() => setMonth(shiftMonth(month, -1))} className="rounded p-1.5 text-ink-2 hover:text-ink disabled:opacity-30">
                  <ChevronLeft className="size-[18px]" strokeWidth={1.6} />
                </button>
                <button type="button" aria-label="Next month" disabled={month >= lastMonth} onClick={() => setMonth(shiftMonth(month, 1))} className="rounded p-1.5 text-ink-2 hover:text-ink disabled:opacity-30">
                  <ChevronRight className="size-[18px]" strokeWidth={1.6} />
                </button>
              </>
            )}
            <button type="button" onClick={toggle} aria-label={mode === 'calendar' ? 'Show as list' : 'Show as calendar'} className="ml-1 rounded p-1.5 text-ink-2 hover:text-ink">
              {mode === 'calendar' ? <List className="size-[18px]" strokeWidth={1.6} /> : <CalendarDays className="size-[18px]" strokeWidth={1.6} />}
            </button>
          </div>
        </div>
        <p className="mt-1 text-[12.5px] text-ink-3">
          {view.counts.completed} completed · {view.counts.attempted} attempted · {view.counts.missed} missed · {formatDate(view.startDate, 'dm')} – {formatDate(view.endDate, 'dm')}
        </p>

        {mode === 'calendar' ? (
          <>
            <div className="mt-6 grid grid-cols-7 text-center text-[11.5px] text-ink-3" aria-hidden>
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
                <span key={d}>{d}</span>
              ))}
            </div>
            <ol key={month} className={clsx('mt-3 grid grid-cols-7 gap-y-3', monthDir && (monthDir === 'next' ? 'animate-slide-next' : 'animate-slide-prev'))} aria-label={`${monthTitle(month)} calendar`}>
              {Array.from({ length: lead - skipDays }, (_, i) => (
                <li key={`pad-${i}`} aria-hidden />
              ))}
              {Array.from({ length: daysInMonth }, (_, i) => i)
                .filter((i) => i >= skipDays - lead && i < daysInMonth - trimDays)
                .map((i) => {
                const date = addDays(first, i);
                const c = byDate.get(date);
                const dom = i + 1;
                if (!c)
                  return (
                    <li key={date} className="flex justify-center">
                      <span className={clsx('animate-cell flex size-10 items-center justify-center text-[13px] md:size-11', date === today ? 'font-semibold text-ink' : 'text-ink-3/60')} style={{ ['--i' as string]: i }}>
                        {dom}
                      </span>
                    </li>
                  );
                const s = view.statuses.get(c.id) ?? 'upcoming';
                const isTodayCell = date === today;
                const cls = isTodayCell && s !== 'completed' && s !== 'attempted' ? CIRCLE.available : CIRCLE[s];
                return (
                  <li key={date} className="flex justify-center">
                    <Link
                      to={`/challenges/${c.id}`}
                      aria-label={`${formatDate(date, 'short')}, Day ${c.day} of ${view.length}: ${c.title}. ${STATUS_LABEL[s]}`}
                      className={clsx('animate-cell tnum flex size-10 items-center justify-center rounded-full text-[13.5px] transition-transform duration-150 hover:scale-105 active:scale-90 md:size-11', cls)}
                      style={{ ['--i' as string]: i }}
                    >
                      {dom}
                    </Link>
                  </li>
                );
              })}
            </ol>
            <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-[12px] text-ink-2" aria-label="Legend">
              {LEGEND_ORDER.filter((s) => s === 'completed' || s === 'available' || s === 'upcoming' || present.has(s)).map((s) => (
                <li key={s} className="flex items-center gap-1.5">
                  <span className={clsx('size-3.5 rounded-full', CIRCLE[s], s === 'available' && '!border-2')} aria-hidden />
                  {LEGEND_LABEL[s] ?? STATUS_LABEL[s]}
                </li>
              ))}
            </ul>
            <p className="mt-3 text-[12px] text-ink-3">Tap a day for its challenge. Days outside the program are faded.</p>
          </>
        ) : (
          <ol className="mt-4 divide-y divide-line border-t border-line">
            {data.challenges.map((c) => {
              const s = view.statuses.get(c.id) ?? 'upcoming';
              const date = view.dateOf(c);
              const p = data.progress.get(c.id);
              return (
                <li key={c.id}>
                  <Link to={`/challenges/${c.id}`} className={clsx('flex items-center gap-3 py-3.5', date === today && 'bg-surface-2/60')}>
                    <span className={clsx('tnum flex size-9 shrink-0 items-center justify-center rounded-full text-[12.5px]', CIRCLE[s])}>{c.day}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14.5px]">{c.title}</span>
                      <span className="block text-[12px] text-ink-3">
                        {challengeLabel(c)} · {formatDate(date, 'short')}
                        {p?.rescheduledTo ? ` · was ${formatDate(view.originalDateOf(c), 'dm')}` : ''}
                      </span>
                    </span>
                    <StatusBadge status={s} />
                  </Link>
                </li>
              );
            })}
          </ol>
        )}
      </div>

      <QuoteCard quote={quoteFor(programDayFor(view.startDate, today) + 1)} scene="ridge" className="mt-8" />
    </div>
  );
}
