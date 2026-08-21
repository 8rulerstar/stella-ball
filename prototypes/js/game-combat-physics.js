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
    /* 쿠션에 튄 별지기는 그 충돌을 자기 정산에 싣는다. `wallHits`는 정산
       피해 공식(`g.wallHits * 4`)이 여전히 읽는 값인데, 각성이 패링 전용이
       되면서 이 값을 올리는 자리가 저장소에서 전부 사라져 그 항이 죽어
       있었다. */
    if (unit) {
      unit.wallHits = (unit.wallHits || 0) + 1;
      unit.collisions = (unit.collisions || 0) + 1;
      wakeUnit(unit);
    }
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
    /* 포효는 이 게임에서 화면을 가장 크게 흔드는 사건인데 소리가 없었다.
       한 번만 낸다 — 아래 throwTo는 판 위의 모든 것에 대해 불린다. */
    combatSfx?.("roar", 1.15);
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
      if (unit) wakeUnit(unit);
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
      if (unit) {
        unit.wallHits = (unit.wallHits || 0) + 1;
        unit.collisions = (unit.collisions || 0) + 1;
        wakeUnit(unit);
        o.bounces = (o.bounces || 0) + 1;
      } else if (o === ball) tableWall();
      else o.bounces = (o.bounces || 0) + 1;
    });
  for (const pad of boostPads) applyBoostPad(o, pad, unit);
}
/* 별지기 질량. 1이면 등질량 — 실제 당구와 같고, 지금 값이다.

   한 번 5로 올렸다가 되돌렸다. 「정통으로 맞을수록 유성이 죽는다」를 없애면
   예측이 좋아질 거라 봤는데, 넓은 각도에서 다시 재니 반대였다:

     접촉별 방향차(마우스 1px, 중앙값, 도) — 238표본, ±40도를 5도 간격
                        1회   2회   3회   4회    5회    6회   샷당접촉
       질량 5           0.1   1.1   2.1  22.7   65.3   98.5      5
       질량 1           0.1   0.3   1.7  10.9   19.1   20.7      4

   모든 접촉에서 등질량이 더 예측 가능하다. 처음에 반대 결론을 낸 것은 표본
   16개를 «각도 하나»에서 뽑았기 때문이다(각 스테이지의 정책각 ±0). 그 각들이
   운 나쁘게 몰려 있었다. 각도를 훑자 뒤집혔다.

   등질량은 그 자체로 당구의 규칙이기도 하다 — 정통으로 맞은 흰 공이 서는
   것은 버그가 아니라 스턴샷이다. 이 게임에 없는 것은 질량차가 아니라 회전이다.

   massB를 올리고 싶다면 위 표를 다시 재고 나서 올린다. */
