# Published development issues

One private group, one active session at a time. Completed sessions remain available for weekly settlement.

P0: required before reliable live play. P1: usability, developer workflow and operations.

| Issue | Work |
| --- | --- |
| [#1](https://github.com/arundevanathan/pokerrrr-3/issues/1) | P0: Separate browser client, game server and shared protocol |
| [#2](https://github.com/arundevanathan/pokerrrr-3/issues/2) | P0: Deploy the game server with one durable table coordinator |
| [#3](https://github.com/arundevanathan/pokerrrr-3/issues/3) | P0: Replace polling with authenticated WebSocket synchronization |
| [#4](https://github.com/arundevanathan/pokerrrr-3/issues/4) | P0: Add persistent player authentication and group access |
| [#5](https://github.com/arundevanathan/pokerrrr-3/issues/5) | P0: Persist session and hand history independently of live room state |
| [#6](https://github.com/arundevanathan/pokerrrr-3/issues/6) | P0: Build a cross-session ledger and weekly settlement |
| [#7](https://github.com/arundevanathan/pokerrrr-3/issues/7) | P1: Redesign the home screen for one private group |
| [#8](https://github.com/arundevanathan/pokerrrr-3/issues/8) | P0: Move action, vote and auto-deal timers fully onto the server |
| [#9](https://github.com/arundevanathan/pokerrrr-3/issues/9) | P0: Make game and accounting commands safe under retries and concurrency |
| [#10](https://github.com/arundevanathan/pokerrrr-3/issues/10) | P1: Recover seats after disconnects and support host handover |
| [#11](https://github.com/arundevanathan/pokerrrr-3/issues/11) | P0: Add multiplayer API and multi-device acceptance tests |
| [#12](https://github.com/arundevanathan/pokerrrr-3/issues/12) | P1: Establish reproducible local setup and contributor CI |
| [#13](https://github.com/arundevanathan/pokerrrr-3/issues/13) | P1: Deploy the client independently and evaluate GitHub Pages demo |
| [#14](https://github.com/arundevanathan/pokerrrr-3/issues/14) | P1: Review access controls, privacy and release secrets |
| [#15](https://github.com/arundevanathan/pokerrrr-3/issues/15) | P1: Add operational diagnostics, backup verification and rollback |

## Suggested order

1. Verify fresh-clone development/CI (#12); define client/server contracts (#1) and identity (#4).
2. Establish authoritative persistent server (#2), WebSocket updates (#3), independent timers (#8), retry safety (#9), and reconnection/host continuity (#10).
3. Build durable history (#5), then the cross-session ledger (#6); design the group home screen (#7) against those flows.
4. Complete client hosting/PWA work (#13), access review (#14), recovery/operations (#15), and multi-device acceptance (#11).

Run tests throughout development; do not defer multiplayer verification to the end. Independent tasks may proceed alongside the listed sequence.
