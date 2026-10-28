import clsx from 'clsx';
import { useId, useState } from 'react';

/**
 * Editorial landscape imagery. Uses a photo from public/images/<name>.jpg when present,
 * otherwise a drawn, desaturated landscape in the same mood. Purely decorative (aria-hidden).
 */
export type SceneKind = 'coast' | 'peaks' | 'ridge';

const PHOTO: Record<SceneKind, string> = {
  coast: './images/hero.jpg',
  peaks: './images/quote-1.jpg',
  ridge: './images/quote-2.jpg',
};

export function Scene({ kind, className }: { kind: SceneKind; className?: string }) {
  const [photo, setPhoto] = useState<'loading' | 'ok' | 'none'>('loading');
  return (
    <div className={clsx('relative overflow-hidden bg-[#c9ced2]', className)} aria-hidden>
      {photo !== 'ok' && <Drawn kind={kind} />}
      {photo !== 'none' && (
        <img
          src={PHOTO[kind]}
          alt=""
          className={clsx('absolute inset-0 size-full object-cover grayscale-[35%] transition-opacity duration-500', photo === 'ok' ? 'opacity-100' : 'opacity-0')}
          onLoad={() => setPhoto('ok')}
          onError={() => setPhoto('none')}
        />
      )}
    </div>
  );
}

