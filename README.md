# Dunzo Club

Private mixed poker for one group of 6–8 friends. One active session at a time;
Choose NLH, PLO4 and/or PLO5, rotating through the selected games every 2–4 completed hands. Set an even big blind; the server calculates the small blind as half. Defaults: 25/50 blinds and
2,500 starting chips, with player-selected starting stacks and automatic reloads.

## Current implementation

One URL serves both the React/PWA client and the authoritative Cloudflare server.
The Worker routes HTTP commands and WebSockets to one SQLite-backed `ClubTable`
Durable Object. It serializes commands, saves state and command receipts before
acknowledging, filters private player snapshots, and advances timers using alarms.
The browser runs the engine only for explicitly local practice.

Players select their name from a fixed roster and enter their own **4-digit PIN**.
The server keeps a 30-day HttpOnly login session and a stable database player ID,
so signing in on a different phone recovers the same seat. Players can change their
PIN in the account menu; this signs out their other devices. No club access code,
room-code entry, registration, or public game directory is needed.

The owner manages the static roster directly in the existing SQLite database.
See [player administration](docs/PLAYERS.md) for safe INSERT/reset instructions.
No new database, login provider or shared access secret is required.

Completed sessions remain stored when another session starts. Completed hands
are archived separately from the live room's latest-100-hand view. The lobby shows per-game win/loss history. Date-range settlement sums completed
games and suggests transfers, preferring Dunzo/Ishita offsets first. Settlement
is a calculation only; it does not mark games or transfers paid.

The Cloudflare target is `dunzo-club-staging`:
https://dunzo-club-staging.arun-devanathan.workers.dev/.
The repository remains `arundevanathan/pokerrrr-3`; changing the app's name does not
rename its GitHub URL. No deployment or live-data migration is performed by local
builds. See [Cloudflare setup and release instructions](docs/CLOUDFLARE_STAGING.md).

## Local setup

Use Node >=22.13.0 on PATH and pnpm 11.25.0:

```sh
pnpm install --frozen-lockfile
pnpm dev:staging
```

Open the printed local URL. Provision your static players using
[the database instructions](docs/PLAYERS.md), select your name and sign in.
Any logged-in player can start the sole game when none is active. Every other
logged-in player sees it immediately and can join with their own starting stack.
There is no access code or game code to share. Practice runs locally without login.
The automatic smoke runner provisions disposable local test accounts itself.

No D1 migration is needed for this multiplayer implementation. The Durable Object
SQLite migration is declared in `wrangler.staging.jsonc`. Local Wrangler manages
a separate local database. Existing D1 migrations remain for provenance; they do
not import original Site balances into the new coordinator.

To preview the built Worker:

```sh
pnpm build:staging
pnpm preview:staging
```

The `pnpm dev` / `pnpm build` framework entry points route
poker traffic through the same coordinator; login uses the same static player
records. The original Site hosting identity remains in `.openai/hosting.json`.

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
server, explicitly set `POKER_TEST_URL`, then run
`pnpm test:api`. Both API test paths reject remote URLs. Never point tests at a
live group. For manual verification, use separate browser profiles or phones to check
PWA installation, background/resume and recovery after network loss.

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
| `server/player-auth.mjs` | Fixed roster, hashed PINs and revocable player sessions |
| `lib/poker.mjs` | Shared tested pure poker rules, secure shuffle and private views |
| `docs/ARCHITECTURE.md` | Runtime flow, storage and game invariants |

Use feature branches and reviewed PRs. A merge can trigger Cloudflare's configured
Git build: review that external automation before merging. Preserve existing
hosting/data until a deliberate release is approved. Never commit secrets or real
player balances. See CONTRIBUTING.md and MIGRATION.md for workflow and provenance.

## Joining and game controls

Start Game opens an empty table; it does not buy chips or assign the creator a
seat. When a game is active, Join Now opens its public table view. Select an
empty seat and confirm Load Chips to claim that seat and record the buy-in in one
transaction. Another player's simultaneous claim can win; a rejected claim adds
no chips. New seats join from the next hand if a hand is already running.

Sit Out retains the seat and stack; Sit In returns for a future deal. Sit Out
waits until the current hand is paid out by the engine and can be canceled while
pending. It is available from the three-dot menu, alongside Return to Lobby.
Returning to the lobby is navigation: it retains the seat, chips and current-hand
obligations. Use Sit Out to skip future hands. Get Up is no longer a public action;
previously queued departures still recover after upgrading.

Any signed-in player can Terminate Game, including a player viewing the table
before taking a seat. A running hand and any runout vote finish normally; the
server completes the payout presentation, cashes out stacks, archives the session
and prevents the next deal. Between hands the game terminates immediately unless
payout presentation is still in progress. Pending actions and termination survive
server restarts. Signed-in viewers receive the same filtered public table and
history, never other players' hidden cards or the deck. Protocol v4 clients are
required for this flow; refresh older open clients after release.

## Game history and settlement

Previous Games shows your net chips for each completed session. Open a game to see
everyone’s results. “Did not play” means you were absent; zero means break-even. History pages
contain 20 games; Load More reads the next page. Settle Up selects inclusive India
calendar dates, defaults to Monday through today, and shows weekdays. Totals appear
before suggested payments. Share opens the device share sheet with a PNG or text;
download and copy are available as fallbacks. It calculates over **all** matching completed games, including
pages that have not been loaded. Active games are excluded. Balances aggregate by
stable player ID, and the server verifies each game balances before suggesting
payments. Dunzo is Arun; if Dunzo and Ishita have opposing net balances, offset
them first, then match the remaining debtors and creditors. Individual results are
not merged or changed. One chip equals one rupee; suggested payments display rupees (for example, Rs.300).

See [staging history reset](docs/HISTORY_TEST_DATA.md) for the console-triggered
one-time reset and four sample games using the current roster.
