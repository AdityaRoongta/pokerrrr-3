# Simulated history for staging

The staging Worker creates a separate SQLite `history_examples` table. Real
completed sessions remain in Durable Object storage under `session:` keys. The
normal history and settlement endpoints read those real archives only.

After signing in, **Show Simulated History** appears only if example rows exist.
It switches both the table and Settle Up to the examples exclusively, with a
visible warning. The two data sets are never combined. No simulated buy-ins,
player stacks, hands, payments or active-game pointers are written to real rooms.
Production refuses `demo=1` and does not create or query the example table.

## Local preview

1. Build/start the staging preview, open it once, then **stop** the preview.
2. Find its existing object database under the disposable persist directory:
   `v3/do/*ClubTable/<64-character-object-id>.sqlite`.
3. Seed the stopped local database:

   ```sh
   node scripts/create-history-examples.mjs --database /absolute/path/to/.wrangler/state/v3/do/dunzo-club-staging-ClubTable/OBJECT.sqlite
   ```

4. Restart the preview, sign in and select Show Simulated History.

The script accepts only local Wrangler database paths under `.wrangler` or a
system temporary directory. Never edit a running local SQLite file. It adds eight
weekly synthetic games for the named group with stable **synthetic** IDs, unequal
results, missing participants and break-even results. Dates are relative to the
seed time, so recent examples appear in the default last-30-day range.

## Cloudflare staging preview

Open the **feature branch preview** once to initialize its schema. In Cloudflare
Durable Objects, choose that branch's `ClubTable` namespace, then the existing
`dunzo-club` instance → Data Studio. Verify the preview namespace before writing.
Do not select the main namespace or change real session archives.

Generate SQL locally and run it in that preview's SQL editor:

```sh
node scripts/create-history-examples.mjs
```

The generated INSERTs touch only `history_examples`. There is no public endpoint
for seeding or deleting data. Player login provisioning is separate; the same
static roster may be provisioned in the isolated preview using `docs/PLAYERS.md`.
Synthetic history identities are not login credentials and cannot claim seats.

## Cleanup before release

For the stopped local database, repeat the script with `--clear --database PATH`.
For the Cloudflare preview, generate the cleanup SQL:

```sh
node scripts/create-history-examples.mjs --clear
```

It deletes only `demo-` rows in `history_examples`. Verify
`SELECT COUNT(*) FROM history_examples;` returns zero afterward. The simulated
history checkbox then disappears on refresh. Keep APP_ENV set to `production` for
an eventual production target; the current staging target remains unchanged.
