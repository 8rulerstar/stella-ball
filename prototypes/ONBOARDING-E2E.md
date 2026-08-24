# Onboarding browser E2E contract

## Purpose

The onboarding is the highest-value first-session path and the only place that promises a guaranteed seven-point Big Dipper. `npm run test:onboarding` opens the real game in a fresh headless Chrome/Edge profile and drives browser-level mouse and keyboard input. It uses no third-party test package; the package script enables Node.js 20's built-in WebSocket client and talks to Chromium through the DevTools protocol.

## Journey and assertions

Rewritten 2026-08-24. The card count went 17 -> 12 (2026-08-23 restructure) -> **13**
(the closing goal card), and the slot-3 gate and its free summon were removed on
2026-08-23 — this section still described the eight-card journey and asserted a
reward that no longer exists. Card numbers below are the literal `n / 13` strings
the runner waits on, so they will fail loudly if `ONBOARDING_CARD_COUNT` moves.

| Card(s) | Player action                                                 | Required evidence                                                                                                     |
| ------: | ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
|       1 | Read the firing rule, then drag and release the meteor        | A starkeeper actually awakens (`awakenedHero`), and the card advances to `2 / 13`                                     |
|     2-5 | Read the direct-hit result, aiming, resonance and awakening   | No gameplay starts before the player advances through each card                                                       |
|       6 | Pick three starlight points and launch                        | The state records a node-aimed shot (`aimed`); card lands on `6 / 13`                                                 |
|     7-9 | Read the aimed-shot result and the constellation rules        | Advancing is the only way forward                                                                                     |
|      10 | Leave the seven **locked** guide stars alone and launch       | Exactly seven guide stars are seeded, and the real figure path resolves `bigdipper`                                   |
|   11-12 | Read the Big Dipper result and its meteor-refund ability      | Explained before the final sequence                                                                                   |
|      13 | Read the **goal** card — this one is not a drill              | The final battle cannot start until the player confirms `13 / 13`                                                     |
|   Final | Enter the starter-party battle and use real selection/`Space` | The win hook opens `첫 관측을 마쳤어요`, the clear flag is stored, party slots are `3`, and the CTA reads `다음 관측` |

Three things the table above is load-bearing about:

- **Card 13 is the goal card, not a lesson.** It states the win condition once
  ("거상을 눕히러 간다") and hands the table over. Its button text was renamed from
  `관측 시작` precisely because that string also matches the title-screen CTA and
  the text-matching runner picked the wrong one.
- **The seven guide stars in card 10 are locked**, not merely "left unselected"
  (`isLockedAimNode`). The lesson used to ask the player not to click them.
- **There is no slot-3 unlock and no free summon.** Party slots are `3` from the
  first frame; the runner asserts that, not a reward.

The final battle starts with its production value of 120 HP and the expected `gaon`, `biyeon`, `ria` party. After asserting those values, the runner changes the isolated boss fixture to 1 HP so CI verifies progression and reward wiring without spending time measuring combat balance. The next real browser input must still reach the normal damage, victory, and onboarding completion paths.

## Coverage layers

- `npm run smoke`: fast VM contracts for modules, hooks, physics branches, and deferred constellation outcomes.
- `npm run test:onboarding`: one slow, deterministic browser journey for the business-critical first session.
- Manual/visual review: composition, animation quality, audio mix, responsive layout, and subjective timing.

## Intentional gaps

- The E2E does not approve pixels or compare screenshots.
- It checks that Space, awakening, and the guided constellation resolve, not the quality or loudness of sound.
- The 1-HP fixture means this test must not be used as final-battle balance evidence.
- Failure/retry copy remains covered by state-level checks when that branch changes; this golden path deliberately tests success without retrying.

## Running

```sh
npm run test:onboarding
```

The runner discovers common Chrome/Edge paths on Windows, macOS, and Linux. Set `STELLA_BROWSER_PATH` to an executable when the browser is elsewhere. It starts a temporary local server and fresh browser profile, then removes both after the run.
