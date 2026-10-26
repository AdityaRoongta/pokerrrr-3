# Table reactions

Staging/local only; production hides the picker and rejects `/api/reactions`.
Tap another seated player's avatar/name and choose the slipper icon. Your own
name keeps its reload action. Folded players and standing observers retain access.

`SocialService` persists each reaction as a small chat activity entry and queues
its effect separately. Each effect has one sender, one stable target identity,
and one animation. The coordinator broadcasts effects to authenticated viewers;
clients discard duplicates, expired events and effects from other games.
Reconnect restores activity history but never replays animations.

A durable three-second sender cooldown and two concurrent table slots limit
noise. All-in voting, runouts and payout presentation defer effects. Queued
effects expire five seconds after sending, and effects targeting departed or
replaced players are skipped. Queue and animation deadlines share the coordinator
alarm without changing poker state or betting versions.

Reaction sounds have a separate saved mute control in Table Menu. They use normal
browser audio gesture unlocking, with no vibration. Reduced-motion mode shows the
slipper at the target without the flight. The animation has no visible label or
caption; accessible controls describe the action.

## Adding a reaction

1. Add its id, accessible label, duration and impact time to `lib/reactions.mjs`.
2. Add vector art and animation to the renderer registry in
   `app/table-reactions.tsx`, with styles in `app/table-reactions.css`.
3. Add procedural audio to `lib/poker-audio.ts` and the renderer's sound id.

Transport, identity validation, durable history, cooldowns, queuing, freshness,
reduced motion and cleanup are shared. See `PHASE_2.md` for the complete scope.
