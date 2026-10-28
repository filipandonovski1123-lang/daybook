import clsx from 'clsx';
import { useSyncExternalStore } from 'react';

/**
 * Editorial photography. Photos live in public/images/. If a photo hasn't been added, nothing is
 * rendered — no placeholder art — and layouts close up around the missing image.
 */
export type SceneKind = 'coast' | 'peaks' | 'ridge';

const PHOTO: Record<SceneKind, string> = {
  coast: './images/hero.jpg',
  peaks: './images/quote-1.jpg',
  ridge: './images/quote-2.jpg',
};

type Probe = 'loading' | 'ok' | 'none';
const probes = new Map<SceneKind, Probe>();
const listeners = new Set<() => void>();

function probe(kind: SceneKind) {
  if (probes.has(kind) || typeof Image === 'undefined') return;
  probes.set(kind, 'loading');
  const img = new Image();
  const done = (p: Probe) => {
    probes.set(kind, p);
    listeners.forEach((fn) => fn());
  };
  img.onload = () => done('ok');
  img.onerror = () => done('none');
  img.src = PHOTO[kind];
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Whether the photo for `kind` exists. Checked once per session and shared. */
export function usePhoto(kind: SceneKind): Probe {
  probe(kind);
  return useSyncExternalStore(subscribe, () => probes.get(kind) ?? 'loading', () => 'loading');
}

export function Scene({ kind, className }: { kind: SceneKind; className?: string }) {
  const photo = usePhoto(kind);
  if (photo !== 'ok') return null;
  return (
    <div className={clsx('relative overflow-hidden bg-surface-3', className)} aria-hidden>
      <img src={PHOTO[kind]} alt="" className={clsx('absolute inset-0 size-full object-cover', kind === 'coast' && 'object-[22%_center]')} />
    </div>
  );
}

export function QuoteCard({ quote, scene, className, layout = 'side' }: { quote: string; scene: SceneKind; className?: string; layout?: 'side' | 'overlay' }) {
  const photo = usePhoto(scene) === 'ok';
  if (layout === 'overlay' && photo)
    return (
      <figure className={clsx('relative overflow-hidden rounded-xl bg-surface-2', className)}>
        <Scene kind={scene} className="absolute inset-0 opacity-90" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#eceae5] via-[#eceae5]/80 to-transparent dark:from-[#212428] dark:via-[#212428]/80" aria-hidden />
        <blockquote className="font-display relative max-w-[62%] p-5 text-[19px] leading-snug text-ink">“{quote}”</blockquote>
      </figure>
    );
  return (
    <figure className={clsx('flex items-stretch gap-4 overflow-hidden rounded-xl bg-surface-2 p-5', layout === 'overlay' && '!h-auto', className)}>
      <blockquote className="font-display flex flex-1 items-center text-[20px] leading-snug text-ink">“{quote}”</blockquote>
      {photo && <Scene kind={scene} className="w-[38%] shrink-0 rounded-md" />}
    </figure>
  );
}

const QUOTES = [
  'Consistency turns intention into results.',
  'Discipline today builds the freedom you want tomorrow.',
  'A more intentional you, one day at a time.',
  'Small steps create real change.',
  'Progress comes from what you actually do.',
];

export function quoteFor(day: number): string {
  return QUOTES[(Math.max(1, day) - 1) % QUOTES.length] ?? QUOTES[0]!;
}
