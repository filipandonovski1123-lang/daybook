import { zonedToEpoch } from './dates';
import { scheduledDateFor } from './schedule';
import type { Challenge, IsoDate, Reminder } from './types';

/** RFC 5545 text escaping. */
export function icsEscape(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

/** Fold lines longer than 75 octets (approximated by UTF-16 code units, safe for ASCII-heavy text). */
export function fold(line: string): string {
  if (line.length <= 75) return line;
  const parts: string[] = [];
  let rest = line;
  parts.push(rest.slice(0, 75));
  rest = rest.slice(75);
  while (rest.length) {
    parts.push(' ' + rest.slice(0, 74));
    rest = rest.slice(74);
  }
  return parts.join('\r\n');
}

const utc = (ms: number) => new Date(ms).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

/**
 * Calendar file with one event + alarm per reminder per program day. Calendar apps deliver these
 * reliably even when this app is closed. Times are written in UTC computed from the user's timezone,
 * so daylight-saving changes are already accounted for. No habit names are included.
 */
export function buildIcs(args: { startDate: IsoDate; timezone: string; challenges: readonly Challenge[]; reminders: readonly Reminder[]; now?: number }): string {
  const stamp = utc(args.now ?? Date.now());
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Day Challenge//Reminders//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', `X-WR-CALNAME:${args.challenges.length}-Day Challenge`];
  const sorted = [...args.challenges].sort((a, b) => a.day - b.day);
  for (const c of sorted) {
    const date = scheduledDateFor(args.startDate, c.day);
    for (const r of args.reminders) {
      if (!r.enabled) continue;
      const start = zonedToEpoch(date, r.time, args.timezone);
      const summary =
        r.type === 'morning' ? `Day ${c.day}/${sorted.length}: ${c.title}` : r.type === 'evening' ? `Day ${c.day}/${sorted.length} check-in` : 'Bedtime routine';
      const desc =
        r.type === 'morning' ? `Today's challenge: ${c.title}. Goal: ${c.objective}` : r.type === 'evening' ? 'Review your challenge, habits and progress.' : 'Start winding down. Screens away soon.';
      lines.push(
        'BEGIN:VEVENT',
        `UID:${c.id}-${r.type}-${date}@thirty-day-challenge.local`,
        `DTSTAMP:${stamp}`,
        `DTSTART:${utc(start)}`,
        `DTEND:${utc(start + 15 * 60_000)}`,
        fold(`SUMMARY:${icsEscape(summary)}`),
        fold(`DESCRIPTION:${icsEscape(desc)}`),
        'TRANSP:TRANSPARENT',
        'BEGIN:VALARM',
        'ACTION:DISPLAY',
        fold(`DESCRIPTION:${icsEscape(summary)}`),
        'TRIGGER:PT0M',
        'END:VALARM',
        'END:VEVENT',
      );
    }
  }
  lines.push('END:VCALENDAR');
  return lines.join('\r\n') + '\r\n';
}
