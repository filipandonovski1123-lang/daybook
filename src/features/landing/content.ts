/**
 * The few real challenge and habit names the landing page shows, copied here so the page doesn't
 * download the whole challenge library. landing.test.ts fails if any of them drift from the library.
 */

/** Courage & Confidence, steps 1–8: title and estimated minutes. */
export const COURAGE_LADDER: { title: string; minutes: number }[] = [
  { title: 'Map Your Comfort Zone', minutes: 20 },
  { title: 'Make a Small Ask', minutes: 20 },
  { title: 'Rejection Reps', minutes: 45 },
  { title: 'Speak First', minutes: 30 },
  { title: 'Ask for Honest Feedback', minutes: 45 },
  { title: 'Cold-Email Someone You Admire', minutes: 60 },
  { title: 'Go After an Opportunity', minutes: 120 },
  { title: 'Do the Thing You’ve Been Afraid Of', minutes: 180 },
];

/** The demo day in the phone: Courage step 2 plus the four starter habits. */
export const DEMO_CHALLENGE = { title: COURAGE_LADDER[1]!.title, track: 'courage', step: 2 };
export const DEMO_HABITS: { id: string; name: string; detail: string }[] = [
  { id: 'sleep', name: 'Sleep', detail: '8.5–10 h' },
  { id: 'reading', name: 'Reading', detail: '20 min' },
  { id: 'focus', name: 'Focus session', detail: '30 min' },
  { id: 'fitness', name: 'Fitness', detail: 'Strength' },
];
