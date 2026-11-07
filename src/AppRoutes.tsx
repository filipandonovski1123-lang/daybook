import { lazy, Suspense, type ReactNode } from 'react';
import { HashRouter, Navigate, Route, Routes, useLocation } from 'react-router';
import { Shell } from './components/Shell';
import { ChallengeDetailPage, CurrentChallengeRedirect } from './features/challenges/ChallengeDetailPage';
import { ChallengesPage } from './features/challenges/ChallengesPage';
import { HabitsPage } from './features/habits/HabitsPage';
import { LibraryPage } from './features/library/LibraryPage';
import { MorePage } from './features/more/MorePage';
import { PlanPage } from './features/plan/PlanPage';
import { ReflectionPage } from './features/reflection/ReflectionPage';
import { SettingsPage } from './features/settings/SettingsPage';
import { SummaryPage } from './features/summary/SummaryPage';
import { TodayPage } from './features/today/TodayPage';
import { CompletionMoment } from './lib/motion';
import { ReminderScheduler } from './lib/reminderScheduler';

const ProgressPage = lazy(() => import('./features/progress/ProgressPage'));
const ToolsPage = lazy(() => import('./features/tools/ToolsPage'));

/** The app itself, once set up. Loaded on demand so the landing page doesn't download it. */
export default function AppRoutes() {
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

function PageSpinner() {
  return (
    <div className="flex justify-center py-24" aria-busy="true" aria-label="Loading">
      <span className="size-5 animate-spin rounded-full border-2 border-accent border-r-transparent" />
    </div>
  );
}
