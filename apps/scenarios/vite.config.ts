import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packagesDir = path.resolve(__dirname, '../../packages');

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      // Resolve the workspace package to its TypeScript source rather than the
      // bundled dist/, so editing packages/scenes2 hot-reloads here instead of
      // requiring a rebuild. Typecheck still goes through the published types
      // (see tsconfig.app.json) — turbo builds scenes2 first.
      {
        find: /^@grafana\/scenes2$/,
        replacement: path.join(packagesDir, 'scenes2/src/index.ts'),
      },
    ],
  },
  // @grafana/plugin-compat feature-detects newer @grafana/runtime APIs with
  // static named imports guarded by `typeof x === 'function'`. Grafana loads
  // runtime as an external, where a missing export is just undefined, but this
  // app bundles runtime 13.2.0, which doesn't export them yet. Shim the missing
  // exports to undefined so plugin-compat takes its fallback path. Both the
  // production build and the dev server's dependency pre-bundling need it.
  build: {
    rolldownOptions: { shimMissingExports: true },
  },
  optimizeDeps: {
    rolldownOptions: { shimMissingExports: true },
  },
  server: {
    port: 5273,
    fs: {
      // The scenes2 source aliased above lives outside this app's root.
      allow: ['../..'],
    },
    watch: {
      // Vite only watches files reachable from the app root by default, so
      // edits under packages/ would not trigger an HMR update without this.
      ignored: ['!**/packages/scenes2/src/**'],
    },
  },
  preview: {
    port: 5274,
  },
});
