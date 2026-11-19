import { createRequire } from 'node:module';
import path from 'node:path';
import type { Configuration } from 'webpack';
import grafanaConfig, { type Env } from './.config/webpack/webpack.config.ts';

// Extends the scaffolded config (see .config/README.md, "Extend the Webpack
// config"). Keep project-specific changes here, not in .config/.
const config = async (env: Env): Promise<Configuration> => {
  const baseConfig = await grafanaConfig(env);

  // @grafana/i18n is bundled into the plugin (it isn't a webpack external). It
  // depends on @typescript-eslint/utils, which peers on eslint, so pnpm can
  // install one physical copy per eslint version in the workspace. Each copy
  // keeps its own `t()` state, and initPluginTranslations only initializes the
  // one module.tsx imports, so @grafana/query-ui then throws "t() was called
  // before i18n was initialized". Pin every import to the demo app's copy.
  const i18nDir = path.dirname(
    createRequire(path.join(process.cwd(), 'package.json')).resolve('@grafana/i18n/package.json')
  );

  return {
    ...baseConfig,
    resolve: {
      ...baseConfig.resolve,
      alias: {
        ...baseConfig.resolve?.alias,
        '@grafana/i18n': i18nDir,
      },
    },
    module: {
      ...baseConfig.module,
      rules: [
        ...(baseConfig.module?.rules ?? []),
        // @grafana/query-ui declares "type": "module", so webpack resolves its
        // .js files as strict ESM and rejects extensionless and directory
        // imports. The `pnpm dev` tsc watcher in packages/query-ui emits
        // those as written in source; Rollup builds don't. Relax the check so
        // both outputs resolve.
        {
          test: /\.m?js$/,
          resolve: { fullySpecified: false },
        },
      ],
    },
  };
};

export default config;
