// Billiards pass: the ball has no gravity and never drains through the bottom.
// A run begins at the fixed launch stone, then every following shot starts from
// the exact place where the previous ball came to rest.  The readable puzzle is
// now the route through deployed heroes, not a precision punishment.
const billiardStartShot = startShot;
startShot = function (restingPoint = null) {
  billiardStartShot();
  for (const gate of gates) gate.r = 34;
  if (restingPoint) {
    ball.x = clamp(restingPoint.x, ball.r + 18, W - ball.r - 18);
    ball.y = clamp(restingPoint.y, ball.r + 18, H - ball.r - 18);
  }
  ball.billiards = true;
  ball.aimAssist = false;
  ball.nudgeCooldown = 0;
};
endShot = function () {
  const restingPoint = { x: ball.x, y: ball.y };
  ball.moving = false;
  ball.vx = ball.vy = 0;
  ball.trail = [];
  if (battle.shots <= 0 && battle.training) {
    battle.shots = battle.shotMax;
    toast("훈련 유성 자동 보충");
  }
  if (battle.shots <= 0) {
    run = false;
    if (boss.hp > 0)
      return fail(
        "공허 거상이 버텼습니다. 유닛 연쇄와 반사 경로를 바꿔보세요.",
      );
  }
  // Position play is the point of billiards: the next meteor tees off from
  // where this one came to rest.  Only Luna's lessons keep the fixed launch
  // stone, because their copy points the player at the bottom of the board.
  startShot(battle.tutorial ? null : restingPoint);
  msg = battle.training
    ? "무한 훈련 · 멈춘 자리에서 다음 유성을 이어 발사하세요."
    : "멈춘 자리에서 다음 샷. 궤적을 따라 별지기를 먼저 깨워보세요.";
  if (!battle.training) toast("다음 샷 · 현재 위치에서 재개");
  sync();
};
function billiardAim(dx, dy) {
  const len = Math.hypot(dx, dy) || 1,
    base = Math.atan2(dy, dx);
  let best = null;
  const consider = (target) => {
    const tx = target.x - ball.x,
      ty = target.y - ball.y,
      d = Math.hypot(tx, ty);
    if (d < 55 || d > 620) return;
    const delta = Math.atan2(
      Math.sin(Math.atan2(ty, tx) - base),
      Math.cos(Math.atan2(ty, tx) - base),
    );
    if (
      Math.abs(delta) < 0.15 &&
      (!best || Math.abs(delta) < Math.abs(best.delta))
    )
      best = { delta, target };
  };
  for (const gate of gates) consider(gate);
  for (const bumper of bumpers) consider(bumper);
  consider(boss);
  if (!best) return { x: dx / len, y: dy / len, assisted: false };
  const angle = base + best.delta * 0.58;
  return {
    x: Math.cos(angle),
    y: Math.sin(angle),
    assisted: true,
    target: best.target,
  };
}
// Superseded wholesale by the 같은 파일 아래쪽 definition, which never calls back
// here.  The empty body keeps the binding explicit for that reassignment.
function billiardPredict(dx, dy) {}
// The first billiards solver landed here and was replaced further down this
// same file (see the live `simulatePhysics` next to the gimmick handling),
// so this copy never ran. It has been removed along with the pinball layer.
damage = function (weak = false) {
  if (battleComplete) return;
  trackBlazeDirect();
  let amount = RULES.baseDamage + build.weakFlat;
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
  const label = weak ? (crit ? "치명 약점" : "약점") : "몸체";
  const dealt = applyBossHit(amount);
  if (dealt > 0)
    addPopup(
      ball.x,
      ball.y - 28,
      label + " -" + dealt,
      weak ? "#ffe59a" : "#e6f7ef",
      crit,
    );
  if (marked)
    areaAttack(
      "미리내 표식 폭발",
      Math.max(12, Math.round(amount * 0.38)),
      "#ef718d",
    );
  toast(weak ? label + " " + amount + " 피해" : "몸체 " + amount + " 피해");
  if (boss.hp <= 0) scheduleWin();
  ball.power = 0;
  if (weak) ball.mark = false;
  chain = [];
  sync();
};
hitBumper = function (b) {
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
};
drawPinballTable = function () {
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
  for (const wall of stageWalls) {
    x.save();
    x.fillStyle = wall.on > 0 ? "#e3edf0" : "#7699a3";
    x.strokeStyle = "#243b47";
    x.lineWidth = 3;
    x.shadowBlur = wall.on > 0 ? 18 : 6;
    x.shadowColor = "#c3f3ff";
    x.fillRect(wall.x - wall.w / 2, wall.y - wall.h / 2, wall.w, wall.h);
    x.strokeRect(wall.x - wall.w / 2, wall.y - wall.h / 2, wall.w, wall.h);
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
  if (bossShield && bossShield.hits > 0 && boss) {
    x.save();
    x.strokeStyle = bossShield.flash > 0 ? "#ffe3c0" : "#7cc6bb";
    x.shadowBlur = bossShield.flash > 0 ? 26 : 12;
    x.shadowColor = "#9adfc9";
    for (let i = 0; i < bossShield.hits; i++) {
      x.lineWidth = 3;
      x.globalAlpha = 0.42 + 0.16 * i;
      x.beginPath();
      x.arc(boss.x, boss.y, 76 + i * 11, 0, Math.PI * 2);
      x.stroke();
    }
    x.restore();
  }
};
drawCombatControls = function () {
  if (!run || battle?.victory || ball?.moving) return;
  x.save();
  x.fillStyle = "#07131be8";
  x.strokeStyle = "#5e9290";
  x.lineWidth = 1;
  x.beginPath();
  x.roundRect(W / 2 - 156, H - 118, 312, 26, 6);
  x.fill();
  x.stroke();
  x.fillStyle = "#e8dfbd";
  x.font = "bold 10px ui-monospace";
  x.textAlign = "center";
  x.fillText(
    "유성을 반대 방향으로 끌어 당긴 뒤 놓기 · 2회 반사 예측",
    W / 2,
    H - 101,
  );
  x.restore();
};
function billiardPointerDown(e) {
  if (!run) return;
  const p = pointer(e);
  if (!ball?.moving) {
    e.stopImmediatePropagation();
    drag = { x: p.x, y: p.y };
    c.setPointerCapture(e.pointerId);
    return;
  }
  e.stopImmediatePropagation();
  if (e.button === 0 && ball.turnReady && !ball.turnUsed) {
    e.preventDefault();
    const vx = ball.vx,
      vy = ball.vy;
    ball.vx = -vy;
    ball.vy = vx;
    ball.turnUsed = true;
    ball.turnReady = false;
    ball.power += 0.92;
    ball.runeBurst = 0.9;
    emitAbilityFx(
      ball.turnGate || { id: "sera", col: "#bca7ff" },
      ball.x,
      ball.y,
      118,
      0.46,
      Math.atan2(ball.vy, ball.vx),
    );
    fieldFx.push({
      type: "turn",
      x: ball.x,
      y: ball.y,
      t: 0,
      d: 0.52,
      col: ball.turnGate?.col || "#bca7ff",
    });
    addPopup(ball.x, ball.y - 34, "90° 전환 +에너지", "#e5c7ff", true);
    toast("달무리 · 90° 전환!");
    msg = "달무리 · 전환 명령으로 운동량을 크게 얻었습니다.";
    return;
  }
  if (e.button === 2 && ball.nudgeCooldown <= 0) {
    e.preventDefault();
    const dx = ball.x - p.x,
      dy = ball.y - p.y,
      l = Math.hypot(dx, dy) || 1;
    ball.vx += (dx / l) * 225;
    ball.vy += (dy / l) * 225;
    ball.nudgeCooldown = 0.7;
    ball.runeBurst = 0.3;
    toast("미세 조정 · 운동량 +");
  }
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
  const pull = cuePull(p);
  ball.launchPower = clamp(
    Math.hypot(ball.x - pull.x, ball.y - pull.y) / 260,
    0.28,
    1,
  );
}
function billiardPointerUp(e) {
  if (!drag || ball?.moving) return;
  e.stopImmediatePropagation();
  // Launching is blocked only while a lesson card is on screen.  Every
  // practice step (dialogue 0 included) hides the card first, so the panel
  // flag is the one source of truth here.
  if (onboarding && onboarding.panelVisible !== false) {
    drag = null;
    toast("루나의 설명을 읽고 아래 버튼을 눌러 주세요.");
    return;
  }
  const raw = pointer(e),
    p = cuePull(raw),
    dx = ball.x - p.x,
    dy = ball.y - p.y,
    l = Math.hypot(dx, dy);
  drag = null;
  if (l < 18) {
    toast("유성을 더 멀리 끌어 당겨보세요.");
    return;
  }
  const force = clamp(l / 260, 0.28, 1),
    aim = billiardAim(dx, dy),
    speed = 750 + force * 975;
  ball.launchPower = force;
  ball.vx = aim.x * speed;
  ball.vy = aim.y * speed;
  ball.moving = true;
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
  if (onboarding && onboarding.phase < 3) {
    onboarding.launched = true;
    renderOnboarding();
  }
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
  b.detail = "별지기 연결 " + b.units.size + "/" + gates.length;
  if (b.units.size === gates.length && !b.fullParty) {
    b.fullParty = true;
    earnBlaze(3, "전원 각성 +3.0");
  } else renderBlaze();
}
function trackBlazeBossUnit(g) {
  const b = ball?.blaze;
  if (!b || b.bossUnits.has(g.id)) return;
  b.bossUnits.add(g.id);
  earnBlaze(0.5, g.s + " 보스 직격 +0.5");
}
function trackBlazeDirect() {
  const b = ball?.blaze;
  if (!b || b.directBoss) return;
  b.directBoss = true;
  earnBlaze(1, "유성 보스 직격 +1.0");
}
const baseBlazeWall = tableWall;
tableWall = function () {
  baseBlazeWall();
  const b = ball?.blaze;
  if (!b || b.wallHits >= 2) return;
  b.wallHits++;
  earnBlaze(0.2, "벽 반사 +0.2");
};
let cloneBalls = [];
// Each hero keeps a distinct, readable pixel signature.  These bursts are
// separate from the older field feedback so they can finish fading even while
// the table is waiting for the next shot.
let abilityBursts = [];
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
}
// Gaon only strikes inside this radius, so the arena draws the same number as
// a faint ring.  Both readings must come from one constant.
const SLASH_RANGE = 205;
function resolveSlash(g, name = "샛별 근접 베기", options = {}) {
  const range = SLASH_RANGE,
    distance = Math.hypot(g.x - boss.x, g.y - boss.y);
  if (distance <= range) {
    if (!options.finisher)
      emitAbilityFx(
        g,
        g.x,
        g.y,
        118,
        0.38,
        Math.atan2(boss.y - g.y, boss.x - g.x),
      );
    queueUnitAssist(
      g,
      62 + Math.round((range - distance) * 0.12),
      name,
      options,
    );
  } else {
    addPopup(g.x, g.y - 30, "사거리 밖", g.col, false);
    toast(g.s + " · 근접 베기 사거리 밖");
  }
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
function armTurnCommand(g) {
  if (ball.turnReady || ball.turnUsed) return;
  ball.turnReady = true;
  ball.turnGate = g;
  ball.power += 0.28;
  emitAbilityFx(g, ball.x, ball.y, 98, 0.56, Math.atan2(ball.vy, ball.vx));
  fieldFx.push({ type: "turn", x: g.x, y: g.y, t: 0, d: 0.55, col: g.col });
  toast(g.s + " · 클릭 1회 90° 전환");
  msg = g.s + " · 움직이는 유성을 한 번 클릭해 90도로 꺾으세요.";
}
function reportBladeWheelHit() {}
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
  const targetStrength = speed > 10 ? Math.min(1, 0.2 + (speed - 10) / 700) : 0;
  g.bladeStrength =
    (g.bladeStrength || 0) +
    (targetStrength - (g.bladeStrength || 0)) * Math.min(1, step * 15);
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
  if (fx === "turn") {
    armTurnCommand(g);
    return true;
  }
  if (fx === "bladewheel") {
    if (!g.bladeAwake) {
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
    return true;
  }
  return false;
}
function copyLastUnitAbility(a, b) {
  if (a.fx !== "copycat" || b.fx === "copycat") return;
  a.copiedFx = b.fx;
  a.copiedName = b.s;
  a.copiedColor = b.col;
  a.copiedAsset = abilityFx[b.id];
  a.on = 1;
  emitAbilityFx(a, a.x, a.y, 94, 0.62, 0, abilityFx.nyx, "copycat");
  fieldFx.push({ type: "mirror", x: a.x, y: a.y, t: 0, d: 0.62, col: a.col });
  toast("그믐 · " + b.s + " 능력 모사");
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
  } else if (fx === "turn") {
    const vx = o.vx,
      vy = o.vy;
    o.vx = -vy;
    o.vy = vx;
    const ratio = (speed + 220) / (Math.hypot(o.vx, o.vy) || 1);
    o.vx *= ratio;
    o.vy *= ratio;
    emitAbilityFx(g, g.x, g.y, 92, 0.44, Math.atan2(o.vy, o.vx));
    toast("달무리 · 분열체 90° 전환!");
  }
  queueUnitAssist(
    g,
    12 + Math.min(16, Math.round(speed / 110)),
    g.s + " 분열체 연계",
  );
  fieldFx.push({ type: "relay", x: g.x, y: g.y, t: 0, d: 0.42, col: g.col });
}
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
  for (const o of cloneBalls) {
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
    const wx = boss.x + Math.cos(boss.a) * 84,
      wy = boss.y + Math.sin(boss.a) * 84,
      weak = mobileStatic(o, { x: wx, y: wy }, o.r + 25, 1.01, () =>
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
  }
  cloneBalls = cloneBalls.filter((o) => o.t > 0 && Math.hypot(o.vx, o.vy) > 45);
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
const prepareMobileBilliards = startShot;
startShot = function (restingPoint = null) {
  if (restingPoint && gates.length) {
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
      nudgeCooldown: 0,
      mark: Boolean(battle.nextMark),
      pulse: battle.nextPulse || 0,
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
  cloneBalls = [];
  prepareMobileBilliards();
  ball.blaze = createBlaze();
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
};
function wakeUnit(g) {
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
    g.wakeFlash = 0.62;
    areaBursts.push({ x: g.x, y: g.y, r: g.r + 34, col: g.col, t: 0, d: 0.44 });
    addPopup(g.x, g.y - 40, g.s + " 깨어남!", g.col, true);
    combatSfx?.("awaken", 0.78);
  }
  g.moved = true;
  g.on = Math.max(g.on, 0.72);
  // Rolling is only for decisive movement.  Slow residual slides should settle
  // into the resting token instead of continuously tumbling in place.
  g.animState = "move";
}
// Drawn after the base pass so the halo sits on top of the unit token.  It
// reads state that already exists on each gate, so no new particle array is
// introduced.
registerRuntimeHook("afterDraw", function drawAwakeMarkers() {
  if (!run && !battle) return;
  // Gaon's reach is a placement decision, so it stays on screen all the time
  // rather than only reporting "사거리 밖" after the shot has already settled.
  for (const g of gates) {
    if (g.id !== "gaon") continue;
    x.save();
    x.strokeStyle = g.col;
    x.globalAlpha = 0.16;
    x.lineWidth = 1.5;
    x.setLineDash([3, 6]);
    x.beginPath();
    x.arc(g.x, g.y, SLASH_RANGE, 0, Math.PI * 2);
    x.stroke();
    x.restore();
  }
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
function mobileWall(o, r, unit = null) {
  let hit = false;
  if (o.x < r || o.x > W - r) {
    o.x = clamp(o.x, r, W - r);
    o.vx *= -0.94;
    hit = true;
  }
  if (o.y < r || o.y > H - r) {
    o.y = clamp(o.y, r, H - r);
    o.vy *= -0.94;
    hit = true;
  }
  if (hit) {
    if (unit) {
      unit.wallHits++;
      unit.collisions = (unit.collisions || 0) + 1;
      wakeUnit(unit);
    } else tableWall();
  }
  return hit;
}
function mobileStatic(o, target, radius, restitution, onHit) {
  let dx = o.x - target.x,
    dy = o.y - target.y,
    d = Math.hypot(dx, dy) || 1,
    reach = radius;
  if (d >= reach) return false;
  let nx = dx / d,
    ny = dy / d;
  const overlap = reach - d;
  o.x += nx * (overlap + 0.2);
  o.y += ny * (overlap + 0.2);
  const dot = o.vx * nx + o.vy * ny;
  if (dot < 0) {
    o.vx -= (1 + restitution) * dot * nx;
    o.vy -= (1 + restitution) * dot * ny;
    onHit?.(nx, ny);
  }
  return true;
}
function mobileRect(o, r, rect, restitution, onHit) {
  const left = rect.x - rect.w / 2,
    right = rect.x + rect.w / 2,
    top = rect.y - rect.h / 2,
    bottom = rect.y + rect.h / 2,
    nearestX = clamp(o.x, left, right),
    nearestY = clamp(o.y, top, bottom);
  let dx = o.x - nearestX,
    dy = o.y - nearestY,
    distance = Math.hypot(dx, dy);
  if (distance >= r) return false;
  let nx = dx / (distance || 1),
    ny = dy / (distance || 1),
    overlap = r - distance;
  if (distance < 0.001) {
    let edgeDistance = Math.abs(o.x - left);
    nx = -1;
    ny = 0;
    const rightDistance = Math.abs(right - o.x),
      topDistance = Math.abs(o.y - top),
      bottomDistance = Math.abs(bottom - o.y);
    if (rightDistance < edgeDistance) {
      edgeDistance = rightDistance;
      nx = 1;
      ny = 0;
    }
    if (topDistance < edgeDistance) {
      edgeDistance = topDistance;
      nx = 0;
      ny = -1;
    }
    if (bottomDistance < edgeDistance) {
      edgeDistance = bottomDistance;
      nx = 0;
      ny = 1;
    }
    overlap = r + edgeDistance;
  }
  o.x += nx * (overlap + 0.2);
  o.y += ny * (overlap + 0.2);
  const dot = o.vx * nx + o.vy * ny;
  if (dot < 0) {
    o.vx -= (1 + restitution) * dot * nx;
    o.vy -= (1 + restitution) * dot * ny;
    onHit?.(nx, ny);
  }
  return true;
}
function tickGimmickCooldowns(o, step) {
  if (!o.gimmickCooldowns) return;
  for (const key of Object.keys(o.gimmickCooldowns)) {
    o.gimmickCooldowns[key] -= step;
    if (o.gimmickCooldowns[key] <= 0) delete o.gimmickCooldowns[key];
  }
}
function applyBoostPad(o, pad, unit = null) {
  const inside =
    Math.abs(o.x - pad.x) <= pad.w / 2 + o.r &&
    Math.abs(o.y - pad.y) <= pad.h / 2 + o.r;
  if (!inside) return false;
  const key = "boost:" + pad.id;
  o.gimmickCooldowns ??= {};
  if (o.gimmickCooldowns[key] > 0) return false;
  const speed = Math.hypot(o.vx, o.vy);
  if (speed < 50) return false;
  const boosted = Math.min(pad.maxSpeed, speed + pad.boost);
  o.vx *= boosted / speed;
  o.vy *= boosted / speed;
  o.gimmickCooldowns[key] = 0.32;
  pad.on = 0.22;
  fieldFx.push({
    type: "booster",
    x: pad.x,
    y: pad.y,
    t: 0,
    d: 0.34,
    col: "#b9ef86",
  });
  if (unit) {
    unit.collisions = (unit.collisions || 0) + 1;
    wakeUnit(unit);
    addPopup(unit.x, unit.y - 32, "가속!", "#caff9a", false);
  } else if (o === ball) {
    ball.power += 0.2;
    ball.bounces++;
    addPopup(pad.x, pad.y - 28, "운동량 상승!", "#caff9a", true);
    toast("가속 발판 · 유성 운동량 상승");
  }
  return true;
}
// Every path that hurts the colossus routes through here, so a stage shield
// has one place to eat a hit and a phase rule has one place to notice the
// drop.  Returns the damage actually dealt; a blocked hit returns 0 and the
// caller skips its own popup.
function applyBossHit(amount) {
  if (!(amount > 0) || !boss) return 0;
  if (bossShield && bossShield.hits > 0) {
    bossShield.hits -= 1;
    bossShield.flash = 0.45;
    addPopup(boss.x, boss.y - 66, "껍질이 막았다", "#9adfc9", true);
    toast(
      bossShield.hits > 0
        ? "굳은 껍질 · 남은 " + bossShield.hits + "겹"
        : "껍질이 모두 깨졌습니다",
    );
    combatSfx?.("fail", 0.5);
    return 0;
  }
  const before = boss.hp;
  boss.hp = Math.max(0, boss.hp - amount);
  checkStagePhases();
  return before - boss.hp;
}
// Phase rules fire once each time the colossus drops past a health ratio.
function checkStagePhases() {
  if (!stagePhases || !boss?.maxHp || boss.immortal) return;
  const ratio = boss.hp / boss.maxHp;
  while (
    stagePhases.fired < stagePhases.at.length &&
    ratio <= stagePhases.at[stagePhases.fired]
  ) {
    stagePhases.fired += 1;
    runStagePhase(stagePhases.effect);
  }
}
function runStagePhase(effect) {
  if (effect === "push") {
    // The table is reset, not damaged: everything alive is thrown to the
    // corner nearest it, so a carefully built lane has to be rebuilt.
    const corners = [
      [96, 176],
      [W - 96, 176],
      [96, H - 176],
      [W - 96, H - 176],
    ];
    const throwTo = (o) => {
      let best = corners[0],
        bestD = Infinity;
      for (const corner of corners) {
        const d = Math.hypot(corner[0] - o.x, corner[1] - o.y);
        if (d < bestD) {
          bestD = d;
          best = corner;
        }
      }
      o.x = best[0];
      o.y = best[1];
      o.vx = 0;
      o.vy = 0;
      areaBursts.push({
        x: o.x,
        y: o.y,
        r: 52,
        col: "#f6c48e",
        t: 0,
        d: 0.5,
      });
    };
    for (const g of gates) throwTo(g);
    if (ball) throwTo(ball);
    for (const s of seeds ?? []) throwTo(s);
    screenShake = Math.max(screenShake, 16);
    toast("거상의 파동 · 모두 모서리로 밀려났습니다");
  } else if (effect === "sleep") {
    for (const g of gates) {
      g.awake = false;
      g.moved = false;
      g.on = 0;
      g.sleepGuard = stagePhases.wakeNeed;
      areaBursts.push({
        x: g.x,
        y: g.y,
        r: g.r + 26,
        col: "#8ba39f",
        t: 0,
        d: 0.44,
      });
    }
    toast(
      "별지기가 다시 잠들었습니다 · " + stagePhases.wakeNeed + "회 충돌 필요",
    );
  }
  combatSfx?.("unlock", 0.7);
}
// A fading pad is the boost pad's opposite: it costs constellation multiplier
// instead of adding speed, so a fast lane can still be the wrong lane.
function applyDragPad(o, pad, unit = null) {
  if (o !== ball) return false;
  const inside =
    Math.abs(o.x - pad.x) <= pad.w / 2 + o.r &&
    Math.abs(o.y - pad.y) <= pad.h / 2 + o.r;
  if (!inside) return false;
  const key = "drag:" + pad.id;
  o.gimmickCooldowns ??= {};
  if (o.gimmickCooldowns[key] > 0) return false;
  o.gimmickCooldowns[key] = 0.5;
  pad.on = 0.26;
  loseBlaze(pad.drop, "흐린 발판 통과");
  fieldFx.push({
    type: "drag",
    x: pad.x,
    y: pad.y,
    t: 0,
    d: 0.34,
    col: "#8ba39f",
  });
  return true;
}
function applyStageGimmicks(o, unit = null) {
  for (const pad of dragPads) applyDragPad(o, pad, unit);
  for (const orbit of orbitals) {
    if (orbit.down > 0) continue;
    mobileStatic(o, orbit, o.r + orbit.r, 1.02, () => {
      if (orbit.hitCooldown > 0) return;
      orbit.hitCooldown = 0.22;
      const amount = Math.max(
        6,
        Math.round(Math.hypot(o.vx, o.vy) / 46) + (unit ? 8 : 0),
      );
      orbit.hp = Math.max(0, orbit.hp - amount);
      addPopup(
        orbit.x,
        orbit.y - 26,
        "방벽 -" + amount,
        "#9adfc9",
        amount >= 18,
      );
      if (orbit.hp <= 0) {
        orbit.down = 1.4;
        areaBursts.push({
          x: orbit.x,
          y: orbit.y,
          r: 46,
          col: "#9adfc9",
          t: 0,
          d: 0.42,
        });
        toast("도는 방벽 하나를 부쉈습니다");
      }
      if (unit) wakeUnit(unit);
    });
  }
  for (const wall of stageWalls)
    mobileRect(o, o.r, wall, wall.restitution, () => {
      wall.on = 0.18;
      fieldFx.push({
        type: "wall",
        x: o.x,
        y: o.y,
        t: 0,
        d: 0.28,
        col: "#c3f3ff",
      });
      if (unit) {
        unit.wallHits = (unit.wallHits || 0) + 1;
        unit.collisions = (unit.collisions || 0) + 1;
        wakeUnit(unit);
      } else if (o === ball) tableWall();
      else o.bounces = (o.bounces || 0) + 1;
    });
  for (const pad of boostPads) applyBoostPad(o, pad, unit);
}
function mobilePair(a, ar, b, br, onHit) {
  let dx = b.x - a.x,
    dy = b.y - a.y,
    d = Math.hypot(dx, dy) || 1,
    reach = ar + br;
  if (d >= reach) return false;
  let nx = dx / d,
    ny = dy / d,
    overlap = reach - d;
  a.x -= nx * (overlap * 0.5 + 0.12);
  a.y -= ny * (overlap * 0.5 + 0.12);
  b.x += nx * (overlap * 0.5 + 0.12);
  b.y += ny * (overlap * 0.5 + 0.12);
  const along = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
  if (along <= 0) return true;
  const incoming = { x: a.vx, y: a.vy },
    impulse = along * 0.98;
  a.vx -= impulse * nx;
  a.vy -= impulse * ny;
  b.vx += impulse * nx;
  b.vy += impulse * ny;
  onHit?.(nx, ny, along, incoming);
  return true;
}
function guaranteeMomentum(o, dx, dy, minSpeed, maxSpeed) {
  const speed = Math.hypot(o.vx, o.vy);
  if (speed < minSpeed) {
    const length = Math.hypot(dx, dy) || 1;
    o.vx = (dx / length) * minSpeed;
    o.vy = (dy / length) * minSpeed;
  } else if (speed > maxSpeed) {
    o.vx *= maxSpeed / speed;
    o.vy *= maxSpeed / speed;
  }
}
function unitImpactDamage(g, target) {
  if (g.enemyHitCooldown > 0 || battleComplete) return false;
  g.enemyHitCooldown = 0.34;
  const speed = Math.hypot(g.vx, g.vy),
    isBoss = target === boss;
  const amount =
    (isBoss ? 18 : 12) +
    Math.min(isBoss ? 28 : 20, Math.round(speed / (isBoss ? 72 : 88)));
  const label = g.s + " 충돌";
  g.on = Math.max(g.on, 0.62);
  g.animState = "hit";
  areaBursts.push({
    x: g.x,
    y: g.y,
    r: isBoss ? 52 : 38,
    col: g.col,
    t: 0,
    d: 0.3,
  });
  if (!isBoss)
    fieldFx.push({ type: "assist", x: g.x, y: g.y, t: 0, d: 0.34, col: g.col });
  if (isBoss) {
    const dealt = applyBossHit(amount);
    registerBossHit(false);
    impact(false, g.x, g.y, "contact");
    if (dealt > 0)
      addPopup(boss.x, boss.y - 76, label + " -" + dealt, g.col, dealt >= 36);
    if (boss.hp <= 0) scheduleWin();
  } else damageAdd(target, amount, label, g.col);
  return true;
}
function settleParty() {
  const awakened = gates.filter((g) => g.moved && g.travel > 10);
  if (awakened.length) {
    battle.finisherSerial = 0;
    const finishers = awakened.filter((g) => {
      const fx = g.fx === "copycat" ? g.copiedFx : g.fx;
      return fx !== "bladewheel";
    });
    for (const g of awakened) {
      const base =
          14 +
          Math.min(22, Math.round(g.travel / 28)) +
          g.collisions * 3 +
          g.wallHits * 4 +
          (g.bossHit ? 11 : 0),
        copied = g.copiedFx;
      if ((g.fx === "copycat" ? copied : g.fx) === "bladewheel") {
        g.animState = "idle";
        g.bladeStrength = 0;
        continue;
      }
      if (g.fx === "slash" || (g.fx === "copycat" && copied === "slash")) {
        resolveSlash(
          g,
          g.fx === "copycat"
            ? "그믐 · " + g.copiedName + " 근접 베기"
            : "샛별 근접 베기",
          { finisher: true },
        );
        continue;
      }
      if (
        g.fx === "longshot" ||
        (g.fx === "copycat" && copied === "longshot")
      ) {
        resolveLongshot(
          g,
          g.fx === "copycat"
            ? "그믐 · " + g.copiedName + " 거리 저격"
            : "미리내 거리 저격",
          { finisher: true },
        );
        continue;
      }
      if (
        g.fx === "shockwave" ||
        (g.fx === "copycat" && copied === "shockwave")
      ) {
        detonateShockwave(
          g,
          g.fx === "copycat"
            ? "그믐 · " + g.copiedName + " 충격파"
            : "모루 충돌 충격파",
          { finisher: true },
        );
        continue;
      }
      if (g.fx === "copycat" && !copied) {
        addPopup(g.x, g.y - 30, "모사 대상 없음", g.col, false);
        toast("그믐 · 아직 모사한 아군이 없습니다.");
      }
      queueUnitAssist(g, base, g.s + " 각성", { finisher: true });
    }
    msg = finishers.length
      ? finishers.map((g) => g.s).join(" · ") +
        " 각성! 멈춘 자리에서 보스 공격을 시작합니다."
      : awakened.map((g) => g.s).join(" · ") +
        "의 이동 공격이 끝났습니다. 정산 공격은 없습니다.";
    toast(
      finishers.length
        ? finishers.length + "명 각성 · 다음 샷은 현재 배치에서"
        : "질풍 칼날 종료 · 정산 공격 없음",
    );
  } else {
    msg =
      "아무 별지기도 깨우지 못했습니다. 다음 샷은 현재 위치에서 다시 설계하세요.";
    toast("별지기 미각성 · 다음 샷 준비");
  }
}
const mobileEndShot = endShot;
endShot = function () {
  if (!ball?.moving) return;
  settleParty();
  mobileEndShot();
};
hitGate = function (g) {
  wakeUnit(g);
  g.collisions = (g.collisions || 0) + 1;
  msg = g.s + "이(가) 굴러가기 시작했습니다. 멈추면 고유 공격을 시행합니다.";
  sync();
};
// Zone labels belonged to the former static-board version, where hitting a
// labelled tile fired the hero standing on it.  A hero now wakes only by real
// movement, so the whole `triggerZone` concept and its call sites are gone.
simulatePhysics = function (d) {
  const slices = Math.min(3, Math.max(1, Math.ceil(d / (1 / 90)))),
    step = d / slices;
  // Persistent timers and effect arrays only need one update per rendered
  // frame. Running this in every collision slice caused avoidable filtering
  // and allocation during the busiest contacts.
  updateExpanded(d);
  for (const wall of stageWalls) wall.on = Math.max(0, wall.on - d);
  for (const pad of boostPads) pad.on = Math.max(0, pad.on - d);
  for (const pad of dragPads) pad.on = Math.max(0, pad.on - d);
  if (bossShield) bossShield.flash = Math.max(0, bossShield.flash - d);
  // Barriers keep circling the colossus even while it is being hit, so the
  // player is always timing a moving gap rather than a static wall.
  for (const orbit of orbitals) {
    orbit.hitCooldown = Math.max(0, orbit.hitCooldown - d);
    if (orbit.down > 0) {
      orbit.down = Math.max(0, orbit.down - d);
      continue;
    }
    orbit.a += orbit.speed * d;
    orbit.x = boss.x + Math.cos(orbit.a) * orbit.radius;
    orbit.y = boss.y + Math.sin(orbit.a) * orbit.radius;
  }
  for (let i = 0; i < slices && ball?.moving; i++) {
    ball.x += ball.vx * step;
    ball.y += ball.vy * step;
    // Drag depends on speed, and that split is the whole point.  A flat 0.9915
    // left the meteor coasting for hundreds of frames: a shot averaged 7.2s and
    // the worst ran 15s, nearly all of it watching a ball that had already
    // stopped mattering.  Simply raising the drag fixes the clock and wrecks the
    // game — at a flat 0.986 the ball also dies during the part of the shot that
    // still had work to do, and five-point figures fell from 12% of shots to 1%.
    // So the energetic phase keeps its original coast and only the dead tail is
    // cut: same 3s average as the flat value, but 40% of shots still draw a
    // figure instead of 27%, and 8% still reach five points.  Measured 120 shots
    // per setting.
    const cueSpeed = Math.hypot(ball.vx, ball.vy),
      cueDrag = Math.pow(cueSpeed > 500 ? 0.9915 : 0.972, step * 60);
    ball.vx *= cueDrag;
    ball.vy *= cueDrag;
    tickGimmickCooldowns(ball, step);
    mobileWall(ball, ball.r);
    applyStageGimmicks(ball);
    for (const g of gates) {
      g.x += g.vx * step;
      g.y += g.vy * step;
      const speed = Math.hypot(g.vx, g.vy);
      if (speed > 82) {
        g.travel += speed * step;
        wakeUnit(g);
      }
      updateBladeWheel(g, speed, step);
      // Units should roll through a contact, then settle.  They are lighter
      // than the meteor, so use visibly stronger table friction for them.
      g.vx *= Math.pow(0.974, step * 60);
      g.vy *= Math.pow(0.974, step * 60);
      tickGimmickCooldowns(g, step);
      g.contactCooldown = Math.max(0, (g.contactCooldown || 0) - step);
      g.enemyHitCooldown = Math.max(0, (g.enemyHitCooldown || 0) - step);
      g.feedbackContactCooldown = Math.max(
        0,
        (g.feedbackContactCooldown || 0) - step,
      );
      mobileWall(g, g.r, g);
      applyStageGimmicks(g, g);
      g.trailSample = (g.trailSample || 0) + step;
      if (g.trailSample >= 1 / 60) {
        g.trailSample = 0;
        g.unitTrail.push({ x: g.x, y: g.y });
        if (g.unitTrail.length > 10) g.unitTrail.shift();
      }
    }
    for (const g of gates)
      mobilePair(ball, ball.r, g, g.r, (nx, ny, impactSpeed, incoming) => {
        const speed = Math.hypot(incoming.x, incoming.y) || 1,
          ux = incoming.x / speed,
          uy = incoming.y / speed,
          ballDrive = 495 + Math.min(450, impactSpeed * 0.63),
          unitDrive = 310 + Math.min(270, impactSpeed * 0.38),
          ballDx = -nx * ballDrive + ux * 225,
          ballDy = -ny * ballDrive + uy * 225,
          unitDx = nx * unitDrive + ux * 135,
          unitDy = ny * unitDrive + uy * 135;
        ball.vx += ballDx;
        ball.vy += ballDy;
        g.vx += unitDx;
        g.vy += unitDy;
        guaranteeMomentum(ball, ballDx, ballDy, 915, 2220);
        guaranteeMomentum(g, unitDx, unitDy, 410, 1080);
        ball.power += 0.48;
        ball.bounces++;
        wakeUnit(g);
        g.collisions++;
        trackBlazeUnit(g);
        const special = applyContactAbility(g, incoming);
        ball.runeBurst = 0.92;
        if (g.feedbackContactCooldown <= 0) {
          g.feedbackContactCooldown = 0.12;
          fieldFx.push({
            type: "relay",
            x: g.x,
            y: g.y,
            t: 0,
            d: 0.48,
            col: g.col,
          });
          addPopup(g.x, g.y - 34, "공명 충돌!", g.col, true);
          if (!special) toast(g.s + " 충돌 · 유성과 별지기 동시 가속!");
        }
      });
    for (let a = 0; a < gates.length; a++)
      for (let b = a + 1; b < gates.length; b++)
        mobilePair(gates[a], gates[a].r, gates[b], gates[b].r, () => {
          wakeUnit(gates[a]);
          wakeUnit(gates[b]);
          gates[a].collisions++;
          gates[b].collisions++;
          copyLastUnitAbility(gates[a], gates[b]);
          copyLastUnitAbility(gates[b], gates[a]);
        });
    for (const b of bumpers) {
      mobileStatic(ball, b, ball.r + b.r, 1.08, () => {
        ball.bounces++;
        hitBumper(b);
      });
      for (const g of gates)
        mobileStatic(g, b, g.r + b.r, 1.06, () => {
          g.collisions++;
          wakeUnit(g);
          const speed = Math.hypot(g.vx, g.vy) || 1,
            boost = Math.min(980, speed + 76);
          g.vx *= boost / speed;
          g.vy *= boost / speed;
          fieldFx.push({
            type: "bumper",
            x: b.x,
            y: b.y,
            t: 0,
            d: 0.32,
            col: "#80e8df",
          });
        });
    }
    for (const a of adds) {
      if (a.down > 0) continue;
      mobileStatic(ball, a, ball.r + a.r, 0.92, () => {
        if (a.hitCooldown <= 0) {
          a.hitCooldown = 0.18;
          damageAdd(a, 14 + Math.round(ball.power * 6), "직격", "#d8c3ff");
        }
      });
      for (const g of gates)
        mobileStatic(g, a, g.r + a.r, 0.88, () => {
          wakeUnit(g);
          g.collisions++;
          unitImpactDamage(g, a);
        });
    }
    const wx = boss.x + Math.cos(boss.a) * 84,
      wy = boss.y + Math.sin(boss.a) * 84;
    const weak = mobileStatic(ball, { x: wx, y: wy }, ball.r + 25, 0.98, () => {
      if (boss.hitCooldown <= 0) {
        boss.hitCooldown = 0.22;
        damage(true);
      }
    });
    if (!weak)
      mobileStatic(ball, boss, ball.r + 66, 0.9, () => {
        if (boss.hitCooldown <= 0) {
          boss.hitCooldown = 0.22;
          damage(false);
        }
      });
    for (const g of gates) {
      const fx = g.fx === "copycat" ? g.copiedFx : g.fx;
      if (fx === "bladewheel") {
        const speed = Math.hypot(g.vx, g.vy),
          reach = g.r + 66,
          insideBoss =
            (g.x - boss.x) * (g.x - boss.x) + (g.y - boss.y) * (g.y - boss.y) <
            reach * reach,
          movingThrough = speed > 55 || g.bossPhaseUntilClear;
        if (speed > 55) {
          g.bossPhaseVx = g.vx / speed;
          g.bossPhaseVy = g.vy / speed;
        }
        if (movingThrough) {
          g.bossPhaseUntilClear = insideBoss;
          // If friction drops the unit below the normal settle threshold while
          // still inside the boss, keep a tiny carry velocity until it exits.
          if (insideBoss && speed <= 55) {
            g.vx = (g.bossPhaseVx || 0) * 58;
            g.vy = (g.bossPhaseVy || -1) * 58;
          }
          continue;
        }
      }
      mobileStatic(g, boss, g.r + 66, 0.88, () => {
        wakeUnit(g);
        g.bossHit = true;
        g.collisions++;
        trackBlazeBossUnit(g);
        unitImpactDamage(g, boss);
      });
    }
    updateCloneBalls(step);
    ball.wallShock = Math.max(0, (ball.wallShock || 0) - step);
    ball.nudgeCooldown = Math.max(0, (ball.nudgeCooldown || 0) - step);
    ball.trailSample = (ball.trailSample || 0) + step;
    if (ball.trailSample >= 1 / 60) {
      ball.trailSample = 0;
      ball.trail.push({ x: ball.x, y: ball.y });
      if (ball.trail.length > 24) ball.trail.shift();
    }
  }
  // Call the table settled while everything is still creeping.  Below these
  // speeds nothing reaches another object before friction stops it, so the
  // remaining drift only costs the player time — cutting it removes more than
  // a second and a half from the average shot.  Raise them together: stopping
  // the meteor while a starkeeper is still rolling would end the shot before
  // the figure's vertices have settled.
  const partyStillRolling = gates.some((g) => Math.hypot(g.vx, g.vy) > 110);
  if (ball?.moving && Math.hypot(ball.vx, ball.vy) < 150 && !partyStillRolling)
    endShot();
};
billiardPredict = function (dx, dy) {
  const aim = billiardAim(dx, dy),
    points = [{ x: ball.x, y: ball.y }],
    unitPaths = [];
  let px = ball.x,
    py = ball.y,
    vx = aim.x,
    vy = aim.y,
    first = null;
  // This used to shallow-clone every gate to tag it `type: "unit"`, sixty times
  // a second, for the five fields the sweep and the guide actually read
  // (x, y, r, col, s) — and the tag was never read off the clone anyway; the
  // hit record below sets its own.  Walk the live gates instead.
  for (const t of gates) {
    const ox = t.x - px,
      oy = t.y - py,
      along = ox * vx + oy * vy,
      near = ox * ox + oy * oy - along * along,
      reach = t.r + ball.r,
      inside = reach * reach - near;
    if (inside < 0) continue;
    const hit = along - Math.sqrt(inside);
    if (hit > 0.02 && (!first || hit < first.t)) first = { t: hit, target: t };
  }
  if (first) {
    px += vx * first.t;
    py += vy * first.t;
    points.push({ x: px, y: py });
    const nx = (px - first.target.x) / (ball.r + first.target.r),
      ny = (py - first.target.y) / (ball.r + first.target.r),
      normal = vx * nx + vy * ny,
      unitV = { x: nx * normal, y: ny * normal },
      cueV = { x: vx - unitV.x, y: vy - unitV.y };
    const travel = 260;
    unitPaths.push({
      from: { x: px, y: py },
      to: { x: px + unitV.x * travel, y: py + unitV.y * travel },
      target: first.target,
    });
    points.push({ x: px + cueV.x * 150, y: py + cueV.y * 150 });
  } else {
    points.push({ x: px + vx * 340, y: py + vy * 340 });
  }
  return {
    points,
    hits: first ? [{ x: px, y: py, type: "unit", target: first.target }] : [],
    unitPaths,
    assisted: aim.assisted,
    target: aim.target,
  };
};
drawAimGuide = function () {
  if (!run || battle?.victory || ball?.moving) return;
  const raw = drag || { x: ball.x, y: ball.y + 145 },
    p = cuePull(raw),
    guide = billiardPredict(ball.x - p.x, ball.y - p.y);
  x.save();
  x.setLineDash([7, 5]);
  x.lineWidth = 2;
  x.strokeStyle = "#d8ece5";
  x.beginPath();
  x.moveTo(guide.points[0].x, guide.points[0].y);
  for (const q of guide.points.slice(1)) x.lineTo(q.x, q.y);
  x.stroke();
  x.setLineDash([4, 4]);
  for (const path of guide.unitPaths) {
    x.strokeStyle = path.target.col;
    x.shadowBlur = 12;
    x.shadowColor = path.target.col;
    x.beginPath();
    x.moveTo(path.from.x, path.from.y);
    x.lineTo(path.to.x, path.to.y);
    x.stroke();
    x.fillStyle = path.target.col;
    x.font = "bold 10px ui-monospace";
    x.textAlign = "center";
    x.fillText(path.target.s + " 굴림", path.to.x, path.to.y - 9);
  }
  x.setLineDash([]);
  x.fillStyle = "#d8ece5";
  x.font = "bold 10px ui-monospace";
  x.textAlign = "center";
  x.fillText(
    drag
      ? guide.unitPaths.length
        ? "별지기 이동선까지 예측"
        : "아래로 끌어 별지기를 굴리세요"
      : "아래로 끌어 별지기를 굴리세요",
    ball.x,
    ball.y - 28,
  );
  x.restore();
};
registerRuntimeHook("afterDraw", drawCloneBalls);
