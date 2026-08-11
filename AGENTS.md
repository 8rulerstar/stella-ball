# Stella Ball contributor guide

## Start here

1. Read `prototypes/ARCHITECTURE.md` for runtime ownership and script order.
2. Run `npm run verify` before handing work over.
3. Start the game with `PLAY_WINDOWS.cmd` on Windows, or `npm run serve` and open `http://127.0.0.1:4173/`.

## Runtime boundaries

- `prototypes/prism-breakers.html` contains stable DOM and the ordered script list.
- `prototypes/prism-breakers-*.css` are ordered presentation layers: foundation, interface, combat, story, then polish.
- `prototypes/js/game-data.js` owns shared data and state.
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
- Put gameplay-rule changes in `game-combat.js`.
- Put tutorial changes in `game-onboarding.js`.
- Register render or feedback work with `registerRuntimeHook()` instead of replacing `draw`, `drawArena`, `drawSpecial`, or `updateFeedback`.
- Keep browser assets relative to `prototypes/prism-breakers.html`, including references written from `prototypes/js/` scripts.

## Verification and hygiene

- `npm run verify` checks markers, runtime files, asset references, portability, and whitespace.
- `npm run smoke` checks the document/runtime contract without a browser.
- `npm run format:check` checks formatting; use `npm run format` to apply it.
- Do not edit generated `artifacts/` output or user-owned `.claude/` files.
- Preserve unrelated changes in a dirty worktree. Do not amend, rebase, or force-push `main`.