function Drawn({ kind }: { kind: SceneKind }) {
  const id = useId().replace(/:/g, '');
  if (kind === 'coast')
    return (
      <svg viewBox="0 0 800 340" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 size-full">
        <defs>
          <linearGradient id={`${id}sky`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#dfe2e3" />
            <stop offset="0.55" stopColor="#cdd3d6" />
            <stop offset="1" stopColor="#b7c0c6" />
          </linearGradient>
          <linearGradient id={`${id}sea`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#a7b1b8" />
            <stop offset="0.5" stopColor="#7f8b94" />
            <stop offset="1" stopColor="#56616a" />
          </linearGradient>
          <linearGradient id={`${id}fog`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#eef0f0" stopOpacity="0" />
            <stop offset="0.5" stopColor="#eef0f0" stopOpacity="0.75" />
            <stop offset="1" stopColor="#eef0f0" stopOpacity="0" />
          </linearGradient>
          <radialGradient id={`${id}sun`} cx="0.68" cy="0.42" r="0.45">
            <stop offset="0" stopColor="#ffffff" stopOpacity="0.75" />
            <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
          </radialGradient>
          <linearGradient id={`${id}rock`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#3f464c" />
            <stop offset="1" stopColor="#1f2428" />
          </linearGradient>
        </defs>
        <rect width="800" height="340" fill={`url(#${id}sky)`} />
        <rect width="800" height="340" fill={`url(#${id}sun)`} />
        {/* distant headlands */}
        <path d="M480 172 C530 160 580 158 630 162 C680 166 720 160 770 164 L800 166 L800 182 L480 182 Z" fill="#a8b1b8" opacity="0.55" />
        <rect y="178" width="800" height="162" fill={`url(#${id}sea)`} />
        {/* light on water */}
        <ellipse cx="560" cy="196" rx="190" ry="10" fill="#e3e7e8" opacity="0.28" />
        <ellipse cx="560" cy="222" rx="120" ry="5" fill="#e3e7e8" opacity="0.14" />
        <rect y="150" width="800" height="60" fill={`url(#${id}fog)`} />
        {/* wave lines */}
        {[248, 270, 296, 320].map((y, i) => (
          <path key={y} d={`M${300 + i * 20} ${y} C ${420 + i * 10} ${y - 4} ${560} ${y + 3} ${800} ${y - 2}`} stroke="#c9d0d4" strokeOpacity={0.25 - i * 0.04} strokeWidth="1.2" fill="none" />
        ))}
        {/* foreground rocks */}
        <path d="M0 214 C40 206 80 200 120 204 C150 190 175 186 196 192 C214 180 236 182 250 196 C276 200 300 214 330 232 C380 252 430 268 480 290 C520 306 560 322 590 340 L0 340 Z" fill={`url(#${id}rock)`} />
        <path d="M0 262 C60 250 140 252 220 270 C300 288 360 306 420 340 L0 340 Z" fill="#191d20" opacity="0.85" />
        <path d="M610 300 C640 288 680 286 720 294 C760 300 780 306 800 304 L800 340 L600 340 Z" fill="#2c3237" opacity="0.9" />
        {/* lone figure */}
        <g fill="#14171a">
          <circle cx="214" cy="160" r="4.2" />
          <path d="M209 165 L219 165 L221 183 L216 183 L215 194 L213 194 L212 183 L207 183 Z" />
        </g>
      </svg>
    );
  return (
    <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 size-full">
      <defs>
        <linearGradient id={`${id}sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#e2e4e4" />
          <stop offset="1" stopColor="#c8cdd0" />
        </linearGradient>
        <linearGradient id={`${id}fog`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#eceeee" stopOpacity="0" />
          <stop offset="1" stopColor="#eceeee" stopOpacity="0.9" />
        </linearGradient>
      </defs>
      <rect width="400" height="300" fill={`url(#${id}sky)`} />
      {kind === 'peaks' ? (
        <>
          <path d="M0 190 L60 150 L95 168 L150 110 L190 140 L230 96 L270 132 L320 118 L400 160 L400 300 L0 300 Z" fill="#a9b1b6" />
          <rect y="140" width="400" height="80" fill={`url(#${id}fog)`} />
          <path d="M0 230 L70 196 L120 214 L170 170 L215 200 L262 178 L330 210 L400 196 L400 300 L0 300 Z" fill="#7b858c" />
          <rect y="200" width="400" height="60" fill={`url(#${id}fog)`} opacity="0.7" />
          <path d="M0 270 L80 236 L140 252 L210 222 L280 250 L350 236 L400 248 L400 300 L0 300 Z" fill="#4c555c" />
          <path d="M150 110 L162 124 L156 126 L170 140 L150 132 Z M230 96 L242 112 L236 114 L250 128 L230 120 Z" fill="#e9ecec" opacity="0.8" />
        </>
      ) : (
        <>
          <path d="M0 160 C60 150 110 156 170 146 C230 136 300 150 400 140 L400 300 L0 300 Z" fill="#b3babf" />
          <rect y="130" width="400" height="70" fill={`url(#${id}fog)`} />
          <path d="M0 300 L0 230 L90 120 L130 150 L170 104 L240 190 L300 170 L400 236 L400 300 Z" fill="#59636a" />
          <path d="M90 120 L104 140 L96 142 L112 160 L90 150 Z M170 104 L184 126 L176 128 L194 150 L170 138 Z" fill="#dfe3e4" opacity="0.7" />
          <path d="M0 300 L0 262 L120 230 L220 260 L320 244 L400 266 L400 300 Z" fill="#2f363b" />
        </>
      )}
    </svg>
  );
}

export function QuoteCard({ quote, scene, className, layout = 'side' }: { quote: string; scene: SceneKind; className?: string; layout?: 'side' | 'overlay' }) {
  if (layout === 'overlay')
    return (
      <figure className={clsx('relative overflow-hidden rounded-xl bg-surface-2', className)}>
        <Scene kind={scene} className="absolute inset-0 opacity-90" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#eceae5] via-[#eceae5]/80 to-transparent dark:from-[#212428] dark:via-[#212428]/80" aria-hidden />
        <blockquote className="font-display relative max-w-[62%] p-5 text-[19px] leading-snug text-ink">“{quote}”</blockquote>
      </figure>
    );
  return (
    <figure className={clsx('flex items-stretch gap-4 overflow-hidden rounded-xl bg-surface-2 p-4', className)}>
      <blockquote className="font-display flex flex-1 items-center text-[20px] leading-snug text-ink">“{quote}”</blockquote>
      <Scene kind={scene} className="w-[38%] shrink-0 rounded-md" />
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
