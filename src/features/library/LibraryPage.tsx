import { Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { Badge, Button, ConfirmDialog, Dialog, Difficulty, EmptyState, Input, PageHeader, Segmented } from '../../components/ui';
import { EQUIPMENT } from '../../data/challenges';
import { challengeKey, THEMES, type LibraryItem } from '../../data/library';
import { deleteCustomChallenge } from '../../db/actions';
import { useAction, useApp } from '../../lib/appData';
import { useLibrary } from '../../lib/library';
import { LibraryFilters, LibraryRow, useLibraryFilters } from '../plan/PlanBuilder';
import { CustomChallengeDialog } from './CustomChallengeDialog';

/** Browse every challenge, see what's in your plan, and manage the ones you made. */
export function LibraryPage() {
  const { data } = useApp();
  const lib = useLibrary();
  const [tab, setTab] = useState<'all' | 'mine'>('all');
  const source = tab === 'mine' ? lib.items.filter((i) => i.id.startsWith('custom:')) : lib.items;
  const { q, setQ, theme, setTheme, level, setLevel, pack, setPack, items } = useLibraryFilters(source);
  const [viewing, setViewing] = useState<LibraryItem | null>(null);
  const [editing, setEditing] = useState<string | null | 'new'>(null);
  const inPlan = new Map(data.challenges.map((c) => [challengeKey(c), c.day]));
  const has = new Set(data.settings.equipment);

  return (
    <div>
      <PageHeader
        title="Library"
        subtitle={`${lib.items.length} challenges · difficulty 1 (gentle) to 5 (demanding)`}
        action={
          <Button size="sm" variant="primary" icon={<Plus className="size-4" />} onClick={() => setEditing('new')}>
            Create
          </Button>
        }
      />
      <div className="space-y-3">
        <Segmented label="Show" value={tab} onChange={setTab} options={[{ value: 'all', label: 'All challenges' }, { value: 'mine', label: `Yours (${data.customChallenges.length})` }]} />
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" aria-hidden />
          <Input aria-label="Search the library" placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
        </div>
        <LibraryFilters theme={theme} setTheme={setTheme} level={level} setLevel={setLevel} pack={pack} setPack={setPack} />
      </div>

      {items.length === 0 ? (
        <EmptyState icon={<Plus className="size-5" />} title={tab === 'mine' ? 'No challenges of your own yet' : 'No matches'} action={tab === 'mine' ? <Button onClick={() => setEditing('new')}>Create one</Button> : undefined}>
          {tab === 'mine' ? 'Write a challenge with your own goal and difficulty, then swap it into any day of your plan.' : 'Try a different search or filter.'}
        </EmptyState>
      ) : (
        <ul className="mt-5 divide-y divide-line rounded-xl border border-line bg-surface">
          {items.map((i) => (
            <li key={i.id}>
              <button type="button" onClick={() => setViewing(i)} className="flex w-full items-start gap-3 px-4 py-3.5 text-left transition-colors hover:bg-surface-2">
                <LibraryRow item={i} missing={i.equipment.some((e) => !has.has(e))} badges={inPlan.has(i.id) ? <Badge tone="info">Day {inPlan.get(i.id)}</Badge> : undefined} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <ItemDialog item={viewing} day={viewing ? inPlan.get(viewing.id) : undefined} onClose={() => setViewing(null)} onEdit={(id) => { setViewing(null); setEditing(id); }} />
      <CustomChallengeDialog open={editing !== null} existing={editing && editing !== 'new' ? data.customChallenges.find((c) => c.id === editing) : null} onClose={() => setEditing(null)} />
    </div>
  );
}

function ItemDialog({ item, day, onClose, onEdit }: { item: LibraryItem | null; day?: number; onClose: () => void; onEdit: (id: string) => void }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const del = useAction((id: string) => deleteCustomChallenge(id), { success: 'Challenge deleted.' });
  if (!item) return null;
  const mine = item.id.startsWith('custom:');
  const theme = THEMES.find((t) => t.id === item.theme)?.label;
  return (
    <>
      <Dialog
        open
        onClose={onClose}
        title={item.title}
        size="lg"
        footer={
          mine ? (
            <>
              <Button variant="ghost" className="mr-auto text-danger" icon={<Trash2 className="size-4" />} onClick={() => setConfirmDelete(true)}>
                Delete
              </Button>
              <Button icon={<Pencil className="size-4" />} onClick={() => onEdit(item.id)}>
                Edit
              </Button>
            </>
          ) : undefined
        }
      >
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[12.5px] text-ink-3">
          <span>{item.category}</span>
          {theme && <span>{theme}</span>}
          <span className="flex items-center gap-1.5">
            Difficulty <Difficulty value={item.difficulty} />
          </span>
          <span>~{item.estimatedMinutes} min</span>
          {day && (
            <Link to={`/challenges/day-${String(day).padStart(2, '0')}`} onClick={onClose}>
              <Badge tone="info">In your plan · Day {day}</Badge>
            </Link>
          )}
        </div>
        <p className="mt-4 text-[14.5px] font-medium leading-snug">{item.objective}</p>
        {item.description && <p className="mt-2 text-[14px] leading-relaxed text-ink-2">{item.description}</p>}
        {item.equipment.length > 0 && <p className="mt-3 text-[13px] text-ink-2">Needs: {item.equipment.map((e) => EQUIPMENT[e] ?? e).join(', ')}</p>}
        {item.preparation.length > 0 && (
          <>
            <h3 className="font-display mt-5 text-[17px]">Preparation</h3>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-[13.5px] text-ink-2">
              {item.preparation.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </>
        )}
        {item.learningPlan.length > 0 && (
          <>
            <h3 className="font-display mt-5 text-[17px]">Steps</h3>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-[13.5px] text-ink-2">
              {item.learningPlan.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ol>
          </>
        )}
        {item.safety.length > 0 && <p className="mt-4 rounded-lg bg-warn-soft/60 p-3 text-[13px] text-ink-2">{item.safety.join(' ')}</p>}
        <p className="mt-5 text-xs text-ink-3">To use it, open a day in your plan and tap Swap.</p>
      </Dialog>
      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Delete this challenge?"
        tone="danger"
        confirmLabel="Delete"
        onConfirm={async () => {
          setConfirmDelete(false);
          if ((await del.run(item.id)) !== undefined) onClose();
        }}
      >
        It’s removed from your library. If it’s in your plan, swap that day first.
      </ConfirmDialog>
    </>
  );
}
