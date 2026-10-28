import type { Challenge, ChallengeTheme, CustomChallenge } from '../domain/types';
import { REST_ID, REST_ITEM, SIGNATURE_ITEMS, SIGNATURE_KEYS, type LibraryItem } from './challenges';
import { LIBRARY_EXTRA } from './libraryExtra';

export type { LibraryItem };

/** Every challenge a plan can use: the Signature 30 plus the wider library. */
export const LIBRARY: LibraryItem[] = [...SIGNATURE_ITEMS, ...LIBRARY_EXTRA];

const BY_ID = new Map(LIBRARY.map((i) => [i.id, i]));

/** Built-in challenges and the rest day. User-made ones live in the database (see customToItem). */
export function getLibraryItem(id: string): LibraryItem | undefined {
  return id === REST_ID ? REST_ITEM : BY_ID.get(id);
}

/** A user-made challenge in library form, so plans and pickers treat it like any other. */
export function customToItem(c: CustomChallenge): LibraryItem {
  return {
    id: c.id,
    theme: c.theme,
    title: c.title,
    category: c.category,
    difficulty: c.difficulty,
    estimatedMinutes: c.estimatedMinutes,
    objective: c.objective,
    description: c.description,
    bonus: null,
    preparation: c.preparation,
    equipment: [],
    learningPlan: c.learningPlan,
    safety: [],
    metrics: [],
    criteria: [{ id: 'main', label: c.objective }],
    pbKeys: [],
    tools: [],
    evidence: { enabled: true, accept: 'image/*,video/*,audio/*,application/pdf', label: 'Evidence (optional)' },
    stretchGoal: null,
  };
}

/** Built-in library plus the user's own challenges. */
export function fullLibrary(custom: readonly CustomChallenge[]): LibraryItem[] {
  return [...LIBRARY, ...custom.map(customToItem)];
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
