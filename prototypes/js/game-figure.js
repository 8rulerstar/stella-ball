/* Constellation abilities, deferred settlement, correction, and reveal. */
/* --- what each constellation does --------------------------------------- */
// The bonus damage the figure used to deal unconditionally.  It is still the
// PLACEHOLDER every constellation runs, so behaviour is unchanged until each
// entry below is given its own ability.
// The payout every constellation makes, wherever anything happens to stand.
//
// Position used to decide this: the drawn figure had to enclose a target for
// the damage to land.  That made the most common outcome "포위 실패" and zero,
// because a three- or four-point ring is small and the colossus is usually
// outside it — a constellation could be recognised, named, drawn and revealed
// and then pay nothing.  The figure is earned by the parries that built it, so
// it now always pays, and what each constellation adds on top is what tells
// them apart.
function figureFieldDamage(ctx, label = "별자리") {
  // Same guard areaAttack opens with. A constellation casts on its own clock
  // roughly 2.85s after the settle that queued it, and nothing stopped that
  // clock when the battle ended - so a figure could damage, pop numbers over
  // and even kill a colossus during the victory cutscene, or after a loss.
  if (battleComplete) return 0;
  const hit = [];
  if (boss && boss.hp > 0) {
    const dealt = applyBossHit(ctx.bonus);
    if (dealt > 0) {
      addPopup(boss.x, boss.y - 92, label + " -" + dealt, "#ffd2a0", true);
      hit.push(bossDisplayName());
    }
  }
  for (const a of adds) {
    if (a.down > 0) continue;
    damageAdd(a, ctx.bonus, label, "#ffd2a0");
    hit.push("공허 잔재");
  }
  areaBursts.push({
    x: boss?.x ?? W / 2,
    y: boss?.y ?? H / 2,
    r: 230,
    col: "#ffd2a0",
    t: 0,
    d: 0.5,
  });
  if (boss && boss.hp <= 0) scheduleWin();
  return hit.length;
}
// Kept as the plain baseline: the tier that adds nothing of its own.
function encloseDamage(ctx) {
  const hit = figureFieldDamage(ctx);
  return hit ? hit + "체 타격" : "피해 없음";
}
/* --- effects that land on the next shot --------------------------------- */
// The shot lifecycle builds a fresh `ball`, so a constellation cannot simply write its
// promise onto the current one and expect it to survive the settle.  These are
// held here instead and applied by the wrapper below, once, on the next shot.
let figureBoon = null;
function grantFigureBoon(boon) {
  /* Timing matters here. A constellation casts on the reveal's clock, roughly
     2.85s after the settle that queued it - and on the ordinary path (any
     settle with meteors left) finalizeBilliardShot has already called
     startShot synchronously at that settle, so `afterShotStart` fired long
     before this runs. Queuing the boon for the NEXT afterShotStart therefore
     skipped a shot: the mark the player earned landed on the meteor after the
     one they were about to fire.

     If the promised meteor is teed up and still waiting, hand the boon to it
     directly. Only fall back to the queue when there is no such ball - the
     deferred last-shot path, where the next shot has genuinely not been built
     yet. */
  const pending = { ...(figureBoon || {}), ...boon };
  if (ball && !ball.moving && !battleComplete) {
    applyFigureBoon(pending);
    return;
  }
  figureBoon = pending;
}
function applyFigureBoon(boon) {
  if (!boon || !ball) return;
  if (boon.mark) {
    ball.mark = true;
    toast("까마귀의 표식 · 이번 샷의 약점 명중이 강해집니다");
  }
  if (boon.glide) {
    ball.glide = boon.glide;
    toast("백조의 비행 · 이번 샷은 유성이 오래 굽니다");
  }
  if (boon.aim) {
    ball.trueAim = true;
    toast("북두의 길잡이 · 이번 샷은 항로가 끝까지 보입니다");
  }
}
/* A boon is owed to the next shot OF THIS BATTLE. Without this it was a plain
   module global that nothing reset, so a constellation resolved on the last
   shot of one fight paid its mark/glide/true-aim into the opening meteor of
   the next one, toast and all - a reward collected in a battle where it was
   never earned. figureFx is battle-tagged for the same reason; this is the
   one piece of the figure system that was not. */
