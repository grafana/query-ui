import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  test: {
    server: {
      deps: {
        // Force these packages through Vite instead of Node's loader; resolves
        // ESM/CJS compatibility issues when running tests against published
        // @grafana/* dependencies (@grafana/data imports named exports from
        // moment-timezone, which only ships CJS). Inlining @grafana/ui and
        // @grafana/runtime also lets Vite handle uplot's CSS import, which
        // Node can't load; src/test/setup.ts stubs the browser APIs uplot calls
        // on load.
        inline: [/@grafana\//, /moment/, /react-use/],
      },
    },
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