const HERO_MASS = 1;
function mobilePair(a, ar, b, br, onHit, kind = "pair", massB = 1) {
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
  /* 법선은 «겹친 자리»가 아니라 «닿은 자리»에서 잡는다.

     한 프레임을 최대 3조각으로만 쪼개는데(slices) 실제로는 2조각이라, 발사
     직후 유성은 한 조각에 14px씩 움직인다 — 반지름이 13이므로 접촉이 감지될
     때 이미 접촉 거리의 40%까지 파고들어 있다. 그 자리의 법선은 실제로 닿은
     순간의 법선과 다르고, 조준 가이드는 정확한 접점을 계산하므로 둘이 갈렸다:
     실측 3.67도(중앙), p90 9.98도. 가이드 선이 유성 지름만큼 어긋난다는 뜻이다.

     상대 속도를 따라 시간을 되감아 |p + vrel·t| = reach가 되는 t를 푼다.
     위치는 건드리지 않는다 — 겹침 해소는 그대로 두고 «방향»만 바로잡는다. */
  const relVx = a.vx - b.vx,
    relVy = a.vy - b.vy,
    relSq = relVx * relVx + relVy * relVy;
  if (relSq > 1) {
    const pDotV = dx * relVx + dy * relVy,
      disc = pDotV * pDotV - relSq * (d * d - reach * reach);
    if (disc >= 0) {
      const t = (-pDotV + Math.sqrt(disc)) / relSq;
      if (t >= 0 && t * t * relSq < reach * reach * 4) {
        const tx = dx + relVx * t,
          ty = dy + relVy * t,
          tl = Math.hypot(tx, ty) || 1;
        nx = tx / tl;
        ny = ty / tl;
      }
    }
  }
  const incoming = { x: a.vx, y: a.vy },
    /* 탄성 충돌의 환산질량. massB = 1이면 mu = 0.5이고 impulse = 0.98 * along이라
       예전 식과 글자 그대로 같다. 겹침 해소(위의 overlap * 0.5)는 질량을 타지
       않는다 — 각성이 살아남는다고 측정한 것이 이 상태이고, 여기를 함께 바꾸면
       그 측정이 무효가 된다. */
    reduced = massB / (1 + massB),
    impulse = 1.96 * reduced * along;
  a.vx -= impulse * nx;
  a.vy -= impulse * ny;
  b.vx += (impulse / massB) * nx;
  b.vy += (impulse / massB) * ny;
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
    // 이 샷이 별자리를 띄웠는가. 각성 공격을 «없애는» 값이 아니라 «늦추는»
    // 값이다 — 현현이 끝난 뒤에 정산이 시작한다.
    afterFigure: false,
    result: undefined,
  };
  runRuntimeHooks("beforePartySettle", context);
  if (!context.handled && context.awakened.length) {
    battle.finisherSerial = 0;
    const finishers = context.awakened.filter((g) => {
      const fx = g.fx === "copycat" ? g.copiedFx : g.fx;
      return fx !== "bladewheel";
    });
    /* 인원수를 함께 넘긴다. 정산 전체가 쓰는 시간을 예산으로 잡으려면 첫 번째
       피니셔를 큐에 넣는 시점에 「몇 명인지」를 알아야 하는데, 그것을 아는
       곳은 여기뿐이다(game-feedback.js의 SETTLE_BUDGET). */
    const settleOptions = {
      finisher: true,
      afterFigure: context.afterFigure,
      finisherCount: finishers.length,
    };
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
          settleOptions,
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
          settleOptions,
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
          settleOptions,
        );
        continue;
      }
      if (g.fx === "copycat" && !copied) {
        addPopup(g.x, g.y - 30, "모사 대상 없음", g.col, false);
        toast("그믐 · 아직 모사한 아군이 없습니다.");
      }
      queueUnitAssist(g, base, g.s + " 각성", settleOptions);
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
        /* 각성은 다시 «움직임»이다. 2954f79가 패링을 유일한 각성 조건으로
           묶으면서, 패링하지 않은 샷은 별지기를 밀어내고 판을 가로질러도
           아무 일도 일어나지 않는 판이 됐다 — 실측으로 패링 없는 판의 피해
           용량 중앙값이 124, 패링한 판이 972다(7.8배). 캠페인 34판 중
           패링 없이 넘어가는 판은 1-1 하나뿐이었다.
           패링은 그대로 남되 별자리 쪽 일만 한다: 접점이 별빛 노드가 되고,
           공명이 유성과 별지기를 함께 가속한다. 능력을 여는 열쇠는 아니다. */
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
          /* 자동 공명이면 접촉 자체가 공명이다 — 창도 쿨다운도 보지 않는다.
             가속(resolveMeteorParryContact)은 그대로 일어나므로 판의 에너지는
             줄지 않는다. 실측: 공명을 아예 없애면 피해 용량이 482 -> 297로
             38% 사라지는데, 그 대부분이 노드가 아니라 이 가속이었다. */
          const parried =
            typeof consumeTrainingParry === "function" &&
            (typeof autoParryOn === "function" && autoParryOn()
              ? consumeTrainingParry(g, contact, false, true)
              : consumeTrainingParry(g, contact));
          if (!parried) {
            rememberTrainingParryContact?.(g, contact);
            return;
          }
          resolveMeteorParryContact(g, contact);
        },
        "meteor-hero",
        HERO_MASS,
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
  /* 유성 정지 문턱 110 (2026-08-21). 유닛 쪽 55는 그대로다.

     예전에 150/110으로 함께 올렸다가 되돌렸다 — 아직 읽히는 되튐이 다음
     접촉으로 이어지기 전에 끊겼기 때문이다. 그래서 이번에는 «꼬리만» 자른다.

     근거: 마지막 접촉 뒤로 아무 일도 일어나지 않는 구간이 샷당 중앙 2.30초,
     전체 체공의 39%다(154샷). 그 구간의 속도는 p10 76 · 중앙 128이라 68로는
     거의 걸리지 않는다. 문턱을 훑어 실제 런타임에서 재면:

       문턱   평균 샷   최장 샷   클리어율   공명/판
        68     4.90초    6.72초     87.5%     5.21
       110     3.99초    5.43초     90.6%     4.76
       130     3.99초    5.27초     85.4%     4.94

     110에서 샷이 19% 짧아지는데 클리어율은 오히려 오르고 공명은 9% 준다.
     130은 시간 이득 없이 클리어율만 떨어지므로 여기가 끝이다. 되돌리려면
     68로 쓰면 된다.

     유닛 문턱(55)은 건드리지 않았다 — 75·95로 올려도 평균 샷이 3.99에서
     3.97초로만 움직여 값을 바꿀 이유가 없다. */
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
    ball.vx * ball.vx + ball.vy * ball.vy < 110 * 110 &&
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
    /* 가이드는 물리와 같은 식을 써야 한다. 예전에는 법선 성분을 통째로
       넘기는 등질량 결과(cueV = v - (v·n)n)를 그렸는데, 물리가 HERO_MASS를
       타기 시작하면 그리는 선과 실제 진로가 갈린다 — 예측 가능하게 만들려던
       변경이 오히려 가이드를 거짓말로 만든다. mobilePair와 같은 환산질량을
       쓴다(계수 0.98도 여기서 함께 맞춰진다). */
    const nx = (px - first.target.x) / (ball.r + first.target.r),
      ny = (py - first.target.y) / (ball.r + first.target.r),
      normal = vx * nx + vy * ny,
      reduced = HERO_MASS / (1 + HERO_MASS),
      impulse = 1.96 * reduced * normal,
      unitV = { x: (nx * impulse) / HERO_MASS, y: (ny * impulse) / HERO_MASS },
      cueV = { x: vx - nx * impulse, y: vy - ny * impulse };
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
  /* 입장 연출이 도는 동안에는 그리지 않는다. 거상이 내려오고 별지기가 맺히는
     중에 발사 경로가 먼저 떠 있으면, 아직 시작하지도 않은 샷의 답이 화면에
     미리 나와 있는 셈이다 — 「스테이지 진입할 때 경로가 미리 나온다」는
     제보가 이것이었다. 연출이 끝나면 평소대로 돌아온다. */
  if (introProgress() < 1) return;
  /* 조준 경로가 둘이다. 별빛이 셋 이상이면 «찍기»가 조준이고, 그때 그리는
     선은 지금 고른 셋(또는 둘 + 마우스가 올라간 하나)이 정한 방향이다.
     아직 고른 게 모자라면 그릴 선이 없다 — 예전처럼 기본 아래 방향을 그리면
     고르지도 않은 항로가 화면에 미리 나와 있는 셈이 된다. */
  let aimDx, aimDy;
  if (aimStarReady()) {
    const preview = aimStarPreview();
    if (!preview) return;
    aimDx = preview.dx;
    aimDy = preview.dy;
  } else {
    const p = cuePull(drag || { x: ball.x, y: ball.y + 145 });
    aimDx = ball.x - p.x;
    aimDy = ball.y - p.y;
  }
  const guide = billiardPredict(aimDx, aimDy);
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
    x.shadowBlur = combatFxBlur(0);
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
  /* 조향 수업은 같은 말을 자기 어휘로 이미 세 군데에 그린다 — 유성 양옆의
     방향 화살표, 정지 큐의 「좌클릭 ↶ · 우클릭 ↷」, 화면 아래 배너. 그 위에
     이 일반 안내까지 얹히면 유성 둘레 27px 자리에서 글자와 화살표가 겹쳐
     통째로 뭉갠다(scripts/probe-steer-lesson.mjs의 실화면). 수업이 안내를
     맡는 동안에는 물러난다. */
  if (
    typeof isOnboardingSteerGuided === "function" &&
    isOnboardingSteerGuided()
  )
    return;
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
/* 별빛 조준점(2026-08-18). 패링과 안내별이 남긴 점, 지금 고른 것, 그리고
   셋이 모였을 때의 삼각형과 무게중심을 그린다.
   색은 별지기의 판단색(g.col)을 그대로 쓴다 — 어느 별지기에서 나온 별빛인지가
   곧 그 점의 정체이고, 표현용 토큰으로 덮으면 그 인과가 사라진다. */
