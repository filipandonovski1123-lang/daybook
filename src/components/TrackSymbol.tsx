import clsx from 'clsx';
import { TRACK_BY_ID } from '../data/tracks';

/**
 * A track's line symbol (public/symbols/<track>.png). The PNG is used as a mask over the current text
 * colour, so one file works in light and dark themes and inherits any text colour.
 */
export function TrackSymbol({ track, className }: { track: string | null | undefined; className?: string }) {
  if (!track || !TRACK_BY_ID.has(track)) return null;
  const url = `url(./symbols/${track}.png)`;
  return <span aria-hidden className={clsx('inline-block shrink-0 bg-current', className ?? 'size-4')} style={{ maskImage: url, WebkitMaskImage: url, maskSize: 'contain', WebkitMaskSize: 'contain', maskRepeat: 'no-repeat', WebkitMaskRepeat: 'no-repeat', maskPosition: 'center', WebkitMaskPosition: 'center' }} />;
}
