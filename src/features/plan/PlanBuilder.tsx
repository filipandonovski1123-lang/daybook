import clsx from 'clsx';
import { Lock, Search, Shuffle, Wrench } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Badge, Button, Dialog, Difficulty, Input, Segmented } from '../../components/ui';
import { getLibraryItem, LIBRARY, SIGNATURE_PLAN, THEMES, type LibraryItem } from '../../data/library';
import { addDays, formatDate } from '../../domain/dates';
import { generatePlan, LENGTH_PRESETS, sortByDifficulty } from '../../domain/planner';
import { MAX_PROGRAM_DAYS, MIN_PROGRAM_DAYS, type ChallengeTheme } from '../../domain/types';

export interface PlanDraft {
  length: number;
  mode: 'signature' | 'auto';
  themes: ChallengeTheme[];
  plan: string[];
  seed: number;
}

/** Build the plan for a draft's settings. Signature mode always means the 30-day Signature plan. */
export function buildPlan(d: Omit<PlanDraft, 'plan'>, equipment: readonly string[]): string[] {
  if (d.mode === 'signature') return [...SIGNATURE_PLAN];
  return generatePlan(LIBRARY, { length: d.length, themes: d.themes, equipment, seed: d.seed });
}

export function newDraft(equipment: readonly string[], length = 30): PlanDraft {
  const base = { length, mode: 'auto' as const, themes: [] as ChallengeTheme[], seed: Math.floor(Math.random() * 1e9) };
  return { ...base, plan: buildPlan(base, equipment) };
}

const fmtHours = (m: number) => (m < 60 ? `${m} min` : `${Math.round((m / 60) * 4) / 4} h`);

