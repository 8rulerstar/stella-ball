# Onboarding browser E2E contract

## Purpose

The onboarding is the highest-value first-session path and the only place that promises a guaranteed five-point pentagram. `npm run test:onboarding` opens the real game in a fresh headless Chrome/Edge profile and drives browser-level mouse and keyboard input. It uses no third-party test package; the package script enables Node.js 20's built-in WebSocket client and talks to Chromium through the DevTools protocol.

## Journey and assertions

|  Card | Player action                                                     | Required evidence                                                                                |
| ----: | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
|     1 | Click the tutorial CTA, reveal the card, drag the meteor downward | The live damage hook records a boss hit                                                          |
|     2 | Read the result and continue                                      | The card is exactly `2 / 6` and cannot advance before settlement                                 |
|     3 | Drag, then click the moving meteor twice                          | Only the first click emits `afterMeteorSteer`; combined steering stays one use per shot          |
|     4 | Read the steering result and continue                             | The live onboarding state records the consumed steer                                             |
|     5 | Drag on Luna's locked route, then press physical `Space`          | Aim assist is active, the genuine contact is Mirinae, and the single guide charge is consumed    |
|     6 | Wait through correction, reveal, and cast                         | The resolved figure is `pentagram` with exactly five points and the success copy is visible      |
| Final | Enter the starter-party battle and use real drag/Space input      | The normal win hook opens `첫 관측자의 증명`, unlocks slot 3, and grants exactly one free summon |

The final battle starts with its production value of 120 HP and the expected `gaon`, `biyeon`, `ria` party. After asserting those values, the runner changes the isolated boss fixture to 1 HP so CI verifies progression and reward wiring without spending time measuring combat balance. The next real browser input must still reach the normal damage, victory, and onboarding completion paths.

## Coverage layers

- `npm run smoke`: fast VM contracts for modules, hooks, physics branches, and deferred constellation outcomes.
- `npm run test:onboarding`: one slow, deterministic browser journey for the business-critical first session.
- Manual/visual review: composition, animation quality, audio mix, responsive layout, and subjective timing.

## Intentional gaps

- The E2E does not approve pixels or compare screenshots.
- It checks that Space and the pentagram resolve, not the quality or loudness of sound.
- The 1-HP fixture means this test must not be used as final-battle balance evidence.
- Failure/retry copy remains covered by state-level checks when that branch changes; this golden path deliberately tests success without retrying.

## Running

```sh
npm run test:onboarding
```

The runner discovers common Chrome/Edge paths on Windows, macOS, and Linux. Set `STELLA_BROWSER_PATH` to an executable when the browser is elsewhere. It starts a temporary local server and fresh browser profile, then removes both after the run.
