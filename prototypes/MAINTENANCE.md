# Stella Ball maintenance guide

## Safe edit route

The browser build is intentionally a set of ordered classic scripts, not a bundled application. This keeps the GitHub Pages build and `PLAY_WINDOWS.cmd` launch path simple. Treat the order in `prism-breakers.html` as a public dependency contract; `npm run smoke` enforces it.

Start a change in the smallest owner module listed in [ARCHITECTURE.md](./ARCHITECTURE.md). Shared browser concerns have dedicated boundaries:

- `js/game-platform.js` owns resilient local persistence (`appStorage`) and the active scene lifecycle.
- `js/game-data.js` owns gameplay data, mutable combat state, texture caching, and extension registration.
- `js/game-ui.js` owns reusable DOM presentation (`setScene`, `setPortrait`).

Use `setScene()` for every major-screen transition. It updates both the CSS body class and the runtime lifecycle. The animation loop simulates and draws only while `game` is active, and does nothing expensive when the tab is hidden.

## Extending combat safely

New render or feedback behavior must register with `registerRuntimeHook(name, callback)`. It returns an optional cleanup function for temporary behavior. Available hook names are `afterArenaDraw`, `afterDraw`, `afterFeedbackUpdate`, and `afterSpecialDraw`.

Do not add new assignments such as `draw = function () { ... }` or `updateFeedback = function () { ... }`. A few historical wrappers remain in the combat, feedback, meta, and onboarding scripts; leave their order intact until a dedicated migration replaces them with named hooks.

## Adding one stage gimmick

Define a stage's `gimmicks` in `js/game-data.js`; `setupStageGimmicks()` creates the runtime objects when a battle starts. Do not put per-stage coordinates in the collision loop.

```js
gimmicks: {
  walls: [{ x: 156, y: 398, w: 104, h: 18 }],
  boostPads: [{ x: 360, y: 504, w: 156, h: 38, boost: 300 }],
  adds: [{ x: 360, y: 306, r: 23, hp: 56 }],
}
```

- A `wall` is an axis-aligned rebound surface. The meteor, clone meteor, and rolling starkeepers all collide with it.
- A `boostPad` applies one momentum gain per object pass. Its `boost` and optional `maxSpeed` are balance values, not visual settings.
- An `add` is a physical void remnant with HP. Meteor, clone meteor, starkeepers, and existing area attacks can damage it.

The infinite training table is the current reference configuration for all three. Keep campaign stages to a single new gimmick until their player purpose and bot validation are decided.

## Performance guardrails

- Reuse `loadTexture()` and `primeCombatTextures()`; never create `Image` objects inside a frame function.
- Sample SFX voices are lazy: create them through `sampleSfxPool()` only when the cue is first played. Do not preallocate every audio voice on the title screen.
- Cache static canvas layers. `game-core-render.js` already caches stage floor and arena layers.
- Do DOM work on state changes, not inside the frame loop. `sync()` caches each HUD field; extend that cache instead of rebuilding the HUD for a collision-only update.
- Keep transient effect arrays bounded and compact them in place with `advanceTimed()` or `tickTimed()` rather than chaining `filter()` calls every frame.
- Keep UI-only scenes out of the combat loop by going through `setScene()`.

## Before handoff

Run these from the repository root:

```sh
npm run smoke
npm run verify
npx --yes prettier@3.5.3 --check prototypes/js/game-platform.js prototypes/js/game-ui.js prototypes/js/game-data.js prototypes/js/game-session.js prototypes/js/game-meta.js prototypes/js/game-feedback.js scripts/smoke-runtime.mjs scripts/verify-evidence.mjs
git diff --check
```

`npm run format:check` covers the whole repository. If it reports existing files outside the current change, do not mechanically reformat them in a feature/refactor commit; report that baseline separately.
