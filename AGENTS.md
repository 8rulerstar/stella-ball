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
These probes (plus `profile-frames.mjs`) drive a real Chromium over CDP the way
the onboarding E2E does — count them with `ls scripts/probe-*.mjs`, a written
number here has gone stale twice. None
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
- `node scripts/probe-session-churn.mjs` - what accumulates as you cross _screens_
  (nodes, listeners, canvases, animations, heap) with a forced-GC reading. A
  single jump is not a leak; only monotonic growth after GC is. It never enters a
  battle, so anything that piles up shot by shot is invisible to it - that is the
  next line's job.
- `node scripts/probe-session-leak.mjs` - what accumulates _inside_ battles, shot
  by shot: fx arrays, speech and toast queues, sfx pools, live timers and their
  call sites, runtime hooks. Counts, not frame times, because counts do not wobble
  under load.
- `node scripts/probe-window-scale.mjs` - what gets more expensive as the window
  grows. The canvas backbuffer is fixed at 720x900, so draw calls do not scale;
  composited _area_ does.
- `node scripts/probe-meta-screens.mjs` - opens twelve screens (title, hub, stage
  select, roster, deployment, shop, summon, profile, archive, library, settings,
  pause) at 1280x900 and 1280x760, writes a screenshot of each and judges four
  things that are breakage rather than taste: a scroll box crushed to 0px, a
  button off-screen that no ancestor scrolls to, a child spilling out of its own
  box, and a portrait whose sprite cell disagrees with its element box (which
  clips the character into a corner). The text of each screen is dumped unjudged - read it yourself. Clean
  across 12 screens x 3 sizes as of 2026-08-22 (that run added a third size via
  `--sizes`; the shipped default is the two above), and the checker was
  validated by re-injecting the archive bug it was written for. Meta state lives on
  `progress.*`, so a bare `gold = 4200` sets a new global and changes nothing.
- `node scripts/probe-summon.mjs` - the ten-second summon ritual, beat by beat
  (call, observe, answer, manifest, intro), with a screenshot of each and a check
  that the roster and the gold actually moved. Force `prefers-reduced-motion:
no-preference` over CDP first, or the sequence collapses to 0.42s and you are
  measuring a different animation.
- `node scripts/probe-keyboard-battle.mjs` - plays a campaign battle with the
  keyboard only, never sending a mouse event: cursor, pick, flip, clear, launch,
  boss kill. Also prints what the `#aimLive` region says at each step.
- `node scripts/probe-keyboard-onboarding.mjs` - the whole 1-1 lesson with Tab,
  Enter, arrows and Space only. This is the real gate for keyboard play: the
  campaign being keyboard-playable is worth nothing if the tutorial locks. Send
  text-bearing keys as `keyDown` with `text`, not `rawKeyDown` - the page's own
  listeners see rawKeyDown but the browser's default action does not fire, so
  Enter will not press a focused button and the lesson never opens.
- `node scripts/probe-settlement.mjs` - the win and lose screens, reached the way a
  player reaches them. Fire with `fireMeteor()`, never by setting `ball.vx/vy`:
  the shot counter is decremented inside that function, so the shortcut rolls a
  meteor that never spends a shot and the defeat verdict never arrives. Use a
  fresh browser per ending - a win leaves `battleComplete`/`run` set, so the next
  wait returns instantly onto the previous overlay.
- `node scripts/probe-text-size.mjs` - what size board text is _on screen_, not in
  source. The 720x900 backbuffer is scaled to fit the window (0.54x at 1024x680,
  0.78x at 1280x900, capped at 0.99x), so the `MAINTENANCE.md` rule "no Korean
  below 10px" cannot be checked by reading `font: 700 10px`. Wraps fillText and
  multiplies by the transform in force at draw time - `ctx.scale()` is used in a
  dozen places, and the vertical factor is `hypot(m.b, m.d)`, not `m.d`. Findings
  in `BOARD_TEXT_2026_08_22.md`.
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
- `node scripts/probe-dialogue.mjs` - whether units, bosses and Luna actually
  speak (wake/echo/hit, enter/phase/low) and that the rotation is deterministic.
- `node scripts/probe-sound.mjs` - which sfx keys fire in a battle and that every
  key named in code exists in the `combatSfx` table. Wrap-then-read: reading
  `String(combatSfx)` after tapping it reads the wrapper, not the table.
- `node scripts/probe-gimmick-stages.mjs` - boots every stage that carries a
  `STAGE_GIMMICK_TRIAL` entry and checks the gimmick objects actually spawn.
- `node scripts/probe-guide-star.mjs` - that a guide-star charge is spent when
  claimed (label x1 must mean one). Calls `clearFigureShot()` between samples,
  the same shot boundary the real code uses.
- `node scripts/probe-boss-anim.mjs` - that the boss sheet states idle/attack/death
  are all reachable (attack rides `bossRoar`, death rides `bossOutro`; both step
  0->3 on the effect clock and hold the last frame). Sample right after arming -
  `drawBossRoar` clears its own signal at t>0.95.
- `node scripts/probe-dead-anim.mjs` - CSS animations that run but change nothing
  (an `!important` author declaration beats an animation in the cascade, so a
  pixel-kit override can silence a keyframe while the browser keeps paying style
  recalc for it - that is how the title CTA glow was found). Seeks `currentTime`
  instead of waiting; read the header for the four ways it gave wrong answers,
  including that `currentTime` counts from the _delay_, not the duration.
- `node scripts/probe-victory-toast.mjs` - that a remnant killed inside the last
  1.6s of the boss does not respawn (and toast) over the victory card, and that
  mid-battle respawn still works. Check the result card by its content, not its
  class - headless rAF makes class-only checks a timing race.

New probes build on `scripts/lib/probe-harness.mjs` instead of copying the
Chromium/CDP boilerplate; five predate it and still carry their own
(`probe-session-leak`, `probe-settle-cost`, `probe-sky-guests`,
`probe-window-scale`, `profile-frames`). Its `errors` is an array, not a function.

`node bot/run-bot.mjs` regenerates `bot/latest-report.json`. The harness is
deterministic - the same code twice gives byte-identical output - so a diff in
that file is a real behaviour change, not noise. It loads 14 of the 21 runtime
scripts; the note on `runtimeFiles` says which seven are left out and why.

- Do not edit generated `artifacts/` output or user-owned `.claude/` files.
- Preserve unrelated changes in a dirty worktree. Do not amend, rebase, or force-push `main`.

## Design and asset intake

- During feature work, do **not** create or import new raster assets, animation sheets, icons, or SFX just because they would improve the screen. Record the need in `ASSET_BACKLOG.md` first.
- Use existing project assets or a simple temporary code/CSS representation until the user approves a dedicated batch art pass. A temporary representation must not change gameplay rules.
- Every backlog entry needs a screen/trigger, player-facing purpose, asset type, existing reuse candidate, and code connection point. Mark unknown specifications as `미정`; do not invent them.
- When a batch is approved, process only items marked `제작 준비`, then document source, license, path, and runtime use in `ASSET_PLAN.md` and `assets/ASSET_MANIFEST.json` before marking the backlog item `반입 완료`.
