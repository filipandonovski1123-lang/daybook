import { useId, useState } from 'react';
import { Field, Input, Select, Switch, Textarea } from '../../components/ui';
import { setMetric } from '../../db/actions';
import { challengeKey } from '../../data/library';
import { derivedValues } from '../../domain/derived';
import type { Challenge, MetricField, MetricValue } from '../../domain/types';
import { useAction, useApp } from '../../lib/appData';

/** Challenge-specific measurement fields. Saves each field on change/blur. */
export function MetricsForm({ challenge }: { challenge: Challenge }) {
  const { data } = useApp();
  const metrics = data.progress.get(challenge.id)?.metrics ?? {};
  const derived = derivedValues(challengeKey(challenge), metrics);
  const groups = new Map<string, MetricField[]>();
  for (const f of challenge.metrics) {
    // Derived numbers (e.g. WPM computed from words + seconds) are shown read-only instead of as inputs.
    if (derived.some((d) => d.key === f.key && d.value !== null)) continue;
    const g = f.group ?? '';
    groups.set(g, [...(groups.get(g) ?? []), f]);
  }
  if (!challenge.metrics.length) return <p className="text-sm text-ink-3">No measurements for this challenge — use notes, evidence and the criteria checklist.</p>;
  return (
    <div className="space-y-5">
      {[...groups.entries()].map(([group, fields]) => (
        <fieldset key={group || 'main'}>
          {group && <legend className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-ink-3">{group}</legend>}
          <div className="grid gap-3 sm:grid-cols-2">
            {fields.map((f) => (
              <MetricInput key={f.key} challengeId={challenge.id} field={f} value={metrics[f.key] ?? null} />
            ))}
          </div>
        </fieldset>
      ))}
      {derived.length > 0 && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {derived.map((d) => (
            <div key={d.key} className="rounded-xl border border-line bg-surface-2 px-3 py-2">
              <p className="text-[11px] font-medium text-ink-3">{d.label} · auto</p>
              <p className="tnum text-base font-semibold">
                {typeof d.value === 'boolean' ? (d.value ? 'Yes' : 'No') : d.value === null ? '—' : `${d.value > 0 && d.unit === '%' && d.key.toLowerCase().includes('change') ? '+' : ''}${d.value}${d.unit ? ` ${d.unit}` : ''}`}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function MetricInput({ challengeId, field, value }: { challengeId: string; field: MetricField; value: MetricValue }) {
  const id = useId();
  const save = useAction((v: MetricValue) => setMetric(challengeId, field.key, v));
  const toText = (v: MetricValue) => (Array.isArray(v) ? v.join('\n') : v === null || v === undefined || typeof v === 'boolean' ? '' : String(v));
  const [local, setLocal] = useState(toText(value));
  const [error, setError] = useState<string | null>(null);
  // Re-sync the draft when the stored value changes (another tab, a tool, an import).
  const [synced, setSynced] = useState(value);
  if (synced !== value) {
    setSynced(value);
    setLocal(toText(value));
  }

  const commit = () => {
    if (field.type === 'number') {
      if (local.trim() === '') return value !== null && void save.run(null);
      const n = Number(local);
      if (!Number.isFinite(n)) return setError('Enter a number');
      if (field.min !== undefined && n < field.min) return setError(`Minimum ${field.min}`);
      if (field.max !== undefined && n > field.max) return setError(`Maximum ${field.max}`);
      setError(null);
      if (n !== value) void save.run(n);
      return;
    }
    if (field.type === 'list') {
      const arr = local.split('\n').map((s) => s.trim()).filter(Boolean).slice(0, 200);
      if (JSON.stringify(arr) !== JSON.stringify(value ?? [])) void save.run(arr);
      return;
    }
    if (local !== (value ?? '')) void save.run(local.slice(0, 5000));
  };

  const label = (
    <>
      {field.label}
      {field.unit && <span className="text-ink-3"> ({field.unit})</span>}
    </>
  );

  if (field.type === 'boolean')
    return (
      <div className="sm:col-span-2">
        <Switch checked={value === true} onChange={(v) => void save.run(v)} label={field.label} description={field.help} />
      </div>
    );
  if (field.type === 'select')
    return (
      <Field label={label} htmlFor={id}>
        <Select id={id} value={typeof value === 'string' ? value : ''} onChange={(e) => void save.run(e.target.value)}>
          <option value="">—</option>
          {field.options?.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </Select>
      </Field>
    );
  if (field.type === 'longtext' || field.type === 'list')
    return (
      <Field label={label} htmlFor={id} hint={field.help ?? (field.type === 'list' ? `One per line${Array.isArray(value) ? ` · ${value.length} saved` : ''}` : undefined)} className="sm:col-span-2">
        <Textarea id={id} value={local} onChange={(e) => setLocal(e.target.value)} onBlur={commit} maxLength={5000} className="min-h-[72px]" />
      </Field>
    );
  return (
    <Field label={label} htmlFor={id} hint={field.help} error={error}>
      <Input
        id={id}
        type={field.type === 'number' ? 'number' : 'text'}
        inputMode={field.type === 'number' ? 'decimal' : undefined}
        min={field.min}
        max={field.max}
        step={field.step ?? 'any'}
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === 'Enter' && commit()}
        maxLength={field.type === 'text' ? 300 : undefined}
        aria-invalid={!!error}
      />
    </Field>
  );
}
