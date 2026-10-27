# Stable table and pre-turn actions (staging)

The normal table reserves the complete toolbar, personal-card, slider and action
button footprint. Betting, runout voting, runout animation and showdown replace
content without resizing the felt or bottom panel. The voting prompt is an
overlay. Viewport/orientation changes and deliberately opening the chat composer
still use their responsive layouts. Extra status/error content scrolls inside
the reserved panel rather than resizing the table.

Before the local player's turn, action buttons contain checkboxes. The whole
button is the checkbox target and supports keyboard activation. Only one choice
can be selected; selecting it again clears it. Current-turn buttons act directly
and contain no checkbox. Raise cannot be queued.

- **Check/Fold:** check for free, otherwise fold. Other players' bets/raises do not cancel it.
- **Check:** check only while no call is required. A new bet cancels it.
- **Call [amount]:** call that specific amount. Any increased betting level cancels it, even when the player's short stack caps the effective call at the same amount. Other calls and unrelated snapshot/version updates do not cancel it.

Selections are local and never authorize a future hand/street. They clear on
hand/street/table/identity changes, folding, sitting out, leaving, disconnection,
execution or a direct action. A selected action is consumed before sending, so
renders and duplicate updates cannot execute it twice. The existing server
version/hand guards reject a raise racing an outgoing pre-call; durable command
receipts retain exact-once transport recovery.

## Verification

`pnpm test` includes pre-call amount/raise cancellation, short-stack caps,
Check/Fold and Check rules, lifecycle invalidation and a real TableService race:
a raise accepted before the queued call arrives must reject the old call without
charging chips.

After `pnpm build:staging`, run the optional browser suite with Playwright:

```sh
POKER_BROWSER_EXECUTABLE=/path/to/chromium node scripts/table-ui-smoke.cjs
```

At 320×568, 390×844, 430×932 and 844×390 it compares exact felt, table-stage,
action-panel and hero-nameplate bounds through betting, voting and showdown,
including two boards. It tests checkbox toggling, call preservation/cancellation,
Check/Fold surviving raises, pre-check cancellation, clearing on disconnect and
exactly one automatic call when the turn arrives. It retains the prior keyboard,
chat, winner, card privacy/presentation and recovery checks.

On staging, use three players to select Call before your turn. Have the intervening
player call: the checkbox should remain selected. Repeat with a raise: it should
clear and display the new amount unselected. Check/Fold should remain selected
through that raise. Select Check when free: any new bet should clear it. Trigger
an all-in/run-it-twice vote and watch the felt and bottom panel: neither should
resize when the vote opens, closes or enters showdown.

This iteration is staged for review; production is unchanged.
