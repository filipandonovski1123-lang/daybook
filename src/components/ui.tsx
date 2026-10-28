import clsx from 'clsx';
import { Check, ChevronDown, X } from 'lucide-react';
import { forwardRef, useEffect, useId, useRef, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';

// ---------------------------------------------------------------- Button

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
type Size = 'sm' | 'md' | 'lg';

const variants: Record<Variant, string> = {
  primary: 'bg-accent text-accent-ink hover:bg-accent-strong font-medium',
  secondary: 'bg-surface text-ink border border-line hover:bg-surface-2 hover:border-line-strong',
  ghost: 'text-ink-2 hover:text-ink hover:bg-surface-2',
  danger: 'bg-danger-soft text-danger hover:bg-danger hover:text-white border border-transparent',
  success: 'bg-slate text-white hover:brightness-110 font-medium dark:text-[#14181c]',
};
const sizes: Record<Size, string> = {
  sm: 'h-8 px-3 text-[13px] gap-1.5 rounded-md',
  md: 'h-10 px-4 text-sm gap-2 rounded-lg',
  lg: 'h-12 px-5 text-[15px] gap-2 rounded-lg',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
  busy?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button({ variant = 'secondary', size = 'md', icon, busy, className, children, disabled, type = 'button', ...rest }, ref) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      className={clsx('inline-flex shrink-0 select-none items-center justify-center whitespace-nowrap font-medium transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50', variants[variant], sizes[size], className)}
      {...rest}
    >
      {busy ? <span className="size-4 animate-spin rounded-full border-2 border-current border-r-transparent" aria-hidden /> : icon}
      {children}
    </button>
  );
});

export function IconButton({ label, children, className, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button type="button" aria-label={label} title={label} className={clsx('inline-flex size-9 items-center justify-center rounded-lg text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink disabled:opacity-40', className)} {...rest}>
      {children}
    </button>
  );
}

// ---------------------------------------------------------------- Card & layout

export function Card({ className, children, as: As = 'section', ...rest }: { className?: string; children: ReactNode; as?: 'section' | 'div' | 'article' } & React.HTMLAttributes<HTMLElement>) {
  return (
    <As className={clsx('rounded-[var(--radius-card)] border border-line bg-surface shadow-card', className)} {...rest}>
      {children}
    </As>
  );
}

export function SectionTitle({ children, action, id, className }: { children: ReactNode; action?: ReactNode; id?: string; className?: string }) {
  return (
    <div className={clsx('mb-2.5 flex items-center justify-between gap-3', className)}>
      <h2 id={id} className="font-display text-[19px] leading-tight text-ink">
        {children}
      </h2>
      {action}
    </div>
  );
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: ReactNode; action?: ReactNode }) {
  return (
    <header className="mb-5 flex items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="font-display text-[32px] leading-[1.1] md:text-[38px]">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-ink-2">{subtitle}</p>}
      </div>
      {action}
    </header>
  );
}

