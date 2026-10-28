import clsx from 'clsx';
import { Annoyed, ArrowRight, Frown, Laugh, Meh, Smile, type LucideIcon } from 'lucide-react';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { Disclosure, Field, Input, RatingPicker, Segmented, Textarea } from '../../components/ui';
import { blankReflection, saveReflection } from '../../db/actions';
import { formatDate, isValidIso } from '../../domain/dates';
import { PROGRAM_DAYS, programDayFor } from '../../domain/schedule';
import type { IsoDate, Reflection } from '../../domain/types';
import { useAction, useApp } from '../../lib/appData';

const ENTRY_MAX = 500;

/** Tired → Great maps to the 1–5 mood rating. */
const MOODS: { value: number; label: string; icon: LucideIcon }[] = [
  { value: 1, label: 'Tired', icon: Frown },
  { value: 2, label: 'Empty', icon: Annoyed },
  { value: 3, label: 'Neutral', icon: Meh },
  { value: 4, label: 'Good', icon: Smile },
  { value: 5, label: 'Great', icon: Laugh },
];

const PROMPTS: { key: 'improvement' | 'difficult' | 'proud' | 'change'; label: string }[] = [
  { key: 'improvement', label: 'What was your biggest improvement?' },
  { key: 'difficult', label: 'What did you find difficult?' },
  { key: 'proud', label: 'What are you proud of?' },
  { key: 'change', label: 'What would you change tomorrow?' },
];

export function ReflectionPage() {
  const { today } = useApp();
  const [params] = useSearchParams();
  const q = params.get('date');
  const date = q && isValidIso(q) && q <= today ? q : today;
  return <ReflectionForm key={date} date={date} />;
}

