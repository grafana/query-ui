import type { Configuration } from 'webpack';
import grafanaConfig, { type Env } from './.config/webpack/webpack.config.ts';

// Extends the scaffolded config (see .config/README.md, "Extend the Webpack
// config"). Keep project-specific changes here, not in .config/.
const config = async (env: Env): Promise<Configuration> => {
  const baseConfig = await grafanaConfig(env);

  return {
    ...baseConfig,
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
