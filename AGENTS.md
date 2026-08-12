# Stella Ball contributor guide

## Start here

1. Read `prototypes/ARCHITECTURE.md` for runtime ownership and script order.
2. Read `ASSET_BACKLOG.md` before proposing or adding visual assets, animations, icons, or SFX.
3. Run `npm run verify` before handing work over.
4. Start the game with `PLAY_WINDOWS.cmd` on Windows, or `npm run serve` and open `http://127.0.0.1:4173/`.

## Runtime boundaries

- `prototypes/prism-breakers.html` contains stable DOM and the ordered script list.
- `prototypes/prism-breakers-*.css` are ordered presentation layers: foundation, interface, combat, story, then polish.
- `prototypes/js/game-platform.js` owns safe local persistence and active scene lifecycle.
- `prototypes/js/game-data.js` owns shared data and state.
- `prototypes/js/game-ui.js` owns reusable DOM presentation helpers such as portrait setup and scene classes.
- `prototypes/js/game-session.js` owns battle lifecycle and base screen flow.
- `prototypes/js/game-core-physics.js` owns the base solver and moving entities.
- `prototypes/js/game-core-render.js` owns base combat drawing and HUD feedback.
- `prototypes/js/game-meta.js` owns settings, achievements, stage select, and replay tutorial screens.
- `prototypes/js/game-combat.js` owns aim, collisions, abilities, and damage.
- `prototypes/js/game-feedback.js` owns visual/audio feedback and the frame loop.
- `prototypes/js/game-onboarding.js` owns first-session story, tutorial, and unlocks.
- `prototypes/js/game-bootstrap.js` only starts the runtime.

These are ordered classic scripts sharing one global scope. Do not reorder their `<script>` tags without updating the architecture document and runtime smoke test.

## Safe changes

- Put roster, stage, asset-path, and balance changes in `game-data.js`.
- Put new browser storage or scene lifecycle behavior in `game-platform.js`; put reusable DOM presentation behavior in `game-ui.js`.
- Put gameplay-rule changes in `game-combat.js`.
- Put tutorial changes in `game-onboarding.js`.
- Register render or feedback work with `registerRuntimeHook()` instead of replacing `draw`, `drawArena`, `drawSpecial`, or `updateFeedback`.
- Keep browser assets relative to `prototypes/prism-breakers.html`, including references written from `prototypes/js/` scripts.

## Verification and hygiene

- `npm run verify` checks markers, runtime files, asset references, portability, and whitespace.
- `npm run smoke` checks the document/runtime contract without a browser.
- `npm run check` runs both required checks in the handoff order.
- `npm run format:check` checks formatting; use `npm run format` to apply it.
- Do not edit generated `artifacts/` output or user-owned `.claude/` files.
- Preserve unrelated changes in a dirty worktree. Do not amend, rebase, or force-push `main`.

## Design and asset intake

- During feature work, do **not** create or import new raster assets, animation sheets, icons, or SFX just because they would improve the screen. Record the need in `ASSET_BACKLOG.md` first.
- Use existing project assets or a simple temporary code/CSS representation until the user approves a dedicated batch art pass. A temporary representation must not change gameplay rules.
- Every backlog entry needs a screen/trigger, player-facing purpose, asset type, existing reuse candidate, and code connection point. Mark unknown specifications as `미정`; do not invent them.
- When a batch is approved, process only items marked `제작 준비`, then document source, license, path, and runtime use in `ASSET_PLAN.md` and `assets/ASSET_MANIFEST.json` before marking the backlog item `반입 완료`.