function ReflectionForm({ date }: { date: IsoDate }) {
  const { data, today } = useApp();
  const existing = data.reflections.find((r) => r.date === date);
  const [form, setForm] = useState<Reflection>(() => existing ?? blankReflection(date));
  const set = <K extends keyof Reflection>(k: K, v: Reflection[K]) => setForm((f) => ({ ...f, [k]: v }));
  const save = useAction(
    () =>
      saveReflection(date, {
        entry: form.entry,
        takeaway: form.takeaway,
        completedChallenge: form.completedChallenge,
        improvement: form.improvement,
        difficult: form.difficult,
        proud: form.proud,
        change: form.change,
        mood: form.mood,
        energy: form.energy,
      }),
    { success: 'Reflection saved.' },
  );
  const day = data.program ? programDayFor(data.program.startDate, date) : 0;
  const past = [...data.reflections].filter((r) => r.updatedAt && r.date !== date).sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="mx-auto max-w-xl">
      <p className="eyebrow">
        {day >= 1 && day <= PROGRAM_DAYS ? `Day ${day} · ` : ''}Evening reflection{date !== today ? ` · ${formatDate(date, 'short')}` : ''}
      </p>
      <h1 className="font-display mt-3 text-[34px] leading-[1.08] md:text-[40px]">How was your day?</h1>
      <p className="mt-3 text-[14px] leading-relaxed text-ink-2">Take a moment to reflect. Progress isn’t just about what you do, but how you feel.</p>

      <form
        className="mt-7"
        onSubmit={(e) => {
          e.preventDefault();
          void save.run();
        }}
      >
        <div className="rounded-xl border border-line bg-surface p-4 focus-within:border-slate focus-within:ring-2 focus-within:ring-[var(--ring)]">
          <textarea
            aria-label="How was your day?"
            value={form.entry}
            maxLength={ENTRY_MAX}
            onChange={(e) => set('entry', e.target.value)}
            placeholder={'What went well today?\nWhat was challenging?\nWhat did you learn?'}
            className="min-h-[150px] w-full resize-none bg-transparent text-[14.5px] leading-relaxed text-ink placeholder:text-ink-3 focus:outline-none"
          />
          <p className="tnum text-right text-[11.5px] text-ink-3" aria-live="polite">
            {form.entry.length} / {ENTRY_MAX}
          </p>
        </div>

        <fieldset className="mt-8">
          <legend className="font-display text-[19px]">Today’s Mood</legend>
          <div role="radiogroup" aria-label="Today’s mood" className="mt-4 grid grid-cols-5">
            {MOODS.map((m) => {
              const on = form.mood === m.value;
              return (
                <button key={m.value} type="button" role="radio" aria-checked={on} onClick={() => set('mood', on ? null : m.value)} className="group flex flex-col items-center gap-2">
                  <span className={clsx('flex size-12 items-center justify-center rounded-full border transition-colors', on ? 'animate-ping-once border-2 border-slate bg-slate-soft text-slate' : 'border-line bg-surface-2 text-ink-3 group-hover:text-ink')}>
                    <m.icon key={on ? 'on' : 'off'} className={clsx('size-[22px]', on && 'animate-check')} strokeWidth={1.4} aria-hidden />
                  </span>
                  <span className={clsx('text-[12px]', on ? 'text-ink' : 'text-ink-3')}>{m.label}</span>
                </button>
              );
            })}
          </div>
        </fieldset>

        <div className="mt-8">
          <label htmlFor="takeaway" className="font-display block text-[19px]">
            Key Takeaway
          </label>
          <Input id="takeaway" className="mt-3 h-12" value={form.takeaway} maxLength={300} onChange={(e) => set('takeaway', e.target.value)} placeholder="One thing I’m grateful for today…" />
        </div>

        <Disclosure className="mt-6 border-y border-line" summary={<span className="text-[13.5px] font-normal text-ink-2">More prompts (optional)</span>}>
          <div className="space-y-4 pb-5 pt-2">
            <div>
              <p className="mb-2 text-[13px] text-ink-2">Did you complete today’s main challenge?</p>
              <Segmented
                label="Completed main challenge"
                value={form.completedChallenge ?? ('' as never)}
                onChange={(v) => set('completedChallenge', v)}
                options={[
                  { value: 'yes', label: 'Yes' },
                  { value: 'partly', label: 'Partly' },
                  { value: 'no', label: 'No' },
                  { value: 'rest', label: 'Rest day' },
                ]}
              />
            </div>
            {PROMPTS.map((p) => (
              <Field key={p.key} label={p.label} htmlFor={`refl-${p.key}`}>
                <Textarea id={`refl-${p.key}`} value={form[p.key]} maxLength={2000} onChange={(e) => set(p.key, e.target.value)} className="min-h-[60px]" />
              </Field>
            ))}
            <div>
              <p className="mb-2 text-[13px] text-ink-2">Energy</p>
              <RatingPicker label="Energy" value={form.energy} onChange={(v) => set('energy', v)} low="Drained" high="Charged" />
            </div>
          </div>
        </Disclosure>

        <button type="submit" disabled={save.busy} className="mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-accent text-[14px] font-medium text-accent-ink transition-colors hover:bg-accent-strong disabled:opacity-60">
          Save Reflection <ArrowRight className="size-4" />
        </button>
        <p className="mt-3 text-center text-[12px] text-ink-3">Private to this device. Optional — skipping never affects anything else.</p>
      </form>

      {past.length > 0 && (
        <section className="mt-12" aria-labelledby="past-title">
          <h2 id="past-title" className="font-display text-[20px]">
            Previous reflections
          </h2>
          <ul className="mt-3 divide-y divide-line border-y border-line">
            {past.slice(0, 40).map((r) => (
              <li key={r.id}>
                <Link to={`/reflection?date=${r.date}`} className="flex items-baseline gap-4 py-3.5">
                  <span className="w-24 shrink-0 text-[12.5px] text-ink-3">{formatDate(r.date, 'short')}</span>
                  <span className="min-w-0 flex-1 truncate text-[14px] text-ink-2">{r.entry || r.takeaway || r.proud || r.improvement || 'Check-in'}</span>
                  {r.mood && <span className="text-[12px] text-ink-3">{MOODS[r.mood - 1]?.label}</span>}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
