// --- Constellation figure system ------------------------------------------
// Shared combat system, kept in its own file because it wraps
// `settleParty` and reads `applyBossHit`, `figureCentroid`'s neighbours and
// the runtime hook registry, all of which that file establishes first.
//
// --- Constellation figure system (all combat tables, 2026-08-13) -----------
// A successful Space parry on a meteor-to-starkeeper collision leaves one
// fixed starlight node at that contact.  The meteor and starkeeper keep their
// normal physics; the nodes, not their eventual resting positions, become the
// constellation vertices. Nodes last for one shot, then resolve together when
// the table settles. Every combat table uses this same parry rule.
//
// The recogniser is ported from RuneCast's gesture pipeline
// (~/Projects/RuneCast, 설계 문서 4.3-4.5): centroid-to-origin plus uniform
// scale, $P greedy cloud matching with uniform weights and four start points,
// bidirectional minimum, and score spread across a reject..perfect band.
const FIGURE = {
  // Re-measured for 5-point clouds; RuneCast's 0.13/0.035 were tuned for
  // 32-point stroke clouds.  0.19 is the loose read the training bench wants:
  // over 20000 synthetic trials each it takes ±18% jitter from 89% to 100% and
  // "대충 그린" ±30% from 35% to 82%, while the two shapes that must never pay
  // out hold — the free opening layout (four seats on a rectangle plus the
  // meteor) passes 11% instead of 0%, and random scatter 0.2%.  A 0.55-squashed
  // pentagon still reads 0%, because a flattened ring is not a pentagram.
  // All combat now shares this loose first-pass read; revisit after live data.
  reject: 0.19,
  perfect: 0.04,
  bonusPerPoint: 14, // damage per enclosed target, per figure vertex
  // 5.6 seconds end to end, with the trace itself slow enough to watch being
  // drawn. At 0.55/0.9/0.45 the whole thing was over before the settle
  // slow-motion finished, so it read as "nothing drew".
  drawTime: 1.4,
  // 2.6 was set when the whole sequence was 5s and a shot took ~7s to settle.
  // The correction and reveal steps added 1.6s on top, and the meteor now
  // settles in ~3s, so the hold was the one beat outlasting the shot itself.
  holdTime: 1.6,
  fadeTime: 1,
  // Sequence after the trace lands, all from the silhouette art delivery:
  // the crooked figure the player actually made is corrected into the real
  // constellation, the creature fades in over it, and only then does the
  // ability fire.  See FIGURE_ART_SPEC.md §2.
  correctTime: 0.8, // ease-in-out from drawn vertices to the fitted skeleton
  revealDelay: 0.35, // silhouette starts fading in this long after correction
  revealTime: 0.45,
  castDelay: 0.3, // ability fires this long after the silhouette appears
  // The delivery specified 0.13, matching the pentagram's inner wash.  On the
  // real table that is invisible: the arena floor is dark purple and the
  // silhouettes are pale, so at 0.13 the swan cannot be made out at all.  0.30
  // is the lowest value where it still reads as "faint" rather than "absent",
  // checked against the live canvas.  Revisit if the floor tone changes —
  // PROGRESS_REPORT.md already lists that purple as an open item.
  silhouetteAlpha: 0.3,
};
const FIGURE_PARRY = {
  parryWindow: 0.32,
  missCooldown: 0.72,
  minNodes: 3,
  maxNodes: 7,
};
let figureFx = null;
let figureShotBattle = null;
let figureShot = null;
function figureActive() {
  return Boolean(battle && run && !battleComplete);
}
function currentFigureShot() {
  if (figureShotBattle !== battle) {
    figureShotBattle = battle;
    figureShot = { nodes: [], parry: 0, cooldown: 0, flash: 0 };
  }
  return figureShot;
}
function clearFigureShot() {
  const state = currentFigureShot();
  state.nodes = [];
  state.parry = 0;
}
// Called by the combat collision pass. `mobilePair` has already left the
// ordinary bounce in place; this consumes only the additional powered contact.
function consumeTrainingParry(g) {
  if (!figureActive()) return false;
  const state = currentFigureShot();
  if (state.parry <= 0 || state.cooldown > 0) return false;
  state.parry = 0;
  state.flash = 0.44;
  ball.runeBurst = Math.max(ball.runeBurst || 0, 0.92);
  fieldFx.push({ type: "relay", x: g.x, y: g.y, t: 0, d: 0.48, col: g.col });
  if (state.nodes.length < FIGURE_PARRY.maxNodes) {
    state.nodes.push({
      x: (ball.x + g.x) / 2,
      y: (ball.y + g.y) / 2,
      col: g.col,
      label: g.s,
    });
    addPopup(
      g.x,
      g.y - 52,
      "별빛 " + state.nodes.length + "/" + FIGURE_PARRY.maxNodes,
      g.col,
      true,
    );
  }
  return true;
}
function requestTrainingParry() {
  if (!figureActive() || !ball?.moving) return false;
  const state = currentFigureShot();
  if (state.cooldown > 0 || state.parry > 0) return false;
  state.parry = FIGURE_PARRY.parryWindow;
  ball.runeBurst = Math.max(ball.runeBurst || 0, 0.54);
  return true;
}
function finishFigureShot({ missed = false } = {}) {
  const state = currentFigureShot();
  if (missed) {
    const lostNodes = state.nodes.length;
    clearFigureShot();
    if (lostNodes) toast("패링 실패 · 모은 별빛이 흩어졌습니다");
    return Boolean(lostNodes);
  }
  if (!state.nodes.length) return;
  const nodes = state.nodes;
  clearFigureShot();
  if (nodes.length >= FIGURE_PARRY.minNodes) {
    resolveFigure(nodes);
    return true;
  }
  return false;
}
function advanceFigureShot(d) {
  if (!figureActive()) return;
  const state = currentFigureShot();
  state.cooldown = Math.max(0, state.cooldown - d);
  state.flash = Math.max(0, state.flash - d);
  if (state.parry > 0) {
    state.parry = Math.max(0, state.parry - d);
    if (state.parry === 0) {
      const lostNodes = finishFigureShot({ missed: true });
      state.cooldown = FIGURE_PARRY.missCooldown;
      if (!lostNodes) toast("패링 실패 · 관측 공명 재정비");
    }
  }
}
addEventListener("keydown", (e) => {
  if (e.code !== "Space" || e.repeat || !figureActive()) return;
  if (paused || isCombatInputLocked()) return;
  if (requestTrainingParry()) e.preventDefault();
});
function figureCentroid(points) {
  let cx = 0,
    cy = 0;
  for (const p of points) {
    cx += p.x;
    cy += p.y;
  }
  return { x: cx / points.length, y: cy / points.length };
}
// Angular order around the centroid gives the simple polygon; without it the
// vertices connect in awakening order and the figure self-crosses at random.
function figureRing(points) {
  const c = figureCentroid(points);
  return [...points].sort(
    (a, b) =>
      Math.atan2(a.y - c.y, a.x - c.x) - Math.atan2(b.y - c.y, b.x - c.x),
  );
}
function pointInPolygon(px, py, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i].x,
      yi = ring[i].y,
      xj = ring[j].x,
      yj = ring[j].y;
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi)
      inside = !inside;
  }
  return inside;
}
function distanceToSegment(px, py, a, b) {
  const dx = b.x - a.x,
    dy = b.y - a.y,
    len = dx * dx + dy * dy;
  const t = len
    ? Math.max(0, Math.min(1, ((px - a.x) * dx + (py - a.y) * dy) / len))
    : 0;
  return Math.hypot(px - (a.x + dx * t), py - (a.y + dy * t));
}
/* --- point-cloud recogniser (RuneCast port) ----------------------------- */
function figureNormalize(points) {
  const c = figureCentroid(points),
    centred = points.map((p) => ({ x: p.x - c.x, y: p.y - c.y }));
  // Uniform scale, never per-axis: a squashed pentagon must not normalise into
  // a regular one, because that difference is exactly what is being judged.
  let max = 0;
  for (const p of centred) max = Math.max(max, Math.hypot(p.x, p.y));
  return max > 0
    ? centred.map((p) => ({ x: p.x / max, y: p.y / max }))
    : centred;
}
function figureCloudDistance(a, b, start) {
  const n = a.length,
    matched = new Array(n).fill(false);
  let sum = 0,
    i = start;
  do {
    let best = Infinity,
      index = -1;
    for (let j = 0; j < n; j++) {
      if (matched[j]) continue;
      const d = Math.hypot(a[i].x - b[j].x, a[i].y - b[j].y);
      if (d < best) {
        best = d;
        index = j;
      }
    }
    if (index < 0) break;
    matched[index] = true;
    sum += best;
    i = (i + 1) % n;
  } while (i !== start);
  return sum / n;
}
// RuneCast deliberately skips rotation normalisation, because for handwriting
// the orientation carries the meaning and `>` must not match `<`.  A figure on
// the table has no up, so a tilted pentagram is still a pentagram: every
// rotation that puts one of our points on the template's first vertex is
// tried and the best wins.  Five points, five candidates.
function figureMatch(cloud, template) {
  const n = cloud.length,
    step = Math.max(1, Math.floor(n / 4)),
    anchor = Math.atan2(template[0].y, template[0].x);
  let best = Infinity;
  for (let k = 0; k < n; k++) {
    const turn = anchor - Math.atan2(cloud[k].y, cloud[k].x),
      cos = Math.cos(turn),
      sin = Math.sin(turn),
      turned = cloud.map((p) => ({
        x: p.x * cos - p.y * sin,
        y: p.x * sin + p.y * cos,
      }));
    for (let i = 0; i < n; i += step)
      best = Math.min(
        best,
        figureCloudDistance(turned, template, i),
        figureCloudDistance(template, turned, i),
      );
  }
  return best;
}
// `figureMatch` measures how close two clouds are, but the pairing it builds on
// the way — which drawn vertex sits on which template star — is thrown away
// with the running total.  Recovering that pairing is what lets the trace
// follow a constellation's own lines instead of a ring: the edge list is
// written in template-star numbers, and this turns those into table positions.
// Same rotation search as above, then one greedy pass per candidate.
function figureAlign(cloud, template) {
  const n = cloud.length,
    anchor = Math.atan2(template[0].y, template[0].x);
  let best = null;
  for (let k = 0; k < n; k++) {
    const turn = anchor - Math.atan2(cloud[k].y, cloud[k].x),
      cos = Math.cos(turn),
      sin = Math.sin(turn),
      turned = cloud.map((p) => ({
        x: p.x * cos - p.y * sin,
        y: p.x * sin + p.y * cos,
      }));
    const used = new Array(n).fill(false),
      pairs = new Array(n).fill(-1);
    let sum = 0;
    for (let star = 0; star < n; star++) {
      let pick = -1,
        near = Infinity;
      for (let i = 0; i < n; i++) {
        if (used[i]) continue;
        const d = Math.hypot(
          turned[i].x - template[star].x,
          turned[i].y - template[star].y,
        );
        if (d < near) {
          near = d;
          pick = i;
        }
      }
      used[pick] = true;
      pairs[star] = pick;
      sum += near;
    }
    if (!best || sum < best.sum) best = { sum, pairs };
  }
  // pairs[templateStarIndex] = index of the drawn vertex standing on that star
  return best.pairs;
}
const PENTAGRAM_TEMPLATE = figureNormalize(
  Array.from({ length: 5 }, (_, i) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
    return { x: Math.cos(a), y: Math.sin(a) };
  }),
);
/* --- the constellation roster ------------------------------------------- */
// One entry per constellation the table can draw, grouped by how many vertices
// it needs.  A settle with three or more points ALWAYS lands on exactly one of
// them: the nearest template in its own tier wins and there is no reject gate.
//
// That is a deliberate choice, and the measurement behind it is in
// BOT_REPORT.md §2-3 — over 795 real shots the settled layout was statistically
// indistinguishable from uniform random scatter, so no threshold can separate
// "drawn well" from "landed there".  Gating it would only have hidden the
// outcome, never earned it.  What the player does control is the vertex count
// (how many starkeepers were woken), so the tier is the skill axis and which
// constellation inside the tier is the draw.
//
// `share` is the measured chance of this constellation winning its tier, from
// the same 795 shots.  Keep ability strength inversely proportional to it: the
// pentagram shows up 4% of the time and should pay like it.
// `edges` is the constellation's own figure, written as pairs of indices into
// `points`.  It is what makes the trace look like the thing it is named after,
// and it is fixed per constellation rather than derived: an angular ring around
// the centroid can only ever draw a convex loop, so a cross with a star in the
// middle — Cygnus — is impossible to reach that way.  Edges may be an open
// path, may revisit a hub, and need not enclose anything.
const FIGURE_SHAPES = {
  3: [
    {
      id: "aries",
      name: "양자리",
      share: 19,
      // Hamal, Sheratan, Mesarthim.  Skeleton coordinates come from the
      // silhouette delivery so the ram lines up with the bend at Sheratan;
      // they sit within a few hundredths of the projected J2000 positions.
      points: [
        [0.95, -0.18],
        [-0.35, -0.02],
        [-0.9, 0.42],
      ],
      edges: [
        [0, 1],
        [1, 2],
      ],
      art: "../assets/library/constellations/aries.png",
    },
  ],
  4: [
    {
      id: "sagitta",
      name: "화살자리",
      share: 11,
      // 촉, 왼 깃, 오른 깃, 자루 끝
      points: [
        [0, -1],
        [-0.55, -0.1],
        [0.55, -0.1],
        [0, 1],
      ],
      edges: [
        [3, 0],
        [0, 1],
        [0, 2],
      ],
      // The shaft, nock first.  `piercingShot` fires along it, so this is the
      // one constellation whose recognised orientation decides an outcome.
      axis: [3, 0],
      art: "../assets/library/constellations/sagitta.png",
    },
    {
      id: "corvus",
      name: "까마귀자리",
      share: 7,
      points: [
        [-0.85, -0.38],
        [0.82, -0.52],
        [0.55, 0.52],
        [-0.62, 0.42],
      ],
      edges: [
        [0, 1],
        [1, 2],
        [2, 3],
        [3, 0],
      ],
      art: "../assets/library/constellations/corvus.png",
    },
  ],
  5: [
    // Real star positions, projected flat from J2000 RA/Dec and normalised.
    {
      id: "cassiopeia",
      name: "카시오페이아",
      share: 8,
      // 카프, 셰다르, 감마, 루크바, 세긴
      points: [
        [0.862, 0.121],
        [0.344, 0.468],
        [0.076, -0.087],
        [-0.405, -0.023],
        [-0.878, -0.478],
      ],
      // The W: an open zig-zag through the five in order, never closed.
      edges: [
        [0, 1],
        [1, 2],
        [2, 3],
        [3, 4],
      ],
      art: "../assets/library/constellations/cassiopeia.png",
    },
    {
      id: "cygnus",
      name: "백조자리",
      share: 5,
      // 데네브(꼬리), 사드르(가슴), 알비레오(부리), 델타(날개), 기에나(날개)
      points: [
        [-0.412, -0.504],
        [-0.133, -0.129],
        [0.618, 0.786],
        [0.409, -0.493],
        [-0.482, 0.339],
      ],
      // The Northern Cross: every line passes through Sadr, the hub at 1.
      edges: [
        [0, 1],
        [1, 2],
        [3, 1],
        [1, 4],
      ],
      art: "../assets/library/constellations/cygnus.png",
    },
    {
      id: "pentagram",
      name: "오망성",
      share: 2,
      points: null,
      // Same five points as a pentagon; stepping two at a time is the star.
      edges: [
        [0, 2],
        [2, 4],
        [4, 1],
        [1, 3],
        [3, 0],
      ],
      // No silhouette by design: the pentagram already owns the loudest
      // treatment on the table, so adding art would flatten the tiering.
      art: null,
    },
  ],
  // Six and seven are the top of the ladder.  Nothing below five was free to
  // take: normalising rotation and scale leaves a 3-point cloud defined by two
  // angles, so the shape space there is nearly full at two entries, and four
  // is worse — square, kite, trapezoid and rhombus all match each other under
  // 0.19.  Going up instead of sideways is the only room left.
  6: [
    {
      id: "orion",
      name: "오리온자리",
      // The seven-node cap makes this tier reachable. Its share remains unset
      // until live training data establishes a distribution worth documenting.
      share: null,
      // Betelgeuse and Bellatrix for the shoulders, the three belt stars, and
      // Rigel for the near foot.  Saiph is dropped to land on six: the far
      // foot is the one star the silhouette can lose and still read as Orion.
      points: [
        [-0.539, -0.717],
        [0.225, -0.61],
        [-0.173, 0.233],
        [-0.057, 0.158],
        [0.05, 0.066],
        [0.494, 0.87],
      ],
      // Shoulders, then the belt as its own short run, then a leg down to
      // Rigel.  The torso is deliberately open — closing it would draw a box
      // and lose the hourglass.
      edges: [
        [0, 1],
        [1, 4],
        [4, 3],
        [3, 2],
        [2, 0],
        [2, 5],
      ],
      // Silhouette not delivered yet — see FIGURE_ART_SPEC_6_7.md.  Left null
      // rather than pointing at the future path, because a missing file logs a
      // 404 on every load and console noise is how real errors get ignored.
      art: "../assets/library/constellations/orion.png",
    },
  ],
  7: [
    {
      id: "bigdipper",
      name: "북두칠성",
      share: null,
      // Dubhe, Merak, Phecda, Megrez, Alioth, Mizar, Alkaid.
      points: [
        [0.778, -0.445],
        [0.797, -0.058],
        [0.267, 0.136],
        [0.047, -0.105],
        [-0.346, -0.027],
        [-0.651, 0.047],
        [-0.892, 0.452],
      ],
      // Bowl closed, handle open: the ladle everyone already knows.
      edges: [
        [0, 1],
        [1, 2],
        [2, 3],
        [3, 0],
        [3, 4],
        [4, 5],
        [5, 6],
      ],
      // Silhouette not delivered yet — see FIGURE_ART_SPEC_6_7.md.
      art: "../assets/library/constellations/bigdipper.png",
    },
  ],
};
for (const tier of Object.values(FIGURE_SHAPES))
  for (const shape of tier) {
    // `raw` is the skeleton in the coordinate frame the silhouette was drawn
    // in, so it is what positions the art.  `cloud` is the same skeleton
    // centred and unit-scaled, which is all the matcher looks at.
    shape.raw = shape.points
      ? shape.points.map(([x, y]) => ({ x, y }))
      : PENTAGRAM_TEMPLATE.map((p) => ({ x: p.x, y: p.y }));
    shape.cloud = figureNormalize(shape.raw);
    if (shape.art) loadTexture(shape.art);
  }
