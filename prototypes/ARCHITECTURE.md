# Stella Ball runtime map

The browser build deliberately uses ordered classic scripts instead of a bundler. This keeps the game runnable by opening `index.html` on Windows while still giving each maintenance area a clear home.

## Entry points

- `../index.html`: repository and GitHub Pages entry point; redirects to the game.
- `prism-breakers.html`: stable DOM, canvas, HUD, and ordered runtime imports.
- `prism-breakers-foundation.css`: shared layout, typography, and baseline components.
- `prism-breakers-interface.css`: roster, menu, and UI presentation.
- `prism-breakers-combat.css`: combat dashboard and table layout.
- `prism-breakers-story.css`: title, story, and observatory presentation.
- `prism-breakers-polish.css`: campaign map, onboarding, and final visual refinements.
- `stella-ball-theme.css`: Dawn Observatory palette pass. It carries the theme colors and must stay after every `prism-breakers-*.css` file.
- `stella-ball-dawn.css`: pixel button kit and background decor styling. It must remain the final stylesheet; it overrides the theme's `!important` button surfaces, so nothing may load after it.
- `../PLAY_WINDOWS.cmd`: Windows launcher for the repository entry point.

## JavaScript ownership

The files under `js/` load in this exact order and share the browser global scope:

1. `game-platform.js` — dependency-free safe local persistence and active scene lifecycle.
2. `game-runtime.js` — the classic-script-compatible module registry and validated lifecycle hooks. It has no game-state ownership.
3. `game-data.js` — canvas/DOM bindings, balance constants, heroes, stages, asset paths, upgrades, shared mutable state, and small shared helpers.
4. `game-ui.js` — reusable DOM presentation helpers: scene classes and pixel portrait setup.
5. `game-session.js` — base battle lifecycle, the squad screen (`showRoster()` owns party choice and placement together), initial screen flow, and the shared title/home presentation.
6. `game-core-physics.js` — the base solver, collisions, moving entities, and shot settlement.
7. `game-core-render.js` — base combat drawing, HUD updates, canvas effects, and shared rendering helpers.
8. `game-meta-state.js` — safe settings/progress persistence, reward and economy rules, audio, achievements, and shared meta-state helpers.
9. `game-meta.js` — settings, achievements, profile, shop, summon, stage-select, replay-tutorial, attendance, and library screens. It reacts to battle and roster lifecycle hooks but does not own their state machines.
10. `game-combat.js` — billiards input, constellation multiplier, hero abilities, combat effects, clone meteors, and unit awakening presentation.
11. `game-combat-physics.js` — combat collision rules, stage gimmicks, shot settlement, solver, prediction, and aim guides. It registers the small frozen `combat` API for parry-contact resolution after that implementation is available.
12. `game-figure-recognition.js` — one-shot Space parry state, successful-contact traces, guide stars, skeleton templates, normalization, matching, and 3–7 point classification.
13. `game-figure.js` — constellation ability dispatch, settlement/final-shot deferral, trace correction, reveal presentation, and the frozen `figure` API. It loads after recognition and before feedback. Sagitta fires along its `axis`; the other outcomes are kept in `FIGURE_ABILITIES`. All seven silhouette textures live in `../assets/library/constellations/`, and their coordinate contract is in `../ASSET_PLAN.md`.
14. `game-feedback.js` — impact pauses, particles, layered sample/procedural SFX, combo presentation, ability/finisher/victory effects, and the final animation loop.
15. `game-onboarding.js` — story intro, first-session storage, the guided 1-1 lesson, third-party-slot unlock, observatory presentation, and onboarding extensions. It publishes a frozen `onboarding` API for session status and tutorial entry.
16. `game-arena-carve.js` — final procedural Observatory Ground arena pass. It keeps the four most recently used baked floors in an LRU cache and installs a stage-arena renderer through the `render` module; it must remain after onboarding and before bootstrap. It must not change physics, collisions, balance, or unit judgement colours.
17. `game-bootstrap.js` — creates the initial idle state, opens the title screen, and starts `requestAnimationFrame`.

Four presentation-only scripts load after that chain and stay outside `js/` because they never touch gameplay state:

18. `boss-art.js` — exposes `window.StellaBossArt`; draws the stage 8-1 walking-planet boss procedurally at any size and phase, with no raster asset. It is a pure drawing library with no project dependencies, so it must come first in this tier: both the arena renderer and `stella-ball-dawn.js` consume it.
19. `stella-ball-pixel-ui.js` — exposes `window.StellaPixelUI`; renders pixel button silhouettes and decor sprites to canvas data URLs.
20. `stella-ball-dawn.js` — assigns `data-pbtn` to game-drawn buttons through a `MutationObserver` and builds the `#dawn-sky` background decor layer. Its margin props carry `data-dawn-prop` names so the intro can startle them without reaching into its locals.
21. `outer-observer.js` — the five-beat title intro. It attaches its layer as a child of `#dawn-sky`, so the existing `#dawn-sky *` reduced-motion rule covers it, and it watches for `.title-sequence` instead of hooking the runtime. It must load after `stella-ball-dawn.js` because that script creates `#dawn-sky`.
22. `sky-ambience.js` — the margin sky's three parallax layers, autonomous idle cycles, and the event background reactions from `SKY_AMBIENCE_REQUEST_2026_08_14.md`. A `#dawn-sky` child like the intro, loaded between `stella-ball-dawn.js` and `outer-observer.js` so the intro draws above it. It does not hook the runtime yet: reactions are exposed on `window.SkyAmbience` (`figure` / `world` / `boss` / `blaze` / `setProgress`) and wiring them to hooks is a separate approval, documented in the design session's README.

