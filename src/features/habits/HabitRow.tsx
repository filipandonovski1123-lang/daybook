import clsx from 'clsx';
import { Check, ChevronDown, Circle, CircleHelp, Lock, Minus, Moon, Timer } from 'lucide-react';
import { useId, useState } from 'react';
import { Link } from 'react-router';
import { Badge, Button, Field, Input, Textarea } from '../../components/ui';
import { clearHabitEntry, logHabit } from '../../db/actions';
import { formatTime, hoursBetween } from '../../domain/dates';
import { displayName, entryId } from '../../domain/habits';
import type { Habit, HabitEntry, HabitEntryStatus, IsoDate } from '../../domain/types';
import { useAction, useApp } from '../../lib/appData';

const STATUS_STYLE: Record<HabitEntryStatus, string> = {
  done: 'border-success bg-success text-[#04150d]',
  partial: 'border-accent bg-accent-soft text-accent',
  missed: 'border-line-strong bg-surface-3 text-ink-3',
  skipped: 'border-line-strong bg-surface-3 text-ink-3',
  rest: 'border-info bg-info-soft text-info',
};

export function habitTargetLabel(h: Habit): string {
  switch (h.input) {
    case 'minutes':
      return `${h.target ?? 0} min`;
    case 'sleep':
      return `${h.target ?? 8}${h.targetMax ? `–${h.targetMax}` : ''} h`;
    case 'limit':
      return `≤ ${h.targetMax ?? 0} min`;
    case 'count':
      return `${h.target ?? 1} ${h.unit ?? ''}`.trim();
    default:
      return '';
  }
}

function entrySummary(h: Habit, e: HabitEntry | undefined): string | null {
  if (!e) return null;
  if (h.sensitive) return e.status === 'done' ? 'Logged' : 'Logged — be kind to yourself';
  if (e.status === 'skipped') return 'Skipped';
  switch (h.input) {
    case 'minutes':
      return `${e.value ?? 0} / ${h.target} min${e.extra.book ? ` · ${e.extra.book}` : ''}`;
    case 'sleep':
      return `${e.value ?? '?'} h${e.extra.bed && e.extra.wake ? ` · ${formatTime(e.extra.bed)}–${formatTime(e.extra.wake)}` : ''}`;
    case 'limit':
      return `${e.value ?? 0} min of ${h.targetMax}`;
    case 'count':
      return `${e.value ?? 0} / ${h.target}`;
    case 'yesno':
      return e.status === 'done' ? 'Yes' : 'Not today';
    case 'activity':
    case 'awareness':
      return e.text || null;
    case 'text':
      return e.text || null;
    case 'check':
      return e.status === 'done' ? 'Done' : null;
    case 'private':
      return null;
  }
}

/**
 * One habit for one date. The circle is a one-tap action where it makes sense (tick, done target,
 * yes); everything else opens the inline editor. Never more than one tap away from logging.
 */
