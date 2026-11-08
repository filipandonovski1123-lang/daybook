import { Lock } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Button, Dialog, Field, Input } from '../components/ui';
import { useToast } from '../lib/toast';
import { CloudError } from './cloud';
import { sendPasswordReset } from './cloud';
import { createAccount, replaceCloudWithDevice, resolveConflict, signInAccount } from './sync';

type Mode = 'signin' | 'create';
type Phase = 'form' | 'conflict' | 'locked' | 'reset-sent';

/** Create an account or sign in. Loaded on demand, so the sync code only downloads when used. */
export function AccountDialog({ open, onClose, initialMode = 'signin' }: { open: boolean; onClose: () => void; initialMode?: Mode }) {
  const toast = useToast();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [phase, setPhase] = useState<Phase>('form');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      if (e instanceof CloudError && e.code === 'DECRYPT') setPhase('locked');
      else setError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (mode === 'create') {
      if (password.length < 8) return setError('Use a password of at least 8 characters.');
      if (password !== confirm) return setError('The passwords don’t match.');
      void run(async () => {
        await createAccount(email, password);
        toast.show('Account created. This device is now syncing.');
        onClose();
      });
    } else
      void run(async () => {
        const outcome = await signInAccount(email, password);
        if (outcome === 'conflict') return setPhase('conflict');
        toast.show(outcome === 'downloaded' ? 'Signed in. Your data is on this device now.' : 'Signed in. This device is now syncing.');
        onClose();
      });
  };

  const title = phase === 'conflict' ? 'Which data should we keep?' : phase === 'locked' ? 'Can’t unlock your synced data' : phase === 'reset-sent' ? 'Check your email' : mode === 'create' ? 'Create an account' : 'Sign in';

  return (
    <Dialog open={open} onClose={onClose} title={title} size="sm">
      {phase === 'form' && (
        <form onSubmit={submit} className="space-y-4">
          <p className="text-[13.5px] leading-relaxed text-ink-2">
            {mode === 'create' ? 'Sync your progress across devices and keep it safe if you lose your phone. Optional — the app works fully without an account.' : 'Sign in to sync this device with your account.'}
          </p>
          <Field label="Email" htmlFor="acct-email">
            <Input id="acct-email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Field label="Password" htmlFor="acct-password" hint={mode === 'create' ? 'At least 8 characters.' : undefined}>
            <Input id="acct-password" type="password" autoComplete={mode === 'create' ? 'new-password' : 'current-password'} required value={password} onChange={(e) => setPassword(e.target.value)} />
          </Field>
          {mode === 'create' && (
            <Field label="Confirm password" htmlFor="acct-confirm">
              <Input id="acct-confirm" type="password" autoComplete="new-password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} />
            </Field>
          )}
          {mode === 'create' && (
            <p className="flex gap-2 rounded-lg bg-surface-2 p-3 text-[12.5px] leading-relaxed text-ink-2">
              <Lock className="mt-0.5 size-4 shrink-0 text-slate" aria-hidden />
              <span>Your data is encrypted on this device with your password before it’s uploaded, so nobody else can read it — not even us. If you forget your password, the cloud copy can’t be recovered (this device keeps its own).</span>
            </p>
          )}
          {error && (
            <p role="alert" className="text-[13px] text-danger">
              {error}
            </p>
          )}
          <Button type="submit" variant="primary" busy={busy} className="w-full">
            {mode === 'create' ? 'Create account' : 'Sign in'}
          </Button>
          <div className="flex flex-wrap items-center justify-between gap-2 text-[13px]">
            <button type="button" className="text-slate hover:underline" onClick={() => (setMode(mode === 'create' ? 'signin' : 'create'), setError(null))}>
              {mode === 'create' ? 'I already have an account' : 'Create an account instead'}
            </button>
            {mode === 'signin' && (
              <button
                type="button"
                className="text-ink-3 hover:text-ink hover:underline"
                onClick={() => (email ? void run(async () => (await sendPasswordReset(email.trim()), setPhase('reset-sent'))) : setError('Enter your email first.'))}
              >
                Forgot password?
              </button>
            )}
          </div>
        </form>
      )}

      {phase === 'conflict' && <ConflictChoice busy={busy} onChoose={(keep) => void run(async () => (await resolveConflict(keep), toast.show(keep === 'cloud' ? 'Your account’s data is on this device now.' : 'This device’s data is now in your account.'), onClose()))} />}

      {phase === 'locked' && (
        <div className="space-y-4 text-[13.5px] leading-relaxed text-ink-2">
          <p>Your password signed you in, but it doesn’t unlock the data saved in your account. This happens after a password reset, because the old copy was locked with your old password.</p>
          <p>You can start a fresh cloud copy from this device’s data. The old cloud copy will be replaced.</p>
          {error && (
            <p role="alert" className="text-[13px] text-danger">
              {error}
            </p>
          )}
          <Button variant="primary" busy={busy} className="w-full" onClick={() => void run(async () => (await replaceCloudWithDevice(email, password), toast.show('Done. This device is now syncing.'), onClose()))}>
            Replace the cloud copy with this device
          </Button>
          <Button variant="ghost" className="w-full" onClick={onClose}>
            Cancel
          </Button>
        </div>
      )}

      {phase === 'reset-sent' && (
        <div className="space-y-4 text-[13.5px] leading-relaxed text-ink-2">
          <p>If there’s an account for {email.trim()}, we’ve sent a link to reset its password.</p>
          <p>Because your data is encrypted with your password, the copy saved under your old password can’t be unlocked with a new one. After resetting, sign in on a device that has your data and choose to replace the cloud copy.</p>
          <Button variant="primary" className="w-full" onClick={() => setPhase('form')}>
            Back to sign in
          </Button>
        </div>
      )}
    </Dialog>
  );
}

/** "This device or your account?" — shown at sign-in, or later if two devices both changed. */
export function ConflictChoice({ busy, onChoose }: { busy: boolean; onChoose: (keep: 'cloud' | 'device') => void }) {
  return (
    <div className="space-y-4 text-[13.5px] leading-relaxed text-ink-2">
      <p>This device and your account both have data, and they’re different. Choose which one to keep — the other will be replaced.</p>
      <Button variant="primary" busy={busy} className="w-full" onClick={() => onChoose('cloud')}>
        Use my account’s data
      </Button>
      <Button busy={busy} className="w-full" onClick={() => onChoose('device')}>
        Keep this device’s data
      </Button>
      <p className="text-[12px] text-ink-3">Tip: if you’re not sure, save a backup from Settings first.</p>
    </div>
  );
}
