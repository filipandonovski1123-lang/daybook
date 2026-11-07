import { ArrowRight, BarChart3, Bell, Check, HardDrive, ListChecks, NotebookPen, Palette as PaletteIcon, Shield, Target } from 'lucide-react';
import type { ReactNode } from 'react';
import { QuoteCard, Scene } from '../../components/Scene';
import { Wordmark } from '../../components/Shell';
import { TrackSymbol } from '../../components/TrackSymbol';
import { Button } from '../../components/ui';
import { QUOTES } from '../../data/quotes';
import { TRACKS, trackSteps } from '../../data/tracks';

/** First thing a new visitor sees at the shared link. Everything stated here is true of the app. */
export function Landing({ onStart }: { onStart: () => void }) {
  const ladder = trackSteps('courage');
  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-5 pt-[max(18px,env(safe-area-inset-top))]">
        <Wordmark />
        <Button size="sm" variant="primary" onClick={onStart}>
          Start
        </Button>
      </header>

      <main>
        {/* Hero */}
        <section className="animate-fade-up mx-auto max-w-5xl px-5 pb-10 pt-12 md:pt-20">
          <p className="eyebrow">Daily challenges · Habits · Reflection</p>
          <h1 className="font-display mt-4 max-w-3xl text-[44px] leading-[1.04] md:text-[68px]">Build real skills, one day at a time.</h1>
          <p className="mt-5 max-w-xl text-[16px] leading-relaxed text-ink-2 md:text-[17px]">
            Daybook gives you one real challenge a day. Each one builds on the last, from a small first step to something you’re genuinely proud of. Add a few simple habits and a quick evening check-in, and watch it compound.
          </p>
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
        </section>

        <div className="mx-auto max-w-5xl md:px-5">
          <Scene kind="coast" hero className="h-[230px] md:h-[380px] md:rounded-2xl" />
        </div>

        {/* How it works */}
        <section id="how" className="mx-auto max-w-5xl scroll-mt-6 px-5 py-16 md:py-24" aria-labelledby="how-title">
          <p className="eyebrow">How it works</p>
          <h2 id="how-title" className="font-display mt-3 text-[32px] leading-tight md:text-[42px]">
            Small steps that actually add up.
          </h2>
          <ol className="mt-10 grid gap-8 md:grid-cols-3">
            {[
              ['Choose what to get better at', 'Pick from 14 skill tracks, or let Daybook suggest some for your stage of life. Choose how long, how much time a day and how fast it gets harder.'],
              ['Do one challenge a day', 'Real things, not worksheets: send the message, give the talk, cook the meal, ask the question. Each step is a little harder than the last.'],
              ['Watch it compound', 'Tick off habits, write a short reflection, and see your streaks, progress and personal bests grow — then get a summary when you finish.'],
            ].map(([title, body], i) => (
              <li key={title}>
                <span className="font-display tnum text-[40px] leading-none text-slate">{i + 1}</span>
                <h3 className="mt-3 text-[17px] font-medium">{title}</h3>
                <p className="mt-2 text-[14.5px] leading-relaxed text-ink-2">{body}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* Tracks */}
        <section className="border-y border-line bg-surface py-16 md:py-24" aria-labelledby="tracks-title">
          <div className="mx-auto max-w-5xl px-5">
            <p className="eyebrow">14 skill tracks</p>
            <h2 id="tracks-title" className="font-display mt-3 text-[32px] leading-tight md:text-[42px]">
              Skills that still matter in a year.
            </h2>
            <ul className="mt-10 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {TRACKS.map((t) => (
                <li key={t.id} className="flex items-start gap-3 rounded-xl border border-line bg-bg p-4">
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

        {/* One track, step by step */}
        <section className="mx-auto max-w-5xl px-5 py-16 md:py-24" aria-labelledby="ladder-title">
          <div className="grid gap-10 md:grid-cols-[1fr_1.2fr] md:items-start">
            <div>
              <p className="eyebrow">Example track</p>
              <h2 id="ladder-title" className="font-display mt-3 text-[32px] leading-tight md:text-[42px]">
                Courage, one step at a time.
              </h2>
              <p className="mt-4 text-[15px] leading-relaxed text-ink-2">Every track is a ladder. You never jump straight to the hard part; each day makes the next one possible. Wildcard days mix in something different for variety.</p>
            </div>
            <ol className="divide-y divide-line rounded-xl border border-line bg-surface">
              {ladder.map((s) => (
                <li key={s.id} className="flex items-center gap-4 px-4 py-3">
                  <span className="tnum w-6 text-center text-[13px] text-ink-3">{s.step}</span>
                  <span className="flex-1 text-[14.5px]">{s.title}</span>
                  <span className="hidden text-[12px] text-ink-3 sm:inline">~{s.estimatedMinutes < 60 ? `${s.estimatedMinutes} min` : `${Math.round(s.estimatedMinutes / 30) / 2} h`}</span>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Features */}
        <section className="border-t border-line py-16 md:py-24" aria-labelledby="features-title">
          <div className="mx-auto max-w-5xl px-5">
            <p className="eyebrow">Everything in one place</p>
            <h2 id="features-title" className="font-display mt-3 text-[32px] leading-tight md:text-[42px]">
              Built for the days you don’t feel like it.
            </h2>
            <div className="mt-10 grid gap-x-8 gap-y-9 sm:grid-cols-2 lg:grid-cols-3">
              <Feature icon={<Target />} title="A plan that fits you">
                Any length from 3 to 100 days, with rest days if you want them. Swap any day, or write your own challenges.
              </Feature>
              <Feature icon={<ListChecks />} title="Habits that rotate">
                Start with a few simple habits. They rotate through the week, so no day is a wall of tasks.
              </Feature>
              <Feature icon={<NotebookPen />} title="Evening reflection">
                A one-minute check-in on how the day went, so you notice what’s actually working.
              </Feature>
              <Feature icon={<BarChart3 />} title="Honest progress">
                Streaks, completion and personal bests. Missed days stay visible — you decide how to catch up.
              </Feature>
              <Feature icon={<Bell />} title="Gentle reminders">
                A morning nudge with today’s challenge and an evening check-in, at times you choose.
              </Feature>
              <Feature icon={<PaletteIcon />} title="Make it yours">
                Four styles — Editorial, Midnight, Forest and Athletic — and a Hard Mode for when you want real accountability.
              </Feature>
            </div>
          </div>
        </section>

        {/* Privacy */}
        <section className="bg-surface py-16 md:py-20" aria-labelledby="privacy-title">
          <div className="mx-auto grid max-w-5xl gap-8 px-5 md:grid-cols-[auto_1fr] md:items-start">
            <Shield className="size-10 text-slate" aria-hidden />
            <div>
              <h2 id="privacy-title" className="font-display text-[28px] leading-tight md:text-[34px]">
                Your progress is yours.
              </h2>
              <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-ink-2">
                No account, no ads, no tracking. Everything you write and log is stored on your own device and never uploaded anywhere. Save a backup file whenever you like and restore it on another phone.
              </p>
              <p className="mt-4 flex items-center gap-2 text-[13px] text-ink-3">
                <HardDrive className="size-4" aria-hidden />
                Clearing your browser’s data for this site deletes it, so keep a backup.
              </p>
            </div>
          </div>
        </section>

        {/* Closing */}
        <section className="mx-auto max-w-5xl px-5 py-16 md:py-24" aria-labelledby="start-title">
          <QuoteCard quote={QUOTES[0]!} scene="peaks" />
          <div className="mt-14 text-center">
            <h2 id="start-title" className="font-display text-[36px] leading-tight md:text-[48px]">
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

function Feature({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <div>
      <span className="flex size-10 items-center justify-center rounded-xl bg-surface-2 text-slate [&>svg]:size-5" aria-hidden>
        {icon}
      </span>
      <h3 className="mt-4 text-[16px] font-medium">{title}</h3>
      <p className="mt-1.5 text-[14px] leading-relaxed text-ink-2">{children}</p>
    </div>
  );
}
