import clsx from 'clsx';
import { ArrowLeft, ArrowRight, Bell, CalendarDays, Check, Dumbbell, Moon, Package, Shield, Footprints, Target } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { Backdrop } from '../../components/Scene';
import { Logo } from '../../components/Shell';
import { Badge, Button, Card, Checkbox, Field, Input, Switch, Textarea } from '../../components/ui';
import { EQUIPMENT } from '../../data/challenges';
import { LIFE_STAGES, RECOMMENDED_TRACKS } from '../../data/tracks';
import { completeOnboarding, type OnboardingInput } from '../../db/actions';
import { addDays, DEFAULT_TIMEZONE, formatDate, isValidIso, isValidTimeZone, todayIn, weekdayOf } from '../../domain/dates';
import { displayName } from '../../domain/habits';
import { useAction, useApp } from '../../lib/appData';
import { notificationSupport, requestPermission } from '../../lib/notifications';
import { useLibrary } from '../../lib/library';
import { buildPlan, newDraft, PlanBuilder, type PlanDraft } from '../plan/PlanBuilder';

const STEPS = ['Welcome', 'Start date', 'Equipment', 'Challenges', 'Daily rhythm', 'Habits', 'Reminders', 'Mode'] as const;

export function Onboarding() {
  const { data } = useApp();
  const tzDefault = data.settings.timezone || DEFAULT_TIMEZONE;
  const today = todayIn(tzDefault);
  const nextMonday = addDays(today, ((8 - weekdayOf(today)) % 7) || 7);
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<OnboardingInput>(() => ({
    displayName: data.settings.displayName,
    startDate: data.program?.startDate ?? '',
    timezone: tzDefault,
    wakeTime: data.settings.wakeTime,
    morningTime: data.reminders.find((r) => r.id === 'morning')?.time ?? '08:00',
    eveningTime: data.reminders.find((r) => r.id === 'evening')?.time ?? '20:30',
    bedtime: data.settings.bedtime,
    sleepTargetHours: data.settings.sleepTargetHours,
    notifications: true,
    bedtimeReminder: false,
    enabledHabits: data.habits.filter((h) => h.enabled).map((h) => h.id),
    equipment: data.settings.equipment,
    constraints: data.settings.constraints,
    hardMode: data.settings.hardMode,
    lifeStage: data.settings.lifeStage,
    plan: [],
    mode: 'growth',
    themes: [],
    curve: 'steady',
    restEvery: 0,
    tracks: [],
    timeBudget: 'medium',
    wildcards: 'some',
    includeFun: true,
  }));
  const lib = useLibrary();
  const [draft, setDraft] = useState<PlanDraft>(() => newDraft(data.settings.equipment, lib.items, data.settings.lifeStage));
  const cur = STEPS[step];
  const set = <K extends keyof OnboardingInput>(k: K, v: OnboardingInput[K]) => setForm((f) => ({ ...f, [k]: v }));
  const [permission, setPermission] = useState(notificationSupport().permission);
  const finish = useAction(completeOnboarding);

  const dateError = form.startDate && !isValidIso(form.startDate) ? 'Enter a valid date.' : null;
  const canNext = cur === 'Start date' ? !!form.startDate && !dateError && isValidTimeZone(form.timezone) : cur === 'Challenges' ? draft.plan.length >= 3 : true;
  const next = () => {
    // Equipment is known now, so build the suggested plan around it.
    if (cur === 'Equipment' && draft.mode !== 'signature') setDraft({ ...draft, plan: buildPlan(draft, form.equipment, lib.items) });
    setStep((s) => s + 1);
  };

  return (
    <div className="relative isolate min-h-dvh px-4 py-8 md:py-14">
      <Backdrop kind="welcome" full />
      <div className="mx-auto w-full max-w-xl">
        <div className="mb-6 flex items-center gap-3">
          <Logo days={draft.plan.length || 30} />
          <div className="flex-1">
            <p className="text-xs font-medium text-ink-3">
              Setup · Step {step + 1} of {STEPS.length}
            </p>
            <div className="mt-1.5 flex gap-1" aria-hidden>
              {STEPS.map((s, i) => (
                <span key={s} className={clsx('h-1 flex-1 rounded-full transition-colors', i <= step ? 'bg-slate' : 'bg-surface-3')} />
              ))}
            </div>
          </div>
        </div>

        <Card className="animate-fade-up p-5 md:p-7" key={step}>
          {cur === 'Welcome' && (
            <StepBody icon={<Footprints />} title="One new skill a day." lead="A private tracker for a self-improvement challenge of any length: a new challenge every day that gets a little harder, sustainable daily habits, honest progress.">
              <ul className="mb-5 space-y-2 text-sm text-ink-2">
                {['Everything stays on this device. No account, no tracking.', 'Daily habits rotate so you’re never doing everything at once.', 'Missed days stay visible. You decide how to catch up.'].map((t) => (
                  <li key={t} className="flex gap-2">
                    <Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
                    {t}
                  </li>
                ))}
              </ul>
              <Field label="What should we call you? (optional)" htmlFor="ob-name">
                <Input id="ob-name" value={form.displayName} maxLength={60} autoComplete="given-name" onChange={(e) => set('displayName', e.target.value)} placeholder="Your name" />
              </Field>
              <fieldset className="mt-5">
                <legend className="mb-2 text-sm font-medium">Where are you in life?</legend>
                <div className="grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Life stage">
                  {LIFE_STAGES.map((o) => (
                    <ModeCard
                      key={o.value}
                      selected={form.lifeStage === o.value}
                      onSelect={() => {
                        set('lifeStage', o.value);
                        // Suggested tracks and challenge wording follow the life stage.
                        if (draft.mode === 'growth') setDraft({ ...draft, tracks: [...RECOMMENDED_TRACKS[o.value]] });
                      }}
                      title={o.label}
                      body={o.body}
                    />
                  ))}
                </div>
                <p className="mt-2 text-xs text-ink-3">Tailors the suggested skills and how challenges are worded. Change it any time in Settings.</p>
              </fieldset>
            </StepBody>
          )}

          {cur === 'Start date' && (
            <StepBody icon={<CalendarDays />} title="When does Day 1 start?" lead="Pick the day you want to begin. You’ll choose how many days next. You can change this freely until the program begins.">
              <div className="grid gap-4">
                <Field label="Start date" htmlFor="ob-start" error={dateError}>
                  <Input id="ob-start" type="date" value={form.startDate} min={addDays(today, -7)} onChange={(e) => set('startDate', e.target.value)} required />
                </Field>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => set('startDate', today)}>
                    Today
                  </Button>
                  <Button size="sm" onClick={() => set('startDate', addDays(today, 1))}>
                    Tomorrow
                  </Button>
                  <Button size="sm" onClick={() => set('startDate', nextMonday)}>
                    Next Monday
                  </Button>
                </div>
                {form.startDate && !dateError && (
                  <div className="rounded-xl border border-line bg-surface-2 p-3.5 text-sm">
                    <p>
                      <span className="text-ink-3">Day 1:</span> <strong>{formatDate(form.startDate)}</strong>
                    </p>
                  </div>
                )}
                <Field label="Timezone" htmlFor="ob-tz" hint="Detected from this device. Used for “today”, deadlines and reminders." error={isValidTimeZone(form.timezone) ? null : 'Unknown timezone'}>
                  <TimezoneInput id="ob-tz" value={form.timezone} onChange={(v) => set('timezone', v)} />
                </Field>
              </div>
            </StepBody>
          )}

          {cur === 'Challenges' && (
            <StepBody icon={<Target />} title="Build your challenge" lead="Choose how long and which skills to build. Each track climbs from a first step to a real capstone.">
              <PlanBuilder draft={draft} onChange={setDraft} equipment={form.equipment} startDate={form.startDate} stage={form.lifeStage} />
            </StepBody>
          )}

          {cur === 'Daily rhythm' && (
            <StepBody icon={<Moon />} title="Your daily rhythm" lead="Used to time reminders and set a realistic sleep target.">
              <div className="grid grid-cols-2 gap-4">
                <Field label="Typical wake-up" htmlFor="ob-wake">
                  <Input id="ob-wake" type="time" value={form.wakeTime} onChange={(e) => set('wakeTime', e.target.value)} />
                </Field>
                <Field label="Usual bedtime" htmlFor="ob-bed">
                  <Input id="ob-bed" type="time" value={form.bedtime} onChange={(e) => set('bedtime', e.target.value)} />
                </Field>
                <Field label="Morning reminder" htmlFor="ob-morning">
                  <Input id="ob-morning" type="time" value={form.morningTime} onChange={(e) => set('morningTime', e.target.value)} />
                </Field>
                <Field label="Evening check-in" htmlFor="ob-evening">
                  <Input id="ob-evening" type="time" value={form.eveningTime} onChange={(e) => set('eveningTime', e.target.value)} />
                </Field>
                <Field label="Sleep target (optional)" htmlFor="ob-sleep" hint="8–10 hours recommended" className="col-span-2">
                  <Input
                    id="ob-sleep"
                    type="number"
                    inputMode="decimal"
                    min={6}
                    max={11}
                    step={0.5}
                    value={form.sleepTargetHours ?? ''}
                    onChange={(e) => set('sleepTargetHours', e.target.value === '' ? null : Math.min(12, Math.max(4, Number(e.target.value))))}
                  />
                </Field>
              </div>
            </StepBody>
          )}

          {cur === 'Habits' && (
            <StepBody icon={<Dumbbell />} title="Which habits do you want?" lead="All are on by default. They rotate through the week, so most days only have a handful. You can edit any of them later.">
              <HabitPicker enabled={form.enabledHabits} onChange={(v) => set('enabledHabits', v)} />
            </StepBody>
          )}

          {cur === 'Equipment' && (
            <StepBody icon={<Package />} title="Equipment & access" lead="Tick what you have. Suggested challenges favour what you own; anything that needs something else is flagged so you can sort it out in advance.">
              <div className="grid gap-2.5 sm:grid-cols-2">
                {Object.entries(EQUIPMENT).map(([id, label]) => (
                  <Checkbox key={id} checked={form.equipment.includes(id)} onChange={(on) => set('equipment', on ? [...form.equipment, id] : form.equipment.filter((x) => x !== id))} label={label} />
                ))}
              </div>
              <Field label="Other constraints (optional)" htmlFor="ob-constraints" className="mt-5">
                <Textarea id="ob-constraints" value={form.constraints} maxLength={2000} onChange={(e) => set('constraints', e.target.value)} placeholder="e.g. no access to a table tennis table until week 2; shoulder niggle" />
              </Field>
            </StepBody>
          )}

          {cur === 'Reminders' && (
            <StepBody icon={<Bell />} title="Reminders" lead="A morning nudge with today’s challenge, and an evening check-in. Notification text never includes habit names.">
              <div className="space-y-3">
                <Switch checked={form.notifications} onChange={(v) => set('notifications', v)} label="Morning and evening reminders" description={`At ${form.morningTime} and ${form.eveningTime}, your local time.`} />
                <Switch checked={form.bedtimeReminder} onChange={(v) => set('bedtimeReminder', v)} label="Bedtime wind-down reminder" description="30 minutes before your usual bedtime." disabled={!form.notifications} />
              </div>
              {form.notifications && <PermissionCard permission={permission} onRequest={async () => setPermission(await requestPermission())} />}
            </StepBody>
          )}

          {cur === 'Mode' && (
            <StepBody icon={<Shield />} title="Choose your mode" lead="You can switch at any time in Settings.">
              <div className="grid gap-3" role="radiogroup" aria-label="Mode">
                <ModeCard selected={!form.hardMode} onSelect={() => set('hardMode', false)} title="Standard" body="Clear tracking, friendly nudges. Completion still has to be recorded honestly." />
                <ModeCard selected={form.hardMode} onSelect={() => set('hardMode', true)} title="Hard Mode" badge="Accountability" body="End-of-day countdown, open commitments front and centre, direct coaching. Completion only counts when the criteria are met, and missed days must be acknowledged before moving on." />
              </div>
              <p className="mt-4 text-xs leading-relaxed text-ink-3">Either way: rest, illness, injury and genuine conflicts are valid reasons to adjust the plan. The app never asks you to trade sleep, food or recovery for a tick.</p>
            </StepBody>
          )}

          <div className="mt-7 flex items-center justify-between gap-3">
            <Button variant="ghost" onClick={() => setStep((s) => s - 1)} disabled={step === 0} icon={<ArrowLeft className="size-4" />}>
              Back
            </Button>
            {step < STEPS.length - 1 ? (
              <Button variant="primary" onClick={next} disabled={!canNext} icon={<ArrowRight className="size-4" />} className="flex-row-reverse">
                {cur === 'Start date' && !form.startDate ? 'Pick a date' : 'Continue'}
              </Button>
            ) : (
              <Button variant="primary" busy={finish.busy} onClick={() => void finish.run({ ...form, plan: draft.plan, mode: draft.mode, themes: draft.themes, curve: draft.curve, restEvery: draft.restEvery, tracks: draft.tracks, timeBudget: draft.timeBudget, wildcards: draft.wildcards, includeFun: draft.includeFun })}>
                Start my program
              </Button>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

function StepBody({ icon, title, lead, children }: { icon: ReactNode; title: string; lead: string; children: ReactNode }) {
  return (
    <div>
      <div className="mb-4 flex size-10 items-center justify-center rounded-xl bg-surface-2 text-slate [&>svg]:size-5">{icon}</div>
      <h1 className="font-display text-[30px] leading-tight">{title}</h1>
      <p className="mb-6 mt-1.5 text-sm leading-relaxed text-ink-2">{lead}</p>
      {children}
    </div>
  );
}

function ModeCard({ selected, onSelect, title, body, badge }: { selected: boolean; onSelect: () => void; title: string; body: string; badge?: string }) {
  return (
    <button type="button" role="radio" aria-checked={selected} aria-label={`${title}: ${body}`} onClick={onSelect} className={clsx('rounded-xl border p-4 text-left transition-colors', selected ? 'border-slate bg-slate-soft' : 'border-line bg-surface-2 hover:border-line-strong')}>
      <div className="flex items-center gap-2">
        <span className={clsx('flex size-4 items-center justify-center rounded-full border', selected ? 'border-slate' : 'border-line-strong')}>{selected && <span className="size-2 rounded-full bg-accent" />}</span>
        <span className="font-semibold">{title}</span>
        {badge && <Badge tone="accent">{badge}</Badge>}
      </div>
      <p className="mt-1.5 pl-6 text-sm leading-relaxed text-ink-2">{body}</p>
    </button>
  );
}

function HabitPicker({ enabled, onChange }: { enabled: string[]; onChange: (v: string[]) => void }) {
  const { data } = useApp();
  const groups = useMemo(
    () => [
      { title: 'Build', items: data.habits.filter((h) => h.kind === 'build') },
      { title: 'Reduce', items: data.habits.filter((h) => h.kind === 'reduce') },
    ],
    [data.habits],
  );
  return (
    <div className="space-y-5">
      {groups.map((g) => (
        <fieldset key={g.title}>
          <legend className="mb-2 text-[13px] font-semibold uppercase tracking-wide text-ink-3">{g.title}</legend>
          <div className="grid gap-2.5">
            {g.items.map((h) => (
              <Checkbox
                key={h.id}
                checked={enabled.includes(h.id)}
                onChange={(on) => onChange(on ? [...enabled, h.id] : enabled.filter((x) => x !== h.id))}
                label={
                  <span>
                    <span className="font-medium">{displayName(h)}</span>
                    {h.sensitive && (
                      <Badge className="ml-2" tone="violet">
                        Private
                      </Badge>
                    )}
                    <span className="block text-xs text-ink-3">{h.sensitive ? 'Optional, private goal you define yourself. Never shown in notifications.' : h.description}</span>
                  </span>
                }
              />
            ))}
          </div>
        </fieldset>
      ))}
    </div>
  );
}

export function PermissionCard({ permission, onRequest }: { permission: string; onRequest: () => void }) {
  const s = notificationSupport();
  return (
    <div className="mt-5 rounded-xl border border-line bg-surface-2 p-4 text-sm leading-relaxed">
      <p className="font-semibold">Why allow notifications?</p>
      <p className="mt-1 text-ink-2">So the morning plan and evening check-in reach you even when this tab isn’t in front. They appear while the app is open or running in the background.</p>
      <p className="mt-1 text-ink-2">For reminders when the app is fully closed, add the schedule to your phone’s calendar later (Settings → Reminders → Add to calendar).</p>
      {s.ios && !s.standalone && <p className="mt-2 text-warn">On iPhone, notifications only work after adding this app to your Home Screen (Share → Add to Home Screen).</p>}
      <div className="mt-3">
        {permission === 'granted' && <Badge tone="success">Notifications allowed</Badge>}
        {permission === 'denied' && <p className="text-danger">Blocked in browser settings. You’ll still get in-app reminders.</p>}
        {permission === 'unsupported' && <p className="text-ink-3">This browser doesn’t support notifications. You’ll get in-app reminders instead.</p>}
        {permission === 'default' && (
          <Button size="sm" variant="primary" icon={<Bell className="size-4" />} onClick={onRequest}>
            Allow notifications
          </Button>
        )}
      </div>
    </div>
  );
}

const COMMON_TZ = ['UTC', 'America/Los_Angeles', 'America/Denver', 'America/Chicago', 'America/New_York', 'America/Sao_Paulo', 'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Africa/Johannesburg', 'Asia/Dubai', 'Asia/Kolkata', 'Asia/Singapore', 'Asia/Tokyo', 'Australia/Sydney', 'Pacific/Auckland'];

export function TimezoneInput({ id, value, onChange }: { id: string; value: string; onChange: (v: string) => void }) {
  const all = useMemo(() => {
    try {
      return (Intl as typeof Intl & { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf?.('timeZone') ?? COMMON_TZ;
    } catch {
      return COMMON_TZ;
    }
  }, []);
  return (
    <>
      <Input id={id} list={`${id}-list`} value={value} onChange={(e) => onChange(e.target.value)} autoComplete="off" spellCheck={false} />
      <datalist id={`${id}-list`}>
        {all.map((tz) => (
          <option key={tz} value={tz} />
        ))}
      </datalist>
    </>
  );
}
