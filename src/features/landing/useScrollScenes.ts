import { useEffect, useState } from 'react';
import { prefersReducedMotion } from '../../lib/motion';

export type SceneMode = 'pin' | 'hero' | 'pass';

/** Progress (0–1) of a scene, from its on-screen box and the viewport height. */
export function sceneProgress(mode: SceneMode, top: number, height: number, vh: number): number {
  const p = mode === 'pin' ? -top / Math.max(1, height - vh) : mode === 'hero' ? -top / Math.max(1, height) : (vh - top) / (vh * 0.75);
  return Math.min(1, Math.max(0, p));
}

/**
 * Scroll-driven scenes for the landing page. Elements opt in with `data-scroll`:
 *   "pin"  — a tall section with a sticky inner; --p runs 0→1 while it's pinned
 *   "hero" — --p runs 0→1 as the element scrolls up out of view
 *   "pass" — --p runs 0→1 as the element rises from the bottom edge to about a quarter up the screen
 * --p is written straight to each element's style (no React re-renders) and CSS turns it into motion.
 * `data-reveal` elements fade up once when they first come into view.
 * Returns false when motion is reduced, so the page lays out statically.
 */
export function useScrollScenes(): boolean {
  const [motion] = useState(() => !prefersReducedMotion());

  useEffect(() => {
    if (!motion) return;
    const scenes = [...document.querySelectorAll<HTMLElement>('[data-scroll]')];
    let raf = 0;
    const update = () => {
      raf = 0;
      const vh = window.innerHeight;
      for (const el of scenes) {
        const r = el.getBoundingClientRect();
        if (r.bottom < -vh || r.top > 2 * vh) continue; // off screen: leave it be
        el.style.setProperty('--p', sceneProgress(el.dataset.scroll as SceneMode, r.top, r.height, vh).toFixed(4));
      }
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);

    const reveals = [...document.querySelectorAll<HTMLElement>('[data-reveal]')];
    let io: IntersectionObserver | undefined;
    if (typeof IntersectionObserver === 'undefined') reveals.forEach((el) => el.classList.add('is-in'));
    else {
      io = new IntersectionObserver(
        (entries) => {
          for (const e of entries)
            if (e.isIntersecting) {
              e.target.classList.add('is-in');
              io?.unobserve(e.target);
            }
        },
        { rootMargin: '0px 0px -8% 0px' },
      );
      reveals.forEach((el) => io!.observe(el));
    }

    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (raf) cancelAnimationFrame(raf);
      io?.disconnect();
    };
  }, [motion]);

  return motion;
}
