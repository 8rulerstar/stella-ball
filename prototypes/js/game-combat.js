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
  /* 전투의 «첫» 조준 화면은 afterShotEnd를 지나지 않는다 — 수업 밖 첫
     실전의 루나 첫 멘트(luna-pick0)가 붙을 자리가 정확히 여기다. */
  if (
    typeof nodeEconomyOn === "function" &&
    nodeEconomyOn() &&
    typeof aimStarReady === "function" &&
    aimStarReady()
  )
    emitAimChanged?.("open");
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
  /* 피해 토스트 «뒤»에 콤보를 센다. 원래 setTimeout(…,0)이 이 순서를
     지켰는데, 그 지연을 걷어내며 「연타!」가 자기를 만든 피해보다 먼저
     재생되게 뒤집혔다 — 타이머 없이 호출 순서로 같은 계약을 지킨다.
     (모든 직격이 콤보를 늘린다는 원 규칙 그대로: 미경유 직격·첫 직격 포함.) */
  if (dealt > 0) registerBossHit(weak);
  if (boss.hp <= 0) scheduleWin();
  ball.power = 0;
  ball.openingBossContact = false;
  if (weak) {
    ball.mark = false;
    if (dealt > 0) dropWeakpointStars();
  }
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
    x.shadowBlur = combatFxBlur(pad.on > 0 ? 24 : 10);
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
    x.shadowBlur = combatFxBlur(orbit.hitCooldown > 0 ? 22 : 10);
    x.shadowColor = "#7cc6bb";
    x.beginPath();
    x.rect(-orbit.r, -orbit.r * 0.62, orbit.r * 2, orbit.r * 1.24);
    x.fill();
    x.stroke();
    x.shadowBlur = combatFxBlur(0);
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
      x.shadowBlur = combatFxBlur(16);
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
      x.shadowBlur = combatFxBlur(hot ? 20 : 9);
      x.shadowColor = "#9adfc9";
      // 판 하나는 두꺼운 호 + 안쪽 테두리. 두 겹이라 「판」으로 읽힌다.
      x.lineWidth = 7;
      x.beginPath();
      x.arc(boss.x, boss.y, r, a0, a0 + span);
      x.stroke();
      x.globalAlpha *= 0.55;
      x.lineWidth = 2;
      x.shadowBlur = combatFxBlur(0);
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
  /* 입장 연출 중의 첫 입력은 «건너뛰기»만 하고 끝난다. 재도전이 잦은
     게임에서 연출이 기다림이 되면 안 되지만, 예전에는 여기서 건너뛴 다음
     그대로 아래 드래그로 흘러갔다 — 한 번의 누름이 연출을 건너뛰고 조준하고
     발사까지 했다. 연출을 넘기려던 손이 유성을 쏘고 있었다.
     건너뛴 입력은 여기서 삼킨다. 조준은 다음 누름부터다. */
  if (skipBattleIntro()) {
    e.preventDefault();
    e.stopImmediatePropagation();
    return;
  }
  // `battleComplete` matters here as much as `run`. scheduleWin freezes the
  // meteor and marks the battle complete but deliberately leaves `run` true
  // for the 2.55s victory cutscene, and every other combat entry point is
  // guarded on battleComplete - only the launch path was not. That let a drag
  // during the death animation spend `battle.shots`, which the result card
  // reads back as the medal and the shot count, and repeated drags drove the
  // counter negative in the HUD.
  if (!run || paused || battleComplete || isCombatInputLocked()) return;
  if (!ball?.moving) {
    const p = pointer(e);
    /* 조준은 «찍기»다. 별지기·별빛을 클릭해 셋 이상 고르고 Space로 쏜다.
       오른쪽 버튼은 고른 것을 전부 무른다 — 유성이 멈춰 있을 때 오른쪽
       버튼은 원래 하는 일이 없다.

       한 번 드래그로 훑는 방식으로 갔다가 돌아왔다. 손맛은 그쪽이 나았지만
       탭과 획의 경계가 계속 문제였고(탭이 곧 발사가 됐다), 무엇보다 고른 뒤
       가만히 보며 고칠 시간이 없었다 — 놓는 순간 나가므로. 찍기는 몇 번이고
       고쳐 고를 수 있다. */
    if (aimStarReady()) {
      e.preventDefault();
      e.stopImmediatePropagation();
      if (e.button !== 0) {
        if (aimPick.length) {
          aimPick = [];
          // 성립 플래시·거절 연출도 함께 무른다 — 하한 미달로 돌아간 선이
          // «성립» 빛을 물고 있으면 안 된다. 반대편도 여기서 돌아온다:
          // «전부 무르기» 뒤에 새로 고른 셋이 거울 방향으로 나가면, 지운
          // 상태가 발사 방향을 몰래 쥐고 있는 셈이다.
          aimReadyFlash = 0;
          aimDenyT = 0;
          aimFlip = false;
          combatSfx?.("parryMiss", 0.5);
          emitAimChanged("clear");
        }
        return;
      }
      const hit = aimStarAt(p.x, p.y);
      if (hit < 0) {
        /* 빈 곳은 «가고 싶은 쪽»이다. 유성을 기준으로 무게중심 쪽을 누르면
           정방향, 반대쪽을 누르면 반대편으로 쏜다 — 누른 곳이 곧 갈 곳이라
           설명이 필요 없다. 아직 셋을 못 골랐으면 고르는 것이 먼저다. */
        if (aimPick.length < AIM_STAR.minPick) {
          toast("별지기·별빛을 셋 이상 찍고 Space로 발사하세요");
          return;
        }
        const base = aimStarShot(aimPick);
        if (!base) return;
        // 부호를 뺀 «무게중심 쪽» 벡터로 판단해야 이미 뒤집힌 상태에서도
        // 누른 쪽이 그대로 결과가 된다.
        const ux = base.cx - ball.x || 0,
          uy = base.cy - ball.y || 0,
          side = (p.x - ball.x) * ux + (p.y - ball.y) * uy;
        const want = side < 0;
        if (want !== aimFlip) {
          aimFlip = want;
          // 한 번 뒤집어 봤으면 어포던스 라벨을 끈다(핸드오프 §2-3).
          // 세션이 아니라 저장 슬롯에서 영구 소등이라 progress에도 적는다.
          // 단 수업 중은 제외 — 라벨이 lessonGuide로 접혀 «본 적 없는»
          // 힌트가 소등되면 캠페인에서 영영 못 본다.
          if (
            !(
              typeof onboardingLessonGuideActive === "function" &&
              onboardingLessonGuideActive()
            )
          ) {
            if (typeof aimTeach === "object" && aimTeach)
              aimTeach.flipped = true;
            markAimHintDone?.("flip");
          }
          combatSfx?.("steer", 0.5);
          addPopup(
            ball.x,
            ball.y - 34,
            aimFlip ? "반대편" : "가운데 쪽",
            "#ffe09a",
            true,
          );
          emitAimChanged("flip");
        }
        return;
      }
      pickAimStar(hit);
      return;
    }
    if (e.button !== 0) return;
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
/* 노드(별지기·별빛)를 고르고 무른다. 상한은 없고 하한이 3이다 — 근거는
   AIM_STAR.minPick 주석. 개수가 많을수록 무게중심 위치가 촘촘해지는 성질은
   그대로다. */
function pickAimStar(index) {
  const at = aimPick.indexOf(index),
    node = aimNodes()[index];
  if (at >= 0) {
    // 다시 찍으면 무른다. 뒤엣것은 그대로 두고 순서만 당겨진다.
    aimPick.splice(at, 1);
    // 하한 아래로 내려가면 «조준 성립» 플래시도 성립을 잃는다.
    if (aimPick.length < AIM_STAR.minPick) aimReadyFlash = 0;
    combatSfx?.("node", 0.5);
    // 무른 자리에 잿빛 불씨 - 「빠졌다」가 소리로만 남으면 놓친다.
    if (node)
      fieldFx.push({
        type: "spark",
        x: node.x,
        y: node.y,
        t: 0,
        d: 0.3,
        col: "#8f83ad",
      });
    emitAimChanged("unpick");
    return false;
  }
  aimPick.push(index);
  combatSfx?.("node", 0.6 + Math.min(3, aimPick.length) * 0.1);
  if (node) {
    /* 찍는 순간의 플래시. 별지기는 게이트 객체에, 별빛은 별빛 객체에 남긴다 —
       별지기 래퍼는 aimNodes()가 매번 새로 만들어 상태를 못 든다. */
    if (node.unit) node.unit.aimFlash = 0.3;
    else node.pickFlash = 0.3;
    addPopup(
      node.x,
      node.y - (node.unit ? 44 : 30),
      String(aimPick.length),
      node.col,
      true,
    );
  }
  /* 셋째를 찍는 순간이 «조준 성립»이다. 하한이 생기면서 이 순간이 규칙의
     문턱이 됐으니, 문턱을 넘었다는 것이 보이고 들려야 한다. */
  if (aimPick.length === AIM_STAR.minPick) {
    aimReadyFlash = 0.4;
    combatSfx?.("mult", 0.55);
  }
  emitAimChanged("pick");
  return true;
}
function billiardPointerMove(e) {
  if (!drag) {
    // 어느 별빛 위에 있는지만 본다. 미리보기가 그것을 «다음 하나»로 잡는다.
    // 별자리 캐스트 등으로 입력이 잠긴 동안에는 호버도 잡지 않는다 —
    // 클릭이 먹히지 않는데 호버 링·가정 선만 살아 있으면 거짓 광고다.
    if (!ball?.moving && aimStarReady() && !isCombatInputLocked()) {
      const at = pointer(e);
      aimHover = aimStarAt(at.x, at.y);
    } else if (aimHover !== -1) aimHover = -1;
    return;
  }
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
  fireMeteor(dx, dy, clamp(pullLength / 220, 0.28, 1));
}
/* ── 노드 조준 ──────────────────────────────────────────────────────────
   조준 노드는 두 종류다 — 배치된 별지기 셋(항상 있다), 그리고 공명과
   약점이 남긴 별빛(벌어야 있다). 그중 셋 이상을 순서대로 찍으면 그 점들이
   다음 유성을 정한다.

     방향 = 유성 → 고른 점들의 «무게중심»
     세기 = 고른 점들이 이루는 도형의 «크기»

   외심(외접원 중심)은 쓰지 않는다. 세 점이 거의 일직선이면 중심이 판 밖
   무한대로 날아가 조준이 폭발한다. 무게중심은 언제나 삼각형 안에 있다.

   «크기»는 넓이가 아니라 무게중심에서 세 꼭짓점까지의 평균 거리다. 넓이는
   길이의 제곱으로 자라 손끝에서 비선형으로 느껴진다 — 조금 벌린 것과 두 배
   벌린 것의 차이가 네 배가 된다.

   여기서 저울질이 생긴다: 크게 벌릴수록 세지만 그렇게 벌릴 수 있는 조합은
   적고, 작게 모으면 약하지만 고를 수 있는 조합이 촘촘하다. */
/* 조준 방식. "centroid"가 지금 값이고, "arrow"로 바꾸면 화살표 방식이
   돌아온다.

   무게중심: 훑은 별빛들의 «가운데»로 간다. 세기는 그 가운데에서 별빛까지의
   평균 거리 — 넓게 훑으면 세고 좁게 훑으면 약하다.

   한 번 화살표(꼬리 중점 -> 촉)로 갔다가 돌아왔다. 오너 지적:
   「무게중심은 어디로 쏘는지가 확실한데 화살표는 너무 힘듦」.
   맞는 지적이다. 무게중심은 «목표점»을 고르는 일이라 눈으로 즉시 보이지만,
   화살표는 벡터를 구한 뒤 그것을 유성 위치로 평행이동해야 한다 — 머릿속에서
   두 단계다.

   그리고 자유도까지 무게중심이 낫다. 처음에 화살표로 간 근거는 무게중심을
   «3개 고정»으로만 잰 값이었는데, 그리기 입력에서는 몇 개든 훑을 수 있다.
   같은 판에서 다시 재니(30판):

                        선택지  방향칸  보스에서 벗어남
     무게중심 3개고정      4       3         31도
     무게중심 개수자유    15       5          2도
     화살표               11       5         17도

   별빛 하나를 더 훑으면 가운데가 그쪽으로 끌려간다. 촘촘하고 예측 가능하다. */
const AIM_MODE = "centroid";
const AIM_STAR = {
  max: 9, // 화면이 난장판이 되지 않는 상한. 조합은 C(9,3)=84가지다.
  /* 최소 3픽 + 별지기 노드(2026-08-20, 오너 결정). 되돌리려면 minPick을
     1로, unitNodes를 false로.

     1픽을 열어 두면 «유성→그 별빛» 확정 레이가 항상 한 클릭 거리에 있다.
     약점 별빛이 보스 링(96~154px)에 깔리므로 보스행 저격이 공짜가 되고,
     위력 페널티(벌림 0 = 0.28)는 방향만 필요한 순간(마무리·약점 농사)에
     아무것도 물지 않는다 — 초속 1023이어도 마찰 적분상 주행 2000px라
     판을 두 번 가로지른다. 값을 매기거나(위력 연동) 라벨을 바꾸는(깎기)
     설계는 전부 같은 분할 선택 공간이라 레이가 살아남았다.

     최소 3이면 방향이 언제나 삼각형의 무게중심이라 한 점 레이가 구조적으로
     없다. 남는 구멍은 «셋이 한곳에 뭉친» 경우뿐인데, 그건 벌림 0이라 위력
     최소이고 판이 우연히 줘야만 생기므로 버튼이 아니다. 예전 «3개 고정»
     실측(선택지 4, 보스에서 31도)은 별빛 기근 시절 값이다 — 지금은 별지기
     3 + 약점 별빛 +2/타라 조합 바닥이 C(3,3)=1이 아니라 위로 열려 있다. */
  minPick: 3,
  unitNodes: true,
  pickRadius: 26,
  // 화살표 길이가 이 값이면 최대 위력이다. 250으로 재니 위력 중앙이 0.94로
  // 붙박여 세기 선택이 죽었다 — 화살표는 무게중심보다 길게 나온다.
  fullLength: 420,
  // "centroid" 모드에서 쓰는 값. 무게중심에서 꼭짓점까지의 평균 거리다.
  fullRadius: 250,
  life: 0, // 0이면 전투 내내 남는다. 소멸 규칙은 아직 넣지 않았다(4번 보류).
};
/* 약점을 때리면 보스 둘레에 별빛 둘이 떨어진다.

   조준과 별자리의 재료를 «보스 근처»에 놓는다는 것이 이 규칙의 핵심이다 —
   별자리는 둘러싼 것을 때리므로(실측: 보스를 감싸면 42, 못 감싸면 0), 보스
   둘레의 별빛은 그대로 다음 별자리의 자리가 된다. 약점을 노릴 이유가 피해
   1.7배 하나에서 「다음 판을 짜는 재료」로 늘어난다.

   Math.random을 쓰지 않는다. 이 파일은 하니스가 읽는 목록에 있고, 그 시드
   재현성은 「난수를 aimSigma 한 곳에서만 쓴다」는 전제 위에 있다(BOT_REPORT
   0-3·0-7). 대신 황금각(2.39996rad)으로 돌린다 — 연속으로 떨어져도 한쪽에
   뭉치지 않아 눈에는 흩뿌린 것으로 보이고, 같은 입력이면 같은 결과가 난다.
   판마다 0에서 시작하므로 리플레이도 재현된다. */
const WEAK_STAR_COUNT = 2;
let weakStarSeq = 0;
function dropWeakpointStars(count = WEAK_STAR_COUNT) {
  if (!battle || !boss || battleComplete) return;
  if (typeof nodeEconomyOn === "function" && !nodeEconomyOn()) return;
  for (let i = 0; i < count; i++) {
    weakStarSeq += 1;
    const a = weakStarSeq * 2.39996,
      r = 96 + ((weakStarSeq * 37) % 58);
    dropAimStar(
      clamp(boss.x + Math.cos(a) * r, 30, W - 30),
      clamp(boss.y + Math.sin(a) * r, 30, H - 30),
      "#ffb0d8",
      "약점",
    );
  }
}
function dropAimStar(x, y, col, label) {
  if (!battle) return;
  aimStars.push({
    x,
    y,
    col: col || "#ffd98e",
    label: label || "",
    born: 0.36,
  });
  // 오래된 것부터 밀어낸다. 방금 만든 별빛이 사라지면 인과가 끊긴다.
  if (aimStars.length > AIM_STAR.max)
    aimStars.splice(0, aimStars.length - AIM_STAR.max);
}
function resetAimStars() {
  aimStars = [];
  aimPick = [];
  aimHover = -1;
  aimFlip = false;
  aimLaunchFx = null;
  aimDenyT = 0;
  aimReadyFlash = 0;
  weakStarSeq = 0;
}
/* 조준 노드 = 배치된 별지기 + 판에 남은 별빛.

   별지기를 노드에 넣는 이유(2026-08-20, 오너 결정): 최소 3픽을 걸려면
   «노드가 3개 미만이라 못 쏘는 판»이 없어야 하는데, 캠페인 파티가 정확히
   3명이라 별지기가 그 최저 보장이 된다. 별지기 위치는 매 샷 물리로
   재배치되므로, 이번 샷에서 파티를 어떻게 밀어두느냐가 다음 샷의 조준
   메뉴가 된다 — 당구 포지션 플레이가 조준에 직결된다.

   순서 계약: 별지기 먼저, 별빛 나중. aimPick은 이 합친 목록의 인덱스를
   든다. 별빛 배열은 비행 중에만 늘고 줄며(약점·접점·안내별), 그때
   aimPick은 항상 비어 있으므로 인덱스가 낡지 않는다. gates는 전투 중
   불변이다. */
/* 프레임당 한 번만 짓는다. 조준 화면 한 프레임이 이 목록을 서너 번
   요청하고(그리기·미리보기·호버 판정), 매번 새 배열과 별지기 래퍼를
   만들면 조준하는 내내 GC 부스러기가 쌓인다 — 이 저장소가 이미 「조준
   계산의 반복 할당」을 줄여 온 계보다. 조준이 가능한 동안(유성 정지)
   별지기는 움직이지 않으므로, 같은 프레임 + 같은 개수면 그대로 쓴다. */
let aimNodesCache = { key: NaN, gatesRef: null, starsRef: null, list: [] };
function aimNodes() {
  const c = aimNodesCache;
  // 배열 «정체»로 무효화한다. setupBattle이 gates를, 소각·리셋이 aimStars를
  // 통째로 갈아 끼우므로, 개수가 우연히 같아도 낡은 목록을 돌려주지 않는다.
  if (
    c.key === frameClock &&
    c.gatesRef === gates &&
    c.starsRef === aimStars &&
    c.list.length ===
      gates.length * (AIM_STAR.unitNodes ? 1 : 0) + aimStars.length
  )
    return c.list;
  const nodes = [];
  if (AIM_STAR.unitNodes)
    for (const g of gates)
      nodes.push({ x: g.x, y: g.y, col: g.col, label: g.s, unit: g });
  for (const s of aimStars) nodes.push(s);
  c.key = frameClock;
  c.gatesRef = gates;
  c.starsRef = aimStars;
  c.list = nodes;
  return nodes;
}
/* 노드가 셋 이상이면 조준은 «찍기»다. 별지기가 늘 셋이므로 실전에서는
   항상 참이고, 드래그는 수업(온보딩·E2E, nodeEconomyOn이 끔)과 노드가
   모자란 예외 판에만 남는다. 첫 샷부터 조준 규칙이 하나로 통일된다. */
/* 조준 상태가 바뀌었다고 알린다(2026-08-21, 핸드오프 §2-6).

   훅을 하나 새로 낸 이유: 루나 멘트는 «조준 화면의 상태»에 붙는데, 전투
   체인이 speech를 직접 부르지 않는다는 기존 원칙이 있어 부를 방법이 없었다.
   화자 쪽이 듣고 스스로 판단하게 한다 — 여기서는 사실만 싣는다.

   force는 셋을 다 골랐을 때만 값이 있다. 그 전에는 방향 자체가 없으므로
   위력도 없다(aimStarShot이 null을 돌려준다). */
function emitAimChanged(reason) {
  const shot = aimPick.length >= AIM_STAR.minPick ? aimStarShot(aimPick) : null;
  runRuntimeHooks("afterAimChanged", {
    reason,
    picks: aimPick.length,
    flipped: aimFlip,
    force: shot?.force ?? 0,
    nodes: aimNodes().length,
  });
}
function aimStarReady() {
  if (typeof nodeEconomyOn === "function" && !nodeEconomyOn()) return false;
  return aimNodes().length >= AIM_STAR.minPick;
}
function aimStarAt(px, py) {
  const nodes = aimNodes();
  let best = -1,
    bestDistance = Infinity;
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i],
      // 별지기는 토큰이 크니 잡는 반경도 그만큼 넓힌다.
      reach = node.unit
        ? Math.max(AIM_STAR.pickRadius, node.unit.r + 8)
        : AIM_STAR.pickRadius,
      d = Math.hypot(node.x - px, node.y - py);
    if (d <= reach && d < bestDistance) {
      bestDistance = d;
      best = i;
    }
  }
  return best;
}
/* 고른 노드들에서 발사값을 뽑는다. 없으면 null이라 호출자가 분기한다. */
function aimStarShot(picks = aimPick) {
  if (!picks.length) return null;
  const nodes = aimNodes();
  const p = picks.map((i) => nodes[i]);
  if (p.some((s) => !s)) return null;
  if (AIM_MODE === "centroid") {
    const cx = p.reduce((sum, s) => sum + s.x, 0) / p.length,
      cy = p.reduce((sum, s) => sum + s.y, 0) / p.length,
      radius =
        p.reduce((sum, s) => sum + Math.hypot(s.x - cx, s.y - cy), 0) /
        p.length,
      dx = cx - ball.x,
      dy = cy - ball.y;
    if (Math.hypot(dx, dy) < 1) {
      /* 무게중심이 유성 바로 위에 얹힌 퇴화 조합. 별빛 0개 판에서는 조합이
         «별지기 셋» 하나뿐이라, 여기서 null만 돌려주면 드래그 폴백도 없는
         소프트락이 된다 — 가장 먼 픽 방향으로 최소 위력을 쏘는 재배치 샷으로
         떨어뜨린다. 픽이 전부 유성 1px 안일 수는 없으므로(별지기 몸통 r=31)
         사실상 항상 탈출된다. */
      let far = null,
        farD = 1;
      for (const s of p) {
        const d2 = Math.hypot(s.x - ball.x, s.y - ball.y);
        if (d2 > farD) {
          farD = d2;
          far = s;
        }
      }
      if (!far) return null;
      const fs = aimFlip ? -1 : 1;
      return {
        dx: (far.x - ball.x) * fs,
        dy: (far.y - ball.y) * fs,
        cx: far.x,
        cy: far.y,
        tx: ball.x,
        ty: ball.y,
        hx: ball.x + (far.x - ball.x) * fs,
        hy: ball.y + (far.y - ball.y) * fs,
        flipped: aimFlip,
        radius: 0,
        force: 0.28,
      };
    }
    /* 반대편(2026-08-20). 무게중심은 언제나 노드들의 볼록 껍질 안이므로,
       노드를 늘려도 겨눌 수 있는 각도가 껍질에 갇힌다 — 실측으로 별빛
       상한(9개)까지 채워도 86도였고 4개(54도)에서 두 배로 늘려도 거의
       안 움직였다. 부호 하나로 껍질 «밖»이 열린다: 덮는 각도 중앙 75 ->
       255도, 최악의 판(p10)이 39 -> 219도.
       반대편은 죽은 방향이 아니다 — 같은 판 같은 조합에서 방향만 뒤집어
       재니 별지기 접촉은 같고 피해가 136 대 94(69%)다. 약하지만 쓸 수
       있으므로 「세게 갈까, 다른 데로 갈까」가 매번 저울질이 된다. */
    const sign = aimFlip ? -1 : 1;
    return {
      dx: dx * sign,
      dy: dy * sign,
      cx,
      cy,
      // 그리는 쪽이 쓰는 «갈 길»의 끝점. 뒤집으면 유성 반대쪽으로 뻗는다.
      tx: ball.x,
      ty: ball.y,
      hx: ball.x + dx * sign,
      hy: ball.y + dy * sign,
      flipped: aimFlip,
      radius,
      force: clamp(radius / AIM_STAR.fullRadius, 0.28, 1),
    };
  }
  /* 마지막에 찍은 것이 촉이다. 앞의 것들의 중점이 꼬리이고, 하나만 찍었으면
     유성 자신이 꼬리가 된다 — 그러면 「그 별빛 쪽으로, 멀수록 세게」가 된다. */
  const head = p[p.length - 1],
    tail = p.slice(0, -1),
    tx = tail.length
      ? tail.reduce((sum, s) => sum + s.x, 0) / tail.length
      : ball.x,
    ty = tail.length
      ? tail.reduce((sum, s) => sum + s.y, 0) / tail.length
      : ball.y,
    dx = head.x - tx,
    dy = head.y - ty,
    length = Math.hypot(dx, dy);
  // 촉과 꼬리가 겹치면 방향이 없다. 그 조합은 쏠 수 없다.
  if (length < 1) return null;
  return {
    dx,
    dy,
    tx,
    ty,
    hx: head.x,
    hy: head.y,
    cx: (tx + head.x) / 2,
    cy: (ty + head.y) / 2,
    length,
    force: clamp(length / AIM_STAR.fullLength, 0.28, 1),
  };
}
/* 지금 화면에 그려야 할 조준. 둘을 찍었으면 마우스가 올라간 것을 셋째로
   가정해 미리 그린다 — 셋째를 찍는 순간 발사되므로, 그 전에 결과가 보이지
   않으면 «고른다»는 말이 성립하지 않는다. */
