# Onboarding browser E2E contract

## Purpose

The onboarding is the highest-value first-session path and the only place that promises a guaranteed five-point pentagram. `npm run test:onboarding` opens the real game in a fresh headless Chrome/Edge profile and drives browser-level mouse and keyboard input. It uses no third-party test package; the package script enables Node.js 20's built-in WebSocket client and talks to Chromium through the DevTools protocol.

## Journey and assertions

|  Card | Player action                                                        | Required evidence                                                                                |
| ----: | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
|     1 | Read the firing rule, then drag and release the meteor               | The live damage hook records a boss hit                                                          |
|     2 | Read the direct-hit result and the upcoming resonance preview        | The card is exactly `2 / 8` and cannot advance before settlement                                 |
|     3 | Read how three starlight selections determine direction and strength | No gameplay starts before the player advances to the awakening explanation                       |
|     4 | Read resonance, awakening-ready, settlement attack, and starlight    | The next browser input selects three points and launches only after this card                    |
|     5 | Read the result of the selection and awakening practice              | The state records both a selected shot and the id of an awakened starkeeper                      |
|     6 | Leave the three seeded small starlights unselected and launch        | The real figure path resolves three or more points                                               |
|     7 | Read the constellation result                                        | The resolved figure is visible before the final sequence explanation                             |
|     8 | Read the complete select → launch → resonate → awaken → figure order | The final battle cannot start until the player confirms this card                                |
| Final | Enter the starter-party battle and use real selection/Space input    | The normal win hook opens `첫 관측자의 증명`, unlocks slot 3, and grants exactly one free summon |

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
