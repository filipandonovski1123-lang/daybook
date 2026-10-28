import { useState } from 'react';
import { Button, Dialog, Field, RatingPicker, Segmented, Textarea } from '../../components/ui';
import { blankReflection, saveReflection } from '../../db/actions';
import { formatDate } from '../../domain/dates';
import type { IsoDate, Reflection } from '../../domain/types';
import { useAction, useApp } from '../../lib/appData';

const QUESTIONS: { key: 'improvement' | 'difficult' | 'proud' | 'change'; label: string }[] = [
  { key: 'improvement', label: 'What was your biggest improvement?' },
  { key: 'difficult', label: 'What did you find difficult?' },
  { key: 'proud', label: 'What are you proud of?' },
  { key: 'change', label: 'What would you change tomorrow?' },
];

/** Optional, private, editable. Never required for anything else to count. */
export function EveningCheckin({ open, onClose, date }: { open: boolean; onClose: () => void; date: IsoDate }) {
  return open ? <CheckinForm key={date} onClose={onClose} date={date} /> : null;
}

function CheckinForm({ onClose, date }: { onClose: () => void; date: IsoDate }) {
  const { data } = useApp();
  const existing = data.reflections.find((r) => r.date === date);
  const [form, setForm] = useState<Reflection>(() => existing ?? blankReflection(date));
  const open = true;
  const save = useAction(() => saveReflection(date, { completedChallenge: form.completedChallenge, improvement: form.improvement, difficult: form.difficult, proud: form.proud, change: form.change, mood: form.mood, energy: form.energy }), { success: 'Check-in saved.' });
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`Evening check-in · ${formatDate(date, 'short')}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
          <Button
            variant="primary"
            busy={save.busy}
            onClick={async () => {
              await save.run();
              onClose();
            }}
          >
            Save
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <p className="mb-2 text-[13px] font-medium text-ink-2">Did you complete today’s main challenge?</p>
          <Segmented
            label="Completed main challenge"
            value={form.completedChallenge ?? ('' as never)}
            onChange={(v) => setForm({ ...form, completedChallenge: v })}
            options={[
              { value: 'yes', label: 'Yes' },
              { value: 'partly', label: 'Partly' },
              { value: 'no', label: 'No' },
              { value: 'rest', label: 'Rest day' },
            ]}
          />
        </div>
        {QUESTIONS.map((q) => (
          <Field key={q.key} label={q.label} htmlFor={`refl-${q.key}`}>
            <Textarea id={`refl-${q.key}`} value={form[q.key]} maxLength={2000} onChange={(e) => setForm({ ...form, [q.key]: e.target.value })} className="min-h-[60px]" />
          </Field>
        ))}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="mb-2 text-[13px] font-medium text-ink-2">Mood (optional)</p>
            <RatingPicker label="Mood" value={form.mood} onChange={(v) => setForm({ ...form, mood: v })} low="Low" high="Great" />
          </div>
          <div>
            <p className="mb-2 text-[13px] font-medium text-ink-2">Energy (optional)</p>
            <RatingPicker label="Energy" value={form.energy} onChange={(v) => setForm({ ...form, energy: v })} low="Drained" high="Charged" />
          </div>
        </div>
        <p className="text-xs text-ink-3">Private to this device. Skipping a check-in never affects anything else.</p>
      </div>
    </Dialog>
  );
}
