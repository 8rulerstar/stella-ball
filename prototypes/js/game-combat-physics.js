/* Combat collision solving, stage gimmicks, shot settlement, and aim guides. */
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
    if (!unit && o === ball) ball.firstImpact ??= "rail";
    // Rails keep their physical bounce but never count as a parry awakening.
    // The `o === ball` test matters as much as `!unit`: clone meteors also
    // come through here (updateCloneBalls), and tableWall() tallies the
    // PLAYER's meteor - `ball.bounces`, which multiplies its damage, and the
    // afterTableWall hook, which grants blaze and plays the wall beat at the
    // main meteor's position. Without this a split clone bouncing off a
    // cushion paid the player for a bounce their own meteor never made.
    // The stageWall path below already had this guard; the rails did not.
    if (!unit && o === ball) {
      tableWall();
      breakDegenerateLine(o);
    }
  }
  return hit;
}
/* 완전한 축 정렬은 이 게임에서 빠져나올 수 없는 샷을 만든다. 튜토리얼 패링
   수업이 그 증거다 — 발사석 (360,748)과 미리내 (360,405)의 x가 같아서
   `aim.x`가 «정확히» 0이고, 그 뒤로 마찰은 스칼라 곱, 벽 반사는 부호 반전,
   접촉은 nx = 0/d = 0이라 어떤 연산도 그 0을 깨지 못한다. 유성은 같은 세로선을
   왕복하며 같은 접점을 다시 때리고, 매 판 바이트 단위로 같은 경로를 그린다.
   측정된 최장 샷은 13.7초였다.
   저장소 어디에도 이걸 깨는 장치가 없었다 — 흔들림도, 최소 반사각도,
   교착 감지도 없다. 세로 루프는 반드시 위아래 벽에 닿으므로 여기가 확실한
   자리다. 축에 붙어 있을 때만, 한 번만 튼다: 2도를 틀면 |vx|/speed가 0.035가
   되어 아래 문턱(0.02)을 넘어가므로 다음 반사부터는 손대지 않는다.
   부호는 고정이다. `Math.random`을 쓰면 봇 하니스가 기대는 결정론이 깨져
   같은 입력이 같은 결과를 내지 않게 된다. */
