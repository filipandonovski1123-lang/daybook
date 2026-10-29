import clsx from 'clsx';
import { Lock, Moon, Plus, Search, Shuffle, Wrench } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Badge, Button, Dialog, Difficulty, Input, Segmented } from '../../components/ui';
import { SIGNATURE_PLAN, THEMES, type LibraryItem } from '../../data/library';
import { RECOMMENDED_TRACKS, TRACKS } from '../../data/tracks';
import { addDays, formatDate } from '../../domain/dates';
import { growthPlan, type TimeBudget, type WildcardRate } from '../../domain/growth';
import { generatePlan, LENGTH_PRESETS, REST_ID, sortByDifficulty, withRestDays } from '../../domain/planner';
import { MAX_PROGRAM_DAYS, MIN_PROGRAM_DAYS, type ChallengeTheme, type DifficultyCurve, type LifeStage } from '../../domain/types';
import { useLibrary } from '../../lib/library';
import { CustomChallengeDialog } from '../library/CustomChallengeDialog';

export interface PlanDraft {
  length: number;
  mode: 'signature' | 'auto' | 'growth';
  themes: ChallengeTheme[];
  curve: DifficultyCurve;
  restEvery: number;
  tracks: string[];
  timeBudget: TimeBudget;
  wildcards: WildcardRate;
  includeFun: boolean;
  plan: string[];
  seed: number;
}

type Library = ReturnType<typeof useLibrary>;

/** Build the plan for a draft's settings. Signature mode is the Signature 30 (plus any rest days). */
export function buildPlan(d: Omit<PlanDraft, 'plan'>, equipment: readonly string[], library: readonly LibraryItem[]): string[] {
  if (d.mode === 'signature') return withRestDays(SIGNATURE_PLAN, d.restEvery);
  if (d.mode === 'growth')
    return growthPlan(library, { length: d.length, tracks: d.tracks, timeBudget: d.timeBudget, wildcards: d.wildcards, includeFun: d.includeFun, curve: d.curve, restEvery: d.restEvery, equipment, seed: d.seed });
  return generatePlan(library, { length: d.length, themes: d.themes, equipment, seed: d.seed, curve: d.curve, restEvery: d.restEvery });
}

export function newDraft(equipment: readonly string[], library: readonly LibraryItem[], stage: LifeStage = 'early', length = 30): PlanDraft {
  const base = {
    length,
    mode: 'growth' as const,
    themes: [] as ChallengeTheme[],
    curve: 'steady' as const,
    restEvery: 0,
    tracks: [...RECOMMENDED_TRACKS[stage]],
    timeBudget: 'medium' as const,
    wildcards: 'some' as const,
    includeFun: true,
    seed: Math.floor(Math.random() * 1e9),
  };
  return { ...base, plan: buildPlan(base, equipment, library) };
}

/** Re-sort the challenges easiest-first while leaving rest days in their slots. */
export function resortKeepingRest(plan: readonly string[], get: Library['get']): string[] {
  const challenges = sortByDifficulty(plan.filter((id) => id !== REST_ID).map((id) => get(id)).filter((x): x is LibraryItem => !!x)).map((i) => i.id);
  let next = 0;
  return plan.map((id) => (id === REST_ID ? id : (challenges[next++] ?? id)));
}

const fmtHours = (m: number) => (m < 60 ? `${m} min` : `${Math.round((m / 60) * 4) / 4} h`);