function aimStarPreview() {
  if (aimPick.length >= AIM_STAR.minPick) return aimStarShot();
  // 마우스가 올라간 것을 «다음 하나»로 가정해 미리 그린다. 아무것도 안 고른
  // 상태에서 별빛 위에 올리기만 해도 그 한 발이 어디로 갈지 바로 보인다.
  if (aimHover >= 0 && !aimPick.includes(aimHover))
    return aimStarShot([...aimPick, aimHover]);
  return aimPick.length ? aimStarShot() : null;
}
/* 발사. 고른 셋이 «조준»이고, 고르지 않은 나머지가 «별자리»다.

   그래서 선택이 하나인데 결과가 둘이다 — 일곱 개 중 어느 셋을 조준에 쓰느냐가
   곧 남은 넷으로 어떤 별자리가 그려지느냐를 정한다. 별자리는 둘러싼 것을
   때리므로(실측: 보스를 감싸면 42, 못 감싸면 0), 「가고 싶은 방향」과
   「감싸고 싶은 모양」이 같은 손짓 안에서 다툰다.

   순서는 별자리가 먼저다. deferFigureResolution이 현현 연출이 끝난 뒤에
   발사를 이어 준다 — 없으면 별자리가 뜨는 위로 유성이 먼저 지나간다. */
