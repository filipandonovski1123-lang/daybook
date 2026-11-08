import { useLiveQuery } from 'dexie-react-hooks';
import { Cloud, CloudOff, RefreshCw } from 'lucide-react';
import { lazy, Suspense, useState } from 'react';
import { Button, ConfirmDialog, Field, Input } from '../components/ui';
import { formatInstant } from '../domain/dates';
import { useApp } from '../lib/appData';
import { useToast } from '../lib/toast';
import { SYNC_AVAILABLE } from './config';
import { syncStore } from './store';

const AccountDialog = lazy(() => import('./AccountDialog').then((m) => ({ default: m.AccountDialog })));

/** Settings → Account & sync. */
export function SyncSection({ Section }: { Section: (p: { title: string; description?: string; children: React.ReactNode }) => React.ReactNode }) {
  const { data } = useApp();
  const toast = useToast();
  const state = useLiveQuery(() => syncStore.state.get('sync'), []);
  const [dialog, setDialog] = useState<'signin' | 'create' | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  if (!SYNC_AVAILABLE) return null;

  const act = async (fn: (s: typeof import('./sync')) => Promise<unknown>, success?: string) => {
    setBusy(true);
    try {
      await fn(await import('./sync'));
      if (success) toast.show(success);
    } catch (e) {
      toast.show(e instanceof Error ? e.message : 'Something went wrong.', { tone: 'error' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Section title="Account & sync" description="Optional. Sync your progress between devices and keep it safe if you lose your phone. Encrypted on your device with your password, so nobody else can read it.">
      {state ? (
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <Cloud className="mt-0.5 size-5 shrink-0 text-slate" aria-hidden />
            <div className="text-sm">
              <p className="font-medium">{state.session.email}</p>
              <p className="mt-0.5 text-ink-3">
                {state.syncedAt < 0 ? 'Waiting for you to choose which data to keep.' : state.syncedAt > 0 ? `Last synced ${formatInstant(state.syncedAt, data.settings.timezone)}` : 'Not synced yet.'}
                {state.dirty && state.syncedAt > 0 ? ' · changes waiting to upload' : ''}
              </p>
            </div>
          </div>
          <p className="text-[12.5px] text-ink-3">Photos and files you attach stay on the device they were added on.</p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" icon={<RefreshCw className="size-3.5" />} busy={busy} onClick={() => void act(async (s) => toast.show({ uploaded: 'Synced.', downloaded: 'Synced the latest from your account.', 'up-to-date': 'Already up to date.', conflict: 'Both copies changed — choose which to keep.' }[await s.syncNow()]))}>
              Sync now
            </Button>
            <Button size="sm" variant="ghost" icon={<CloudOff className="size-3.5" />} onClick={() => void act((s) => s.signOut(), 'Signed out. Your data stays on this device.')}>
              Sign out
            </Button>
            <Button size="sm" variant="danger" onClick={() => setConfirmDelete(true)}>
              Delete account
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" onClick={() => setDialog('create')}>
            Create account
          </Button>
          <Button onClick={() => setDialog('signin')}>Sign in</Button>
        </div>
      )}

      {dialog && (
        <Suspense fallback={null}>
          <AccountDialog open onClose={() => setDialog(null)} initialMode={dialog} />
        </Suspense>
      )}

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => (setConfirmDelete(false), setDeletePassword(''))}
        title="Delete your account?"
        confirmLabel="Delete account"
        tone="danger"
        busy={busy}
        onConfirm={() =>
          void act(async (s) => {
            await s.deleteAccount(deletePassword);
            setConfirmDelete(false);
            setDeletePassword('');
          }, 'Account and cloud copy deleted. Your data stays on this device.')
        }
      >
        <p className="mb-3">This permanently deletes your account and the synced copy of your data. It can’t be undone. Everything on this device stays.</p>
        <Field label="Password" htmlFor="del-pw">
          <Input id="del-pw" type="password" autoComplete="current-password" value={deletePassword} onChange={(e) => setDeletePassword(e.target.value)} />
        </Field>
      </ConfirmDialog>
    </Section>
  );
}
