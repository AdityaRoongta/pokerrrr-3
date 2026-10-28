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

## Follow-up: board, wagers and termination

Wagers are anchored to the nameplate toward the centre: above bottom seats,
below top seats and inward beside side seats. They do not contribute to the
seat's layout height. The local seat has the same concealed-card peek; its full
private cards remain in the personal hand below the felt.

The board origin, pot footprint and card dimensions do not depend on showdown
content or run count. Both boards form one compact stack. A shared result area beneath the stack
follows the active run; after payouts, Run 1/Run 2 selectors also change the
winning-card highlights. Results never insert space between the board rows.
The explicit keyboard/chat view retains its separate responsive layout.

Pending termination uses the existing toolbar with the turn indicator, replacing
the Rankings shortcut while pending. Rankings are available again when the game
ends, including from the completed-game panel.
It never adds an action-panel row. The completed-game view hides the personal
hand and includes rankings and Return to Lobby in the reserved panel.

The browser suite additionally compares the first board's exact bounds during
voting/showdown/two-run display, verifies centre-facing wagers and the hero peek,
compares action-button bounds with termination pending, and checks completed-game
navigation remains within the viewport.


## Revealed-card readability

Concealed cards keep their small peek. On reveal, opponent cards have separate,
non-overlapping faces with rank and suit together at the left edge, including
four- and five-card Omaha. Face-up cards keep a fixed nameplate anchor rather
than moving the player when the cards expand. Winning five-card highlights are
retained; other revealed cards use reduced dimming so their suits remain readable.
Redundant payout badges are hidden during showdown so they cannot cover card
indices; the amount and winning player remain in the common result area. The
felt oval does not clip result text at its curved edge.

Community cards use the larger normal-hand dimensions on both runs. The first
row remains anchored from betting through payouts, while the second follows
with a small fixed gap. Result space is bounded for multi-winner/side-pot content; very
short screens retain scrollable result details within the available footprint.

Browser coverage additionally includes six players at 390×740 for NLH, PLO4 and
PLO5 with two runs. It checks that every exposed rank/suit stays inside its card,
is not covered by the neighbouring card, and stays on screen. It also rejects
any overlap between opponent faces and community cards. It checks board
spacing, clearance from the local seat, run-result switching without board
movement, and that one-winner results on portrait phones are not scrolled or
masked by the oval.

Short landscape phones place the table beside the controls so the board and
revealed hands retain enough vertical space. This arrangement stays fixed
through hand phases, with both single- and double-run cases covered. Opening
the chat composer still uses the dedicated typing layout.
