import { lazy, Suspense, useEffect } from 'react';
import { HashRouter, Navigate, Route, Routes } from 'react-router';
import { Shell } from './components/Shell';
import { ChallengeDetailPage } from './features/challenges/ChallengeDetailPage';
import { ChallengesPage } from './features/challenges/ChallengesPage';
import { HabitsPage } from './features/habits/HabitsPage';
import { Onboarding } from './features/onboarding/Onboarding';
import { SettingsPage } from './features/settings/SettingsPage';
import { TodayPage } from './features/today/TodayPage';
import { AppDataProvider, useApp } from './lib/appData';
import { ReminderScheduler } from './lib/reminderScheduler';
import { ToastProvider } from './lib/toast';

const ProgressPage = lazy(() => import('./features/progress/ProgressPage'));
const ToolsPage = lazy(() => import('./features/tools/ToolsPage'));

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
  if (!data.settings.onboarded || !data.program) return <Onboarding />;
  return (
    <HashRouter>
      <ReminderScheduler>
        <Shell>
          <Suspense fallback={<PageSpinner />}>
            <Routes>
              <Route path="/" element={<TodayPage />} />
              <Route path="/challenges" element={<ChallengesPage />} />
              <Route path="/challenges/:id" element={<ChallengeDetailPage />} />
              <Route path="/habits" element={<HabitsPage />} />
              <Route path="/progress" element={<ProgressPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/tools" element={<ToolsPage />} />
              <Route path="/tools/:tool" element={<ToolsPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </Shell>
      </ReminderScheduler>
    </HashRouter>
  );
}

function useThemeSync() {
  const { data } = useApp();
  const { theme, reducedMotion } = data.settings;
  useEffect(() => {
    const root = document.documentElement;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const dark = theme === 'dark' || (theme === 'system' && mq.matches);
      root.classList.toggle('dark', dark);
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0b0d12' : '#f6f7f9');
      try {
        localStorage.setItem('theme', dark ? 'dark' : 'light');
      } catch {
        /* ignore */
      }
    };
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [theme]);
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

function PageSpinner() {
  return (
    <div className="flex justify-center py-24" aria-busy="true" aria-label="Loading">
      <span className="size-5 animate-spin rounded-full border-2 border-accent border-r-transparent" />
    </div>
  );
}
