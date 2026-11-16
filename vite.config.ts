import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// Served from https://heavyjetstriker.github.io/mountaneering-training-app/ on GitHub Pages.
const BASE = '/mountaneering-training-app/';
// The manifest can't read CSS variables: this is Primer's dark canvas (--bgColor-default), same as index.html.
const CANVAS = '#0d1117';

export default defineConfig({
  base: BASE,
  plugins: [
    react(),
    VitePWA({
      // A new version waits until I tap Reload (never mid-log).
      registerType: 'prompt',
      injectRegister: false,
      manifest: {
        id: BASE,
        name: 'Mountain Training',
        short_name: 'Training',
        description: 'My 12-week mountaineering training plan',
        start_url: BASE,
        scope: BASE,
        display: 'standalone',
        background_color: CANVAS,
        theme_color: CANVAS,
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Everything in dist: JS (with plan.json inside), CSS, Mona Sans, icons.
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  test: {
    environment: 'node',
  },
});
