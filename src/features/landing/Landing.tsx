import clsx from 'clsx';
import { ArrowRight, BarChart3, Bell, Check, Flag, HardDrive, ListChecks, NotebookPen, Shield, Target } from 'lucide-react';
import { useState, type CSSProperties, type ReactNode } from 'react';
import { QuoteCard, Scene } from '../../components/Scene';
import { TrackSymbol } from '../../components/TrackSymbol';
import { Button } from '../../components/ui';
import { Wordmark } from '../../components/Wordmark';
import { QUOTES } from '../../data/quotes';
import { TRACKS } from '../../data/trackDefs';
import type { Palette } from '../../domain/types';
import { COURAGE_LADDER } from './content';
import { DemoToday, PhoneFrame } from './Phone';
import { useScrollScenes } from './useScrollScenes';

const STEPS = [
  ['Choose what to get better at', 'Pick from 14 skill tracks, or let Daybook suggest some for your stage of life. Choose how long, how much time a day and how fast it gets harder.'],
  ['Do one challenge a day', 'Real things, not worksheets: send the message, give the talk, cook the meal, ask the question. Each step is a little harder than the last.'],
  ['Watch it compound', 'Tick off habits, write a short reflection, and see your streaks, progress and personal bests grow — then get a summary when you finish.'],
] as const;

/** The phone's day, in the same order and timing as its screen (see Phone.tsx). */
const DAY = [
  { when: 'Morning', title: 'Your challenge arrives', body: 'A reminder with today’s step, so you know what’s next before you’ve opened the app.', a: -1, b: 0.24 },
  { when: 'During the day', title: 'Do the real thing', body: 'Make the ask. Mark it done when it’s genuinely done — that’s the whole point.', a: 0.24, b: 0.42 },
  { when: 'Through the day', title: 'Tick off a few habits', body: 'Sleep, reading, focus, a workout. Small, rotating through the week, one tap each.', a: 0.42, b: 0.73 },
  { when: 'Evening', title: 'A one-minute check-in', body: 'How did it go? One line is enough. Then Day 12 is done, and tomorrow is a little harder.', a: 0.73, b: 1.01 },
];

const STYLES: { value: Palette; label: string; body: string; a: number; b: number }[] = [
  { value: 'editorial', label: 'Editorial', body: 'Warm paper, serif headings and slate blue. Light or dark.', a: -1, b: 0.25 },
  { value: 'midnight', label: 'Midnight', body: 'Near-black, crisp headings, bright blue and green.', a: 0.25, b: 0.5 },
  { value: 'forest', label: 'Forest', body: 'Deep olive and charcoal with muted sage. Earthy and calm.', a: 0.5, b: 0.75 },
  { value: 'athletic', label: 'Athletic', body: 'Graphite with electric lime. Bold, sharp and high-energy.', a: 0.75, b: 1.01 },
];

const PRIVACY_LINE = 'Your progress is yours.';
const PHONE = 'h-[500px] w-[244px] md:h-[600px] md:w-[292px]';

/** A pinned section needs its whole content on screen; on short phones it scrolls normally instead. */
function fitsPinned(minHeight: number): boolean {
  if (typeof window === 'undefined') return false;
  return window.innerHeight >= minHeight || (typeof window.matchMedia === 'function' && window.matchMedia('(min-width: 768px)').matches);
}

/** `--i` and friends as inline custom properties. */
const vars = (v: Record<string, number>) => Object.fromEntries(Object.entries(v).map(([k, n]) => [`--${k}`, n])) as CSSProperties;

const minutes = (m: number) => (m < 60 ? `${m} min` : `${Math.round(m / 30) / 2} h`);

/**
 * First thing a new visitor sees at the shared link. Everything stated here is true of the app.
 * Scroll-driven (see useScrollScenes): the hero drifts, several sections pin while their story plays
 * out on a phone built from the app's own pieces, and content reveals as it arrives. With reduced
 * motion it's a normal, static page.
 */
