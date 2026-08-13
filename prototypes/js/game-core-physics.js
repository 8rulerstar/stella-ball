// Base solver hooks for the combat table.
//
// This file used to hold the pinball prototype: gravity, two flippers, a drain
// under the table, and a `hitGate` switchboard for a roster that no longer
// exists.  The billiards pass in `game-combat.js` replaced all of it, so the
// pinball bodies were dead the moment that file loaded.  What remains here is
// only what the live solver still calls, plus the base declarations that the
// later passes assign over.  Keep those declarations: the override chain in
// this codebase assigns to an existing name, and deleting one would turn its
// override into an implicit global.
//
// Live: `tableWall`, `updateExpanded`.
// Replaced downstream: `hitGate` (game-combat.js), `hitBumper` (game-meta.js),
// `simulatePhysics` (game-combat.js), `update` (game-core-render.js).

// Counts a cushion contact.  `game-combat.js` and `game-feedback.js` both wrap
// this to hang the constellation multiplier and the wall SFX off the same
// event, so the body must stay the single place a bounce is tallied.
function tableWall() {
  ball.bounces++;
}

// Per-frame upkeep for the short-lived field effects, called once per rendered
// frame by the live solver rather than once per collision slice.
function updateExpanded(d) {
  if (fieldFx.length > 12) fieldFx.splice(0, fieldFx.length - 12);
  advanceTimed(fieldFx, d);
}

// A starkeeper is woken by the meteor rolling into it; the billiards pass owns
// what that means.
function hitGate(g) {}

// Bumper response; the campaign version lives in `game-meta.js`.
function hitBumper(b) {}

// The collision solver itself; the billiards version lives in `game-combat.js`.
function simulatePhysics(d) {}

// The per-frame battle step; `game-core-render.js` supplies `modernUpdate`.
function update(d) {}
