import { useState } from 'react';
import { Button, ConfirmDialog, Dialog, Field, Input, Textarea } from '../../components/ui';
import { restoreChallengeDefault, updateChallenge } from '../../db/actions';
import type { Challenge } from '../../domain/types';
import { useAction } from '../../lib/appData';

/** Edits the challenge definition. Logs, measurements, files and history are never touched. */
export function EditChallengeDialog({ challenge, open, onClose }: { challenge: Challenge; open: boolean; onClose: () => void }) {
  return open ? <EditForm challenge={challenge} onClose={onClose} /> : null;
}

function EditForm({ challenge, onClose }: { challenge: Challenge; onClose: () => void }) {
  const open = true;
  const init = () => ({
    title: challenge.title,
    category: challenge.category,
    difficulty: String(challenge.difficulty),
    description: challenge.description,
    objective: challenge.objective,
    bonus: challenge.bonus ?? '',
    estimatedMinutes: String(challenge.estimatedMinutes),
    preparation: challenge.preparation.join('\n'),
    learningPlan: challenge.learningPlan.join('\n'),
  });
  const [f, setF] = useState(init);
  const [confirmRestore, setConfirmRestore] = useState(false);
  const lines = (s: string) => s.split('\n').map((x) => x.trim()).filter(Boolean);
  const save = useAction(
    () =>
      updateChallenge(challenge.id, {
        title: f.title.trim(),
        category: f.category.trim(),
        difficulty: Math.min(5, Math.max(1, Math.round(Number(f.difficulty) || 1))),
        description: f.description.trim(),
        objective: f.objective.trim(),
        bonus: f.bonus.trim() || null,
        estimatedMinutes: Math.max(5, Math.round(Number(f.estimatedMinutes) || 60)),
        preparation: lines(f.preparation),
        learningPlan: lines(f.learningPlan),
      }),
    { success: 'Challenge updated. Previous version kept.' },
  );
  const restore = useAction(() => restoreChallengeDefault(challenge.id), { success: 'Restored the original challenge text.' });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });

  return (
    <>
      <Dialog
        open={open}
        onClose={onClose}
        title={`Edit Day ${challenge.day}`}
        size="lg"
        footer={
          <>
            <Button variant="ghost" className="mr-auto" onClick={() => setConfirmRestore(true)}>
              Restore default
            </Button>
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button
              variant="primary"
              busy={save.busy}
              disabled={!f.title.trim() || !f.category.trim()}
              onClick={async () => {
                if ((await save.run()) !== undefined) onClose();
              }}
            >
              Save changes
            </Button>
          </>
        }
      >
        <p className="mb-4 text-xs text-ink-3">Your logs, measurements, notes and files are kept exactly as they are. Measurement fields and success rules stay the same.</p>
        <div className="grid gap-3.5 sm:grid-cols-2">
          <Field label="Title" htmlFor="ec-title" className="sm:col-span-2">
            <Input id="ec-title" value={f.title} maxLength={120} onChange={set('title')} />
          </Field>
          <Field label="Category" htmlFor="ec-cat">
            <Input id="ec-cat" value={f.category} maxLength={60} onChange={set('category')} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Difficulty (1–5)" htmlFor="ec-diff">
              <Input id="ec-diff" type="number" min={1} max={5} value={f.difficulty} onChange={set('difficulty')} />
            </Field>
            <Field label="Est. minutes" htmlFor="ec-min">
              <Input id="ec-min" type="number" min={5} max={1440} value={f.estimatedMinutes} onChange={set('estimatedMinutes')} />
            </Field>
          </div>
          <Field label="Description" htmlFor="ec-desc" className="sm:col-span-2">
            <Textarea id="ec-desc" value={f.description} onChange={set('description')} />
          </Field>
          <Field label="Main objective" htmlFor="ec-obj" className="sm:col-span-2">
            <Textarea id="ec-obj" value={f.objective} onChange={set('objective')} className="min-h-[60px]" />
          </Field>
          <Field label="Bonus objective" htmlFor="ec-bonus" className="sm:col-span-2">
            <Input id="ec-bonus" value={f.bonus} onChange={set('bonus')} />
          </Field>
          <Field label="Preparation (one per line)" htmlFor="ec-prep">
            <Textarea id="ec-prep" value={f.preparation} onChange={set('preparation')} className="min-h-[120px]" />
          </Field>
          <Field label="Learning plan (one step per line)" htmlFor="ec-plan">
            <Textarea id="ec-plan" value={f.learningPlan} onChange={set('learningPlan')} className="min-h-[120px]" />
          </Field>
        </div>
      </Dialog>
      <ConfirmDialog
        open={confirmRestore}
        onClose={() => setConfirmRestore(false)}
        title="Restore the original text?"
        confirmLabel="Restore"
        onConfirm={() => {
          setConfirmRestore(false);
          void restore.run().then(onClose);
        }}
      >
        The definition goes back to the built-in version. Your current version is saved as a revision, and your progress is untouched.
      </ConfirmDialog>
    </>
  );
}
