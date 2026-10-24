# pokerrrr-3

Private mixed poker for one group of friends. One active table/session at a time; 7–8 seats, NLH → PLO4 → PLO5, rotating every 2–4 completed hands. Defaults: 25/50 blinds and 2,500 starting chips, with player-selected starting stacks and automatic reloads.

## Status

Working prototype imported from the existing Sites project, with the original Git history archived in `migration/source-history.bundle`. The last deployed baseline passed 39 engine/presentation tests, TypeScript checking and a production build. The latest API integration script has not yet been verified. Persistent account login, independent server/client deployment and cross-session weekly settlement are planned work, not completed features.

Source location and hosting are separate. Importing this repository does not migrate production storage, authentication, hosting or existing sessions. The existing live app remains at https://home-game-poker.arundevanathan.chatgpt.site.

## Product scope

- One private group and one active session. No public tables, matchmaking, tournaments or multi-group administration.
- Keep completed sessions and hand history. Members settle balances across several sessions, typically weekly.
- Persistent player identities and refreshable login sessions are required; repeated login on every app launch is not the intended experience.
- All authoritative multiplayer decisions happen on the server. Practice mode runs a separate local simulation.
- Money is transferred outside the app. The app records chip accounting and external settlement.

## Code map

| Path | Purpose |
| --- | --- |
| `lib/poker.mjs` | Pure poker engine: shuffle, betting, evaluation, pots, rotation and player-specific views |
| `app/api/poker/route.ts` | Current authoritative HTTP API; D1 room state and optimistic version checking |
| `app/page.tsx` | Current React UI, polling, local practice and session controls |
| `lib/table-presentation.mjs` | Shared dealing, runout and payout timelines |
| `lib/use-table-effects.ts`, `app/table-motion.tsx` | Client animations and sound scheduling |
| `drizzle/` | Database schema migrations |
| `tests/` | Engine, presentation and HTTP integration checks |
| `docs/BACKLOG.md` | Published issue links and remaining work with acceptance criteria |
| `docs/issues.json` | Published issue payloads and GitHub issue numbers |
| `docs/SITES_STARTER.md` | Retained framework/platform setup reference |

## Local development

Prerequisites: Node.js >=22.13.0 and the pnpm version declared in `package.json`. Install that pnpm version using your normal package-manager setup, then:

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Use the URL printed by the development server. Practice mode is browser-local. Multiplayer also needs the local D1 schema. For a built local server:

```sh
pnpm build
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_public_cargill.sql
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0001_durable_hand_history.sql
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0002_private_hand_cards.sql
pnpm start
```

Apply each migration once per fresh local database, in order. `0001_durable_hand_history.sql` adds completed-hand, action-event and session records; it is required for hand-history JSON/CSV exports, voluntary reveals and Rabbit Hunt logging. These commands reflect the retained framework setup; fresh-machine verification outside the original workspace remains a tracked task. See `docs/SITES_STARTER.md` for platform profiles and bindings. Do not run integration tests against live storage.

## Checks

```sh
pnpm test
pnpm typecheck
pnpm build
```

With a disposable local API running, set its actual URL and run:

```sh
POKER_TEST_URL=http://127.0.0.1:8787 pnpm test:api
```

The URL is illustrative: replace it with the server's printed address. The integration script creates a test room and modifies it. Unit tests are the two explicit engine/presentation files; the API script is separate so it cannot accidentally run against an unspecified service.

## Architecture direction

Extract a static React/PWA client and an authoritative server, reusing the poker engine and private-view filtering. Proposed server: Cloudflare Worker routing to one Durable Object for the group's active table, with authenticated WebSockets and persistent deadlines/state. Retain completed sessions and a separate ledger for cross-session settlement. This architecture has not yet been implemented.

GitHub Pages can host a static practice demo or an extracted client connected to a separate backend. It cannot host the existing Worker API or D1 database. Pages publication is not configured in this import.

## Collaboration and releases

Use short feature branches and reviewed pull requests. Start from an issue with acceptance criteria. Do not change poker rules or chip accounting without focused tests. Protect `main` with checks/review if the repository's plan permits it. A merge does not currently publish the live Site. Preserve the current deployment until a separate release workflow is explicitly configured and verified.

Never commit credentials, real session databases, private player data or deployment archives. `.openai/hosting.json` identifies the original Site; it is not a credential and must not be repointed casually. Keep the original Site deployment flow distinct from GitHub development until synchronization is deliberately configured.

## Working backlog

All 15 development issues are published. Start with [the issue index and suggested sequence](docs/ISSUES.md). Current priorities are server/client separation, persistent identity, reliable shared state, durable history and weekly settlement.