// The silhouette sheets are 384px square, drawn on a 128 grid at ×3 with the
// skeleton origin dead centre and one skeleton unit spanning 46 grid cells.
// Both numbers come from the art delivery and are what tie a sheet to its
// skeleton; changing either without regenerating the art misaligns every one.
const FIGURE_ART_SIZE = 384,
  FIGURE_ART_UNIT = 46 * 3;
// Best-fit similarity transform from a shape's own skeleton onto the vertices
// actually on the table: the rotation, uniform scale and centre that line the
// two up.  This is what the correction step eases toward, and the same
// transform places the silhouette, so the art can never drift off the figure.
function figureFit(points, shape) {
  const order = figureAlign(figureNormalize(points), shape.cloud),
    n = points.length,
    // Table vertices reordered so index i is the one standing on skeleton star i
    table = order.map((index) => points[index]),
    model = shape.raw;
  let tx = 0,
    ty = 0,
    mx = 0,
    my = 0;
  for (let i = 0; i < n; i++) {
    tx += table[i].x;
    ty += table[i].y;
    mx += model[i].x;
    my += model[i].y;
  }
  tx /= n;
  ty /= n;
  mx /= n;
  my /= n;
  let dot = 0,
    cross = 0,
    norm = 0;
  for (let i = 0; i < n; i++) {
    const ax = model[i].x - mx,
      ay = model[i].y - my,
      bx = table[i].x - tx,
      by = table[i].y - ty;
    dot += ax * bx + ay * by;
    cross += ax * by - ay * bx;
    norm += ax * ax + ay * ay;
  }
  const rotation = Math.atan2(cross, dot),
    scale = norm > 0 ? Math.hypot(dot, cross) / norm : 1,
    cos = Math.cos(rotation),
    sin = Math.sin(rotation),
    place = (p) => ({
      x: tx + scale * ((p.x - mx) * cos - (p.y - my) * sin),
      y: ty + scale * ((p.x - mx) * sin + (p.y - my) * cos),
    });
  return {
    order,
    rotation,
    scale,
    // Where each drawn vertex ends up once the figure is corrected.  Indexed
    // like `points`, so the trace can ease straight from one to the other.
    ideal: (() => {
      const target = new Array(n);
      for (let star = 0; star < n; star++)
        target[order[star]] = place(model[star]);
      return target;
    })(),
    origin: place({ x: 0, y: 0 }),
  };
}
// Nearest template inside the tier. `score` is only a quality read for the
// ability to scale with — it never decides whether the constellation fires.
function classifyFigure(points) {
  const tier = FIGURE_SHAPES[points.length];
  if (!tier) return null;
  const cloud = figureNormalize(points);
  let best = null;
  for (const shape of tier) {
    const distance = figureMatch(cloud, shape.cloud);
    if (!best || distance < best.distance) best = { shape, distance };
  }
  return {
    ...best,
    score: Math.max(
      0,
      Math.min(
        1,
        (FIGURE.reject - best.distance) / (FIGURE.reject - FIGURE.perfect),
      ),
    ),
  };
}
/* --- what each constellation does --------------------------------------- */
// The bonus damage the figure used to deal unconditionally.  It is still the
// PLACEHOLDER every constellation runs, so behaviour is unchanged until each
// entry below is given its own ability.
function encloseDamage(ctx) {
  const caught = [];
  if (boss && boss.hp > 0 && ctx.covers(boss.x, boss.y, 66)) {
    const dealt = applyBossHit(ctx.bonus);
    if (dealt > 0) {
      addPopup(boss.x, boss.y - 92, "별자리 -" + dealt, "#ffd2a0", true);
      caught.push("공허 거상");
    }
  }
  for (const a of adds) {
    if (a.down > 0 || !ctx.covers(a.x, a.y, a.r)) continue;
    damageAdd(a, ctx.bonus, "별자리", "#ffd2a0");
    caught.push("공허 잔재");
  }
  return caught.length ? caught.length + "체 포위" : "포위 실패";
}
// How far off the shaft a target can stand and still be run through, on top of
// its own radius.  The meteor's own width, matching the two-point segment.
const FIGURE_PIERCE_WIDTH = 26;
// Seconds the fired line stays on the table, measured on the figure's clock.
const FIGURE_PIERCE_FADE = 0.5;
// 화살자리 · 관통 사격.  The arrow is the one constellation whose recognised
// geometry decides the outcome rather than just the label: the shaft flies on
// past the arrowhead to the table edge, and everything it crosses is hit.
// Enclosure is not required, so unlike `encloseDamage` it cannot come up empty
// on a figure that happens to surround nothing — a four-point ring is small,
// and the colossus is often just outside it.
//
// It fires along the CORRECTED arrow (`fit.ideal`), not the drawn one.  The
// reveal eases the vertices onto the skeleton before `cast` runs, so by the
// time the line is drawn the corrected arrow is the arrow on screen; using the
// drawn points would send the beam somewhere the player never saw.
function piercingShot(ctx) {
  const axis = ctx.shape?.axis,
    fit = ctx.fit;
  // No fit means no way to tell which vertex is the arrowhead, and a beam fired
  // in an arbitrary direction is worse than the plain effect.
  if (!axis || !fit) return encloseDamage(ctx);
  const from = fit.ideal[fit.order[axis[0]]],
    tip = fit.ideal[fit.order[axis[1]]];
  if (!from || !tip) return encloseDamage(ctx);
  const dx = tip.x - from.x,
    dy = tip.y - from.y,
    len = Math.hypot(dx, dy);
  if (!len) return encloseDamage(ctx);
  // One table diagonal past the nock always clears the far edge, whatever the
  // angle, so the beam never stops short inside the arena.
  const reach = Math.hypot(W, H),
    to = { x: from.x + (dx / len) * reach, y: from.y + (dy / len) * reach },
    crosses = (tx, ty, tr) =>
      distanceToSegment(tx, ty, from, to) <= tr + FIGURE_PIERCE_WIDTH;
  const run = [];
  if (boss && boss.hp > 0 && crosses(boss.x, boss.y, 66)) {
    const dealt = applyBossHit(ctx.bonus);
    if (dealt > 0) {
      addPopup(boss.x, boss.y - 92, "관통 -" + dealt, "#ffd2a0", true);
      run.push("공허 거상");
    }
  }
  for (const a of adds) {
    if (a.down > 0 || !crosses(a.x, a.y, a.r)) continue;
    damageAdd(a, ctx.bonus, "관통", "#ffd2a0");
    run.push("공허 잔재");
  }
  // The shot rides the figure's own clock, not `fieldFx`.  Field effects are
  // only advanced from inside `simulatePhysics`, which `modernUpdate` skips
  // once `ball.moving` is false — and a constellation casts at settle, exactly
  // when the meteor has stopped.  A beam pushed there would hang at full
  // opacity until the next launch.  `figureFx` is also where it belongs: it is
  // part of the reveal, and it is cleared with it at `FIGURE_END_AT`.
  //
  // On the flush path `figureFx` is the outgoing figure, so its beam is
  // dropped with it.  That is correct — the player has already launched again,
  // and the damage above has been paid.
  if (figureFx) figureFx.beam = { from, to, at: figureFx.t };
  return run.length ? run.length + "체 관통" : "빗나감";
}
// One entry per `FIGURE_SHAPES` id.  Replace them one at a time — the
// classification, the trace and the on-table label already tell the
// constellations apart, so an ability only has to decide what happens.
//
// An ability receives:
//   ctx.shape   the winning FIGURE_SHAPES entry (id, name, measured share)
//   ctx.ring    vertices in draw order
//   ctx.score   0..1 read of how cleanly the shape was drawn
//   ctx.covers  (x, y, radius) => whether that target sits inside the figure
//   ctx.bonus   FIGURE.bonusPerPoint × vertex count
//   ctx.fit     the alignment onto the skeleton, or null for a bare segment.
//               `fit.order[star]` is which drawn vertex stands on skeleton star
//               `star`, and `fit.ideal` is where the corrected figure puts each
//               one — together they are how an ability reads a named part of
//               the constellation, such as the arrow's shaft.
// and returns a short line for the toast, or nothing to stay quiet.
//
// Available without new assets: `applyBossHit`, `areaAttack`, `damageAdd`,
// `earnBlaze`, `addPopup`, `areaBursts`, `fieldFx`.  Anything needing dedicated
// art or SFX goes to ASSET_BACKLOG.md first.
const FIGURE_ABILITIES = {
  aries: encloseDamage, // 3점 · 한 샷당 19%
  sagitta: piercingShot, // 4점 · 11% — 화살대 방향 관통
  corvus: encloseDamage, // 4점 · 7%
  cassiopeia: encloseDamage, // 5점 · 8%
  cygnus: encloseDamage, // 5점 · 5% — 버프 예정
  pentagram: encloseDamage, // 5점 · 2% — 최상급 예정
  orion: encloseDamage, // 6점 · 출현 비율 측정 전
  bigdipper: encloseDamage, // 7점 · 출현 비율 측정 전
};
/* --- settlement --------------------------------------------------------- */
// Nothing stops the player launching again while a figure is still revealing,
// and the next settle replaces `figureFx` wholesale.  Any effect still waiting
// on that clock has to be paid out first, or a fast player silently loses it.
function flushPendingFigure() {
  const pending = figureFx?.cast;
  if (!pending) return;
  figureFx.cast = null;
  pending();
}
function resolveFigure(points) {
  if (!figureActive() || battleComplete) return;
  if (!points || points.length < FIGURE_PARRY.minNodes) return;
  flushPendingFigure();
  const ring = figureRing(points),
    segment = ring.length === 2,
    // Two points have no area, so the line itself is the effect: anything
    // within a meteor's width of it counts as crossed.
    covers = (tx, ty, tr) =>
      segment
        ? distanceToSegment(tx, ty, ring[0], ring[1]) <= tr + 26
        : pointInPolygon(tx, ty, ring),
    bonus = FIGURE.bonusPerPoint * ring.length;
  // Two points are a line, not a constellation, so they keep the plain effect.
  const match = segment ? null : classifyFigure(points);
  // The fit is resolved before the context because abilities read it too, not
  // just the trace: it is the only thing that says which vertex is the arrow's
  // head rather than its nock.
  const fit = match ? figureFit(points, match.shape) : null;
  const ctx = {
    shape: match?.shape ?? null,
    ring,
    segment,
    score: match?.score ?? 0,
    covers,
    bonus,
    fit,
  };
  const rune = match?.shape.id === "pentagram";
  figureFx = {
    ring,
    segment,
    shape: match?.shape ?? null,
    rune,
    fit,
    // Where each vertex sits now, and where the correction eases it to.  The
    // starkeepers themselves never move; only the drawn figure is corrected.
    drawn: points,
    ideal: fit?.ideal ?? points,
    edgeIndex: match
      ? match.shape.edges.map(([a, b]) => [fit.order[a], fit.order[b]])
      : [[points.indexOf(ring[0]), points.indexOf(ring[1])]],
    score: ctx.score,
    distance: match?.distance ?? Infinity,
    // The effect waits for the silhouette: the figure has to finish arriving
    // before it is allowed to mean anything.  `cast` runs it exactly once.
    cast: () => {
      const line = (
        match
          ? (FIGURE_ABILITIES[match.shape.id] ?? encloseDamage)
          : encloseDamage
      )(ctx);
      if (match) toast(match.shape.name + (line ? " · " + line : ""));
      else if (line) toast("별자리 선 · " + line);
    },
    t: 0,
  };
  // A segment has no constellation to correct or reveal, so it fires at once.
  if (!match) {
    figureFx.cast();
    figureFx.cast = null;
  }
}
const figureSettleParty = settleParty;
settleParty = function () {
  // Every combat resolves this shot's starlight nodes instead of judging where
  // the moving bodies happened to rest. Normal settle awakenings stay muted so
  // they cannot hide the constellation reveal.
  if (figureActive()) finishFigureShot();
  else figureSettleParty();
};
/* --- the beats after the trace ------------------------------------------ */
// One clock, read the same way by the update hook and the draw hook.
const FIGURE_CORRECT_AT = FIGURE.drawTime,
  FIGURE_REVEAL_AT = FIGURE.drawTime + FIGURE.correctTime + FIGURE.revealDelay,
  FIGURE_CAST_AT = FIGURE_REVEAL_AT + FIGURE.castDelay,
  FIGURE_HOLD_AT = FIGURE_REVEAL_AT + FIGURE.revealTime,
  FIGURE_END_AT = FIGURE_HOLD_AT + FIGURE.holdTime + FIGURE.fadeTime;
