# Contributing to Dunzo Club

Dunzo Club is a stable baseline for one private group: one active session,
persistent player identities, retained history and date-range settlement.
Documentation describes current behavior; new changes start from this baseline.

## Changes

1. Create a feature branch from `main` and define the requested behavior.
2. Keep changes focused. Preserve server authority, private views and integer chip accounting.
3. Explain non-obvious rules and invariants in comments. Keep source readable with two-space indentation.
4. Run `pnpm test`, `pnpm typecheck` and `pnpm build`. Server or deployment changes also require `pnpm test:staging`, `pnpm build:staging`, `pnpm check:staging` and `pnpm test:staging:smoke`.
5. Open a pull request describing the change and validation, and review it before merging.

## Data and releases

Use disposable local data for tests. Never commit credentials, real balances or
private cards. API tests reject remote targets. An accounting command must be
saved before acknowledgement and have only one effect when retried.

Cloudflare Git integration can deploy `main` independently of GitHub CI. Check
that configuration before merging. Keep the existing Durable Object namespace
and migration identity intact so releases retain the roster, active game and history.

See [architecture](docs/ARCHITECTURE.md), [player administration](docs/PLAYERS.md)
and [deployment](docs/CLOUDFLARE_STAGING.md).
