import type { Challenge, ChallengeTheme } from '../domain/types';
import { SIGNATURE_ITEMS, SIGNATURE_KEYS, type LibraryItem } from './challenges';
import { LIBRARY_EXTRA } from './libraryExtra';

export type { LibraryItem };

/** Every challenge a plan can use: the Signature 30 plus the wider library. */
export const LIBRARY: LibraryItem[] = [...SIGNATURE_ITEMS, ...LIBRARY_EXTRA];

const BY_ID = new Map(LIBRARY.map((i) => [i.id, i]));

export function getLibraryItem(id: string): LibraryItem | undefined {
  return BY_ID.get(id);
}

export const SIGNATURE_PLAN: string[] = [...SIGNATURE_KEYS];

export const THEMES: { id: ChallengeTheme; label: string; hint: string }[] = [
  { id: 'mind', label: 'Mind', hint: 'Memory, maths, puzzles, learning' },
  { id: 'body', label: 'Body', hint: 'Fitness, coordination, outdoors' },
  { id: 'creative', label: 'Creative', hint: 'Art, music, writing, photography' },
  { id: 'social', label: 'Social', hint: 'Speaking, languages, courage' },
  { id: 'practical', label: 'Practical', hint: 'Cooking, making, tech, life skills' },
  { id: 'wellbeing', label: 'Wellbeing', hint: 'Mindfulness, rest, reflection' },
];

/**
 * The library entry a stored challenge came from. Older data predates `libraryId`; those rows
 * were always the Signature 30 in day order, so fall back to that.
 */
export function challengeKey(c: Pick<Challenge, 'day' | 'libraryId'>): string {
  return c.libraryId ?? SIGNATURE_KEYS[c.day - 1] ?? '';
}
