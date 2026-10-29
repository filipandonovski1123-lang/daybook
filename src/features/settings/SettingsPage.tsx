import { Bell, BellOff, CalendarPlus, Download, HardDrive, Send, ShieldAlert, Trash2, Upload } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { Badge, Button, Card, Checkbox, ConfirmDialog, Dialog, Field, Input, PageHeader, Segmented, Select, Switch } from '../../components/ui';
import { EQUIPMENT } from '../../data/challenges';
import { LIFE_STAGES } from '../../data/tracks';
import { changeStartDate, programHasStarted, updateReminder, updateSettings } from '../../db/actions';
import { deleteAllData, exportData, importData, parseBackup, type ParseResult } from '../../db/backup';
import { formatDate, formatInstant, isValidIso } from '../../domain/dates';
import { buildIcs } from '../../domain/ics';
import { REMINDER_LABEL, upcomingSchedule } from '../../domain/reminders';
import { endDateFor } from '../../domain/schedule';
import type { Reminder, Settings } from '../../domain/types';
import { errorMessage, useAction, useApp } from '../../lib/appData';
import { downloadText } from '../../lib/download';
import { notificationSupport, requestPermission, showSystemNotification } from '../../lib/notifications';
import { useReminders } from '../../lib/reminderScheduler';
import { useToast } from '../../lib/toast';
import { TimezoneInput } from '../onboarding/Onboarding';

function Section({ title, children, description }: { title: string; description?: ReactNode; children: ReactNode }) {
  return (
    <Card className="p-5">
      <h2 className="text-base font-semibold">{title}</h2>
      {description && <p className="mt-1 text-sm leading-relaxed text-ink-2">{description}</p>}
      <div className="mt-4">{children}</div>
    </Card>
  );
}

export function SettingsPage() {
  const { data } = useApp();
  const s = data.settings;
  const save = useAction((patch: Partial<Settings>) => updateSettings(patch));
  return (
    <div className="space-y-5">
      <PageHeader title="Settings" subtitle="Everything is stored privately on this device." />
      <ProgramSection />
      <Section title="Life stage" description="Tailors which skills are suggested and how growth challenges are worded. Changes apply to plans you build or days you swap from now on.">
        <div className="grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Life stage">
          {LIFE_STAGES.map((o) => (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={s.lifeStage === o.value}
              onClick={() => void save.run({ lifeStage: o.value })}
              className={`rounded-xl border px-3.5 py-2.5 text-left transition-colors ${s.lifeStage === o.value ? 'border-slate bg-slate-soft' : 'border-line bg-surface-2 hover:border-line-strong'}`}
            >
              <span className="block text-[14px] font-medium">{o.label}</span>
              <span className="mt-0.5 block text-[12px] leading-snug text-ink-3">{o.body}</span>
            </button>
          ))}
        </div>
      </Section>
      <Section title="Hard Mode" description="Strict about commitments, fair about circumstances, respectful toward you.">
        <Switch
          checked={s.hardMode}
          onChange={(v) => void save.run({ hardMode: v })}
          label="Enable Hard Mode"
          description="End-of-day countdown and open commitments on Today. Completion requires the criteria to be met (no self-awarded credit for unfinished work). Missed challenges must be acknowledged with a reason and an adjustment. Rest, illness, injury and real conflicts are always valid."
        />
      </Section>
      <RemindersSection />
      <Section title="Your rhythm">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Display name" htmlFor="st-name">
            <Input id="st-name" defaultValue={s.displayName} maxLength={60} onBlur={(e) => e.target.value !== s.displayName && void save.run({ displayName: e.target.value.trim() })} />
          </Field>
          <Field label="Timezone" htmlFor="st-tz" hint="“Today”, deadlines and reminders follow this timezone, including daylight saving.">
            <TzField value={s.timezone} onSave={(tz) => void save.run({ timezone: tz })} />
          </Field>
          <Field label="Typical wake-up" htmlFor="st-wake">
            <Input id="st-wake" type="time" value={s.wakeTime} onChange={(e) => e.target.value && void save.run({ wakeTime: e.target.value })} />
          </Field>
          <Field label="Usual bedtime" htmlFor="st-bed">
            <Input id="st-bed" type="time" value={s.bedtime} onChange={(e) => e.target.value && void save.run({ bedtime: e.target.value })} />
          </Field>
        </div>
      </Section>
      <Section title="Privacy" description="Notifications never include habit names. Private habit goals are excluded from charts and accountability stats.">
        <Switch checked={s.hideSensitiveOnToday} onChange={(v) => void save.run({ hideSensitiveOnToday: v })} label="Hide private habit goals on Today" description="They stay trackable from the Habits screen." />
      </Section>
      <Section title="Appearance">
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-sm font-medium">Theme</span>
            <Segmented label="Theme" value={s.theme} onChange={(v) => void save.run({ theme: v })} options={[{ value: 'dark', label: 'Dark' }, { value: 'light', label: 'Light' }, { value: 'system', label: 'System' }]} />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-sm font-medium">Motion</span>
            <Segmented label="Motion" value={s.reducedMotion} onChange={(v) => void save.run({ reducedMotion: v })} options={[{ value: 'system', label: 'System' }, { value: 'reduce', label: 'Reduced' }, { value: 'full', label: 'Full' }]} />
          </div>
        </div>
      </Section>
      <Section title="Equipment & access" description="Challenges flag anything you haven’t ticked here.">
        <div className="grid gap-2.5 sm:grid-cols-2">
          {Object.entries(EQUIPMENT).map(([id, label]) => (
            <Checkbox key={id} checked={s.equipment.includes(id)} onChange={(on) => void save.run({ equipment: on ? [...s.equipment, id] : s.equipment.filter((x) => x !== id) })} label={label} />
          ))}
        </div>
      </Section>
      <DataSection />
    </div>
  );
}

