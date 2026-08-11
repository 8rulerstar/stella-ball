function updateRelay(d) {
  const r = ball.relay;
  if (!r) return;
  r.t += d / 0.28;
  const t = Math.min(1, r.t),
    ease = t * t * (3 - 2 * t);
  ball.x = r.from.x + (r.target.x - r.from.x) * ease;
  ball.y = r.from.y + (r.target.y - r.from.y) * ease;
  ball.trail.push({ x: ball.x, y: ball.y });
  if (ball.trail.length > 20) ball.trail.shift();
  if (t >= 1) {
    const a = Math.atan2(r.target.y - r.from.y, r.target.x - r.from.x);
    ball.x = r.target.x + Math.cos(a) * (r.target.r + ball.r + 2);
    ball.y = r.target.y + Math.sin(a) * (r.target.r + ball.r + 2);
    ball.vx = Math.cos(a) * 620;
    ball.vy = Math.sin(a) * 620;
    ball.relay = null;
    hitGate(r.target);
  }
}
function beginOrbit() {
  const anchor = { x: ball.x, y: ball.y },
    source = ball.orbitGate?.s || "세라";
  ball.orbit = { anchor, angle: 0, radius: 68, t: 0, source };
  ball.orbitUsed = true;
  ball.orbitReady = false;
  ball.moving = true;
  ball.trail = [];
  msg =
    source +
    " · 플리퍼 충격을 원심 회전으로 바꿨습니다. 원하는 탭에 발사하세요.";
  toast("원심 전환 · 탭 발사");
  sync();
}
function releaseOrbit() {
  const o = ball?.orbit;
  if (!o) return;
  const charge = Math.min(1, o.t / 1.2),
    speed = 690 + charge * 420;
  ball.vx = -Math.sin(o.angle) * speed;
  ball.vy = Math.cos(o.angle) * speed;
  ball.orbit = null;
  ball.runeBurst = 0.82;
  areaAttack("세라 원심 베기", 15 + Math.round(charge * 13), "#ffe39c");
  msg =
    "세라 · 원심력 " + Math.round(charge * 100) + "%를 실어 유성을 발사합니다.";
  toast("원심 베기 · 전 적 피해");
  sync();
}
function updateOrbit(d) {
  const o = ball.orbit;
  if (!o) return;
  o.t += d;
  o.angle += d * (7.4 + Math.min(3, o.radius / 65));
  o.radius += (68 - o.radius) * Math.min(1, d * 5.5);
  ball.x = o.anchor.x + Math.cos(o.angle) * o.radius;
  ball.y = o.anchor.y + Math.sin(o.angle) * o.radius;
  ball.trail.push({ x: ball.x, y: ball.y });
  if (ball.trail.length > 20) ball.trail.shift();
  if (o.t >= 1.7) releaseOrbit();
}
function triggerZone(zone) {
  const g = gates.find((v) => v.zone === zone);
  if (g) hitGate(g);
}
function hitGate(g) {
  if (g.on > 0.25) return;
  g.on = 1;
  g.animState = "attack";
  chain.push(g.s);
  const speed = Math.hypot(ball.vx, ball.vy);
  if (speed > 0) {
    const boosted = Math.min(980, speed + 120);
    ball.vx *= boosted / speed;
    ball.vy *= boosted / speed;
  }
  ball.runeBurst = 0.42;
  triggerAssist(g);
  if (g.fx === "guard") {
    ball.power = Math.max(ball.power, 1.45);
    ball.vx *= 1.16;
    ball.vy *= 1.16;
    msg = "가온 · 강반사와 운동량이 크게 유지됩니다.";
  }
  if (g.fx === "edge") {
    ball.mark = true;
    msg = "비연 · 다음 약점 명중에 표식이 적용됩니다.";
  }
  if (g.fx === "pulse") {
    ball.power += 0.8;
    ball.pulse = 3.1;
    msg = "루미 · 강한 유도로 약점 쪽에 궤적을 감아 넣습니다.";
  }
  if (g.fx === "relay") {
    const i = gates.indexOf(g),
      target = gates[(i + 1) % gates.length];
    if (target !== g && target.on <= 0.25) {
      ball.relay = { from: { x: g.x, y: g.y }, target, t: 0 };
      ball.vx = ball.vy = 0;
      msg = "하루 · 다음 별지기에게 유성을 전달합니다.";
      toast("릴레이 연결");
    } else {
      ball.vx *= 1.36;
      ball.vy *= 1.36;
      msg = "하루 · 다음 별지기가 닫혀 강한 가속으로 전환합니다.";
    }
  }
  if (g.fx === "orbit") {
    ball.orbitGate = g;
    ball.orbitReady = true;
    msg = "세라 · 다음 하단 플리퍼 충격이 원심 회전으로 전환됩니다.";
    toast("원심 플리퍼 준비");
  }
  if (g.fx === "mine") {
    ball.mine = true;
    msg = "태오 · 다음 벽 반사에 충격이 쌓입니다.";
  }
  if (g.fx === "lockon") {
    ball.lockCount = (ball.lockCount || 0) + 1;
    if (ball.lockCount >= 3) {
      ball.homing = true;
      ball.pulse = 0;
      msg = "닉스 · 세 번째 성위가 완성됐습니다. 약점 유도탄 전환!";
      toast("성위 고정 · 100% 유도");
    } else {
      msg =
        "닉스 · 성위 " +
        ball.lockCount +
        "/3. 세 번째 충돌에 약점을 고정합니다.";
      toast("성위 " + ball.lockCount + "/3");
    }
  }
  if (g.fx === "turn") {
    if (!ball.turnUsed) {
      ball.turnReady = true;
      msg = "리오 · 다음 하단 플리퍼 충격이 우상단 급선회 발사가 됩니다.";
      toast("우회전 플리퍼 준비");
    } else {
      msg = "리오 · 이번 유성의 우회전 플리퍼는 이미 사용했습니다.";
    }
  }
  if (g.fx === "mirror") {
    assistShots.push({
      x: g.x,
      y: g.y,
      fromX: g.x,
      fromY: g.y,
      t: 0,
      dur: 0.36,
      amount: 12,
      name: "미라 분신",
      col: g.col,
    });
    fieldFx.push({ type: "mirror", x: g.x, y: g.y, t: 0, d: 1, col: g.col });
    toast("거울 분신 · 지원 투사체 복제");
  }
  if (g.fx === "gravity") {
    ball.gravity = { x: g.x, y: g.y, t: 2.7 };
    fieldFx.push({ type: "gravity", x: g.x, y: g.y, t: 0, d: 2.7, col: g.col });
    toast("중력 고리 · 궤적 왜곡");
  }
  if (g.fx === "chainbolt") {
    areaAttack("케인 번개 사슬", 11, g.col);
    fieldFx.push({ type: "bolt", x: g.x, y: g.y, t: 0, d: 0.45, col: g.col });
  }
  if (g.fx === "barrier") {
    barriers.push({ x: g.x + 42, y: g.y - 18, r: 26, t: 3, col: g.col });
    fieldFx.push({
      type: "barrier",
      x: g.x + 42,
      y: g.y - 18,
      t: 0,
      d: 3,
      col: g.col,
    });
    toast("수정 벽 생성 · 한 번 더 반사");
  }
  if (g.fx === "firework") {
    ball.firework = true;
    ball.fireworkBounce = ball.bounces;
    fieldFx.push({
      type: "firework",
      x: g.x,
      y: g.y,
      t: 0,
      d: 1.4,
      col: g.col,
    });
    toast("벽 폭죽 장전");
  }
  if (g.fx === "time") {
    battle.slow = Math.max(battle.slow, 1.7);
    fieldFx.push({
      type: "time",
      x: boss.x,
      y: boss.y,
      t: 0,
      d: 1.7,
      col: g.col,
    });
    toast("시간 균열 · 약점 감속");
  }
  if (g.fx === "needle") {
    ball.needle = true;
    fieldFx.push({ type: "needle", x: g.x, y: g.y, t: 0, d: 0.5, col: g.col });
    toast("드레인 포격 예약");
  }
  if (g.fx === "blink") {
    ball.blink = true;
    fieldFx.push({ type: "blink", x: g.x, y: g.y, t: 0, d: 0.65, col: g.col });
    toast("균열 도약 준비");
  }
  if (g.fx === "echo") {
    const echoBattleId = battle?.id;
    setTimeout(() => {
      if (run && battle?.id === echoBattleId && boss?.hp > 0)
        assistShots.push({
          x: g.x,
          y: g.y,
          fromX: g.x,
          fromY: g.y,
          t: 0,
          dur: 0.28,
          amount: 12,
          name: "에코 반향",
          col: g.col,
        });
    }, 360);
    fieldFx.push({ type: "echo", x: g.x, y: g.y, t: 0, d: 0.8, col: g.col });
    toast("공명 잔상 · 한 번 더 울림");
  }
  if (g.fx === "frost") {
    for (const a of adds) a.frozen = Math.max(a.frozen || 0, 1.4);
    fieldFx.push({ type: "frost", x: g.x, y: g.y, t: 0, d: 1, col: g.col });
    toast("빙결 파편 · 잔재 정지");
  }
  if (g.fx === "magnet") {
    ball.magnet = { x: g.x, y: g.y, t: 2.2 };
    fieldFx.push({ type: "magnet", x: g.x, y: g.y, t: 0, d: 2.2, col: g.col });
    toast("자력 파편 · 공 끌어당김");
  }
  if (g.fx === "butterfly") {
    ball.butterfly = 1;
    fieldFx.push({
      type: "butterfly",
      x: g.x,
      y: g.y,
      t: 0,
      d: 1.2,
      col: g.col,
    });
    toast("나비칼 귀환 · 약점 급선회");
  }
  if (g.fx === "sun") {
    ball.sun = (ball.sun || 0) + 1;
    fieldFx.push({ type: "sun", x: g.x, y: g.y, t: 0, d: 0.8, col: g.col });
    if (ball.sun >= 3) {
      ball.sun = 0;
      areaAttack("이오 태양 낙하", 27, g.col);
    }
  }
  if (g.fx === "blood") {
    const shot = assistShots[assistShots.length - 1];
    if (shot) shot.amount += Math.min(20, Math.round(speed / 55));
    fieldFx.push({ type: "blood", x: g.x, y: g.y, t: 0, d: 0.6, col: g.col });
    toast("혈월 베기 · 속도 비례 강화");
  }
  if (g.fx === "seed") {
    seeds.push({ x: g.x, y: g.y, t: 4, r: 28, col: g.col });
    fieldFx.push({ type: "seed", x: g.x, y: g.y, t: 0, d: 4, col: g.col });
    toast("덩굴 씨앗 심기");
  }
  if (g.fx === "vortex") {
    ball.vortex = true;
    fieldFx.push({ type: "vortex", x: g.x, y: g.y, t: 0, d: 1.1, col: g.col });
    toast("공허 도둑 · 처치 포털 준비");
  }
  if (g.fx === "rhythm") {
    if (hitCombo >= 3) areaAttack("피아 리포스트 포격", 22, g.col);
    else toast("리듬 포병 · RIPOSTE 때 포격");
  }
  if (g.fx === "flame") {
    ball.flame = 2.5;
    fieldFx.push({ type: "flame", x: g.x, y: g.y, t: 0, d: 1.2, col: g.col });
    toast("궤적 화염 점화");
  }
  if (g.fx === "moon") {
    ball.moon = true;
    fieldFx.push({ type: "moon", x: g.x, y: g.y, t: 0, d: 1.2, col: g.col });
    toast("달의 항로 · 좌회전 플리퍼 준비");
  }
  if (g.fx === "constel") {
    battle.constel = Math.max(battle.constel, 2.8);
    fieldFx.push({ type: "constel", x: g.x, y: g.y, t: 0, d: 2.8, col: g.col });
    toast("별자리 선 활성화");
  }
  sync();
}
function pointLineDistance(px, py, a, b) {
  const dx = b.x - a.x,
    dy = b.y - a.y,
    t = clamp(
      ((px - a.x) * dx + (py - a.y) * dy) / (dx * dx + dy * dy || 1),
      0,
      1,
    );
  return Math.hypot(px - (a.x + dx * t), py - (a.y + dy * t));
}
function flipperPose(side) {
  const left = side < 0,
    key = left ? "left" : "right",
    pivotX = left ? 18 : W - 18,
    pivotY = H - 146,
    raised = flippers[key] || 0;
  const rest = left ? 0.34 : Math.PI - 0.34,
    angle = rest + (left ? -0.65 : 0.65) * raised,
    length = 345;
  // Rising surface velocity is what launches the ball. Return motion has no
  // artificial kick, which prevents a held flipper from repeatedly boosting.
  // Visual travel is snappy; cap the kinematic surface speed so a tip hit is
  // powerful but cannot turn into a table-length teleport.
  const strike = flippers[key + "Strike"] || 0,
    omega = strike > 0 ? (left ? -2.8 : 2.8) : 0;
  return {
    left,
    key,
    pivotX,
    pivotY,
    raised,
    angle,
    length,
    omega,
    tipX: pivotX + Math.cos(angle) * length,
    tipY: pivotY + Math.sin(angle) * length,
  };
}
function resolveSegment(
  a,
  b,
  radius,
  rest,
  friction = 0,
  surfaceAt = () => ({ x: 0, y: 0 }),
  onHit,
) {
  const dx = b.x - a.x,
    dy = b.y - a.y,
    den = dx * dx + dy * dy || 1,
    t = clamp(((ball.x - a.x) * dx + (ball.y - a.y) * dy) / den, 0, 1),
    px = a.x + dx * t,
    py = a.y + dy * t;
  let nx = ball.x - px,
    ny = ball.y - py,
    dist = Math.hypot(nx, ny),
    reach = ball.r + radius;
  if (dist >= reach) return false;
  if (dist < 0.001) {
    const len = Math.hypot(dx, dy) || 1;
    nx = -dy / len;
    ny = dx / len;
    dist = 1;
  } else {
    nx /= dist;
    ny /= dist;
  }
  ball.x += nx * (reach - dist + 0.18);
  ball.y += ny * (reach - dist + 0.18);
  const surface = surfaceAt(px, py),
    rvx = ball.vx - surface.x,
    rvy = ball.vy - surface.y,
    vn = rvx * nx + rvy * ny;
  if (vn < 0) {
    let outX = rvx - (1 + rest) * vn * nx,
      outY = rvy - (1 + rest) * vn * ny;
    const tx = -ny,
      ty = nx,
      vt = outX * tx + outY * ty;
    outX -= vt * friction * tx;
    outY -= vt * friction * ty;
    ball.vx = outX + surface.x;
    ball.vy = outY + surface.y;
    onHit?.(t, px, py);
  }
  return true;
}
function bounceOffFlipper(side) {
  if (!ball?.moving) return false;
  const f = flipperPose(side),
    a = { x: f.pivotX, y: f.pivotY },
    b = { x: f.tipX, y: f.tipY };
  // A resting flipper is a ramp, not a bumper: cancel only the inward normal
  // velocity so gravity can carry the ball down its slope.  The short rising
  // window is the sole source of a launch impulse.
  const active = f.omega !== 0,
    rest = active ? PHYSICS.flipperRestitution : 0;
  return resolveSegment(
    a,
    b,
    PHYSICS.flipperRadius,
    rest,
    PHYSICS.flipperFriction,
    (px, py) => {
      const rx = px - f.pivotX,
        ry = py - f.pivotY;
      return { x: -f.omega * ry, y: f.omega * rx };
    },
    (t, px, py) => {
      ball.flipperContact = 0.07;
      ball.runeBurst = 0.42;
      if (active) {
        ball.bounces++;
        triggerZone("flip");
        if (ball.turnForce) {
          ball.vx = Math.abs(ball.vx) * 0.92;
          ball.vy = -Math.abs(ball.vy) * 1.08;
          ball.turnForce = 0;
        }
        if (ball.moonForce) {
          ball.vx = -Math.abs(ball.vx) * 0.92;
          ball.vy = -Math.abs(ball.vy) * 1.08;
          ball.moonForce = 0;
        }
        fieldFx.push({
          type: "flipper",
          x: px,
          y: py,
          t: 0,
          d: 0.3,
          col: "#f2cb79",
        });
        impact(false);
        toast((t > 0.78 ? "끝 타격 · " : "") + "플리퍼 충격");
      }
    },
  );
}
function resolveCircle(target, radius, restitution, onHit) {
  const dx = ball.x - target.x,
    dy = ball.y - target.y;
  let dist = Math.hypot(dx, dy),
    nx = dx / (dist || 1),
    ny = dy / (dist || 1),
    reach = ball.r + radius;
  if (dist >= reach) return false;
  if (dist < 0.001) {
    nx = 0;
    ny = -1;
    dist = 1;
  }
  ball.x = target.x + nx * (reach + 0.18);
  ball.y = target.y + ny * (reach + 0.18);
  const normalSpeed = ball.vx * nx + ball.vy * ny;
  if (normalSpeed < 0) {
    ball.vx -= (1 + restitution) * normalSpeed * nx;
    ball.vy -= (1 + restitution) * normalSpeed * ny;
    onHit?.();
  }
  return true;
}
function tableWall() {
  ball.bounces++;
  if (ball.mine) {
    ball.vx *= 1.55;
    ball.vy *= 1.55;
    ball.mine = false;
    ball.runeBurst = 0.6;
    toast("충격 반사!");
  }
}
function simulatePhysics(d) {
  const slices = Math.min(
      PHYSICS.maxSlices,
      Math.max(1, Math.ceil(d / PHYSICS.step)),
    ),
    step = d / slices;
  for (let i = 0; i < slices && ball?.moving; i++) {
    updateExpanded(step);
    if (ball.pulse > 0) {
      ball.pulse -= step;
      const wx = boss.x + Math.cos(boss.a) * 84,
        wy = boss.y + Math.sin(boss.a) * 84,
        dx = wx - ball.x,
        dy = wy - ball.y,
        l = Math.hypot(dx, dy) || 1;
      ball.vx += (dx / l) * 190 * step;
    }
    ball.vy += PHYSICS.gravity * step;
    ball.x += ball.vx * step;
    ball.y += ball.vy * step;
    const drag = Math.pow(0.9984, step * 60);
    ball.vx *= drag;
    ball.vy *= drag;
    if (ball.x < ball.r) {
      ball.x = ball.r;
      ball.vx = Math.abs(ball.vx) * PHYSICS.wallRestitution;
      tableWall();
    } else if (ball.x > W - ball.r) {
      ball.x = W - ball.r;
      ball.vx = -Math.abs(ball.vx) * PHYSICS.wallRestitution;
      tableWall();
    }
    if (ball.y < ball.r) {
      ball.y = ball.r;
      ball.vy = Math.abs(ball.vy) * PHYSICS.wallRestitution;
      tableWall();
    }
    if (ball.y > H + ball.r) {
      endShot();
      break;
    }
    bounceOffFlipper(-1);
    bounceOffFlipper(1);
    for (const b of bumpers)
      resolveCircle(b, b.r, PHYSICS.bumperRestitution, () => {
        ball.bounces++;
        hitBumper(b);
      });
    for (const a of adds) {
      if (a.down > 0) continue;
      resolveCircle(a, a.r, 0.86, () => {
        if (a.hitCooldown <= 0) {
          a.hitCooldown = 0.2;
          damageAdd(a, 11 + Math.round(ball.power * 5), "직격", "#d8c3ff");
          ball.runeBurst = 0.46;
        }
      });
    }
    const wx = boss.x + Math.cos(boss.a) * 84,
      wy = boss.y + Math.sin(boss.a) * 84;
    const weak = resolveCircle({ x: wx, y: wy }, 21, 1.03, () => {
      if (boss.hitCooldown <= 0) {
        boss.hitCooldown = 0.25;
        damage(true);
      }
    });
    if (!weak)
      resolveCircle(boss, 58, 0.78, () => {
        if (boss.hitCooldown <= 0) {
          boss.hitCooldown = 0.25;
          damage(false);
        }
      });
    ball.flipperCooldown = Math.max(0, (ball.flipperCooldown || 0) - step);
    ball.flipperContact = Math.max(0, (ball.flipperContact || 0) - step);
    ball.wallShock = Math.max(0, (ball.wallShock || 0) - step);
    ball.trail.push({ x: ball.x, y: ball.y });
    if (ball.trail.length > 20) ball.trail.shift();
  }
  if (ball?.moving && Math.hypot(ball.vx, ball.vy) < 24) endShot();
}
function hitBumper(b) {
  if (b.on > 0 || battleComplete) return;
  b.on = 0.16;
  const speed = Math.hypot(ball.vx, ball.vy) || 1,
    boosted = Math.min(1180, speed + 108);
  ball.vx *= boosted / speed;
  ball.vy *= boosted / speed;
  ball.power += 0.14;
  ball.runeBurst = 0.5;
  const amount = 4 + Math.min(5, Math.floor(ball.bounces / 3));
  boss.hp = Math.max(0, boss.hp - amount);
  registerBossHit(false);
  impact(false);
  addPopup(b.x, b.y - 26, "룬 범퍼 -" + amount, "#80e8df", false);
  fieldFx.push({
    type: "bumper",
    x: b.x,
    y: b.y,
    t: 0,
    d: 0.36,
    col: "#80e8df",
  });
  triggerZone("bumper");
  if (boss.hp <= 0) scheduleWin();
  sync();
}
function updateExpanded(d) {
  if (fieldFx.length > 12) fieldFx.splice(0, fieldFx.length - 12);
  for (const f of fieldFx) f.t += d;
  fieldFx = fieldFx.filter((f) => f.t < f.d);
  barriers = barriers.filter((v) => (v.t -= d) > 0);
  seeds = seeds.filter((v) => (v.t -= d) > 0);
  if (!ball?.moving) return;
  if (ball.gravity) {
    ball.gravity.t -= d;
    const dx = ball.gravity.x - ball.x,
      dy = ball.gravity.y - ball.y,
      l = Math.hypot(dx, dy) || 1;
    ball.vx += (dx / l) * 245 * d;
    ball.vy += (dy / l) * 245 * d;
    if (ball.gravity.t <= 0) ball.gravity = null;
  }
  if (ball.magnet) {
    ball.magnet.t -= d;
    const dx = ball.magnet.x - ball.x,
      dy = ball.magnet.y - ball.y,
      l = Math.hypot(dx, dy) || 1;
    ball.vx += (dx / l) * 175 * d;
    ball.vy += (dy / l) * 175 * d;
    if (ball.magnet.t <= 0) ball.magnet = null;
  }
  if (ball.butterfly) {
    const wx = boss.x + Math.cos(boss.a) * 84,
      wy = boss.y + Math.sin(boss.a) * 84,
      dx = wx - ball.x,
      dy = wy - ball.y,
      l = Math.hypot(dx, dy) || 1;
    ball.vx += (dx / l) * 310 * d;
    ball.vy += (dy / l) * 310 * d;
    ball.butterfly -= d;
    if (ball.butterfly <= 0) ball.butterfly = 0;
  }
  if (ball.flame) {
    ball.flame -= d;
    ball.flameTick = (ball.flameTick || 0) - d;
    if (ball.flameTick <= 0) {
      ball.flameTick = 0.16;
      fieldFx.push({
        type: "flame",
        x: ball.x,
        y: ball.y,
        t: 0,
        d: 0.65,
        col: "#ff7d55",
      });
    }
  }
  for (const wall of barriers) {
    if (Math.hypot(ball.x - wall.x, ball.y - wall.y) < ball.r + wall.r) {
      const dx = ball.x - wall.x,
        dy = ball.y - wall.y,
        l = Math.hypot(dx, dy) || 1,
        nx = dx / l,
        ny = dy / l,
        dot = ball.vx * nx + ball.vy * ny;
      if (dot < 0) {
        ball.vx -= 2 * dot * nx;
        ball.vy -= 2 * dot * ny;
        wall.t = 0;
        areaBursts.push({
          x: wall.x,
          y: wall.y,
          r: 55,
          col: wall.col,
          t: 0,
          d: 0.35,
        });
        toast("벨라 수정 벽 반사!");
      }
    }
  }
  for (const seed of seeds) {
    if (Math.hypot(ball.x - seed.x, ball.y - seed.y) < ball.r + seed.r) {
      seed.t = 0;
      areaAttack("유나 덩굴 폭발", 16, seed.col);
    }
  }
  if (battle.constel > 0) {
    battle.constel -= d;
    for (let i = 0; i < gates.length; i++) {
      const a = gates[i],
        b = gates[(i + 1) % gates.length];
      if (
        pointLineDistance(ball.x, ball.y, a, b) < ball.r + 3 &&
        !ball.constelHit
      ) {
        ball.constelHit = 0.4;
        areaAttack("아틀라스 별자리 낙하", 20, "#e6b4ff");
      }
    }
    ball.constelHit = Math.max(0, (ball.constelHit || 0) - d);
  }
}
function update(d) {
  if (toastTimer > 0) {
    toastTimer -= d;
    if (toastTimer <= 0) U.toast.classList.remove("show");
  }
  flippers.left = Math.max(0, flippers.left - d * 7.5);
  flippers.right = Math.max(0, flippers.right - d * 7.5);
  for (const p of popups) p.t += d;
  popups = popups.filter((p) => p.t < 0.9);
  for (const a of adds) {
    a.hitCooldown = Math.max(0, a.hitCooldown - d);
    a.frozen = Math.max(0, (a.frozen || 0) - d);
    if (a.down > 0) {
      a.down -= d;
      if (a.down <= 0) {
        a.down = 0;
        a.hp = a.maxHp;
        toast("공허 잔재 재생성");
      }
    }
  }
  if (!run) return;
  battle.slow = Math.max(0, (battle.slow || 0) - d);
  boss.a += d * 0.62 * (battle.slow > 0 ? 0.24 : 1);
  boss.hitCooldown = Math.max(0, boss.hitCooldown - d);
  for (const g of gates) g.on = Math.max(0, g.on - d);
  for (const b of bumpers) b.on = Math.max(0, b.on - d);
  if (!ball.moving) return;
  if (ball.relay) {
    updateRelay(d);
    return;
  }
  if (ball.orbit) {
    updateOrbit(d);
    return;
  }
  updateExpanded(d);
  if (ball.pulse > 0) {
    ball.pulse -= d;
    const wx = boss.x + Math.cos(boss.a) * 84,
      wy = boss.y + Math.sin(boss.a) * 84,
      dx = wx - ball.x,
      dy = wy - ball.y,
      l = Math.hypot(dx, dy) || 1;
    ball.vx += (dx / l) * 190 * d;
  }
  ball.vy += 720 * d;
  ball.x += ball.vx * d;
  ball.y += ball.vy * d;
  ball.vx *= Math.pow(0.997, d * 60);
  ball.vy *= Math.pow(0.997, d * 60);
  ball.flipperCooldown = Math.max(0, (ball.flipperCooldown || 0) - d);
  ball.flipperContact = Math.max(0, (ball.flipperContact || 0) - d);
  ball.trail.push({ x: ball.x, y: ball.y });
  if (ball.trail.length > 20) ball.trail.shift();
  const wall = () => {
    ball.bounces++;
    if (deployed.includes("taeo") && !(ball.wallShock > 0)) {
      ball.wallShock = 0.18;
      areaAttack("태오 충격파", 10 + Math.min(12, ball.bounces * 2), "#ffb26b");
      ball.runeBurst = 0.75;
      msg = "태오 · 벽 반사가 전 적에게 충격파를 보냅니다.";
    }
    if (ball.mine) {
      ball.vx *= 1.72;
      ball.vy *= 1.72;
      ball.mine = false;
      ball.runeBurst = 0.6;
      msg = "태오의 충격 룬이 벽 반사에 폭발했습니다.";
      toast("충격 반사!");
    }
  };
  if (ball.x < ball.r || ball.x > W - ball.r) {
    ball.x = clamp(ball.x, ball.r, W - ball.r);
    ball.vx *= -1.02 + Math.min(0.12, ball.power * 0.03);
    wall();
  }
  if (ball.y < ball.r) {
    ball.y = ball.r;
    ball.vy = Math.abs(ball.vy) * 1.04;
    wall();
  }
  if (ball.y > H + ball.r) {
    endShot();
    return;
  }
  bounceOffFlipper(-1);
  bounceOffFlipper(1);
  ball.wallShock = Math.max(0, (ball.wallShock || 0) - d);
  for (const b of bumpers) {
    const dx = ball.x - b.x,
      dy = ball.y - b.y,
      l = Math.hypot(dx, dy);
    if (l < ball.r + b.r) {
      const nx = dx / (l || 1),
        ny = dy / (l || 1),
        dot = ball.vx * nx + ball.vy * ny;
      if (dot < 0) {
        ball.vx -= 2 * dot * nx;
        ball.vy -= 2 * dot * ny;
        ball.x = b.x + nx * (ball.r + b.r + 1);
        ball.y = b.y + ny * (ball.r + b.r + 1);
        ball.bounces++;
        hitBumper(b);
      }
    }
  }
  for (const a of adds) {
    if (a.down > 0 || a.hitCooldown > 0) continue;
    const dx = ball.x - a.x,
      dy = ball.y - a.y,
      l = Math.hypot(dx, dy);
    if (l < ball.r + a.r) {
      const nx = dx / (l || 1),
        ny = dy / (l || 1),
        dot = ball.vx * nx + ball.vy * ny;
      if (dot < 0) {
        a.hitCooldown = 0.2;
        ball.vx -= 2 * dot * nx;
        ball.vy -= 2 * dot * ny;
        ball.x = a.x + nx * (ball.r + a.r + 1);
        ball.y = a.y + ny * (ball.r + a.r + 1);
        damageAdd(a, 11 + Math.round(ball.power * 5), "직격", "#d8c3ff");
        ball.runeBurst = 0.46;
      }
    }
  }
  const wx = boss.x + Math.cos(boss.a) * 84,
    wy = boss.y + Math.sin(boss.a) * 84,
    weakHit = Math.hypot(ball.x - wx, ball.y - wy) < ball.r + 21,
    bodyHit = Math.hypot(ball.x - boss.x, ball.y - boss.y) < ball.r + 58;
  if ((weakHit || bodyHit) && boss.hitCooldown <= 0) {
    boss.hitCooldown = 0.25;
    damage(weakHit);
  }
  if (Math.hypot(ball.vx, ball.vy) < 28) endShot();
}
