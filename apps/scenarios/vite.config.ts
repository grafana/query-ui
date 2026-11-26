import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packagesDir = path.resolve(__dirname, '../../packages');

/**
 * Points query-ui's imports of useVariableContextState at a wrapper that counts
 * each variable's commits for the render stats. The wrapper imports the real
 * hook itself, so its own import is left alone. This only affects this app:
 * query-ui's build and tests import the hook directly.
 */
function probeVariableContextState(): Plugin {
  const hook = path.join(
    packagesDir,
    'query-ui/src/variables/useVariableContextState.ts',
  );
  const probe = path.resolve(
    __dirname,
    'src/renderStats/useVariableContextStateProbe.ts',
  );

  return {
    name: 'probe-variable-context-state',
    enforce: 'pre',
    async resolveId(source, importer, options) {
      if (
        !importer ||
        importer === probe ||
        !source.endsWith('/useVariableContextState')
      ) {
        return null;
      }

      const resolved = await this.resolve(source, importer, {
        ...options,
        skipSelf: true,
      });

      return resolved?.id === hook ? probe : null;
    },
  };
}

export default defineConfig({
  plugins: [probeVariableContextState(), react()],
  resolve: {
    alias: [
      // Resolve the workspace package to its TypeScript source rather than the
      // bundled dist/, so editing packages/query-ui hot-reloads here instead of
      // requiring a rebuild. Typecheck still goes through the published types
      // (see tsconfig.app.json) — turbo builds query-ui first.
      {
        find: /^@grafana\/query-ui$/,
        replacement: path.join(packagesDir, 'query-ui/src/index.ts'),
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
      // The query-ui source aliased above lives outside this app's root.
      allow: ['../..'],
    },
    watch: {
      // Vite only watches files reachable from the app root by default, so
      // edits under packages/ would not trigger an HMR update without this.
      ignored: ['!**/packages/query-ui/src/**'],
    },
  },
  preview: {
    port: 5274,
  },
});
