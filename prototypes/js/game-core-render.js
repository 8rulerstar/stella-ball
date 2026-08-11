function damage(weak = false) {
  if (battleComplete) return;
  let amount = RULES.baseDamage + build.weakFlat;
  amount *=
    1 + Math.max(0, chain.length - 1) * (RULES.chainStep + build.chainStep);
  amount *= 1 + ball.power * 0.18;
  const marked = weak && ball.mark;
  if (marked) amount *= build.markMultiplier;
  amount *= weak ? 1.8 : 0.72;
  amount *= 1 + Math.min(0.48, ball.bounces * build.bounceStep);
  const crit =
    weak && Math.random() < 0.1 + Math.min(0.18, chain.length * 0.04);
  if (crit) amount *= 1.6;
  amount = Math.max(1, Math.round(amount));
  const label = weak ? (crit ? "치명 약점" : "약점") : "몸체";
  boss.hp = Math.max(0, boss.hp - amount);
  addPopup(
    ball.x,
    ball.y - 28,
    label + " -" + amount,
    weak ? "#ffe59a" : "#e6c7ff",
    crit,
  );
  triggerZone("boss");
  if (marked)
    areaAttack(
      "비연 표식 폭발",
      Math.max(9, Math.round(amount * 0.34)),
      "#ef718d",
    );
  if (ball.blink) {
    const a = Math.atan2(ball.y - boss.y, ball.x - boss.x) + Math.PI;
    ball.x = boss.x + Math.cos(a) * 96;
    ball.y = boss.y + Math.sin(a) * 96;
    ball.vx = Math.cos(a) * 760;
    ball.vy = Math.sin(a) * 760;
    ball.blink = false;
    fieldFx.push({
      type: "blink",
      x: ball.x,
      y: ball.y,
      t: 0,
      d: 0.5,
      col: "#ff7fc8",
    });
    toast("카이 · 균열 도약!");
  } else
    toast(weak ? label + " " + amount + " 피해" : "몸체 " + amount + " 피해");
  if (boss.hp <= 0) scheduleWin();
  ball.vx *= weak ? -0.88 : -0.72;
  ball.vy *= weak ? -0.88 : -0.72;
  ball.power = 0;
  if (weak) ball.mark = false;
  ball.pulse = 0;
  chain = [];
  sync();
}
function triggerAssist(g) {
  const amount = 7 + Math.min(12, chain.length * 4);
  assistShots.push({
    x: g.x,
    y: g.y,
    fromX: g.x,
    fromY: g.y,
    t: 0,
    dur: 0.22,
    amount,
    name: g.s,
    col: g.col,
    sourceId: g.id,
  });
  toast(g.s + " · 지원 공격!");
}
function resolveAssist(a) {
  if (!boss || battleComplete) return;
  if (a.areaRadius) {
    resolveShockwaveAssist(a);
    return;
  }
  const gate = gates.find((g) => g.id === a.sourceId);
  if (gate) {
    gate.animState = "hit";
    gate.on = Math.max(gate.on, 0.32);
  }
  const amount = Math.round(a.amount * (a.blaze || 1));
  boss.hp = Math.max(0, boss.hp - amount);
  registerBossHit(false);
  impact(false, boss.x, boss.y, a.finisher ? "finisher" : "default");
  addPopup(
    boss.x,
    boss.y - 78,
    a.name + " 지원 -" + amount,
    a.col,
    hitCombo >= 3,
  );
  toast(a.name + " 지원 명중 " + amount);
  if (boss.hp <= 0) scheduleWin();
  syncBossHealth();
}
function updateAssists(d) {
  for (const a of assistShots) a.t += d;
  const arrived = assistShots.filter((a) => a.t >= a.dur);
  assistShots = assistShots.filter((a) => a.t < a.dur);
  for (const a of arrived) resolveAssist(a);
}
function drawAssistProjectile(a, px, py, t) {
  const angle = Math.atan2(boss.y - a.fromY, boss.x - a.fromX),
    visual = a.visual || "basic";
  x.save();
  x.translate(px, py);
  x.rotate(angle);
  x.globalAlpha = 0.55 + 0.45 * t;
  x.shadowBlur = 14;
  x.shadowColor = a.col;
  if (visual === "longshot") {
    x.strokeStyle = "#ff9eba";
    x.lineWidth = 3;
    x.beginPath();
    x.moveTo(-56, 0);
    x.lineTo(-12, 0);
    x.stroke();
    x.strokeStyle = "#fff1c7";
    x.lineWidth = 4;
    x.beginPath();
    x.moveTo(-17, 0);
    x.lineTo(15, 0);
    x.stroke();
    x.fillStyle = "#ffe4b7";
    x.beginPath();
    x.moveTo(22, 0);
    x.lineTo(9, -7);
    x.lineTo(9, 7);
    x.fill();
    x.fillStyle = "#ef718d";
    x.fillRect(-14, -9, 8, 18);
  } else if (visual === "slash") {
    for (const shift of [-0.22, 0.2]) {
      x.strokeStyle = "#ffe59a";
      x.lineWidth = 5;
      x.beginPath();
      x.arc(-4, 0, 26 + shift * 15, -1.1 + shift, 0.95 + shift);
      x.stroke();
    }
    x.fillStyle = "#fff8d8";
    x.fillRect(-10, -3, 34, 6);
  } else if (visual === "shockwave") {
    x.fillStyle = "#ffb05d";
    x.beginPath();
    x.arc(0, 0, 13 + Math.sin(t * 16) * 3, 0, Math.PI * 2);
    x.fill();
    x.strokeStyle = "#fff1aa";
    x.lineWidth = 3;
    x.beginPath();
    x.arc(0, 0, 20, 0, Math.PI * 2);
    x.stroke();
  } else {
    const tint =
      visual === "split"
        ? "#81f4ed"
        : visual === "seek"
          ? "#a5ef80"
          : visual === "turn"
            ? "#e7c2ff"
            : visual === "copycat"
              ? "#c7a1ff"
              : a.col;
    x.fillStyle = tint;
    x.beginPath();
    x.moveTo(16, 0);
    x.lineTo(0, -10);
    x.lineTo(-16, 0);
    x.lineTo(0, 10);
    x.fill();
    x.fillStyle = "#fff6cf";
    x.fillRect(-5, -3, 13, 6);
  }
  x.restore();
}
function drawAssists() {
  for (const a of assistShots) {
    if ((a.delay || 0) > 0) continue;
    const t = Math.min(1, a.t / a.dur),
      ease = t * t * (3 - 2 * t),
      tx = boss.x,
      ty = boss.y,
      aX = a.fromX + (tx - a.fromX) * ease,
      aY = a.fromY + (ty - a.fromY) * ease;
    x.save();
    x.strokeStyle = a.col + "88";
    x.lineWidth = a.visual === "longshot" ? 1.5 : 2;
    x.shadowBlur = 12;
    x.shadowColor = a.col;
    x.setLineDash(a.visual === "longshot" ? [7, 5] : []);
    x.beginPath();
    x.moveTo(a.fromX, a.fromY);
    x.lineTo(aX, aY);
    x.stroke();
    x.restore();
    drawAssistProjectile(a, aX, aY, t);
    if (t > 0.82) {
      x.save();
      x.globalAlpha = (t - 0.82) * 5;
      x.strokeStyle = "#fff3bb";
      x.shadowBlur = 18;
      x.shadowColor = a.col;
      x.lineWidth = 3;
      x.beginPath();
      x.arc(aX, aY, 18 + (t - 0.82) * 70, 0, Math.PI * 2);
      x.stroke();
      x.restore();
    }
  }
}
function registerBossHit(weak) {
  hitCombo = comboTimer > 0 ? hitCombo + 1 : 1;
  comboTimer = 1.18;
  comboPulse = 1;
  const riposte = hitCombo >= 3;
  if (U.combo) {
    U.combo.textContent = riposte
      ? "RIPOSTE · " + hitCombo + " HIT"
      : "COMBO · " + hitCombo + " HIT";
    U.combo.classList.toggle("hot", riposte);
  }
  if (riposte)
    setTimeout(() => toast("RIPOSTE! 연속 명중 " + hitCombo + "회"), 0);
}
function impact(weak) {
  const force = Math.min(1.65, 1 + (hitCombo - 1) * 0.16);
  impactStop = Math.max(impactStop, (weak ? 0.09 : 0.035) * force);
  screenShake = Math.max(screenShake, (weak ? 8 : 4) * force);
  screenFlash = Math.max(screenFlash, (weak ? 1 : 0.48) * force);
  if (navigator.vibrate)
    navigator.vibrate(weak || hitCombo >= 3 ? [12, 24, 18] : 10);
}
function addPopup(px, py, text, col, big = false) {
  const bossHit = text.includes("몸체") || text.includes("약점");
  if (bossHit) {
    registerBossHit(text.includes("약점"));
    impact(text.includes("약점"));
  }
  popups.push({
    x: px,
    y: py,
    text,
    col,
    t: 0,
    big: big || text.includes("약점") || hitCombo >= 3,
  });
  if (popups.length > 12) popups.shift();
}
let lastStageTransform = "",
  lastFlashOpacity = "",
  momentumHudCooldown = 0,
  lastMomentumHud = -1;