function launchAimStarShot() {
  if (!battle || ball?.moving || battleComplete) return false;
  /* 노드 조준이 꺼진 판(0단계 드래그 수업 등)에서는 조용히 물러난다.
     여기서 거절 연출을 내면 「노드 셋」이라는, 그 판에 존재하지 않는
     문법을 가르치는 토스트가 뜨고 aimDenyT는 조준 화면이 없어 얼어붙는다. */
  if (!aimStarReady()) return false;
  /* 하한 3. 근거는 AIM_STAR.minPick 주석 — 셋부터 방향이 «만든 점»이 된다.
     마우스가 올라가 있기만 한 노드는 세지 않는다. 미리보기는 가정을 그려도
     되지만, 발사가 가정을 쏘면 놀란다. */
  if (aimPick.length < AIM_STAR.minPick) {
    toast(
      "노드 " +
        aimPick.length +
        "/" +
        AIM_STAR.minPick +
        " · 별지기·별빛을 셋 이상 찍으세요",
    );
    // 거절도 연출이다 — HUD 카운트가 잠깐 붉게 흔들리고 낮게 톡 소리가 난다.
    aimDenyT = 0.5;
    combatSfx?.("wall", 0.45);
    return false;
  }
  const shot = aimStarShot();
  if (!shot) {
    toast("이 조합은 조준이 되지 않습니다 · 다른 노드로 바꿔보세요");
    return false;
  }
  const nodes = aimNodes(),
    // 별지기 노드는 태울 수 없다 — 별자리 재료는 별빛뿐이다. 별빛 노드는
    // aimNodes가 같은 객체를 그대로 넘기므로 Set 동일성으로 걸러진다.
    picked = new Set(aimPick.map((i) => nodes[i])),
    rest = aimStars.filter((s) => !picked.has(s));
  /* 발사 순간의 수렴 연출 재료를 지금 뜬다 — fire가 별자리 연출 뒤로
     미뤄질 수 있고, 그때는 aimPick이 이미 비어 있다. */
  const fxPoints = aimPick.map((i) => ({
    x: nodes[i].x,
    y: nodes[i].y,
    col: nodes[i].col,
  }));
  /* 픽은 발사가 확정된 «지금» 비운다. fire까지 미루면 별자리 연출이 도는
     1~3초 동안 aimPick이 «걸러지기 전» 노드 목록의 인덱스로 남아, 조준
     화면이 엉뚱한 노드에 순서 배지를 붙인다. 연출 상태도 여기서 끊는다 —
     성립 플래시가 다음 조준까지 새어 들면 안 찍은 선이 빛난다. */
  aimPick = [];
  aimHover = -1;
  aimReadyFlash = 0;
  aimDenyT = 0;
  // 노드에 남긴 «방금 찍힘» 플래시도 여기서 끊는다. drawAimStars에서만
  // 감쇠하므로 비행 동안 얼었다가, 정산 뒤 자리가 바뀐 별지기 위에서
  // 유령처럼 재생됐다 — 순서 배지와 같은 낡은-상태 계열이다.
  for (const g of gates) g.aimFlash = 0;
  for (const s of aimStars) s.pickFlash = 0;
  const fire = () => {
    /* 별자리 연출이 도는 사이 판이 끝났을 수 있다. 캐스트 피해가 보스를
       잡으면 scheduleWin이 battleComplete를 세우는데 afterCast는 그대로
       이어지므로, 여기서 삼키지 않으면 승리 컷신 중에 유성이 발사되고
       battle.shots가 줄어 결과 카드의 샷 수·메달이 틀어진다 — 발사 진입점
       마다 걸어 둔 battleComplete 가드(포인터 경로 주석)와 같은 규칙이다. */
    if (!battle || battleComplete || ball?.moving) return;
    aimPick = [];
    aimHover = -1;
    aimFlip = false;
    aimLaunchFx = {
      t: 0.42,
      dur: 0.42,
      points: fxPoints,
      /* 수렴점은 언제나 노드들의 무게중심이다. hx/hy를 쓰면 반대편 샷에서
         빛이 거울점(유성 뒤편)으로 모여 수렴이 유성을 «가로질러» 쓸고
         지나간다 — 노드가 가리킨 곳으로 모이고, 유성은 반대로 떠난다. */
      cx: shot.cx,
      cy: shot.cy,
    };
    fireMeteor(
      shot.dx,
      shot.dy,
      shot.force,
      "노드 조준 · 위력 " + Math.round(shot.force * 100) + "%",
    );
    /* 조준 교습 배선(핸드오프 §패치가 못 하는 것 1·3). 슬롯·범례가 몇 샷
       뒤에 소등할지, 그리고 온보딩 조준 실습이 넘어갈지가 이 두 값을 본다.
       표현 계층(aimTeach)은 game-combat-physics.js 소유라 여기서는 «올리기»만
       한다 — 그리기 쪽이 읽고 판단한다. */
    /* 수업 샷은 세지 않는다. 수업 중에는 범례가 lessonGuide로 접혀
       보이지도 않는데 카운터만 오르면, 캠페인 첫 판에 왔을 때 «첫 3샷»
       예산이 이미 소진돼 범례를 한 번도 못 보고 legend가 저장에 박힌다. */
    if (
      typeof aimTeach === "object" &&
      aimTeach &&
      !(
        typeof onboardingLessonGuideActive === "function" &&
        onboardingLessonGuideActive()
      )
    ) {
      aimTeach.shots += 1;
      // 범례는 첫 3샷까지다. 그 뒤로는 이 저장 슬롯에서 다시 뜨지 않는다.
      if (aimTeach.shots >= 3) markAimHintDone?.("legend");
    }
    if (typeof onboarding === "object" && onboarding) onboarding.aimed = true;
  };
  if (rest.length >= 3) {
    /* 남은 별빛은 별자리로 타 버린다. 조준에 쓴 셋은 남는다 — 둘 다
       소모하면 경제가 적자다(한 샷이 남기는 별빛이 중앙 2개인데 여섯을
       먹는다). 그래도 「조준에 빼두면 별자리에 못 쓴다」는 대가는 그대로다. */
    aimStars = aimStars.filter((s) => picked.has(s));
    resolveFigure?.(
      rest.map((s) => ({ x: s.x, y: s.y, col: s.col, label: s.label })),
    );
    sync();
    if (deferFigureResolution?.(fire)) return true;
  }
  fire();
  return true;
}
/* 벽에 튕겨도 별빛이 남는다.

   별지기 접촉만 별빛을 만들었더니 악순환이 생겼다 — 실측으로 별빛 풀이
   중앙 1개, 쓸 수 있는 조준 조합도 중앙 1개였다. 「고른다」가 아니라
   「그거밖에 없다」였고, 그 상태에서 조준이 보스 방향에서 중앙 30도 빗나가면
   별지기를 또 못 맞혀 별빛이 더 줄었다.

   벽은 조준이 나빠도 맞는다(실측 샷당 중앙 2회). 그래서 벽 별빛은
   «실패해도 재료가 생긴다»는 안전망이 되어 그 고리를 끊는다.
   오너의 원안도 「별지기」가 아니라 「충돌」이었다. */
