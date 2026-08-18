/* Combat input, scoring, hero abilities, clone meteors, and awakening feedback. */
// Billiards pass: the ball has no gravity and never drains through the bottom.
// A run begins at the fixed launch stone, then every following shot starts from
// the exact place where the previous ball came to rest.  The readable puzzle is
// now the route through deployed heroes, not a precision punishment.
registerRuntimeHook("afterShotStart", ({ restingPoint }) => {
  for (const gate of gates) gate.r = 34;
  if (restingPoint) {
    ball.x = clamp(restingPoint.x, ball.r + 18, W - ball.r - 18);
    ball.y = clamp(restingPoint.y, ball.r + 18, H - ball.r - 18);
  }
  ball.billiards = true;
  ball.aimAssist = false;
});
function finalizeBilliardShot() {
  const restingPoint = { x: ball.x, y: ball.y };
  const continueBattle = () => {
    if (battleComplete || boss.hp <= 0) return;
    if (battle.shots <= 0) {
      run = false;
      return fail(
        bossDisplayName() +
          "이 버텼습니다. 유닛 연쇄와 반사 경로를 바꿔보세요.",
      );
    }
    // Position play is the point of billiards: the next meteor tees off from
    // where this one came to rest. Only Luna's lessons keep the fixed launch
    // stone, because their copy points the player at the bottom of the board.
    startShot(battle.tutorial ? null : restingPoint);
    msg =
      "다음 샷 · 멈춘 자리에서 이어 발사해 별지기를 깨우고, Space 공명으로 별빛을 모으세요.";
    toast("다음 샷 · 현재 위치에서 재개");
    sync();
  };
  ball.moving = false;
  ball.vx = ball.vy = 0;
  ball.trail = [];
  if (battle.shots <= 0 && battle.training) {
    battle.shots = battle.shotMax;
    toast("훈련 유성 자동 보충");
  }
  if (battle.shots <= 0) {
    // A resolved constellation deliberately casts after its reveal. Defer the
    // last-shot verdict so the ability can kill the boss or refund a meteor.
    if (runtimeHookHandled("beforeShotResolution", { continueBattle })) return;
  }
  continueBattle();
}
/* 조준 보정 세기. 0이면 꺼진다 — 되돌리려면 이 값만 0.58로 되돌리면 된다.
   2026-08-18에 껐다. 근거:
     · 목적을 달성하지 못했다. 켜고 끈 캠페인 클리어율이 87.5%로 «같고»,
       같은 별지기를 유지하는 각도 폭도 21도 대 20도로 차이가 없다.
     · 조준 감각을 왜곡한다. 목표 중앙에서는 손보다 0.42배로 느리고 원뿔
       가장자리에서는 2.16배로 빨라, 같은 1px에 조준이 다섯 배까지 다르게
       반응한다. 「조준이 이상한데 왜인지 모르겠다」의 정체가 이것이었다.
     · 결과를 서로 비슷하게 만든다. 피해의 p90/p10이 켜면 2.75, 끄면 3.48 —
       잘 쏜 판과 못 쏜 판을 가깝게 당긴다. 실력을 드러내려는 방향과 반대다.
     · 설계 근거가 문서에 없다. 최초 수직 슬라이스에 딸려 들어온 뒤 한 번도
       정당화된 적이 없고, 오늘 고친 「별지기를 갈아탈 때 1px에 2~4도 튀는」
       버그도 이 시스템 것이었다.
   수업이 조준을 강제하는 경로(resolveBilliardAim 훅)는 그대로 남는다. */
