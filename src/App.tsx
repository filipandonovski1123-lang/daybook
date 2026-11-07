import { lazy, Suspense, useEffect, useState } from 'react';
import { Landing } from './features/landing/Landing';
import { AppDataProvider, useApp } from './lib/appData';
import { setPalette } from './lib/palette';
import { ToastProvider } from './lib/toast';

// Only the landing page is in the first download; setup and the app load when needed.
const Onboarding = lazy(() => import('./features/onboarding/Onboarding').then((m) => ({ default: m.Onboarding })));
const AppRoutes = lazy(() => import('./AppRoutes'));

export function App() {
  return (
    <ToastProvider>
      <AppDataProvider fallback={<Splash />}>{(state) => (state === 'ready' ? <Ready /> : <Splash />)}</AppDataProvider>
    </ToastProvider>
  );
}

function Ready() {
  const { data } = useApp();
  useThemeSync();
  // New visitors see the landing page first; "Start" opens setup.
  const [started, setStarted] = useState(false);
  if (!data.settings.onboarded || !data.program)
    return started ? (
      <Suspense fallback={<Splash />}>
        <Onboarding />
      </Suspense>
    ) : (
      <Landing
        onStart={() => {
          window.scrollTo(0, 0);
          setStarted(true);
        }}
      />
    );
  return (
    <Suspense fallback={<Splash />}>
      <AppRoutes />
    </Suspense>
  );
}

function useThemeSync() {
  const { data } = useApp();
  const { theme, palette, reducedMotion } = data.settings;
  useEffect(() => {
    const root = document.documentElement;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      // Midnight and Forest are dark-only; Editorial follows the light/dark setting.
      const dark = palette !== 'editorial' || theme === 'dark' || (theme === 'system' && mq.matches);
      root.classList.toggle('dark', dark);
      root.dataset.palette = palette;
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', getComputedStyle(root).getPropertyValue('--bg').trim() || (dark ? '#141618' : '#f2f0eb'));
      setPalette(palette);
      try {
        localStorage.setItem('theme', dark ? 'dark' : 'light');
        localStorage.setItem('palette', palette);
      } catch {
        /* ignore */
      }
    };
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [theme, palette]);
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('reduce-motion', reducedMotion === 'reduce');
    root.classList.toggle('full-motion', reducedMotion === 'full');
  }, [reducedMotion]);
}

function Splash() {
  return (
    <div className="flex min-h-dvh items-center justify-center" aria-busy="true" aria-label="Loading">
      <span className="size-6 animate-spin rounded-full border-2 border-accent border-r-transparent" />
    </div>
  );
}