export function Landing({ onStart }: { onStart: () => void }) {
  const motion = useScrollScenes();
  const [pin] = useState(() => ({
    how: motion && fitsPinned(760),
    day: motion && fitsPinned(770),
    ladder: motion && fitsPinned(560),
    styles: motion && fitsPinned(750),
  }));

  return (
    <div className={clsx('min-h-dvh overflow-x-clip', motion && 'scroll-motion')}>
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-5 pt-[max(18px,env(safe-area-inset-top))]">
        <Wordmark />
        <Button size="sm" variant="primary" onClick={onStart}>
          Start
        </Button>
      </header>

      <main>
        {/* Hero */}
        <section data-scroll="hero" className="mx-auto grid max-w-5xl items-center gap-10 px-5 pb-12 pt-12 md:grid-cols-[1.25fr_0.75fr] md:pt-16">
          <div className="ls-hero-text animate-fade-up">
            <p className="eyebrow">Daily challenges · Habits · Reflection</p>
            <h1 className="font-display mt-4 text-[44px] leading-[1.04] md:text-[64px]">Build real skills, one day at a time.</h1>
            <p className="mt-5 max-w-md text-[16px] leading-relaxed text-ink-2 md:text-[17px]">One real challenge a day, each building on the last — plus a few simple habits and a one-minute evening check-in.</p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Button size="lg" variant="primary" onClick={onStart} icon={<ArrowRight className="size-4" />} className="flex-row-reverse">
                Start your plan
              </Button>
              <a href="#how" className="text-sm text-ink-2 underline-offset-4 hover:text-ink hover:underline">
                See how it works
              </a>
            </div>
            <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-[13px] text-ink-2">
              {['Free', 'No account', 'Works offline', 'Nothing leaves your device'].map((t) => (
                <li key={t} className="flex items-center gap-1.5">
                  <Check className="size-3.5 text-slate" aria-hidden />
                  {t}
                </li>
              ))}
            </ul>
          </div>
          <div className="animate-fade-up hidden justify-center md:flex" style={vars({ p: 0.5 })}>
            <PhoneFrame className={PHONE}>
              <DemoToday />
            </PhoneFrame>
          </div>
        </section>

        <div data-scroll="pass" className="mx-auto max-w-5xl md:px-5">
          <div className="ls-hero-media overflow-hidden md:rounded-2xl">
            <Scene kind="coast" hero className="h-[260px] md:h-[400px]" />
          </div>
        </div>

        {/* How it works — pinned; the three steps light up in turn */}
        <section id="how" data-scroll={pin.how ? 'pin' : undefined} className={clsx('scroll-mt-6', pin.how ? 'h-[260vh]' : 'py-16 md:py-24')} aria-labelledby="how-title">
          <div data-reveal={pin.how ? undefined : true} className={clsx('mx-auto w-full max-w-5xl px-5', pin.how && 'sticky top-0 flex h-[100svh] flex-col justify-center')}>
            <p className="eyebrow">How it works</p>
            <h2 id="how-title" className="font-display mt-3 text-[32px] leading-tight md:text-[44px]">
              Small steps that actually add up.
            </h2>
            {pin.how && (
              <div className="mt-6 h-px w-full bg-line" aria-hidden>
                <div className="ls-progress h-px bg-slate" />
              </div>
            )}
            <ol className="mt-8 grid gap-7 md:grid-cols-3 md:gap-8">
              {STEPS.map(([title, body], i) => (
                <li key={title} className="ls-step" style={vars({ i })}>
                  <span className="font-display tnum text-[40px] leading-none text-slate">{i + 1}</span>
                  <h3 className="mt-3 text-[17px] font-medium">{title}</h3>
                  <p className="mt-2 text-[14.5px] leading-relaxed text-ink-2">{body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* A day with Daybook — pinned; the phone plays out a day as you scroll */}
        <section data-scroll={pin.day ? 'pin' : undefined} className={clsx('border-t border-line bg-surface', pin.day ? 'h-[420vh]' : 'py-16 md:py-24')} aria-labelledby="day-title">
          <div className={clsx('mx-auto grid w-full max-w-5xl items-center gap-6 px-5 md:grid-cols-[1fr_auto] md:gap-14', pin.day && 'sticky top-0 h-[100svh] content-center')}>
            <div>
              <p className="eyebrow">A day with Daybook</p>
              <h2 id="day-title" className="font-display mt-3 text-[30px] leading-tight md:text-[44px]">
                Day 12, start to finish.
              </h2>
              {pin.day ? (
                <div className="relative mt-5 h-[118px] md:mt-8 md:h-[150px]">
                  {DAY.map((d) => (
                    <div key={d.title} className="dp-win absolute inset-0" style={vars({ a: d.a, b: d.b })}>
                      <p className="text-[12px] font-medium uppercase tracking-[0.14em] text-slate">{d.when}</p>
                      <p className="mt-1.5 text-[19px] font-medium md:text-[22px]">{d.title}</p>
                      <p className="mt-1.5 max-w-sm text-[14px] leading-relaxed text-ink-2 md:text-[15px]">{d.body}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <ol className="mt-6 space-y-5">
                  {DAY.map((d) => (
                    <li key={d.title} data-reveal>
                      <p className="text-[12px] font-medium uppercase tracking-[0.14em] text-slate">{d.when}</p>
                      <p className="mt-1 text-[17px] font-medium">{d.title}</p>
                      <p className="mt-1 text-[14px] leading-relaxed text-ink-2">{d.body}</p>
                    </li>
                  ))}
                </ol>
              )}
            </div>
            <div className="flex justify-center">
              <PhoneFrame className={PHONE}>
                <DemoToday />
              </PhoneFrame>
            </div>
          </div>
        </section>

        {/* Tracks — ripple in */}
        <section className="border-y border-line py-16 md:py-24" aria-labelledby="tracks-title">
          <div className="mx-auto max-w-5xl px-5">
            <div data-reveal>
              <p className="eyebrow">14 skill tracks</p>
              <h2 id="tracks-title" className="font-display mt-3 text-[32px] leading-tight md:text-[44px]">
                Skills that still matter in a year.
              </h2>
            </div>
            <ul className="mt-10 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {TRACKS.map((t, i) => (
                <li key={t.id} data-reveal style={vars({ d: i % 3 })} className="flex items-start gap-3 rounded-xl border border-line bg-surface p-4">
                  <TrackSymbol track={t.id} className="mt-0.5 size-8 text-ink-2" />
                  <span>
                    <span className="block text-[15px] font-medium">{t.title}</span>
                    <span className="mt-1 block text-[13px] leading-snug text-ink-3">{t.blurb}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* One track — pinned; the ladder fills rung by rung */}
        <section data-scroll={pin.ladder ? 'pin' : undefined} className={pin.ladder ? 'h-[320vh]' : 'py-16 md:py-24'} aria-labelledby="ladder-title">
          <div data-reveal={pin.ladder ? undefined : true} className={clsx('mx-auto grid w-full max-w-5xl gap-6 px-5 md:grid-cols-[1fr_1.2fr] md:items-center md:gap-10', pin.ladder && 'sticky top-0 h-[100svh] content-center')}>
            <div>
              <p className="eyebrow">Example track</p>
              <h2 id="ladder-title" className="font-display mt-3 text-[30px] leading-tight md:text-[44px]">
                Courage, one step at a time.
              </h2>
              <p className="mt-4 hidden text-[15px] leading-relaxed text-ink-2 md:block">Every track is a ladder. You never jump straight to the hard part; each day makes the next one possible. Wildcard days mix in something different for variety.</p>
            </div>
            <ol className="relative rounded-xl border border-line bg-surface py-1.5">
              <span className="absolute bottom-6 left-[29px] top-6 w-px bg-line" aria-hidden>
                <span className="ls-rail block h-full w-px bg-slate" />
              </span>
              {COURAGE_LADDER.map((s, i) => (
                <li key={s.title} className="ls-rung relative flex items-center gap-3.5 px-4 py-2 md:py-2.5" style={vars({ i })}>
                  <span className="relative flex size-7 shrink-0 items-center justify-center rounded-full border border-line-strong bg-surface">
                    <span className="ls-fill absolute inset-0 flex items-center justify-center rounded-full bg-slate" style={vars({ i })} aria-hidden>
                      <Check className="size-3.5 text-[var(--bg)]" strokeWidth={3} />
                    </span>
                    {pin.ladder && (
                      <span className="ls-num tnum relative text-[12px] text-ink-3" style={vars({ i })} aria-hidden>
                        {i + 1}
                      </span>
                    )}
                  </span>
                  <span className="flex-1 text-[14px] md:text-[14.5px]">
                    <span className="sr-only">Step {i + 1}: </span>
                    {s.title}
                  </span>
                  <span className="hidden text-[12px] text-ink-3 sm:inline">~{minutes(s.minutes)}</span>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Styles — pinned; the same phone changes style as you scroll */}
        <section data-scroll={pin.styles ? 'pin' : undefined} className={clsx('border-t border-line bg-surface', pin.styles ? 'h-[340vh]' : 'py-16 md:py-24')} aria-labelledby="styles-title">
          <div className={clsx('mx-auto grid w-full max-w-5xl items-center gap-6 px-5 md:grid-cols-[1fr_auto] md:gap-14', pin.styles && 'sticky top-0 h-[100svh] content-center')}>
            <div>
              <p className="eyebrow">Four styles</p>
              <h2 id="styles-title" className="font-display mt-3 text-[30px] leading-tight md:text-[44px]">
                Make it feel like yours.
              </h2>
              {pin.styles ? (
                <div className="relative mt-5 h-[92px] md:mt-8 md:h-[110px]">
                  {STYLES.map((s) => (
                    <div key={s.value} className="dp-win absolute inset-0" style={vars({ a: s.a, b: s.b })}>
                      <p className="text-[19px] font-medium md:text-[22px]">{s.label}</p>
                      <p className="mt-1.5 max-w-sm text-[14px] leading-relaxed text-ink-2 md:text-[15px]">{s.body}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-4 max-w-md text-[15px] leading-relaxed text-ink-2">Editorial, Midnight, Forest or Athletic — each with its own colours, type and photos. Switch any time in Settings.</p>
              )}
            </div>
            {pin.styles ? (
              <div className="flex justify-center">
                <PhoneFrame className={PHONE}>
                  {STYLES.map((s) => (
                    <div key={s.value} className="dp-win absolute inset-0" style={vars({ a: s.a, b: s.b })}>
                      <DemoToday palette={s.value} style={vars({ p: 0.5 })} />
                    </div>
                  ))}
                </PhoneFrame>
              </div>
            ) : (
              <ul className="grid grid-cols-2 justify-items-center gap-5 md:col-span-2 md:grid-cols-4">
                {STYLES.map((s, i) => (
                  <li key={s.value} data-reveal style={vars({ d: i })} className="text-center">
                    <div className="h-[330px] w-[161px] overflow-hidden">
                      <PhoneFrame className="h-[600px] w-[292px] origin-top-left scale-[0.55]">
                        <DemoToday palette={s.value} style={vars({ p: 0.5 })} />
                      </PhoneFrame>
                    </div>
                    <p className="mt-3 text-[14px] font-medium">{s.label}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        {/* Features — staggered reveals */}
        <section className="border-t border-line py-16 md:py-24" aria-labelledby="features-title">
          <div className="mx-auto max-w-5xl px-5">
            <div data-reveal>
              <p className="eyebrow">Everything in one place</p>
              <h2 id="features-title" className="font-display mt-3 text-[32px] leading-tight md:text-[44px]">
                Built for the days you don’t feel like it.
              </h2>
            </div>
            <div className="mt-10 grid gap-x-8 gap-y-9 sm:grid-cols-2 lg:grid-cols-3">
              <Feature d={0} icon={<Target />} title="A plan that fits you">
                Any length from 3 to 100 days, with rest days if you want them. Swap any day, or write your own challenges.
              </Feature>
              <Feature d={1} icon={<ListChecks />} title="Habits that rotate">
                Start with a few simple habits. They rotate through the week, so no day is a wall of tasks.
              </Feature>
              <Feature d={2} icon={<NotebookPen />} title="Evening reflection">
                A one-minute check-in on how the day went, so you notice what’s actually working.
              </Feature>
              <Feature d={0} icon={<BarChart3 />} title="Honest progress">
                Streaks, completion and personal bests. Missed days stay visible — you decide how to catch up.
              </Feature>
              <Feature d={1} icon={<Bell />} title="Gentle reminders">
                A morning nudge with today’s challenge and an evening check-in, at times you choose.
              </Feature>
              <Feature d={2} icon={<Flag />} title="Hard Mode, if you want it">
                Stricter rules for real accountability: tasks only count when the criteria are met, and missed days need a plan.
              </Feature>
            </div>
          </div>
        </section>

        {/* Privacy — the line fills in word by word */}
        <section className="bg-surface py-16 md:py-24" aria-labelledby="privacy-title">
          <div className="mx-auto grid max-w-5xl gap-8 px-5 md:grid-cols-[auto_1fr] md:items-start">
            <Shield className="size-10 text-slate" aria-hidden data-reveal />
            <div>
              <h2 id="privacy-title" data-scroll="pass" aria-label={PRIVACY_LINE} className="font-display text-[34px] leading-tight md:text-[52px]">
                {PRIVACY_LINE.split(' ').map((w, i, all) => (
                  <span key={i} aria-hidden className="ls-word" style={vars({ i, n: all.length })}>
                    {w}{' '}
                  </span>
                ))}
              </h2>
              <p data-reveal className="mt-4 max-w-2xl text-[15px] leading-relaxed text-ink-2">
                No account, no ads, no tracking. Everything you write and log is stored on your own device and never uploaded anywhere. Save a backup file whenever you like and restore it on another phone.
              </p>
              <p data-reveal style={vars({ d: 1 })} className="mt-4 flex items-center gap-2 text-[13px] text-ink-3">
                <HardDrive className="size-4" aria-hidden />
                Clearing your browser’s data for this site deletes it, so keep a backup.
              </p>
            </div>
          </div>
        </section>

        {/* Closing */}
        <section className="mx-auto max-w-5xl px-5 py-16 md:py-24" aria-labelledby="start-title">
          <div data-reveal>
            <QuoteCard quote={QUOTES[0]!} scene="peaks" />
          </div>
          <div data-reveal className="mt-14 text-center">
            <h2 id="start-title" className="font-display text-[36px] leading-tight md:text-[52px]">
              Day 1 can be today.
            </h2>
            <p className="mx-auto mt-3 max-w-md text-[15px] leading-relaxed text-ink-2">Setup takes about two minutes. Nothing to sign up for.</p>
            <Button size="lg" variant="primary" onClick={onStart} icon={<ArrowRight className="size-4" />} className="mt-7 flex-row-reverse">
              Start your plan
            </Button>
            <p className="mx-auto mt-6 max-w-sm text-[13px] leading-relaxed text-ink-3">
              Tip: add it to your Home Screen to use it like an app. On iPhone, tap Share → Add to Home Screen. On Android, use the browser menu → Install app.
            </p>
          </div>
        </section>
      </main>

      <footer className="border-t border-line py-8 text-center text-[12.5px] text-ink-3">
        <p>Daybook · Free, private and offline-ready.</p>
      </footer>
    </div>
  );
}

function Feature({ icon, title, children, d }: { icon: ReactNode; title: string; children: ReactNode; d: number }) {
  return (
    <div data-reveal style={vars({ d })}>
      <span className="flex size-10 items-center justify-center rounded-xl bg-surface-2 text-slate [&>svg]:size-5" aria-hidden>
        {icon}
      </span>
      <h3 className="mt-4 text-[16px] font-medium">{title}</h3>
      <p className="mt-1.5 text-[14px] leading-relaxed text-ink-2">{children}</p>
    </div>
  );
}