const AIM_ASSIST_PULL = 0;
function billiardAim(dx, dy) {
  const override = queryRuntimeHook("resolveBilliardAim", { dx, dy });
  if (override) return override;
  const len = Math.hypot(dx, dy) || 1,
    base = Math.atan2(dy, dx);
  if (!AIM_ASSIST_PULL) return { x: dx / len, y: dy / len, assisted: false };
  let best = null,
    pull = 0;
  const consider = (target) => {
    const tx = target.x - ball.x,
      ty = target.y - ball.y,
      d = Math.hypot(tx, ty);
    if (d < 55 || d > 620) return;
    const delta = Math.atan2(
      Math.sin(Math.atan2(ty, tx) - base),
      Math.cos(Math.atan2(ty, tx) - base),
    );
    if (Math.abs(delta) >= 0.15) return;
    /* 보정이 원뿔 경계에서 뚝 끊겨 있었다. 안에서는 각도를 0.58만큼 끌어당기고
       바깥에서는 그대로 두니, 경계를 한 픽셀 넘는 순간 발사각이
       0.15rad × 0.58 = 4.98도 튀었다 — 실측 5.05~5.12도. 경계로 갈수록 보정을
       0으로 데워 없앤다(중심부 손실은 제곱 감쇠라 작다). */
    const edge = Math.abs(delta) / 0.15;
    /* 그런데 그 처리는 원뿔의 «바깥» 경계만 덮었다. 가장 가까운 별지기 하나만
       고르는 방식이라, 겨누는 각을 쓸다가 «가장 가까운»이 바뀌는 순간 delta가
       통째로 다른 별지기 것으로 갈아타며 부호까지 뒤집힌다 — 마우스 1픽셀에
       발사각이 2.1~4.0도 튀었고(probeAimTransfer, 6개 중 4개 스테이지),
       별지기가 하나뿐인 1-1에서만 튀지 않았다.
       그래서 하나를 고르지 않는다. 원뿔 안의 모든 별지기가 각자의 falloff만큼
       당기고 그것을 더한다. 각 항이 경계에서 0으로 수렴하므로 별지기가 들어오고
       나가는 순간에도 합이 이어지고, 넘겨주는 자리에서도 끊기지 않는다.
       별지기가 하나뿐인 구간의 결과는 예전과 완전히 같다. best는 어느 별지기를
       돕고 있는지 표시하는 용도로만 남는다. */
    pull += delta * (1 - edge * edge);
    if (!best || Math.abs(delta) < Math.abs(best.delta))
      best = { delta, target };
  };
  for (const gate of gates) consider(gate);
  for (const bumper of bumpers) consider(bumper);
  consider(boss);
  if (!best) return { x: dx / len, y: dy / len, assisted: false };
  const angle = base + pull * AIM_ASSIST_PULL;
  return {
    x: Math.cos(angle),
    y: Math.sin(angle),
    assisted: true,
    target: best.target,
  };
}
// The first billiards solver landed here and was replaced further down this
// same file (see the live `simulatePhysics` next to the gimmick handling),
// so this copy never ran. It has been removed along with the pinball layer.
function damage(weak = false) {
  if (battleComplete) return;
  trackBlazeDirect();
  let amount = RULES.baseDamage + build.weakFlat;
  const unrouted = !ball.starkeeperTouched,
    openingDirect = unrouted && ball.openingBossContact;
  if (unrouted) amount *= RULES.unroutedBossDamage;
  if (openingDirect) amount *= RULES.openingBossDamage;
  amount *=
    1 + Math.max(0, chain.length - 1) * (RULES.chainStep + build.chainStep);
  amount *= 1 + ball.power * 0.2;
  amount *= ball.blaze?.mult || 1;
  const marked = weak && ball.mark;
  if (marked) amount *= build.markMultiplier;
  amount *= weak ? 1.7 : 1;
  amount *= 1 + Math.min(0.52, ball.bounces * build.bounceStep);
  const crit =
    weak && Math.random() < 0.12 + Math.min(0.18, chain.length * 0.04);
  if (crit) amount *= 1.6;
  amount = Math.max(1, Math.round(amount));
  const label = openingDirect
    ? "첫 직격"
    : weak
      ? crit
        ? "치명 약점"
        : "약점"
      : unrouted
        ? "직격"
        : "몸체";
  const dealt = applyBossHit(amount);
  if (dealt > 0) {
    // Said explicitly rather than inferred from the popup's wording: every
    // direct meteor hit shakes, flashes and extends the combo, including the
    // unrouted 직격 and 첫 직격 that the old label test silently skipped.
    registerBossHit(weak);
    impact(weak);
    addPopup(
      ball.x,
      ball.y - 28,
      label + " -" + dealt,
      weak ? "#ffe59a" : "#e6f7ef",
      crit,
    );
  }
  if (marked)
    areaAttack(
      "미리내 표식 폭발",
      Math.max(12, Math.round(amount * 0.38)),
      "#ef718d",
    );
  toast(weak ? label + " " + amount + " 피해" : "몸체 " + amount + " 피해");
  if (boss.hp <= 0) scheduleWin();
  ball.power = 0;
  ball.openingBossContact = false;
  if (weak) ball.mark = false;
  chain = [];
  sync();
  // Named for its scope: this is the DIRECT meteor-on-colossus path only.
  // Nine other sites call applyBossHit - assists, area, clones, blade ticks,
  // constellation abilities - and none of them reach here. The old name read
  // as "any boss damage", which would quietly give a future consumer about one
  // damage event in ten. The onboarding consumer is correct either way because
  // lesson 1 deploys no starkeepers, so a direct hit is the only source there.
  runRuntimeHooks("afterDirectBossDamage", {
    weak,
    amount,
    dealt,
    marked,
    crit,
  });
}
function hitBumper(b) {
  if (b.on > 0 || battleComplete) return;
  b.on = 0.22;
  const speed = Math.hypot(ball.vx, ball.vy) || 1,
    boosted = Math.min(1890, speed + 218);
  ball.vx *= boosted / speed;
  ball.vy *= boosted / speed;
  ball.power += 0.28;
  ball.runeBurst = 0.6;
  addPopup(b.x, b.y - 26, "공명 가속", "#80e8df", false);
  fieldFx.push({
    type: "bumper",
    x: b.x,
    y: b.y,
    t: 0,
    d: 0.42,
    col: "#80e8df",
  });
  impact(false);
  combatSfx?.("bumper", 0.9);
  toast("공명 범퍼 · 속도 상승");
  sync();
}
function drawPinballTable() {
  for (const pad of boostPads) {
    x.save();
    x.fillStyle = pad.on > 0 ? "#d7ffb4" : "#5c9d73";
    x.shadowBlur = pad.on > 0 ? 24 : 10;
    x.shadowColor = "#b9ef86";
    x.fillRect(pad.x - pad.w / 2, pad.y - pad.h / 2, pad.w, pad.h);
    x.fillStyle = "#1a473d";
    for (let px = pad.x - pad.w / 2 + 14; px < pad.x + pad.w / 2; px += 22)
      x.fillRect(px, pad.y - 3, 11, 6);
    x.restore();
  }
  /* 디자인 세션 §6-3. 예전에는 회색 직사각형 하나에 `wall.on`으로 색과
     그림자만 바뀌었다. 이 벽의 정체성은 반사 계수 1.01 — 「튕긴다」인데,
     그게 그림 어디에도 없었다.
     이제 표현을 전부 그 한 가지에 쓴다. 평시에는 갈매기무늬가 면을 따라 느리게
     흐르며 어느 쪽으로 튕길지 예고하고, 맞으면 판이 밀리고 무늬가 나가는 쪽으로
     스냅한다. 3장 분절이라 w/h가 스테이지마다 달라도 늘어난다. */
  for (const wall of stageWalls) {
    const hw = wall.w / 2,
      hh = wall.h / 2,
      hot = wall.on > 0,
      heat = hot ? wall.on / 0.22 : 0,
      // 맞은 쪽에서 밀린다. 세로로 긴 벽이면 가로로, 가로로 긴 벽이면 세로로.
      lateral = wall.w >= wall.h,
      kick = heat * 3,
      ox = lateral ? 0 : kick,
      oy = lateral ? -kick : 0;
    x.save();
    x.translate(wall.x + ox, wall.y + oy);
    // 판 세 장. 이음매가 보여야 「타일이 이어진 방벽」으로 읽힌다.
    const plates = 3,
      step = (lateral ? wall.w : wall.h) / plates;
    x.fillStyle = hot ? "#e3edf0" : "#7699a3";
    x.strokeStyle = "#243b47";
    x.lineWidth = 2;
    for (let i = 0; i < plates; i++) {
      const px0 = lateral ? -hw + i * step + 1 : -hw,
        py0 = lateral ? -hh : -hh + i * step + 1,
        pw = lateral ? step - 2 : wall.w,
        ph = lateral ? wall.h : step - 2;
      x.fillRect(px0, py0, pw, ph);
      x.strokeRect(px0, py0, pw, ph);
    }
    /* 갈매기무늬. 면을 따라 흐르고, 맞으면 흐름이 한 번에 앞으로 스냅한다. */
    const flow = ((frameClock / (hot ? 90 : 640)) % 1) * step;
    x.globalAlpha = hot ? 0.9 : 0.42;
    x.strokeStyle = hot ? "#fffbe8" : "#c3f3ff";
    x.lineWidth = hot ? 3 : 2;
    x.beginPath();
    for (let i = -1; i < plates + 1; i++) {
      const at = -(lateral ? hw : hh) + i * step + flow;
      if (lateral) {
        x.moveTo(at, -hh + 2);
        x.lineTo(at + hh, 0);
        x.lineTo(at, hh - 2);
      } else {
        x.moveTo(-hw + 2, at);
        x.lineTo(0, at + hw);
        x.lineTo(hw - 2, at);
      }
    }
    x.stroke();
    // 맞은 순간 면에 수직으로 충격파가 한 번 나간다.
    if (hot) {
      x.globalAlpha = heat * 0.55;
      x.strokeStyle = "#fffbe8";
      x.lineWidth = 2;
      const reach = 10 + (1 - heat) * 26;
      x.beginPath();
      if (lateral) {
        x.moveTo(-hw, -hh - reach);
        x.lineTo(hw, -hh - reach);
      } else {
        x.moveTo(hw + reach, -hh);
        x.lineTo(hw + reach, hh);
      }
      x.stroke();
    }
    x.restore();
  }
  // Fading pads read as the opposite of boost pads: grey, no arrows, and a
  // dashed edge that says "this takes something away".
  for (const pad of dragPads) {
    x.save();
    x.fillStyle = pad.on > 0 ? "#4a6663" : "#2b4340";
    x.strokeStyle = pad.on > 0 ? "#cfdad7" : "#5f7a77";
    x.lineWidth = 3;
    x.setLineDash([11, 8]);
    x.fillRect(pad.x - pad.w / 2, pad.y - pad.h / 2, pad.w, pad.h);
    x.strokeRect(pad.x - pad.w / 2, pad.y - pad.h / 2, pad.w, pad.h);
    x.setLineDash([]);
    x.fillStyle = pad.on > 0 ? "#cfdad7" : "#6f8b87";
    x.textAlign = "center";
    x.font = "bold 13px ui-monospace";
    x.fillText("배율 ↓", pad.x, pad.y + 5);
    x.restore();
  }
  for (const b of bumpers) {
    circle(b.x, b.y, b.r + 7, "#10222c", b.on ? 25 : 8);
    circle(b.x, b.y, b.r, b.on ? "#e4f5d5" : "#4db8b3", b.on ? 28 : 12);
    circle(b.x, b.y, Math.max(7, b.r - 9), "#e8cf77", b.on ? 14 : 4);
  }
  for (const orbit of orbitals) {
    if (orbit.down > 0) continue;
    const life = orbit.hp / orbit.maxHp;
    x.save();
    x.translate(orbit.x, orbit.y);
    x.rotate(orbit.a * 1.6);
    x.fillStyle = "#12242a";
    x.strokeStyle = orbit.hitCooldown > 0 ? "#ffe3c0" : "#7cc6bb";
    x.lineWidth = 4;
    x.shadowBlur = orbit.hitCooldown > 0 ? 22 : 10;
    x.shadowColor = "#7cc6bb";
    x.beginPath();
    x.rect(-orbit.r, -orbit.r * 0.62, orbit.r * 2, orbit.r * 1.24);
    x.fill();
    x.stroke();
    x.shadowBlur = 0;
    x.fillStyle = "#9adfc9";
    x.fillRect(-orbit.r + 4, -3, (orbit.r * 2 - 8) * life, 6);
    x.restore();
  }
  // The shell is the reason a good hit did nothing, so it is drawn on the
  // colossus itself, one ring per remaining layer.
  /* 껍질이 통째로 걷힌 순간. 남은 조각 전부가 0.4초 동안 바깥으로 흩어진다. */
  if (bossShield?.shattered && boss) {
    const age = (frameClock - bossShield.shattered.at) / 400;
    if (age >= 1) bossShield.shattered = null;
    else {
      const slots = bossShield.max || bossShield.shattered.count,
        gap = 0.16,
        span = (Math.PI * 2) / slots - gap;
      x.save();
      x.lineCap = "butt";
      x.strokeStyle = "#ffe3c0";
      x.shadowBlur = 16;
      x.shadowColor = "#9adfc9";
      x.lineWidth = 7;
      for (let i = 0; i < bossShield.shattered.count; i++) {
        const a0 = -Math.PI / 2 + i * ((Math.PI * 2) / slots) + gap / 2;
        x.globalAlpha = 1 - age;
        x.beginPath();
        x.arc(boss.x, boss.y, 76 + age * 92, a0, a0 + span * (1 - age * 0.5));
        x.stroke();
      }
      x.restore();
    }
  }
  if (bossShield && bossShield.hits > 0 && boss) {
    /* 디자인 세션 §6-4. 예전에는 반지름 76+11i의 동심원을 남은 타수만큼
       겹쳐 그렸다. 그런데 보스 둘레의 링은 이 게임에서 공전 장애물·공명
       고리·별자리 궤적에도 쓰는 형태라 서로 구분되지 않고, 남은 수를 알려면
       원의 개수를 세어야 했다.
       이제 방패 조각이 둘레를 감싼다. 깨진 자리는 «비어» 있으므로 세지 않아도
       읽히고, 조각이 깨져 나가는 것 자체가 연출이 된다. */
    const slots = Math.max(bossShield.max || bossShield.hits, bossShield.hits),
      gap = 0.16,
      span = (Math.PI * 2) / slots - gap,
      hot = bossShield.flash > 0,
      lift = hot ? 6 * (bossShield.flash / 0.45) : 0;
    x.save();
    x.lineCap = "butt";
    for (let i = 0; i < slots; i++) {
      const intact = i < bossShield.hits,
        // 가장 최근에 깨진 조각은 바깥으로 튀어 나가며 사라진다.
        justBroke = !intact && i === bossShield.hits && hot;
      if (!intact && !justBroke) continue;
      const a0 = -Math.PI / 2 + i * ((Math.PI * 2) / slots) + gap / 2,
        r = 76 + (justBroke ? 14 * (1 - bossShield.flash / 0.45) + lift : lift);
      x.globalAlpha = justBroke ? bossShield.flash / 0.45 : hot ? 0.95 : 0.72;
      x.strokeStyle = hot ? "#ffe3c0" : "#7cc6bb";
      x.shadowBlur = hot ? 20 : 9;
      x.shadowColor = "#9adfc9";
      // 판 하나는 두꺼운 호 + 안쪽 테두리. 두 겹이라 「판」으로 읽힌다.
      x.lineWidth = 7;
      x.beginPath();
      x.arc(boss.x, boss.y, r, a0, a0 + span);
      x.stroke();
      x.globalAlpha *= 0.55;
      x.lineWidth = 2;
      x.shadowBlur = 0;
      x.strokeStyle = "#dff3ea";
      x.beginPath();
      x.arc(boss.x, boss.y, r - 5, a0 + 0.03, a0 + span - 0.03);
      x.stroke();
    }
    x.restore();
  }
}
function steerMeteor(side) {
  if (!ball?.moving || ball.steerUsed || battleComplete) return false;
  // 조준이 강제된 수업에서는 항로를 바꿀 수 없다. 훅이 아니라 여기에 두어야
  // 마우스와 키보드 두 경로가 함께 막힌다.
  if (StellaRuntime.modules.optional("onboarding")?.blocksSteer?.())
    return false;
  const speed = Math.hypot(ball.vx, ball.vy);
  if (speed < 1) return false;
  const ux = ball.vx / speed,
    uy = ball.vy / speed,
    // Canvas y grows down, so (uy, -ux) is visually left of travel.
    // `side` is -1 for the left click and +1 for the right click.
    turnX = -uy * side,
    turnY = ux * side;
  /* 정확히 90도. 예전에는 앞으로 170 · 옆으로 430인 «힘»을 더했는데, 그러면
     실제 꺾임이 atan(430/170) ≈ 68도에 그치고 속도까지 함께 올라갔다 —
     조종이라기보다 한 번 쓰는 부스터로 읽혔다.
     속도는 그대로 두고 방향만 진행 수직으로 돌린다. 무엇이 일어났는지가
     각도 하나로 읽히고, 「어느 방향으로 꺾을까」가 비로소 판단이 된다. */
  ball.vx = turnX * speed;
  ball.vy = turnY * speed;
  // 거의 멈춘 유성이 꺾이면 그 자리에서 죽는다. 하한만 지킨다.
  guaranteeMomentum(ball, turnX, turnY, 760, 1780);
  ball.steerUsed = true;
  ball.steerFlash = 0.42;
  ball.runeBurst = Math.max(ball.runeBurst || 0, 0.7);
  ball.power += 0.22;
  fieldFx.push({
    type: "relay",
    x: ball.x,
    y: ball.y,
    t: 0,
    d: 0.34,
    col: side < 0 ? "#8ee7ff" : "#ffd18d",
  });
  impact?.(false, ball.x, ball.y, "contact");
  /* 여기는 소리를 «더하는» 자리가 아니라 «바로잡는» 자리다. 궤도 전환은
     범퍼가 아닌데 범퍼 큐를 빌려 쓰고 있었다 — 판 위의 다른 물체에 부딪힌
     것과 내가 누른 것이 같은 소리를 내면 둘을 구분할 수 없다. 위의 impact가
     이미 접촉음을 내므로 여기에 하나를 더 얹지는 않는다. */
  combatSfx?.("steer", 0.56);
  addPopup(
    ball.x,
    ball.y - 30,
    side < 0 ? "좌측 궤도 전환" : "우측 궤도 전환",
    side < 0 ? "#8ee7ff" : "#ffd18d",
    true,
  );
  toast(side < 0 ? "좌측으로 유성 전환" : "우측으로 유성 전환");
  runRuntimeHooks("afterMeteorSteer", { side, ball });
  return true;
}
function billiardPointerDown(e) {
  // 첫 입력에 입장 연출을 건너뛴다. 재도전이 잦은 게임에서 연출이 기다림이
  // 되면 안 된다 — 누르는 순간 판이 완성된 상태로 있어야 한다.
  skipBattleIntro();
  // `battleComplete` matters here as much as `run`. scheduleWin freezes the
  // meteor and marks the battle complete but deliberately leaves `run` true
  // for the 2.55s victory cutscene, and every other combat entry point is
  // guarded on battleComplete - only the launch path was not. That let a drag
  // during the death animation spend `battle.shots`, which the result card
  // reads back as the medal and the shot count, and repeated drags drove the
  // counter negative in the HUD.
  if (!run || paused || battleComplete || isCombatInputLocked()) return;
  if (!ball?.moving) {
    if (e.button !== 0) return;
    const p = pointer(e);
    e.stopImmediatePropagation();
    drag = { x: p.x, y: p.y };
    c.setPointerCapture(e.pointerId);
    return;
  }
  if (e.button !== 0 && e.button !== 2) return;
  e.preventDefault();
  e.stopImmediatePropagation();
  steerMeteor(e.button === 0 ? -1 : 1);
}
// The launch stone sits at the bottom of the board, so a literal drag would
// leave no room to pull a strong upward shot.  Downward input is stretched
// into a virtual cue pull; the guide uses the exact same vector.
function cuePull(p) {
  const dy = p.y - ball.y;
  return { x: p.x, y: ball.y + (dy > 0 ? dy * 4.8 : dy) };
}
function billiardPointerMove(e) {
  if (!drag) return;
  e.stopImmediatePropagation();
  const p = pointer(e);
  drag.x = p.x;
  drag.y = p.y;
  // 미리보기도 발사와 같은 식이어야 한다 — 다르면 표시된 위력이 거짓말이 된다.
  ball.launchPower = clamp(
    Math.hypot(ball.x - p.x, ball.y - p.y) / 220,
    0.28,
    1,
  );
}
function billiardPointerUp(e) {
  if (!drag || ball?.moving || battleComplete) return;
  e.stopImmediatePropagation();
  // Lesson cards and the short constellation-result beat both lock launch.
  // Every practice step hides the card before returning control to the table.
  if (isCombatInputLocked()) {
    drag = null;
    toast("루나의 설명을 읽고 아래 버튼을 눌러 주세요.");
    return;
  }
  const raw = pointer(e),
    p = cuePull(raw),
    dx = ball.x - p.x,
    dy = ball.y - p.y,
    l = Math.hypot(dx, dy),
    /* 위력은 증폭된 벡터가 아니라 «실제로 끈 거리»에서 뽑는다. cuePull이
       아래로 끈 거리에 4.8을 곱한 값으로 위력을 재고 있었기 때문에, 54px만
       넘겨 끌면 가로로 어디를 겨누든 위력이 1.00으로 붙박였다 — 60px 끌기
       기준 681개 조준 위치 전부가 최대 위력이었다. 게다가 곱셈이 세로에만
       걸려 있어서 «옆으로 겨누면 위력이 올라가는» 결합까지 있었다(아래로
       20px일 때 dx 0 → 0.37, dx 100 → 0.53).
       방향은 증폭된 벡터가 그대로 맡고, 위력만 끈 거리로 분리한다. 당구에서
       세기는 겨냥과 별개로 고르는 것이고, 세게 치려면 그만큼 당겨야 한다. */
    pullLength = Math.hypot(ball.x - raw.x, ball.y - raw.y);
  drag = null;
  if (l < 18) {
    toast("유성을 더 멀리 끌어 당겨보세요.");
    return;
  }
  const force = clamp(pullLength / 220, 0.28, 1),
    aim = billiardAim(dx, dy),
    speed = 750 + force * 975;
  ball.launchPower = force;
  ball.vx = aim.x * speed;
  ball.vy = aim.y * speed;
  ball.moving = true;
  ball.steerUsed = false;
  ball.steerFlash = 0;
  ball.firstImpact = null;
  ball.starkeeperTouched = false;
  ball.openingBossContact = false;
  combatSfx?.("launch", 0.72 + force * 0.42);
  ball.aimAssist = aim.assisted;
  battle.shots--;
  chain = [];
  msg = "유성 발사! 별지기 충돌은 직접 보스 공격과 가속을 함께 만듭니다.";
  toast(
    aim.assisted
      ? "항로 보정 · 연쇄 진입"
      : "유성 발사 · 위력 " + Math.round(force * 100) + "%",
  );
  runRuntimeHooks("afterMeteorLaunch", { aim, force, ball });
  sync();
}
c.addEventListener("pointerdown", billiardPointerDown, true);
c.addEventListener("pointermove", billiardPointerMove, true);
c.addEventListener("pointerup", billiardPointerUp, true);
c.addEventListener(
  "contextmenu",
  (e) => {
    if (run) {
      e.preventDefault();
      e.stopImmediatePropagation();
    }
  },
  true,
);
// Mobile party billiards: heroes are physical rune spheres.  They are not
// static bumpers; any hero that actually rolls wakes up and attacks only after
// the whole table has settled.  The final table is the next shot's puzzle.
function createBlaze() {
  return {
    mult: 1,
    units: new Set(),
    bossUnits: new Set(),
    wallHits: 0,
    directBoss: false,
    fullParty: false,
    detail: "별자리 배율 대기",
  };
}
function renderBlaze(pulse = false) {
  const b = ball?.blaze || { mult: 1, detail: "별자리 배율 대기" };
  if (!U.blaze) return;
  U.blaze.textContent = "×" + b.mult.toFixed(1);
  U.blazeDetail.textContent = b.detail;
  U.blazeCard.dataset.heat =
    b.mult >= 5 ? 3 : b.mult >= 3 ? 2 : b.mult > 1 ? 1 : 0;
  if (pulse) {
    replayCssClass(U.blazeCard, "hot");
  }
}
// The aim hint is drawn at `ball.y - 28`, so the old `- 40` put the multiplier
// twelve pixels above it and the two strings sat on top of each other whenever
// the meteor came to rest.  Clear the hint by a readable margin, and stop short
// of the HUD when the meteor is already high on the board.
function blazePopupY() {
  // Above the hint where there is room.  A meteor can rest as high as y=31, and
  // clamping to the top edge there would push the multiplier back onto the hint,
  // so in that band it goes below the meteor instead.
  return ball.y - 76 >= 52 ? ball.y - 76 : ball.y + 52;
}
function earnBlaze(amount, detail) {
  const b = ball?.blaze;
  if (!b) return;
  b.mult = Math.min(9.9, Math.round((b.mult + amount) * 10) / 10);
  b.detail = detail;
  addPopup(
    ball.x,
    blazePopupY(),
    "CONSTELLATION ×" + b.mult.toFixed(1),
    "#ffe09a",
    true,
  );
  fieldFx.push({
    type: "blaze",
    x: ball.x,
    y: ball.y,
    t: 0,
    d: 0.4,
    col: "#a9b8ff",
  });
  renderBlaze(true);
  runRuntimeHooks("afterBlazeEarned", { amount, detail, blaze: b });
}
// Multiplier can be taken back, but never below the base 1.0: a bad line
// should cost the bonus, not put the shot underwater.
function loseBlaze(amount, detail) {
  const b = ball?.blaze;
  if (!b || b.mult <= 1) return;
  b.mult = Math.max(1, Math.round((b.mult - amount) * 10) / 10);
  b.detail = detail;
  addPopup(
    ball.x,
    blazePopupY(),
    "CONSTELLATION ×" + b.mult.toFixed(1),
    "#8ba39f",
    false,
  );
  toast(detail + " · 배율 ×" + b.mult.toFixed(1));
  renderBlaze(true);
}
function trackBlazeUnit(g) {
  const b = ball?.blaze;
  if (!b || b.units.has(g.id)) return;
  b.units.add(g.id);
  /* 배율은 별자리 쪽 값이라 공명(패링)으로만 오른다. 각성은 이제 그냥
     부딪히기만 해도 되므로, 여기서 「각성」이라고 부르면 두 어휘가 섞인다. */
  b.detail = "별지기 공명 " + b.units.size + "/" + gates.length;
  if (b.units.size === gates.length && !b.fullParty) {
    b.fullParty = true;
    earnBlaze(3, "전원 공명 +3.0");
  } else renderBlaze();
}
function trackBlazeDirect() {
  const b = ball?.blaze;
  if (!b || b.directBoss) return;
  b.directBoss = true;
  earnBlaze(1, "유성 보스 직격 +1.0");
}
registerRuntimeHook("afterTableWall", () => {
  const b = ball?.blaze;
  if (!b || b.wallHits >= 2) return;
  b.wallHits++;
  earnBlaze(0.2, "벽 반사 +0.2");
});
let cloneBalls = [];
// Each hero keeps a distinct, readable pixel signature.  These bursts are
// separate from the older field feedback so they can finish fading even while
// the table is waiting for the next shot.
let abilityBursts = [];
// 능력 연출과 분열한 유성은 그 전투의 것이다. 다음 판으로 넘기지 않는다.
registerRuntimeHook("afterBattleSetup", () => {
  abilityBursts = [];
  cloneBalls = [];
});
function emitAbilityFx(
  g,
  x = g.x,
  y = g.y,
  size = 88,
  d = 0.52,
  angle = 0,
  asset = (g.fx === "copycat" && g.copiedAsset) || abilityFx[g.id],
  kind = (g.fx === "copycat" && g.copiedFx) || g.fx,
) {
  if (asset) {
    abilityBursts.push({ asset, kind, x, y, size, d, angle, col: g.col, t: 0 });
    if (abilityBursts.length > 8)
      abilityBursts.splice(0, abilityBursts.length - 8);
  }
}
function drawAbilityAccent(b, p) {
  const pulse = 1 - p,
    spin = b.t * 9;
  x.save();
  x.translate(b.x, b.y);
  x.rotate(b.angle || 0);
  x.globalAlpha = Math.min(1, p * 1.25);
  x.strokeStyle = b.col;
  x.fillStyle = b.col;
  x.shadowBlur = 18;
  x.shadowColor = b.col;
  x.lineCap = "round";
  if (b.kind === "slash") {
    for (const shift of [-0.16, 0.12, 0.4]) {
      x.lineWidth = 4;
      x.beginPath();
      x.arc(0, 0, b.size * 0.38 + shift * 18, -1.45 + shift, 1.05 + shift);
      x.stroke();
    }
    x.fillStyle = "#fff2a8";
    x.fillRect(b.size * 0.26, -3, 18, 6);
  } else if (b.kind === "longshot") {
    for (let i = 0; i < 3; i++) {
      const a = (i * Math.PI * 2) / 3 + spin;
      x.beginPath();
      x.moveTo(Math.cos(a) * 12, Math.sin(a) * 12);
      x.lineTo(Math.cos(a) * b.size * 0.48, Math.sin(a) * b.size * 0.48);
      x.stroke();
    }
    x.fillStyle = "#fff3cc";
    x.beginPath();
    x.moveTo(b.size * 0.34, 0);
    x.lineTo(b.size * 0.12, -8);
    x.lineTo(b.size * 0.12, 8);
    x.fill();
  } else if (b.kind === "split") {
    for (const sign of [-1, 1]) {
      const a = spin * sign,
        xp = Math.cos(a) * b.size * 0.27,
        yp = Math.sin(a) * b.size * 0.27;
      x.beginPath();
      x.arc(xp, yp, 12 + pulse * 10, 0, Math.PI * 2);
      x.stroke();
      x.beginPath();
      x.moveTo(0, 0);
      x.lineTo(xp, yp);
      x.stroke();
    }
    x.fillStyle = "#effffd";
    x.beginPath();
    x.arc(0, 0, 9, 0, Math.PI * 2);
    x.fill();
  } else if (b.kind === "seek") {
    x.lineWidth = 4;
    x.beginPath();
    x.moveTo(-b.size * 0.42, 0);
    x.lineTo(b.size * 0.42, 0);
    x.stroke();
    for (let i = 0; i < 3; i++) {
      const px = -b.size * 0.12 + i * b.size * 0.2;
      x.beginPath();
      x.moveTo(px - 7, -8);
      x.lineTo(px + 7, 0);
      x.lineTo(px - 7, 8);
      x.stroke();
    }
  } else if (b.kind === "turn") {
    x.lineWidth = 5;
    x.beginPath();
    x.arc(0, 0, b.size * 0.34, -Math.PI * 0.8, -Math.PI * 0.15);
    x.stroke();
    x.fillStyle = "#fff0c6";
    x.beginPath();
    x.moveTo(b.size * 0.3, -b.size * 0.16);
    x.lineTo(b.size * 0.42, -b.size * 0.03);
    x.lineTo(b.size * 0.25, b.size * 0.02);
    x.fill();
  } else if (b.kind === "shockwave") {
    for (let i = 0; i < 12; i++) {
      const a = (i * Math.PI * 2) / 12 + spin * 0.15,
        inner = b.size * 0.14,
        outer = b.size * (0.34 + pulse * 0.34);
      x.lineWidth = i % 2 ? 3 : 5;
      x.beginPath();
      x.moveTo(Math.cos(a) * inner, Math.sin(a) * inner);
      x.lineTo(Math.cos(a) * outer, Math.sin(a) * outer);
      x.stroke();
    }
    x.fillStyle = "#fff2a8";
    x.beginPath();
    x.arc(0, 0, b.size * 0.16 + pulse * 8, 0, Math.PI * 2);
    x.fill();
  } else if (b.kind === "copycat") {
    x.lineWidth = 3;
    for (let i = 0; i < 2; i++) {
      x.rotate(Math.PI / 4);
      x.strokeRect(
        -b.size * 0.24,
        -b.size * 0.24,
        b.size * 0.48,
        b.size * 0.48,
      );
    }
    x.beginPath();
    x.moveTo(-b.size * 0.34, 0);
    x.lineTo(b.size * 0.34, 0);
    x.moveTo(0, -b.size * 0.34);
    x.lineTo(0, b.size * 0.34);
    x.stroke();
  }
  x.restore();
}
function drawAbilityFx() {
  for (const burst of abilityBursts) {
    const p = Math.max(0, 1 - burst.t / burst.d),
      sheet = textures[abilityFxSheets?.[burst.kind]],
      sheetReady =
        // A failed load reports 0x0, and 0 === 0 * 4 would pass the sheet
        // check, so the width has to be positive before the ratio means
        // anything.  Kept from the reverted lab pass: it is a real fix.
        sheet?.complete &&
        sheet.naturalWidth > 0 &&
        sheet.naturalWidth === sheet.naturalHeight * 4;
    drawAbilityAccent(burst, p);
    if (sheetReady) {
      // Signature burst: step through the 4-frame sheet across the lifetime
      // and let it land bigger than the old still flash.
      const cell = sheet.naturalHeight,
        fi = Math.min(3, Math.floor((1 - p) * 4)),
        size = burst.size * 1.55 * (0.82 + (1 - p) * 0.3);
      x.save();
      x.globalAlpha = Math.min(1, p * 1.6);
      x.translate(burst.x, burst.y);
      x.rotate(burst.angle || 0);
      x.imageSmoothingEnabled = false;
      x.shadowBlur = 16;
      x.shadowColor = burst.col;
      x.drawImage(
        sheet,
        fi * cell,
        0,
        cell,
        cell,
        -size / 2,
        -size / 2,
        size,
        size,
      );
      x.restore();
      continue;
    }
    const image = textures[burst.asset],
      size = burst.size * (0.76 + (1 - p) * 0.34);
    if (!image?.complete || !image.naturalWidth) continue;
    x.save();
    x.globalAlpha = Math.min(1, p * 1.45);
    x.translate(burst.x, burst.y);
    x.rotate(burst.angle || 0);
    x.imageSmoothingEnabled = false;
    x.shadowBlur = 9;
    x.shadowColor = burst.col;
    x.drawImage(image, -size / 2, -size / 2, size, size);
    x.restore();
  }
}
function drawVictoryFx() {
  const v = battle?.victory;
  if (!v || !boss) return;
  const p = Math.min(1, v.t / v.d),
    cx = boss.x,
    cy = boss.y;
  x.save();
  x.globalAlpha = Math.max(0, 0.42 - p * 0.38);
  x.fillStyle = "#d7defe";
  x.fillRect(0, 0, W, H);
  x.restore();
  x.save();
  x.translate(cx, cy);
  for (let i = 0; i < 4; i++) {
    const ring = p * (92 + i * 35) + i * 16;
    x.globalAlpha = Math.max(0, 1 - p) * (0.72 - i * 0.11);
    x.strokeStyle = i % 2 ? "#f4cf7a" : "#e3e9ff";
    x.shadowBlur = 18;
    x.shadowColor = x.strokeStyle;
    x.lineWidth = 3;
    x.beginPath();
    x.arc(0, 0, ring, 0, Math.PI * 2);
    x.stroke();
  }
  for (let i = 0; i < 16; i++) {
    const angle = (i / 16) * Math.PI * 2 + p * 2.4,
      travel = 34 + p * (108 + (i % 4) * 18);
    x.globalAlpha = Math.max(0, 1 - p * 0.75);
    x.fillStyle = i % 2 ? "#fff4be" : "#aebcff";
    x.fillRect(
      Math.cos(angle) * travel - 3,
      Math.sin(angle) * travel - 3,
      6,
      6,
    );
  }
  x.restore();
  const enter = Math.min(1, p / 0.18),
    leave = p > 0.8 ? (1 - p) / 0.2 : 1;
  x.save();
  x.globalAlpha = Math.max(0, Math.min(enter, leave));
  x.translate(W / 2, H * 0.46);
  const scale = 0.72 + enter * 0.38;
  x.scale(scale, scale);
  x.textAlign = "center";
  x.font = "bold 38px ui-monospace";
  x.fillStyle = "#080a1d";
  x.fillText("STAR RETURN!", 2, 2);
  x.fillStyle = "#fff2b2";
  x.shadowBlur = 20;
  x.shadowColor = "#b8c3ff";
  x.fillText("STAR RETURN!", 0, 0);
  x.font = "bold 13px ui-monospace";
  x.shadowBlur = 0;
  x.fillStyle = "#f3f5ff";
  x.fillText("별이 하늘로 돌아갑니다", 0, 28);
  x.restore();
}
function queueUnitAssist(g, amount, name, options = {}) {
  const visual = g.fx === "copycat" ? g.copiedFx || "copycat" : g.fx;
  assistShots.push({
    x: g.x,
    y: g.y,
    fromX: g.x,
    fromY: g.y,
    t: 0,
    // `delay`는 반드시 숫자로 시작해야 한다. 빠뜨리면 정리 루프의 두 분기
    // (`delay > 0`도, `delay <= 0`도) 모두 undefined 비교로 거짓이 되어,
    // 빔이 보스에 영원히 박제되고 resolveAssist가 끝내 불리지 않아 지원
    // 피해·임팩트·팝업까지 통째로 사라진다. 정산 슬로모션의 finisherFocus도
    // 이 정리 루프로만 풀리므로, 각성 한 번 뒤 게임 전체가 0.82배속으로
    // 굳는 원인이기도 했다.
    delay: 0,
    dur: 0.18 + Math.min(0.16, g.travel / 900),
    amount,
    name,
    col: g.col,
    sourceId: g.id,
    visual,
    blaze: ball.blaze?.mult || 1,
    ...options,
    finisherOrder: options.finisher
      ? (battle.finisherSerial = (battle.finisherSerial || 0) + 1) - 1
      : null,
  });
  // Finisher visuals are emitted when that hero actually receives focus.
  // Creating every hero's burst at settlement start caused a large one-frame
  // spike and let later heroes' effects expire before their turn.
  if (!options.finisher)
    fieldFx.push({ type: "assist", x: g.x, y: g.y, t: 0, d: 0.5, col: g.col });
  /* 이 훅은 여기서, 큐에 넣은 모든 어시스트에 대해 울려야 한다. 소비자
     (game-feedback.js)가 delay·dur 배정과 각성 연출을 전부 여기 걸어 두었는데,
     발화가 detonateShockwave 한 곳에만 남아 있어서 검기·저격·각성 피니셔는
     delay가 배정되지 않은 채 큐에 들어갔다. 그 결과가 위 delay 주석의 불멸
     빔이고, 각성 피니셔가 불멸이 되면 finisherFocus가 영영 풀리지 않아 첫
     각성 정산 뒤 전투 전체가 0.82배속으로 굳었다. */
  runRuntimeHooks("afterUnitAssistQueued", {
    gate: g,
    shot: assistShots.at(-1),
    queued: assistShots.length - 1,
    options,
  });
}
/* Gaon's sword wave always reaches the colossus. This range only defines the
   distance band that converts a close stop into the stronger hit — the old
   hard gate answered a whiff with 「사거리 밖」 and nothing else, which is a
   worse read than a weak hit. */