function Chips<T extends string | number>({ label, value, options, onChange }: { label: string; value: T; options: { value: T; label: string; hint?: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="mt-3 flex flex-wrap gap-2" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          title={o.hint}
          onClick={() => onChange(o.value)}
          className={clsx('rounded-full border px-3.5 py-1.5 text-[13px] transition-colors', value === o.value ? 'border-slate bg-slate-soft text-slate' : 'border-line bg-surface text-ink-2 hover:text-ink')}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Length, style, curve, rest days and interests, plus the day-by-day plan with per-day swapping. */
export function PlanBuilder({ draft, onChange, equipment, startDate, stage = 'early' }: { draft: PlanDraft; onChange: (d: PlanDraft) => void; equipment: readonly string[]; startDate?: string; stage?: LifeStage }) {
  const lib = useLibrary();
  const [custom, setCustom] = useState(() => (LENGTH_PRESETS.includes(draft.length as (typeof LENGTH_PRESETS)[number]) ? '' : String(draft.length)));
  const update = (patch: Partial<Omit<PlanDraft, 'plan'>>) => {
    const next = { ...draft, ...patch };
    onChange({ ...next, plan: buildPlan(next, equipment, lib.items) });
  };
  const setLength = (n: number) => {
    if (!Number.isFinite(n)) return;
    const len = Math.min(MAX_PROGRAM_DAYS, Math.max(MIN_PROGRAM_DAYS, Math.round(n)));
    update({ length: len, mode: draft.mode === 'signature' ? 'growth' : draft.mode });
  };
  const restDays = draft.plan.filter((id) => id === REST_ID).length;

  return (
    <div className="space-y-6">
      <section>
        <h3 className="font-display text-[18px]">How many days?</h3>
        <div className="mt-3 flex flex-wrap items-center gap-2" role="radiogroup" aria-label="Program length">
          {LENGTH_PRESETS.map((n) => {
            const on = draft.mode !== 'signature' && draft.length === n && !custom;
            return (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => {
                  setCustom('');
                  setLength(n);
                }}
                className={clsx('h-10 min-w-12 rounded-lg border px-3 text-sm font-medium transition-colors', on ? 'border-slate bg-slate text-white dark:text-[#14181c]' : 'border-line bg-surface hover:border-line-strong')}
              >
                {n}
              </button>
            );
          })}
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
          {MIN_PROGRAM_DAYS}–{MAX_PROGRAM_DAYS} days.
          {restDays ? ` ${draft.plan.length - restDays} challenges + ${restDays} rest day${restDays === 1 ? '' : 's'}.` : ''}
          {startDate ? ` Day ${draft.plan.length} would be ${formatDate(addDays(startDate, draft.plan.length - 1))}.` : ''}
        </p>
      </section>

      <section>
        <h3 className="font-display text-[18px]">Who picks the challenges?</h3>
        <div className="mt-3 grid gap-2.5 sm:grid-cols-2" role="radiogroup" aria-label="Plan style">
          <StyleCard selected={draft.mode !== 'signature'} onSelect={() => update({ mode: 'growth', tracks: draft.tracks.length ? draft.tracks : [...RECOMMENDED_TRACKS[stage]] })} title="Growth plan" body="Pick the skills you want to build. Each track climbs step by step, with wildcard days mixed in." />
          <StyleCard selected={draft.mode === 'signature'} onSelect={() => update({ mode: 'signature' })} title="Signature 30" body="The classic fun program: juggling on Day 1 through a Megaminx on Day 30." />
        </div>
        <p className="mt-2 text-xs text-ink-3">Either way, you can swap any day — including for a challenge you write yourself.</p>
      </section>

      {draft.mode === 'growth' && (
        <>
          <section>
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="font-display text-[18px]">What do you want to get better at?</h3>
              <button type="button" className="shrink-0 text-xs text-slate hover:underline" onClick={() => update({ tracks: [...RECOMMENDED_TRACKS[stage]] })}>
                Choose for me
              </button>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {TRACKS.map((t) => {
                const on = draft.tracks.includes(t.id);
                return (
                  <button
                    key={t.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => update({ tracks: on ? draft.tracks.filter((x) => x !== t.id) : [...draft.tracks, t.id] })}
                    className={clsx('rounded-xl border px-3.5 py-2.5 text-left transition-colors', on ? 'border-slate bg-slate-soft' : 'border-line bg-surface hover:border-line-strong')}
                  >
                    <span className={clsx('block text-[14px]', on && 'font-medium text-slate')}>{t.title}</span>
                    <span className="mt-0.5 block text-[12px] leading-snug text-ink-3">{t.blurb}</span>
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-xs text-ink-3">
              {draft.tracks.length ? `${draft.tracks.length} track${draft.tracks.length === 1 ? '' : 's'} · 8 steps each.` : 'Pick at least one — or none for a plan of standalone challenges.'} Two to four works best for 30 days.
            </p>
          </section>

          <section>
            <h3 className="font-display text-[18px]">Time per day</h3>
            <Chips
              label="Time per day"
              value={draft.timeBudget}
              onChange={(timeBudget) => update({ timeBudget })}
              options={[
                { value: 'short', label: '15–30 min' },
                { value: 'medium', label: '30–60 min' },
                { value: 'long', label: '1–3 hours' },
              ]}
            />
            <p className="mt-2 text-xs text-ink-3">Most days fit your time. Each track’s final step is a bigger “boss” day.</p>
          </section>

          <section>
            <h3 className="font-display text-[18px]">Wildcard days</h3>
            <Chips
              label="Wildcard days"
              value={draft.wildcards}
              onChange={(wildcards) => update({ wildcards })}
              options={[
                { value: 'none', label: 'None' },
                { value: 'some', label: 'Some' },
                { value: 'many', label: 'Lots' },
              ]}
            />
            <label className="mt-3 flex items-center gap-2.5 text-[13.5px]">
              <input type="checkbox" className="size-4 accent-[var(--slate)]" checked={draft.includeFun} onChange={(e) => update({ includeFun: e.target.checked })} />
              Include fun challenges (juggling, puzzles, drawing…)
            </label>
            <p className="mt-2 text-xs text-ink-3">Standalone challenges between track steps, for variety.</p>
          </section>
        </>
      )}

      {draft.mode !== 'signature' && (
        <section>
          <h3 className="font-display text-[18px]">How fast should it get harder?</h3>
          <Chips
            label="Difficulty curve"
            value={draft.curve}
            onChange={(curve) => update({ curve })}
            options={[
              { value: 'gentle', label: 'Gentle', hint: 'Stays easier for longer; the hard ones come near the end' },
              { value: 'steady', label: 'Steady', hint: 'An even climb from easy to hard' },
              { value: 'steep', label: 'Steep', hint: 'Gets challenging quickly' },
            ]}
          />
          <p className="mt-2 text-xs text-ink-3">{draft.curve === 'gentle' ? 'Mostly easier challenges, with the hardest saved for the end.' : draft.curve === 'steep' ? 'A short warm-up, then mostly demanding challenges.' : 'An even climb from easy to hard.'}</p>
        </section>
      )}

      <section>
        <h3 className="font-display text-[18px]">Rest days</h3>
        <Chips
          label="Rest days"
          value={draft.restEvery}
          onChange={(restEvery) => update({ restEvery })}
          options={[
            { value: 0, label: 'None' },
            { value: 7, label: 'Every 7th day' },
            { value: 5, label: 'Every 5th day' },
          ]}
        />
        <p className="mt-2 text-xs text-ink-3">A rest or catch-up day: recover, or redo something you missed. Rest days never count as missed.{draft.mode === 'signature' && draft.restEvery ? ' They’re added around the Signature 30, so the program gets longer.' : ''}</p>
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
          {draft.mode !== 'signature' && (
            <Button size="sm" icon={<Shuffle className="size-3.5" />} onClick={() => update({ seed: Math.floor(Math.random() * 1e9) })}>
              Shuffle
            </Button>
          )}
        </div>
        <p className="mt-1 text-xs text-ink-3">{draft.mode === 'growth' ? 'Tracks take turns, each climbing step by step towards its capstone.' : 'Easiest first — each challenge is as hard as or harder than the one before.'}</p>
        <PlanList
          plan={draft.plan}
          equipment={equipment}
          className="mt-3 max-h-[440px] overflow-y-auto"
          onSwap={(day, id) => {
            const next = [...draft.plan];
            next[day - 1] = id;
            // Growth plans keep each track in order, so swaps stay in place.
            onChange({ ...draft, plan: draft.mode === 'growth' ? next : resortKeepingRest(next, lib.get) });
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
  const lib = useLibrary();
  const [swapDay, setSwapDay] = useState<number | null>(null);
  const has = new Set(equipment);
  return (
    <>
      <ol className={clsx('divide-y divide-line rounded-xl border border-line bg-surface', className)}>
        {plan.map((id, i) => {
          const item = lib.get(id);
          if (!item) return null;
          const rest = id === REST_ID;
          const missing = item.equipment.filter((e) => !has.has(e));
          const isLocked = locked?.(i + 1) ?? false;
          return (
            <li key={`${i}-${id}`} className={clsx('flex items-center gap-3 px-3.5 py-3', rest && 'bg-surface-2/50')}>
              <span className="font-display tnum w-7 shrink-0 text-center text-[17px] text-ink-3">{i + 1}</span>
              <span className="min-w-0 flex-1">
                <span className={clsx('flex items-center gap-1.5 truncate text-[14px]', rest && 'text-ink-2')}>
                  {rest && <Moon className="size-3.5 shrink-0" aria-hidden />}
                  {item.title}
                  {id.startsWith('custom:') && <Badge tone="violet">Yours</Badge>}
                </span>
                {!rest && (
                  <span className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11.5px] text-ink-3">
                    <span>
                      {item.category}
                      {item.step ? ` · step ${item.step}/8` : item.pack === 'fun' ? ' · fun' : ''}
                    </span>
                    <Difficulty value={item.difficulty} />
                    <span>~{fmtHours(item.estimatedMinutes)}</span>
                    {missing.length > 0 && (
                      <span className="inline-flex items-center gap-1 text-warn">
                        <Wrench className="size-3" aria-hidden /> needs equipment
                      </span>
                    )}
                  </span>
                )}
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
        exclude={plan.filter((id, i) => i + 1 !== swapDay && id !== REST_ID)}
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

/** Searchable, filterable list of every library challenge (including your own). */
export function LibraryPicker({ open, title, exclude, current, equipment, onClose, onPick }: { open: boolean; title: string; exclude: readonly string[]; current?: string; equipment: readonly string[]; onClose: () => void; onPick: (id: string) => void }) {
  return open ? <PickerBody title={title} exclude={exclude} current={current} equipment={equipment} onClose={onClose} onPick={onPick} /> : null;
}

function PickerBody({ title, exclude, current, equipment, onClose, onPick }: { title: string; exclude: readonly string[]; current?: string; equipment: readonly string[]; onClose: () => void; onPick: (id: string) => void }) {
  const lib = useLibrary();
  const [creating, setCreating] = useState(false);
  const { q, setQ, theme, setTheme, level, setLevel, pack, setPack, items } = useLibraryFilters(lib.items);
  const excluded = useMemo(() => new Set(exclude), [exclude]);
  const has = new Set(equipment);
  return (
    <>
      <Dialog open={!creating} onClose={onClose} title={title} size="lg">
        <div className="space-y-3">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" aria-hidden />
              <Input autoFocus aria-label="Search challenges" placeholder={`Search ${lib.items.length} challenges`} value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
            </div>
            <Button icon={<Plus className="size-4" />} onClick={() => setCreating(true)}>
              Create your own
            </Button>
          </div>
          <LibraryFilters theme={theme} setTheme={setTheme} level={level} setLevel={setLevel} pack={pack} setPack={setPack} />
          <p className="text-xs text-ink-3">{items.length} challenges · difficulty 1 (gentle) to 5 (demanding)</p>
          {current === REST_ID || (
            <ul className="divide-y divide-line rounded-xl border border-line">
              <RestOption onPick={onPick} />
            </ul>
          )}
          <ul className="divide-y divide-line rounded-xl border border-line">
            {items.map((i) => {
              const taken = excluded.has(i.id);
              const missing = i.equipment.filter((e) => !has.has(e));
              return (
                <li key={i.id}>
                  <button type="button" disabled={taken} onClick={() => onPick(i.id)} className={clsx('flex w-full items-start gap-3 px-3.5 py-3 text-left transition-colors hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-45', i.id === current && 'bg-slate-soft')}>
                    <LibraryRow item={i} badges={<>{i.id === current && <Badge tone="info">Current</Badge>}{taken && <Badge>In plan</Badge>}</>} missing={missing.length > 0} />
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </Dialog>
      <CustomChallengeDialog open={creating} onClose={() => setCreating(false)} onSaved={(c) => onPick(c.id)} />
    </>
  );
}

function RestOption({ onPick }: { onPick: (id: string) => void }) {
  return (
    <li>
      <button type="button" onClick={() => onPick(REST_ID)} className="flex w-full items-center gap-3 px-3.5 py-3 text-left transition-colors hover:bg-surface-2">
        <Moon className="size-4 text-ink-3" aria-hidden />
        <span className="text-[14px]">Make this a rest & catch-up day</span>
      </button>
    </li>
  );
}

export function LibraryRow({ item, badges, missing }: { item: LibraryItem; badges?: React.ReactNode; missing?: boolean }) {
  return (
    <span className="min-w-0 flex-1">
      <span className="flex flex-wrap items-center gap-2 text-[14px]">
        {item.title}
        {item.id.startsWith('custom:') && <Badge tone="violet">Yours</Badge>}
        {badges}
      </span>
      <span className="mt-0.5 block text-[12.5px] leading-snug text-ink-2">{item.objective}</span>
      <span className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11.5px] text-ink-3">
        <span>{item.category}</span>
        <Difficulty value={item.difficulty} />
        <span>~{fmtHours(item.estimatedMinutes)}</span>
        {missing && <span className="text-warn">needs equipment</span>}
      </span>
    </span>
  );
}

type Level = 'all' | '1' | '2' | '3' | '4' | '5';

export function useLibraryFilters(all: readonly LibraryItem[]) {
  const [q, setQ] = useState('');
  const [theme, setTheme] = useState<ChallengeTheme | 'all'>('all');
  const [level, setLevel] = useState<Level>('all');
  const [pack, setPack] = useState<PackFilter>('all');
  const items = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return sortByDifficulty(
      all.filter(
        (i) =>
          i.id !== REST_ID &&
          (pack === 'all' || i.pack === pack) &&
          (theme === 'all' || i.theme === theme) &&
          (level === 'all' || i.difficulty === Number(level)) &&
          (!needle || `${i.title} ${i.category} ${i.objective}`.toLowerCase().includes(needle)),
      ),
    );
  }, [all, q, theme, level, pack]);
  return { q, setQ, theme, setTheme, level, setLevel, pack, setPack, items };
}

type PackFilter = 'all' | 'growth' | 'fun';

export function LibraryFilters({ theme, setTheme, level, setLevel, pack, setPack }: { theme: ChallengeTheme | 'all'; setTheme: (t: ChallengeTheme | 'all') => void; level: Level; setLevel: (l: Level) => void; pack: PackFilter; setPack: (p: PackFilter) => void }) {
  return (
    <div className="scrollbar-none -mx-1 flex max-w-full items-center gap-2 overflow-x-auto px-1">
      <Segmented label="Kind" size="sm" value={pack} onChange={setPack} options={[{ value: 'all', label: 'All' }, { value: 'growth', label: 'Growth' }, { value: 'fun', label: 'Fun' }]} />
      <Segmented label="Interest" size="sm" value={theme} onChange={setTheme} options={[{ value: 'all' as const, label: 'All' }, ...THEMES.map((t) => ({ value: t.id, label: t.label }))]} />
      <Segmented label="Difficulty" size="sm" value={level} onChange={setLevel} options={[{ value: 'all', label: 'Any' }, ...(['1', '2', '3', '4', '5'] as const).map((n) => ({ value: n, label: n }))]} />
    </div>
  );
}
