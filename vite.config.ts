import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Served from https://heavyjetstriker.github.io/mountaneering-training-app/ on GitHub Pages.
export default defineConfig({
  base: '/mountaneering-training-app/',
  plugins: [react()],
  test: {
    environment: 'node',
  },
});
