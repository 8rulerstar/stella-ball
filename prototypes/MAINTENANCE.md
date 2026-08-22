# Stella Ball maintenance guide

## Safe edit route

The browser build is intentionally a set of ordered classic scripts, not a bundled application. This keeps the GitHub Pages build and `PLAY_WINDOWS.cmd` launch path simple. Treat the order in `prism-breakers.html` as a public dependency contract; `npm run smoke` enforces it, along with a second rule about how later scripts extend earlier ones.

### Crossing a module boundary

Do not replace a function owned by another file. Publish a small service API when a caller needs an answer or command:

```js
const ExampleModule = StellaRuntime.modules.register("example", {
  isReady: () => ready,
});

StellaRuntime.modules.require("example").isReady();
```

Registered APIs are copied and frozen. Expose behavior or immutable values, not mutable owner state. Use `optional(name)` only where the feature may legitimately be absent in a focused harness.

Use a named hook when the other file only reacts to a lifecycle event:

```js
registerRuntimeHook("afterShotEnd", ({ battle }) => {
  // reaction owned by this file
});
```

`runRuntimeHooks` broadcasts, `queryRuntimeHook` returns the first defined answer, and `runtimeHookHandled` stops when a callback returns `true`. Hook names are validated in `game-runtime.js`; add a name there before registering it. Use priority only when product behavior requires ordering, and document why.

`npm run smoke` rejects every globally replaced function name. The runtime has no legacy exception or allowlist. See [ADR-001](./ADR-001-RUNTIME-MODULES.md) for the decision and trade-offs.

Start a change in the smallest owner module listed in [ARCHITECTURE.md](./ARCHITECTURE.md). Shared browser concerns have dedicated boundaries:

- `js/game-platform.js` owns resilient local persistence (`appStorage`) and the active scene lifecycle.
- `js/game-runtime.js` owns the module registry and named hook contracts, but no game state.
- `js/game-data.js` owns gameplay data, mutable combat state, and texture caching.
- `js/game-ui.js` owns reusable DOM presentation (`setScene`, `setPortrait`).

Use `setScene()` for every major-screen transition. It updates both the CSS body class and the runtime lifecycle. The animation loop simulates and draws only while `game` is active, and does nothing expensive when the tab is hidden.

## Extending combat safely

New render, feedback, onboarding, or combat reactions must register with `registerRuntimeHook(name, callback)`. It returns a cleanup function for temporary behavior. The closed hook-name list and dispatch semantics live in `game-runtime.js`.

Do not add assignments such as `draw = function () { ... }` or `updateFeedback = function () { ... }`. Add a named hook or an owner-controlled strategy instead.

`game-arena-carve.js` installs its per-stage cached floor through `render.installStageArena()`. Keep it after onboarding, before bootstrap, and presentation-only; do not add collisions, gameplay state, or per-frame canvas allocation there.

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

## Maintaining constellation figures

`js/game-figure-recognition.js` owns constellation trace capture and recognition in every combat. At settlement it uses the successful parry contacts collected during the shot: three or more select the nearest skeleton in their point-count tier. `js/game-figure.js` then keeps the physical units fixed, applies the selected outcome, and animates the drawn line toward that skeleton.

- Keep the order `game-combat.js` → `game-combat-physics.js` → `game-figure-recognition.js` → `game-figure.js`. The figure pair consumes `beforePartySettle` and `beforeShotResolution`; do not restore a `settleParty` or `endShot` wrapper.
- `game-figure-recognition.js` owns `FIGURE_SHAPES`, recognition templates, draw edges, and optional silhouette paths. `game-figure.js` owns `FIGURE_ABILITIES` and the outcome. The six current entries deliberately share `encloseDamage`; do not describe them as distinct abilities until that table changes.
- The seven 384×384 silhouette files are coordinate-bound to `FIGURE_SHAPES`. Update `ASSET_PLAN.md`, `assets/ASSET_MANIFEST.json`, and `FIGURE_ART_SPEC.md` in the same change if their points, size, or paths change. The 6- and 7-point pair regenerates from `scripts/generate_constellation_art_6_7.mjs`.
- Figure damage must continue through `applyBossHit()` and `damageAdd()` so shields and phase rules cannot be bypassed.

## Performance guardrails

- Reuse `loadTexture()` and `primeCombatTextures()`; never create `Image` objects inside a frame function.
- Sample SFX voices are lazy: create them through `sampleSfxPool()` only when the cue is first played. Do not preallocate every audio voice on the title screen.
- Cache static canvas layers. `game-core-render.js` already caches stage floor and arena layers.
- Do DOM work on state changes, not inside the frame loop. `sync()` caches each HUD field; extend that cache instead of rebuilding the HUD for a collision-only update.
- Keep transient effect arrays bounded and compact them in place with `advanceTimed()` rather than chaining `filter()` calls every frame.
- Keep UI-only scenes out of the combat loop by going through `setScene()`.

## Traps this codebase has already fallen into

Each rule below cost real debugging time here. The evidence is in `DEVLOG.md` under 2026-08-14 and 2026-08-18.

