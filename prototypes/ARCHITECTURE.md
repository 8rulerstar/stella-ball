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
2. `game-data.js` — canvas/DOM bindings, balance constants, heroes, stages, asset paths, upgrades, shared mutable state, and small shared helpers.
3. `game-ui.js` — reusable DOM presentation helpers: scene classes and pixel portrait setup.
4. `game-session.js` — base battle lifecycle, the squad screen (`showRoster()` owns party choice and placement together), initial screen flow, and the shared title/home presentation.
5. `game-core-physics.js` — the base solver, collisions, moving entities, and shot settlement.
6. `game-core-render.js` — base combat drawing, HUD updates, canvas effects, and shared rendering helpers.
7. `game-meta.js` — settings, achievements, stage select, replay tutorial, and meta-screen enhancements.
8. `game-combat.js` — billiards controls and prediction, constellation multiplier, hero abilities, and combat-specific extensions.
9. `game-figure.js` — all-combat parry constellation figures: it owns one-shot Space parry state, records up to seven fixed starlight nodes from successful meteor-to-starkeeper contacts, resolves the 3–7 nodes into the nearest skeleton when the shot settles, and registers preview/trace/reveal hooks. It wraps `settleParty` for that one-shot resolution, so no table runs the former regular settlement attack. The five current silhouette textures live in `../assets/library/constellations/`; 6·7점 뼈대는 동작하지만 실루엣은 아직 없다. Their coordinate contract is in `../ASSET_PLAN.md`.
10. `game-feedback.js` — impact pauses, particles, layered sample/procedural SFX, combo presentation, ability/finisher/victory effects, and the final animation loop.
11. `game-onboarding.js` — story intro, first-session storage, the guided 1-1 lesson, third-party-slot unlock, observatory presentation, and onboarding extensions.
12. `game-arena-carve.js` — final procedural Observatory Ground arena pass. It caches a floor per stage and wraps only `drawStageArena`; it must remain after onboarding and before bootstrap. It must not change physics, collisions, balance, or unit judgement colours.
13. `game-bootstrap.js` — creates the initial idle state, opens the title screen, and starts `requestAnimationFrame`.

Two presentation-only scripts load after that chain and stay outside `js/` because they never touch gameplay state:

14. `stella-ball-pixel-ui.js` — exposes `window.StellaPixelUI`; renders pixel button silhouettes and decor sprites to canvas data URLs.
15. `stella-ball-dawn.js` — assigns `data-pbtn` to game-drawn buttons through a `MutationObserver` and builds the `#dawn-sky` background decor layer.

## Important maintenance rule

Render and feedback extensions use the explicit `runtimeHooks` registry in `game-data.js`. Register work with `registerRuntimeHook()` rather than replacing `draw`, `drawArena`, `drawSpecial`, or `updateFeedback`. `game-arena-carve.js` is the documented narrow exception: it replaces only `drawStageArena`, captures `baseDrawStageArena`, and is limited to the cached floor. A few older gameplay and menu extensions still use function wrapping; preserve their order until they are migrated to a similarly explicit event. When you do wrap, capture the predecessor first (`const baseX = x;`) and call it — `npm run smoke` fails on a definition a later file overrides without capturing, because nobody can reach it afterwards.

When adding code:

- Change stats, roster entries, stages, or asset paths in `game-data.js`.
- Change base menus and battle flow in `game-session.js`; change settings, achievements, stage selection, or replay tutorial in `game-meta.js`.
- Change base collision behavior in `game-core-physics.js` and base drawing/HUD behavior in `game-core-render.js`.
- Change collision rules, aiming, abilities, or damage in `game-combat.js`.
- Change all-combat constellation figures in `game-figure.js`; nothing else should reach into its `figureFx` state. Keep its skeleton coordinates, silhouette files, `ASSET_PLAN.md`, and `assets/ASSET_MANIFEST.json` in sync.
- Change screen shake, particles, SFX, combo, or victory presentation in `game-feedback.js`; change only the procedural floor, wall presentation, and stage engraving in `game-arena-carve.js`.
- Change Luna dialogue, first-run progression, or unlock behavior in `game-onboarding.js`.
- Keep `game-bootstrap.js` minimal; it should only start the runtime.

`renderTitlePresentation()` in `game-session.js` is the single renderer for the main constellation screen. `game-onboarding.js` may override the CTA behavior for first-run/replay progression, but should not duplicate the title markup. Stage definitions live in `game-data.js`; `setupBattle()` maps the selected stage's `bumpers` into runtime objects. `1-2` intentionally contains only the resonance-bumper gimmick.

`showRoster()` is the single squad screen: `deployed[i]` is the hero standing on board slot `i`, `s.slots[i]` is that slot on the real table, and `s.preview[i]` is the same slot on the minimap. `selected` is kept as a mirror of `deployed` because the hub and the battle summary read it. `showDeployment()` remains only as an alias so the draft screen's back button still resolves.

`setScene()` is the only way to change a major screen. It updates the body class and `game-platform.js` scene lifecycle together. The animation loop therefore runs canvas simulation and drawing only while the game scene is active; title, map, roster and browser-hidden states keep only the minimal `requestAnimationFrame` wake-up.

## Verification

With Node.js 20 or newer, run `npm run verify` and `npm run smoke` from the repository root. The verifier reads the ordered runtime files as one logical bundle, including `game-figure.js` and `game-arena-carve.js`, checks required gameplay markers and asset references, runs portability checks, and writes `artifacts/verification.json`. `npm run serve` starts the local server at `http://127.0.0.1:4173/`.
