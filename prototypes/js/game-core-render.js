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
  const amount = Math.round(a.amount * (a.blaze || 1)),
    dealt = applyBossHit(amount);
  registerBossHit(false);
  impact(false, boss.x, boss.y, a.finisher ? "finisher" : "default");
  if (dealt > 0) {
    addPopup(
      boss.x,
      boss.y - 78,
      a.name + " 지원 -" + dealt,
      a.col,
      hitCombo >= 3,
    );
    toast(a.name + " 지원 명중 " + dealt);
  }
  if (boss.hp <= 0) scheduleWin();
  syncBossHealth();
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
  runRuntimeHooks("afterAssistsDraw");
}
function registerBossHit(weak) {
  hitCombo = comboTimer > 0 ? hitCombo + 1 : 1;
  comboTimer = 1.18;
  comboPulse = 1;
  const riposte = hitCombo >= 3;
  if (U.combo) {
    U.combo.textContent = riposte
      ? "연타 · " + hitCombo + " HIT"
      : "COMBO · " + hitCombo + " HIT";
    U.combo.classList.toggle("hot", riposte);
  }
  if (riposte) {
    const combo = hitCombo;
    setTimeout(() => toast("연타! 연속 명중 " + combo + "회"), 0);
  }
  runRuntimeHooks("afterBossHitRegistered", { weak, combo: hitCombo, riposte });
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
    d: 0.9,
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
  advanceTimed(areaBursts, d);
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
  const s = screenShake ? Math.sin(frameClock * 0.11) * screenShake : 0,
    // At rest the transform must be cleared, not zeroed: any non-none
    // transform turns .stage into the containing block for position:fixed,
    // which boxed every full-window menu into the canvas column after battle.
    stageTransform = screenShake
      ? "translate(" + s.toFixed(1) + "px," + (-s * 0.45).toFixed(1) + "px)"
      : "",
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

// A 3px stepped ring. `arc()` with `shadowBlur` antialiases, which reads as a
// different material from the pixel sprites it sits on.
function stepRing(cx, cy, r, col, step = 3, thick = 3) {
  x.fillStyle = col;
  for (let a = 0; a < Math.PI * 2; a += 0.035) {
    const px = Math.round((cx + Math.cos(a) * r) / step) * step,
      py = Math.round((cy + Math.sin(a) * r) / step) * step;
    x.fillRect(px, py, step, thick);
  }
}
// Pixel diamond shared by the weak-point gem and the meteor core, three-tone.
// `ramp` runs dark to bright and the radius shrinks with the index, so the
// widest dark layer has to go down first and the bright core last.  The patch
// text iterated the other way, which painted the dark layer over everything and
// flattened the gem to a single #b06a3d blob.
function pixelGem(cx, cy, r, ramp) {
  for (let i = 0; i < ramp.length; i++) {
    const rr = r * (1 - i * 0.28);
    x.fillStyle = ramp[i];
    for (let dy = -rr; dy <= rr; dy += 2) {
      const w = Math.round(((rr - Math.abs(dy)) * 1.15) / 2) * 2;
      if (w > 0) x.fillRect(Math.round(cx - w), Math.round(cy + dy), w * 2, 2);
    }
  }
}
function updateSpecial(d) {
  if (ball?.runeBurst) ball.runeBurst = Math.max(0, ball.runeBurst - d);
  if (ball?.steerFlash) ball.steerFlash = Math.max(0, ball.steerFlash - d);
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
}
const orbitalFieldFxTypes = new Set(["gravity", "magnet", "vortex", "time"]);
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
    if (orbitalFieldFxTypes.has(f.type)) {
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
  for (const a of adds)
    if (a.frozen > 0) {
      x.save();
      x.globalAlpha = 0.65;
      x.strokeStyle = "#93ecff";
      x.lineWidth = 2;
      x.strokeRect(a.x - 28, a.y - 28, 56, 56);
      x.restore();
    }
  runRuntimeHooks("afterFieldFxDraw");
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
  const tile = stageArtFor().tile,
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
  const props = stageArtFor().props || [];
  for (const [path, px, py, size] of props)
    drawLibraryAsset(path, px, py, size, size, "none", 0.58);
}
function drawArenaFrame() {
  const [hPath, vPath, cPath] = stageArtFor().frame,
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
  const stageArt = stageArtFor(),
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
function drawDefaultStageArena() {
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
let stageArenaRenderer = drawDefaultStageArena;
function drawStageArena() {
  stageArenaRenderer();
}
const RenderModule = StellaRuntime.modules.register("render", {
  installStageArena(renderer) {
    if (typeof renderer !== "function")
      throw new TypeError("Stage arena renderer must be a function.");
    const previous = stageArenaRenderer,
      installed = () => renderer(previous);
    stageArenaRenderer = installed;
    return () => {
      if (stageArenaRenderer === installed) stageArenaRenderer = previous;
    };
  },
});
function drawProjectileOverlay() {
  if (!ball?.moving) return;
  const path = ball.mark
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
// A bought starkeeper skin is a hue rotation over the same sheet, applied
// once here so every state (idle, roll, attack) picks it up for free.
function drawFrame(spec, cx, cy, frame, scale, state) {
  const tint =
    typeof heroSkinFilter === "function" ? heroSkinFilter(spec.id) : "none";
  if (tint === "none") return drawFrameRaw(spec, cx, cy, frame, scale, state);
  x.save();
  x.filter = tint;
  const drawn = drawFrameRaw(spec, cx, cy, frame, scale, state);
  x.restore();
  return drawn;
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
function drawArena() {
  drawStageArena();
  drawPinballTable();
  runRuntimeHooks("afterArenaDraw");
}
function draw() {
  drawArena();
  for (let i = 1; i < ball.trail.length; i++) {
    const age = ball.trail.length - i,
      sz = age < 6 ? 4 : age < 14 ? 3 : 2;
    x.globalAlpha = Math.max(0.18, 1 - age * 0.028);
    x.fillStyle = "#ffd2a0";
    x.fillRect(
      Math.round(ball.trail[i].x / 2) * 2 - sz / 2,
      Math.round(ball.trail[i].y / 2) * 2 - sz / 2,
      sz,
      sz,
    );
  }
  x.globalAlpha = 1;
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
    x.fillStyle = "#00000055";
    x.beginPath();
    x.ellipse(a.x, a.y + 30, 24, 7, 0, 0, Math.PI * 2);
    x.fill();
    const hit = a.hitCooldown > 0,
      frame = Math.floor(frameClock / (hit ? 55 : 155));
    if (!drawAnimated(hit ? "wispHit" : "wispIdle", a.x, a.y, 96, frame)) {
      circle(a.x, a.y, a.r, "#a65d57", 18);
      circle(a.x, a.y, a.r - 7, "#3c2529");
    }
    // Three segments so "one more hit kills it" reads without a number.
    const seg = Math.ceil((a.hp / a.maxHp) * 3);
    for (let i = 0; i < 3; i++) {
      x.fillStyle = "#0b1418";
      x.fillRect(a.x - 21 + i * 15, a.y - 44, 13, 6);
      x.fillStyle = i < seg ? "#b578e8" : "#2b1a40";
      x.fillRect(a.x - 20 + i * 15, a.y - 43, 11, 4);
    }
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
  // Ground the colossus so it stops floating over the carved floor.
  x.fillStyle = "#00000066";
  x.beginPath();
  x.ellipse(boss.x, boss.y + 76, 76, 17, 0, 0, Math.PI * 2);
  x.fill();
  if (
    !drawFrame(
      bossArt,
      boss.x,
      boss.y,
      Math.floor(frameClock / (boss.hitCooldown > 0 ? 70 : 145)),
      boss.scale,
      boss.hitCooldown > 0 ? "hit" : "idle",
    )
  )
    circle(boss.x, boss.y, 58, "#442b72", 16);
  // Engrave the orbit and trail the gem's heading. With five shots a turn,
  // "where the gem will be next" is a precondition for aiming at all.
  for (let a = 0; a < Math.PI * 2; a += 15 / 84) {
    x.fillStyle = "#5f4a35";
    x.fillRect(
      Math.round(boss.x + Math.cos(a) * 84),
      Math.round(boss.y + Math.sin(a) * 84),
      2,
      2,
    );
  }
  const wx = boss.x + Math.cos(boss.a) * 84,
    wy = boss.y + Math.sin(boss.a) * 84;
  for (let i = 1; i <= 3; i++) {
    const a2 = boss.a - i * 0.16;
    x.globalAlpha = 0.5 - i * 0.13;
    x.fillStyle = "#eea56f";
    x.fillRect(
      Math.round(boss.x + Math.cos(a2) * 84) - 2,
      Math.round(boss.y + Math.sin(a2) * 84) - 2,
      4,
      4,
    );
  }
  x.globalAlpha = 1;
  // Apricot is reserved on this screen for the one thing worth aiming at.
  stepRing(wx, wy, 17, "#ffd2a044");
  pixelGem(wx, wy, 15, ["#b06a3d", "#eea56f", "#ffd2a0"]);
  x.fillStyle = "#cfdad7";
  x.font = "700 12px Galmuri11, ui-monospace";
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
  // Cosmetic only: the equipped skin repaints the glow and hue-rotates the
  // shared orb sprite.  No skin touches radius, speed or damage.
  const skin =
    typeof equippedSkin === "function" ? equippedSkin() : METEOR_SKINS[0];
  // Stepped rings instead of a blurred halo, to match the carved floor.  The
  // patch text pinned this to `skin.rest`; keep the moving/resting colour split
  // because that is how a player reads whether the meteor is still rolling.
  const orbCol = ball.moving ? skin.moving : skin.rest;
  stepRing(ball.x, ball.y, ball.r + 6, orbCol + "33");
  stepRing(ball.x, ball.y, ball.r + 2, orbCol);
  const tinted = skin.hue !== 0;
  if (tinted) {
    x.save();
    x.filter = "hue-rotate(" + skin.hue + "deg) saturate(1.15)";
  }
  const drewOrb = drawStatic("orb", ball.x, ball.y, 31);
  if (tinted) x.restore();
  if (!drewOrb) {
    circle(
      ball.x,
      ball.y,
      ball.r,
      ball.moving ? skin.core : skin.idle,
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
  x.fillText(riposte ? "연타!" : "COMBO x" + hitCombo, 2, 2);
  x.fillStyle = riposte ? "#fff08f" : "#d1efe2";
  x.shadowBlur = riposte ? 18 : 8;
  x.shadowColor = x.fillStyle;
  x.fillText(riposte ? "연타!" : "COMBO x" + hitCombo, 0, 0);
  x.restore();
}
function update(d) {
  if (toastTimer > 0) {
    toastTimer -= d;
    if (toastTimer <= 0) showNextToast();
  }
  advanceTimed(popups, d);
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
    g.wakeFlash = Math.max(0, (g.wakeFlash || 0) - d);
    g.animClock = (g.animClock || 0) + d;
  }
  for (const b of bumpers) b.on = Math.max(0, b.on - d);
  if (!ball.moving) return;
  simulatePhysics(d);
}
