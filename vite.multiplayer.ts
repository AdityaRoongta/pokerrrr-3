import { execFileSync } from 'node:child_process';
import vinext from 'vinext';
import { cloudflare } from '@cloudflare/vite-plugin';

export function multiplayerConfig(environment: 'staging' | 'production') {
  // Read the commit actually checked out by the builder, not a developer's local value.
  const commit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  return {
    server: { allowedHosts: ['terminal.local'] },
    define: {
      'process.env.NEXT_PUBLIC_APP_ENV': JSON.stringify(environment),
      'process.env.NEXT_PUBLIC_MULTIPLAYER_ENABLED': JSON.stringify('true'),
      __STAGING_BUILD_COMMIT__: JSON.stringify(commit),
    },
    plugins: [
      vinext(),
      cloudflare({
        configPath: `./wrangler.${environment}.jsonc`,
        viteEnvironment: { name: 'rsc', childEnvironments: ['ssr'] },
        inspectorPort: false,
      }),
    ],
  };
}