export function HabitRow({ habit, date, unplanned = false }: { habit: Habit; date: IsoDate; unplanned?: boolean }) {
  const { data } = useApp();
  const entry = data.entries.find((e) => e.id === entryId(habit.id, date));
  const [open, setOpen] = useState(false);
  const editorId = useId();
  const log = useAction((input: Parameters<typeof logHabit>[2]) => logHabit(habit.id, date, input));
  const name = displayName(habit);
  const summary = entrySummary(habit, entry);

  const quick = (): Parameters<typeof logHabit>[2] | null => {
    switch (habit.input) {
      case 'check':
        return { done: entry?.status !== 'done' };
      case 'minutes':
        return entry?.status === 'done' ? { status: null, value: null } : { value: habit.target ?? 0 };
      case 'yesno':
        return entry ? { status: null } : { yes: true };
      case 'count':
        return entry?.status === 'done' ? { status: null, value: null } : { value: habit.target ?? 1 };
      default:
        return null;
    }
  };
  const q = quick();
  const status = entry?.status;

  return (
    <li className={clsx('group rounded-xl transition-colors', open && 'bg-surface-2/70')}>
      <div className="flex items-center gap-3 px-2 py-2">
        <button
          type="button"
          onClick={() => (q ? void log.run(q) : setOpen(true))}
          aria-label={q ? `${status === 'done' ? 'Undo' : 'Complete'} ${name}` : `Log ${name}`}
          aria-pressed={q ? status === 'done' : undefined}
          disabled={log.busy}
          className={clsx('flex size-8 shrink-0 items-center justify-center rounded-full border-2 transition-colors', status ? STATUS_STYLE[status] : 'border-line-strong text-transparent hover:border-success hover:text-success/60')}
        >
          {status === 'done' && <Check className="animate-check size-4" strokeWidth={3} />}
          {status === 'partial' && <Minus className="size-4" strokeWidth={3} />}
          {status === 'rest' && <Moon className="size-3.5" />}
          {(status === 'missed' || status === 'skipped') && <Circle className="size-2.5" fill="currentColor" />}
          {!status && <Check className="size-4" strokeWidth={3} />}
        </button>
        <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setOpen(!open)} aria-expanded={open} aria-controls={editorId}>
          <span className="flex items-center gap-2">
            <span className={clsx('truncate text-[15px] font-medium', status === 'done' && 'text-ink-2')}>{name}</span>
            {habit.sensitive && <Lock className="size-3.5 shrink-0 text-violet" aria-label="Private" />}
            {unplanned && <Badge>Extra</Badge>}
          </span>
          <span className="block truncate text-xs text-ink-3">{summary ?? (habitTargetLabel(habit) || (habit.input === 'text' ? 'Write what you did' : habit.input === 'yesno' ? 'Yes or not today' : 'Tap to log'))}</span>
        </button>
        <ChevronDown className={clsx('size-4 shrink-0 text-ink-3 transition-transform', open && 'rotate-180')} aria-hidden onClick={() => setOpen(!open)} />
      </div>
      <div id={editorId} hidden={!open} className="px-2 pb-3 pl-[52px]">
        {open && <HabitEditor habit={habit} entry={entry} busy={log.busy} onSave={async (input) => void (await log.run(input))} date={date} />}
      </div>
    </li>
  );
}

