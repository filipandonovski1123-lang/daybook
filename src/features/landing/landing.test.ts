import { describe, expect, it } from 'vitest';
import { buildHabits, STARTER_HABITS } from '../../data/habits';
import { trackSteps } from '../../data/tracks';
import { COURAGE_LADDER, DEMO_CHALLENGE, DEMO_HABITS } from './content';

describe('landing page content matches the real app', () => {
  it('shows the real Courage ladder', () => {
    expect(COURAGE_LADDER).toEqual(trackSteps('courage').map((s) => ({ title: s.title, minutes: s.estimatedMinutes })));
  });

  it('demos a real step and the real starter habits', () => {
    const step = trackSteps(DEMO_CHALLENGE.track)[DEMO_CHALLENGE.step - 1]!;
    expect(step.title).toBe(DEMO_CHALLENGE.title);
    const habits = buildHabits();
    expect(DEMO_HABITS.map((h) => h.id)).toEqual(STARTER_HABITS);
    for (const h of DEMO_HABITS) expect(habits.find((x) => x.id === h.id)?.name).toBe(h.name);
  });
});