/* 끄고 켜는 스위치. 껐을 때 굶는지 다시 확인하려면 true로 되돌린다. */
const WALL_STARS = false;
registerRuntimeHook("afterTableWall", () => {
  if (!WALL_STARS) return;
  if (typeof nodeEconomyOn !== "function" || !nodeEconomyOn()) return;
  if (!battle || battleComplete || !ball?.moving) return;
  // 벽에 붙어 미끄러질 때 같은 자리에 겹쳐 쌓이지 않게 최소 간격을 둔다.
  const last = aimStars[aimStars.length - 1];
  if (last && Math.hypot(last.x - ball.x, last.y - ball.y) < 40) return;
  dropAimStar(ball.x, ball.y, "#9fd8ff", "쿠션");
});
/* 샷이 끝나면 무엇이 남았는지 말한다. 판만 보고는 별빛이 몇 개 생겼는지,
   지금 무엇을 할 수 있는지가 안 읽힌다는 제보가 있었다. */
registerRuntimeHook("afterShotEnd", () => {
  if (!battle || battleComplete) return;
  if (typeof nodeEconomyOn !== "function" || !nodeEconomyOn()) return;
  // 드래그 판(0단계 수업 등)에는 노드 문법이 없다 — 별지기를 찍으라는
  // 토스트도, 조준 멘트도 그 판의 것이 아니다.
  if (!aimStarReady()) return;
  const n = aimStars.length;
  /* 조준 화면이 «열린» 순간이 여기다. aimPick은 발사 때 비워졌으므로 0픽
     상태이고, 첫 멘트가 붙을 자리가 이 프레임이다. 별빛이 없어도 별지기
     셋이 노드로 서 있으므로 조준은 열린다 — 그래서 토스트보다 먼저 알린다. */
  emitAimChanged("open");
  if (!n) return toast("별빛 없음 · 별지기 셋을 찍어 조준하세요");
  toast(
    "별빛 " + n + " · 별지기와 합쳐 셋 이상 조준 · 안 찍은 별빛은 별자리로",
  );
});
/* 발사 본체. 조준 경로가 둘이므로(별빛 조준 / 드래그) 한 곳에 모은다 —
   나뉘어 있으면 한쪽만 고친 채로 다른 쪽이 조용히 남는다. */