/* 별빛은 «별»로 그린다. 별지기도 원형 토큰이라, 별빛을 원으로 그리면 판
   위에서 둘이 같은 물건으로 보인다 — 실제로 첫 화면에서 구분이 안 됐다.
   이 저장소가 공명 연출에서 이미 배운 규칙이다: 다른 것은 밝기가 아니라
   모양으로 갈라야 읽힌다(PARRY_FX 주석). */
function pixelSparkle(cx, cy, r, col, thick = 3) {
  x.fillStyle = col;
  const step = 3;
  for (let d = -r; d <= r; d += step) {
    const taper = Math.max(1, Math.round((1 - Math.abs(d) / r) * thick));
    const px = Math.round((cx + d) / step) * step,
      py = Math.round((cy + d) / step) * step;
    x.fillRect(px, Math.round(cy) - taper, step, taper * 2);
    x.fillRect(Math.round(cx) - taper, py, taper * 2, step);
  }
}
/* 연출 시계의 실시간 보폭. 이 파일의 조준 연출 감쇠는 draw 훅에서 도는데,
   draw는 60Hz가 아니라 «제시된 프레임»마다 온다 — 120~165Hz 패널은 rAF
   상한이 일부러 원주사율로 두므로, 고정 1/60을 빼면 모든 박자가 2배속이
   된다(시네마틱의 cineFrameDelta와 같은 병). frameClock은 제시 프레임의
   rAF 타임스탬프라, 그 차가 곧 실경과다. 한 프레임에 여러 함수가 불러도
   같은 값을 돌려준다. */
let aimFxDtFrame = NaN,
  aimFxDtPrev = NaN,
  aimFxDtValue = 1 / 60;
function aimFxDelta() {
  if (frameClock !== aimFxDtFrame) {
    aimFxDtValue = Number.isFinite(aimFxDtPrev)
      ? Math.min(0.05, Math.max(0, (frameClock - aimFxDtPrev) / 1000))
      : 1 / 60;
    aimFxDtPrev = frameClock;
    aimFxDtFrame = frameClock;
  }
  return aimFxDtValue;
}
/* 1e(2026-08-21) 조준 교습 상태. 세션 한정 — 저장 항목을 늘리지 않는다.
   shots는 aimStarShot 발사 확정 지점에서, flipped는 빈 곳 클릭 뒤집기
   지점에서 1줄씩 배선한다(patches/README.md). */