/** Length, style and interests, plus the day-by-day plan with per-day swapping. */
export function PlanBuilder({ draft, onChange, equipment, startDate }: { draft: PlanDraft; onChange: (d: PlanDraft) => void; equipment: readonly string[]; startDate?: string }) {
  const [custom, setCustom] = useState(() => (LENGTH_PRESETS.includes(draft.length as (typeof LENGTH_PRESETS)[number]) ? '' : String(draft.length)));
  const update = (patch: Partial<Omit<PlanDraft, 'plan'>>) => {
    const next = { ...draft, ...patch };
    if (patch.mode === 'signature') next.length = 30;
    onChange({ ...next, plan: buildPlan(next, equipment) });
  };
  const setLength = (n: number) => {
    if (!Number.isFinite(n)) return;
    const len = Math.min(MAX_PROGRAM_DAYS, Math.max(MIN_PROGRAM_DAYS, Math.round(n)));
    update({ length: len, mode: len === 30 ? draft.mode : 'auto' });
  };

  return (
    <div className="space-y-6">
      <section>
        <h3 className="font-display text-[18px]">How many days?</h3>
        <div className="mt-3 flex flex-wrap items-center gap-2" role="radiogroup" aria-label="Program length">
          {LENGTH_PRESETS.map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={draft.length === n && !custom}
              onClick={() => {
                setCustom('');
                setLength(n);
              }}
              className={clsx('h-10 min-w-12 rounded-lg border px-3 text-sm font-medium transition-colors', draft.length === n && !custom ? 'border-slate bg-slate text-white dark:text-[#14181c]' : 'border-line bg-surface hover:border-line-strong')}
            >
              {n}
            </button>
          ))}
          <label className="flex items-center gap-2 text-sm text-ink-2">
            or
            <Input
              type="number"
              inputMode="numeric"
              aria-label="Custom number of days"
              min={MIN_PROGRAM_DAYS}
              max={MAX_PROGRAM_DAYS}
              placeholder="custom"
              value={custom}
              className="h-10 w-24"
              onChange={(e) => setCustom(e.target.value)}
              onBlur={() => custom && setLength(Number(custom))}
              onKeyDown={(e) => e.key === 'Enter' && custom && setLength(Number(custom))}
            />
            days
          </label>
        </div>
        <p className="mt-2 text-xs text-ink-3">
          {MIN_PROGRAM_DAYS}–{MAX_PROGRAM_DAYS} days, one challenge a day.
          {startDate ? ` Day ${draft.plan.length} would be ${formatDate(addDays(startDate, draft.plan.length - 1))}.` : ''}
        </p>
      </section>

      <section>
        <h3 className="font-display text-[18px]">Who picks the challenges?</h3>
        <div className="mt-3 grid gap-2.5 sm:grid-cols-2" role="radiogroup" aria-label="Plan style">
          <StyleCard selected={draft.mode === 'auto'} onSelect={() => update({ mode: 'auto' })} title="Choose for me" body="A plan from the library that gets harder every day, matched to your interests and equipment." />
          <StyleCard selected={draft.mode === 'signature'} onSelect={() => update({ mode: 'signature' })} title="Signature 30" body="The hand-built 30-day program: juggling on Day 1 through a Megaminx on Day 30." />
        </div>
        <p className="mt-2 text-xs text-ink-3">Either way, you can swap any day for something else from the library.</p>
      </section>

      {draft.mode === 'auto' && (
        <section>
          <div className="flex items-baseline justify-between gap-3">
            <h3 className="font-display text-[18px]">What interests you?</h3>
            <span className="text-xs text-ink-3">{draft.themes.length ? `${draft.themes.length} selected` : 'Everything'}</span>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {THEMES.map((t) => {
              const on = draft.themes.includes(t.id);
              return (
                <button
                  key={t.id}
                  type="button"
                  aria-pressed={on}
                  title={t.hint}
                  onClick={() => update({ themes: on ? draft.themes.filter((x) => x !== t.id) : [...draft.themes, t.id] })}
                  className={clsx('rounded-full border px-3.5 py-1.5 text-[13px] transition-colors', on ? 'border-slate bg-slate-soft text-slate' : 'border-line bg-surface text-ink-2 hover:text-ink')}
                >
                  {t.label}
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-xs text-ink-3">Leave all unselected for a bit of everything. Other areas fill in if there aren’t enough matches.</p>
        </section>
      )}

      <section>
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-display text-[18px]">Your plan</h3>
          {draft.mode === 'auto' && (
            <Button size="sm" icon={<Shuffle className="size-3.5" />} onClick={() => update({ seed: Math.floor(Math.random() * 1e9) })}>
              Shuffle
            </Button>
          )}
        </div>
        <p className="mt-1 text-xs text-ink-3">Easiest first — each day is as hard as or harder than the one before.</p>
        <PlanList
          plan={draft.plan}
          equipment={equipment}
          className="mt-3 max-h-[440px] overflow-y-auto"
          onSwap={(day, id) => {
            const next = [...draft.plan];
            next[day - 1] = id;
            const items = next.map((x) => getLibraryItem(x)).filter((x): x is LibraryItem => !!x);
            onChange({ ...draft, plan: sortByDifficulty(items).map((i) => i.id) });
          }}
        />
      </section>
    </div>
  );
}

function StyleCard({ selected, onSelect, title, body }: { selected: boolean; onSelect: () => void; title: string; body: string }) {
  return (
    <button type="button" role="radio" aria-checked={selected} aria-label={`${title}: ${body}`} onClick={onSelect} className={clsx('rounded-xl border p-4 text-left transition-colors', selected ? 'border-slate bg-slate-soft' : 'border-line bg-surface hover:border-line-strong')}>
      <span className="flex items-center gap-2">
        <span className={clsx('flex size-4 items-center justify-center rounded-full border', selected ? 'border-slate' : 'border-line-strong')}>{selected && <span className="size-2 rounded-full bg-slate" />}</span>
        <span className="font-medium">{title}</span>
      </span>
      <span className="mt-1.5 block pl-6 text-[13px] leading-relaxed text-ink-2">{body}</span>
    </button>
  );
}

/**
 * Day-by-day list of a plan. `locked(day)` marks days that can't change (already started).
 * Swapping opens the library picker.
 */
export function PlanList({ plan, equipment, onSwap, locked, className }: { plan: string[]; equipment: readonly string[]; onSwap: (day: number, libraryId: string) => void; locked?: (day: number) => boolean; className?: string }) {
  const [swapDay, setSwapDay] = useState<number | null>(null);
  const has = new Set(equipment);
  return (
    <>
      <ol className={clsx('divide-y divide-line rounded-xl border border-line bg-surface', className)}>
        {plan.map((id, i) => {
          const item = getLibraryItem(id);
          if (!item) return null;
          const missing = item.equipment.filter((e) => !has.has(e));
          const isLocked = locked?.(i + 1) ?? false;
          return (
            <li key={`${i}-${id}`} className="flex items-center gap-3 px-3.5 py-3">
              <span className="font-display tnum w-7 shrink-0 text-center text-[17px] text-ink-3">{i + 1}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14px]">{item.title}</span>
                <span className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11.5px] text-ink-3">
                  <span>{item.category}</span>
                  <Difficulty value={item.difficulty} />
                  <span>~{fmtHours(item.estimatedMinutes)}</span>
                  {missing.length > 0 && (
                    <span className="inline-flex items-center gap-1 text-warn">
                      <Wrench className="size-3" aria-hidden /> needs equipment
                    </span>
                  )}
                </span>
              </span>
              {isLocked ? (
                <Lock className="size-4 shrink-0 text-ink-3" aria-label="Started — can’t be swapped" />
              ) : (
                <Button size="sm" variant="ghost" onClick={() => setSwapDay(i + 1)} aria-label={`Swap day ${i + 1}: ${item.title}`}>
                  Swap
                </Button>
              )}
            </li>
          );
        })}
      </ol>
      <LibraryPicker
        open={swapDay !== null}
        title={swapDay ? `Choose a challenge for Day ${swapDay}` : ''}
        exclude={plan.filter((_, i) => i + 1 !== swapDay)}
        current={swapDay ? plan[swapDay - 1] : undefined}
        equipment={equipment}
        onClose={() => setSwapDay(null)}
        onPick={(id) => {
          if (swapDay) onSwap(swapDay, id);
          setSwapDay(null);
        }}
      />
    </>
  );
}

