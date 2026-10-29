import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import type { Plugin } from 'vite';

const CSP =
  "default-src 'self'; img-src 'self' blob: data:; media-src 'self' blob:; style-src 'self' 'unsafe-inline'; " +
  "script-src 'self'; connect-src 'self'; worker-src 'self'; object-src 'none'; base-uri 'self'; form-action 'none'";

/** Adds a strict Content-Security-Policy to the production HTML only (dev needs inline HMR scripts). */
function cspPlugin(): Plugin {
  return {
    name: 'csp-meta',
    apply: 'build',
    transformIndexHtml: (html) =>
      html.replace('<meta charset="UTF-8" />', `<meta charset="UTF-8" />
    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`),
  };
}

export default defineConfig({
  plugins: [
    react(),
    cspPlugin(),
    tailwindcss(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'autoUpdate',
      injectRegister: false,
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,svg,png,jpg,webmanifest,woff2}'],
        // Fetched by the browser only when needed: extended-alphabet fonts and install-time icons.
        globIgnores: ['og-image.jpg', '**/*latin-ext*', 'icons/seal-icon-*', 'icons/seal-apple-touch-icon.png', 'icons/seal-favicon-192*'],
      },
      devOptions: { enabled: false },
      manifest: {
        name: 'Daybook',
        short_name: 'Daybook',
        description: 'A private daily-challenge, habit and progress tracker. One new skill a day.',
        theme_color: '#f2f0eb',
        background_color: '#f3efec',
        display: 'standalone',
        start_url: './',
        scope: './',
        icons: [
          { src: 'icons/seal-icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/seal-icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icons/seal-icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
  base: './',
});
