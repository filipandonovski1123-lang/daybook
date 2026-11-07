import type { ChallengeTheme, LifeStage } from '../domain/types';

/** Track names, blurbs and suggestions — small, so the landing page can use them without the steps. */
export interface TrackDef {
  id: string;
  title: string;
  theme: ChallengeTheme;
  blurb: string;
}

export const TRACKS: TrackDef[] = [
  { id: 'focus', title: 'Focus & Discipline', theme: 'mind', blurb: 'Deep work, beating procrastination, keeping promises to yourself.' },
  { id: 'fitness', title: 'Strength & Fitness', theme: 'body', blurb: 'From a baseline test to a 4-week plan and a real fitness milestone.' },
  { id: 'energy', title: 'Sleep, Food & Energy', theme: 'wellbeing', blurb: 'Sleep, real food and recovery — the base everything else runs on.' },
  { id: 'speaking', title: 'Public Speaking', theme: 'social', blurb: 'From a 1-minute recording to speaking in front of a real audience.' },
  { id: 'writing', title: 'Clear Writing', theme: 'creative', blurb: 'Write messages people act on, then publish something real.' },
  { id: 'relationships', title: 'Listening & Relationships', theme: 'social', blurb: 'Listen properly, reconnect, repair and deepen the relationships that matter.' },
  { id: 'courage', title: 'Courage & Confidence', theme: 'social', blurb: 'Ask, risk a no, speak first and go after real opportunities.' },
  { id: 'money', title: 'Money', theme: 'practical', blurb: 'Real numbers, a real budget, an emergency fund and earning your own money.' },
  { id: 'career', title: 'Career & Craft', theme: 'practical', blurb: 'Pick a valuable skill and take it to a shipped project and portfolio.' },
  { id: 'learning', title: 'Learn Anything Faster', theme: 'mind', blurb: 'The science of learning, applied until you can teach it.' },
  { id: 'character', title: 'Character & Contribution', theme: 'wellbeing', blurb: 'Values, integrity, responsibility and making things better for others.' },
  { id: 'direction', title: 'Self-Knowledge & Direction', theme: 'wellbeing', blurb: 'Know your strengths, set direction and build systems to get there.' },
  { id: 'resilience', title: 'Calm & Resilience', theme: 'wellbeing', blurb: 'Handle stress, setbacks and criticism without falling apart.' },
  { id: 'selfreliance', title: 'Self-Reliance', theme: 'practical', blurb: 'Cook, fix, organise and handle life admin like a capable adult.' },
];

export const TRACK_BY_ID = new Map(TRACKS.map((t) => [t.id, t]));

/** Tracks suggested by "choose for me", by life stage. */
export const LIFE_STAGES: { value: LifeStage; label: string; body: string }[] = [
  { value: 'student', label: 'Student', body: 'At school, college or university.' },
  { value: 'early', label: 'Starting out', body: 'Early in work or finding your direction.' },
  { value: 'established', label: 'Established', body: 'Settled in work, family or both.' },
];

/** "Public Speaking · step 3 of 8" for track days, otherwise the category. */
export function challengeLabel(c: { category: string; track?: string | null; step?: number | null }): string {
  const t = c.track ? TRACK_BY_ID.get(c.track) : undefined;
  return t && c.step ? `${t.title} · step ${c.step} of 8` : c.category;
}

export const RECOMMENDED_TRACKS: Record<LifeStage, string[]> = {
  student: ['focus', 'learning', 'courage', 'money'],
  early: ['focus', 'career', 'money', 'speaking'],
  established: ['focus', 'fitness', 'relationships', 'direction'],
};