## Important maintenance rule

`game-runtime.js` provides the only cross-file extension contracts:

- Use `StellaRuntime.modules.register(name, api)` for a small service API that another owner calls directly. Registered APIs are copied and frozen; duplicate names fail immediately.
- Use `registerRuntimeHook(name, callback, { priority })` for reactions to lifecycle events. Hook names are validated, higher priorities run first, and equal priorities retain registration order.
- Use `runRuntimeHooks` for broadcasts, `queryRuntimeHook` for the first defined answer, and `runtimeHookHandled` when a `true` result consumes the action.
- Do not export mutable state or reach into another owner's private state. Add the smallest method or event that describes the intent instead.

Cross-file behavior must not replace an existing global function. Every runtime function now has one definition, and `npm run smoke` rejects any duplicate name. `game-arena-carve.js` installs its cached floor through `render.installStageArena()` instead of replacing `drawStageArena`. The runtime contract is recorded in [ADR-001](./ADR-001-RUNTIME-MODULES.md), and the stable sub-owner split in [ADR-002](./ADR-002-STABLE-SUBOWNERS.md).

When adding code:

- Change stats, roster entries, stages, or asset paths in `game-data.js`.
- Change base menus and battle flow in `game-session.js`; change persisted meta/economy rules in `game-meta-state.js`; change their screens in `game-meta.js`.
- Change base collision behavior in `game-core-physics.js` and base drawing/HUD behavior in `game-core-render.js`.
- Change combat input, multiplier, abilities, clone meteors, or awakening in `game-combat.js`; change collision rules, stage gimmicks, shot settlement, prediction, or aim guides in `game-combat-physics.js`.
- Change parry trace capture, skeleton coordinates, or recognition math in `game-figure-recognition.js`; change constellation outcomes and presentation in `game-figure.js`. Nothing else should reach into `figureFx`. Keep templates, silhouette files, `ASSET_PLAN.md`, and `assets/ASSET_MANIFEST.json` in sync.
- Change screen shake, particles, SFX, combo, or victory presentation in `game-feedback.js`; change only the procedural floor, wall presentation, and stage engraving in `game-arena-carve.js`.
- Change Luna dialogue, first-run progression, or unlock behavior in `game-onboarding.js`.
- Keep `game-bootstrap.js` minimal; it should only start the runtime.

`renderTitlePresentation()` in `game-session.js` is the single renderer for the main constellation screen. `game-onboarding.js` may override the CTA behavior for first-run/replay progression, but should not duplicate the title markup. Stage definitions live in `game-data.js`; `setupBattle()` maps the selected stage's `bumpers` into runtime objects. `1-2` intentionally contains only the resonance-bumper gimmick.

`showRoster()` is the single squad screen: `deployed[i]` is the hero standing on board slot `i`, `s.slots[i]` is that slot on the real table, and `s.preview[i]` is the same slot on the minimap. `selected` is kept as a mirror of `deployed` because the hub and the battle summary read it. `showDeployment()` remains only as an alias so the draft screen's back button still resolves.

`setScene()` is the only way to change a major screen. It updates the body class and `game-platform.js` scene lifecycle together. The animation loop therefore runs canvas simulation and drawing only while the game scene is active; title, map, roster and browser-hidden states keep only the minimal `requestAnimationFrame` wake-up. A paused game scene also freezes feedback hooks because they own delayed assists and constellation casts, not just decorative particles.

When the final meteor settles with a pending constellation, `game-combat-physics.js` offers its continuation through the `beforeShotResolution` hook instead of showing failure immediately. `game-figure.js` consumes that action and runs the continuation exactly once after the cast: a kill remains a victory, Big Dipper's refund starts the next shot, and only an unresolved zero-shot state fails. Keep the three branches covered by the runtime smoke test.

## Verification

With Node.js 20 or newer, run `npm run check` from the repository root. The verifier reads every ordered runtime file as one logical bundle, including the meta, combat, and figure sub-owner pairs, checks required gameplay markers and asset references, runs portability checks, and writes `artifacts/verification.json`. The smoke test validates exact script order, zero duplicate global functions, module immutability, hook ordering, contract rejection, and all three deferred-figure outcomes. The final `test:onboarding` pass opens a fresh headless Chromium profile and drives the real six-card input journey through the pentagram and reward screen. Its scope and fixture are recorded in [ONBOARDING-E2E](./ONBOARDING-E2E.md). `npm run serve` starts the local server at `http://127.0.0.1:4173/`.
