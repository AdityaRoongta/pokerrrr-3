# Changelog

## v2.1.1 — 28 October 2026

Priority connection-recovery fix.

- Automatically reconcile pending actions after connection loss or reload; stale actions cannot block later turns or execute on a new hand.
- Reuse durable command receipts across HTTP and authenticated WebSocket delivery, preventing duplicate bets when replies are lost.
- Fall back to HTTP snapshots when the socket is unavailable; reconnect without an HTTP session preflight.
- Verify sessions before signing players out on socket policy closes; retry identity restoration after an offline reload.
- Show Disconnected on seats using heartbeat/poll leases while retaining chips, seats and future-hand eligibility. Existing timers continue normal check/fold behaviour.
- Added nine recovery tests, actual-Worker presence/receipt coverage and five browser fault-injection scenarios.

Full release notes: [v2.1.1](docs/releases/v2.1.1.md).

## v2.1.0 — 27 October 2026

Production update from baseline `309fd214b02015a111b1026a89cadecf0b1d6135`.

- Simplified six-action table menu with separate Stand Up and Terminate confirmations.
- One saved mute control for game and reaction audio.
- Bottom-right compose button, speech bubbles and expandable game-specific chat history.
- Dedicated typing view keeps the full board, pot, personal cards and action buttons visible above the keyboard.
- Raise… exits typing and opens amount selection without placing a bet; Send closes the keyboard immediately.
- Keyboard resizing/panning fixes, retained drafts and retry feedback; removed the action-button group glow.
- Moving centre-to-player turn beam and a clearer acting-seat outline/countdown.
- Opponent card backs peek above nameplates until revealed; local bet badge sits above the seat.
- Winner and hand details below each board, exact-five card highlights and combined awards when one player wins all pots on a board.
- Uncalled contributions return before runout voting/showdown and are excluded from winnings. Returns persist in hand history/accounting and cannot double-credit on retries or restart.
- Added browser regression coverage across four screen sizes, all variants, keyboard panning, touch actions and two-board showdowns.

Full release notes: [v2.1.0](docs/releases/v2.1.0.md).
