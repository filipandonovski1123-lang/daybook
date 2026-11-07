import { describe, expect, it } from 'vitest';
import { sceneProgress } from './useScrollScenes';

describe('landing scroll scenes', () => {
  const vh = 800;
  it('runs a pinned section from 0 to 1 while it is stuck to the screen', () => {
    const height = 2400; // 3 screens tall: pinned for 1600px of scrolling
    expect(sceneProgress('pin', 100, height, vh)).toBe(0); // not reached yet
    expect(sceneProgress('pin', 0, height, vh)).toBe(0);
    expect(sceneProgress('pin', -800, height, vh)).toBe(0.5);
    expect(sceneProgress('pin', -1600, height, vh)).toBe(1);
    expect(sceneProgress('pin', -2000, height, vh)).toBe(1); // scrolled past
  });

  it('fades the hero out as it scrolls off the top', () => {
    expect(sceneProgress('hero', 0, 600, vh)).toBe(0);
    expect(sceneProgress('hero', -300, 600, vh)).toBe(0.5);
    expect(sceneProgress('hero', -900, 600, vh)).toBe(1);
  });

  it('plays a pass scene as it rises from the bottom edge', () => {
    expect(sceneProgress('pass', vh, 200, vh)).toBe(0); // just below the screen
    expect(sceneProgress('pass', vh - 300, 200, vh)).toBe(0.5);
    expect(sceneProgress('pass', 100, 200, vh)).toBe(1);
  });
});
