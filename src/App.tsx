import { lazy, Suspense, useEffect, type ReactNode } from 'react';
import { HashRouter, Navigate, Route, Routes, useLocation } from 'react-router';
import { Shell } from './components/Shell';
import { ChallengeDetailPage, CurrentChallengeRedirect } from './features/challenges/ChallengeDetailPage';
import { ChallengesPage } from './features/challenges/ChallengesPage';
import { HabitsPage } from './features/habits/HabitsPage';
import { LibraryPage } from './features/library/LibraryPage';
import { MorePage } from './features/more/MorePage';
import { Onboarding } from './features/onboarding/Onboarding';
import { PlanPage } from './features/plan/PlanPage';
import { ReflectionPage } from './features/reflection/ReflectionPage';
import { SettingsPage } from './features/settings/SettingsPage';
import { SummaryPage } from './features/summary/SummaryPage';
import { TodayPage } from './features/today/TodayPage';
import { AppDataProvider, useApp } from './lib/appData';
import { CompletionMoment } from './lib/motion';
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
            <PageTransition>
            <Routes>
              <Route path="/" element={<TodayPage />} />
              <Route path="/calendar" element={<ChallengesPage />} />
              <Route path="/challenges" element={<Navigate to="/calendar" replace />} />
              <Route path="/challenge" element={<CurrentChallengeRedirect />} />
              <Route path="/reflection" element={<ReflectionPage />} />
              <Route path="/more" element={<MorePage />} />
              <Route path="/plan" element={<PlanPage />} />
              <Route path="/library" element={<LibraryPage />} />
              <Route path="/summary" element={<SummaryPage />} />
              <Route path="/challenges/:id" element={<ChallengeDetailPage />} />
              <Route path="/habits" element={<HabitsPage />} />
              <Route path="/progress" element={<ProgressPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/tools" element={<ToolsPage />} />
              <Route path="/tools/:tool" element={<ToolsPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
            </PageTransition>
          </Suspense>
        </Shell>
        <CompletionMoment />
      </ReminderScheduler>
    </HashRouter>
  );
}

/** Remounts on route change so each screen enters with a soft fade-and-rise. */
function PageTransition({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  return (
    <div key={pathname} className="animate-page">
      {children}
    </div>
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
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#141618' : '#f2f0eb');
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
