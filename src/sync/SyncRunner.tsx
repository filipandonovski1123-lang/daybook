import { useEffect, useState } from 'react';
import { Dialog } from '../components/ui';
import { useToast } from '../lib/toast';
import { SYNC_AVAILABLE } from './config';
import { hasSyncAccount, SYNC_CHANGED } from './store';

/**
 * Keeps a signed-in device in sync in the background. People who never sign in never download the
 * sync code: it only loads once this device has an account.
 */
export function SyncRunner() {
  const toast = useToast();
  const [conflict, setConflict] = useState(false);
  const [busy, setBusy] = useState(false);
  const [Choice, setChoice] = useState<typeof import('./AccountDialog').ConflictChoice | null>(null);

  useEffect(() => {
    if (!SYNC_AVAILABLE) return;
    let stop: (() => void) | undefined;
    let cancelled = false;
    const start = async () => {
      stop?.();
      stop = undefined;
      if (!(await hasSyncAccount()) || cancelled) return;
      const sync = await import('./sync');
      if (cancelled) return;
      stop = sync.startAutoSync((outcome) => {
        if (outcome === 'conflict') {
          void import('./AccountDialog').then((m) => setChoice(() => m.ConflictChoice));
          setConflict(true);
        } else if (outcome === 'downloaded') toast.show('Synced the latest from your other device.');
        else if (outcome instanceof Error && 'code' in outcome && ['DECRYPT', 'TOKEN_EXPIRED', 'INVALID_REFRESH_TOKEN', 'USER_NOT_FOUND'].includes(String(outcome.code)))
          toast.show('Sync paused: please sign in again in Settings.', { tone: 'error' });
        // Network blips are retried quietly on the next change or when the app comes back.
      });
    };
    void start();
    const restart = () => void start();
    window.addEventListener(SYNC_CHANGED, restart);
    return () => {
      cancelled = true;
      stop?.();
      window.removeEventListener(SYNC_CHANGED, restart);
    };
  }, [toast]);

  const choose = async (keep: 'cloud' | 'device') => {
    setBusy(true);
    try {
      const sync = await import('./sync');
      await sync.resolveConflict(keep);
      setConflict(false);
      toast.show(keep === 'cloud' ? 'Your account’s data is on this device now.' : 'This device’s data is now in your account.');
    } catch (e) {
      toast.show(e instanceof Error ? e.message : 'Sync failed.', { tone: 'error' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={conflict && !!Choice} onClose={() => setConflict(false)} title="Which data should we keep?" size="sm">
      {Choice && <Choice busy={busy} onChoose={(keep) => void choose(keep)} />}
    </Dialog>
  );
}
