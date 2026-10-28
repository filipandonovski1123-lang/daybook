import { useState } from 'react';
import { Button, Dialog, Field, Input, Select, Textarea } from '../../components/ui';
import { THEMES } from '../../data/library';
import { saveCustomChallenge, type CustomChallengeInput } from '../../db/actions';
import type { ChallengeTheme, CustomChallenge } from '../../domain/types';
import { useAction } from '../../lib/appData';

/** Create or edit a challenge of your own. Mounted only while open so the form starts fresh. */
export function CustomChallengeDialog({ open, existing, onClose, onSaved }: { open: boolean; existing?: CustomChallenge | null; onClose: () => void; onSaved?: (c: CustomChallenge) => void }) {
  return open ? <Form existing={existing ?? null} onClose={onClose} onSaved={onSaved} /> : null;
}

function Form({ existing, onClose, onSaved }: { existing: CustomChallenge | null; onClose: () => void; onSaved?: (c: CustomChallenge) => void }) {
  const [f, setF] = useState(() => ({
    title: existing?.title ?? '',
    category: existing?.category ?? '',
    theme: existing?.theme ?? ('practical' as ChallengeTheme),
    difficulty: String(existing?.difficulty ?? 3),
    minutes: String(existing?.estimatedMinutes ?? 60),
    objective: existing?.objective ?? '',
    description: existing?.description ?? '',
    preparation: (existing?.preparation ?? []).join('\n'),
    plan: (existing?.learningPlan ?? []).join('\n'),
  }));
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  const save = useAction(
    () => {
      const input: CustomChallengeInput = {
        title: f.title,
        category: f.category || 'My challenges',
        theme: f.theme,
        difficulty: Math.min(5, Math.max(1, Math.round(Number(f.difficulty) || 3))),
        estimatedMinutes: Math.min(1440, Math.max(5, Math.round(Number(f.minutes) || 60))),
        objective: f.objective,
        description: f.description,
        preparation: f.preparation.split('\n'),
        learningPlan: f.plan.split('\n'),
      };
      return saveCustomChallenge(input, existing?.id ?? null);
    },
    { success: existing ? 'Challenge updated.' : 'Challenge added to your library.' },
  );
  return (
    <Dialog
      open
      onClose={onClose}
      title={existing ? 'Edit your challenge' : 'Create your own challenge'}
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            busy={save.busy}
            disabled={!f.title.trim() || !f.objective.trim()}
            onClick={async () => {
              const saved = await save.run();
              if (saved) {
                onSaved?.(saved);
                onClose();
              }
            }}
          >
            {existing ? 'Save' : 'Create challenge'}
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Title" htmlFor="cc-title" className="sm:col-span-2">
          <Input id="cc-title" value={f.title} maxLength={120} onChange={set('title')} placeholder="e.g. Learn my favourite song on ukulele" autoFocus />
        </Field>
        <Field label="Goal — how you’ll know you’ve done it" htmlFor="cc-goal" className="sm:col-span-2">
          <Textarea id="cc-goal" value={f.objective} maxLength={500} onChange={set('objective')} className="min-h-[64px]" placeholder="e.g. Play it all the way through without stopping" />
        </Field>
        <Field label="Category" htmlFor="cc-cat">
          <Input id="cc-cat" value={f.category} maxLength={60} onChange={set('category')} placeholder="e.g. Music" />
        </Field>
        <Field label="Interest" htmlFor="cc-theme">
          <Select id="cc-theme" value={f.theme} onChange={set('theme')}>
            {THEMES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Difficulty (1 gentle – 5 demanding)" htmlFor="cc-diff">
          <Select id="cc-diff" value={f.difficulty} onChange={set('difficulty')}>
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Estimated minutes" htmlFor="cc-min">
          <Input id="cc-min" type="number" min={5} max={1440} value={f.minutes} onChange={set('minutes')} />
        </Field>
        <Field label="Description (optional)" htmlFor="cc-desc" className="sm:col-span-2">
          <Textarea id="cc-desc" value={f.description} maxLength={2000} onChange={set('description')} className="min-h-[64px]" />
        </Field>
        <Field label="Preparation (one per line, optional)" htmlFor="cc-prep">
          <Textarea id="cc-prep" value={f.preparation} onChange={set('preparation')} className="min-h-[100px]" />
        </Field>
        <Field label="Steps (one per line, optional)" htmlFor="cc-plan">
          <Textarea id="cc-plan" value={f.plan} onChange={set('plan')} className="min-h-[100px]" />
        </Field>
      </div>
    </Dialog>
  );
}