- **Never decide on the wall clock what the frame clock presents.** `win()` compared `Date.now()` while the victory animation advanced per frame; when the preview pane suspended `requestAnimationFrame` the verdict raced a frozen presentation and the onboarding E2E hung on macOS for a full day. Verdicts belong on `afterFeedbackUpdate` with the presentation they judge.
- **Assume frames may never arrive.** Work deferred to `requestAnimationFrame` does not run while `document.hidden` is true. Cleanup and restore paths must be synchronous; force a reflow if the DOM write has to land before the next read.
- **A running CSS animation overrides the base rule, and without `fill-mode` it starts at 0%.** Do not animate `opacity` up from `0` in an entrance keyframe for anything that must stay visible — one stalled frame pins it invisible. Animate transform instead, or set the fill mode.
- **`element.dataset.fooBar` is the attribute `data-foo-bar`.** A camelCase attribute selector matches nothing and reports success, so the code appears to run while doing zero work. `outer-observer.js` carries this note at the call site.
- **Do not edit source by counting braces.** A braceless arrow function with a multi-line body has no closing brace to count, so a range delete takes its head and splices the tail onto the next definition. `npm run smoke` concatenates every runtime file and parses it, which is the only gate that catches this before the browser does.
- **Tie a trigger point to the thing the player was shown, not to a parallel constant.** The steer lesson froze at a fixed board height while the marked zone was defined separately; nothing connected the two, so the freeze always landed near half the drawn route and never reached the marker. Derive one from the other.
- **A sprite-sheet portrait's frame size must equal the element's box.** `setPortrait(el, hero, size)` sets the background to `frames x size`, so a box wider than `size` paints the next frame beside the first. The squad detail card passed 46 into a 58px box and showed 12px of frame two next to the hero's face.
- **`overflow-x: auto` does nothing while an ancestor can still grow.** A flex or grid item defaults to `min-width: auto` and refuses to be narrower than its content, so the box widens instead of scrolling and the overflow lands wherever the first `overflow: hidden` sits. The squad tray had `overflow-x: auto` and still pushed `.squad-layout` to 712px inside a 502px overlay. Put `min-width: 0` on every ancestor between the scroller and a track that is capped with `minmax(0, 1fr)`.
- **A complaint about what is covering the screen is answered by looking, not by measuring.** Three rounds of "the intro covers the UI" went to the wrong fix because each round only read `opacity` off the elements that had been touched. What actually covered the observer was the panel those elements sit in — `.stage`, `.overlay` and `.title-sequence` each painting their own background. Take a screenshot first; the box is never in the list of things you thought to measure.
- **Anything you deliberately excepted must go back into the next audit.** The sub-links were left visible on purpose in one commit and were then invisible to the very next "what is still on screen" check, because the check inherited the exception.
- **A filled animation value outranks a normal declaration.** `animation: … forwards` holds its end value above any plain rule, so a later `opacity: 0` loses. This is why a hide can work before the animation has ever run and fail forever after. Use `!important`, or clear `animation` too.
- **`opacity: 0` still takes hit tests; `pointer-events: none` is what removes an escape hatch.** `outer-observer.js` states that the tutorial button stays unlocked during the cutscene; blanketing the title copy in `pointer-events: none` broke that and failed the onboarding E2E.
- **Never chain a commit after an `echo` that follows a gate.** `npm run check; echo "EXIT=$?" && git commit` always commits — the echo succeeds whatever the gate did. Put the gate itself immediately before the `&&`.
- **Check the working directory before a relative-path edit.** This repo's delivery folders carry byte-identical copies of `prototypes/`, so a stale `cd` sends edits into the copy and every `assert count == 1` still passes. Use absolute paths in edit scripts.
- **A screen only tested with starting data is not tested.** The squad tray looked correct for the whole session at three owned starkeepers and broke at seven, which is a state any finished save reaches. Drive list screens at their maximum count before calling them done.
- **A layout that hands a fixed width to the secondary panel starves the primary one.** The squad field gave the detail card a fixed 262px, leaving 186px for a board that declares `aspect-ratio: 720/900`; it could not hold its own proportions and rendered at 0.607. Size the panel that has a declared ratio first.
- **Korean text below 10px is unreadable in this project.** Galmuri11 is drawn for 11px, so 8px labels turn to mush. Check `font: 700 8px` before shipping any new label. On the canvas that check is not enough: the 720x900 backbuffer is scaled to the window (0.54x at 1024x680, 0.78x at 1280x900), so source px is not screen px. Measure with `node scripts/probe-text-size.mjs`; findings in `BOARD_TEXT_2026_08_22.md`.
- **A portrait size written twice drifts.** `setPortrait(el, hero, size)` uses `size` as the sprite sheet's _cell_ edge, so it must equal the element's CSS box. Write it once and let one value drive both - the squad tray does this with `--tray-portrait`. Written twice it has now drifted three times: the detail card (2026-08-18), and the summon reveal (box 72px, cell 96px) and its candidate cards (box 34px, cell 46px) on 2026-08-22. The character is drawn centred in its cell, so a cell larger than the box pushes it into a corner and clips it - on the summon reveal that meant the payoff of a ten-second ritual showed a cropped figure. `node scripts/probe-meta-screens.mjs` measures every portrait on twelve screens and names any that disagree.
- **Format only with the pinned Prettier.** `package.json` pins 3.5.3; a bare `npx prettier --write .` runs 3.9.6, which reads Korean range notation as strikethrough and writes that reading into the file - `10~11px` becomes `10~~11px`, and any `**bold**` caught between two of them breaks too. It damaged 24 places across seven documents in one command. Run `npm run format`, never bare `npx prettier`. `npm run verify` now fails on the doubled tilde.
- **A teaching gate must not demand an input the lesson already requested, and must always release itself.** The parry hold waited for a Space the tutorial copy had just told the player to press, which deadlocked the journey; it also had no timeout, so a player who could not respond stayed stuck. Guard on the state the lesson already sets, and give every hold a grace release.

