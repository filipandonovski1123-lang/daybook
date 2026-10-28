import { Trash2, TrendingUp, Trophy } from 'lucide-react';
import { useState } from 'react';
import { Badge, Button, ConfirmDialog, Field, Input, Select } from '../../components/ui';
import { deleteAttempt, logAttempt } from '../../db/actions';
import { personalBests } from '../../domain/criteria';
import { formatInstant } from '../../domain/dates';
import type { Attempt, Challenge } from '../../domain/types';
import { useAction, useApp } from '../../lib/appData';

/** Append-only log of practice sessions / attempts, with personal bests computed from it. */
export function AttemptLog({ challenge }: { challenge: Challenge }) {
  const { data } = useApp();
  const attempts = data.attempts.filter((a) => a.challengeId === challenge.id);
  const { events, summaries } = personalBests(challenge, data.progress.get(challenge.id) ?? null, attempts);
  const attemptKeys = challenge.pbKeys.filter((k) => !k.baselineKey);
  const [kind, setKind] = useState<Attempt['kind']>('attempt');
  const [label, setLabel] = useState('');
  const [values, setValues] = useState<Record<string, string>>({});
  const [minutes, setMinutes] = useState('');
  const [note, setNote] = useState('');
  const [toDelete, setToDelete] = useState<string | null>(null);
  const add = useAction(
    () =>
      logAttempt({
        challengeId: challenge.id,
        kind,
        label: label.trim() || (kind === 'practice' ? 'Practice session' : kind === 'test' ? 'Test' : `Attempt ${attempts.length + 1}`),
        metrics: Object.fromEntries(Object.entries(values).filter(([, v]) => v.trim() !== '' && Number.isFinite(Number(v))).map(([k, v]) => [k, Number(v)])),
        durationSec: minutes.trim() ? Math.round(Number(minutes) * 60) : null,
        note,
      }),
    { success: 'Logged.' },
  );
  const del = useAction((id: string) => deleteAttempt(id), { success: 'Entry removed.' });
  const pbIds = new Set(events.filter((e) => e.source === 'attempt').map((e) => `${e.at}|${e.key}`));

  return (
    <div>
      {summaries.length > 0 && (
        <div className="mb-4 grid gap-2 sm:grid-cols-2">
          {summaries.map((s) => {
            const improvement = s.first !== null && s.best !== null && s.first !== 0 && s.best !== s.first ? Math.round((((s.best - s.first) / Math.abs(s.first)) * 100 * (s.better === 'higher' ? 1 : -1))) : null;
            return (
              <div key={s.key} className="rounded-xl border border-line bg-surface-2 px-3.5 py-3">
                <p className="flex items-center gap-1.5 text-xs font-medium text-ink-3">
                  <Trophy className="size-3.5 text-slate" aria-hidden /> {s.label} · {s.better === 'higher' ? 'higher is better' : 'lower is better'}
                </p>
                <p className="tnum font-display mt-1 text-2xl">
                  {s.best ?? '—'}
                  {s.best !== null && s.unit && <span className="text-sm font-medium text-ink-3"> {s.unit}</span>}
                </p>
                <p className="text-xs text-ink-3">
                  {s.count === 0 ? 'No values logged yet' : `First ${s.first}${s.unit ? ` ${s.unit}` : ''} · ${s.count} logged`}
                  {improvement !== null && <span className="ml-1 font-semibold text-success">{improvement > 0 ? `+${improvement}%` : `${improvement}%`}</span>}
                </p>
              </div>
            );
          })}
        </div>
      )}

      <form
        className="rounded-xl border border-line p-3.5"
        onSubmit={async (e) => {
          e.preventDefault();
          if (await add.run()) {
            setLabel('');
            setValues({});
            setMinutes('');
            setNote('');
          }
        }}
      >
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Type" htmlFor={`k-${challenge.id}`}>
            <Select id={`k-${challenge.id}`} value={kind} onChange={(e) => setKind(e.target.value as Attempt['kind'])}>
              <option value="attempt">Attempt</option>
              <option value="practice">Practice session</option>
              <option value="test">Test / measurement</option>
            </Select>
          </Field>
          <Field label="Label (optional)" htmlFor={`l-${challenge.id}`} className="sm:col-span-2">
            <Input id={`l-${challenge.id}`} value={label} maxLength={200} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Afternoon block" />
          </Field>
          {attemptKeys.map((k) => (
            <Field key={k.key} label={`${k.label}${k.unit ? ` (${k.unit})` : ''}`} htmlFor={`m-${challenge.id}-${k.key}`}>
              <Input id={`m-${challenge.id}-${k.key}`} type="number" inputMode="decimal" step="any" min={0} value={values[k.key] ?? ''} onChange={(e) => setValues({ ...values, [k.key]: e.target.value })} />
            </Field>
          ))}
          <Field label="Duration (min, optional)" htmlFor={`d-${challenge.id}`}>
            <Input id={`d-${challenge.id}`} type="number" inputMode="numeric" min={0} max={1440} value={minutes} onChange={(e) => setMinutes(e.target.value)} />
          </Field>
          <Field label="Note (optional)" htmlFor={`n-${challenge.id}`} className={attemptKeys.length % 3 === 1 ? 'sm:col-span-1' : 'sm:col-span-2'}>
            <Input id={`n-${challenge.id}`} value={note} maxLength={4000} onChange={(e) => setNote(e.target.value)} />
          </Field>
        </div>
        <div className="mt-3 flex justify-end">
          <Button type="submit" variant="primary" size="sm" busy={add.busy}>
            Log entry
          </Button>
        </div>
      </form>

      {attempts.length > 0 && (
        <ol className="mt-4 space-y-1.5">
          {[...attempts].reverse().map((a) => (
            <li key={a.id} className="flex items-start gap-3 rounded-lg px-2 py-2 hover:bg-surface-2/60">
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-1.5 text-sm font-medium">
                  {a.label}
                  <Badge>{a.kind}</Badge>
                  {Object.keys(a.metrics).some((k) => pbIds.has(`${a.at}|${k}`)) && (
                    <Badge tone="success" icon={<TrendingUp className="size-3" />}>
                      PB
                    </Badge>
                  )}
                </p>
                <p className="tnum text-xs text-ink-3">
                  {formatInstant(a.at, data.settings.timezone)}
                  {Object.entries(a.metrics).map(([k, v]) => ` · ${challenge.pbKeys.find((p) => p.key === k)?.label ?? k}: ${String(v)}`)}
                  {a.durationSec ? ` · ${Math.round(a.durationSec / 60)} min` : ''}
                </p>
                {a.note && <p className="mt-0.5 text-xs text-ink-2">{a.note}</p>}
              </div>
              <button type="button" className="text-ink-3 hover:text-danger" aria-label={`Delete ${a.label}`} onClick={() => setToDelete(a.id)}>
                <Trash2 className="size-4" />
              </button>
            </li>
          ))}
        </ol>
      )}
      <ConfirmDialog
        open={toDelete !== null}
        onClose={() => setToDelete(null)}
        title="Delete this entry?"
        tone="danger"
        confirmLabel="Delete"
        onConfirm={() => {
          if (toDelete) void del.run(toDelete);
          setToDelete(null);
        }}
      >
        Use this for mistakes only. Personal bests are recalculated from the remaining entries.
      </ConfirmDialog>
    </div>
  );
}