function fireMeteor(dx, dy, force, note = null) {
  const aim = billiardAim(dx, dy),
    speed = 750 + force * 975;
  /* 발사 자체의 손맛: 위력만큼의 작은 킥과 발사 자리의 불꽃. 정산 쉐이크
     (34)에 비하면 잔진동 수준이라 판독을 해치지 않는다. */
  screenShake = Math.max(
    Number.isFinite(screenShake) ? screenShake : 0,
    3 + force * 5,
  );
  fieldFx.push({
    type: "spark",
    x: ball.x,
    y: ball.y,
    t: 0,
    d: 0.38,
    col: "#ffe09a",
  });
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
    note ??
      (aim.assisted
        ? "항로 보정 · 연쇄 진입"
        : "유성 발사 · 위력 " + Math.round(force * 100) + "%"),
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
  x.shadowBlur = combatFxBlur(18);
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
      x.shadowBlur = combatFxBlur(16);
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
    x.shadowBlur = combatFxBlur(9);
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
    x.shadowBlur = combatFxBlur(18);
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
  x.shadowBlur = combatFxBlur(20);
  x.shadowColor = "#b8c3ff";
  x.fillText("STAR RETURN!", 0, 0);
  x.font = "bold 13px ui-monospace";
  x.shadowBlur = combatFxBlur(0);
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
  // 분열체의 약점 타격도 같은 규칙이다 — 오너 지시가 「전체 적용」이다.
  if (weak && dealt > 0) dropWeakpointStars();
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