function HabitEditor({ habit, entry, onSave, busy, date }: { habit: Habit; entry: HabitEntry | undefined; onSave: (input: Parameters<typeof logHabit>[2]) => Promise<void>; busy: boolean; date: IsoDate }) {
  const clear = useAction(() => clearHabitEntry(habit.id, date), { success: 'Cleared.' });
  const [value, setValue] = useState(entry?.value?.toString() ?? '');
  const [text, setText] = useState(entry?.text ?? '');
  const [notes, setNotes] = useState(entry?.notes ?? '');
  const [extra, setExtra] = useState<Record<string, string>>(entry?.extra ?? {});
  const [synced, setSynced] = useState(entry?.updatedAt);
  if (synced !== entry?.updatedAt) {
    setSynced(entry?.updatedAt);
    setValue(entry?.value?.toString() ?? '');
    setText(entry?.text ?? '');
    setExtra(entry?.extra ?? {});
  }
  const num = value.trim() === '' ? null : Number(value);
  const id = useId();
  const footer = (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      {entry && (
        <Button size="sm" variant="ghost" onClick={() => void clear.run()}>
          Clear
        </Button>
      )}
      {!habit.sensitive && entry?.status !== 'skipped' && (
        <Button size="sm" variant="ghost" onClick={() => void onSave({ status: 'skipped', notes })}>
          Not today
        </Button>
      )}
    </div>
  );

  const numberField = (label: string, unit: string, presets: number[]) => (
    <div>
      <div className="flex flex-wrap items-end gap-2">
        <Field label={label} htmlFor={`${id}-v`} className="w-28">
          <Input id={`${id}-v`} type="number" inputMode="numeric" min={0} max={1440} value={value} onChange={(e) => setValue(e.target.value)} />
        </Field>
        <span className="pb-2.5 text-sm text-ink-3">{unit}</span>
        <Button size="md" variant="primary" busy={busy} disabled={num === null || Number.isNaN(num) || num < 0} onClick={() => void onSave({ value: num, extra, notes })}>
          Save
        </Button>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {presets.map((p) => (
          <Button key={p} size="sm" onClick={() => void onSave({ value: p, extra, notes })}>
            {p} {unit}
          </Button>
        ))}
      </div>
    </div>
  );

  const notesField = (
    <Field label="Note (optional)" htmlFor={`${id}-n`} className="mt-3">
      <Input id={`${id}-n`} value={notes} maxLength={2000} onChange={(e) => setNotes(e.target.value)} onBlur={() => entry && notes !== entry.notes && void onSave({ ...(entryToInput(habit, entry)), notes })} />
    </Field>
  );

  return (
    <div className="text-sm">
      {habit.description && !habit.sensitive && <p className="mb-3 text-xs leading-relaxed text-ink-3">{habit.description}</p>}
      {habit.input === 'check' && (
        <Button variant={entry?.status === 'done' ? 'secondary' : 'success'} size="sm" onClick={() => void onSave({ done: entry?.status !== 'done', notes })}>
          {entry?.status === 'done' ? 'Mark not done' : 'Mark done'}
        </Button>
      )}
      {habit.input === 'minutes' && (
        <>
          {numberField('Minutes', 'min', [Math.round((habit.target ?? 10) / 2), habit.target ?? 10, Math.round((habit.target ?? 10) * 1.5)])}
          {habit.id === 'reading' && (
            <Field label="Book (optional)" htmlFor={`${id}-b`} className="mt-3">
              <Input id={`${id}-b`} value={extra.book ?? ''} maxLength={200} onChange={(e) => setExtra({ ...extra, book: e.target.value })} />
            </Field>
          )}
          {habit.id === 'focus' && (
            <Link to="/tools/focus" className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline">
              <Timer className="size-4" /> Open focus timer
            </Link>
          )}
        </>
      )}
      {habit.input === 'sleep' && <SleepEditor habit={habit} entry={entry} onSave={(v, bed, wake) => onSave({ value: v, extra: { ...extra, bed, wake }, notes })} busy={busy} />}
      {habit.input === 'limit' && numberField('Minutes spent', 'min', [0, Math.round((habit.targetMax ?? 30) / 2), habit.targetMax ?? 30])}
      {habit.input === 'count' && (
        <div>
          <p className="mb-2 text-xs text-ink-3">
            Periods: {habit.config.period1 ?? '—'} and {habit.config.period2 ?? '—'}
          </p>
          <div className="flex gap-1.5">
            {Array.from({ length: (habit.target ?? 2) + 1 }, (_, n) => (
              <Button key={n} size="sm" variant={entry?.value === n ? 'primary' : 'secondary'} onClick={() => void onSave({ value: n, notes })}>
                {n} of {habit.target}
              </Button>
            ))}
          </div>
        </div>
      )}
      {habit.input === 'yesno' && (
        <div className="flex gap-2">
          <Button size="sm" variant={entry?.status === 'done' ? 'success' : 'secondary'} onClick={() => void onSave({ yes: true, notes })}>
            Yes
          </Button>
          <Button size="sm" variant={entry?.status === 'missed' ? 'primary' : 'secondary'} onClick={() => void onSave({ yes: false, notes })}>
            Not today
          </Button>
        </div>
      )}
      {(habit.input === 'activity' || habit.input === 'awareness') && (
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={displayName(habit)}>
          {habit.options.map((o) => (
            <Button key={o} size="sm" role="radio" aria-checked={entry?.text === o} variant={entry?.text === o ? 'primary' : 'secondary'} onClick={() => void onSave({ option: o, notes })}>
              {o}
            </Button>
          ))}
        </div>
      )}
      {habit.input === 'text' && (
        <div>
          <Textarea value={text} maxLength={1000} onChange={(e) => setText(e.target.value)} placeholder="What did you attempt?" aria-label="What did you attempt?" className="min-h-[64px]" />
          <Button size="sm" variant="primary" className="mt-2" busy={busy} disabled={!text.trim()} onClick={() => void onSave({ text, notes })}>
            Save
          </Button>
        </div>
      )}
      {habit.input === 'private' && <PrivateEditor habit={habit} entry={entry} onSave={onSave} />}
      {habit.input !== 'private' && notesField}
      {footer}
    </div>
  );
}

function entryToInput(h: Habit, e: HabitEntry): Parameters<typeof logHabit>[2] {
  switch (h.input) {
    case 'activity':
    case 'awareness':
    case 'private':
      return { option: e.text };
    case 'text':
      return { text: e.text };
    case 'yesno':
      return { yes: e.status === 'done' };
    case 'check':
      return { done: e.status === 'done' };
    default:
      return { value: e.value };
  }
}

