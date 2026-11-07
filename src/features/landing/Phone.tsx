import clsx from 'clsx';
import { Check } from 'lucide-react';
import type { CSSProperties, ReactNode } from 'react';
import { Scene } from '../../components/Scene';
import { TrackSymbol } from '../../components/TrackSymbol';
import { TRACK_BY_ID } from '../../data/trackDefs';
import type { Palette } from '../../domain/types';
import { DEMO_CHALLENGE, DEMO_HABITS } from './content';

/**
 * A phone showing Daybook's Today screen, built from the app's own pieces (styles, symbols, photos,
 * real challenge and habit names) rather than a screenshot, so it always matches the real thing.
 * The day plays out with --p (0–1) from the nearest ancestor: morning reminder → challenge done →
 * habits ticked → evening reflection. Without --p it shows the finished day.
 */

const vars = (v: Record<string, number | string>) => Object.fromEntries(Object.entries(v).map(([k, n]) => [`--${k}`, n])) as CSSProperties;

/** When each task gets ticked, as a fraction of the day's story. */
const CHALLENGE_DONE = 0.32;
const HABIT_DONE = [0.44, 0.52, 0.6, 0.68];
const COUNT_STEPS = [0, CHALLENGE_DONE, ...HABIT_DONE, 1.01];
const RING = 2 * Math.PI * 15;

export function PhoneFrame({ children, className, style }: { children: ReactNode; className?: string; style?: CSSProperties }) {
  return (
    <div className={clsx('relative shrink-0 rounded-[46px] bg-[#0d0f11] p-[9px] shadow-[0_30px_70px_-25px_rgb(0_0_0/0.55)] ring-1 ring-black/20', className)} style={style} aria-hidden>
      <div className="relative h-full w-full overflow-hidden rounded-[38px]">{children}</div>
      <span className="absolute left-1/2 top-[18px] h-[22px] w-[84px] -translate-x-1/2 rounded-full bg-[#0d0f11]" />
    </div>
  );
}

