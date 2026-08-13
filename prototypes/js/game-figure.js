// --- Constellation figure prototype ---------------------------------------
// Training-table experiment, kept in its own file so it can be adopted or
// deleted in one move.  Loads after game-combat.js because it wraps
// `settleParty` and reads `applyBossHit`, `figureCentroid`'s neighbours and
// the runtime hook registry, all of which that file establishes first.
//
// --- Constellation figure prototype (training table only, 2026-08-13) ------
// When the table settles, the meteor and every awakened starkeeper become the
// vertices of a figure.  Two points draw a segment, three or more a polygon,
// and whatever the figure encloses (or the segment crosses) takes bonus
// damage.  A five-point figure is additionally run through a point-cloud
// recogniser against one pentagram template; a close match plays the
// completion draw.  Campaign battles never see any of this.
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
  // A campaign version of this will want a stricter number than a bench does.
  reject: 0.19,
  perfect: 0.04,
  bonusPerPoint: 14, // damage per enclosed target, per figure vertex
  // Five seconds end to end, with the trace itself slow enough to watch being
  // drawn.  At 0.55/0.9/0.45 the whole thing was over before the settle
  // slow-motion finished, so it read as "nothing drew".
  drawTime: 1.4,
  holdTime: 2.6,
  fadeTime: 1,
};
let figureFx = null;
function figureActive() {
  return Boolean(battle?.training);
}
// Vertices are the meteor plus the starkeepers that actually rolled, which is
// the same "awakened" test the settle attacks use.
function figureVertices() {
  const points = gates
    .filter((g) => g.moved && g.travel > 10)
    .map((g) => ({ x: g.x, y: g.y, col: g.col, label: g.s }));
  if (ball)
    points.push({ x: ball.x, y: ball.y, col: "#ffd2a0", label: "유성" });
  return points;
}
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
const PENTAGRAM_TEMPLATE = figureNormalize(
  Array.from({ length: 5 }, (_, i) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
    return { x: Math.cos(a), y: Math.sin(a) };
  }),
);
function recognizePentagram(points) {
  if (points.length !== 5) return { score: 0, distance: Infinity };
  const distance = figureMatch(figureNormalize(points), PENTAGRAM_TEMPLATE);
  return {
    distance,
    score: Math.max(
      0,
      Math.min(
        1,
        (FIGURE.reject - distance) / (FIGURE.reject - FIGURE.perfect),
      ),
    ),
  };
}
/* --- settlement --------------------------------------------------------- */
function resolveFigure() {
  if (!figureActive() || battleComplete) return;
  const points = figureVertices();
  if (points.length < 2) return;
  const ring = figureRing(points),
    segment = ring.length === 2,
    // Two points have no area, so the line itself is the effect: anything
    // within a meteor's width of it counts as crossed.
    covers = (tx, ty, tr) =>
      segment
        ? distanceToSegment(tx, ty, ring[0], ring[1]) <= tr + 26
        : pointInPolygon(tx, ty, ring),
    bonus = FIGURE.bonusPerPoint * ring.length;
  const caught = [];
  if (boss && boss.hp > 0 && covers(boss.x, boss.y, 66)) {
    const dealt = applyBossHit(bonus);
    if (dealt > 0) {
      addPopup(boss.x, boss.y - 92, "별자리 -" + dealt, "#ffd2a0", true);
      caught.push("공허 거상");
    }
  }
  for (const a of adds) {
    if (a.down > 0 || !covers(a.x, a.y, a.r)) continue;
    damageAdd(a, bonus, "별자리", "#ffd2a0");
    caught.push("공허 잔재");
  }
  const rune = recognizePentagram(points);
  figureFx = {
    ring,
    segment,
    star: rune.score > 0 ? figureStarOrder(ring) : null,
    score: rune.score,
    distance: rune.distance,
    t: 0,
  };
  if (rune.score > 0) {
    earnBlaze(
      1 + rune.score * 2,
      "오망성 완성 " + Math.round(rune.score * 100) + "%",
    );
    toast("오망성 완성 · 정확도 " + Math.round(rune.score * 100) + "%");
    combatSfx?.("unlock", 0.9);
    screenShake = Math.max(screenShake, 12);
  } else if (caught.length) {
    toast("별자리 " + ring.length + "각 · " + caught.length + "체 포위");
  }
}
// A pentagram is the same five points as a pentagon; only the connection order
// differs, so the star is drawn by stepping two vertices at a time.
function figureStarOrder(ring) {
  if (ring.length !== 5) return null;
  const order = [];
  for (let i = 0, k = 0; i < 5; i++, k = (k + 2) % 5) order.push(ring[k]);
  return order;
}
const figureSettleParty = settleParty;
settleParty = function () {
  // Prototype: the training table judges the figure on its own, so the settle
  // awakenings are muted there.  Their damage, slow-motion and flash were
  // burying the figure that shares the same beat, which is why it read as
  // never being drawn.  Campaign settles are untouched.
  if (!figureActive()) figureSettleParty();
  resolveFigure();
};
/* --- drawing (RuneCast RuneTracer: wide faint glow + thin bright core) --- */
registerRuntimeHook("afterFeedbackUpdate", function advanceFigureFx(d) {
  if (!figureFx) return;
  figureFx.t += d;
  // The pentagram pays off on the frame the last edge lands, not at the settle
  // that queued it: the trace has to arrive before the burst means anything.
  if (figureFx.star && !figureFx.burst && figureFx.t >= FIGURE.drawTime) {
    figureFx.burst = true;
    const c = figureCentroid(figureFx.star);
    areaBursts.push({ x: c.x, y: c.y, r: 210, col: "#ffe6b0", t: 0, d: 0.62 });
    areaBursts.push({ x: c.x, y: c.y, r: 128, col: "#fff6e0", t: 0, d: 0.44 });
    screenFlash = Math.max(screenFlash, 0.42);
    screenShake = Math.max(screenShake, 14);
    combatSfx?.("unlock", 1);
  }
  if (figureFx.t > FIGURE.drawTime + FIGURE.holdTime + FIGURE.fadeTime)
    figureFx = null;
});
registerRuntimeHook("afterDraw", function drawFigure() {
  if (!figureFx) return;
  const path = figureFx.star || figureFx.ring,
    closed = !figureFx.segment,
    total = closed ? path.length : path.length - 1,
    grow = Math.min(1, figureFx.t / FIGURE.drawTime),
    fade =
      figureFx.t < FIGURE.drawTime + FIGURE.holdTime
        ? 1
        : Math.max(
            0,
            1 -
              (figureFx.t - FIGURE.drawTime - FIGURE.holdTime) /
                FIGURE.fadeTime,
          ),
    tint = figureFx.score > 0 ? "#ffd2a0" : "#9adfc9";
  // The figure is traced edge by edge so the moment reads as being drawn, the
  // way RuneCast animates a rune instead of popping it in finished.
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
    x.moveTo(path[0].x, path[0].y);
    const drawn = total * grow;
    for (let i = 0; i < total; i++) {
      const from = path[i],
        to = path[(i + 1) % path.length],
        span = Math.max(0, Math.min(1, drawn - i));
      if (span <= 0) break;
      x.lineTo(
        from.x + (to.x - from.x) * span,
        from.y + (to.y - from.y) * span,
      );
    }
    x.stroke();
    x.restore();
  };
  // A recognised pentagram is drawn as the star itself — `figureStarOrder`
  // already reorders the same five points — and gets the whole flourish, so
  // completing one never looks like an ordinary polygon in a warmer colour.
  const rune = Boolean(figureFx.star),
    centre = figureCentroid(path),
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
    x.moveTo(path[0].x, path[0].y);
    for (let i = 1; i < path.length; i++) x.lineTo(path[i].x, path[i].y);
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
  // Each vertex blooms as the trace reaches it, so the five stars light in the
  // order the line visits them instead of all at once.
  const drawn = total * grow;
  path.forEach((p, i) => {
    const bloom = rune ? Math.max(0, Math.min(1, (drawn - i) / 0.7)) : 1;
    if (bloom <= 0) return;
    x.save();
    x.globalAlpha = fade;
    x.fillStyle = p.col || tint;
    x.shadowBlur = 14 + (rune ? bloom * 16 * pulse : 0);
    x.shadowColor = p.col || tint;
    x.beginPath();
    x.arc(p.x, p.y, 5 + (rune ? bloom * 3 * pulse : 0), 0, Math.PI * 2);
    x.fill();
    x.restore();
  });
  if (rune && grow >= 1) {
    x.save();
    x.globalAlpha = fade;
    x.textAlign = "center";
    x.shadowBlur = 12;
    x.shadowColor = "#c97a45";
    x.fillStyle = "#fff3d6";
    x.font = "bold 22px ui-monospace";
    x.fillText("오망성", centre.x, centre.y - 4);
    x.fillStyle = "#ffd2a0";
    x.font = "bold 12px ui-monospace";
    x.fillText(
      "정확도 " + Math.round(figureFx.score * 100) + "%",
      centre.x,
      centre.y + 14,
    );
    x.restore();
  }
});
/* --- the training table seats four, so the meteor makes a fifth point ------
 * The fourth seat is a real party slot now: the stage carries four `slots` and
 * `partySlotCount()` opens the roster to four there, so startShot builds and
 * primes all four the same way it does the campaign's three.  This block used
 * to push a spare starkeeper on after setupBattle had already run, which left
 * it without unitTrail and threw on the first frame of the first shot. */
