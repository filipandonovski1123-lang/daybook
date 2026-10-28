import { useMemo } from 'react';
import { fullLibrary, getLibraryItem, type LibraryItem } from '../data/library';
import { useApp } from './appData';

/** The built-in library plus the user's own challenges, with a lookup that also knows rest days. */
export function useLibrary(): { items: LibraryItem[]; get: (id: string) => LibraryItem | undefined } {
  const { data } = useApp();
  return useMemo(() => {
    const items = fullLibrary(data.customChallenges);
    const byId = new Map(items.map((i) => [i.id, i]));
    return { items, get: (id: string) => byId.get(id) ?? getLibraryItem(id) };
  }, [data.customChallenges]);
}