const aimTeach = { flipped: false, shots: 0 };
function drawAimStars() {
  if (!run || battle?.victory || ball?.moving || !aimStarReady()) return;
  if (introProgress() < 1) return;
  /* 별자리 캐스트(입력 잠금) 동안에는 조준 화면을 접는다. 클릭도 Space도
     조용히 먹히는데 호버 링·«Space 발사» 안내만 살아 있으면, 판이 응답을
     멈춘 것처럼 읽힌다 — 잠긴 동안은 시네마틱이 화면의 주인이다. */
  if (typeof isCombatInputLocked === "function" && isCombatInputLocked())
    return;
  const nodes = aimNodes(),
    unitCount = nodes.length - aimStars.length,
    preview = aimStarPreview(),
    // 맥동. 지금이 «고르는 시간»이라는 것이 가만히 있어도 읽혀야 한다.
    pulse = 0.5 + 0.5 * Math.sin(frameClock / 260);
  x.save();
  /* 판을 살짝 덮는다. 별빛이 5px짜리 보석이라 판의 다른 것들에 묻혀
     「안 보인다」는 제보가 있었다 — 크기만 키우면 판이 시끄러워지므로,
     주위를 낮추고 별빛만 남긴다. 판단색을 바꾸지는 않는다(§1-4).
     별지기 노드만 있을 때는 덮지 않는다 — 별지기는 스프라이트가 커서 묻힐
     일이 없고, 노드 조준이 이제 샷 사이 상시라 늘 덮으면 판의 평시 얼굴이
     어두운 판으로 바뀌어 버린다. */
  if (aimStars.length) {
    x.globalAlpha = 0.34;
    x.fillStyle = "#0b0718";
    x.fillRect(0, 0, W, H);
    x.globalAlpha = 1;
  }

  // 별자리 후보 = 고르지 않은 «별빛»만. 별지기 노드는 태울 수 없으므로
  // 세지 않는다. (아래 노드 루프와 HUD도 이 값을 쓴다.)
  let pickedStars = 0;
  for (const i of aimPick) if (i >= unitCount) pickedStars++;
  const restCount = aimStars.length - pickedStars;
  /* 함께 탈 별빛들을 잇는 실. 「안 찍은 것들이 별자리가 된다」를 금색
     고리(아래)만으로는 묶음으로 못 읽는다는 전제에서, 떨어진 순서대로
     흐린 실로 이어 «이것들이 한 도형»임을 보인다. 실제 도형은 발동 때
     뼈대 교정을 거치므로 여기서는 모양을 주장하지 않고 잇기만 한다. */
  if (restCount >= 3) {
    x.strokeStyle = "#ffd27f";
    x.globalAlpha = 0.22;
    x.setLineDash([3, 5]);
    x.lineWidth = 1.5;
    x.beginPath();
    let moved = false;
    for (let i = 0; i < aimStars.length; i++) {
      if (aimPick.includes(unitCount + i)) continue;
      const s = aimStars[i];
      moved ? x.lineTo(s.x, s.y) : x.moveTo(s.x, s.y);
      moved = true;
    }
    x.stroke();
    x.setLineDash([]);
    x.globalAlpha = 1;
  }
  /* 고른 노드를 순서대로 잇는 실. 조준이 «세 점으로 도형을 긋는 일»이라는
     것이 손끝에서 보인다 - 넓게 그리면 세다는 규칙도 이 실의 크기로 읽힌다. */
  if (aimPick.length >= 2) {
    x.strokeStyle = "#fff6e2";
    x.globalAlpha = 0.3;
    x.setLineDash([4, 4]);
    x.lineWidth = 1.5;
    x.beginPath();
    aimPick.forEach((idx, i) => {
      const n = nodes[idx];
      if (!n) return;
      i ? x.lineTo(n.x, n.y) : x.moveTo(n.x, n.y);
    });
    x.stroke();
    x.setLineDash([]);
    x.globalAlpha = 1;
  }
  /* 1e-5: 남은 별빛(별자리 후보)끼리 점선 실 + 태그. 금 무리만으로는
     «이것들이 한 세트로 탄다»가 읽히지 않았다. */
  {
    const rest = [];
    for (let i = 0; i < nodes.length; i++)
      if (!nodes[i].unit && !aimPick.includes(i)) rest.push(nodes[i]);
    if (rest.length >= 3) {
      x.save();
      x.strokeStyle = "#ffd27f";
      x.globalAlpha = 0.28;
      x.setLineDash([2, 5]);
      x.lineWidth = 1.5;
      x.beginPath();
      rest.forEach((n, i) => (i ? x.lineTo(n.x, n.y) : x.moveTo(n.x, n.y)));
      x.stroke();
      x.setLineDash([]);
      const rcx = rest.reduce((a, n) => a + n.x, 0) / rest.length,
        rcy = rest.reduce((a, n) => a + n.y, 0) / rest.length;
      x.globalAlpha = 0.8;
      x.fillStyle = "#ffd27f";
      x.font = "700 11px Galmuri11, ui-monospace";
      x.textAlign = "center";
      x.fillText("남은 ✦ " + rest.length + " → 별자리", rcx, rcy - 6);
      x.restore();
    }
  }
  // 셋째를 찍은 «성립» 플래시의 시계. 그리는 곳은 조준선(아래)이다.
  const fxDt = aimFxDelta();
  if (aimReadyFlash > 0) aimReadyFlash = Math.max(0, aimReadyFlash - fxDt);

  if (preview) {
    /* 무게중심 조준을 그린다. 유성에서 가운데점까지 «갈 길»을 직접 긋고,
       훑은 별빛들이 그 점으로 모이는 선을 얹는다.

       화살표를 그리던 때는 선이 별빛들 사이에서 시작해 유성과 떨어져 있었다.
       그래서 「어디로 쏘는지」를 머릿속에서 평행이동해야 했다 — 오너가
       「너무 힘들다」고 한 것이 이것이다. 유성에서 시작하는 선은 그 단계가
       없다. */
    /* 호버를 «다음 하나»로 가정하는 규칙은 aimStarPreview와 한 몸이어야
       한다. 저쪽은 하한(minPick)을 채우면 호버를 무시하는데 여기만 무조건
       붙이면, 확정된 3픽 조준선이 «가정» 점선으로 그려지고 안내선은 호버까지
       이어져 — 점선이 보여준 것과 다른 곳으로 쏘게 된다. */
    const previewPicks =
      aimPick.length >= AIM_STAR.minPick ||
      aimHover < 0 ||
      aimPick.includes(aimHover)
        ? aimPick
        : [...aimPick, aimHover];
    const p = previewPicks.map((i) => nodes[i]);
    if (p.length && p.every(Boolean)) {
      const cx = preview.cx,
        cy = preview.cy;
      /* 1e-2: 벌림 폴리곤 — «퍼짐이 위력»을 면으로. α는 0.1~0.2, force로
         청록→금. ※반투명 면적 신규: perfwatch(F9) 정산 p95를 커밋에 첨부. */
      if (p.length >= 3) {
        const spreadK = Math.max(0, Math.min(1, (preview.force - 0.28) / 0.72));
        x.save();
        x.globalAlpha = 0.1 + spreadK * 0.1;
        x.fillStyle = spreadK > 0.5 ? "#ffe09a" : "#47837c";
        x.beginPath();
        p.forEach((n, i) => (i ? x.lineTo(n.x, n.y) : x.moveTo(n.x, n.y)));
        x.closePath();
        x.fill();
        x.restore();
      }
      // 훑은 별빛 -> 가운데점. 어느 별빛이 이 조준을 만들었는지가 읽힌다.
      x.globalAlpha = 0.45;
      x.setLineDash([4, 4]);
      x.strokeStyle = "#ffe09a";
      x.lineWidth = 1.5;
      for (const s of p) {
        x.beginPath();
        x.moveTo(s.x, s.y);
        x.lineTo(cx, cy);
        x.stroke();
      }
      x.setLineDash([]);
      x.globalAlpha = 1;
      /* 유성 -> 갈 길. 무게중심 쪽과 그 반대편을 «둘 다» 그린다 — 고른
         쪽은 진하게, 안 고른 쪽은 흐리게. 빈 곳을 누르면 그쪽으로 바뀌므로,
         두 선이 곧 「누를 수 있는 두 곳」이다.
         뒤집혔으면 갈 길의 끝점은 가운데점이 아니라 그 반대쪽이다. */
      /* 갈 곳은 판 안으로 자른다. 뒤집으면 «유성 기준 무게중심의 거울»이
         판 밖으로 나가는 일이 흔하고(실제로 y=993이 나왔다), 그러면 화살촉과
         위력 라벨이 화면 밖에 그려져 아무것도 안 보인다. 방향은 그대로 두고
         길이만 벽에서 끊는다 — 유성도 어차피 거기서 튄다. */
      const sign = preview.flipped ? -1 : 1,
        rawX = (cx - ball.x) * sign,
        rawY = (cy - ball.y) * sign,
        rawLen = Math.hypot(rawX, rawY) || 1,
        m = 26,
        tX =
          rawX > 0
            ? (W - m - ball.x) / rawX
            : rawX < 0
              ? (m - ball.x) / rawX
              : Infinity,
        tY =
          rawY > 0
            ? (H - m - ball.y) / rawY
            : rawY < 0
              ? (m - ball.y) / rawY
              : Infinity,
        cut = Math.max(0.08, Math.min(1, tX, tY)),
        gx = ball.x + rawX * cut,
        gy = ball.y + rawY * cut,
        dx = gx - ball.x,
        dy = gy - ball.y,
        len = Math.hypot(dx, dy) || 1,
        ux = dx / len,
        uy = dy / len,
        // 마우스가 올라간 노드를 «다음 하나»로 가정해 그린 선인가. 가정은
        // 점선으로 갈라 「아직 찍은 게 아니다」를 말한다.
        assumed = p.length > aimPick.length,
        ready = p.length >= AIM_STAR.minPick,
        // 위력이 선의 굵기다 - 넓게 벌린 조준은 선부터 무겁다.
        lineW = ready ? 2 + preview.force * 2.5 : 2.5;
      if (assumed) {
        x.setLineDash([7, 5]);
        x.globalAlpha = 0.8;
      }
      // 안 고른 쪽을 먼저 흐리게. 「저기도 누를 수 있다」가 보여야 한다.
      if (ready) {
        x.save();
        x.globalAlpha = 0.22;
        x.setLineDash([6, 6]);
        x.strokeStyle = "#ffe09a";
        x.lineWidth = 2;
        x.beginPath();
        x.moveTo(ball.x, ball.y);
        // 반대쪽도 벽에서 끊는다. 같은 이유다.
        const oX = -rawX,
          oY = -rawY,
          oTX =
            oX > 0
              ? (W - m - ball.x) / oX
              : oX < 0
                ? (m - ball.x) / oX
                : Infinity,
          oTY =
            oY > 0
              ? (H - m - ball.y) / oY
              : oY < 0
                ? (m - ball.y) / oY
                : Infinity,
          oCut = Math.max(0.08, Math.min(1, oTX, oTY));
        const oEx = ball.x + oX * oCut,
          oEy = ball.y + oY * oCut;
        x.lineTo(oEx, oEy);
        x.stroke();
        x.restore();
        /* 1e-3: 반대편이 «누를 수 있는 곳»임을 처음에만 말한다.
           한 번 뒤집어 본 세션에서는 소등(aimTeach.flipped). */
        if (!aimTeach.flipped) {
          const blink = 0.5 + 0.5 * Math.sin(frameClock / 250);
          x.save();
          x.globalAlpha = 0.35 + blink * 0.45;
          x.fillStyle = "#ffe09a";
          x.font = "700 11px Galmuri11, ui-monospace";
          x.textAlign = "center";
          x.fillText(
            "↷ 빈 곳 클릭 = 반대편",
            Math.max(90, Math.min(W - 90, oEx + (ball.x - oEx) * 0.12)),
            Math.max(60, Math.min(H - 60, oEy + (ball.y - oEy) * 0.12)),
          );
          x.restore();
        }
      }
      x.strokeStyle = "#ffe09a";
      x.lineWidth = lineW;
      x.beginPath();
      x.moveTo(ball.x, ball.y);
      x.lineTo(gx, gy);
      x.stroke();
      x.setLineDash([]);
      x.globalAlpha = 1;
      // 셋째를 찍은 순간, 성립한 조준선이 한 박자 희게 빛난다.
      if (aimReadyFlash > 0) {
        x.globalAlpha = (aimReadyFlash / 0.4) * 0.75;
        x.strokeStyle = "#ffffff";
        x.lineWidth = lineW + 2;
        x.beginPath();
        x.moveTo(ball.x, ball.y);
        x.lineTo(gx, gy);
        x.stroke();
        x.globalAlpha = 1;
      }
      /* 화살촉과 위력은 «갈 곳»에 붙는다. 과녁 링은 무게중심에 남는다 —
         점선이 그리로 모이므로 그 링이 「내가 고른 것」이고, 화살촉이
         「내가 갈 곳」이다. 뒤집지 않았으면 둘이 같은 자리다. */
      const px = -uy,
        py = ux;
      x.fillStyle = "#ffe09a";
      x.beginPath();
      x.moveTo(gx + ux * 13, gy + uy * 13);
      x.lineTo(gx - ux * 6 + px * 9, gy - uy * 6 + py * 9);
      x.lineTo(gx - ux * 6 - px * 9, gy - uy * 6 - py * 9);
      x.closePath();
      x.fill();
      // 과녁 링도 위력을 입는다 - 큰 조준은 과녁부터 크다.
      stepRing(
        cx,
        cy,
        ready ? 8 + preview.force * 7 : 10,
        preview.flipped ? "#ffe09a55" : "#ffe09acc",
      );
      x.fillStyle = "#ffe09a";
      x.font = "700 12px Galmuri11, ui-monospace";
      x.textAlign = "center";
      // 하한 미달이면 위력 대신 몇 개 모자란지를 말한다 — 이 선은 아직
      // 쏠 수 있는 조준이 아니라 «되어가는 중»이다.
      x.fillText(
        p.length >= AIM_STAR.minPick
          ? (preview.flipped ? "반대편 · 위력 " : "위력 ") +
              Math.round(preview.force * 100) +
              "%"
          : "노드 " + p.length + "/" + AIM_STAR.minPick,
        gx,
        gy - 18,
      );
      /* 1e-2: 위력 게이지 — 숫자를 읽기 전에 길이로 읽힌다. 28% 하한 눈금. */
      if (ready) {
        x.fillStyle = "#04080a";
        x.fillRect(gx - 23, gy - 12, 46, 5);
        x.fillStyle = "#ffe09a";
        x.fillRect(gx - 23, gy - 12, 46 * preview.force, 5);
        x.fillStyle = "#8ba39f";
        x.fillRect(gx - 23 + 46 * 0.28, gy - 13, 1, 7);
      }
    }
  }

  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i],
      order = aimPick.indexOf(i),
      picked = order >= 0,
      hovered = i === aimHover;
    let chipY;
    if (node.unit) {
      /* 별지기 노드. 스프라이트가 이미 「여기 있다」를 만드니 표식은 고리만 —
         별빛과 같은 보석으로 그리면 판 위에서 같은 물건으로 읽힌다
         (위의 모양 규칙 그대로). */
      const g = node.unit,
        rr = g.r + 5 + (picked ? 0 : pulse * 3);
      stepRing(
        node.x,
        node.y,
        rr,
        picked ? "#ffffff" : node.col + (hovered ? "cc" : "55"),
        3,
        picked || hovered ? 3 : 2,
      );
      // 1e-4(결정 4): 별지기는 «궤도» 이중 고리 — 별빛과 같은 물건이 아니다.
      stepRing(node.x, node.y, rr + 6, node.col + "22", 3, 2);
      // 찍는 순간의 플래시: 흰 고리가 바깥으로 번지며 사라진다.
      if (g.aimFlash > 0) {
        g.aimFlash = Math.max(0, g.aimFlash - fxDt);
        const fk = g.aimFlash / 0.3;
        x.globalAlpha = fk;
        stepRing(node.x, node.y, g.r + 8 + (1 - fk) * 20, "#ffffff", 3, 3);
        x.globalAlpha = 1;
      }
      chipY = node.y - g.r - 20;
    } else {
      const star = node;
      if (star.born > 0) star.born = Math.max(0, star.born - fxDt);
      const grow = star.born > 0 ? 1 + star.born * 1.8 : 1,
        // 고르지 않은 것이 맥동한다. 이미 고른 것은 흔들리면 오히려 읽기
        // 어렵다.
        breathe = picked ? 1 : 1 + pulse * 0.22,
        r = (picked ? 11 : 9) * grow * breathe;
      // 바깥 무리 + 뾰족한 별. 어두워진 판 위에서 이것이 「여기 있다」를
      // 만든다.
      stepRing(star.x, star.y, r + 10 + pulse * 3, star.col + "33", 3, 2);
      pixelSparkle(star.x, star.y, r + 10, star.col + "aa", 2);
      pixelSparkle(star.x, star.y, r + 5, "#fff6e2", 3);
      pixelGem(star.x, star.y, Math.max(3, r - 3), [star.col, "#fff6e2"]);
      // 고르지 않은 것은 별자리가 될 후보다. 셋 이상 남아야 실제로 그려지므로
      // 그때만 금색 무리를 둘러 「이것들이 별자리가 된다」를 보여준다.
      if (!picked && restCount >= 3)
        stepRing(star.x, star.y, r + 8, "#ffd27f55", 3, 2);
      if (picked || hovered)
        stepRing(star.x, star.y, r + 6, picked ? "#ffffff" : "#ffffff88", 3, 3);
      // 찍는 순간의 플래시 - 별지기와 같은 언어.
      if (star.pickFlash > 0) {
        star.pickFlash = Math.max(0, star.pickFlash - fxDt);
        const fk = star.pickFlash / 0.3;
        x.globalAlpha = fk;
        stepRing(star.x, star.y, r + 8 + (1 - fk) * 18, "#ffffff", 3, 3);
        x.globalAlpha = 1;
      }
      chipY = star.y - r - 16;
    }
    if (!picked && hovered) {
      /* 1e-4: 호버 한 줄 — 두 종류가 «무엇이 다른지»를 말한다. */
      const label = node.unit
        ? "별지기 · 조준 전용"
        : "별빛 · 안 쓰면 별자리 재료";
      x.save();
      x.font = "700 11px Galmuri11, ui-monospace";
      const tw = x.measureText(label).width + 16,
        tx = Math.max(tw / 2 + 30, Math.min(W - tw / 2 - 30, node.x));
      x.fillStyle = "#04080ad9";
      x.fillRect(tx - tw / 2, chipY - 32, tw, 20);
      x.fillStyle = node.unit ? "#7cc6bb" : "#ffe09a";
      x.textAlign = "center";
      x.fillText(label, tx, chipY - 18);
      x.restore();
    }
    if (picked) {
      // 번호는 노드 «위»에 칩으로 띄운다. 안에 넣으면 모양에 묻힌다.
      const bx = node.x;
      x.fillStyle = "#ffe09a";
      x.fillRect(bx - 9, chipY - 9, 18, 18);
      x.fillStyle = "#0f0a1e";
      x.font = "700 13px Galmuri11, ui-monospace";
      x.textAlign = "center";
      x.textBaseline = "middle";
      x.fillText(String(order + 1), bx, chipY + 1);
      x.textBaseline = "alphabetic";
    }
  }

  /* 하한을 넘겨 쏠 수 있는 상태면 유성이 그것을 말한다 - 금빛 고리가
     맥동하며 「Space를 기다린다」. 발사 가능 여부를 HUD 글씨까지 내려가
     읽게 하지 않는다. */
  if (aimPick.length >= AIM_STAR.minPick && ball)
    stepRing(ball.x, ball.y, ball.r + 7 + pulse * 3, "#ffe09a88", 3, 2);
  /* 1e-1: 픽 슬롯 3칸 — «왜 셋»을 문자 없이. 빈 칸이 맥동하고 찍을수록
     찬다. 초과분은 +n. */
  if (ball) {
    for (let i = 0; i < AIM_STAR.minPick; i++) {
      const sx = ball.x - 30 + i * 30,
        sy = ball.y + 36,
        filled = i < aimPick.length;
      x.save();
      x.translate(sx, sy);
      x.rotate(Math.PI / 4);
      if (filled) {
        x.fillStyle = "#ffe09a";
        x.fillRect(-6, -6, 12, 12);
      } else {
        x.globalAlpha = 0.4 + 0.4 * Math.sin(frameClock / 260 + i);
        x.strokeStyle = "#ffe09a";
        x.lineWidth = 2;
        x.strokeRect(-6, -6, 12, 12);
      }
      x.restore();
    }
    if (aimPick.length > AIM_STAR.minPick) {
      x.fillStyle = "#ffe09a";
      x.font = "700 11px Galmuri11, ui-monospace";
      x.textAlign = "left";
      x.fillText(
        "+" + (aimPick.length - AIM_STAR.minPick),
        ball.x + 46,
        ball.y + 41,
      );
    }
  }
  /* 1e-4(결정 4): 범례 — 첫 3샷 동안만(aimTeach.shots). */
  if (aimTeach.shots < 3) {
    x.save();
    x.globalAlpha = 0.94;
    x.fillStyle = "#04080ac9";
    x.fillRect(34, 66, 216, 46);
    x.strokeStyle = "#24363a";
    x.lineWidth = 2;
    x.strokeRect(34, 66, 216, 46);
    stepRing(52, 80, 7, "#7cc6bb", 3, 2);
    x.fillStyle = "#cfdad7";
    x.font = "11px Galmuri11, ui-monospace";
    x.textAlign = "left";
    x.fillText("별지기 — 조준 노드 (별자리 안 탐)", 68, 84);
    pixelSparkle(52, 100, 7, "#ffe09acc", 2);
    x.fillStyle = "#cfdad7";
    x.fillText("별빛 — 조준 + 남기면 별자리", 68, 104);
    x.restore();
  }

  /* 조작 안내. 튜토리얼이 아직 이 전투를 안 가르치므로(전투 확정 뒤에 다시
     짠다) 화면이 스스로 말해야 한다. */
  x.globalAlpha = 0.92;
  x.fillStyle = "#0b0718cc";
  x.fillRect(0, H - 46, W, 46);
  /* 하한 미달 Space의 거절: 카운트 줄이 잠깐 붉어지며 가로로 떨린다.
     토스트는 위에 뜨는데 시선은 아래 카운트에 있어, 거절의 이유가 바로
     그 줄에서 읽혀야 한다. */
  if (aimDenyT > 0) aimDenyT = Math.max(0, aimDenyT - fxDt);
  const denyK = aimDenyT / 0.5,
    denyShake = denyK > 0 ? Math.sin(frameClock / 16) * 3.5 * denyK : 0;
  x.fillStyle = denyK > 0.05 ? "#ff9d9d" : "#ffe09a";
  x.font = "700 13px Galmuri11, ui-monospace";
  x.textAlign = "center";
  x.fillText(
    "고른 노드 " +
      aimPick.length +
      "/" +
      AIM_STAR.minPick +
      "   ·   남은 별빛 " +
      restCount +
      "개가 별자리" +
      (restCount >= 3 ? "" : " (셋부터)") +
      "   ·   Space 발사",
    W / 2 + denyShake,
    H - 26,
  );
  x.fillStyle = "#cfc4e8";
  x.font = "600 11px Galmuri11, ui-monospace";
  x.fillText(
    aimPick.length
      ? "고른 노드들의 가운데로 갑니다 · 우클릭으로 무르기"
      : "별지기·별빛을 셋 이상 찍으세요 · 넓게 벌릴수록 세게 나갑니다",
    W / 2,
    H - 10,
  );
  x.restore();
}
/* 발사 순간의 수렴. 고른 노드들에서 무게중심으로 빛이 «걷혀 들어가는»
   한 박자(0.42초)다 — 안내선이 조준 화면과 함께 뚝 꺼지면 발사가 조준과
   무관한 사건처럼 읽힌다. 조준 화면(drawAimStars)은 유성이 구르면
   돌지 않으므로 따로 그린다. */
