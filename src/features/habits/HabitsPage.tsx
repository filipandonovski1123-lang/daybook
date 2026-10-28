import clsx from 'clsx';
import { ChevronLeft, ChevronRight, EyeOff, Lock, Pencil, Plus } from 'lucide-react';
import { useState } from 'react';
import { Badge, Button, Card, ConfirmDialog, Dialog, Field, Input, PageHeader, SectionTitle, Select, Switch, Textarea } from '../../components/ui';
import { addCustomHabit, deleteHabit, updateHabit } from '../../db/actions';
import { addDays, formatDate } from '../../domain/dates';
import { displayName, entryId, isPlannedOn, WEEKDAY_SHORT } from '../../domain/habits';
import type { Habit, HabitInput } from '../../domain/types';
import { useAction, useApp } from '../../lib/appData';
import { habitGroupsFor } from '../../lib/selectors';
import { HabitRow, habitTargetLabel, SupportNote } from './HabitRow';

const ORDER = [1, 2, 3, 4, 5, 6, 0];
const ROTATION_NOTE: Record<number, string> = {
  1: 'Fitness + quarterback',
  2: 'Mobility + reading',
  3: 'Fitness + finance',
  4: 'Quarterback',
  5: 'Fitness + confidence',
  6: 'Flexible',
  0: 'Recovery + planning',
};

