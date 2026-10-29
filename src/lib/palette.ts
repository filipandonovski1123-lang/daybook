import { useSyncExternalStore } from 'react';
import type { Palette } from '../domain/types';

/** The active colour theme, shared with components outside the app-data tree (e.g. photos). */
let current: Palette = readInitial();
const listeners = new Set<() => void>();

function readInitial(): Palette {
  const p = typeof document === 'undefined' ? undefined : document.documentElement.dataset.palette;
  return p === 'midnight' || p === 'forest' || p === 'athletic' ? p : 'editorial';
}

export function setPalette(p: Palette) {
  if (p === current) return;
  current = p;
  listeners.forEach((fn) => fn());
}

export function usePalette(): Palette {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    () => current,
    () => 'editorial' as const,
  );
}