/** Searchable, filterable list of every library challenge. */
export function LibraryPicker({ open, title, exclude, current, equipment, onClose, onPick }: { open: boolean; title: string; exclude: readonly string[]; current?: string; equipment: readonly string[]; onClose: () => void; onPick: (id: string) => void }) {
  return open ? <PickerBody title={title} exclude={exclude} current={current} equipment={equipment} onClose={onClose} onPick={onPick} /> : null;
}

function PickerBody({ title, exclude, current, equipment, onClose, onPick }: { title: string; exclude: readonly string[]; current?: string; equipment: readonly string[]; onClose: () => void; onPick: (id: string) => void }) {
  const [q, setQ] = useState('');
  const [theme, setTheme] = useState<ChallengeTheme | 'all'>('all');
  const [level, setLevel] = useState<'all' | '1' | '2' | '3' | '4' | '5'>('all');
  const excluded = useMemo(() => new Set(exclude), [exclude]);
  const has = new Set(equipment);
  const items = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return sortByDifficulty(
      LIBRARY.filter((i) => (theme === 'all' || i.theme === theme) && (level === 'all' || i.difficulty === Number(level)) && (!needle || `${i.title} ${i.category} ${i.objective}`.toLowerCase().includes(needle))),
    );
  }, [q, theme, level]);
  return (
    <Dialog open onClose={onClose} title={title} size="lg">
      <div className="space-y-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" aria-hidden />
          <Input autoFocus aria-label="Search challenges" placeholder={`Search ${LIBRARY.length} challenges`} value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
        </div>
        <div className="scrollbar-none -mx-1 flex max-w-full items-center gap-2 overflow-x-auto px-1">
          <Segmented
            label="Interest"
            size="sm"
            value={theme}
            onChange={setTheme}
            options={[{ value: 'all' as const, label: 'All' }, ...THEMES.map((t) => ({ value: t.id, label: t.label }))]}
          />
          <Segmented label="Difficulty" size="sm" value={level} onChange={setLevel} options={[{ value: 'all', label: 'Any' }, ...(['1', '2', '3', '4', '5'] as const).map((n) => ({ value: n, label: n }))]} />
        </div>
        <p className="text-xs text-ink-3">{items.length} challenges · difficulty 1 (gentle) to 5 (demanding)</p>
        <ul className="divide-y divide-line rounded-xl border border-line">
          {items.map((i) => {
            const taken = excluded.has(i.id);
            const missing = i.equipment.filter((e) => !has.has(e));
            return (
              <li key={i.id}>
                <button type="button" disabled={taken} onClick={() => onPick(i.id)} className={clsx('flex w-full items-start gap-3 px-3.5 py-3 text-left transition-colors hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-45', i.id === current && 'bg-slate-soft')}>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2 text-[14px]">
                      {i.title}
                      {i.id === current && <Badge tone="info">Current</Badge>}
                      {taken && <Badge>In plan</Badge>}
                    </span>
                    <span className="mt-0.5 block text-[12.5px] leading-snug text-ink-2">{i.objective}</span>
                    <span className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11.5px] text-ink-3">
                      <span>{i.category}</span>
                      <Difficulty value={i.difficulty} />
                      <span>~{fmtHours(i.estimatedMinutes)}</span>
                      {missing.length > 0 && <span className="text-warn">needs equipment</span>}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </Dialog>
  );
}
