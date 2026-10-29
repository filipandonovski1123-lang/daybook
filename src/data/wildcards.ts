import type { ChallengeTheme } from '../domain/types';
import type { LibraryItem } from './challenges';

/** Standalone growth challenges used as wildcard days between track steps. */
function w(id: string, title: string, theme: ChallengeTheme, category: string, difficulty: number, minutes: number, objective: string, why: string, steps: string[], safety: string[] = []): LibraryItem {
  return {
    id,
    pack: 'growth',
    theme,
    title,
    category,
    difficulty,
    estimatedMinutes: minutes,
    objective,
    description: why,
    bonus: null,
    preparation: [],
    equipment: [],
    learningPlan: steps,
    safety,
    metrics: [],
    criteria: [{ id: 'main', label: objective }],
    pbKeys: [],
    tools: [],
    evidence: { enabled: true, accept: 'image/*,video/*,audio/*,application/pdf', label: 'Evidence (optional)' },
    stretchGoal: null,
  };
}

const PEOPLE = ['Respect other people’s time, privacy and boundaries.'];

export const WILDCARDS: LibraryItem[] = [
  w('read-two-hours', 'Read for Two Hours', 'mind', 'Learning', 2, 120, 'Read a non-fiction book for two focused hours and write down three ideas you’ll use.', 'Deep reading is a rare skill and a huge advantage.', ['Pick a book that matters to your goals', 'Phone away', 'Read in two one-hour blocks', 'Write three ideas and how you’ll use them']),
  w('lecture-notes', 'Learn From a Great Lecture', 'mind', 'Learning', 1, 60, 'Watch a full lecture or talk by an expert and write a one-page summary from memory.', 'Free world-class teaching is everywhere — if you actively use it.', ['Choose a lecture from a respected source', 'Watch without multitasking', 'Close it and summarise from memory', 'Check what you missed']),
  w('negotiate', 'Negotiate Something', 'social', 'Courage', 3, 45, 'Negotiate a better price, deal or arrangement for something real.', 'Negotiating is a learnable skill that pays off for life.', ['Pick something negotiable', 'Research a fair target', 'Ask politely with a reason', 'Be willing to walk away'], PEOPLE),
  w('interview-professional', 'Interview Someone About Their Job', 'practical', 'Career', 2, 90, 'Ask someone working in a field that interests you for a 20-minute chat about their job.', 'Real conversations beat any career website.', ['Find someone in a field you’re curious about', 'Ask politely for 20 minutes', 'Prepare five good questions', 'Send a thank-you afterwards'], PEOPLE),
  w('digital-cleanup', 'Clean Up Your Digital Life', 'practical', 'Life Skills', 2, 90, 'Organise your files and photos, unsubscribe from junk email and back up anything important.', 'A tidy digital life saves time and protects what matters.', ['Unsubscribe from 20 email lists', 'Organise files into a simple folder system', 'Delete duplicates and junk', 'Back up important photos and documents']),
  w('solo-trip', 'Plan and Take a Solo Day Trip', 'body', 'Independence', 3, 300, 'Plan and take a day trip somewhere new on your own.', 'Navigating somewhere new alone builds real independence.', ['Choose a safe destination', 'Plan transport, budget and timing', 'Tell someone your plan', 'Go and explore', 'Write what you learned'], ['Share your plans and location with someone you trust; stick to safe, public places.']),
  w('future-letter', 'Write a Letter to Your Future Self', 'wellbeing', 'Reflection', 1, 30, 'Write a letter to yourself one year from now: where you are, what you hope, what you promise.', 'It makes your intentions concrete and gives future-you a check-in.', ['Describe your life right now', 'Write your hopes for the year', 'Make three promises', 'Seal it or schedule it to arrive in a year']),
  w('kindness-stranger', 'An Act of Kindness for a Stranger', 'wellbeing', 'Character', 1, 20, 'Do something kind for a stranger without expecting anything back.', 'Small kindnesses change days — including yours.', ['Look for a real chance to help', 'Do it simply', 'Don’t post about it']),
  w('say-yes', 'Say Yes to Something New', 'social', 'Courage', 2, 120, 'Accept an invitation or opportunity you’d normally turn down, as long as it’s safe.', 'Growth often hides behind the things we reflexively avoid.', ['Notice the next safe invitation', 'Say yes', 'Go with curiosity', 'Reflect on what you learned'], PEOPLE),
  w('online-lesson', 'Complete a Free Course Lesson With Its Quiz', 'mind', 'Learning', 2, 75, 'Complete one lesson of a free online course in a skill you want and pass its quiz.', 'Structured courses turn curiosity into competence.', ['Pick a reputable free course', 'Complete one full lesson', 'Take the quiz', 'Review any mistakes']),
  w('mentor-ask', 'Ask Someone to Mentor You', 'social', 'Career', 4, 60, 'Ask someone more experienced for ongoing advice or a regular check-in.', 'A mentor can save you years of trial and error.', ['Pick someone you respect who’s a few steps ahead', 'Explain what you’re working on and why them', 'Ask for something small and specific', 'Follow up with thanks'], PEOPLE),
  w('family-meal', 'Cook and Host a Family Meal', 'practical', 'Cooking', 3, 180, 'Plan, cook and serve a meal for your family or housemates, then clean up.', 'Feeding people is one of the oldest ways to contribute.', ['Plan around tastes and allergies', 'Shop', 'Cook and serve', 'Clean up completely'], ['Follow food hygiene and kitchen safety.']),
];
