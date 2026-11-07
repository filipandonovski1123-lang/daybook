import clsx from 'clsx';

export function Wordmark({ compact = false }: { compact?: boolean }) {
  const seal = compact ? 'size-[26px]' : 'size-[30px]';
  return (
    <span className="flex items-center gap-2">
      <img src="./icons/seal-mark.png" alt="" className={clsx(seal, 'dark:hidden')} />
      <img src="./icons/seal-mark-dark.png" alt="" className={clsx(seal, 'hidden dark:block')} />
      <span className={clsx('font-display leading-none text-ink', compact ? 'text-[22px]' : 'text-[26px]')}>Daybook</span>
    </span>
  );
}

/** Kept for onboarding. */
export function Logo() {
  return <Wordmark />;
}