export function EmptyState({ icon, title, children, action }: { icon: ReactNode; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-10 text-center">
      <div className="mb-3 flex size-11 items-center justify-center rounded-xl bg-surface-2 text-ink-3">{icon}</div>
      <p className="font-semibold">{title}</p>
      {children && <p className="mt-1 max-w-sm text-sm text-ink-2">{children}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

// ---------------------------------------------------------------- Badge

const tones = {
  neutral: 'bg-surface-2 text-ink-2 border-line',
  accent: 'bg-accent-soft text-accent border-transparent',
  success: 'bg-success-soft text-success border-transparent',
  info: 'bg-info-soft text-info border-transparent',
  warn: 'bg-warn-soft text-warn border-transparent',
  danger: 'bg-danger-soft text-danger border-transparent',
  violet: 'bg-violet-soft text-violet border-transparent',
} as const;
export type Tone = keyof typeof tones;

export function Badge({ tone = 'neutral', children, className, icon }: { tone?: Tone; children: ReactNode; className?: string; icon?: ReactNode }) {
  return (
    <span className={clsx('inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-medium leading-4', tones[tone], className)}>
      {icon}
      {children}
    </span>
  );
}

// ---------------------------------------------------------------- Form controls

export function Field({ label, hint, error, children, htmlFor, className }: { label: ReactNode; hint?: ReactNode; error?: string | null; children: ReactNode; htmlFor?: string; className?: string }) {
  return (
    <div className={clsx('flex flex-col gap-1.5', className)}>
      <label htmlFor={htmlFor} className="text-[13px] font-medium text-ink-2">
        {label}
      </label>
      {children}
      {hint && !error && <p className="text-xs text-ink-3">{hint}</p>}
      {error && (
        <p className="text-xs text-danger" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

const inputCls = 'w-full rounded-lg border border-line bg-surface px-3 py-2 text-ink placeholder:text-ink-3 transition-colors hover:border-line-strong focus:border-slate focus:outline-none focus:ring-2 focus:ring-[var(--ring)] disabled:opacity-60';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...rest }, ref) {
  return <input ref={ref} className={clsx(inputCls, 'h-10', className)} {...rest} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, ...rest }, ref) {
  return <textarea ref={ref} className={clsx(inputCls, 'min-h-[84px] resize-y leading-relaxed', className)} {...rest} />;
});

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative">
      <select className={clsx(inputCls, 'h-10 appearance-none pr-9', className)} {...rest}>
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" aria-hidden />
    </div>
  );
}

export function Switch({ checked, onChange, label, description, disabled, id }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode; description?: ReactNode; disabled?: boolean; id?: string }) {
  const auto = useId();
  const sid = id ?? auto;
  return (
    <div className="flex items-start justify-between gap-4 py-1">
      <div className="min-w-0">
        <label htmlFor={sid} className="text-sm font-medium">
          {label}
        </label>
        {description && <p className="mt-0.5 text-xs leading-relaxed text-ink-3">{description}</p>}
      </div>
      <button
        id={sid}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={clsx('relative mt-0.5 inline-flex h-6 w-10 shrink-0 items-center rounded-full border transition-colors disabled:opacity-50', checked ? 'border-slate bg-slate' : 'border-line-strong bg-surface-3')}
      >
        <span className={clsx('inline-block size-[18px] rounded-full bg-white shadow transition-transform', checked ? 'translate-x-[19px]' : 'translate-x-[2px]')} />
      </button>
    </div>
  );
}

export function Checkbox({ checked, onChange, label, disabled, className, size = 'md' }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode; disabled?: boolean; className?: string; size?: 'md' | 'lg' }) {
  return (
    <label className={clsx('flex cursor-pointer items-start gap-3', disabled && 'cursor-not-allowed opacity-60', className)}>
      <input type="checkbox" className="peer sr-only" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span
        aria-hidden
        className={clsx(
          'mt-px flex shrink-0 items-center justify-center border transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-[var(--ring)]',
          'rounded-full',
          size === 'lg' ? 'size-6' : 'size-5',
          checked ? 'border-slate bg-slate text-white dark:text-[#14181c]' : 'border-line-strong bg-surface',
        )}
      >
        {checked && <Check className={clsx('animate-check', size === 'lg' ? 'size-4' : 'size-3.5')} strokeWidth={3} />}
      </span>
      <span className="min-w-0 text-sm leading-snug">{label}</span>
    </label>
  );
}

export function Segmented<T extends string>({ value, onChange, options, label, size = 'md' }: { value: T; onChange: (v: T) => void; options: { value: T; label: ReactNode }[]; label: string; size?: 'sm' | 'md' }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-[10px] border border-line bg-surface-2 p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={clsx('rounded-lg font-medium transition-colors', size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3 py-1.5 text-[13px]', value === o.value ? 'bg-surface text-ink shadow-card' : 'text-ink-3 hover:text-ink')}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function RatingPicker({ value, onChange, label, low, high }: { value: number | null; onChange: (v: number | null) => void; label: string; low?: string; high?: string }) {
  return (
    <div>
      <div role="radiogroup" aria-label={label} className="flex gap-1.5">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={`${n} of 5`}
            onClick={() => onChange(value === n ? null : n)}
            className={clsx('h-9 flex-1 rounded-lg border text-sm font-semibold transition-colors', value === n ? 'border-slate bg-slate-soft text-slate' : 'border-line bg-surface text-ink-3 hover:text-ink')}
          >
            {n}
          </button>
        ))}
      </div>
      {(low || high) && (
        <div className="mt-1 flex justify-between text-[11px] text-ink-3">
          <span>{low}</span>
          <span>{high}</span>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- Dialog (native <dialog> = focus trap + Esc)

export function Dialog({ open, onClose, title, children, footer, size = 'md' }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; footer?: ReactNode; size?: 'sm' | 'md' | 'lg' }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal?.();
    if (!open && d.open) d.close?.();
  }, [open]);
  const titleId = useId();
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className={clsx('m-auto max-h-[90dvh] w-[calc(100%-24px)] overflow-hidden rounded-2xl border border-line bg-surface p-0 text-ink shadow-pop', size === 'sm' ? 'max-w-sm' : size === 'lg' ? 'max-w-2xl' : 'max-w-lg')}
    >
      {open && (
        <div className="flex max-h-[90dvh] flex-col">
          <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3.5">
            <h2 id={titleId} className="font-display text-xl">
              {title}
            </h2>
            <IconButton label="Close" onClick={onClose}>
              <X className="size-4" />
            </IconButton>
          </div>
          <div className="overflow-y-auto px-5 py-4">{children}</div>
          {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-line px-5 py-3">{footer}</div>}
        </div>
      )}
    </dialog>
  );
}