const GAON_CLOSE_RANGE = 205;
function resolveSlash(g, name = "샛별 근접 베기", options = {}) {
  const distance = Math.hypot(g.x - boss.x, g.y - boss.y),
    closeness = Math.max(0, 1 - distance / GAON_CLOSE_RANGE),
    amount = 18 + Math.round(closeness * closeness * 68);
  if (!options.finisher)
    emitAbilityFx(
      g,
      g.x,
      g.y,
      104,
      0.38,
      Math.atan2(boss.y - g.y, boss.x - g.x),
    );
  queueUnitAssist(g, amount, name, options);
}
function resolveLongshot(g, name = "미리내 거리 저격", options = {}) {
  const distance = Math.hypot(g.x - boss.x, g.y - boss.y),
    amount =
      17 +
      Math.round(Math.min(560, distance) * 0.105) +
      Math.round(g.travel / 55);
  if (!options.finisher)
    emitAbilityFx(
      g,
      g.x,
      g.y,
      102,
      0.48,
      Math.atan2(boss.y - g.y, boss.x - g.x),
    );
  queueUnitAssist(g, amount, name, options);
}
function detonateShockwave(g, name = "모루 충돌 충격파", options = {}) {
  const hits = Math.max(1, g.collisions || 0),
    radius = 94 + hits * 15,
    amount = Math.round((8 + hits * 7) * (ball.blaze?.mult || 1)),
    targets = [...adds.filter((a) => a.down <= 0), boss];
  /* 아래 비피니셔 경로는 지금 아무도 부르지 않는다 — 충격파는 정산에서만
     터진다. 접점 발동을 되살릴 때를 위해 남긴다. */
  if (!options.finisher) {
    emitAbilityFx(g, g.x, g.y, Math.min(184, 88 + hits * 10), 0.58);
    fieldFx.push({
      type: "shockwave",
      x: g.x,
      y: g.y,
      t: 0,
      d: 0.62,
      col: g.col,
    });
    /* 충격파의 비피니셔 경로는 어시스트를 큐에 넣지 않고 즉시 광역 정산한다.
       예전에는 여기서 afterUnitAssistQueued를 직접 울렸는데, 그 페이로드의
       shot이 이전 발의 무관한 어시스트(assistShots.at(-1))를 가리켜 그
       delay·dur를 덮어썼다. 훅 발화는 queueUnitAssist 안으로 옮겼고, 여기는
       소비자가 만들던 각성 비트·효과음만 직접 남긴다. */
    feedbackBeat("awaken", g.x, g.y, g.col, 1.08, g.s + " 각성");
    combatSfx("awaken", 0.9);
  }
  if (options.finisher) {
    queueUnitAssist(g, amount, name, { ...options, areaRadius: radius });
    return;
  }
  areaBursts.push({ x: g.x, y: g.y, r: radius, col: g.col, t: 0, d: 0.52 });
  for (const target of targets) {
    if (Math.hypot(target.x - g.x, target.y - g.y) > radius) continue;
    if (target === boss) {
      const dealt = applyBossHit(amount);
      registerBossHit(false);
      if (dealt > 0)
        addPopup(boss.x, boss.y - 70, name + " -" + dealt, g.col, hits >= 4);
      if (boss.hp <= 0) scheduleWin();
    } else damageAdd(target, amount, name, g.col);
  }
  toast(name + " · " + hits + " 충돌");
  sync();
}
function resolveShockwaveAssist(a) {
  const targets = [...adds.filter((add) => add.down <= 0), boss];
  for (const target of targets) {
    if (Math.hypot(target.x - a.fromX, target.y - a.fromY) > a.areaRadius)
      continue;
    if (target === boss) {
      const dealt = applyBossHit(a.amount);
      registerBossHit(false);
      if (dealt > 0)
        addPopup(boss.x, boss.y - 70, a.name + " -" + dealt, a.col, true);
      if (boss.hp <= 0) scheduleWin();
    } else damageAdd(target, a.amount, a.name, a.col);
  }
  areaBursts.push({
    x: a.fromX,
    y: a.fromY,
    r: a.areaRadius,
    col: a.col,
    t: 0,
    d: 0.72,
  });
  impact(true, boss.x, boss.y, a.finisher ? "finisher" : "default");
  toast(a.name + " · 충격파 폭발");
  syncBossHealth();
}
function splitRuneBall(g, incoming) {
  if (ball.splitUsed) return;
  ball.splitUsed = true;
  const speed = Math.max(780, Math.hypot(incoming.x, incoming.y) * 0.9),
    angle =
      Math.atan2(incoming.y, incoming.x) + (incoming.x >= 0 ? 0.56 : -0.56),
    clone = {
      x: ball.x,
      y: ball.y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      r: 10,
      t: 4,
      hitCooldown: 0,
      contactCooldown: 0.1,
      power: ball.power || 0,
      trail: [],
    };
  cloneBalls.push(clone);
  emitAbilityFx(g, g.x, g.y, 114, 0.64);
  ball.runeBurst = 0.9;
  fieldFx.push({ type: "mirror", x: g.x, y: g.y, t: 0, d: 0.7, col: g.col });
  addPopup(g.x, g.y - 38, "유성 분열!", g.col, true);
  toast(g.s + " · 두 번째 유성 생성");
  msg = g.s + "의 분열체도 별지기를 굴리고 고유 능력을 발동합니다.";
}
function redirectToNearestUnit(g) {
  const target = nearestGate(g, g.x, g.y);
  if (!target) return;
  const dx = target.x - ball.x,
    dy = target.y - ball.y,
    d = Math.hypot(dx, dy) || 1,
    speed = Math.max(1170, Math.hypot(ball.vx, ball.vy) + 360);
  ball.vx = (dx / d) * speed;
  ball.vy = (dy / d) * speed;
  ball.power += 0.46;
  ball.runeBurst = 0.85;
  emitAbilityFx(
    g,
    g.x,
    g.y,
    104,
    0.48,
    Math.atan2(target.y - g.y, target.x - g.x),
  );
  fieldFx.push({ type: "relay", x: g.x, y: g.y, t: 0, d: 0.5, col: g.col });
  toast(g.s + " · " + target.s + "에게 강제 중계");
  msg = g.s + " · 가장 가까운 " + target.s + "에게 유성을 재발사합니다.";
}
function reportBladeWheelHit() {}
function isBladeWheelPhasing(g) {
  const fx = g.fx === "copycat" ? g.copiedFx : g.fx;
  // The phase is the payoff for the awakening that armed the wheel, on every
  // combat table.
  return fx === "bladewheel" && g.bladeAwake;
}
/* 윤슬은 정산 공격이 없다 — 회전 칼날이 그의 정산이다. 그래서 이 켜짐은
   다른 별지기의 「정산 공격」과 같은 자리에 있어야 한다: 각성하면 켜진다.
   패링 전용으로 묶여 있던 동안, 패링하지 않은 샷에서 윤슬만 판을 가로질러도
   아무것도 하지 않는 유일한 별지기였다. */
