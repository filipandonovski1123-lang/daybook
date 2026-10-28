import { CalendarClock, ChevronRight, Moon } from 'lucide-react';
import { Link } from 'react-router';
import { Button } from '../../components/ui';
import { rescheduleChallenge } from '../../db/actions';
import { useAction, useApp } from '../../lib/appData';
import { useProgramView } from '../../lib/selectors';
import { StatusBadge } from '../challenges/shared';

/** On a rest day: catch up on anything missed or only attempted, or simply rest. */
export function RestDayPanel() {
  const { data, today } = useApp();
  const view = useProgramView();
  const catchUp = useAction((id: string) => rescheduleChallenge(id, today), { success: 'Moved to today. Go get it.' });
  if (!view) return null;
  const open = data.challenges.filter((c) => {
    const s = view.statuses.get(c.id);
    return s === 'missed' || s === 'attempted';
  });
  return (
    <div className="mt-5">
      {open.length === 0 ? (
        <p className="flex items-center gap-2 text-[14px] text-ink-2">
          <Moon className="size-4 text-slate" aria-hidden /> Nothing to catch up on. Rest properly — it’s part of the plan.
        </p>
      ) : (
        <>
          <p className="mb-3 text-[13.5px] text-ink-2">Catch up on one of these, or rest. Either is a good use of today.</p>
          <ul className="divide-y divide-line rounded-xl border border-line bg-surface">
            {open.map((c) => {
              const s = view.statuses.get(c.id) ?? 'missed';
              return (
                <li key={c.id} className="flex items-center gap-3 px-4 py-3">
                  <Link to={`/challenges/${c.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                    <span className="font-display tnum w-7 text-center text-[17px] text-ink-3">{c.day}</span>
                    <span className="min-w-0 flex-1 truncate text-[14px]">{c.title}</span>
                    <StatusBadge status={s} />
                    <ChevronRight className="size-4 text-ink-3" aria-hidden />
                  </Link>
                  <Button size="sm" icon={<CalendarClock className="size-3.5" />} busy={catchUp.busy} onClick={() => void catchUp.run(c.id)}>
                    Do it today
                  </Button>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