function TzField({ value, onSave }: { value: string; onSave: (tz: string) => void }) {
  const [v, setV] = useState(value);
  const [synced, setSynced] = useState(value);
  if (synced !== value) {
    setSynced(value);
    setV(value);
  }
  return (
    <div onBlur={() => v !== value && onSave(v)}>
      <TimezoneInput id="st-tz" value={v} onChange={setV} />
    </div>
  );
}

function ProgramSection() {
  const { data, today } = useApp();
  const p = data.program;
  const [date, setDate] = useState(p?.startDate ?? today);
  const [confirm, setConfirm] = useState(false);
  const change = useAction((confirmed: boolean) => changeStartDate(date, { confirmed }), { success: `Program now runs ${formatDate(date, 'dm')} – ${formatDate(endDateFor(date, p?.length), 'dm')}.` });
  const [synced, setSynced] = useState(p?.startDate);
  if (synced !== p?.startDate) {
    setSynced(p?.startDate);
    setDate(p?.startDate ?? today);
  }
  if (!p) return null;
  const valid = isValidIso(date);
  return (
    <Section title="Program" description={`${p.length} days. Day 1 is ${formatDate(p.startDate)}; Day ${p.length} is ${formatDate(p.endDate)}.`}>
      <Link to="/plan" className="mb-4 inline-flex items-center gap-1.5 text-sm text-slate hover:underline">
        Edit your plan and challenges →
      </Link>
      <div className="flex flex-wrap items-end gap-2">
        <Field label="Start date" htmlFor="st-start" className="w-48">
          <Input id="st-start" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Button
          variant="primary"
          disabled={!valid || date === p.startDate}
          busy={change.busy}
          onClick={async () => {
            if (await programHasStarted()) setConfirm(true);
            else void change.run(false);
          }}
        >
          Change start date
        </Button>
      </div>
      {p.history.length > 0 && (
        <ul className="mt-3 space-y-1 text-xs text-ink-3">
          {p.history.map((h) => (
            <li key={h.at}>
              {formatInstant(h.at, data.settings.timezone)}: {formatDate(h.from, 'dm')} → {formatDate(h.to, 'dm')} ({h.reason})
            </li>
          ))}
        </ul>
      )}
      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        title="The program has already started"
        confirmLabel="Move the program"
        tone="danger"
        busy={change.busy}
        onConfirm={() => {
          setConfirm(false);
          void change.run(true);
        }}
      >
        Moving the start date changes which date every challenge is scheduled for. Everything you’ve logged is kept, completion dates stay as they happened, and the change is recorded. Usually it’s better to reschedule individual challenges instead.
      </ConfirmDialog>
    </Section>
  );
}