registerRuntimeHook("afterBattleSetup", () => {
  figureBoon = null;
  figureFx = null;
});
registerRuntimeHook("afterShotStart", () => {
  if (!figureBoon || !ball) return;
  applyFigureBoon(figureBoon);
  figureBoon = null;
});
// How far off the shaft a target can stand and still be run through, on top of
// its own radius.  The meteor's own width, matching the two-point segment.
const FIGURE_PIERCE_WIDTH = 26;
// Cygnus' coast, as a multiplier on the friction the meteor sheds each frame.
// Measured on a fixed shot: the ordinary run covers 1117px over 4.1 seconds,
// and this keeps roughly half again as much — 1744px over 5.6.  The first
// attempt used 0.35 and produced 4026px over 13.1 seconds, which is not a
// longer shot but a different game, so the value is deliberately shy.
const FIGURE_GLIDE = 0.85;
// Refunds per battle. One is a reward; unbounded is a battle that cannot end.
const FIGURE_REFUND_LIMIT = 1;
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
  // The field damage lands first, as it does for every constellation.  The
  // shaft is what the arrow adds: a second helping for anything standing on the
  // line, so pointing the arrowhead at the colossus is worth doing and pointing
  // it away is not.
  figureFieldDamage(ctx);
  const run = [];
  if (boss && boss.hp > 0 && crosses(boss.x, boss.y, 66)) {
    const dealt = applyBossHit(ctx.bonus);
    if (dealt > 0) {
      addPopup(boss.x, boss.y - 92, "관통 -" + dealt, "#ffd2a0", true);
      run.push(bossDisplayName());
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
  return run.length ? run.length + "체 관통" : "화살은 빗나감";
}
// 까마귀자리 · 약점 노출.  The crow that lied to Apollo and was left thirsty;
// here it goes ahead and marks what to aim for.  The payout is deliberately not
// damage — it lands on the NEXT shot, so a four-point figure is worth building
// even when the colossus is already low.
function markWeakpoint(ctx) {
  const hit = figureFieldDamage(ctx, "까마귀");
  grantFigureBoon({ mark: true });
  return hit ? hit + "체 타격 · 다음 샷 표식" : "다음 샷 표식";
}
// 카시오페이아 · 껍질 파괴.  The queen chained to her throne, so the
// constellation that answers being held: it takes every layer off at once.
// "껍질이 막았다" is a real dead end — the shield eats a whole hit and returns
// zero — and this is the one thing in the game that clears it outright.
function breakShell(ctx) {
  const layers = bossShield?.hits ?? 0;
  if (layers > 0) {
    bossShield.hits = 0;
    bossShield.flash = 0.6;
    areaBursts.push({
      x: boss.x,
      y: boss.y,
      r: 150,
      col: "#9adfc9",
      t: 0,
      d: 0.5,
    });
    addPopup(
      boss.x,
      boss.y - 66,
      "껍질 " + layers + "겹 파괴",
      "#9adfc9",
      true,
    );
    combatSfx?.("unlock", 0.9);
  }
  const hit = figureFieldDamage(ctx, "카시오페이아");
  return layers > 0
    ? "껍질 " + layers + "겹 파괴"
    : hit
      ? hit + "체 타격"
      : "깨뜨릴 껍질 없음";
}
// 백조자리 · 비행.  The only one that pays in future opportunity rather than in
// damage: a longer coast is more contacts, and more contacts is a bigger figure
// next time.  It is the single compounding entry in the set.
function grantGlide(ctx) {
  const hit = figureFieldDamage(ctx, "백조");
  grantFigureBoon({ glide: FIGURE_GLIDE });
  return hit ? hit + "체 타격 · 다음 샷 비행" : "다음 샷 비행";
}
// 오망성 · 전원 각성.  Not a constellation but a rune, and the only entry that
// touches the party rather than the colossus: every starkeeper wakes where it
// stands, whatever it did or did not do this shot.
function wakeEveryone(ctx) {
  const hit = figureFieldDamage(ctx, "오망성");
  let woken = 0;
  for (const g of gates) {
    if (g.awake) continue;
    wakeUnit(g);
    woken += 1;
  }
  if (woken) {
    screenFlash = Math.max(screenFlash, 0.36);
    combatSfx?.("unlock", 1);
  }
  return woken
    ? woken + "명 각성"
    : hit
      ? hit + "체 타격 · 전원 이미 각성"
      : "전원 이미 각성";
}
// 오리온자리 · 삼연격 처형.  The hunter, and the belt of three.  The first two
// strikes are flat; the third is the execution, scaling with how much health
// the colossus has already lost, so six points pays most when it finishes a
// fight rather than when it opens one.
function huntersVolley(ctx) {
  figureFieldDamage(ctx, "오리온");
  if (!boss || boss.hp <= 0) return "사냥할 표적 없음";
  const belt = Math.round(ctx.bonus * 0.5);
  let total = 0;
  for (let i = 0; i < 2; i++) total += applyBossHit(belt);
  // The finisher reads the wound, not the health bar: at full health it is the
  // same as a belt strike, and at a sliver it is worth three of them.
  const missing = boss.maxHp > 0 ? 1 - boss.hp / boss.maxHp : 0,
    finisher = Math.round(ctx.bonus * (0.6 + missing * 1.6));
  total += applyBossHit(finisher);
  if (total > 0) {
    addPopup(boss.x, boss.y - 92, "삼연격 -" + total, "#ffd2a0", true);
    areaBursts.push({
      x: boss.x,
      y: boss.y,
      r: 170,
      col: "#ffd2a0",
      t: 0,
      d: 0.52,
    });
    screenShake = Math.max(screenShake, 11);
  }
  if (boss.hp <= 0) scheduleWin();
  return "삼연격 -" + total;
}
// 북두칠성 · 되찾은 한 발.  Seven points is the top of the ladder and pays in
// tempo rather than damage: the ladle scoops a shot back, and the pole star it
// points at shows the way for the one after.  Capped per battle, because a
// refund that can refund itself is not a reward, it is an unlimited game.
function polestarBoon(ctx) {
  const hit = figureFieldDamage(ctx, "북두칠성");
  grantFigureBoon({ aim: true });
  const state = currentFigureShot();
  if ((state.refunds || 0) >= FIGURE_REFUND_LIMIT)
    return hit ? hit + "체 타격 · 되돌릴 발사 없음" : "되돌릴 발사 없음";
  state.refunds = (state.refunds || 0) + 1;
  battle.shots += 1;
  sync();
  addPopup(ball.x, ball.y - 58, "유성 +1", "#fff1bd", true);
  return "유성 +1 · 다음 샷 항로";
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
// Measured shares, from feeding uniform random scatter through the recogniser
// 200 times per tier — not the old settle-position numbers, which were taken
// under a model that no longer exists and had the pentagram at 2%.
const FIGURE_ABILITIES = {
  aries: encloseDamage, // 3점 · 3점의 100% — 기준선
  sagitta: piercingShot, // 4점 · 4점의 55% — 화살대 방향 이중 타격
  corvus: markWeakpoint, // 4점 · 4점의 45% — 다음 샷 약점 표식
  cassiopeia: breakShell, // 5점 · 5점의 54% — 굳은 껍질 전 겹 파괴
  cygnus: grantGlide, // 5점 · 5점의 35% — 다음 샷 비행
  pentagram: wakeEveryone, // 5점 · 5점의 12% — 전원 각성
  orion: huntersVolley, // 6점 · 6점의 100% — 삼연격 처형
  bigdipper: polestarBoon, // 7점 · 7점의 100% — 유성 +1 · 다음 샷 항로
};
/* --- settlement --------------------------------------------------------- */
// Nothing stops the player launching again while a figure is still revealing,
// and the next settle replaces `figureFx` wholesale.  Any effect still waiting
// on that clock has to be paid out first, or a fast player silently loses it.
function flushPendingFigure() {
  const active = figureFx,
    pending = active?.cast;
  if (!pending) return;
  active.cast = null;
  pending();
  const afterCast = active.afterCast;
  active.afterCast = null;
  afterCast?.();
}
function isFigureResolutionPending() {
  return Boolean(figureFx?.cast && figureFx.battle === battle);
}
function deferFigureResolution(afterCast) {
  if (!isFigureResolutionPending() || typeof afterCast !== "function")
    return false;
  figureFx.afterCast = afterCast;
  return true;
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
    battle,
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
registerRuntimeHook(
  "beforePartySettle",
  (context) => {
    // Every combat resolves this shot's starlight nodes instead of judging where
    // the moving bodies happened to rest. Normal settle awakenings stay muted so
    // they cannot hide the constellation reveal.
    //
    // `handled` must follow whether a constellation ACTUALLY resolved, not
    // merely whether the figure system is live. `figureActive()` is true for
    // every settle in a running battle, so claiming the settle unconditionally
    // muted the awakening finishers on every shot - including shots with zero
    // parry nodes, where there is no reveal to protect. That made the whole
    // awakened branch of settleParty dead code: rolling the meteor through
    // three starkeepers woke all three, queued no assists and dealt no
    // settlement damage at all. Measured before this change: awakened 3,
    // queued 0, boss health unchanged.
    if (!figureActive()) return;
    context.figureActive = true;
    const resolved = finishFigureShot();
    context.result = resolved;
    context.handled = resolved;
  },
  { priority: 100 },
);
registerRuntimeHook("beforeShotResolution", ({ continueBattle }) =>
  deferFigureResolution(continueBattle),
);
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
// --- node and parry outcome shapes ---------------------------------------
// One bright fixed core plus a unit-coloured halo. The core is what lifts the
// contrast: at 0.4 alpha in unit colour alone the eight roster colours all
// landed between 2.5 and 3.4 against the floor, with 봇새기 pink and 그즘 purple
// worst. The halo keeps `node.col` doing its job — saying who made the node.
function drawStarNode(cx, cy, col, born = 0, guide = false) {
  const pop = born > 0 ? born / PARRY_FX.nodeBorn : 0,
    halo = 7 + pop * 3;
  x.save();
  x.globalAlpha = 0.5 + pop * 0.32;
  x.fillStyle = col || PARRY_FX.core;
  x.shadowBlur = 10 + pop * 8;
  x.shadowColor = col || PARRY_FX.core;
  x.beginPath();
  x.arc(cx, cy, halo, 0, Math.PI * 2);
  x.fill();
  x.shadowBlur = 0;
  x.globalAlpha = 1;
  x.fillStyle = PARRY_FX.core;
  x.beginPath();
  x.arc(cx, cy, 3 + pop * 1.6, 0, Math.PI * 2);
  x.fill();
  if (pop > 0) {
    x.globalAlpha = pop * 0.55;
    x.strokeStyle = col || PARRY_FX.core;
    x.lineWidth = 2;
    x.beginPath();
    x.arc(cx, cy, halo + 5 + (1 - pop) * 10, 0, Math.PI * 2);
    x.stroke();
  }
  if (guide) {
    x.globalAlpha = 0.9;
    x.strokeStyle = "#fff2bf";
    x.lineWidth = 1.5;
    x.beginPath();
    x.moveTo(cx - 6, cy);
    x.lineTo(cx + 6, cy);
    x.moveTo(cx, cy - 6);
    x.lineTo(cx, cy + 6);
    x.stroke();
  }
  x.restore();
}
function drawParryFxLayer() {
  if (!parryFx.length) return;
  for (const fx of parryFx) {
    const p = Math.max(0, Math.min(1, fx.t / fx.d)),
      life = 1 - p;
    x.save();
    if (fx.kind === "hit") {
      // Outward: a ring leaving the contact plus six spokes thrown clear.
      x.strokeStyle = fx.col || PARRY_FX.core;
      x.shadowBlur = 12;
      x.shadowColor = fx.col || PARRY_FX.core;
      x.globalAlpha = life * 0.9;
      x.lineWidth = 1 + life * 3;
      x.beginPath();
      x.arc(fx.x, fx.y, 7 + p * 30, 0, Math.PI * 2);
      x.stroke();
      x.lineWidth = 2;
      x.globalAlpha = life * 0.8;
      for (let i = 0; i < 6; i++) {
        const a = (i * Math.PI) / 3 + 0.2,
          from = 9 + p * 26;
        x.beginPath();
        x.moveTo(fx.x + Math.cos(a) * from, fx.y + Math.sin(a) * from);
        x.lineTo(
          fx.x + Math.cos(a) * (from + 9 * life),
          fx.y + Math.sin(a) * (from + 9 * life),
        );
        x.stroke();
      }
    } else if (fx.kind === "guide") {
      x.strokeStyle = "#ffd27f";
      x.shadowBlur = 16;
      x.shadowColor = "#ffd27f";
      x.globalAlpha = life * 0.8;
      x.lineWidth = 2 + life * 2;
      for (const node of fx.nodes) {
        x.beginPath();
        x.moveTo(fx.x, fx.y);
        x.lineTo(node.x, node.y);
        x.stroke();
        x.beginPath();
        x.arc(node.x, node.y, 6 + p * 7, 0, Math.PI * 2);
        x.stroke();
      }
    } else if (fx.kind === "miss") {
      // Inward rhythm reversed: a ring already broken into three pieces that
      // slide apart and drop. Neutral, never red, never shaken.
      x.strokeStyle = PARRY_FX.fail;
      x.globalAlpha = life * 0.75;
      x.lineWidth = 2;
      const r = 13 + p * 9;
      for (let i = 0; i < 3; i++) {
        const a = ((i * Math.PI) / 1.5) * 1 + p * 0.5;
        x.beginPath();
        x.arc(fx.x, fx.y + p * 8, r, a, a + 0.72);
        x.stroke();
      }
      x.globalAlpha = life * 0.6;
      for (let i = 0; i < 4; i++) {
        const a = 0.5 + (i * Math.PI) / 2,
          from = 8 + p * 22;
        x.beginPath();
        x.moveTo(fx.x + Math.cos(a) * from, fx.y + Math.sin(a) * from + p * 10);
        x.lineTo(
          fx.x + Math.cos(a) * (from + 6),
          fx.y + Math.sin(a) * (from + 6) + p * 10,
        );
        x.stroke();
      }
    } else if (fx.kind === "scatter") {
      // The most expensive failure in the game, so it is the biggest picture:
      // every node that was collected breaks apart where it stood.
      const c = figureCentroid(fx.nodes);
      x.globalAlpha = life * 0.34;
      x.strokeStyle = PARRY_FX.failLine;
      x.lineWidth = 2;
      x.setLineDash([4, 7]);
      x.beginPath();
      for (let i = 0; i < fx.nodes.length; i++) {
        const n = fx.nodes[i];
        if (i === 0) x.moveTo(n.x, n.y);
        else x.lineTo(n.x, n.y);
      }
      x.stroke();
      x.setLineDash([]);
      for (const n of fx.nodes) {
        const a = Math.atan2(n.y - c.y, n.x - c.x),
          dx = n.x + Math.cos(a) * p * 34,
          dy = n.y + Math.sin(a) * p * 34 + p * p * 14;
        x.globalAlpha = life * 0.85;
        x.fillStyle = PARRY_FX.fail;
        x.beginPath();
        x.arc(dx, dy, 4 * life + 1, 0, Math.PI * 2);
        x.fill();
        x.globalAlpha = life * 0.5;
        x.strokeStyle = PARRY_FX.fail;
        x.lineWidth = 1.5;
        const arm = 5 + p * 9;
        x.beginPath();
        x.moveTo(dx - arm, dy);
        x.lineTo(dx - arm + 4, dy);
        x.moveTo(dx + arm - 4, dy);
        x.lineTo(dx + arm, dy);
        x.stroke();
      }
    } else if (fx.kind === "close") {
      // Third node: the figure closes for the first time. This is what tells a
      // new player the chain can now fire, in place of the deleted label.
      x.globalAlpha = life * 0.85;
      x.strokeStyle = PARRY_FX.core;
      x.lineWidth = 1 + life * 2;
      x.shadowBlur = 12;
      x.shadowColor = PARRY_FX.window;
      x.beginPath();
      fx.ring.forEach((n, i) => (i ? x.lineTo(n.x, n.y) : x.moveTo(n.x, n.y)));
      x.closePath();
      x.stroke();
    }
    x.restore();
  }
}
/* Memo for the preview recogniser. Keyed on the node array identity and its
   length: within one shot the array is appended to, and between shots
   currentFigureShot() installs a brand new array, so those two together change
   exactly when the classification can change. Holding the array reference is
   safe because it is replaced, never retained past its shot. */
let figurePreviewMemo = { nodes: null, count: -1, match: null, fit: null };
function figurePreviewFor(nodes) {
  if (
    figurePreviewMemo.nodes === nodes &&
    figurePreviewMemo.count === nodes.length
  )
    return figurePreviewMemo;
  const match =
    nodes.length >= FIGURE_PARRY.minNodes ? classifyFigure(nodes) : null;
  figurePreviewMemo = {
    nodes,
    count: nodes.length,
    match,
    fit: match ? figureFit(nodes, match.shape) : null,
  };
  return figurePreviewMemo;
}
// The shot preview is intentionally raw: its stars stay at the contact
// positions until the table settles. Only the resolved constellation is
// corrected into the chosen sky skeleton.
registerRuntimeHook("afterDraw", function drawFigureShot() {
  if (!figureActive()) return;
  const state = currentFigureShot(),
    nodes = state.nodes;
  drawParryFxLayer();
  // Window open: "you can press now". The arc's remaining sweep is the
  // remaining time, and the four ticks travel inward as it closes, so the cue
  // gathers where the success will burst outward from.
  if (state.parry > 0) {
    const remain = state.parry / FIGURE_PARRY.parryWindow,
      reach = 14 + remain * 18;
    x.save();
    x.globalAlpha = 0.4 + remain * 0.45;
    x.strokeStyle = PARRY_FX.window;
    x.lineWidth = 1.5 + remain * 3;
    x.shadowBlur = 16;
    x.shadowColor = PARRY_FX.window;
    x.beginPath();
    x.arc(
      ball.x,
      ball.y,
      ball.r + 13,
      -Math.PI / 2,
      -Math.PI / 2 + Math.PI * 2 * remain,
    );
    x.stroke();
    x.lineWidth = 2;
    for (let i = 0; i < 4; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 2;
      x.beginPath();
      x.moveTo(
        ball.x + Math.cos(a) * (ball.r + reach),
        ball.y + Math.sin(a) * (ball.r + reach),
      );
      x.lineTo(
        ball.x + Math.cos(a) * (ball.r + reach - 7),
        ball.y + Math.sin(a) * (ball.r + reach - 7),
      );
      x.stroke();
    }
    x.restore();
  }
  // The post-contact echo is deliberately local and short. It tells the
  // player which bounce can still be answered without predicting a future
  // route or asking them to select a target in a crowded corner.
  if (state.contact?.t > 0) {
    const contact = state.contact,
      pulse = contact.t / FIGURE_PARRY.contactMemory,
      g = contact.g;
    x.save();
    x.globalAlpha = 0.2 + pulse * 0.55;
    x.strokeStyle = g.col || "#fff1bd";
    x.lineWidth = 2 + pulse * 2;
    x.shadowBlur = 14;
    x.shadowColor = g.col || "#fff1bd";
    x.beginPath();
    x.arc(
      contact.x,
      contact.y,
      ball.r + g.r + 4 + (1 - pulse) * 9,
      0,
      Math.PI * 2,
    );
    x.stroke();
    x.globalAlpha = 0.86;
    x.fillStyle = "#fff3d6";
    x.textAlign = "center";
    x.font = "bold 11px ui-monospace";
    x.fillText("Space · 공명", contact.x, contact.y - ball.r - g.r - 13);
    x.restore();
  }
  if (!nodes.length) return;
  /* classifyFigure + figureFit are the shape recogniser, and it is expensive:
     for each template it walks every rotation x every start offset, and its
     inner cloud distance is O(n^2) with a fresh boolean array per call - a few
     thousand hypot calls and well over a hundred allocations at five nodes.
     This runs from `afterDraw`, so it was paying that every frame from the
     third parry node until the shot settled, on a node array that only changes
     when a new parry lands. Cache it against the node count, which is exactly
     when the answer can change (nodes are only ever appended within a shot,
     and currentFigureShot rebuilds the array wholesale between shots). */
  const preview = figurePreviewFor(nodes);
  const match = preview.match,
    fit = preview.fit,
    edges = match
      ? match.shape.edges.map(([a, b]) => [
          nodes[fit.order[a]],
          nodes[fit.order[b]],
        ])
      : nodes.slice(1).map((node, i) => [nodes[i], node]);
  x.save();
  // Edges stay quieter than the nodes: the points are the subject.
  x.globalAlpha = 0.26;
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
  x.restore();
  for (const node of nodes)
    drawStarNode(node.x, node.y, node.col, node.born || 0, node.guide);
  if (match) {
    x.save();
    x.globalAlpha = 0.9;
    x.fillStyle = "#fff3d6";
    x.textAlign = "center";
    x.font = "bold 12px ui-monospace";
    x.fillText(match.shape.name, ball.x, ball.y - ball.r - 25);
    x.restore();
  }
});
/* --- drawing (RuneCast RuneTracer: wide faint glow + thin bright core) --- */
registerRuntimeHook("afterFeedbackUpdate", function advanceFigureFx(d) {
  advanceFigureShot(d);
  // Parry shapes run on this clock, not on `fieldFx`'s physics clock, so a
  // node loss that happens after the meteor stops still plays out and clears.
  if (parryFx.length) {
    for (const fx of parryFx) fx.t += d;
    for (let i = parryFx.length - 1; i >= 0; i--)
      if (parryFx[i].t >= parryFx[i].d) parryFx.splice(i, 1);
  }
  if (!figureFx) return;
  if (figureFx.battle !== battle) {
    figureFx = null;
    return;
  }
  // Once the battle has resolved the reveal has nothing left to pay out, and
  // letting its pending cast fire would settle a fight that is already over.
  // Drop it rather than freezing it, so it cannot surface in the next battle.
  if (battleComplete && figureFx.cast) figureFx.cast = null;
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
    const active = figureFx,
      cast = active.cast;
    active.cast = null;
    // Pitched by point count rather than by name: the count is what the player
    // earned, and three of the five tiers hold only one shape anyway. All eight
    // used to share the one unlock tone, so seven parries sounded like three.
    const tier = Math.max(3, Math.min(7, active.ring?.length || 3));
    combatSfx?.("figure" + tier, active.rune ? 1 : 0.85);
    cast();
    const afterCast = active.afterCast;
    active.afterCast = null;
    afterCast?.();
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
    /* 오망성만 「정확도 N%」를 찍고 있었는데, 그런 시스템이 없다. `score`는
       모든 별자리 능력에 ctx.score로 넘어가지만 읽는 능력이 하나도 없고,
       피해량은 bonusPerPoint × 꼭짓점 수로만 정해진다. 아무것도 바꾸지 않는
       숫자를 결과처럼 보여 주고 있었다. */
    x.restore();
  }
});

const FigureModule = StellaRuntime.modules.register("figure", {
  isResolutionPending: isFigureResolutionPending,
  castAt: FIGURE_CAST_AT,
});
/* --- the training table seats four, so the meteor makes a fifth point ------
 * The fourth seat is a real party slot now: the stage carries four `slots` and
 * `partySlotCount()` opens the roster to four there, so startShot builds and
 * primes all four the same way it does the other stages' three. This block used
 * to push a spare starkeeper on after setupBattle had already run, which left
 * it without unitTrail and threw on the first frame of the first shot. */
