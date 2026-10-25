# Dunzo Club

Private mixed poker for one group of 6–8 friends. One active session at a time;
NLH → PLO4 → PLO5, rotating every 2–4 completed hands. Defaults: 25/50 blinds and
2,500 starting chips, with player-selected starting stacks and automatic reloads.

## Current implementation

One URL serves both the React/PWA client and the authoritative Cloudflare server.
The Worker routes HTTP commands and WebSockets to one SQLite-backed `ClubTable`
Durable Object. It serializes commands, saves state and command receipts before
acknowledging, filters private player snapshots, and advances timers using alarms.
The browser runs the engine only for explicitly local practice.

Multiplayer requires a configured `CLUB_ACCESS_KEY` secret. Members enter this
shared club access code once per browser; a signed HttpOnly cookie lasts 30 days.
An independent browser-local player credential resumes a seat after refresh. This
is prototype device identity, not individual account login: clearing browser data
or switching devices does not recover the same player. Never share player tokens.

Completed sessions remain stored when another session starts. Completed hands
are archived separately from the live room's latest-100-hand view. The UI can
reopen a completed session with its room code on the same player identity.
Cross-session balance aggregation, partial external payments, account recovery,
host handover and a history browser/export for the full archive remain backlog work.
Do not treat per-session payment toggles as the planned weekly ledger.

The Cloudflare target is `dunzo-club-staging`:
https://dunzo-club-staging.arun-devanathan.workers.dev/.
The repository remains `arundevanathan/pokerrrr-3`; changing the app's name does not
rename its GitHub URL. No deployment or live-data migration is performed by local
builds. See [Cloudflare setup and release instructions](docs/CLOUDFLARE_STAGING.md).

## Local setup

Use Node >=22.13.0 on PATH and pnpm 11.25.0:

```sh
pnpm install --frozen-lockfile
cp .dev.vars.example .dev.vars
# Edit .dev.vars with a long private local-only CLUB_ACCESS_KEY.
pnpm dev:staging
```

Open the printed local URL. Enter the local club access code and your name to
create the sole table. Share its room code/invite with another browser profile or
phone. That player enters the club access code and joins with their own stack.
Both use the same app URL. Practice does not require an access code or server.
Keep site data to retain a seat; use a different browser profile for a second player.

No D1 migration is needed for this multiplayer implementation. The Durable Object
SQLite migration is declared in `wrangler.staging.jsonc`. Local Wrangler manages
a separate local database. Existing D1 migrations remain for provenance; they do
not import original Site balances into the new coordinator.

To preview the built Worker:

```sh
pnpm build:staging
pnpm preview:staging
```

Legacy `pnpm dev` / `pnpm build` framework entry points remain available and route
poker traffic through the same coordinator; multiplayer still needs the local
access secret. The original Site hosting identity is preserved in `.openai/hosting.json`.

## Checks

```sh
pnpm test
pnpm test:staging
pnpm typecheck
pnpm build
pnpm build:staging
pnpm check:staging
pnpm test:staging:smoke
```

The smoke runner creates an isolated temporary local database, starts the built
Worker, exercises HTTP/WebSocket multiplayer, restarts the server, checks an
independent alarm and retained sessions, and cleans up. It does not use deployed
storage. It needs a free loopback port 8787. To test another **disposable local**
server, explicitly set `POKER_TEST_URL` and `POKER_TEST_ACCESS_KEY`, then run
`pnpm test:api`. Both API test paths reject remote URLs. Never point tests at a
live group. Physical 6–8-device/PWA/network-loss acceptance remains required.

## Code map

| Path | Responsibility |
| --- | --- |
| `app/page.tsx` | UI, sounds, animations and local practice controls |
| `lib/client/poker-client.ts` | HTTP command retries, WebSocket snapshots and reconnects |
| `lib/client/practice.mjs` | Explicitly local engine adapter |
| `lib/protocol/poker.mjs` | Versioned, runtime-validated action contract |
| `server/worker-router.ts` | Same-origin API/socket routing and readiness |
| `server/club-table.ts` | Durable Object, serialization, access, private push, alarms |
| `server/table-service.mjs` | Transactional state, idempotency, session/hand archive |
| `server/access.mjs` | Signed club-access cookies |
| `lib/poker.mjs` | Shared tested pure poker rules, secure shuffle and private views |
| `docs/ISSUES.md`, `docs/BACKLOG.md` | Remaining work and acceptance criteria |

Use feature branches and reviewed PRs. A merge can trigger Cloudflare's configured
Git build: review that external automation before merging. Preserve existing
hosting/data until a deliberate release is approved. Never commit secrets or real
player balances. See CONTRIBUTING.md and MIGRATION.md for workflow and provenance.