### Measuring (added 2026-08-19, after four of these in one day)

- **How many _places_ the sample came from matters more than how many samples.** Two conclusions were reversed on the same day because the sweep drew 16 points from a single aim angle per stage. Widening to 238 points across ±40° flipped both. Before trusting a number, ask where the samples sit, not just how many there are.
- **Check when a hook fires before reading a value through it.** `afterMobilePairCollision` runs _after_ the impulse, so reading a body's "pre-collision" speed there returns the post-collision value — every starkeeper looked like it was moving at the settlement cap. Wrap the function instead.
- **A wrapper must forward every argument.** A probe wrapped `mobilePair` with six parameters after a seventh was added; the knob it was measuring silently never reached the physics and the report did not move.
- **A counter read at the end of a shot is the next shot's counter.** `endShot → startShot` resets `ball.bounces` before the loop's final read, so a seven-contact shot reports two. Take the maximum over the run, not the last value.
- **A config key that nothing reads fails silently.** A probe passed `angleOffset` where `__botRun` reads `aimOffset`; the sweep ran 121 times and returned 121 identical rows. When a sweep produces no variation, suspect the plumbing before the physics.
- **Before adding a file to the harness's `runtimeFiles`, grep it for `Math.random`.** That harness's seed reproducibility assumes randomness is drawn in exactly one place (`aimSigma`). One presentation file with twenty draws invalidates every past report. This is why `game-figure-cinematics.js` is excluded and why `CINE.orionKnock` ships off.

### Measuring (added 2026-08-22, from one autonomous night)

- **A probe that reports "everything is used" is usually not measuring.** CDP's
  CSS rule-usage tracking returns only the rules it matched, so an unused-CSS
  sweep across every screen came back 584/584 used and 0 KB unused. The number
  was not evidence of clean stylesheets; it was the wrong instrument. When a
  measurement produces a suspiciously perfect result, prove the instrument can
  report the bad case before trusting the good one.
- **`battleComplete` is not victory.** Running out of meteors sets it too, so a
  clearability sweep counted losses as clears — 8-1 read as "cleared at 87%"
  when it had actually failed. Gate on `scheduleWin` being called.
- **A zero can mean "did not fire" or "missed".** An ability sweep read 0 damage
  for the shockwave twice: first because the assist queue lands more than two
  seconds later, then because the starkeeper's default slot is outside its
  radius. If a probe is testing whether an ability _runs_, remove range and
  timing from the question — stand the unit next to the boss and wait long
  enough.
- **Build test shapes from the real skeleton, not a regular polygon.** Every
  4-point figure classified as sagitta and every 5-point one as pentagram until
  the probe used `FIGURE_SHAPES` coordinates. Pentagram is the special case: its
  `points` are null because it is a pentagon walked two steps at a time.

## Before handoff

Run this quick handoff check from the repository root:

```sh
npm run check
```

`check` ends with the roughly 30-second onboarding browser journey. To rerun only that journey, use `npm run test:onboarding`; set `STELLA_BROWSER_PATH` when Chrome or Edge is installed outside the documented platform defaults.

For a changed runtime module, add the focused formatting check and whitespace check:

```sh
npx --yes prettier@3.5.3 --check prototypes/js/game-platform.js prototypes/js/game-runtime.js prototypes/js/game-data.js prototypes/js/game-ui.js prototypes/js/game-session.js prototypes/js/game-core-physics.js prototypes/js/game-core-render.js prototypes/js/game-meta-state.js prototypes/js/game-meta.js prototypes/js/game-combat.js prototypes/js/game-combat-physics.js prototypes/js/game-figure-recognition.js prototypes/js/game-figure.js prototypes/js/game-feedback.js prototypes/js/game-onboarding.js prototypes/js/game-arena-carve.js scripts/smoke-runtime.mjs scripts/test-onboarding-e2e.mjs scripts/verify-evidence.mjs
git diff --check
```

`npm run format:check` covers the whole repository. If it reports existing files outside the current change, do not mechanically reformat them in a feature/refactor commit; report that baseline separately.