function drawAimLaunchFx() {
  if (!aimLaunchFx || !run) {
    if (aimLaunchFx && !run) aimLaunchFx = null;
    return;
  }
  const fx = aimLaunchFx;
  fx.t -= aimFxDelta();
  if (fx.t <= 0) {
    // 다 모이면 무게중심에서 마지막 불꽃이 한 번 터진다.
    fieldFx.push({
      type: "spark",
      x: fx.cx,
      y: fx.cy,
      t: 0,
      d: 0.32,
      col: "#ffe09a",
    });
    aimLaunchFx = null;
    return;
  }
  const k = fx.t / fx.dur; // 1 → 0
  x.save();
  x.strokeStyle = "#ffe09a";
  x.lineWidth = 2;
  for (const p of fx.points) {
    // 노드 쪽 끝이 무게중심으로 끌려 들어간다 - 남은 구간만 긋는다.
    const sx = p.x + (fx.cx - p.x) * (1 - k),
      sy = p.y + (fx.cy - p.y) * (1 - k);
    x.globalAlpha = k * 0.8;
    x.beginPath();
    x.moveTo(sx, sy);
    x.lineTo(fx.cx, fx.cy);
    x.stroke();
    pixelSparkle(sx, sy, 5 + k * 5, (p.col || "#ffe09a") + "cc", 2);
  }
  // 무게중심 링은 조여든다 - 「여기로 모였다」.
  x.globalAlpha = k * 0.9;
  stepRing(fx.cx, fx.cy, 7 + k * 24, "#ffe09a", 3, 2);
  x.globalAlpha = 1;
  x.restore();
}
registerRuntimeHook("afterDraw", drawAimStars);
registerRuntimeHook("afterDraw", drawAimLaunchFx);
registerRuntimeHook("afterDraw", drawCloneBalls);

const CombatModule = StellaRuntime.modules.register("combat", {
  resolveParryContact(gate, contact) {
    return resolveMeteorParryContact(gate, contact);
  },
});
