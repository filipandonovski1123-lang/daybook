import clsx from 'clsx';
import { ChevronRight, Wrench } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { Badge, Card, Difficulty, PageHeader, Segmented } from '../../components/ui';
import { formatDate, weekdayOf } from '../../domain/dates';
import { STATUS_LABEL } from '../../domain/schedule';
import type { DisplayStatus } from '../../domain/types';
import { useApp } from '../../lib/appData';
import { useProgramView } from '../../lib/selectors';
import { EstTime, STATUS_ICON, StatusBadge } from './shared';

const CELL_STYLE: Record<DisplayStatus, string> = {
  upcoming: 'border-line bg-surface',
  available: 'border-accent bg-accent-soft ring-1 ring-accent/40',
  in_progress: 'border-info/60 bg-info-soft',
  completed: 'border-success/50 bg-success-soft',
  attempted: 'border-violet/50 bg-violet-soft',
  missed: 'border-danger/40 bg-danger-soft',
  rescheduled: 'border-warn/50 bg-warn-soft',
};
const ICON_COLOR: Record<DisplayStatus, string> = {
  upcoming: 'text-ink-3',
  available: 'text-accent',
  in_progress: 'text-info',
  completed: 'text-success',
  attempted: 'text-violet',
  missed: 'text-danger',
  rescheduled: 'text-warn',
};

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
  const changeMode = (m: 'calendar' | 'list') => {
    setMode(m);
    try {
      localStorage.setItem('challengesView', m);
    } catch {
      /* ignore */
    }
  };
  if (!view) return null;
  const leading = (weekdayOf(view.startDate) + 6) % 7; // Monday-first grid

  return (
    <div>
      <PageHeader
        title="Challenges"
        subtitle={`${formatDate(view.startDate, 'dm')} – ${formatDate(view.endDate, 'dm')} · ${view.counts.completed} completed · ${view.counts.attempted} attempted · ${view.counts.missed} missed`}
        action={
          <Segmented
            label="View"
            value={mode}
            onChange={changeMode}
            size="sm"
            options={[
              { value: 'calendar', label: 'Calendar' },
              { value: 'list', label: 'List' },
            ]}
          />
        }
      />

      {mode === 'calendar' ? (
        <>
          <div className="mb-2 grid grid-cols-7 gap-1.5 text-center text-[11px] font-semibold uppercase tracking-wide text-ink-3" aria-hidden>
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
              <span key={d}>{d}</span>
            ))}
          </div>
          <ol className="grid grid-cols-7 gap-1.5" aria-label="30-day calendar">
            {Array.from({ length: leading }, (_, i) => (
              <li key={`pad-${i}`} aria-hidden />
            ))}
            {data.challenges.map((c) => {
              const s = view.statuses.get(c.id) ?? 'upcoming';
              const Icon = STATUS_ICON[s];
              const date = view.originalDateOf(c);
              const isToday = date === today;
              return (
                <li key={c.id}>
                  <Link
                    to={`/challenges/${c.id}`}
                    aria-label={`Day ${c.day}, ${formatDate(date, 'short')}: ${c.title}. ${STATUS_LABEL[s]}`}
                    className={clsx('group flex aspect-square min-h-[52px] flex-col justify-between rounded-[10px] border p-1.5 transition-transform hover:-translate-y-px sm:p-2', CELL_STYLE[s], isToday && 'outline outline-2 outline-offset-1 outline-accent')}
                  >
                    <span className="flex items-start justify-between">
                      <span className="tnum text-[13px] font-bold leading-none sm:text-base">{c.day}</span>
                      <Icon className={clsx('size-3 sm:size-3.5', ICON_COLOR[s])} aria-hidden />
                    </span>
                    <span className="hidden truncate text-[10px] font-medium leading-tight text-ink-2 sm:block">{c.category}</span>
                    <span className="tnum text-[9.5px] leading-none text-ink-3 sm:text-[10px]">{formatDate(date, 'dm')}</span>
                  </Link>
                </li>
              );
            })}
          </ol>
          <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-xs text-ink-2" aria-label="Legend">
            {(Object.keys(STATUS_LABEL) as DisplayStatus[]).map((s) => {
              const Icon = STATUS_ICON[s];
              return (
                <li key={s} className="flex items-center gap-1.5">
                  <Icon className={clsx('size-3.5', ICON_COLOR[s])} aria-hidden />
                  {STATUS_LABEL[s]}
                </li>
              );
            })}
          </ul>
        </>
      ) : (
        <Card className="divide-y divide-line">
          <ol>
            {data.challenges.map((c) => {
              const s = view.statuses.get(c.id) ?? 'upcoming';
              const date = view.dateOf(c);
              const missing = c.equipment.filter((e) => !data.settings.equipment.includes(e)).length;
              const p = data.progress.get(c.id);
              return (
                <li key={c.id} className="border-b border-line last:border-0">
                  <Link to={`/challenges/${c.id}`} className={clsx('flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-2/60', date === today && 'bg-accent-soft/40')}>
                    <div className="flex w-10 shrink-0 flex-col items-center">
                      <span className="text-[9px] font-semibold uppercase text-ink-3">Day</span>
                      <span className="tnum text-lg font-bold leading-none">{c.day}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{c.title}</p>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-3">
                        <span>{c.category}</span>
                        <span>{formatDate(date, 'short')}</span>
                        {p?.rescheduledTo && <span className="text-warn">was {formatDate(view.originalDateOf(c), 'dm')}</span>}
                        <EstTime minutes={c.estimatedMinutes} />
                        <Difficulty value={c.difficulty} />
                        {missing > 0 && (
                          <Badge tone="warn" icon={<Wrench className="size-3" />}>
                            {missing} needed
                          </Badge>
                        )}
                      </div>
                    </div>
                    <StatusBadge status={s} />
                    <ChevronRight className="size-4 shrink-0 text-ink-3" aria-hidden />
                  </Link>
                </li>
              );
            })}
          </ol>
        </Card>
      )}
    </div>
  );
}
