import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { ensureSeeded } from './db/actions';
import './index.css';

// Apply the last-used theme before first paint (the real setting lives in IndexedDB).
try {
  if (localStorage.getItem('theme') === 'light') document.documentElement.classList.remove('dark');
} catch {
  /* storage unavailable */
}

const root = createRoot(document.getElementById('root')!);

ensureSeeded()
  .then(() => {
    // Ask the browser not to evict our data under storage pressure.
    void navigator.storage?.persist?.().catch(() => false);
    root.render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
  })
  .catch((e: unknown) => {
    root.render(<StorageError error={e} />);
  });

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  void import('virtual:pwa-register').then(({ registerSW }) => {
    registerSW({ immediate: true });
  });
}

function StorageError({ error }: { error: unknown }) {
  return (
    <div style={{ maxWidth: 520, margin: '15vh auto', padding: 24, fontFamily: 'system-ui', lineHeight: 1.5 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700 }}>Storage unavailable</h1>
      <p>The app couldn’t open its local database, so nothing can be saved. This usually happens in private browsing modes or when site data is blocked.</p>
      <p>Open the app in a normal window, or allow site data for this site, then reload.</p>
      <pre style={{ whiteSpace: 'pre-wrap', opacity: 0.7, fontSize: 12 }}>{error instanceof Error ? error.message : String(error)}</pre>
    </div>
  );
}
