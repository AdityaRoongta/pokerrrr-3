import { execFileSync } from 'node:child_process';
import vinext from 'vinext';
import { cloudflare } from '@cloudflare/vite-plugin';

export function stagingConfig() {
  // Read the commit actually checked out by the builder, not a developer's local value.
  const commit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  return {
    server: { allowedHosts: ['terminal.local'] },
    define: {
      'process.env.NEXT_PUBLIC_APP_ENV': JSON.stringify('staging'),
      'process.env.NEXT_PUBLIC_MULTIPLAYER_ENABLED': JSON.stringify('false'),
      __STAGING_BUILD_COMMIT__: JSON.stringify(commit),
    },
    plugins: [
      vinext(),
      cloudflare({
        configPath: './wrangler.staging.jsonc',
        viteEnvironment: { name: 'rsc', childEnvironments: ['ssr'] },
        inspectorPort: false,
      }),
    ],
  };
}