function updateFeedback(d) {
  updateAssists(d);
  for (const burst of areaBursts) burst.t += d;
  areaBursts = areaBursts.filter((burst) => burst.t < burst.d);
  screenShake = Math.max(0, screenShake - d * 18);
  screenFlash = Math.max(0, screenFlash - d * 4.8);
  comboTimer = Math.max(0, comboTimer - d);
  comboPulse = Math.max(0, comboPulse - d * 2.8);
  if (!comboTimer && hitCombo) {
    hitCombo = 0;
    if (U.combo) {
      U.combo.textContent = "COMBO —";
      U.combo.classList.remove("hot");
    }
  }
  const s = screenShake ? Math.sin(performance.now() * 0.11) * screenShake : 0,
    stageTransform = screenShake
      ? "translate(" + s.toFixed(1) + "px," + (-s * 0.45).toFixed(1) + "px)"
      : "translate(0px,0px)",
    flashOpacity = screenFlash > 0.005 ? screenFlash.toFixed(2) : "0";
  if (stageTransform !== lastStageTransform) {
    stageEl.style.transform = stageTransform;
    lastStageTransform = stageTransform;
  }
  if (U.flash && flashOpacity !== lastFlashOpacity) {
    U.flash.style.opacity = flashOpacity;
    lastFlashOpacity = flashOpacity;
  }
  runRuntimeHooks("afterFeedbackUpdate", d);
}
function circle(a, b, r, col, glow = 0) {
  x.save();
  x.fillStyle = col;
  x.shadowBlur = glow;
  x.shadowColor = col;
  x.beginPath();
  x.arc(a, b, r, 0, Math.PI * 2);
  x.fill();
  x.restore();
}
function updateSpecial(d) {
  if (ball?.runeBurst) ball.runeBurst = Math.max(0, ball.runeBurst - d);
  momentumHudCooldown -= d;
  if (U.momentum && ball) {
    const momentum = Math.round(Math.hypot(ball.vx || 0, ball.vy || 0));
    if (
      momentumHudCooldown <= 0 ||
      Math.abs(momentum - lastMomentumHud) >= 120 ||
      (momentum === 0 && lastMomentumHud !== 0)
    ) {
      U.momentum.textContent = momentum;
      lastMomentumHud = momentum;
      momentumHudCooldown = 1 / 12;
    }
  }
  if (ball?.firework && ball.bounces > ball.fireworkBounce) {
    ball.firework = false;
    areaAttack("루카 벽 폭죽", 24, "#ff9d64");
    fieldFx.push({
      type: "firework",
      x: ball.x,
      y: ball.y,
      t: 0,
      d: 0.55,
      col: "#ff9d64",
    });
  }
  if (!run || !ball?.homing || ball.relay || ball.orbit) return;
  const wx = boss.x + Math.cos(boss.a) * 84,
    wy = boss.y + Math.sin(boss.a) * 84,
    dx = wx - ball.x,
    dy = wy - ball.y,
    l = Math.hypot(dx, dy) || 1;
  ball.vx = (dx / l) * 920;
  ball.vy = (dy / l) * 920;
}
function drawFieldFx() {
  for (const f of fieldFx) {
    const p = 1 - f.t / f.d;
    x.save();
    x.globalAlpha = Math.max(0, p);
    x.strokeStyle = f.col;
    x.fillStyle = f.col;
    x.shadowBlur = 16;
    x.shadowColor = f.col;
    x.lineWidth = 2;
    if (["gravity", "magnet", "vortex", "time"].includes(f.type)) {
      x.beginPath();
      x.arc(f.x, f.y, 24 + Math.sin(f.t * 10) * 7, 0, Math.PI * 2);
      x.stroke();
      x.beginPath();
      x.arc(f.x, f.y, 11, 0, Math.PI * 2);
      x.stroke();
    } else if (f.type === "barrier") {
      x.strokeRect(f.x - 25, f.y - 25, 50, 50);
    } else if (f.type === "constel") {
      for (let i = 0; i < gates.length; i++) {
        const a = gates[i],
          b = gates[(i + 1) % gates.length];
        x.beginPath();
        x.moveTo(a.x, a.y);
        x.lineTo(b.x, b.y);
        x.stroke();
      }
    } else if (f.type === "flame") {
      x.fillRect(f.x - 5, f.y - 5, 10, 10);
    } else {
      for (let i = 0; i < 4; i++) {
        const a = f.t * 6 + (i * Math.PI) / 2;
        x.beginPath();
        x.arc(
          f.x + Math.cos(a) * 18,
          f.y + Math.sin(a) * 18,
          4,
          0,
          Math.PI * 2,
        );
        x.fill();
      }
    }
    x.restore();
  }
  for (const wall of barriers) {
    x.save();
    x.strokeStyle = wall.col;
    x.shadowBlur = 14;
    x.shadowColor = wall.col;
    x.lineWidth = 3;
    x.strokeRect(wall.x - 25, wall.y - 25, 50, 50);
    x.restore();
  }
  for (const seed of seeds) {
    circle(seed.x, seed.y, 8, seed.col, 12);
  }
  for (const a of adds)
    if (a.frozen > 0) {
      x.save();
      x.globalAlpha = 0.65;
      x.strokeStyle = "#93ecff";
      x.lineWidth = 2;
      x.strokeRect(a.x - 28, a.y - 28, 56, 56);
      x.restore();
    }
}
function drawSpecial() {
  drawFieldFx();
  if (!ball?.moving) {
    runRuntimeHooks("afterSpecialDraw");
    return;
  }
  if (ball.runeBurst) {
    x.save();
    x.globalAlpha = Math.min(1, ball.runeBurst * 3);
    x.strokeStyle = "#fff5b5";
    x.shadowBlur = 18;
    x.shadowColor = "#ffcb64";
    x.lineWidth = 3;
    x.beginPath();
    x.arc(ball.x, ball.y, ball.r + 9, 0, Math.PI * 2);
    x.stroke();
    x.restore();
  }
  if (ball.homing) {
    x.save();
    x.strokeStyle = "#fff09d";
    x.shadowBlur = 14;
    x.shadowColor = "#fff09d";
    x.lineWidth = 2;
    x.beginPath();
    x.arc(ball.x, ball.y, ball.r + 8, 0, Math.PI * 2);
    x.stroke();
    x.restore();
  }
  let cue = "";
  if (ball.orbit)
    cue =
      "탭 · 원심 발사 " +
      Math.min(100, Math.round((ball.orbit.t / 1.2) * 100)) +
      "%";
  else if (ball.orbitReady) cue = "하단 탭 · 원심 플리퍼";
  else if (ball.turnReady && !ball.turnUsed) cue = "클릭 · 90° 전환 + 에너지";
  else if (ball.moon && !ball.moonUsed) cue = "하단 탭 · 좌상단 플리퍼";
  if (cue) {
    x.save();
    x.fillStyle = ball.turnReady
      ? "#e5c7ff"
      : ball.moon
        ? "#a9b9ff"
        : "#ffe49b";
    x.font = "bold 11px ui-monospace";
    x.textAlign = "center";
    x.fillText(cue, ball.x, ball.y - 28);
    x.restore();
  }
  runRuntimeHooks("afterSpecialDraw");
}
function drawStatic(name, cx, cy, size) {
  const im = textures[staticArt[name]];
  if (!im?.complete || !im.naturalWidth) return false;
  x.drawImage(
    im,
    Math.round(cx - size / 2),
    Math.round(cy - size / 2),
    size,
    size,
  );
  return true;
}
function drawLibraryAsset(
  path,
  cx,
  cy,
  width,
  height = width,
  filter = "none",
  alpha = 1,
) {
  const im = textures[path];
  if (!im?.complete || !im.naturalWidth) return false;
  x.save();
  x.globalAlpha = alpha;
  x.filter = filter;
  x.drawImage(
    im,
    Math.round(cx - width / 2),
    Math.round(cy - height / 2),
    width,
    height,
  );
  x.restore();
  return true;
}
const stageFloorLayers = new Map(),
  stageArenaLayers = new Map(),
  arenaCrackPaths = [
    [
      [76, 158],
      [116, 178],
      [140, 218],
      [190, 232],
    ],
    [
      [620, 172],
      [585, 198],
      [562, 232],
      [519, 246],
    ],
    [
      [94, 470],
      [137, 449],
      [171, 464],
    ],
    [
      [611, 494],
      [570, 475],
      [543, 492],
    ],
  ];
