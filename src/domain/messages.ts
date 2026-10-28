import type { DisplayStatus, MissedAdjustment, MissedReason } from './types';

/**
 * Coach copy. Hard Mode is direct about commitments and never about the person:
 * no insults, no worth judgements, nothing about personal/sexual habits.
 */

const pick = <T,>(arr: readonly T[], seed: number): T => arr[Math.abs(seed) % arr.length] as T;

export function challengeNudge(status: DisplayStatus, hardMode: boolean, seed: number, hoursLeft: number): string | null {
  if (status === 'completed') return hardMode ? 'Done and earned. Log the details while they’re fresh.' : 'Nice work — challenge complete.';
  if (status === 'attempted') return hardMode ? 'Attempt logged. Decide whether a catch-up is worth scheduling.' : 'Attempt logged. Every attempt is data.';
  if (!hardMode) return null;
  if (status === 'in_progress') return pick(['Your challenge isn’t finished yet.', 'You committed to this. What’s your plan to finish?', 'You don’t need a perfect day. You need to take the next action.'], seed);
  if (status === 'available') {
    if (hoursLeft < 4) return 'You’ve still got time. Use it.';
    return pick(['Progress comes from what you actually do, not what you planned.', 'You committed to this. What’s your plan to finish?', 'Start with the first ten minutes. Then keep going.'], seed);
  }
  if (status === 'missed') return 'You missed this target. What are you changing today?';
  return null;
}

export const MISSED_REASONS: Record<MissedReason, { label: string; valid: boolean }> = {
  rest: { label: 'Planned rest / recovery', valid: true },
  illness: { label: 'Illness', valid: true },
  injury: { label: 'Injury or pain', valid: true },
  scheduling: { label: 'Genuine scheduling conflict', valid: true },
  equipment: { label: 'Missing equipment or access', valid: true },
  underestimated: { label: 'Underestimated the time needed', valid: false },
  low_energy: { label: 'Low energy / motivation', valid: false },
  distraction: { label: 'Got distracted', valid: false },
  other: { label: 'Other', valid: false },
};

export const MISSED_ADJUSTMENTS: Record<MissedAdjustment, string> = {
  reschedule: 'Reschedule to a specific catch-up date',
  shorter_version: 'Do a shorter version and log it as an attempt',
  start_earlier: 'Start earlier in the day next time',
  remove_blocker: 'Remove the blocker first (equipment, place, time)',
  skip_with_note: 'Leave it as missed, with a note',
};

export function ackResponse(reason: MissedReason): string {
  return MISSED_REASONS[reason].valid
    ? 'That’s a legitimate reason to adjust the plan. Recover properly, then pick it back up.'
    : 'Noted. The fix is a concrete change, not a promise. Make the adjustment specific.';
}