export function HabitsPage() {
  const { data, today } = useApp();
  const [date, setDate] = useState(today);
  const [editing, setEditing] = useState<Habit | null>(null);
  const [adding, setAdding] = useState(false);
  const groups = habitGroupsFor(data.habits, date, false);
  const planned = [...groups.essential, ...groups.scheduled, ...groups.personal, ...groups.evening];
  const toggle = useAction((h: Habit, on: boolean) => updateHabit(h.id, { enabled: on }));
  const min = data.program ? addDays(data.program.startDate, -7) : addDays(today, -60);

  return (
    <div className="space-y-7">
      <PageHeader title="Habits" subtitle="Ambitious but sustainable: essentials daily, the rest rotate through the week." action={<Button size="sm" icon={<Plus className="size-4" />} onClick={() => setAdding(true)}>Add habit</Button>} />

      <section aria-labelledby="log-title">
        <div className="mb-2.5 flex items-center justify-between gap-2">
          <h2 id="log-title" className="text-[13px] font-semibold uppercase tracking-[0.06em] text-ink-3">
            Log {date === today ? 'today' : formatDate(date, 'short')}
          </h2>
          <div className="flex items-center gap-1">
            <Button size="sm" variant="ghost" aria-label="Previous day" disabled={date <= min} onClick={() => setDate(addDays(date, -1))}>
              <ChevronLeft className="size-4" />
            </Button>
            <Input type="date" aria-label="Date to log" className="h-8 w-[150px] text-sm" value={date} min={min} max={today} onChange={(e) => e.target.value && e.target.value <= today && setDate(e.target.value)} />
            <Button size="sm" variant="ghost" aria-label="Next day" disabled={date >= today} onClick={() => setDate(addDays(date, 1))}>
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
        <Card className="px-2 py-2">
          {planned.length ? (
            <ul>
              {planned.map((h) => (
                <HabitRow key={h.id} habit={h} date={date} />
              ))}
            </ul>
          ) : (
            <p className="px-3 py-4 text-sm text-ink-3">Nothing planned for this day.</p>
          )}
          {groups.unplanned.length > 0 && (
            <>
              <p className="px-2 pb-1 pt-3 text-[12px] font-semibold uppercase tracking-wide text-ink-3">Extras (not planned this day)</p>
              <ul>
                {groups.unplanned.map((h) => (
                  <HabitRow key={h.id} habit={h} date={date} unplanned />
                ))}
              </ul>
            </>
          )}
        </Card>
      </section>

      <section aria-labelledby="rotation-title">
        <SectionTitle id="rotation-title">Weekly rotation</SectionTitle>
        <Card className="overflow-x-auto p-3">
          <div className="grid min-w-[560px] grid-cols-7 gap-1.5">
            {ORDER.map((wd) => {
              const items = data.habits.filter((h) => h.enabled && h.section === 'scheduled' && h.days.includes(wd));
              return (
                <div key={wd} className="rounded-lg bg-surface-2 p-2">
                  <p className="text-xs font-semibold">{WEEKDAY_SHORT[wd]}</p>
                  <p className="mb-1.5 text-[10.5px] leading-tight text-ink-3">{ROTATION_NOTE[wd]}</p>
                  <ul className="space-y-1">
                    {items.map((h) => (
                      <li key={h.id} className="truncate rounded bg-surface px-1.5 py-0.5 text-[11px] font-medium">
                        {displayName(h)}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
          <p className="mt-2 px-1 text-xs text-ink-3">Essentials (sleep, reading, focus, room) and habit goals run daily. Edit any habit to change its days. The daily challenge is tracked separately and never moves.</p>
        </Card>
      </section>

      {(['build', 'reduce'] as const).map((kind) => (
        <section key={kind} aria-labelledby={`${kind}-title`}>
          <SectionTitle id={`${kind}-title`}>{kind === 'build' ? 'Habits to build' : 'Habits to reduce'}</SectionTitle>
          <Card className="divide-y divide-line">
            {data.habits
              .filter((h) => h.kind === kind)
              .map((h) => (
                <div key={h.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-1.5 font-medium">
                      <span className={clsx(!h.enabled && 'text-ink-3')}>{displayName(h)}</span>
                      {h.sensitive && <Lock className="size-3.5 text-violet" aria-label="Private" />}
                      {h.visibility === 'hidden' && <EyeOff className="size-3.5 text-ink-3" aria-label="Hidden from Today" />}
                      {habitTargetLabel(h) && <Badge>{habitTargetLabel(h)}</Badge>}
                    </p>
                    <p className="mt-0.5 text-xs text-ink-3">{h.days.length === 7 ? 'Every day' : h.days.length === 0 ? 'Optional only' : ORDER.filter((d) => h.days.includes(d)).map((d) => WEEKDAY_SHORT[d]).join(' · ')}</p>
                    <HabitStrip habit={h} />
                  </div>
                  <Button size="sm" variant="ghost" aria-label={`Edit ${displayName(h)}`} onClick={() => setEditing(h)}>
                    <Pencil className="size-3.5" />
                  </Button>
                  <Switch checked={h.enabled} onChange={(v) => void toggle.run(h, v)} label={<span className="sr-only">Enable {displayName(h)}</span>} />
                </div>
              ))}
          </Card>
        </section>
      ))}

      <HabitEditDialog habit={editing} onClose={() => setEditing(null)} />
      <AddHabitDialog open={adding} onClose={() => setAdding(false)} />
    </div>
  );
}

/** Last 14 days at a glance. Hidden for private habits unless hovered/focused. */
function HabitStrip({ habit }: { habit: Habit }) {
  const { data, today } = useApp();
  const days = Array.from({ length: 14 }, (_, i) => addDays(today, i - 13));
  const color = (d: string) => {
    const e = data.entries.find((x) => x.id === entryId(habit.id, d));
    if (!e) return isPlannedOn(habit, d) && d < today ? 'bg-surface-3' : 'bg-surface-2';
    return e.status === 'done' ? 'bg-success' : e.status === 'partial' ? 'bg-slate' : e.status === 'rest' ? 'bg-info' : 'bg-line-strong';
  };
  return (
    <div className={clsx('mt-2 flex gap-[3px]', habit.sensitive && 'privacy-blur')} tabIndex={habit.sensitive ? 0 : undefined} aria-label={`${displayName(habit)}: last 14 days`} role="img">
      {days.map((d) => (
        <span key={d} title={d} className={clsx('h-2.5 w-2.5 rounded-[3px] sm:w-3', color(d))} />
      ))}
    </div>
  );
}

function DaysPicker({ days, onChange }: { days: number[]; onChange: (d: number[]) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label="Planned days">
      {ORDER.map((d) => {
        const on = days.includes(d);
        return (
          <button key={d} type="button" aria-pressed={on} onClick={() => onChange(on ? days.filter((x) => x !== d) : [...days, d])} className={clsx('h-9 w-11 rounded-lg border text-xs font-semibold transition-colors', on ? 'border-accent bg-surface-2 text-slate' : 'border-line bg-surface-2 text-ink-3 hover:text-ink')}>
            {WEEKDAY_SHORT[d]}
          </button>
        );
      })}
    </div>
  );
}

function HabitEditDialog({ habit, onClose }: { habit: Habit | null; onClose: () => void }) {
  return habit ? <HabitEditForm key={habit.id} habit={habit} onClose={onClose} /> : null;
}

function HabitEditForm({ habit, onClose }: { habit: Habit; onClose: () => void }) {
  const [h, setH] = useState(habit);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const save = useAction(() => updateHabit(habit.id, h), { success: 'Habit updated.' });
  const del = useAction((withEntries: boolean) => deleteHabit(habit.id, withEntries), { success: 'Habit removed.' });
  const numOrNull = (v: string) => (v.trim() === '' ? null : Math.max(0, Number(v)));
  const showTarget = ['minutes', 'sleep', 'count'].includes(h.input);
  const showMax = ['limit', 'sleep'].includes(h.input);
  return (
    <>
      <Dialog
        open
        onClose={onClose}
        title={`Edit ${displayName(habit)}`}
        footer={
          <>
            <Button variant="ghost" className="mr-auto text-danger" onClick={() => setConfirmDelete(true)}>
              Delete
            </Button>
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button
              variant="primary"
              busy={save.busy}
              onClick={async () => {
                if ((await save.run()) !== undefined) onClose();
              }}
            >
              Save
            </Button>
          </>
        }
      >
        <div className="grid gap-4">
          <Field label="Name" htmlFor="he-name">
            <Input id="he-name" value={h.name} maxLength={80} onChange={(e) => setH({ ...h, name: e.target.value })} />
          </Field>
          {!h.sensitive && (
            <Field label="Description" htmlFor="he-desc">
              <Textarea id="he-desc" value={h.description} maxLength={1000} onChange={(e) => setH({ ...h, description: e.target.value })} className="min-h-[60px]" />
            </Field>
          )}
          {h.kind === 'reduce' && (
            <Field label={h.sensitive ? 'Your goal, in your own words (private)' : 'What exactly are you reducing? (optional)'} htmlFor="he-def" hint={h.sensitive ? 'Keep it general. Only you see this, and it never appears in notifications or progress charts.' : undefined}>
              <Textarea id="he-def" value={h.definition} maxLength={500} onChange={(e) => setH({ ...h, definition: e.target.value })} className="min-h-[60px]" />
            </Field>
          )}
          <div>
            <p className="mb-1.5 text-[13px] font-medium text-ink-2">Planned days</p>
            <DaysPicker days={h.days} onChange={(days) => setH({ ...h, days })} />
          </div>
          {(showTarget || showMax) && (
            <div className="grid grid-cols-2 gap-3">
              {showTarget && (
                <Field label={h.input === 'sleep' ? 'Minimum hours' : `Target${h.unit ? ` (${h.unit})` : ''}`} htmlFor="he-target">
                  <Input id="he-target" type="number" min={0} step={h.input === 'sleep' ? 0.5 : 1} value={h.target ?? ''} onChange={(e) => setH({ ...h, target: numOrNull(e.target.value) })} />
                </Field>
              )}
              {showMax && (
                <Field label={h.input === 'sleep' ? 'Up to (hours)' : 'Daily budget (min)'} htmlFor="he-max">
                  <Input id="he-max" type="number" min={0} value={h.targetMax ?? ''} onChange={(e) => setH({ ...h, targetMax: numOrNull(e.target.value) })} />
                </Field>
              )}
            </div>
          )}
          {h.id === 'phone' && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Phone-free period 1" htmlFor="he-p1">
                <Input id="he-p1" value={h.config.period1 ?? ''} maxLength={40} onChange={(e) => setH({ ...h, config: { ...h.config, period1: e.target.value } })} />
              </Field>
              <Field label="Phone-free period 2" htmlFor="he-p2">
                <Input id="he-p2" value={h.config.period2 ?? ''} maxLength={40} onChange={(e) => setH({ ...h, config: { ...h.config, period2: e.target.value } })} />
              </Field>
            </div>
          )}
          <Field label="Section on Today" htmlFor="he-section">
            <Select id="he-section" value={h.section} onChange={(e) => setH({ ...h, section: e.target.value as Habit['section'] })}>
              <option value="essential">Essentials</option>
              <option value="scheduled">Scheduled activities</option>
              <option value="personal">Personal habit goals</option>
              <option value="evening">Evening routine</option>
            </Select>
          </Field>
          <Field label="Visibility" htmlFor="he-vis" hint="Discreet shows a neutral label everywhere outside this screen. Hidden keeps it off the Today screen.">
            <Select id="he-vis" value={h.visibility} onChange={(e) => setH({ ...h, visibility: e.target.value as Habit['visibility'] })}>
              <option value="normal">Normal</option>
              <option value="discreet">Discreet label</option>
              <option value="hidden">Hidden from Today</option>
            </Select>
          </Field>
          {h.visibility !== 'normal' && (
            <Field label="Discreet label" htmlFor="he-discreet">
              <Input id="he-discreet" value={h.discreetName ?? ''} maxLength={80} placeholder="Personal habit goal" onChange={(e) => setH({ ...h, discreetName: e.target.value || null })} />
            </Field>
          )}
          {h.sensitive && <SupportNote />}
        </div>
      </Dialog>
      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Delete this habit?"
        tone="danger"
        confirmLabel="Delete habit and its log"
        onConfirm={async () => {
          setConfirmDelete(false);
          if ((await del.run(true)) !== undefined) onClose();
        }}
      >
        This permanently removes the habit and every logged entry for it. To keep the history, turn the habit off instead.
      </ConfirmDialog>
    </>
  );
}

const INPUT_OPTIONS: { value: HabitInput; label: string }[] = [
  { value: 'check', label: 'Checkbox' },
  { value: 'minutes', label: 'Minutes (target)' },
  { value: 'limit', label: 'Minutes (budget / max)' },
  { value: 'yesno', label: 'Yes / no' },
  { value: 'text', label: 'Short note' },
];

function AddHabitDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [name, setName] = useState('');
  const [input, setInput] = useState<HabitInput>('check');
  const [days, setDays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);
  const [target, setTarget] = useState('15');
  const add = useAction(
    () =>
      addCustomHabit({
        name: name.trim(),
        input,
        kind: input === 'limit' ? 'reduce' : 'build',
        section: input === 'limit' ? 'personal' : 'scheduled',
        days,
        target: input === 'minutes' ? Number(target) || 10 : null,
        targetMax: input === 'limit' ? Number(target) || 30 : null,
        unit: input === 'minutes' || input === 'limit' ? 'min' : null,
      }),
    { success: 'Habit added.' },
  );
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Add a habit"
      size="sm"
      footer={
        <Button
          variant="primary"
          busy={add.busy}
          disabled={!name.trim() || !days.length}
          onClick={async () => {
            if (await add.run()) {
              setName('');
              onClose();
            }
          }}
        >
          Add
        </Button>
      }
    >
      <div className="grid gap-4">
        <Field label="Name" htmlFor="ah-name">
          <Input id="ah-name" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="How it’s tracked" htmlFor="ah-input">
          <Select id="ah-input" value={input} onChange={(e) => setInput(e.target.value as HabitInput)}>
            {INPUT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </Field>
        {(input === 'minutes' || input === 'limit') && (
          <Field label={input === 'limit' ? 'Daily budget (min)' : 'Target (min)'} htmlFor="ah-target">
            <Input id="ah-target" type="number" min={1} value={target} onChange={(e) => setTarget(e.target.value)} />
          </Field>
        )}
        <div>
          <p className="mb-1.5 text-[13px] font-medium text-ink-2">Planned days</p>
          <DaysPicker days={days} onChange={setDays} />
        </div>
      </div>
    </Dialog>
  );
}
