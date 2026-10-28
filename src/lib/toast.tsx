import clsx from 'clsx';
import { CircleCheck, Info, TriangleAlert, X } from 'lucide-react';
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';

type ToastTone = 'success' | 'error' | 'info';
interface Toast {
  id: number;
  tone: ToastTone;
  message: string;
  action?: { label: string; run: () => void };
}

interface ToastApi {
  show: (message: string, opts?: { tone?: ToastTone; action?: Toast['action']; duration?: number }) => void;
}

const Ctx = createContext<ToastApi>({ show: () => {} });

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);
  const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const show = useCallback<ToastApi['show']>(
    (message, opts) => {
      const id = nextId.current++;
      setToasts((t) => [...t.slice(-2), { id, tone: opts?.tone ?? 'success', message, action: opts?.action }]);
      window.setTimeout(() => dismiss(id), opts?.duration ?? (opts?.tone === 'error' ? 7000 : 3500));
    },
    [dismiss],
  );
  const api = useMemo(() => ({ show }), [show]);
  return (
    <Ctx.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-[calc(76px+env(safe-area-inset-bottom))] z-50 flex flex-col items-center gap-2 px-4 md:bottom-6 md:left-auto md:right-6 md:items-end" aria-live="polite" role="status">
        {toasts.map((t) => (
          <div key={t.id} className={clsx('animate-fade-up pointer-events-auto flex w-full max-w-sm items-start gap-2.5 rounded-xl border bg-surface px-3.5 py-3 text-sm shadow-pop', t.tone === 'error' ? 'border-danger/40' : 'border-line')}>
            {t.tone === 'success' && <CircleCheck className="mt-px size-4 shrink-0 text-success" aria-hidden />}
            {t.tone === 'error' && <TriangleAlert className="mt-px size-4 shrink-0 text-danger" aria-hidden />}
            {t.tone === 'info' && <Info className="mt-px size-4 shrink-0 text-info" aria-hidden />}
            <p className="min-w-0 flex-1 leading-snug">{t.message}</p>
            {t.action && (
              <button
                type="button"
                className="shrink-0 font-semibold text-accent hover:underline"
                onClick={() => {
                  t.action?.run();
                  dismiss(t.id);
                }}
              >
                {t.action.label}
              </button>
            )}
            <button type="button" aria-label="Dismiss" className="shrink-0 text-ink-3 hover:text-ink" onClick={() => dismiss(t.id)}>
              <X className="size-4" />
            </button>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export const useToast = () => useContext(Ctx);
