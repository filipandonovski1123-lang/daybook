import type { Habit } from '../domain/types';

/**
 * Canonical habit seed. Weekly rotation (0 = Sunday):
 *   Mon fitness + quarterback · Tue mobility + reading emphasis · Wed fitness + finance
 *   Thu quarterback · Fri fitness + confidence · Sat flexible · Sun recovery, reflection, planning
 * Everything is editable later; the 30-day challenge is tracked separately and never overridden.
 */

const ALL = [0, 1, 2, 3, 4, 5, 6];

type HabitSeed = Pick<Habit, 'id' | 'name' | 'description' | 'kind' | 'category' | 'input' | 'section' | 'days'> & Partial<Habit>;

const SEEDS: HabitSeed[] = [
  // ---- Essentials (daily)
  { id: 'sleep', name: 'Sleep', category: 'Recovery', kind: 'build', input: 'sleep', section: 'essential', days: ALL, target: 8, targetMax: 10, unit: 'h', description: 'Aim for 8–10 hours. Log last night’s bedtime and wake time. More sleep is never penalised; less is never rewarded.' },
  { id: 'reading', name: 'Reading', category: 'Learning', kind: 'build', input: 'minutes', section: 'essential', days: ALL, target: 20, unit: 'min', description: '20 minutes of reading. Tuesday is a reading-emphasis day — go longer if you want.' },
  { id: 'focus', name: 'Focus session', category: 'Focus', kind: 'build', input: 'minutes', section: 'essential', days: ALL, target: 30, unit: 'min', description: 'One distraction-free 30-minute session. Phone in another room. Use the built-in focus timer.' },
  { id: 'tidy', name: 'Room reset', category: 'Environment', kind: 'build', input: 'check', section: 'essential', days: ALL, description: 'About 10 minutes tidying your room.' },

  // ---- Rotating weekly
  { id: 'fitness', name: 'Fitness', category: 'Fitness', kind: 'build', input: 'activity', section: 'scheduled', days: [1, 3, 5], options: ['Strength', 'Running', 'Cardio', 'Sport', 'Bodyweight', 'Swimming', 'Walk', 'Rest / recovery'], description: 'Balanced training with recovery days. Log the type of training — no calorie tracking. Rest is a valid choice.' },
  { id: 'quarterback', name: 'Quarterback development', category: 'Football', kind: 'build', input: 'activity', section: 'scheduled', days: [1, 4], options: ['Throwing', 'Mechanics / footwork', 'Film / learning', 'Rest / recovery'], description: 'Throwing, mechanics or football-learning sessions. Mark rest days when your arm needs them.' },
  { id: 'mobility', name: 'Mobility', category: 'Fitness', kind: 'build', input: 'minutes', section: 'scheduled', days: [2, 0], target: 10, unit: 'min', description: 'About 10 minutes of comfortable mobility work. Nothing should hurt.' },
  { id: 'finance', name: 'Financial knowledge', category: 'Learning', kind: 'build', input: 'minutes', section: 'scheduled', days: [3], target: 15, unit: 'min', description: '15 minutes on budgeting, saving or investing fundamentals.' },
  { id: 'confidence', name: 'Confidence action', category: 'Growth', kind: 'build', input: 'text', section: 'scheduled', days: [5], description: 'One small, self-chosen confidence-building action. Write down what you attempted.' },
  { id: 'flexible', name: 'Flexible activity', category: 'Interests', kind: 'build', input: 'activity', section: 'scheduled', days: [6], options: ['Personal project', 'Sport / outdoors', 'Creative', 'Social', 'Learning', 'Rest'], description: 'Saturday: something active or a personal interest, your choice.' },
  { id: 'weekly-review', name: 'Weekly reflection & plan', category: 'Planning', kind: 'build', input: 'check', section: 'scheduled', days: [0], description: 'Sunday: recover, review the week and plan the next one.' },

  // ---- Reduce
  { id: 'scrolling', name: 'Short-form scrolling', category: 'Screen time', kind: 'reduce', input: 'limit', section: 'personal', days: ALL, targetMax: 30, unit: 'min', description: 'Time on short-form video/feeds. Default budget 30 minutes or less — adjust to suit you.' },
  { id: 'gaming', name: 'Gaming budget', category: 'Screen time', kind: 'reduce', input: 'limit', section: 'personal', days: ALL, targetMax: 90, unit: 'min', description: 'Gaming isn’t the problem — going over your own budget is. Set the budget that works for you.' },
  { id: 'procrastination', name: 'Priority first', category: 'Focus', kind: 'reduce', input: 'yesno', section: 'personal', days: ALL, description: 'Did you start your highest-priority activity before optional entertainment?' },
  { id: 'phone', name: 'Phone-free periods', category: 'Screen time', kind: 'reduce', input: 'count', section: 'personal', days: ALL, target: 2, unit: 'periods', config: { period1: '09:00–11:00', period2: '19:00–20:00' }, description: 'Two configurable phone-free periods each day.' },
  { id: 'snacking', name: 'Mindful eating', category: 'Wellbeing', kind: 'reduce', input: 'awareness', section: 'personal', days: ALL, options: ['Regular, satisfying meals', 'Noticed boredom snacking and paused', 'Noticed afterwards', 'Nothing to note'], description: 'Awareness only — no calorie counting, no restriction, no guilt. Regular, satisfying meals help most.' },
  {
    id: 'personal',
    name: 'Personal habit goal',
    discreetName: 'Personal habit goal',
    category: 'Personal',
    kind: 'reduce',
    input: 'private',
    section: 'personal',
    days: ALL,
    sensitive: true,
    visibility: 'discreet',
    options: ['On track', 'Difficult moment — managed it', 'Slipped'],
    description: 'A private goal for healthier control of a habit you choose. Define it in your own words; only general progress, triggers and coping strategies are tracked. Never shown in notifications.',
  },

  // ---- Evening routine
  { id: 'screens-away', name: 'Screens away before bed', category: 'Sleep', kind: 'reduce', input: 'yesno', section: 'evening', days: ALL, description: 'Screens put away roughly 30–60 minutes before bedtime.' },
];

export function buildHabits(): Habit[] {
  return SEEDS.map((s, i) => ({
    discreetName: null,
    target: null,
    targetMax: null,
    unit: null,
    options: [],
    definition: '',
    visibility: 'normal',
    sensitive: false,
    enabled: true,
    config: {},
    ...s,
    order: i,
  }));
}
