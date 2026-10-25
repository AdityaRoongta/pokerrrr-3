# Staging history reset

The owner has approved resetting both `dunzo-club-staging` and the isolated
`feat-history-and-settlement` preview. These are disposable staging environments;
production must use separately provisioned storage and never copy these balances.

The reset replaces closed session archives, their room/hand records and command
receipts with four ordinary history records. All seven existing roster accounts
participate, using their actual login IDs. Dates span the current India calendar
week. Each game balances to zero. The separate `history_examples` table is cleared,
so the simulated-history switch disappears. The sample games appear in the usual
Previous Games and Settle Up screens with no separate labels.

Player accounts, PINs, login sessions, active rooms, active hands and their command
receipts are preserved. No namespace recreation, binding change or migration is
needed. The reset code refuses any environment other than `APP_ENV=staging`.
There is no public reset endpoint and no automatic reset on deployment or restart.

## Apply to each approved staging database

1. Deploy the tested code to the intended staging Worker or branch preview.
2. Open its app, then open **Durable Objects → the matching namespace → Data
   Studio → the existing `dunzo-club` instance**. Verify the namespace name:
   - Main staging: `dunzo-club-staging_ClubTable`.
   - Feature preview: `dunzo-club-staging_feat-history-and-settlement_ClubTable`.
3. The existing object must have exactly one enabled account for each of Dunzo
   (or Arun), Ishita, Varun, Doshi, Panda, Saboo and Roongta. Keep all account IDs.
4. Insert the one-time reset request using SQL:

   ```sql
   INSERT INTO staging_history_resets(id, requested_at)
   VALUES('history-reset-2026-10-25', CAST(strftime('%s','now') AS INTEGER) * 1000)
   ON CONFLICT(id) DO NOTHING;
   ```

5. Refresh Previous Games while signed in. The authenticated history request
   processes the reset through the normal serialized Durable Object transaction.
6. Verify completion in Data Studio:

   ```sql
   SELECT id,completed_at,removed_games,seeded_games FROM staging_history_resets;
   SELECT COUNT(*) AS separate_examples FROM history_examples;
   ```

   `completed_at` must be non-null, `seeded_games` must be 4, and
   `separate_examples` must be 0. Verify four games and all seven totals in the UI.

A durable receipt commits with the new archives. Repeating the same SQL request
or restarting the object cannot reset history again or erase later games. A new
reset requires a new explicit console request ID. If roster validation fails, no
history changes commit. Never run this operation against production.

The older `scripts/create-history-examples.mjs` helper is retained for isolated
legacy tests only; do not use it to populate the ordinary staging history.