const easeInOut = (t) =>
  t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
// 0 while the figure is still crooked, 1 once it has settled onto its skeleton.
function figureCorrection(t) {
  if (!FIGURE.correctTime) return 1;
  return easeInOut(
    Math.max(0, Math.min(1, (t - FIGURE_CORRECT_AT) / FIGURE.correctTime)),
  );
}
// The shot preview is intentionally raw: its stars stay at the contact
// positions until the table settles. Only the resolved constellation is
// corrected into the chosen sky skeleton.
registerRuntimeHook("afterDraw", function drawFigureShot() {
  if (!figureActive()) return;
  const state = currentFigureShot(),
    nodes = state.nodes;
  if (state.parry > 0 || state.flash > 0) {
    const pulse = state.parry > 0 ? 1 : state.flash / 0.44;
    x.save();
    x.globalAlpha = 0.38 + pulse * 0.45;
    x.strokeStyle = "#fff1bd";
    x.lineWidth = 2.5;
    x.shadowBlur = 18;
    x.shadowColor = "#ffd27f";
    x.beginPath();
    x.arc(ball.x, ball.y, ball.r + 13 + pulse * 5, 0, Math.PI * 2);
    x.stroke();
    x.restore();
  }
  if (!nodes.length) return;
  const match =
      nodes.length >= FIGURE_PARRY.minNodes ? classifyFigure(nodes) : null,
    fit = match ? figureFit(nodes, match.shape) : null,
    edges = match
      ? match.shape.edges.map(([a, b]) => [
          nodes[fit.order[a]],
          nodes[fit.order[b]],
        ])
      : nodes.slice(1).map((node, i) => [nodes[i], node]);
  x.save();
  x.globalAlpha = 0.4;
  x.strokeStyle = "#9adfc9";
  x.lineWidth = 2;
  x.setLineDash([5, 6]);
  x.shadowBlur = 13;
  x.shadowColor = "#9adfc9";
  for (const [from, to] of edges) {
    x.beginPath();
    x.moveTo(from.x, from.y);
    x.lineTo(to.x, to.y);
    x.stroke();
  }
  x.setLineDash([]);
  for (const node of nodes) {
    x.fillStyle = node.col || "#dff3ea";
    x.beginPath();
    x.arc(node.x, node.y, 5, 0, Math.PI * 2);
    x.fill();
  }
  x.globalAlpha = 0.9;
  x.fillStyle = "#fff3d6";
  x.textAlign = "center";
  x.font = "bold 12px ui-monospace";
  const label =
    "별빛 " +
    nodes.length +
    "/" +
    FIGURE_PARRY.maxNodes +
    (match ? " · " + match.shape.name : " · 3점부터 발동");
  x.fillText(label, ball.x, ball.y - ball.r - 25);
  x.restore();
});
/* --- drawing (RuneCast RuneTracer: wide faint glow + thin bright core) --- */
registerRuntimeHook("afterFeedbackUpdate", function advanceFigureFx(d) {
  advanceFigureShot(d);
  if (!figureFx) return;
  figureFx.t += d;
  // The pentagram pays off once the corrected star is standing, not at the
  // settle that queued it: the figure has to arrive before the burst means
  // anything.
  if (figureFx.rune && !figureFx.burst && figureFx.t >= FIGURE_REVEAL_AT) {
    figureFx.burst = true;
    const c = figureFx.fit?.origin ?? figureCentroid(figureFx.ring);
    areaBursts.push({ x: c.x, y: c.y, r: 210, col: "#ffe6b0", t: 0, d: 0.62 });
    areaBursts.push({ x: c.x, y: c.y, r: 128, col: "#fff6e0", t: 0, d: 0.44 });
    screenFlash = Math.max(screenFlash, 0.42);
    screenShake = Math.max(screenShake, 14);
    combatSfx?.("unlock", 1);
  }
  // The ability lands after the creature has shown itself, so the constellation
  // reads as the cause and not as decoration over damage that already happened.
  if (figureFx.cast && figureFx.t >= FIGURE_CAST_AT) {
    const cast = figureFx.cast;
    figureFx.cast = null;
    combatSfx?.("unlock", figureFx.rune ? 1 : 0.7);
    cast();
  }
  if (figureFx.t > FIGURE_END_AT) figureFx = null;
});
registerRuntimeHook("afterDraw", function drawFigure() {
  if (!figureFx) return;
  // The arrow's shot, under everything else so the figure that fired it still
  // reads on top.
  if (figureFx.beam) {
    const life = Math.max(
      0,
      1 - (figureFx.t - figureFx.beam.at) / FIGURE_PIERCE_FADE,
    );
    if (life > 0) {
      x.save();
      x.globalAlpha = life;
      x.strokeStyle = "#ffd2a0";
      x.shadowBlur = 16;
      x.shadowColor = "#ffd2a0";
      x.lineWidth = 2 + life * 5;
      x.beginPath();
      x.moveTo(figureFx.beam.from.x, figureFx.beam.from.y);
      x.lineTo(figureFx.beam.to.x, figureFx.beam.to.y);
      x.stroke();
      x.restore();
    }
  }
  // Vertices ease from where the starkeepers actually stopped onto the fitted
  // skeleton.  Only the drawing moves — the units stay exactly where they are,
  // because the next shot tees off from the meteor's real resting place.
  const settle = figureCorrection(figureFx.t),
    live = figureFx.drawn.map((p, i) => {
      const to = figureFx.ideal[i];
      return {
        x: p.x + (to.x - p.x) * settle,
        y: p.y + (to.y - p.y) * settle,
        col: p.col,
      };
    }),
    edges = figureFx.edgeIndex.map(([a, b]) => [live[a], live[b]]),
    total = edges.length,
    grow = Math.min(1, figureFx.t / FIGURE.drawTime),
    fade =
      figureFx.t < FIGURE_HOLD_AT + FIGURE.holdTime
        ? 1
        : Math.max(
            0,
            1 -
              (figureFx.t - FIGURE_HOLD_AT - FIGURE.holdTime) / FIGURE.fadeTime,
          ),
    // Warm only for the pentagram.  Every other constellation now fires too,
    // so colour has to stay reserved for the rare one or it stops meaning
    // anything.
    tint = figureFx.rune ? "#ffd2a0" : "#9adfc9";
  // The creature itself, underneath its own lines.  It rides the same fitted
  // transform as the corrected skeleton, so it can never drift off the figure,
  // and it stays faint enough that the trace and the stars still read first.
  const art = figureFx.shape?.art && textures[figureFx.shape.art];
  if (art?.complete && art.naturalWidth && figureFx.t >= FIGURE_REVEAL_AT) {
    const reveal = Math.min(
        1,
        (figureFx.t - FIGURE_REVEAL_AT) / FIGURE.revealTime,
      ),
      fit = figureFx.fit,
      size = FIGURE_ART_SIZE * (fit.scale / FIGURE_ART_UNIT);
    x.save();
    x.globalAlpha = FIGURE.silhouetteAlpha * reveal * fade;
    x.translate(fit.origin.x, fit.origin.y);
    x.rotate(fit.rotation);
    x.drawImage(art, -size / 2, -size / 2, size, size);
    x.restore();
  }
  // Traced edge by edge so the moment reads as being drawn, the way RuneCast
  // animates a rune instead of popping it in finished.  Each edge is its own
  // sub-path: the constellation's lines are not one continuous stroke — Cygnus
  // runs four separate lines through the same hub — so they must not be joined.
  const stroke = (width, alpha, colour, blur) => {
    x.save();
    x.globalAlpha = alpha * fade;
    x.strokeStyle = colour;
    x.lineWidth = width;
    x.lineCap = "round";
    x.lineJoin = "round";
    x.shadowBlur = blur;
    x.shadowColor = tint;
    x.beginPath();
    const drawn = total * grow;
    for (let i = 0; i < total; i++) {
      const [from, to] = edges[i],
        span = Math.max(0, Math.min(1, drawn - i));
      if (span <= 0) break;
      x.moveTo(from.x, from.y);
      x.lineTo(
        from.x + (to.x - from.x) * span,
        from.y + (to.y - from.y) * span,
      );
    }
    x.stroke();
    x.restore();
  };
  // The pentagram keeps the whole flourish, so completing one never looks like
  // an ordinary constellation in a warmer colour.
  const rune = Boolean(figureFx.rune),
    centre = figureCentroid(live),
    // Settles to 1 over the trace, then breathes.  One clock drives the wash,
    // the rays and the vertex haloes so the sign pulses as a single object.
    pulse = rune
      ? 0.72 + 0.28 * Math.sin(figureFx.t * 3.1) * Math.min(1, grow)
      : 1;
  if (rune && grow > 0.05) {
    // The star's own outline, filled: nonzero winding lights the five spikes
    // and the pentagon they enclose, which is the shape people picture.
    x.save();
    x.globalAlpha = 0.13 * fade * pulse * grow;
    x.fillStyle = "#ffcf8a";
    x.beginPath();
    x.moveTo(edges[0][0].x, edges[0][0].y);
    for (const [, to] of edges) x.lineTo(to.x, to.y);
    x.closePath();
    x.fill();
    x.restore();
  }
  if (rune && grow >= 1) {
    // Rays only after the last edge lands, so the trace stays readable while
    // it is still being drawn.
    x.save();
    x.globalAlpha = 0.5 * fade * pulse;
    x.strokeStyle = "#ffe6b0";
    x.lineWidth = 2;
    x.shadowBlur = 12;
    x.shadowColor = "#ffcf8a";
    for (let i = 0; i < 12; i++) {
      const a = figureFx.t * 0.5 + (i * Math.PI) / 6,
        inner = 26 + pulse * 8,
        outer = inner + 20 + (i % 2 ? 12 : 0);
      x.beginPath();
      x.moveTo(centre.x + Math.cos(a) * inner, centre.y + Math.sin(a) * inner);
      x.lineTo(centre.x + Math.cos(a) * outer, centre.y + Math.sin(a) * outer);
      x.stroke();
    }
    x.restore();
  }
  stroke(rune ? 17 : 13, rune ? 0.38 : 0.3, tint, rune ? 32 : 26);
  stroke(rune ? 4 : 3, 0.95, "#fff6e6", rune ? 14 : 10);
  // Each vertex blooms as the trace reaches it, so the stars light in the order
  // the lines visit them instead of all at once.  A hub the figure passes
  // through more than once — Cygnus's Sadr — lights on its first visit.
  const drawn = total * grow,
    reachedAt = new Map();
  edges.forEach(([from, to], i) => {
    if (!reachedAt.has(from)) reachedAt.set(from, i);
    if (!reachedAt.has(to)) reachedAt.set(to, i + 1);
  });
  for (const p of live) {
    const bloom = Math.max(
      0,
      Math.min(1, (drawn - (reachedAt.get(p) ?? 0)) / 0.7),
    );
    if (bloom <= 0) continue;
    x.save();
    x.globalAlpha = fade;
    x.fillStyle = p.col || tint;
    x.shadowBlur = 14 + (rune ? bloom * 16 * pulse : 0);
    x.shadowColor = p.col || tint;
    x.beginPath();
    x.arc(p.x, p.y, 5 + (rune ? bloom * 3 * pulse : 0), 0, Math.PI * 2);
    x.fill();
    x.restore();
  }
  // Naming the constellation is the whole point now that one always lands:
  // the player has to be able to read which ability just fired.
  if (figureFx.shape && grow >= 1) {
    x.save();
    x.globalAlpha = fade;
    x.textAlign = "center";
    x.shadowBlur = rune ? 12 : 8;
    x.shadowColor = rune ? "#c97a45" : "#1d3b36";
    x.fillStyle = rune ? "#fff3d6" : "#dff3ea";
    x.font = "bold " + (rune ? 22 : 15) + "px ui-monospace";
    x.fillText(figureFx.shape.name, centre.x, centre.y - (rune ? 4 : 1));
    if (rune) {
      x.fillStyle = "#ffd2a0";
      x.font = "bold 12px ui-monospace";
      x.fillText(
        "정확도 " + Math.round(figureFx.score * 100) + "%",
        centre.x,
        centre.y + 14,
      );
    }
    x.restore();
  }
});
/* --- the training table seats four, so the meteor makes a fifth point ------
 * The fourth seat is a real party slot now: the stage carries four `slots` and
 * `partySlotCount()` opens the roster to four there, so startShot builds and
 * primes all four the same way it does the other stages' three. This block used
 * to push a spare starkeeper on after setupBattle had already run, which left
 * it without unitTrail and threw on the first frame of the first shot. */