function armBladeWheel(g) {
  const fx = g.fx === "copycat" ? g.copiedFx : g.fx;
  if (fx !== "bladewheel" || g.bladeAwake) return;
  g.bladeAwake = true;
  fieldFx.push({
    type: "bladewheel",
    x: g.x,
    y: g.y,
    t: 0,
    d: 0.5,
    col: g.col,
  });
  addPopup(g.x, g.y - 38, "질풍 칼날!", g.col, true);
  toast(g.s + " · 이동 속도로 회전 칼날 강화");
}
function updateBladeWheel(g, speed, step) {
  const fx = g.fx === "copycat" ? g.copiedFx : g.fx;
  if (fx !== "bladewheel") return;
  // The wheel is Ria's whole read: it spins in proportion to how fast she is
  // moving.  A smaller constant term makes that proportion visible instead of
  // hiding it under a fast idle spin.
  g.bladeAngle = (g.bladeAngle || 0) + step * (3.2 + speed / 62);
  g.bladeTick = Math.max(0, (g.bladeTick || 0) - step);
  g.bladePopupCooldown = Math.max(0, (g.bladePopupCooldown || 0) - step);
  // It used to fade out at speed 82, so the wheel vanished while she was still
  // clearly rolling.  It now stays lit until she is nearly still; damage still
  // needs real speed (the 105 gate below), so this is readability only.
  /* 각성 여부가 이 목표값에 들어와야 한다. 아래 `if (!g.bladeAwake) return`은
     피해만 막고 있었고, 세기는 그 앞에서 순수 속도로 올라갔다 — 깨우지 않고
     그냥 부딪혀 굴러가기만 해도(속도 10 초과) 한 프레임 만에 0.05가 되어
     그리기 문턱 0.025를 넘겼다. 그림과 피해는 한 문(門)을 쓴다: 깨어나기
     전에는 목표가 0이고 램프가 알아서 꺼진다. */
  const targetStrength =
    g.bladeAwake && speed > 10 ? Math.min(1, 0.2 + (speed - 10) / 700) : 0;
  g.bladeStrength =
    (g.bladeStrength || 0) +
    (targetStrength - (g.bladeStrength || 0)) * Math.min(1, step * 15);
  if (!g.bladeAwake) return;
  if (speed < 105 || g.bladeTick > 0 || battleComplete) return;
  g.bladeTick = 0.14;
  const radius = 58 + Math.min(38, speed * 0.038),
    amount = 3 + Math.min(13, Math.floor(speed / 105));
  let hit = false;
  if (boss?.hp > 0 && Math.hypot(g.x - boss.x, g.y - boss.y) <= radius + 58) {
    const dealt = applyBossHit(amount);
    g.bladeDamageBank = (g.bladeDamageBank || 0) + dealt;
    reportBladeWheelHit(g, boss, dealt);
    hit = true;
    if (boss.hp <= 0) scheduleWin();
  }
  for (const add of adds) {
    if (
      add.down > 0 ||
      add.hitCooldown > 0 ||
      Math.hypot(g.x - add.x, g.y - add.y) > radius + add.r
    )
      continue;
    damageAdd(add, amount, g.s + " 회전 칼날", g.col);
    reportBladeWheelHit(g, add, amount);
    hit = true;
  }
  if (hit && g.bladePopupCooldown <= 0) {
    g.bladePopupCooldown = 0.34;
    if (g.bladeDamageBank > 0) {
      registerBossHit(false);
      addPopup(
        boss.x,
        boss.y - 78,
        g.s + " 질풍 칼날 -" + g.bladeDamageBank,
        g.col,
        g.bladeDamageBank >= 18,
      );
      g.bladeDamageBank = 0;
    }
    if (typeof feedbackBeat === "function")
      feedbackBeat("unit", g.x, g.y, g.col, 0.74, "회전 베기");
    syncBossHealth();
  }
}
function applyContactAbility(g, incoming) {
  if (g.contactCooldown > 0) return false;
  g.contactCooldown = 0.13;
  const fx = g.fx === "copycat" ? g.copiedFx : g.fx;
  if (fx === "split") {
    splitRuneBall(g, incoming);
    return true;
  }
  if (fx === "seek") {
    redirectToNearestUnit(g);
    return true;
  }
  /* 검기·저격·충격파는 여기로 돌아오지 않는다. 2954f79가 이 셋을 정산에서
     패링 접점으로 옮겼는데, 각성이 다시 움직임으로 돌아온 지금 둘 다 두면
     한 번의 패링이 같은 능력을 두 번 값을 치른다. 이 셋의 자리는 정산이다
     (settleParty). 남는 것은 접점에서만 뜻이 있는 둘 — 유성을 쪼개는 별하와
     유성을 넘기는 살별이다. 윤슬의 칼날은 wakeUnit이 각성과 함께 켠다. */
  return false;
}
function nearestGate(excluded, fromX, fromY) {
  let target = null,
    bestDistance = Infinity;
  for (const gate of gates) {
    if (gate === excluded) continue;
    const dx = gate.x - fromX,
      dy = gate.y - fromY,
      distance = dx * dx + dy * dy;
    if (distance < bestDistance) {
      target = gate;
      bestDistance = distance;
    }
  }
  return target;
}
function activateCloneUnit(o, g, incoming) {
  if (o.contactCooldown > 0) return;
  o.contactCooldown = 0.14;
  const fx = g.fx === "copycat" ? g.copiedFx || "copycat" : g.fx;
  const speed = Math.max(760, Math.hypot(o.vx, o.vy));
  if (fx === "split" && !ball.splitUsed) {
    ball.splitUsed = true;
    const angle = Math.atan2(o.vy, o.vx) + 0.58;
    cloneBalls.push({
      x: o.x,
      y: o.y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      r: o.r,
      t: Math.max(1.4, o.t - 0.15),
      hitCooldown: 0.1,
      contactCooldown: 0.18,
      power: o.power || 0,
      trail: [],
    });
    emitAbilityFx(g, g.x, g.y, 112, 0.54, angle);
    toast("별하 · 분열체 추가 분열!");
  } else if (fx === "seek") {
    const target = nearestGate(g, o.x, o.y);
    if (target) {
      const dx = target.x - o.x,
        dy = target.y - o.y,
        l = Math.hypot(dx, dy) || 1;
      o.vx = (dx / l) * (speed + 260);
      o.vy = (dy / l) * (speed + 260);
      emitAbilityFx(g, g.x, g.y, 94, 0.42, Math.atan2(dy, dx));
      toast("살별 · 분열체 강제 중계!");
    }
  }
  queueUnitAssist(
    g,
    12 + Math.min(16, Math.round(speed / 110)),
    g.s + " 분열체 연계",
  );
  fieldFx.push({ type: "relay", x: g.x, y: g.y, t: 0, d: 0.42, col: g.col });
}
const bossWeakPoint = { x: 0, y: 0 };
function cloneDamage(o, weak = false) {
  if (o.hitCooldown > 0 || battleComplete) return;
  o.hitCooldown = 0.28;
  const amount = Math.max(
    10,
    Math.round((18 + (o.power || 0) * 7) * (weak ? 1.55 : 1)),
  );
  const dealt = applyBossHit(amount);
  registerBossHit(weak);
  impact(weak);
  if (dealt > 0)
    addPopup(
      o.x,
      o.y - 24,
      (weak ? "분열 약점" : "분열체") + " -" + dealt,
      "#8df5ef",
      weak,
    );
  fieldFx.push({
    type: "mirror",
    x: o.x,
    y: o.y,
    t: 0,
    d: 0.35,
    col: "#70dce1",
  });
  if (boss.hp <= 0) scheduleWin();
  sync();
}
function updateCloneBalls(step) {
  bossWeakPoint.x = boss.x + Math.cos(boss.a) * 84;
  bossWeakPoint.y = boss.y + Math.sin(boss.a) * 84;
  let writeClone = 0;
  for (let index = 0; index < cloneBalls.length; index++) {
    const o = cloneBalls[index];
    o.t -= step;
    o.hitCooldown = Math.max(0, o.hitCooldown - step);
    o.contactCooldown = Math.max(0, (o.contactCooldown || 0) - step);
    o.x += o.vx * step;
    o.y += o.vy * step;
    const drag = Math.pow(0.989, step * 60);
    o.vx *= drag;
    o.vy *= drag;
    tickGimmickCooldowns(o, step);
    mobileWall(o, o.r);
    applyStageGimmicks(o);
    for (const b of bumpers)
      mobileStatic(o, b, o.r + b.r, 1.06, () => {
        const speed = Math.hypot(o.vx, o.vy) || 1,
          boost = Math.min(1740, speed + 120);
        o.vx *= boost / speed;
        o.vy *= boost / speed;
        o.power = (o.power || 0) + 0.14;
        fieldFx.push({
          type: "bumper",
          x: b.x,
          y: b.y,
          t: 0,
          d: 0.28,
          col: "#80e8df",
        });
      });
    for (const g of gates)
      mobilePair(o, o.r, g, g.r, (nx, ny, impactSpeed, incoming) => {
        const speed = Math.hypot(incoming.x, incoming.y) || 1,
          ux = incoming.x / speed,
          uy = incoming.y / speed,
          cloneDrive = 390 + Math.min(310, impactSpeed * 0.48),
          unitDrive = 360 + Math.min(330, impactSpeed * 0.44),
          cloneDx = -nx * cloneDrive + ux * 145,
          cloneDy = -ny * cloneDrive + uy * 145,
          unitDx = nx * unitDrive + ux * 120,
          unitDy = ny * unitDrive + uy * 120;
        o.vx += cloneDx;
        o.vy += cloneDy;
        g.vx += unitDx;
        g.vy += unitDy;
        guaranteeMomentum(o, cloneDx, cloneDy, 760, 1880);
        guaranteeMomentum(g, unitDx, unitDy, 585, 1580);
        o.power = (o.power || 0) + 0.34;
        g.collisions = (g.collisions || 0) + 1;
        wakeUnit(g);
        activateCloneUnit(o, g, incoming);
        addPopup(g.x, g.y - 32, "분열 연계!", g.col, true);
      });
    for (const a of adds) {
      if (a.down > 0) continue;
      mobileStatic(o, a, o.r + a.r, 0.9, () => {
        if (a.hitCooldown <= 0)
          damageAdd(
            a,
            12 + Math.round((o.power || 0) * 5),
            "분열체 직격",
            "#8df5ef",
          );
      });
    }
    const weak = mobileStatic(o, bossWeakPoint, o.r + 25, 1.01, () =>
      cloneDamage(o, true),
    );
    if (!weak)
      mobileStatic(o, boss, o.r + 66, 0.9, () => cloneDamage(o, false));
    o.trailSample = (o.trailSample || 0) + step;
    if (o.trailSample >= 1 / 60) {
      o.trailSample = 0;
      o.trail.push({ x: o.x, y: o.y });
      if (o.trail.length > 14) o.trail.shift();
    }
    if (o.t > 0 && o.vx * o.vx + o.vy * o.vy > 45 * 45)
      cloneBalls[writeClone++] = o;
  }
  cloneBalls.length = writeClone;
}
function drawCloneBalls() {
  for (const o of cloneBalls) {
    for (let i = 1; i < o.trail.length; i++) {
      x.strokeStyle = "#7ceeea66";
      x.lineWidth = 1.5;
      x.beginPath();
      x.moveTo(o.trail[i - 1].x, o.trail[i - 1].y);
      x.lineTo(o.trail[i].x, o.trail[i].y);
      x.stroke();
    }
    circle(o.x, o.y, o.r + 3, "#70dce1", 17);
    circle(o.x, o.y, o.r, "#effffd", 13);
    circle(o.x - 2, o.y - 2, 3, "#8af4ef", 2);
  }
}
registerRuntimeHook("beforeShotStart", (context) => {
  const { restingPoint } = context;
  if (restingPoint && gates.length) {
    context.handled = true;
    cloneBalls = [];
    ball = {
      x: clamp(restingPoint.x, 31, W - 31),
      y: clamp(restingPoint.y, 31, H - 31),
      vx: 0,
      vy: 0,
      r: 13,
      moving: false,
      trail: [],
      power: 0,
      bounces: 0,
      launchPower: 0.35,
      billiards: true,
      mark: Boolean(battle.nextMark),
      pulse: battle.nextPulse || 0,
      steerUsed: false,
      steerFlash: 0,
      firstImpact: null,
      starkeeperTouched: false,
      openingBossContact: false,
      blaze: createBlaze(),
    };
    battle.nextMark = false;
    battle.nextPulse = 0;
    for (const g of gates) {
      g.vx = 0;
      g.vy = 0;
      g.moved = false;
      g.awake = false;
      g.wakeFlash = 0;
      g.travel = 0;
      g.collisions = 0;
      g.wallHits = 0;
      g.bossHit = false;
      g.unitTrail = [];
      g.animState = "idle";
      g.contactCooldown = 0;
      g.enemyHitCooldown = 0;
      g.feedbackContactCooldown = 0;
      g.bladeAngle = 0;
      g.bladeStrength = 0;
      g.bladeTick = 0;
      g.bladePopupCooldown = 0;
      g.bladeDamageBank = 0;
      g.bladeAwake = false;
      g.bossPhaseUntilClear = false;
      g.bossPhaseVx = 0;
      g.bossPhaseVy = -1;
    }
    drag = null;
    renderBlaze();
    return;
  }
});
registerRuntimeHook("afterShotStart", ({ restingPoint }) => {
  if (restingPoint) return;
  cloneBalls = [];
  ball.blaze = createBlaze();
  ball.steerUsed = false;
  ball.steerFlash = 0;
  ball.firstImpact = null;
  ball.starkeeperTouched = false;
  ball.openingBossContact = false;
  renderBlaze();
  for (const g of gates) {
    g.vx = 0;
    g.vy = 0;
    g.moved = false;
    g.awake = false;
    g.wakeFlash = 0;
    g.travel = 0;
    g.collisions = 0;
    g.wallHits = 0;
    g.bossHit = false;
    g.unitTrail = [];
    g.mass = 1;
    g.contactCooldown = 0;
    g.enemyHitCooldown = 0;
    g.feedbackContactCooldown = 0;
    g.bladeAngle = 0;
    g.bladeStrength = 0;
    g.bladeTick = 0;
    g.bladePopupCooldown = 0;
    g.bladeDamageBank = 0;
    g.bladeAwake = false;
    g.bossPhaseUntilClear = false;
    g.bossPhaseVx = 0;
    g.bossPhaseVy = -1;
  }
});
function wakeUnit(g, { subtle = false } = {}) {
  // A phase rule can put a starkeeper back to sleep under a guard: the first
  // collisions only shake it, and it wakes on the one that clears the guard.
  if (g.sleepGuard > 0) {
    g.sleepGuard -= 1;
    // The collision that clears the guard is the one that wakes it, so a
    // guard of 2 means exactly two collisions, not three.
    if (g.sleepGuard > 0) {
      g.on = Math.max(g.on, 0.4);
      g.animState = "move";
      g.animClock = 0;
      addPopup(
        g.x,
        g.y - 40,
        g.s + " 아직 잠듦 " + g.sleepGuard,
        "#8ba39f",
        false,
      );
      combatSfx?.("hit", 0.4);
      return;
    }
  }
  if (g.animState !== "move") g.animClock = 0;
  // The first wake of a shot is the moment the player needs to read, so it
  // gets a ring, a label and a lasting halo instead of only a glow bump.
  // `awake` is cleared with `moved` when the next shot is prepared.
  // "깨어남" is the collision moment; the settle pass keeps "각성" for the
  // attack itself, so the two readings never collide on screen.
  if (!g.awake) {
    g.awake = true;
    g.wakeFlash = subtle ? 0.34 : 0.62;
    /* 깨어난 별지기가 «자기 자리에서» 말한다(§5). 예전에는 화면 오른쪽 위
       토스트로 나가서, 판 위에서 벌어진 일과 그 말이 서로 다른 곳에 있었다.
       꼬리가 화자를 가리키므로 이름을 다시 쓰지 않는다. */
    StellaRuntime.modules
      .optional("speech")
      ?.say("unit", subtle ? "공명했다" : "깨어났다", { gate: g });
    areaBursts.push({
      x: g.x,
      y: g.y,
      r: g.r + (subtle ? 17 : 34),
      col: g.col,
      t: 0,
      d: subtle ? 0.26 : 0.44,
    });
    addPopup(
      g.x,
      g.y - 40,
      g.s + (subtle ? " 공명 각성" : " 깨어남!"),
      g.col,
      true,
    );
    combatSfx?.("awaken", subtle ? 0.48 : 0.78);
    armBladeWheel(g);
  }
  g.moved = true;
  g.on = Math.max(g.on, subtle ? 0.52 : 0.72);
  // Rolling is only for decisive movement.  Slow residual slides should settle
  // into the resting token instead of continuously tumbling in place.
  g.animState = "move";
}

// Drawn after the base pass so the halo sits on top of the unit token. It
// reads state that already exists on each gate, so no new particle array is
// introduced.
registerRuntimeHook("afterDraw", function drawAwakeMarkers() {
  if (!run && !battle) return;
  for (const g of gates) {
    if (!g.awake) continue;
    const flash = g.wakeFlash > 0 ? g.wakeFlash / 0.62 : 0;
    x.save();
    x.translate(g.x, g.y);
    x.rotate((frameClock || 0) / 900);
    x.strokeStyle = g.col;
    x.globalAlpha = 0.42 + flash * 0.5;
    x.lineWidth = 2 + flash * 2;
    x.setLineDash([6, 7]);
    x.beginPath();
    x.arc(0, 0, g.r + 11 + flash * 13, 0, Math.PI * 2);
    x.stroke();
    x.restore();
  }
});
function playUnitAttack(g) {
  // Give the four-frame strike a full, readable beat after the table settles.
  g.on = Math.max(g.on, 1.35);
  g.animState = "attack";
  g.animClock = 0;
}
