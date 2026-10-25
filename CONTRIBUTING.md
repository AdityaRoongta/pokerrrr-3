# Contributing to Dunzo Club

This is one private group's poker app. Build for one active session, stable player identities, and retained history/weekly settlement. Avoid multi-table and public-platform features.

1. Pick a prepared backlog item or GitHub issue and agree on its acceptance criteria.
2. Create a short feature branch from `main`.
3. Keep UI requests separate from authoritative game/accounting changes where practical.
4. Run `pnpm test`, `pnpm typecheck`, and `pnpm build`. API changes also need `pnpm build:staging`, `pnpm test:staging`, `pnpm check:staging`, and `pnpm test:staging:smoke`, plus appropriate concurrency/privacy tests.
5. Open a pull request describing the behavior, validation and remaining limits. Another contributor reviews before merging.

Use staging/test data. Do not commit secrets or real balances/cards, and do not run tests against the live group. Never acknowledge an accounting change before it is saved, and design retries to have only one effect.

Cloudflare Git builds can publish main to staging independently of GitHub CI; check that automation before merging. Production publication, database migrations, recovery and rollback must be documented before automated releases are enabled. Existing Sites hosting remains separate.