export function ConfirmDialog({ open, onClose, onConfirm, title, children, confirmLabel = 'Confirm', tone = 'primary', busy }: { open: boolean; onClose: () => void; onConfirm: () => void; title: string; children: ReactNode; confirmLabel?: string; tone?: 'primary' | 'danger'; busy?: boolean }) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant={tone === 'danger' ? 'danger' : 'primary'} onClick={onConfirm} busy={busy}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="text-sm leading-relaxed text-ink-2">{children}</div>
    </Dialog>
  );
}

// ---------------------------------------------------------------- Disclosure

export function Disclosure({ summary, children, defaultOpen = false, className, badge }: { summary: ReactNode; children: ReactNode; defaultOpen?: boolean; className?: string; badge?: ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();
  return (
    <div className={className}>
      <button type="button" aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)} className="flex w-full items-center justify-between gap-3 py-2 text-left">
        <span className="flex items-center gap-2 text-sm font-semibold">
          {summary}
          {badge}
        </span>
        <ChevronDown className={clsx('size-4 text-ink-3 transition-transform', open && 'rotate-180')} aria-hidden />
      </button>
      <div id={id} hidden={!open}>
        {children}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Progress

export function ProgressRing({ value, size = 64, stroke = 6, children, tone = 'accent', label }: { value: number; size?: number; stroke?: number; children?: ReactNode; tone?: 'accent' | 'success'; label: string }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value));
  return (
    <div className="relative inline-flex shrink-0 items-center justify-center" style={{ width: size, height: size }} role="img" aria-label={label}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-3)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={tone === 'success' ? 'var(--success)' : 'var(--slate)'} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - v)} style={{ transition: 'stroke-dashoffset 500ms cubic-bezier(.2,.8,.2,1)' }} />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">{children}</div>
    </div>
  );
}

export function ProgressBar({ value, tone = 'accent', className, label }: { value: number; tone?: 'accent' | 'success' | 'info'; className?: string; label: string }) {
  const v = Math.max(0, Math.min(1, value));
  return (
    <div className={clsx('h-1.5 w-full overflow-hidden rounded-full bg-surface-3', className)} role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(v * 100)}>
      <div className={clsx('h-full rounded-full transition-[width] duration-500', tone === 'success' ? 'bg-success' : tone === 'info' ? 'bg-info' : 'bg-slate')} style={{ width: `${v * 100}%` }} />
    </div>
  );
}

export function Stat({ label, value, sub, tone }: { label: string; value: ReactNode; sub?: ReactNode; tone?: 'success' | 'danger' | 'accent' }) {
  return (
    <div className="min-w-0">
      <p className="text-xs font-medium text-ink-3">{label}</p>
      <p className={clsx('tnum font-display mt-0.5 text-[28px] leading-tight', tone === 'success' && 'text-success', tone === 'danger' && 'text-danger', tone === 'accent' && 'text-accent')}>{value}</p>
      {sub && <p className="mt-0.5 text-xs text-ink-3">{sub}</p>}
    </div>
  );
}

export function Difficulty({ value }: { value: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" role="img" aria-label={`Difficulty ${value} of 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} className={clsx('h-2.5 w-1.5 rounded-sm', n <= value ? 'bg-slate' : 'bg-surface-3')} />
      ))}
    </span>
  );
}