function RemindersSection() {
  const { data, now } = useApp();
  const toast = useToast();
  const { lastError } = useReminders();
  const [support, setSupport] = useState(notificationSupport);
  const saveReminder = useAction((id: Reminder['id'], patch: Partial<Reminder>) => updateReminder(id, patch));
  const saveSettings = useAction((patch: Partial<Settings>) => updateSettings(patch));
  const upcoming = upcomingSchedule(data.reminders, data.settings, now, 2).slice(0, 6);
  const quiet = data.settings.quietHours;
  const [testing, setTesting] = useState(false);

  const test = async () => {
    setTesting(true);
    const r = await showSystemNotification('Test reminder', 'Notifications are working. Reminder text never includes habit names.', 'test');
    setTesting(false);
    if (r.ok) toast.show(`Sent a test notification via the ${r.via === 'service-worker' ? 'service worker' : 'browser'}. If it didn’t appear, check your OS notification and focus settings.`, { tone: 'info', duration: 7000 });
    else toast.show(`Not sent: ${r.reason}`, { tone: 'error' });
  };

  const exportIcs = () => {
    if (!data.program) return;
    const ics = buildIcs({ startDate: data.program.startDate, timezone: data.settings.timezone, challenges: data.challenges, reminders: data.reminders.filter((r) => r.enabled) });
    downloadText('daybook-reminders.ics', ics, 'text/calendar');
    toast.show('Calendar file downloaded. Open it to add the reminders to your calendar app.', { tone: 'info' });
  };

  return (
    <Section title="Reminders" description="Morning plan, evening check-in and an optional bedtime nudge, in your timezone.">
      <div className="space-y-4">
        {data.reminders.map((r) => (
          <div key={r.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-surface-2/60 p-3">
            <div className="min-w-[140px] flex-1">
              <Switch checked={r.enabled} onChange={(v) => void saveReminder.run(r.id, { enabled: v })} label={REMINDER_LABEL[r.type]} />
            </div>
            <Input type="time" aria-label={`${REMINDER_LABEL[r.type]} time`} className="h-9 w-[120px]" value={r.time} disabled={!r.enabled} onChange={(e) => e.target.value && void saveReminder.run(r.id, { time: e.target.value })} />
            <Select aria-label={`${REMINDER_LABEL[r.type]} delivery`} className="h-9 w-[150px]" value={r.delivery} disabled={!r.enabled} onChange={(e) => void saveReminder.run(r.id, { delivery: e.target.value as Reminder['delivery'] })}>
              <option value="system">Notification</option>
              <option value="in-app">In-app only</option>
            </Select>
          </div>
        ))}

        <div className="rounded-xl border border-line p-3">
          <Switch checked={quiet.enabled} onChange={(v) => void saveSettings.run({ quietHours: { ...quiet, enabled: v } })} label="Quiet hours" description="No reminders are delivered inside this window." />
          {quiet.enabled && (
            <div className="mt-2 flex items-center gap-2 text-sm">
              <Input type="time" aria-label="Quiet hours start" className="h-9 w-[120px]" value={quiet.start} onChange={(e) => e.target.value && void saveSettings.run({ quietHours: { ...quiet, start: e.target.value } })} />
              <span className="text-ink-3">to</span>
              <Input type="time" aria-label="Quiet hours end" className="h-9 w-[120px]" value={quiet.end} onChange={(e) => e.target.value && void saveSettings.run({ quietHours: { ...quiet, end: e.target.value } })} />
            </div>
          )}
        </div>

        <div>
          <p className="mb-1.5 text-[13px] font-semibold text-ink-2">Next scheduled</p>
          {upcoming.length ? (
            <ul className="space-y-1 text-sm">
              {upcoming.map((u) => (
                <li key={`${u.type}-${u.at}`} className="tnum flex items-center justify-between gap-2">
                  <span>{REMINDER_LABEL[u.type]}</span>
                  <span className="text-ink-2">
                    {formatInstant(u.at, data.settings.timezone)}
                    {u.suppressed && (
                      <Badge tone="warn" className="ml-2">
                        quiet hours
                      </Badge>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-ink-3">All reminders are off.</p>
          )}
        </div>

        <div className="rounded-xl bg-surface-2 p-3.5 text-sm leading-relaxed">
          <p className="flex flex-wrap items-center gap-2 font-semibold">
            Notification permission:{' '}
            {support.permission === 'granted' ? <Badge tone="success">Allowed</Badge> : support.permission === 'denied' ? <Badge tone="danger">Blocked</Badge> : support.permission === 'unsupported' ? <Badge>Not supported</Badge> : <Badge tone="warn">Not asked yet</Badge>}
          </p>
          <p className="mt-2 text-ink-2">
            <strong className="text-ink">How delivery works:</strong> reminders fire while the app is open, in a background tab, or running as an installed app. If the app was closed at reminder time, it shows the reminder when you next open it (within 2 hours). Browsers can’t schedule notifications for a fully closed web app without a push server, which this private, offline app deliberately doesn’t use.
          </p>
          <p className="mt-2 text-ink-2">
            <strong className="text-ink">Reliable when closed:</strong> add your schedule to your phone’s calendar. Its alarms fire even with this app closed. Re-export if you change times or dates.
          </p>
          {support.ios && !support.standalone && <p className="mt-2 text-warn">iPhone/iPad: web notifications need iOS 16.4+ and the app added to your Home Screen (Share → Add to Home Screen).</p>}
          {lastError && <p className="mt-2 text-danger">Last delivery problem: {lastError}</p>}
          <div className="mt-3 flex flex-wrap gap-2">
            {support.permission === 'default' && (
              <Button size="sm" variant="primary" icon={<Bell className="size-4" />} onClick={async () => { await requestPermission(); setSupport(notificationSupport()); }}>
                Allow notifications
              </Button>
            )}
            <Button size="sm" icon={<Send className="size-4" />} busy={testing} disabled={support.permission !== 'granted'} onClick={() => void test()}>
              Send test notification
            </Button>
            <Button size="sm" icon={<CalendarPlus className="size-4" />} onClick={exportIcs} disabled={!data.reminders.some((r) => r.enabled)}>
              Add to calendar (.ics)
            </Button>
          </div>
          {support.permission === 'denied' && (
            <p className="mt-2 flex items-start gap-1.5 text-xs text-ink-3">
              <BellOff className="mt-px size-3.5 shrink-0" /> To unblock: open the site settings (lock icon in the address bar) and allow notifications, then reload.
            </p>
          )}
        </div>
      </div>
    </Section>
  );
}

function DataSection() {
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [includeFiles, setIncludeFiles] = useState(true);
  const [parsed, setParsed] = useState<ParseResult | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteText, setDeleteText] = useState('');
  const [storage, setStorage] = useState<{ usage?: number; quota?: number; persisted?: boolean } | null>(null);
  const exp = useAction(async () => {
    const b = await exportData(includeFiles);
    downloadText(`daybook-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(b), 'application/json');
  }, { success: 'Backup downloaded.' });
  const imp = useAction(async () => {
    if (parsed?.ok) await importData(parsed.backup);
  }, { success: 'Backup restored.' });
  const del = useAction(deleteAllData);

  useEffect(() => {
    void (async () => {
      try {
        const est = await navigator.storage?.estimate?.();
        const persisted = await navigator.storage?.persisted?.();
        setStorage({ usage: est?.usage, quota: est?.quota, persisted });
      } catch {
        setStorage(null);
      }
    })();
  }, []);

  const pick = async (f: File | undefined) => {
    if (!f) return;
    if (f.size > 500 * 1024 * 1024) return toast.show('That file is too large to be a backup from this app.', { tone: 'error' });
    try {
      setParsed(parseBackup(await f.text()));
    } catch (e) {
      toast.show(errorMessage(e), { tone: 'error' });
    }
    if (fileRef.current) fileRef.current.value = '';
  };

  const mb = (b?: number) => (b === undefined ? '?' : `${(b / 1024 / 1024).toFixed(1)} MB`);

  return (
    <Section title="Your data" description="Stored in this browser’s IndexedDB on this device only. No accounts, analytics or trackers. Clearing site data in your browser deletes it — export a backup regularly.">
      {storage && (
        <p className="mb-4 flex items-center gap-2 text-xs text-ink-3">
          <HardDrive className="size-3.5" /> Using {mb(storage.usage)} of {mb(storage.quota)} available · {storage.persisted ? 'protected from automatic eviction' : 'browser may evict under storage pressure'}
        </p>
      )}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <Button icon={<Download className="size-4" />} busy={exp.busy} onClick={() => void exp.run()}>
            Export backup
          </Button>
          <Checkbox checked={includeFiles} onChange={setIncludeFiles} label="Include photos & files" />
        </div>
        <div>
          <input ref={fileRef} type="file" accept="application/json,.json" className="sr-only" id="import-file" onChange={(e) => void pick(e.target.files?.[0])} />
          <Button icon={<Upload className="size-4" />} onClick={() => fileRef.current?.click()}>
            Import backup…
          </Button>
        </div>
        <div className="border-t border-line pt-4">
          <Button variant="danger" icon={<Trash2 className="size-4" />} onClick={() => setDeleteOpen(true)}>
            Delete all data
          </Button>
        </div>
      </div>

      <Dialog
        open={parsed !== null}
        onClose={() => setParsed(null)}
        title={parsed?.ok ? 'Restore this backup?' : 'Can’t import this file'}
        size="sm"
        footer={
          parsed?.ok ? (
            <>
              <Button variant="ghost" onClick={() => setParsed(null)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                busy={imp.busy}
                onClick={async () => {
                  await imp.run();
                  setParsed(null);
                }}
              >
                Replace my data
              </Button>
            </>
          ) : (
            <Button onClick={() => setParsed(null)}>Close</Button>
          )
        }
      >
        {parsed?.ok ? (
          <div className="text-sm leading-relaxed text-ink-2">
            <p>
              Exported {formatInstant(parsed.backup.exportedAt, Intl.DateTimeFormat().resolvedOptions().timeZone)}. Contains {parsed.summary.challenges} challenges, {parsed.summary.progress} progress records, {parsed.summary.habitEntries} habit entries, {parsed.summary.attempts} logged attempts, {parsed.summary.reflections} reflections and {parsed.summary.files} files.
            </p>
            {parsed.summary.filesSkipped > 0 && <p className="mt-2 text-warn">{parsed.summary.filesSkipped} attachments were exported without their file data and will be skipped.</p>}
            <p className="mt-2 flex gap-2 font-medium text-danger">
              <ShieldAlert className="mt-0.5 size-4 shrink-0" /> Everything currently on this device will be replaced. Export first if you want to keep it.
            </p>
          </div>
        ) : (
          <p className="text-sm text-danger">{parsed && !parsed.ok ? parsed.error : ''} Your current data hasn’t been changed.</p>
        )}
      </Dialog>

      <Dialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="Delete all data permanently?"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              disabled={deleteText !== 'DELETE'}
              busy={del.busy}
              onClick={async () => {
                await del.run();
                window.location.reload();
              }}
            >
              Delete everything
            </Button>
          </>
        }
      >
        <p className="text-sm leading-relaxed text-ink-2">This removes your program, every log, reflection, photo and setting from this device. It can’t be undone. Type DELETE to confirm.</p>
        <Input className="mt-3" aria-label="Type DELETE to confirm" value={deleteText} onChange={(e) => setDeleteText(e.target.value)} autoComplete="off" />
      </Dialog>
    </Section>
  );
}