const DEGENERATE_AXIS_RATIO = 0.02;
function breakDegenerateLine(o) {
  const speed = Math.hypot(o.vx, o.vy);
  if (speed < 1) return;
  const axisLocked =
    Math.abs(o.vx) / speed < DEGENERATE_AXIS_RATIO ||
    Math.abs(o.vy) / speed < DEGENERATE_AXIS_RATIO;
  if (!axisLocked) return;
  const turn = 0.035,
    c = Math.cos(turn),
    sn = Math.sin(turn),
    vx = o.vx * c - o.vy * sn,
    vy = o.vx * sn + o.vy * c;
  o.vx = vx;
  o.vy = vy;
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
  const dealt = before - boss.hp;
  // Every damage source routes through here (MAINTENANCE.md's one choke
  // point), so this is the single place the boss's own body can learn it was
  // hurt. `hitCooldown` only marks direct meteor contact; `hitFlash` marks
  // any real damage - assists, area bursts, clones, blade ticks - and drives
  // the red flinch in draw(). Blocked hits (dealt 0) keep the shield's own
  // flash instead.
  if (dealt > 0) boss.hitFlash = Math.max(boss.hitFlash || 0, 0.26);
  return dealt;
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
/* 포효가 지정한 자리로 실제로 밀어 보낸다. 좌표를 덮어쓰지 않고 매 프레임
   조금씩 옮기므로, 유성도 별지기도 「끌려간다」로 보인다. 도착하면 스스로
   꺼진다 — 물리가 다시 주도권을 가진다. */
function advanceRoarPush(d) {
  const move = (o) => {
    if (!o?.roarTo) return;
    if (frameClock < o.roarTo.at) return;
    const span = Math.max(1, o.roarTo.until - o.roarTo.at),
      t = Math.min(1, (frameClock - o.roarTo.at) / span),
      // 감속하며 도착한다. 등속으로 밀면 「끌려간다」가 아니라 「미끄러진다」다.
      ease = 1 - (1 - t) * (1 - t);
    /* 시간으로 보간한다. 프레임마다 목표 쪽으로 일정 비율씩 당기면 프레임률에
       따라 도착 시각이 달라지고, 실측에서 0.46초가 아니라 0.2초에 닿았다.
       출발점을 기억해 두고 0.12→0.46초를 그대로 따른다. */
    o.x = o.roarTo.fromX + (o.roarTo.x - o.roarTo.fromX) * ease;
    o.y = o.roarTo.fromY + (o.roarTo.y - o.roarTo.fromY) * ease;
    o.vx *= 0.72;
    o.vy *= 0.72;
    if (t >= 1) {
      o.x = o.roarTo.x;
      o.y = o.roarTo.y;
      o.vx = 0;
      o.vy = 0;
      o.roarTo = null;
    }
  };
  for (const g of gates) move(g);
  move(ball);
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
      /* 디자인 세션 §6-2는 「순간이동 아님」을 못 박았다. 예전에는 좌표를
         그대로 덮어써서 판 위의 모든 것이 한 프레임에 사라졌다 나타났고,
         그래서 「밀려났다」가 아니라 「초기화됐다」로 읽혔다.
         목표만 정해 두고 실제로 밀어 보낸다 — 0.12초 뒤에 시작해 0.46초에
         닿는다. 도착 판정은 물리 루프가 한다. */
      o.roarTo = {
        x: best[0],
        y: best[1],
        // 출발점을 기억해 둔다. 시간으로 보간하려면 어디서 떠났는지가 필요하다.
        fromX: o.x,
        fromY: o.y,
        at: frameClock + 120,
        until: frameClock + 460,
      };
      areaBursts.push({
        x: best[0],
        y: best[1],
        r: 52,
        col: "#f6c48e",
        t: 0,
        d: 0.5,
      });
    };
    for (const g of gates) throwTo(g);
    if (ball) throwTo(ball);
    /* 포효. 흔들림 26px은 강타(24px)보다 한 단계 위다 — 이 판에서 가장 큰
       사건이므로 가장 큰 값을 받아야 한다. 파형은 그리기 쪽이 읽는다. */
    screenShake = Math.max(screenShake, 26);
    bossRoar = { at: frameClock, until: frameClock + 460 };
    toast("거상의 포효 · 모두 모서리로 밀려납니다");
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
      if (!unit && o === ball) ball.firstImpact ??= "orbital";
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
      // Orbitals remain physical for rolling units but cannot awaken them.
    });
  }
  for (const wall of stageWalls)
    mobileRect(o, o.r, wall, wall.restitution, () => {
      if (!unit && o === ball) ball.firstImpact ??= "stage-wall";
      wall.on = 0.18;
      fieldFx.push({
        type: "wall",
        x: o.x,
        y: o.y,
        t: 0,
        d: 0.28,
        col: "#c3f3ff",
      });
      if (!unit && o === ball) tableWall();
      else o.bounces = (o.bounces || 0) + 1;
    });
  for (const pad of boostPads) applyBoostPad(o, pad, unit);
}
function mobilePair(a, ar, b, br, onHit, kind = "pair") {
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
  // `kind` exists because the feedback consumer cannot tell these apart from
  // the payload alone: every caller passes a starkeeper as one of the two
  // bodies, so a gates.includes() test matches the meteor parry, a physical
  // unit-to-unit nudge and a clone relay equally. Only the first is a 공명.
  runRuntimeHooks("afterMobilePairCollision", { a, b, nx, ny, along, kind });
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
function settleParty() {
  const context = {
    awakened: gates.filter((g) => g.moved && g.travel > 10),
    figureActive: false,
    handled: false,
    result: undefined,
  };
  runRuntimeHooks("beforePartySettle", context);
  if (!context.handled && context.awakened.length) {
    battle.finisherSerial = 0;
    const finishers = context.awakened.filter((g) => {
      const fx = g.fx === "copycat" ? g.copiedFx : g.fx;
      return fx !== "bladewheel";
    });
    for (const g of context.awakened) {
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
      : context.awakened.map((g) => g.s).join(" · ") +
        "의 이동 공격이 끝났습니다. 정산 공격은 없습니다.";
    toast(
      finishers.length
        ? finishers.length + "명 각성 · 다음 샷은 현재 배치에서"
        : "질풍 칼날 종료 · 정산 공격 없음",
    );
  } else if (!context.handled) {
    msg =
      "아무 별지기도 깨우지 못했습니다. 다음 샷은 현재 위치에서 다시 설계하세요.";
    toast("별지기 미각성 · 다음 샷 준비");
  }
  runRuntimeHooks("afterPartySettle", context);
  return context.result;
}
function endShot() {
  if (!ball?.moving) return;
  settleParty();
  finalizeBilliardShot();
  runRuntimeHooks("afterShotEnd", { battle, ball });
}
function hitGate(g) {
  wakeUnit(g);
  g.collisions = (g.collisions || 0) + 1;
  msg = g.s + "이(가) 굴러가기 시작했습니다. 멈추면 고유 공격을 시행합니다.";
  sync();
}
// Zone labels belonged to the former static-board version, where hitting a
// labelled tile fired the hero standing on it.  A hero now wakes only by real
// movement, so the whole `triggerZone` concept and its call sites are gone.
function resolveMeteorParryContact(g, contact) {
  const { nx, ny, impactSpeed, incoming } = contact,
    speed = Math.hypot(incoming.x, incoming.y) || 1,
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
  // A successful parry should release into a readable next line, not push an
  // already fast meteor straight back to the maximum chain speed.
  guaranteeMomentum(ball, ballDx, ballDy, 760, 1720);
  guaranteeMomentum(g, unitDx, unitDy, 410, 1080);
  ball.power += 0.48;
  ball.bounces++;
  wakeUnit(g, { subtle: true });
  g.collisions++;
  trackBlazeUnit(g);
  const special = applyContactAbility(g, incoming);
  ball.runeBurst = 0.92;
  impact?.(false, contact.x ?? g.x, contact.y ?? g.y, "contact");
  if (g.feedbackContactCooldown <= 0) {
    g.feedbackContactCooldown = 0.12;
    fieldFx.push({
      type: "relay",
      x: contact.x ?? g.x,
      y: contact.y ?? g.y,
      t: 0,
      d: 0.48,
      col: g.col,
    });
    addPopup(g.x, g.y - 34, "공명 충돌!", g.col, true);
    if (!special) toast(g.s + " 충돌 · 유성과 별지기 동시 가속!");
  }
  runRuntimeHooks("afterParryContact", { gate: g, contact, special });
}
function simulatePhysics(d) {
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
  advanceRoarPush(d);
  for (let i = 0; i < slices && ball?.moving; i++) {
    ball.x += ball.vx * step;
    ball.y += ball.vy * step;
    // Keep the original even coast through the low-speed tail. The temporary
    // cut at 0.972 made a contact that had visibly bounced read as if it lost
    // all momentum immediately; the training parry now supplies the skill gate
    // instead of this passive decay.
    // Cygnus' flight scales the loss, not the speed: at 0.35 the meteor sheds a
    // third of the friction it normally would, so the shot coasts much further
    // without ever starting faster or becoming frictionless.
    const baseDrag = Math.pow(0.9915, step * 60),
      cueDrag = ball.glide ? 1 - (1 - baseDrag) * ball.glide : baseDrag;
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
      /* 유닛 꼬리를 초당 60번 유닛마다 모으고 있었는데, 저장소 전체에서 이
         배열을 «읽는» 곳이 없다 — 밀고 자르고 비우는 자리만 넷이다. 그리는
         경로가 사라진 뒤 수집만 남은 것이라, 유닛 수 × 60개/초의 객체를
         아무도 쓰지 않으려고 만들고 있었다. 배열 자체는 남긴다: 초기화
         코드와 game-figure.js의 주석이 그 존재를 전제한다. */
    }
    for (const g of gates)
      mobilePair(
        ball,
        ball.r,
        g,
        g.r,
        (nx, ny, impactSpeed, incoming) => {
          ball.firstImpact ??= "starkeeper";
          ball.starkeeperTouched = true;
          // `mobilePair` has already performed the ordinary elastic response.
          // An armed Space parry turns this contact into a high-energy resonance.
          // Otherwise retain it briefly, so a player can answer what they saw
          // just after the billiards bounce without rewinding the table.
          const contact = {
            nx,
            ny,
            impactSpeed,
            incoming,
            x: (ball.x + g.x) / 2,
            y: (ball.y + g.y) / 2,
          };
          const parried =
            typeof consumeTrainingParry === "function" &&
            consumeTrainingParry(g, contact);
          if (!parried) {
            rememberTrainingParryContact?.(g, contact);
            return;
          }
          resolveMeteorParryContact(g, contact);
        },
        "meteor-hero",
      );
    for (let a = 0; a < gates.length; a++)
      for (let b = a + 1; b < gates.length; b++) {
        // An armed wheel cuts through the moving formation instead
        // of becoming another billiard contact. Before its parry it remains a
        // normal physical unit.
        if (isBladeWheelPhasing(gates[a]) || isBladeWheelPhasing(gates[b]))
          continue;
        mobilePair(gates[a], gates[a].r, gates[b], gates[b].r, () => {
          // Unit-to-unit contacts remain physical only. A meteor parry is the
          // sole source of awakenings and contact abilities.
        });
      }
    for (const b of bumpers) {
      mobileStatic(ball, b, ball.r + b.r, 1.08, () => {
        ball.firstImpact ??= "bumper";
        ball.bounces++;
        hitBumper(b);
      });
      for (const g of gates)
        mobileStatic(g, b, g.r + b.r, 1.06, () => {
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
        ball.firstImpact ??= "remnant";
        if (a.hitCooldown <= 0) {
          a.hitCooldown = 0.18;
          damageAdd(a, 14 + Math.round(ball.power * 6), "직격", "#d8c3ff");
        }
      });
      for (const g of gates) {
        if (isBladeWheelPhasing(g)) continue;
        mobileStatic(g, a, g.r + a.r, 0.88, () => {
          // Enemy contacts are physical only; an armed wheel deals its own
          // travelling damage from updateBladeWheel().
        });
      }
    }
    bossWeakPoint.x = boss.x + Math.cos(boss.a) * 84;
    bossWeakPoint.y = boss.y + Math.sin(boss.a) * 84;
    const directBossHit = (weak) => {
      ball.openingBossContact = ball.firstImpact === null;
      ball.firstImpact ??= "boss";
      damage(weak);
    };
    const weak = mobileStatic(ball, bossWeakPoint, ball.r + 25, 0.98, () => {
      if (boss.hitCooldown <= 0) {
        boss.hitCooldown = 0.22;
        directBossHit(true);
      }
    });
    if (!weak)
      mobileStatic(ball, boss, ball.r + 66, 0.9, () => {
        if (boss.hitCooldown <= 0) {
          boss.hitCooldown = 0.22;
          directBossHit(false);
        }
      });
    for (const g of gates) {
      if (isBladeWheelPhasing(g)) {
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
        // A normal boss collision is physical only. An armed wheel reaches
        // the boss through its own travelling damage path above.
      });
    }
    updateCloneBalls(step);
    ball.wallShock = Math.max(0, (ball.wallShock || 0) - step);
    ball.trailSample = (ball.trailSample || 0) + step;
    if (ball.trailSample >= 1 / 60) {
      ball.trailSample = 0;
      ball.trail.push({ x: ball.x, y: ball.y });
      if (ball.trail.length > 24) ball.trail.shift();
    }
  }
  // Use the original settle thresholds. The raised 150/110 cut-off ended a
  // still-readable rebound before it could carry into the next contact.
  const partyStillRolling = gates.some(
    (g) => g.vx * g.vx + g.vy * g.vy > 55 * 55,
  );
  /* 포효가 유성을 끌고 가는 동안에는 샷이 끝나면 안 된다. 밀면서 속도를
     죽이므로 정착 문턱을 그냥 통과해 버리고, 그러면 밀림이 끝나기도 전에
     다음 샷이 시작되면서 유성 객체가 교체된다 — 실측에서 유성이 모서리에
     닿지 못하고 (207,689)에서 멈췄다. */
  const roarHolds = Boolean(ball?.roarTo) || gates.some((g) => g.roarTo);
  if (
    ball?.moving &&
    !roarHolds &&
    ball.vx * ball.vx + ball.vy * ball.vy < 68 * 68 &&
    !partyStillRolling
  )
    endShot();
}
function billiardPredict(dx, dy) {
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
    // The Big Dipper points at the pole star, and the boon it leaves shows the
    // line further than the guide normally admits to knowing.
    const after = ball.trueAim ? 520 : 150;
    points.push({ x: px + cueV.x * after, y: py + cueV.y * after });
  } else {
    points.push({
      x: px + vx * (ball.trueAim ? 620 : 340),
      y: py + vy * (ball.trueAim ? 620 : 340),
    });
  }
  return {
    points,
    hits: first ? [{ x: px, y: py, type: "unit", target: first.target }] : [],
    unitPaths,
    assisted: aim.assisted,
    target: aim.target,
  };
}
function drawAimGuide() {
  if (!run || battle?.victory || ball?.moving) return;
  const raw = drag || { x: ball.x, y: ball.y + 145 },
    p = cuePull(raw),
    guide = billiardPredict(ball.x - p.x, ball.y - p.y);
  x.save();
  // A dot chain rather than a dashed line: the carved floor and the stepped
  // rings are all hard pixels, and an antialiased stroke reads as a different
  // material laid over them.  Bounce points get a cross so the turn is legible
  // without following the dots.
  x.fillStyle = "#d8ece5";
  for (let i = 1; i < guide.points.length; i++) {
    const from = guide.points[i - 1],
      to = guide.points[i],
      span = Math.hypot(to.x - from.x, to.y - from.y),
      steps = Math.max(1, Math.round(span / 11));
    for (let k = 0; k <= steps; k++) {
      const t = k / steps;
      x.fillRect(
        Math.round(from.x + (to.x - from.x) * t) - 1,
        Math.round(from.y + (to.y - from.y) * t) - 1,
        3,
        3,
      );
    }
    if (i < guide.points.length - 1) {
      x.fillRect(Math.round(to.x) - 7, Math.round(to.y) - 1, 15, 3);
      x.fillRect(Math.round(to.x) - 1, Math.round(to.y) - 7, 3, 15);
    }
  }
  x.setLineDash([4, 4]);
  x.lineWidth = 2;
  for (const path of guide.unitPaths) {
    x.strokeStyle = path.target.col;
    // No glow: it softens the edge against the pixel floor.  The starkeeper's
    // own colour is contrast enough.
    x.shadowBlur = 0;
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
}
registerRuntimeHook("afterDraw", function drawSteerPrompt() {
  if (!run || battle?.victory || !ball?.moving) return;
  const flash = ball.steerFlash || 0;
  x.save();
  x.textAlign = "center";
  x.font = "bold 10px ui-monospace";
  if (!ball.steerUsed) {
    x.globalAlpha = 0.82;
    x.fillStyle = "#fff2c6";
    x.fillText("좌클릭 ↶ · 우클릭 ↷ · 1회 전환", ball.x, ball.y - 27);
  } else if (flash > 0) {
    x.globalAlpha = Math.min(1, flash * 2.4);
    x.fillStyle = "#e8f7df";
    x.fillText("궤도 전환 완료", ball.x, ball.y - 27);
  }
  x.restore();
});
registerRuntimeHook("afterDraw", drawCloneBalls);

const CombatModule = StellaRuntime.modules.register("combat", {
  resolveParryContact(gate, contact) {
    return resolveMeteorParryContact(gate, contact);
  },
});
