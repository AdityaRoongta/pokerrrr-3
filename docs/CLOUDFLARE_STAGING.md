# Cloudflare staging deployment

## What this target does

Deploys the existing UI and browser-local practice simulation to **pokerrr-3-staging** in your own Cloudflare account. It does not provision the future shared game server or player login. The Worker returns HTTP 503 for every `/api/poker` request, and the UI disables shared create/join controls. Practice balances are not saved.

The GitHub repository is **arundevanathan/pokerrrr-3** (four trailing r's). The Cloudflare Worker is **pokerrr-3-staging** (three trailing r's). Preserve these exact names.

## Build and verify locally

With the locked dependencies installed:

```sh
pnpm run test
pnpm run test:staging
pnpm run typecheck
pnpm run build:staging
pnpm run check:staging
pnpm exec wrangler deploy --config dist/server/wrangler.json --dry-run --outdir .wrangler/staging-dry-run
pnpm run test:staging:smoke
```

The smoke test starts the built Worker on loopback port 8787, verifies health, blocked multiplayer, server-rendered lobby and install assets, then stops it. Keep that port free. To test an already-running local preview, set `POKER_STAGING_TEST_URL` to its loopback address; the script refuses remote URLs.

For interactive preview use `pnpm run preview:staging` (built Worker, port 8787), or `pnpm run dev:staging` (hot-reload development). Neither touches Cloudflare resources.

## Configuration

`wrangler.staging.jsonc` declares the staging environment and Worker entry point. `scripts/staging.mjs` sets `CLOUDFLARE_ENV=staging` **before the build**, because Cloudflare's Vite plugin flattens the selected environment into the generated `dist/server/wrangler.json`. Do not pass `--env` to deployment of that flattened artifact.

The build pins compatibility date **2026-05-15**, supported by the repository's installed Wrangler/workerd version. The date deliberately does not track today's calendar date. Review runtime/dependency changes together before advancing it.

The original `pnpm run build` and Sites configuration remain available. A build overwrites `dist/`; always run `build:staging` immediately before deploying staging. The staging deploy/preview scripts reject artifacts with a wrong Worker name/environment, D1, R2, Durable Object or service bindings. They accept no deployment overrides.

No database or secrets are required for this practice-only release. Do not add the original Site's placeholder D1 ID, production credentials, PINs or game balances. No mock ChatGPT sign-in or connector service is enabled in this build.

## Cloudflare dashboard

1. Select the existing **pokerrr-3-staging** Worker, then Settings → Builds.
2. Connect only **arundevanathan/pokerrrr-3**. Keep automatic builds disabled until this PR is merged and its GitHub checks pass.
3. Set the production branch to `main`. This is Cloudflare's label for the branch published to this staging Worker; it does not make it the live player environment.
4. Project root: repository root (`/`).
5. Build command: `pnpm run build:staging`.
6. Deploy command: `pnpm run deploy:staging`.
7. Use Node 22 (at least 22.13.0) and the `packageManager` pnpm version in package.json; pin the build environment's Node version if its default differs.
8. Leave optional branch preview deployment unconfigured for this initial target. Leave builds disabled until ready; enable and trigger a staging build deliberately after merge.

Cloudflare's Git integration provides deployment authorization. A separate GitHub Actions deployment API token is not required. GitHub Actions only validates and performs dry runs; it does not publish. Automatic Cloudflare deployments are a separate pipeline and are not gated by completion of GitHub checks: use a protected/reviewed `main` branch where supported and only merge verified changes.

## Verify the actual deployment

- Open the Worker's `workers.dev` address: the home screen says **STAGING · PRACTICE ONLY**.
- `/api/health` returns `environment: "staging"`, the checked-out Git commit as `version`, `mode: "practice-only"`, and `multiplayerReady: false`.
- Shared create/join buttons are disabled; direct GET and POST `/api/poker` requests return 503 `MULTIPLAYER_NOT_CONFIGURED`.
- Start a practice hand and verify dealing, actions, sound and the existing Once/Twice preview. Reloading must not imply a saved/shared practice session.
- Confirm phone viewport and install assets. Staging is publicly reachable but contains no real player data; treat everything entered as disposable practice data.

## Recovery and next steps

If a release is faulty, disable automatic builds first and use the Worker's deployment history to roll back a known-good version. Keep any fix in Git before enabling builds again. This first release has no persistent game storage to migrate or lose.

Future work: authenticated WebSockets, one authoritative Durable Object with SQLite storage and persisted timers, persistent PIN sessions, durable history and the cross-session settlement ledger. Provision production separately with isolated storage/secrets. Do not repurpose staging test balances as real accounting.
