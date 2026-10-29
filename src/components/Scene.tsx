import clsx from 'clsx';
import { useEffect, useRef, useSyncExternalStore } from 'react';
import { prefersReducedMotion } from '../lib/motion';
import type { Quote } from '../data/quotes';
import { usePalette } from '../lib/palette';

/**
 * Editorial photography. Photos live in public/images/, with optional per-theme versions in
 * public/images/<theme>/ (same file names). A missing theme photo falls back to the default one; if
 * that's missing too, nothing is rendered — no placeholder art — and layouts close up around it.
 */
export type SceneKind = 'coast' | 'peaks' | 'ridge';
export type BackdropKind = 'welcome' | 'habits' | 'calendar' | 'progress' | 'reflection';

const PHOTO: Record<SceneKind, string> = {
  coast: './images/hero.jpg',
  peaks: './images/quote-1.jpg',
  ridge: './images/quote-2.jpg',
};

const BACKDROP: Record<BackdropKind, string> = {
  welcome: './images/bg-welcome.jpg',
  habits: './images/bg-habits.jpg',
  calendar: './images/bg-calendar.jpg',
  progress: './images/bg-progress.jpg',
  reflection: './images/bg-reflection.jpg',
};

type Probe = 'loading' | 'ok' | 'none';
const probes = new Map<string, Probe>();
const listeners = new Set<() => void>();

function probe(url: string) {
  if (probes.has(url) || typeof Image === 'undefined') return;
  probes.set(url, 'loading');
  const img = new Image();
  const done = (p: Probe) => {
    probes.set(url, p);
    listeners.forEach((fn) => fn());
  };
  img.onload = () => done('ok');
  img.onerror = () => done('none');
  img.src = url;
}

function useImage(url: string): Probe {
  probe(url);
  return useSyncExternalStore(subscribe, () => probes.get(url) ?? 'loading', () => 'loading');
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** The theme's own version of a photo if it exists, otherwise the default. */
function useThemedImage(url: string): { url: string; state: Probe } {
  const palette = usePalette();
  const themed = palette === 'editorial' ? url : url.replace('./images/', `./images/${palette}/`);
  const themedState = useImage(themed);
  const baseState = useImage(url);
  if (themedState === 'ok') return { url: themed, state: 'ok' };
  if (themedState === 'loading') return { url, state: 'loading' };
  return { url, state: baseState };
}

/** Whether the photo for `kind` exists. Checked once per session and shared. */
export function usePhoto(kind: SceneKind): Probe {
  return useThemedImage(PHOTO[kind]).state;
}

export function Scene({ kind, className, hero = false }: { kind: SceneKind; className?: string; hero?: boolean }) {
  const { url, state: photo } = useThemedImage(PHOTO[kind]);
  const layer = useRef<HTMLDivElement>(null);

  // Hero only: gentle parallax while it's on screen. Written straight to the style (no re-renders).
  useEffect(() => {
    if (!hero || photo !== 'ok' || prefersReducedMotion()) return;
    const el = layer.current;
    if (!el) return;
    let raf = 0;
    const update = () => {
      raf = 0;
      const rect = el.parentElement?.getBoundingClientRect();
      if (!rect || rect.bottom < 0 || rect.top > window.innerHeight) return;
      el.style.transform = `translate3d(0, ${Math.round(-rect.top * 0.12)}px, 0)`;
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [hero, photo]);

  if (photo !== 'ok') return null;
  return (
    <div className={clsx('relative overflow-hidden bg-surface-3', className)} aria-hidden>
      <div ref={layer} className={clsx('absolute inset-x-0 will-change-transform', hero ? '-top-[10%] h-[120%]' : 'inset-y-0')}>
        <img src={url} alt="" className={clsx('size-full object-cover', kind === 'coast' && 'object-[22%_center]', hero && 'animate-hero')} />
      </div>
    </div>
  );
}

export function QuoteCard({ quote, scene, className, layout = 'side' }: { quote: Quote; scene: SceneKind; className?: string; layout?: 'side' | 'overlay' }) {
  const photo = usePhoto(scene) === 'ok';
  if (layout === 'overlay' && photo)
    return (
      <figure className={clsx('relative overflow-hidden rounded-xl bg-surface-2', className)}>
        <Scene kind={scene} className="absolute inset-0 opacity-90" />
        <div className="absolute inset-0 bg-gradient-to-r from-surface-2 via-surface-2/80 to-transparent" aria-hidden />
        <div className="relative max-w-[80%] p-5 sm:max-w-[62%]">
          <blockquote className="font-display text-[19px] leading-snug text-ink">“{quote.text}”</blockquote>
          <Attribution quote={quote} />
        </div>
      </figure>
    );
  return (
    <figure className={clsx('flex items-stretch gap-4 overflow-hidden rounded-xl bg-surface-2 p-5', layout === 'overlay' && '!h-auto', className)}>
      <div className="flex flex-1 flex-col justify-center">
        <blockquote className="font-display text-[20px] leading-snug text-ink">“{quote.text}”</blockquote>
        <Attribution quote={quote} />
      </div>
      {photo && <Scene kind={scene} className="w-[38%] shrink-0 rounded-md" />}
    </figure>
  );
}

function Attribution({ quote }: { quote: Quote }) {
  return (
    <figcaption className="mt-2.5 text-[12.5px] text-ink-3">
      — <span className="text-ink-2">{quote.by}</span>
      {quote.source && <span className="italic">, {quote.source}</span>}
    </figcaption>
  );
}

/**
 * A faint photo at the top of a page that dissolves into the paper background.
 * Decorative only: it sits behind the heading area, never behind dense content, and is
 * skipped entirely if the file is missing. `full` covers the whole screen (onboarding).
 */
/** Backdrop opacity for the dark styles: [behind a heading, full-screen]. */
const BACKDROP_STRENGTH: Record<'midnight' | 'forest' | 'athletic', [number, number]> = {
  midnight: [0.75, 0.6],
  forest: [0.45, 0.35],
  athletic: [0.6, 0.5],
};

export function Backdrop({ kind, full = false }: { kind: BackdropKind; full?: boolean }) {
  const palette = usePalette();
  const { url, state: photo } = useThemedImage(BACKDROP[kind]);
  if (photo !== 'ok') return null;
  const mask = full
    ? 'linear-gradient(to bottom, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.55) 45%, rgba(0,0,0,0.3) 100%)'
    : 'linear-gradient(to bottom, #000 0%, rgba(0,0,0,0.85) 45%, transparent 100%)';
  // The dark styles' own photos are dark already, so they need more strength to show at all.
  const strength = palette === 'editorial' ? undefined : BACKDROP_STRENGTH[palette][full ? 1 : 0];
  return (
    <div className={clsx('pointer-events-none absolute inset-x-0 top-0 -z-10 overflow-hidden', full ? 'fixed inset-0 h-dvh' : 'h-[380px] md:h-[460px]')} aria-hidden>
      <img
        src={url}
        alt=""
        className={clsx('animate-fade size-full object-cover', full ? 'opacity-[0.6] dark:opacity-[0.3]' : 'opacity-[0.55] dark:opacity-[0.28]')}
        style={{ maskImage: mask, WebkitMaskImage: mask, opacity: strength }}
      />
    </div>
  );
}