function SleepEditor({ habit, entry, onSave, busy }: { habit: Habit; entry: HabitEntry | undefined; onSave: (hours: number, bed: string, wake: string) => Promise<void>; busy: boolean }) {
  const { data } = useApp();
  const [bed, setBed] = useState(entry?.extra.bed ?? data.settings.bedtime);
  const [wake, setWake] = useState(entry?.extra.wake ?? data.settings.wakeTime);
  const hours = hoursBetween(bed, wake);
  const id = useId();
  return (
    <div>
      <p className="mb-2 text-xs text-ink-3">Last night. Target {habit.target}–{habit.targetMax} h.</p>
      <div className="flex flex-wrap items-end gap-2">
        <Field label="Went to sleep" htmlFor={`${id}-bed`} className="w-32">
          <Input id={`${id}-bed`} type="time" value={bed} onChange={(e) => setBed(e.target.value)} />
        </Field>
        <Field label="Woke up" htmlFor={`${id}-wake`} className="w-32">
          <Input id={`${id}-wake`} type="time" value={wake} onChange={(e) => setWake(e.target.value)} />
        </Field>
        <div className="pb-2 text-sm">
          <span className="tnum font-semibold">{hours} h</span>
        </div>
        <Button variant="primary" busy={busy} onClick={() => void onSave(hours, bed, wake)}>
          Save
        </Button>
      </div>
    </div>
  );
}

/** Private habit goal: neutral language, general progress only, support always one tap away. */
function PrivateEditor({ habit, entry, onSave }: { habit: Habit; entry: HabitEntry | undefined; onSave: (input: Parameters<typeof logHabit>[2]) => Promise<void> }) {
  const [trigger, setTrigger] = useState(entry?.extra.trigger ?? '');
  const [coping, setCoping] = useState(entry?.extra.coping ?? '');
  const [showSupport, setShowSupport] = useState(false);
  const id = useId();
  return (
    <div className="privacy-blur" tabIndex={0}>
      <p className="mb-2 text-xs leading-relaxed text-ink-3">{habit.definition ? `Your goal: ${habit.definition}` : 'Define this goal in your own words under Habits → Personal habit goal.'}</p>
      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="How did today go?">
        {habit.options.map((o) => (
          <Button key={o} size="sm" role="radio" aria-checked={entry?.text === o} variant={entry?.text === o ? 'primary' : 'secondary'} onClick={() => void onSave({ option: o, extra: { trigger, coping } })}>
            {o}
          </Button>
        ))}
      </div>
      {entry?.text === habit.options[2] && <p className="mt-2 text-xs leading-relaxed text-ink-2">That’s useful information, not a verdict. What helped last time it went well?</p>}
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Field label="Trigger (optional, general)" htmlFor={`${id}-t`}>
          <Input id={`${id}-t`} value={trigger} maxLength={200} placeholder="e.g. late night, bored, stressed" onChange={(e) => setTrigger(e.target.value)} onBlur={() => entry && void onSave({ option: entry.text, extra: { trigger, coping } })} />
        </Field>
        <Field label="What helped / coping strategy" htmlFor={`${id}-c`}>
          <Input id={`${id}-c`} value={coping} maxLength={200} placeholder="e.g. phone out of room, went for a walk" onChange={(e) => setCoping(e.target.value)} onBlur={() => entry && void onSave({ option: entry.text, extra: { trigger, coping } })} />
        </Field>
      </div>
      <button type="button" className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-ink-2 hover:text-ink" onClick={() => setShowSupport(!showSupport)} aria-expanded={showSupport}>
        <CircleHelp className="size-3.5" /> Finding this hard to control?
      </button>
      {showSupport && <SupportNote />}
    </div>
  );
}

export function SupportNote() {
  return (
    <div className="mt-2 rounded-xl border border-line bg-surface p-3 text-xs leading-relaxed text-ink-2">
      <p>If this is causing you real distress or feels out of your control, you don’t have to handle it alone. Talking to a trusted adult, your GP, or a counsellor genuinely helps, and it’s a common thing for them to hear.</p>
      <p className="mt-1.5">In Australia: Kids Helpline 1800 55 1800 (ages 5–25, 24/7) · Lifeline 13 11 14 · headspace.org.au. In an emergency call 000.</p>
    </div>
  );
}
