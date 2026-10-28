import { CalendarX2 } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { Badge, Button, Card, Checkbox, Field, Input, Select, Textarea } from '../../components/ui';
import { acknowledgeMissed } from '../../db/actions';
import { addDays, formatDate } from '../../domain/dates';
import { ackResponse, MISSED_ADJUSTMENTS, MISSED_REASONS } from '../../domain/messages';
import type { Challenge, MissedAdjustment, MissedReason } from '../../domain/types';
import { useAction, useApp } from '../../lib/appData';

/**
 * Missed challenges stay missed until the user decides what to do. In Hard Mode this is presented
 * as a required check-in; in Standard mode it's a gentle prompt. Nothing is ever auto-completed or shifted.
 */
export function MissedAcknowledgement({ challenges, required }: { challenges: Challenge[]; required: boolean }) {
  const [index, setIndex] = useState(0);
  const [hidden, setHidden] = useState(false);
  const c = challenges[Math.min(index, challenges.length - 1)];
  if (!c || (hidden && !required)) return null;
  return (
    <Card className={required ? 'border-danger/40 p-5' : 'p-5'} aria-labelledby="missed-title">
      <div className="mb-3 flex items-center gap-2">
        <CalendarX2 className="size-5 text-danger" aria-hidden />
        <h2 id="missed-title" className="font-semibold">
          {required ? 'Acknowledge your missed commitment' : 'A challenge was missed'}
        </h2>
        {challenges.length > 1 && <Badge tone="danger">{challenges.length} open</Badge>}
        {!required && (
          <Button size="sm" variant="ghost" className="ml-auto" onClick={() => setHidden(true)}>
            Not now
          </Button>
        )}
      </div>
      <AckForm key={c.id} challenge={c} others={challenges.filter((x) => x.id !== c.id)} required={required} onDone={() => setIndex(0)} />
    </Card>
  );
}

function AckForm({ challenge, others, required, onDone }: { challenge: Challenge; others: Challenge[]; required: boolean; onDone: () => void }) {
  const { data, today } = useApp();
  const original = data.program ? addDays(data.program.startDate, challenge.day - 1) : today;
  const [reason, setReason] = useState<MissedReason | ''>('');
  const [adjustment, setAdjustment] = useState<MissedAdjustment | ''>('');
  const [date, setDate] = useState(addDays(today, 1));
  const [note, setNote] = useState('');
  const [applyAll, setApplyAll] = useState(false);
  const bulk = applyAll && adjustment !== 'reschedule' && others.length > 0;
  const save = useAction(async () => {
    const ack = { reason: reason as MissedReason, adjustment: adjustment as MissedAdjustment, note, rescheduleTo: adjustment === 'reschedule' ? date : null };
    await acknowledgeMissed(challenge.id, ack);
    // Bulk acknowledgement: same reason for each, but every challenge keeps its own record.
    if (bulk) for (const o of others) await acknowledgeMissed(o.id, ack);
    return true;
  }, { success: () => (reason ? ackResponse(reason) : null) });
  return (
    <div>
      <p className="text-sm text-ink-2">
        <Link to={`/challenges/${challenge.id}`} className="font-semibold text-ink hover:underline">
          Day {challenge.day}: {challenge.title}
        </Link>{' '}
        was due {formatDate(original, 'short')} and wasn’t finished. {required ? 'You missed this target. What prevented it, and what are you changing?' : 'What got in the way? Pick an adjustment, or leave it for now.'}
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Field label="What prevented it?" htmlFor={`r-${challenge.id}`}>
          <Select id={`r-${challenge.id}`} value={reason} onChange={(e) => setReason(e.target.value as MissedReason)}>
            <option value="" disabled>
              Choose a reason
            </option>
            {Object.entries(MISSED_REASONS).map(([k, v]) => (
              <option key={k} value={k}>
                {v.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Practical adjustment" htmlFor={`a-${challenge.id}`}>
          <Select id={`a-${challenge.id}`} value={adjustment} onChange={(e) => setAdjustment(e.target.value as MissedAdjustment)}>
            <option value="" disabled>
              Choose an adjustment
            </option>
            {Object.entries(MISSED_ADJUSTMENTS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
        </Field>
        {adjustment === 'reschedule' && (
          <Field label="Catch-up date" htmlFor={`d-${challenge.id}`}>
            <Input id={`d-${challenge.id}`} type="date" min={today} value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
        )}
        <Field label="Note (optional)" htmlFor={`n-${challenge.id}`} className="sm:col-span-2">
          <Textarea id={`n-${challenge.id}`} value={note} maxLength={1000} onChange={(e) => setNote(e.target.value)} className="min-h-[56px]" />
        </Field>
      </div>
      {others.length > 0 && (
        <div className="mt-3">
          <Checkbox checked={applyAll} onChange={setApplyAll} disabled={adjustment === 'reschedule'} label={<span className="text-sm">Apply to all {others.length + 1} missed challenges{adjustment === 'reschedule' ? ' (pick catch-up dates one at a time)' : ''}</span>} />
        </div>
      )}
      {reason && MISSED_REASONS[reason].valid && <p className="mt-3 text-xs text-success">That’s a legitimate reason to adjust the plan. No penalty — the record just shows what happened.</p>}
      <div className="mt-4 flex justify-end">
        <Button
          variant="primary"
          busy={save.busy}
          disabled={!reason || !adjustment || (adjustment === 'reschedule' && (!date || date < today))}
          onClick={async () => {
            if (await save.run()) onDone();
          }}
        >
          {required ? 'Acknowledge' : 'Save'}
        </Button>
      </div>
    </div>
  );
}
