import { ChevronRight, List, ListChecks, NotebookPen, Settings, Target, Timer } from 'lucide-react';
import { Link } from 'react-router';
import { PageHeader } from '../../components/ui';

const ITEMS = [
  { to: '/challenge', label: 'Today’s challenge', hint: 'Detail, measurements and evidence', icon: Target },
  { to: '/habits', label: 'Habits', hint: 'Weekly rotation, targets and history', icon: ListChecks },
  { to: '/reflection', label: 'Reflections', hint: 'Evening check-in and journal', icon: NotebookPen },
  { to: '/calendar', label: 'All challenges', hint: 'Calendar and list of the 30 days', icon: List },
  { to: '/tools', label: 'Tools', hint: 'Focus timer, tests and stopwatches', icon: Timer },
  { to: '/settings', label: 'Settings', hint: 'Reminders, Hard Mode, data', icon: Settings },
] as const;

export function MorePage() {
  return (
    <div>
      <PageHeader title="More" />
      <ul className="divide-y divide-line border-y border-line">
        {ITEMS.map((i) => (
          <li key={i.to}>
            <Link to={i.to} className="flex items-center gap-4 py-4">
              <span className="flex size-9 items-center justify-center rounded-md bg-surface-2 text-ink-2">
                <i.icon className="size-[18px]" strokeWidth={1.6} aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[15px]">{i.label}</span>
                <span className="block text-[12.5px] text-ink-3">{i.hint}</span>
              </span>
              <ChevronRight className="size-4 text-ink-3" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
