# Table reactions

Reactions are enabled on staging and local builds only. Production rejects the
endpoint and hides the picker. Tap another seated player's name, then Chappal.
Tapping your own name retains the reload action. Practice uses a local event.

Each send targets exactly one occupied seat. The server derives the sender and
both names from authenticated table membership. It broadcasts one ephemeral event
to authenticated participants, including the sender. No poker state, hand version,
alarm or settlement record changes. HTTP acknowledgements and WebSocket delivery
share an event ID, so the sender plays the animation once.

A sender has a three-second cooldown, and only one animation can occupy a table
at a time. Fixed-size durable receipts preserve these rules across hibernation.
There is no event history or replay on reconnect. Hidden tabs discard reactions.
The normal sound toggle also controls the whoosh and slap. Reduced-motion mode
shows the slipper at the target without the flight animation.

## Adding a reaction

1. Add its id, label, duration and impact time to `lib/reactions.mjs`.
2. Add its vector art and animation component to the renderer registry in
   `app/table-reactions.tsx`, with its CSS in `app/table-reactions.css`.
3. Add its procedural sound to `lib/poker-audio.ts` and the renderer's sound id.

Targeting, authenticated delivery, deduplication, cooldown and cleanup are shared.
The reaction service is independent of the poker engine and is not a poker command.

Tests cover membership, self-targeting, strict payloads, retry deduplication, durable
cooldowns, unchanged poker state, expiry and production gating. The local Worker
smoke also checks two-client delivery and no replay for a reconnecting client.
