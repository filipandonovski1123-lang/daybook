import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { App } from './App';
import { ensureSeeded, updateSettings } from './db/actions';
import { db } from './db/db';
import { addDays, todayIn } from './domain/dates';

beforeAll(() => {
  // jsdom gaps
  window.matchMedia ??= ((q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {}, onchange: null, addListener() {}, removeListener() {}, dispatchEvent: () => false })) as unknown as typeof window.matchMedia;
  window.scrollTo = () => {};
});

beforeEach(async () => {
  await db.delete();
  await db.open();
  await ensureSeeded();
  await updateSettings({ timezone: 'Australia/Sydney' });
  window.location.hash = '#/';
});

describe('app', () => {
  it('onboards with a future start date and shows the countdown, then logs a habit that persists', async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText('Thirty days. Thirty new skills.');
    await user.type(screen.getByLabelText(/What should we call you/), 'Sam');
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    // Start date is required: Continue is disabled until one is chosen.
    expect(screen.getByRole('button', { name: 'Pick a date' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Tomorrow' }));
    const tomorrow = addDays(todayIn('Australia/Sydney'), 1);
    expect(screen.getByLabelText('Start date')).toHaveValue(tomorrow);
    expect(screen.getByText(/Day 30:/)).toBeInTheDocument();

    for (let i = 0; i < 5; i++) await user.click(screen.getByRole('button', { name: 'Continue' }));
    await user.click(screen.getByRole('radio', { name: /^Hard Mode/ }));
    await user.click(screen.getByRole('button', { name: 'Start my program' }));

    await screen.findByText(/Starts in 1 day/);
    expect((await db.program.get('program'))?.startDate).toBe(tomorrow);
    expect((await db.settings.get('settings'))?.hardMode).toBe(true);
    // Hard Mode bar only appears once the program is active.
    expect(screen.queryByText(/left today/)).not.toBeInTheDocument();

    // One-tap habit logging persists to IndexedDB.
    await user.click(screen.getByRole('button', { name: 'Complete Room reset' }));
    const today = todayIn('Australia/Sydney');
    await waitFor(async () => expect((await db.habitEntries.get(`tidy|${today}`))?.status).toBe('done'));
    expect(await screen.findByRole('button', { name: 'Undo Room reset' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('keeps the private habit discreet and lets it be hidden from Today', async () => {
    await db.program.put({ id: 'program', name: '30-Day Challenge', startDate: todayIn('Australia/Sydney'), endDate: addDays(todayIn('Australia/Sydney'), 29), startedAt: null, history: [] });
    await updateSettings({ onboarded: true });
    render(<App />);
    await screen.findByText(/Day 1/, { selector: 'h1' });
    const personal = screen.getByRole('heading', { name: 'Personal habit goals' }).closest('section, div')!;
    expect(within(personal as HTMLElement).getByText('Personal habit goal')).toBeInTheDocument();
    expect(screen.queryByText(/sexual|porn/i)).not.toBeInTheDocument();
    await updateSettings({ hideSensitiveOnToday: true });
    await waitFor(() => expect(screen.queryByText('Personal habit goal')).not.toBeInTheDocument());
  });

  it('every navigation item is a reachable link', async () => {
    await db.program.put({ id: 'program', name: '30-Day Challenge', startDate: todayIn('Australia/Sydney'), endDate: addDays(todayIn('Australia/Sydney'), 29), startedAt: null, history: [] });
    await updateSettings({ onboarded: true });
    render(<App />);
    await screen.findByText(/Day 1/, { selector: 'h1' });
    const navs = screen.getAllByRole('navigation', { name: 'Main' });
    for (const nav of navs) {
      for (const name of ['Today', 'Challenges', 'Habits', 'Progress', 'Settings']) expect(within(nav).getByRole('link', { name })).toBeInTheDocument();
    }
    expect(screen.getByText('Skip to content')).toBeInTheDocument();
  });
});
