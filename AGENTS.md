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
- `prototypes/js/game-meta-state.js` owns settings, progress, economy, audio, and achievement state.
- `prototypes/js/game-meta.js` owns meta screens such as settings, achievements, shop, profile, stage select, and replay tutorial.
- `prototypes/js/game-combat.js` owns input, blaze scoring, hero abilities, and combat feedback state.
- `prototypes/js/game-combat-physics.js` owns combat collision rules, stage gimmicks, shot settlement, and aim prediction.
- `prototypes/js/game-figure-recognition.js` owns parry trace capture, constellation templates, normalization, and classification.
- `prototypes/js/game-figure.js` owns constellation abilities, settlement deferral, and figure presentation.
- `prototypes/js/game-feedback.js` owns visual/audio feedback and the frame loop.
- `prototypes/js/game-onboarding.js` owns first-session story, tutorial, and unlocks.
- `prototypes/js/game-bootstrap.js` only starts the runtime.

These are ordered classic scripts sharing one global scope. Do not reorder their `<script>` tags without updating the architecture document and runtime smoke test.

## Safe changes

- Put roster, stage, asset-path, and balance changes in `game-data.js`.
- Put new browser storage or scene lifecycle behavior in `game-platform.js`; put reusable DOM presentation behavior in `game-ui.js`.
- Put input and ability changes in `game-combat.js`; put collision, stage-gimmick, or shot-settlement changes in `game-combat-physics.js`.
- Put constellation templates and recognition math in `game-figure-recognition.js`; put constellation outcomes and presentation in `game-figure.js`.
- Put tutorial changes in `game-onboarding.js`.
- Register render or feedback work with `registerRuntimeHook()` instead of replacing `draw`, `drawArena`, `drawSpecial`, or `updateFeedback`.
- Keep browser assets relative to `prototypes/prism-breakers.html`, including references written from `prototypes/js/` scripts.

## Verification and hygiene

- `npm run verify` checks markers, runtime files, asset references, portability, and whitespace.
- `npm run smoke` checks the document/runtime contract without a browser.
- `npm run test:onboarding` drives the six-card tutorial, guaranteed pentagram, final battle, and reward in a fresh headless Chromium profile.
- `npm run check` runs verification, smoke, and onboarding E2E in the handoff order.
- `npm run format:check` checks formatting; use `npm run format` to apply it.

### Measuring what the preview pane cannot show

The in-app Browser pane reports `document.hidden === true`, so `requestAnimationFrame`
never fires there and its viewport can read `0x0`. Anything about frame pacing,
motion or on-screen geometry measured through that pane is a proxy at best - two
performance passes were tuned against one such proxy and missed the real cost.
Fifteen probes drive a real Chromium over CDP the way the onboarding E2E does. None
is wired into a gate; run them by hand when the question is about the screen. Each
file's header names the ways that probe has actually been read wrong - four probes
gave confidently wrong answers in one night before those notes existed.

- `node scripts/profile-frames.mjs` - frame times and the composited layer structure.
- `node scripts/probe-settle-cost.mjs` - the frame cost of a settlement chain.
- `node scripts/probe-aim-polygon.mjs` - the draw cost of the aim screen and the settle frames.
- `node scripts/probe-sky-guests.mjs` - margin guest placement, immune to the 0x0 viewport.
- `node scripts/probe-longplay.mjs` - three stages back to back, then the hub:
  catches state that survives a battle (stray cinematic boxes, intro layers,
  toasts) which single-screen checks miss.
- `node scripts/probe-figure-abilities.mjs` - whether each of the eight
  constellations still casts its own ability (build points from the skeleton, not
  a regular polygon, or every 4-point figure classifies as sagitta).
- `node scripts/probe-hero-abilities.mjs` - whether all eight awakening abilities
  still fire (Yunseul's zero is by design; range is neutralised so a zero means
  the ability did not run, not that it missed).
- `node scripts/probe-campaign-clearable.mjs` - whether the worst possible hand
  still clears each world (win is scheduleWin, not battleComplete - a loss sets
  that too).
- `node scripts/probe-session-churn.mjs` - what accumulates as you cross *screens*
  (nodes, listeners, canvases, animations, heap) with a forced-GC reading. A
  single jump is not a leak; only monotonic growth after GC is. It never enters a
  battle, so anything that piles up shot by shot is invisible to it - that is the
  next line's job.
- `node scripts/probe-session-leak.mjs` - what accumulates *inside* battles, shot
  by shot: fx arrays, speech and toast queues, sfx pools, live timers and their
  call sites, runtime hooks. Counts, not frame times, because counts do not wobble
  under load.
- `node scripts/probe-window-scale.mjs` - what gets more expensive as the window
  grows. The canvas backbuffer is fixed at 720x900, so draw calls do not scale;
  composited *area* does.
- `node scripts/probe-meta-screens.mjs` - opens shop, summon, profile, archive and
  settings, dumps the text each one actually shows and writes a screenshot per
  screen. No assertions: it collects, you read. Meta state lives on `progress.*`,
  so a bare `gold = 4200` sets a new global and changes nothing.
- `node scripts/probe-overdraw.mjs` - how many full-viewport layers are actually
  painted, at the title and mid-battle. Baseline 2026-08-22: 12 layers / 9.8
  screens at the title, 11 / 9.62 in battle, with no meta-screen cover left
  behind. Read the header first - two overlays (the battle cinematic and the
  outer-observer intro) each make every reading say "something is covering the
  board" if you measure while they run.
- `node scripts/probe-aim-supply.mjs` - whether node aiming earns its own starlight
  back (results vary run to run; read the range, not one cell).
- `node scripts/probe-aim-nodes.mjs` - the node-aiming rules (starkeeper floor, 3-pick
  minimum, centroid direction, starkeeper non-burn) plus the direction-freedom menu.

New probes build on `scripts/lib/probe-harness.mjs` instead of copying the
Chromium/CDP boilerplate; five predate it and still carry their own
(`probe-session-leak`, `probe-settle-cost`, `probe-sky-guests`,
`probe-window-scale`, `profile-frames`). Its `errors` is an array, not a function.

`node bot/run-bot.mjs` regenerates `bot/latest-report.json`. The harness is
deterministic - the same code twice gives byte-identical output - so a diff in
that file is a real behaviour change, not noise. It loads 14 of the 19 runtime
scripts; the note on `runtimeFiles` says which five are left out and why.

- Do not edit generated `artifacts/` output or user-owned `.claude/` files.
- Preserve unrelated changes in a dirty worktree. Do not amend, rebase, or force-push `main`.

## Design and asset intake

- During feature work, do **not** create or import new raster assets, animation sheets, icons, or SFX just because they would improve the screen. Record the need in `ASSET_BACKLOG.md` first.
- Use existing project assets or a simple temporary code/CSS representation until the user approves a dedicated batch art pass. A temporary representation must not change gameplay rules.
- Every backlog entry needs a screen/trigger, player-facing purpose, asset type, existing reuse candidate, and code connection point. Mark unknown specifications as `미정`; do not invent them.
- When a batch is approved, process only items marked `제작 준비`, then document source, license, path, and runtime use in `ASSET_PLAN.md` and `assets/ASSET_MANIFEST.json` before marking the backlog item `반입 완료`.