function buildStageFloorLayer(key, im, base) {
  if (!im?.complete || !im.naturalWidth) return null;
  if (stageFloorLayers.has(key)) return stageFloorLayers.get(key);
  const layer = document.createElement("canvas");
  layer.width = W;
  layer.height = H;
  const layerX = layer.getContext("2d");
  layerX.imageSmoothingEnabled = false;
  layerX.fillStyle = base;
  layerX.fillRect(0, 0, W, H);
  layerX.globalAlpha = 0.72;
  const size = 128;
  for (let py = 18; py < H - 18; py += size)
    for (let px = 18; px < W - 18; px += size)
      layerX.drawImage(im, px, py, size, size);
  const glow = layerX.createRadialGradient(
    W * 0.5,
    H * 0.34,
    22,
    W * 0.5,
    H * 0.46,
    H * 0.7,
  );
  glow.addColorStop(0, "#9ba8ff20");
  glow.addColorStop(0.45, "#5b5fc51a");
  glow.addColorStop(1, "#02030bcc");
  layerX.fillStyle = glow;
  layerX.fillRect(0, 0, W, H);
  stageFloorLayers.set(key, layer);
  return layer;
}
function drawStageFloor() {
  const tile = libraryArt.stages[stageIndex].tile,
    im = textures[tile],
    base = ["#111633", "#151837", "#101b3b"][stageIndex] || "#0e1430";
  const layer = buildStageFloorLayer(stageIndex + ":" + tile, im, base);
  if (layer) {
    x.drawImage(layer, 0, 0);
    return;
  }
  x.fillStyle = base;
  x.fillRect(0, 0, W, H);
}
function drawStageProps() {
  const props = libraryArt.stages[stageIndex].props || [];
  for (const [path, px, py, size] of props)
    drawLibraryAsset(path, px, py, size, size, "none", 0.58);
}
function drawArenaFrame() {
  const [hPath, vPath, cPath] = libraryArt.stages[stageIndex].frame,
    h = textures[hPath],
    v = textures[vPath],
    corner = textures[cPath];
  if (
    !h?.complete ||
    !h.naturalWidth ||
    !v?.complete ||
    !v.naturalWidth ||
    !corner?.complete ||
    !corner.naturalWidth
  )
    return;
  x.save();
  x.globalAlpha = 0.92;
  for (let px = 40; px < W - 40; px += 128) {
    x.drawImage(h, px, 7, 128, 32);
    x.drawImage(h, px, H - 39, 128, 32);
  }
  for (let py = 40; py < H - 40; py += 128) {
    x.drawImage(v, 7, py, 32, 128);
  }
  for (let py = 40; py < H - 40; py += 128) {
    x.drawImage(v, W - 39, py, 32, 128);
  }
  for (const [px, py] of [
    [7, 7],
    [W - 39, 7],
    [7, H - 39],
    [W - 39, H - 39],
  ])
    x.drawImage(corner, px, py, 32, 32);
  x.restore();
}
function buildStageArenaLayer() {
  const stageArt = libraryArt.stages[stageIndex],
    tile = textures[stageArt.tile],
    props = stageArt.props || [],
    [hPath, vPath, cPath] = stageArt.frame,
    h = textures[hPath],
    v = textures[vPath],
    corner = textures[cPath],
    key = [stageIndex, stageArt.tile, hPath, vPath, cPath].join(":");
  if (stageArenaLayers.has(key)) return stageArenaLayers.get(key);
  const propImages = props.map(([path]) => textures[path]);
  if (
    !tile?.complete ||
    !tile.naturalWidth ||
    !h?.complete ||
    !h.naturalWidth ||
    !v?.complete ||
    !v.naturalWidth ||
    !corner?.complete ||
    !corner.naturalWidth ||
    propImages.some((image) => !image?.complete || !image.naturalWidth)
  )
    return null;
  const floor = buildStageFloorLayer(
      stageIndex + ":" + stageArt.tile,
      tile,
      ["#111633", "#151837", "#101b3b"][stageIndex] || "#0e1430",
    ),
    layer = document.createElement("canvas");
  layer.width = W;
  layer.height = H;
  const layerX = layer.getContext("2d");
  layerX.imageSmoothingEnabled = false;
  layerX.drawImage(floor, 0, 0);
  const crackColor =
    ["#9ca4f055", "#c8a36a50", "#7a92d955"][stageIndex] || "#99a4e055";
  layerX.save();
  layerX.strokeStyle = crackColor;
  layerX.lineWidth = 1.4;
  layerX.shadowBlur = 7;
  layerX.shadowColor = crackColor;
  for (const path of arenaCrackPaths) {
    layerX.beginPath();
    layerX.moveTo(path[0][0], path[0][1]);
    for (let i = 1; i < path.length; i++) layerX.lineTo(path[i][0], path[i][1]);
    layerX.stroke();
  }
  layerX.restore();
  layerX.save();
  layerX.globalAlpha = 0.58;
  for (let i = 0; i < props.length; i++) {
    const [, px, py, size] = props[i];
    layerX.drawImage(
      propImages[i],
      Math.round(px - size / 2),
      Math.round(py - size / 2),
      size,
      size,
    );
  }
  layerX.restore();
  layerX.save();
  layerX.globalAlpha = 0.92;
  for (let px = 40; px < W - 40; px += 128) {
    layerX.drawImage(h, px, 7, 128, 32);
    layerX.drawImage(h, px, H - 39, 128, 32);
  }
  for (let py = 40; py < H - 40; py += 128) {
    layerX.drawImage(v, 7, py, 32, 128);
    layerX.drawImage(v, W - 39, py, 32, 128);
  }
  for (const [px, py] of [
    [7, 7],
    [W - 39, 7],
    [7, H - 39],
    [W - 39, H - 39],
  ])
    layerX.drawImage(corner, px, py, 32, 32);
  layerX.restore();
  stageArenaLayers.set(key, layer);
  return layer;
}
function drawStageArena() {
  const layer = buildStageArenaLayer();
  if (layer) {
    x.drawImage(layer, 0, 0);
    return;
  }
  drawStageFloor();
  const crackColor =
    ["#9ca4f055", "#c8a36a50", "#7a92d955"][stageIndex] || "#99a4e055";
  x.save();
  x.strokeStyle = crackColor;
  x.lineWidth = 1.4;
  x.shadowBlur = 7;
  x.shadowColor = crackColor;
  for (const path of arenaCrackPaths) {
    x.beginPath();
    x.moveTo(path[0][0], path[0][1]);
    for (let i = 1; i < path.length; i++) x.lineTo(path[i][0], path[i][1]);
    x.stroke();
  }
  x.restore();
  drawStageProps();
  drawArenaFrame();
}
function drawAimGuide() {
  if (!run || ball?.moving) return;
  drawLibraryAsset(
    libraryArt.tutorial.drag,
    ball.x + 48,
    ball.y - 34,
    58,
    58,
    "hue-rotate(145deg) saturate(.7)",
  );
  const force = ball.launchPower || 0.25,
    gaugeX = W / 2 - 66,
    gaugeY = H - 59,
    gaugeW = 132,
    gaugeH = 24,
    fill = textures[libraryArt.tutorial.gaugeFill],
    frame = textures[libraryArt.tutorial.gaugeFrame];
  x.save();
  if (fill?.complete && fill.naturalWidth) {
    x.beginPath();
    x.rect(gaugeX, gaugeY, gaugeW * force, gaugeH);
    x.clip();
    x.filter = "hue-rotate(145deg) saturate(.7)";
    x.drawImage(fill, gaugeX, gaugeY, gaugeW, gaugeH);
  }
  if (frame?.complete && frame.naturalWidth) {
    x.filter = "hue-rotate(145deg) saturate(.7)";
    x.drawImage(frame, gaugeX, gaugeY, gaugeW, gaugeH);
  }
  x.fillStyle = "#f5deb0";
  x.font = "bold 10px ui-monospace";
  x.textAlign = "center";
  x.fillText(
    drag
      ? "당겨서 위력 " + Math.round(force * 100) + "%"
      : "플런저를 당겨 발사",
    W / 2,
    H - 68,
  );
  x.restore();
}
function drawProjectileOverlay() {
  if (!ball?.moving) return;
  const path = ball.homing
    ? libraryArt.projectile.homing
    : ball.mark
      ? libraryArt.projectile.marked
      : ball.runeBurst
        ? libraryArt.projectile.charged
        : "";
  if (path)
    drawLibraryAsset(
      path,
      ball.x,
      ball.y,
      34,
      34,
      "hue-rotate(145deg) saturate(.72)",
    );
}
function drawFrame(
  spec,
  cx,
  cy,
  frame = 0,
  scale = spec.scale,
  state = spec.animState === "hit" && spec.on > 0.08
    ? "hit"
    : spec.animState === "attack" && spec.on > 0.08
      ? "attack"
      : "idle",
) {
  const animated = spec.animations?.[state],
    path = animated ?? spec.sprite,
    im = textures[path];
  if (!im?.complete || !im.naturalWidth) return false;
  if (animated) {
    const size = 256 * (spec.sheetScale ?? scale),
      sx = (frame % 4) * 256;
    x.drawImage(
      im,
      sx,
      0,
      256,
      256,
      Math.round(cx - size / 2),
      Math.round(cy - size * 0.64),
      Math.round(size),
      Math.round(size),
    );
    return true;
  }
  const dw = spec.fw * scale,
    dh = spec.fh * scale,
    sx = spec.atlas ? spec.atlas[0] * spec.fw : (frame % spec.frames) * spec.fw,
    sy = spec.atlas ? spec.atlas[1] * spec.fh : 0;
  x.drawImage(
    im,
    sx,
    sy,
    spec.fw,
    spec.fh,
    Math.round(cx - dw / 2),
    Math.round(cy - dh * 0.64),
    Math.round(dw),
    Math.round(dh),
  );
  return true;
}
function drawAnimated(name, cx, cy, size, frame) {
  const im = textures[staticArt[name]];
  if (!im?.complete || !im.naturalWidth) return false;
  const fw = im.naturalWidth / 4,
    fh = im.naturalHeight;
  x.drawImage(
    im,
    (frame % 4) * fw,
    0,
    fw,
    fh,
    Math.round(cx - size / 2),
    Math.round(cy - size / 2),
    size,
    size,
  );
  return true;
}
function drawFlipper(side) {
  const f = flipperPose(side);
  x.save();
  x.translate(f.pivotX, f.pivotY);
  x.rotate(f.angle);
  x.shadowBlur = f.raised ? 24 : 11;
  x.shadowColor = f.raised ? "#fff0a6" : "#d9b45e";
  x.fillStyle = f.raised ? "#fff0a6" : "#e5bd62";
  x.fillRect(0, -17, f.length, 34);
  x.fillStyle = "#a66e37";
  x.fillRect(11, -8, f.length - 26, 16);
  x.fillStyle = "#fff1b5";
  x.fillRect(20, -12, f.length - 50, 5);
  x.restore();
  circle(f.pivotX, f.pivotY, 19, "#101d23", 9);
  circle(
    f.pivotX,
    f.pivotY,
    12,
    f.raised ? "#fff0a6" : "#e5bd62",
    f.raised ? 22 : 8,
  );
  circle(f.pivotX, f.pivotY, 4, "#4a3024");
}
function drawCombatControls() {
  const launch = !ball?.moving,
    alpha = launch ? 1 : 0.82;
  x.save();
  x.globalAlpha = alpha;
  x.textAlign = "center";
  x.font = "bold 11px ui-monospace";
  x.fillStyle = "#08151bdf";
  x.strokeStyle = "#5e9290";
  x.lineWidth = 1;
  x.beginPath();
  x.roundRect(W / 2 - 174, H - 246, 348, 31, 7);
  x.fill();
  x.stroke();
  x.fillStyle = "#f3e6bf";
  x.fillText(
    launch
      ? "① 하단을 아래로 드래그 → 놓기 : 플런저 발사"
      : "② 공이 내려오면 좌 / 우 화면 클릭 : 플리퍼",
    W / 2,
    H - 226,
  );
  x.font = "bold 10px ui-monospace";
  x.fillStyle = "#8bded2";
  x.fillText("좌측 클릭", W * 0.2, H - 274);
  x.fillText("우측 클릭", W * 0.8, H - 274);
  x.fillStyle = "#d6e8df";
  x.fillText("플리퍼", W * 0.2, H - 260);
  x.fillText("플리퍼", W * 0.8, H - 260);
  x.restore();
}
function drawPinballTable() {
  x.save();
  x.strokeStyle = "#d0ad5b";
  x.lineWidth = 4;
  x.beginPath();
  x.moveTo(44, H - 44);
  x.lineTo(W * 0.17, H - 202);
  x.lineTo(W * 0.83, H - 202);
  x.lineTo(W - 44, H - 44);
  x.stroke();
  x.restore();
  drawFlipper(-1);
  drawFlipper(1);
  for (const b of bumpers) {
    circle(b.x, b.y, b.r + 6, "#10222c", b.on ? 22 : 7);
    circle(b.x, b.y, b.r, b.on ? "#e4f5d5" : "#4db8b3", b.on ? 24 : 10);
    circle(b.x, b.y, Math.max(6, b.r - 9), "#e8cf77", b.on ? 12 : 3);
  }
  drawCombatControls();
}
function drawZoneRules() {
  for (const g of gates) {
    x.save();
    x.fillStyle = g.on > 0 ? "#f2cb79e8" : "#0a1a22df";
    x.strokeStyle = g.on > 0 ? g.col : "#5e8d8c";
    x.lineWidth = 1;
    x.fillRect(g.x - 48, g.y - 59, 96, 16);
    x.strokeRect(g.x - 48, g.y - 59, 96, 16);
    x.fillStyle = g.on > 0 ? "#071116" : "#d8e8e1";
    x.font = "bold 8px ui-monospace";
    x.textAlign = "center";
    x.fillText(g.slot, g.x, g.y - 48);
    x.restore();
  }
}
function drawArena() {
  drawStageArena();
  drawPinballTable();
  runRuntimeHooks("afterArenaDraw");
}
function draw() {
  drawArena();
  for (let i = 1; i < ball.trail.length; i++) {
    x.strokeStyle = "#d6ebe077";
    x.lineWidth = i / 5;
    x.beginPath();
    x.moveTo(ball.trail[i - 1].x, ball.trail[i - 1].y);
    x.lineTo(ball.trail[i].x, ball.trail[i].y);
    x.stroke();
  }
  if (ball.relay) {
    x.save();
    x.strokeStyle = "#66f7d7";
    x.shadowBlur = 13;
    x.shadowColor = "#66f7d7";
    x.lineWidth = 2;
    x.setLineDash([5, 5]);
    x.beginPath();
    x.moveTo(ball.relay.from.x, ball.relay.from.y);
    x.lineTo(ball.relay.target.x, ball.relay.target.y);
    x.stroke();
    x.setLineDash([]);
    x.restore();
  }
  if (ball.orbit) {
    x.save();
    x.strokeStyle = "#ffe39c";
    x.shadowBlur = 12;
    x.shadowColor = "#ffcf65";
    x.lineWidth = 2;
    x.beginPath();
    x.moveTo(ball.orbit.anchor.x, ball.orbit.anchor.y);
    x.lineTo(ball.x, ball.y);
    x.stroke();
    x.restore();
  }
  for (const g of gates) {
    const actionFrame = Math.floor(
      (g.animClock || 0) /
        (g.animState === "attack"
          ? 0.21
          : g.animState === "move"
            ? 0.13
            : 0.155),
    );
    circle(g.x, g.y, g.r + 5, "#0b161d");
    circle(g.x, g.y, g.r, g.col, g.on ? 32 : 13);
    circle(g.x, g.y, g.r - 4, "#11242d");
    if (!drawFrame(g, g.x, g.y, actionFrame, g.scale))
      circle(g.x, g.y, 16, g.col, 12);
    x.fillStyle = "#fff4dc";
    x.font = "10px ui-monospace";
    x.textAlign = "center";
    x.fillText(g.s, g.x, g.y + 45);
  }
  for (const a of adds) {
    if (a.down > 0) continue;
    circle(a.x, a.y, a.r + 13, "#10212a", 22);
    const hit = a.hitCooldown > 0,
      frame = Math.floor(performance.now() / (hit ? 55 : 155));
    if (!drawAnimated(hit ? "wispHit" : "wispIdle", a.x, a.y, 96, frame)) {
      circle(a.x, a.y, a.r, "#a65d57", 18);
      circle(a.x, a.y, a.r - 7, "#3c2529");
    }
    x.fillStyle = "#f2d6d0";
    x.fillRect(a.x - 18, a.y + a.r + 8, 36, 4);
    x.fillStyle = "#cf705c";
    x.fillRect(a.x - 18, a.y + a.r + 8, 36 * (a.hp / a.maxHp), 4);
    x.fillStyle = "#e8eee3";
    x.font = "9px ui-monospace";
    x.textAlign = "center";
    x.fillText("잔재", a.x, a.y - 31);
  }
  for (const burst of areaBursts) {
    const t = burst.t / burst.d;
    x.save();
    x.globalAlpha = 1 - t;
    x.strokeStyle = burst.col;
    x.shadowBlur = 16;
    x.shadowColor = burst.col;
    x.lineWidth = 3;
    x.beginPath();
    x.arc(burst.x, burst.y, 18 + burst.r * t, 0, Math.PI * 2);
    x.stroke();
    x.restore();
  }
  if (
    !drawFrame(
      bossArt,
      boss.x,
      boss.y,
      Math.floor(performance.now() / (boss.hitCooldown > 0 ? 70 : 145)),
      boss.scale,
      boss.hitCooldown > 0 ? "hit" : "idle",
    )
  )
    circle(boss.x, boss.y, 58, "#442b72", 16);
  const wx = boss.x + Math.cos(boss.a) * 84,
    wy = boss.y + Math.sin(boss.a) * 84;
  circle(wx, wy, 16, "#c763ff", 8);
  if (!drawStatic("weak", wx, wy, 27)) circle(wx, wy, 9, "#f1a5ff", 10);
  x.fillStyle = "#e5eee4";
  x.font = "11px ui-monospace";
  x.textAlign = "center";
  x.fillText("공허 거상", boss.x, boss.y + 105);
  if (drag && !ball.moving) {
    x.setLineDash([5, 4]);
    x.strokeStyle = "#ecf4e9";
    x.lineWidth = 2;
    x.beginPath();
    x.moveTo(ball.x, ball.y);
    x.lineTo(ball.x, Math.min(H - 24, ball.y + 84 * ball.launchPower));
    x.stroke();
    x.setLineDash([]);
  }
  circle(
    ball.x,
    ball.y,
    ball.r + 3,
    ball.moving ? "#d3e7cf" : "#e0b45a",
    ball.moving ? 25 : 16,
  );
  if (!drawStatic("orb", ball.x, ball.y, 31)) {
    circle(
      ball.x,
      ball.y,
      ball.r,
      ball.moving ? "#f6fdff" : "#a6f5ff",
      ball.moving ? 24 : 16,
    );
    circle(ball.x, ball.y, 4, "#ffffff", 2);
  }
  for (const p of popups) {
    const a = 1 - p.t / 0.9;
    x.save();
    x.globalAlpha = a;
    x.fillStyle = "#071117";
    x.font = (p.big ? "bold 22px" : "bold 16px") + " ui-monospace";
    x.textAlign = "center";
    x.fillText(p.text, p.x + 2, p.y - p.t * 34 + 2);
    x.fillStyle = p.col;
    x.fillText(p.text, p.x, p.y - p.t * 34);
    x.restore();
  }
  runRuntimeHooks("afterDraw");
}
function drawCombo() {
  if (!comboTimer || !boss) return;
  const riposte = hitCombo >= 3,
    scale = 1 + comboPulse * 0.28;
  x.save();
  x.translate(boss.x, boss.y - 112);
  x.scale(scale, scale);
  x.textAlign = "center";
  x.font = (riposte ? "bold 22px" : "bold 15px") + " ui-monospace";
  x.fillStyle = "#071117";
  x.fillText(riposte ? "RIPOSTE!" : "COMBO x" + hitCombo, 2, 2);
  x.fillStyle = riposte ? "#fff08f" : "#d1efe2";
  x.shadowBlur = riposte ? 18 : 8;
  x.shadowColor = x.fillStyle;
  x.fillText(riposte ? "RIPOSTE!" : "COMBO x" + hitCombo, 0, 0);
  x.restore();
}
function modernUpdate(d) {
  if (toastTimer > 0) {
    toastTimer -= d;
    if (toastTimer <= 0) U.toast.classList.remove("show");
  }
  for (const key of ["left", "right"]) {
    const rising = (flippers[key + "Strike"] || 0) > 0;
    flippers[key] = rising
      ? Math.min(1, (flippers[key] || 0) + d / PHYSICS.flipperRise)
      : Math.max(0, (flippers[key] || 0) - d / PHYSICS.flipperFall);
    flippers[key + "Strike"] = Math.max(0, (flippers[key + "Strike"] || 0) - d);
  }
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
  if (battle.victory) {
    boss.a += d * 0.12;
    return;
  }
  battle.slow = Math.max(0, (battle.slow || 0) - d);
  boss.a += d * 0.62 * (battle.slow > 0 ? 0.24 : 1);
  boss.hitCooldown = Math.max(0, boss.hitCooldown - d);
  for (const g of gates) {
    g.on = Math.max(0, g.on - d);
    g.animClock = (g.animClock || 0) + d;
  }
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
  simulatePhysics(d);
}
update = modernUpdate;
