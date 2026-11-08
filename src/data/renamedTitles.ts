/**
 * Growth-track steps whose titles were reworded (2026-11) to read more naturally. Plans saved before
 * then still hold the old titles; `applyTitleRenames` updates the ones the person never edited.
 * Keyed by library id; ids themselves never change.
 */
export const RENAMED_TITLES: Record<string, { from: string; to: string }> = {
  'focus-1': { from: 'One Deep-Work Block', to: 'Focus for 25 Minutes' },
  'focus-3': { from: 'Eat the Frog', to: 'Do the Hardest Task First' },
  'focus-4': { from: 'The Two-Block Morning', to: 'Two Focus Sessions Before Noon' },
  'focus-6': { from: 'Plan Your Week Like a Pro', to: 'Plan Your Week' },
  'focus-8': { from: 'The Phone-Free Productive Day', to: 'A Productive Day Without Your Phone' },
  'fitness-8': { from: 'The Fitness Boss Test', to: 'The Final Fitness Test' },
  'energy-2': { from: 'Water and a Real Breakfast', to: 'Start the Day with Water and Breakfast' },
  'energy-8': { from: 'Your Energy Operating System', to: 'Design Your Ideal Daily Routine' },
  'speaking-2': { from: 'Kill the Filler Words', to: 'Cut Your Filler Words' },
  'speaking-4': { from: 'Impromptu Speaking Drill', to: 'Speak Without Preparing' },
  'writing-2': { from: 'Halve a Real Message', to: 'Cut a Message in Half' },
  'writing-4': { from: 'One-Page Summary of a Hard Chapter', to: 'Summarise a Hard Chapter on One Page' },
  'learning-6': { from: 'First Result in One Day', to: 'Learn Something New in a Day' },
  'learning-8': { from: 'Deep-Dive Mastery Day', to: 'Master One Topic in a Day' },
  'courage-1': { from: 'Map Your Comfort Zone', to: 'List What You Avoid' },
  'courage-2': { from: 'Make a Small Ask', to: 'Ask for Something Small' },
  'courage-3': { from: 'Rejection Reps', to: 'Get Comfortable Hearing No' },
  'courage-4': { from: 'Speak First', to: 'Talk to Three New People' },
  'courage-7': { from: 'Go After an Opportunity', to: 'Apply for Something That Stretches You' },
  'character-8': { from: 'Your Personal Charter', to: 'Write Down What You Stand For' },
  'direction-3': { from: 'Life Audit', to: 'Rate Every Area of Your Life' },
  'direction-8': { from: 'Your Personal Operating Manual', to: 'Write a Guide to How You Work Best' },
  'resilience-8': { from: 'A Deliberately Hard Day', to: 'Stay Calm Through a Hard Day' },
  'selfreliance-6': { from: 'Life Admin Power Session', to: 'Catch Up on Life Admin' },
  'selfreliance-8': { from: 'The Independent Day', to: 'Run Your Own Life for a Day' },
};