/** The Today screen. `palette` shows a specific style (style showcase); otherwise the page's own. */
export function DemoToday({ palette, style }: { palette?: Palette; style?: CSSProperties }) {
  const track = TRACK_BY_ID.get(DEMO_CHALLENGE.track)!;
  return (
    <div className={clsx('relative h-full w-full overflow-hidden text-left', palette ? 'ls-preview' : 'bg-bg text-ink')} data-preview={palette} style={style}>
      {/* Status bar */}
      <div className="flex items-center justify-between px-7 pt-[18px] text-[11px] font-semibold">
        <span>9:41</span>
        <span className="flex items-end gap-[2px]">
          {[4, 6, 8, 10].map((h) => (
            <span key={h} className="w-[3px] rounded-sm bg-current" style={{ height: h }} />
          ))}
        </span>
      </div>

      <div className="px-4 pt-5">
        <div className="flex items-center justify-between">
          <span className="font-display text-[17px] leading-none">Daybook</span>
          <span className="flex size-6 items-center justify-center rounded-full border border-line bg-surface-2 text-[10px] text-ink-2">A</span>
        </div>
        <p className="eyebrow mt-4 !text-[9px]">Day 12 of 30</p>
        <p className="font-display mt-1.5 text-[23px] leading-[1.1]">{DEMO_CHALLENGE.title}</p>
        <p className="mt-1.5 flex items-center gap-1 text-[10px] text-ink-3">
          <TrackSymbol track={DEMO_CHALLENGE.track} className="size-3" />
          {track.title} · step {DEMO_CHALLENGE.step} of 8
        </p>
      </div>

      <Scene kind="coast" palette={palette} className="mx-4 mt-3 h-[84px] rounded-lg" />

      {/* Checklist */}
      <div className="relative mx-3 -mt-3 rounded-xl border border-line bg-surface p-3 shadow-card">
        <div className="flex items-center justify-between">
          <span className="font-display text-[13px]">Today’s Checklist</span>
          <span className="tnum relative h-3.5 w-8 text-right text-[10px] text-ink-3">
            {COUNT_STEPS.slice(0, -1).map((a, k) => (
              <span key={k} className="dp-win absolute inset-0" style={vars({ a: k === 0 ? -1 : a, b: COUNT_STEPS[k + 1]! })}>
                {k} / 5
              </span>
            ))}
          </span>
        </div>
        <ul className="mt-2 space-y-1.5">
          <Row label={DEMO_CHALLENGE.title} detail="Challenge" t={CHALLENGE_DONE} />
          {DEMO_HABITS.map((h, i) => (
            <Row key={h.id} label={h.name} detail={h.detail} t={HABIT_DONE[i]!} />
          ))}
        </ul>
      </div>

      {/* Progress */}
      <div className="mx-3 mt-2.5 flex items-center gap-3 rounded-xl border border-line bg-surface p-3">
        <svg viewBox="0 0 36 36" className="size-10 -rotate-90">
          <circle cx="18" cy="18" r="15" fill="none" strokeWidth="3.5" className="stroke-[var(--surface-3)]" />
          <circle cx="18" cy="18" r="15" fill="none" strokeWidth="3.5" strokeLinecap="round" className="dp-ring stroke-[var(--slate)]" strokeDasharray={RING} style={vars({ c: `${RING}px` })} />
        </svg>
        <div className="text-[10px] leading-snug text-ink-3">
          <span className="block text-[13px] font-medium text-ink">11-day streak</span>
          Keep it going today
        </div>
      </div>

      {/* Morning reminder */}
      <div className="dp-notif dp-win absolute inset-x-2.5 top-10 rounded-2xl border border-line bg-surface/95 p-3 shadow-pop backdrop-blur" style={vars({ a: -1, b: 0.24 })}>
        <div className="flex items-center gap-1.5 text-[9.5px] text-ink-3">
          <img src="./icons/seal-mark.png" alt="" className="size-3.5" />
          DAYBOOK · now
        </div>
        <p className="mt-1 text-[12px] font-medium">Today: {DEMO_CHALLENGE.title}</p>
        <p className="text-[10.5px] text-ink-2">
          {track.title} · step {DEMO_CHALLENGE.step} of 8
        </p>
      </div>

      {/* Evening reflection */}
      <div className="dp-sheet absolute inset-x-0 bottom-0 rounded-t-3xl border-t border-line bg-surface px-4 pb-6 pt-3 shadow-pop">
        <span className="mx-auto block h-1 w-9 rounded-full bg-line-strong" />
        <p className="font-display mt-3 text-[18px]">How was your day?</p>
        <div className="mt-3 flex justify-between">
          {[1, 2, 3, 4, 5].map((n) => (
            <span key={n} className={clsx('size-8 rounded-full border', n === 4 ? 'border-slate bg-slate-soft' : 'border-line')} />
          ))}
        </div>
        <p className="mt-3 rounded-lg border border-line bg-bg px-3 py-2 text-[11.5px] text-ink-2">Asked for a better seat on the train. They said yes.</p>
        <div className="mt-3 flex h-9 items-center justify-center rounded-lg bg-accent text-[12px] font-medium text-accent-ink">Save reflection</div>
      </div>

      {/* Day complete */}
      <div className="dp-on absolute left-1/2 top-[44%] flex -translate-x-1/2 items-center gap-2 rounded-full bg-accent px-4 py-2 text-[12px] font-medium text-accent-ink shadow-pop" style={vars({ t: 0.93 })}>
        <Check className="size-3.5" strokeWidth={3} />
        Day 12 complete
      </div>
    </div>
  );
}

function Row({ label, detail, t }: { label: string; detail: string; t: number }) {
  return (
    <li className="flex items-center gap-2.5 text-[11.5px]">
      <span className="relative flex size-[18px] shrink-0 items-center justify-center rounded-full border border-line-strong">
        <span className="dp-on absolute inset-0 flex items-center justify-center rounded-full bg-slate" style={vars({ t })}>
          <Check className="size-2.5 text-[var(--bg)]" strokeWidth={3.5} />
        </span>
      </span>
      <span className="flex-1 truncate">{label}</span>
      <span className="text-[10px] text-ink-3">{detail}</span>
    </li>
  );
}
