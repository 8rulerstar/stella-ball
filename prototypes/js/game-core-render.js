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
  x.shadowBlur = combatFxBlur(14);
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
    x.shadowBlur = combatFxBlur(12);
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
      x.shadowBlur = combatFxBlur(18);
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
    toast("연타! 연속 명중 " + combo + "회");
  }
  runRuntimeHooks("afterBossHitRegistered", { weak, combo: hitCombo, riposte });
}
/* This used to decide "did the colossus just get hit?" by looking for 몸체 or
   약점 inside the popup's own text, and then fire registerBossHit + impact off
   that. Two things were wrong with reading damage out of a label. The direct
   meteor labels 직격 and 첫 직격 match neither word, so an unrouted direct hit
   dealt its damage with no shake, no flash, no hit-stop and no combo at all -
   measured 0/0/0/0 against 5.5/0.58/0.034/1 for the routed 몸체 hit. And the
   clone's 분열 약점 label matched, so a clone weak hit registered twice on top
   of cloneDamage's own explicit call, double-counting the combo and inflating
   the persisted best-combo record. Damage sites now say so themselves. */
/* huge는 «한 샷의 가장 큰 숫자» 하나에만 붙는다(2026-08-21 결정 2). 6·7점
   별자리의 대격 프레임이 그 자리다 — 히트스톱 0.14초와 벽 살구 펄스가 같은
   프레임에 떨어지므로, 숫자만 22px로 남으면 화면이 크게 말하는데 숫자는
   평소 크기인 상태가 된다. big을 더 키우지 않고 등급을 하나 더 둔 이유는
   big이 이미 «약점»과 3연타에도 자동으로 붙어 흔하기 때문이다. 흔한 것을
   키우면 사다리의 맨 위가 사라진다. */
function addPopup(px, py, text, col, big = false, voice = false, huge = false) {
  popups.push({
    x: px,
    y: py,
    text,
    col,
    t: 0,
    d: 0.9,
    big: big || huge || text.includes("약점") || hitCombo >= 3,
    huge,
    // 화자가 있는 말인가. 그리기 쪽이 서체를 가른다(§9-2).
    voice,
  });
  if (popups.length > 12) popups.shift();
}
let lastStageTransform = "",
  lastFlashOpacity = "",
  momentumHudCooldown = 0,
  lastMomentumHud = -1;
/* 모션 감소 확인은 한 번만 재고 캐시한다. matchMedia 호출을 프레임마다 하면
   그 자체가 비용이고, 이 값은 사용자가 OS 설정을 바꿀 때만 변한다. */
let reducedMotionCache = null;
function reducedMotionPreferred() {
  if (reducedMotionCache === null) {
    try {
      const q = matchMedia("(prefers-reduced-motion: reduce)");
      reducedMotionCache = q.matches;
      q.addEventListener?.("change", (e) => (reducedMotionCache = e.matches));
    } catch (e) {
      reducedMotionCache = false;
    }
  }
  return reducedMotionCache;
}
function updateFeedback(d) {
  updateAssists(d);
  advanceTimed(areaBursts, d);
  /* 이 게임의 다른 이펙트 배열은 전부 상한이 있다 — 패링 FX 6, 별빛 7, 팝업 12,
     fieldFx 12. areaBursts와 assistShots만 없어서, 밀어 넣는 자리가 열세 곳인데
     아무도 세지 않았다. 한 프레임에 몇 개가 겹치든 결국 다 그려지므로 최악의
     프레임에서만 조용히 비싸진다. 오래된 것부터 버린다. */
  if (areaBursts.length > 10) areaBursts.splice(0, areaBursts.length - 10);
  if (assistShots.length > 12) assistShots.splice(0, assistShots.length - 12);
  /* 선형 감쇠(-= d×18)는 끝이 뭉툭해서, 최댓값을 키우면 잔진동이 그만큼 길게
     남는다. 지수감쇠로 바꾸면 24px에서 시작해도 꼬리가 길어지지 않는다. */
  const fade = (v, rate) => (v > 0.02 ? v * Math.exp(-d * rate) : 0);
  screenShake = fade(screenShake, 11);
  screenPushX = fade(screenPushX, 9);
  screenPushY = fade(screenPushY, 9);
  screenTilt =
    Math.abs(screenTilt) > 0.0004 ? screenTilt * Math.exp(-d * 8) : 0;
  screenGhost = fade(screenGhost, 13);
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
    /* 모션 감소에서는 흔들림·밀림·기울기를 전부 0으로 두고 플래시와
       히트스톱만 남긴다(UI_REVIEW 규약). */
    calm = reducedMotionPreferred(),
    px2 = calm ? 0 : screenPushX,
    py2 = calm ? 0 : screenPushY,
    tilt = calm ? 0 : screenTilt,
    moved = !calm && (screenShake || px2 || py2 || tilt),
    stageTransform = moved
      ? "translate(" +
        (s + px2).toFixed(1) +
        "px," +
        (-s * 0.45 + py2).toFixed(1) +
        "px) rotate(" +
        ((tilt * 180) / Math.PI).toFixed(2) +
        "deg)"
      : "",
    flashOpacity = screenFlash > 0.005 ? screenFlash.toFixed(2) : "0";
  if (stageTransform !== lastStageTransform) {
    stageEl.style.transform = stageTransform;
    lastStageTransform = stageTransform;
  }
  if (U.flash && flashOpacity !== lastFlashOpacity) {
    U.flash.style.opacity = flashOpacity;
    /* `.impact-flash`는 스테이지 전체를 덮는 `mix-blend-mode: screen`이고
       `.stage`는 `isolation: isolate`다. 투명해도 블렌드 그룹은 살아 있어서
       매 프레임 갱신되는 캔버스가 직접 합성되지 못했다. 플래시는 타격 순간
       0.2초 남짓만 보이므로, 안 보이는 동안에는 트리에서 빼 둔다. */
    U.flash.style.display = flashOpacity === "0" ? "none" : "block";
    lastFlashOpacity = flashOpacity;
  }
  runRuntimeHooks("afterFeedbackUpdate", d);
}
/* 구운 글로우. `shadowBlur`는 그리기 호출마다 흐림을 다시 만들어 내는 일이라,
   패링 한 번이 흐림 걸린 그리기를 2회에서 65회로, 3연쇄면 121회로 올린다 —
   측정상 패링이 더하는 프레임 비용의 77%가 여기서 나왔다(흐림을 0으로 강제하면
   3연쇄 CPU 래스터 프레임이 46.34ms → 7.77ms).
   같은 빛을 색마다 한 장씩 구워 두고 크기만 바꿔 얹으면 비용이 drawImage 한
   번으로 떨어진다. 원본 그림자가 색을 그대로 쓰므로 색상당 한 장이면 되고,
   유닛 색은 여덟 가지뿐이라 캐시가 자라지 않는다. */
const glowSprites = new Map();
const GLOW_BAKE = 64;
function glowSprite(col) {
  const hit = glowSprites.get(col);
  if (hit) return hit;
  const made = document.createElement("canvas");
  made.width = made.height = GLOW_BAKE;
  const g = made.getContext("2d"),
    c = GLOW_BAKE / 2,
    grad = g.createRadialGradient(c, c, 0, c, c, c);
  /* 그림자 흐림은 가우시안이라 중심이 평평하고 가장자리가 길게 사라진다.
     두 점짜리 그라디언트로는 그 꼬리가 재현되지 않아 가장자리에서 어긋났다
     (최대 차이 78/255). 가우시안 exp(-2.6r²)을 여덟 구간으로 따라간다. */
  const alphaHex = (a) =>
    Math.max(0, Math.min(255, Math.round(a * 255)))
      .toString(16)
      .padStart(2, "0");
  for (let i = 0; i <= 8; i++) {
    const r = i / 8;
    grad.addColorStop(r, col + alphaHex(Math.exp(-2.6 * r * r) * (1 - r * r)));
  }
  g.fillStyle = grad;
  g.fillRect(0, 0, GLOW_BAKE, GLOW_BAKE);
  glowSprites.set(col, made);
  return made;
}
// radius는 빛이 닿는 바깥 반지름이다. 원본의 (도형 반지름 + shadowBlur)에 해당한다.
function glowBlit(col, cx, cy, radius, alpha = 1) {
  if (!(radius > 0) || alpha <= 0) return;
  const sprite = glowSprite(col || "#cfdad7");
  x.save();
  x.globalAlpha = alpha;
  x.drawImage(sprite, cx - radius, cy - radius, radius * 2, radius * 2);
  x.restore();
}
function circle(a, b, r, col, glow = 0) {
  x.save();
  x.fillStyle = col;
  x.shadowBlur = combatFxBlur(glow);
  x.shadowColor = col;
  x.beginPath();
  x.arc(a, b, r, 0, Math.PI * 2);
  x.fill();
  x.restore();
}

// A 3px stepped ring. `arc()` with `shadowBlur` antialiases, which reads as a
// different material from the pixel sprites it sits on.
//
// This oversamples on purpose and must keep doing so. 180 angles paint only
// ~36 distinct grid cells at r=19, and it is measurably the largest single
// cost in draw() - 540 of a frame's 632 fillRect calls. Every lower-density
// form changes the picture:
// a wider angular step lands on a different set of cells; baking the ring once
// and blitting it at a grid-snapped centre shifts the whole ring (78-134% of
// painted pixels differ); and batching the cells into one path removes the
// repeat paints, which two of the three callers depend on - they pass 0x44 and
// 0x33 alpha, so ~5 overlapping fills per cell are what make those rings read
// as solid. Since draw() is ~1.3% of a 16.7ms frame, none of that is worth a
// visual regression. The angle vectors below are the same 0.035-radian samples
// baked once. Samples landing on one cell are counted, then source-over alpha
// is solved as 1-(1-a)^n; that preserves the oversampled brightness while
// replacing roughly 180 tiny draw calls with at most six batched paths.
const STEP_RING_DIRECTIONS = [];
for (let angle = 0; angle < Math.PI * 2; angle += 0.035)
  STEP_RING_DIRECTIONS.push([Math.cos(angle), Math.sin(angle)]);
const STEP_RING_COUNTS = new Map(),
  STEP_RING_BUCKETS = Array.from({ length: 16 }, () => []);
const stepRingAlphaHex = (alpha) =>
  Math.max(0, Math.min(255, Math.round(alpha * 255)))
    .toString(16)
    .padStart(2, "0");
function stepRing(cx, cy, r, col, step = 3, thick = 3) {
  STEP_RING_COUNTS.clear();
  for (const bucket of STEP_RING_BUCKETS) bucket.length = 0;
  for (let i = 0; i < STEP_RING_DIRECTIONS.length; i++) {
    const direction = STEP_RING_DIRECTIONS[i],
      px = Math.round((cx + direction[0] * r) / step) * step,
      py = Math.round((cy + direction[1] * r) / step) * step,
      key = px * 2048 + py;
    STEP_RING_COUNTS.set(key, (STEP_RING_COUNTS.get(key) || 0) + 1);
  }
  for (const [key, count] of STEP_RING_COUNTS)
    STEP_RING_BUCKETS[Math.min(15, count)].push(key);
  const hasAlpha = /^#[0-9a-f]{8}$/i.test(col),
    sourceAlpha = hasAlpha ? parseInt(col.slice(7, 9), 16) / 255 : 1,
    base = hasAlpha ? col.slice(0, 7) : col,
    previousAlpha = x.globalAlpha,
    effectiveSource = sourceAlpha * previousAlpha;
  x.globalAlpha = 1;
  for (let count = 1; count < STEP_RING_BUCKETS.length; count++) {
    const bucket = STEP_RING_BUCKETS[count];
    if (!bucket.length) continue;
    const alpha = 1 - Math.pow(1 - effectiveSource, count);
    x.fillStyle = base + stepRingAlphaHex(alpha);
    x.beginPath();
    for (let i = 0; i < bucket.length; i++) {
      const px = Math.floor(bucket[i] / 2048),
        py = bucket[i] - px * 2048;
      x.rect(px, py, step, thick);
    }
    x.fill();
  }
  x.globalAlpha = previousAlpha;
  x.fillStyle = col;
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
    /* 값이 같으면 쓰지 않는다. `textContent`는 같은 문자열이어도 텍스트 노드를
       갈아끼우기 때문에 childList 변경이 발생하고, document.body를 보는
       MutationObserver 두 개(하늘 리태그, 타이틀 감시)가 그때마다 깨어난다.
       공이 멈춰 있어도 초당 12번 「0」을 「0」으로 덮어쓰면서 그 둘을 계속
       돌리고 있었다 — 온보딩에서 측정된 초당 12회 강제 레이아웃의 정체다.
       다른 HUD 항목은 모두 `sync()`에서 이미 이렇게 비교한다. */
    if (
      momentum !== lastMomentumHud &&
      (momentumHudCooldown <= 0 ||
        Math.abs(momentum - lastMomentumHud) >= 120 ||
        momentum === 0)
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
    x.shadowBlur = combatFxBlur(16);
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
    x.shadowBlur = combatFxBlur(18);
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
  /* 미리 구워 둔 캔버스도 여기로 들어온다(tintedProjectile). 캔버스에는
     complete도 naturalWidth도 없으므로 둘 중 하나로 준비 여부를 판단한다. */
  const ready = im && (im.naturalWidth ? im.complete : im.width > 0);
  if (!ready) return false;
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
  layerX.shadowBlur = combatFxBlur(7);
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
  x.shadowBlur = combatFxBlur(7);
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
    /* 예전에는 여기서 매 프레임 ctx.filter로 색을 돌렸다. 필터가 걸린 drawImage는
       래스터를 통째로 다시 만들어 내는 일이라, 패링 뒤 runeBurst가 켜져 있는 동안
       측정 7.50ms 대 5.20ms였다. 같은 그림을 한 번만 구워 두고 쓴다. */
    drawLibraryAsset(tintedProjectile(path), ball.x, ball.y, 34, 34);
}
/* 색을 돌린 발사체를 한 번만 굽는다. 키가 원본 경로라 텍스처가 늦게 도착해도
   그때 처음 구워지고, 이후로는 조회만 남는다. */
const tintedProjectiles = new Map();
function tintedProjectile(path) {
  const hit = tintedProjectiles.get(path);
  if (hit) return hit;
  const im = textures[path];
  if (!im?.complete || !im.naturalWidth) return path;
  const baked = document.createElement("canvas");
  baked.width = im.naturalWidth;
  baked.height = im.naturalHeight;
  const g = baked.getContext("2d");
  g.filter = "hue-rotate(145deg) saturate(.72)";
  g.drawImage(im, 0, 0);
  const key = path + "@tinted";
  textures[key] = baked;
  tintedProjectiles.set(path, key);
  return key;
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
// Stage 8-1 has no raster boss: `boss-art.js` draws the walking planet pixel by
// pixel, which is far too expensive to repeat every frame. Each phase is baked
// once into an offscreen canvas and then blitted 1:1, so no scaling filter runs
// and the per-frame cost is a single drawImage. Only four phases exist, so the
// cache cannot grow beyond that.
const OUTSIDE_BOSS_SIZE = 264;
const OUTSIDE_BOSS_LIFT = -22;
const outsideBossFrames = new Map();
/* 동공 호흡. 이 몸은 래스터 시트가 없어 한 장을 blit하기 때문에, 페이즈가
   바뀌기 전까지 완전히 정지해 있었다 — 튜토리얼 보스가 이 몸이라 첫 전투의
   거상이 아예 숨을 쉬지 않았다. 인트로 스펙 자체가 「동공 수축 뒤 느린 호흡,
   정지 상태에서도 프레임이 산다」를 규정하므로, 그 호흡만 여기서도 돌린다.
   페이즈당 몇 장을 더 굽는 것뿐이고 프레임 비용은 여전히 drawImage 한 번이다. */
/* 예전의 동공 호흡은 동공 크기마다 264×264 몸통을 통째로 다시 구웠다 —
   한 장에 14ms, 60fps 한 프레임을 통째로 먹는 값이라 「눈만 끔뻑거리는」
   4단계가 낼 수 있는 전부였다.
   눈이 고르는 색은 중심으로부터의 dx·dy·d에만 의존하고 절대 좌표를 보지
   않는다(boss-art.js의 eye). 그래서 눈을 별도 캔버스에 구워도 몸통 안에
   구워진 것과 픽셀 단위로 같은 그림이 나온다 — 네 페이즈 전부 6501픽셀
   전수 비교에서 차이 0으로 확인했다. 몸통은 페이즈당 한 장만 굽고, 그 위에
   눈만 얹는다. 96×96 한 장이 약 1ms이므로 동공을 연속 값으로 굴릴 수 있고,
   홍채를 소켓 안에서 몇 픽셀 옮기면 시선이 된다. */
const outsideBossSockets = new Map();
const outsideBossIrises = new Map();
function outsideBossGeometry(size, phase) {
  return window.StellaBossArt?.geometry?.(size, phase) ?? null;
}
function outsideBossPatchSize(g) {
  return (Math.ceil(g.R0) + 3) * 2;
}
// 소켓: 홍채를 지운 눈. irisR/pupR을 음수로 주면 R0 안쪽이 전부 공막이 된다.
function outsideBossSocket(size, phase) {
  const key = size + ":" + phase,
    hit = outsideBossSockets.get(key);
  if (hit) return hit;
  const art = window.StellaBossArt,
    g = outsideBossGeometry(size, phase);
  if (!art?.eye || !g) return null;
  const d = outsideBossPatchSize(g),
    c = d / 2,
    made = document.createElement("canvas");
  made.width = made.height = d;
  art.eye(made.getContext("2d"), { w: d, h: d, d: null }, c, c, g.R0, -1, -1, {
    free: true,
    spokes: g.spokes,
    hot: g.hot,
    rimHot: g.rimHot,
    ticks: false,
  });
  outsideBossSockets.set(key, made);
  return made;
}
// 홍채: 눈을 통째로 그린 뒤 irisR 밖을 잘라낸다. 소켓 위에서 이것만 움직인다.
const OUTSIDE_BOSS_PUPIL_STEP = 0.06;
function outsideBossIris(size, phase, pupilScale) {
  const step = Math.round(pupilScale / OUTSIDE_BOSS_PUPIL_STEP),
    key = size + ":" + phase + ":" + step,
    hit = outsideBossIrises.get(key);
  if (hit) return hit;
  const art = window.StellaBossArt,
    g = outsideBossGeometry(size, phase);
  if (!art?.eye || !g) return null;
  const d = outsideBossPatchSize(g),
    c = d / 2,
    made = document.createElement("canvas");
  made.width = made.height = d;
  const ig = made.getContext("2d");
  art.eye(
    ig,
    { w: d, h: d, d: null },
    c,
    c,
    g.R0,
    g.iris,
    g.pupil * (step * OUTSIDE_BOSS_PUPIL_STEP),
    {
      free: true,
      spokes: g.spokes,
      hot: g.hot,
      rimHot: g.rimHot,
      ticks: false,
    },
  );
  ig.globalCompositeOperation = "destination-in";
  ig.beginPath();
  ig.arc(c, c, g.iris, 0, Math.PI * 2);
  ig.fill();
  outsideBossIrises.set(key, made);
  return made;
}
/* 거상의 대기 상태. 「눈만 끔뻑거린다」는 지적에 대한 답을 몸의 움직임이
   아니라 «시선»으로 잡는다 — 가만히 서 있어도 저것이 나를 보고 있으면 살아
   있는 것으로 읽힌다. 값은 전부 프레임 사이 보간이고, 그리기는 캐시된 패치를
   옮겨 얹는 것뿐이라 새로 굽는 일이 없다.
   심사에서 만들지 않기로 한 것: 눈을 축으로 한 회전(발끝이 0.43px 흔들려
   지각 한계 아래이면서 계단만 생긴다), 몸통 비균일 스케일·전단(행 중복과
   전단 계단이 동시에 보인다), 대기 중 잔상, 몸통 전체 재합성 「가열」,
   2px 계단으로 튀는 몸통 흠칫(렌더 버그로 읽힌다). */
const outsideBossIdle = {
  clock: 0,
  gx: 0,
  gy: 0,
  lean: 0,
  blinkNext: 2600,
  blinkAt: -1,
  blinkDouble: false,
  awayNext: 9000,
  awayAt: -1,
};
function resetOutsideBossIdle() {
  outsideBossIdle.clock = 0;
  outsideBossIdle.gx = 0;
  outsideBossIdle.gy = 0;
  outsideBossIdle.lean = 0;
  outsideBossIdle.blinkAt = -1;
  outsideBossIdle.blinkNext = 2600;
  outsideBossIdle.awayAt = -1;
  outsideBossIdle.awayNext = 9000;
}
// 정수 해시. Math.random을 쓰면 봇 하니스가 기대는 결정론이 깨진다.
function outsideBossHash(n) {
  let h = (n | 0) * 374761393;
  h = (h ^ (h >>> 13)) * 1274126177;
  return (h ^ (h >>> 16)) >>> 0;
}
/* 프레임마다 도는 대기 갱신. 전부 산술이고 캔버스를 만들지 않는다. */
function updateOutsideBossIdle(phase) {
  const g = outsideBossGeometry(OUTSIDE_BOSS_SIZE, phase);
  if (!g) return null;
  const now = frameClock;
  const dt = Math.min(0.05, Math.max(0, (now - outsideBossIdle.clock) / 1000));
  outsideBossIdle.clock = now;

  // 눈의 실제 화면 좌표. 몸통 blit 자리 + 패치 안 눈 중심.
  const bodyX = Math.round(boss.x - OUTSIDE_BOSS_SIZE / 2),
    bodyY = Math.round(boss.y - OUTSIDE_BOSS_SIZE / 2 - OUTSIDE_BOSS_LIFT),
    eyeX = bodyX + g.x,
    eyeY = bodyY + g.y;

  /* 「다른 것을 본다」 비트. 유성이 멈춰 있을 때만, 9~16초마다 0.76초.
     그동안 이것은 나를 보고 있지 않다 — 위협은 시선을 거두는 데서 나온다. */
  if (
    outsideBossIdle.awayAt < 0 &&
    !ball?.moving &&
    now > outsideBossIdle.awayNext
  ) {
    outsideBossIdle.awayAt = now;
    outsideBossIdle.awayNext =
      now + 9000 + (outsideBossHash(Math.floor(now)) % 7000);
  }
  const away =
    outsideBossIdle.awayAt >= 0 && now - outsideBossIdle.awayAt < 760;
  if (!away) outsideBossIdle.awayAt = -1;

  // 시선. 목표를 정하고 감쇠로 따라간다.
  const maxGaze = Math.max(
    0,
    Math.min(4, g.R0 - Math.max(2, g.R0 * 0.09) - g.iris - 2),
  );
  let tx = 0,
    ty = 0;
  if (away) {
    const side =
      outsideBossHash(Math.floor(outsideBossIdle.awayAt)) & 1 ? 1 : -1;
    tx = side * maxGaze;
    ty = -0.7 * maxGaze;
  } else if (ball) {
    const dx = ball.x - eyeX,
      dy = ball.y - eyeY,
      len = Math.hypot(dx, dy) || 1;
    tx = (dx / len) * maxGaze;
    ty = (dy / len) * maxGaze * 0.78;
    /* 미세 단속운동. 760ms마다 130ms 동안만 목표를 살짝 흔든다 — 눈은 결코
       완벽하게 멈춰 있지 않다. 해시라 매 판 같은 리듬이고 재현된다. */
    const win = Math.floor(now / 760);
    if (now % 760 < 130) {
      const h = outsideBossHash(win);
      tx += ((h & 3) - 1.5) * 1.7;
      ty += (((h >> 5) & 3) - 1.5) * 1.3;
    }
  }
  const tau = away ? 0.3 : ball?.moving ? 0.08 : 0.19,
    k = 1 - Math.exp(-dt / tau);
  outsideBossIdle.gx += (tx - outsideBossIdle.gx) * k;
  outsideBossIdle.gy += (ty - outsideBossIdle.gy) * k;

  /* 동공은 위협 게이지다. 유성이 멀면 넓고 부드럽고, 다가올수록 조여든다.
     설명 한 줄 없이 읽히는 정보다. */
  const dist = ball ? Math.hypot(ball.x - eyeX, ball.y - eyeY) : 999;
  const prox = Math.max(0, Math.min(1, (430 - dist) / 300));
  let pupil = 1.16 - 0.44 * prox + 0.05 * Math.sin(now * 0.00115 + 0.9);
  if (ball?.moving) pupil -= 0.16;
  if (away) pupil += 0.3;
  pupil -= 0.22 * Math.min(1, (boss.hitFlash || 0) / 0.26);
  pupil = Math.max(0.6, Math.min(1.44, pupil));

  // 호흡. 인트로가 정한 5.46초 템포 그대로, 2px 격자에 계단으로 얹는다.
  const bobY = Math.round((Math.sin(now * 0.00115) * 3) / 2) * 2;

  // 위협 쪽으로 무게가 실린다. 흠칫과 헷갈리지 않게 느리다.
  const leanTarget = away
    ? 0
    : Math.max(-1, Math.min(1, ((ball?.x ?? boss.x) - boss.x) / 210)) * 3;
  outsideBossIdle.lean +=
    (leanTarget - outsideBossIdle.lean) * (1 - Math.exp(-dt / 0.55));
  const leanX = Math.round(outsideBossIdle.lean / 2) * 2;

  // 깜빡임. 3.4~6.8초마다, 여덟 번에 한 번은 두 번 연속.
  if (outsideBossIdle.blinkAt < 0 && now > outsideBossIdle.blinkNext) {
    const h = outsideBossHash(Math.floor(now) ^ 0x9e37);
    outsideBossIdle.blinkAt = now;
    outsideBossIdle.blinkDouble = (h & 7) === 0;
    outsideBossIdle.blinkNext = now + 3400 + (h % 3400);
  }
  let lid = 0;
  if (outsideBossIdle.blinkAt >= 0) {
    const shut = (t) =>
      t < 60 ? t / 60 : t < 90 ? 1 : t < 190 ? 1 - (t - 90) / 100 : 0;
    const t = now - outsideBossIdle.blinkAt;
    lid = shut(t);
    if (outsideBossIdle.blinkDouble) lid = Math.max(lid, shut(t - 230));
    if (t > (outsideBossIdle.blinkDouble ? 420 : 190))
      outsideBossIdle.blinkAt = -1;
  }

  return { g, eyeX, eyeY, pupil, bobY, leanX, lid, prox };
}
function outsideBossFrame(size, phase) {
  const key = size + ":" + phase;
  const cached = outsideBossFrames.get(key);
  if (cached) return cached;
  if (!window.StellaBossArt) return null;
  const baked = document.createElement("canvas");
  baked.width = size;
  baked.height = size;
  window.StellaBossArt.draw(baked.getContext("2d"), "strider", {
    size,
    phase,
    pupil: 1,
  });
  outsideBossFrames.set(key, baked);
  warmOutsideBossEyes(size, phase);
  return baked;
}
/* 눈은 한 장이 1ms이라도 수업 첫 순간에 몰아서 구우면 보인다. 실제로 쓰이는
   범위만 한가할 때 미리 굽는다. 프레임 루프에서는 캐시 적중만 일어난다. */
const outsideBossWarmed = new Set();
function warmOutsideBossEyes(size, phase) {
  const tag = size + ":" + phase;
  if (outsideBossWarmed.has(tag)) return;
  outsideBossWarmed.add(tag);
  const whenIdle =
    window.requestIdleCallback?.bind(window) ?? ((fn) => setTimeout(fn, 32));
  whenIdle(() => outsideBossSocket(size, phase));
  for (let p = 0.6; p <= 1.45; p += OUTSIDE_BOSS_PUPIL_STEP) {
    const scale = p;
    whenIdle(() => outsideBossIris(size, phase, scale));
  }
}
// The phase counter is the same one the combat solver already advances, so the
// silhouette and the health thresholds can never disagree.
function outsideBossPhase() {
  return Math.min(4, (stagePhases?.fired ?? 0) + 1);
}
function drawArena() {
  drawStageArena();
  drawPinballTable();
  runRuntimeHooks("afterArenaDraw");
}
/* 잔상. 직전 프레임을 낮은 알파로 한 장 남긴다 — 세션 §4의 방향 어휘 셋 중
   하나다. 강타·마무리에서만 켜지고, 켜져 있는 동안에도 판 한 장을 복사해
   한 번 얹는 것이 전부라 fillRect 호출 수는 늘지 않는다. */
let ghostFrame = null;
function drawGhostFrame() {
  if (!(screenGhost > 0.02) || reducedMotionPreferred()) return;
  if (!ghostFrame) {
    ghostFrame = document.createElement("canvas");
    ghostFrame.width = W;
    ghostFrame.height = H;
  }
  if (ghostFrame.__filled) {
    x.save();
    x.globalAlpha = screenGhost;
    x.drawImage(ghostFrame, 0, 0);
    x.restore();
  }
}
function keepGhostFrame() {
  if (!(screenGhost > 0.02) || reducedMotionPreferred() || !ghostFrame) {
    if (ghostFrame) ghostFrame.__filled = false;
    return;
  }
  const g = ghostFrame.getContext("2d");
  g.clearRect(0, 0, W, H);
  g.drawImage(c, 0, 0);
  ghostFrame.__filled = true;
}
/* 입장 연출의 구간별 진행도(디자인 세션 §8). 전 구간이 0~1로 정규화된
   진행도 위에 얹히므로, 첫 진입 1.5초와 재도전 0.6초가 같은 코드로 돈다.
     0.00–0.26  판   프레임이 네 모서리에서 안으로 닫힌다
     0.20–0.72  거상 위에서 내려앉는다 · 페이드인 + 착지 충격
     0.62–1.10  별지기 0.08초 간격으로 별빛에서 맺힌다
     1.04–1.34  유성 발사석으로 떨어져 자리를 잡는다
   구간 밖은 0 또는 1이라 호출자가 분기하지 않는다. */
function introBand(t, from, to) {
  if (t >= to) return 1;
  if (t <= from) return 0;
  return (t - from) / (to - from);
}
const introEase = (u) => 1 - (1 - u) * (1 - u) * (1 - u);
function draw() {
  drawArena();
  drawGhostFrame();
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
  /* 입장: 별지기는 거상이 내려앉은 «뒤에» 0.08초 간격으로 맺힌다. 순서가
     「이미 여기 있었고, 우리가 들어간다」를 말한다(§8). */
  const partyIntro = introProgress();
  for (let gi = 0; gi < gates.length; gi++) {
    const g = gates[gi];
    const born = introBand(partyIntro, 0.62 + gi * 0.053, 0.9 + gi * 0.053);
    if (born <= 0) continue;
    const bornEase = introEase(born);
    if (born < 1) {
      x.save();
      x.globalAlpha = bornEase;
      x.translate(g.x, g.y);
      x.scale(0.72 + 0.28 * bornEase, 0.72 + 0.28 * bornEase);
      x.translate(-g.x, -g.y);
    }
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
    setCombatFont(x, "10px ui-monospace");
    x.textAlign = "center";
    x.fillText(g.s, g.x, g.y + 45);
    if (born < 1) x.restore();
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
    x.shadowBlur = combatFxBlur(16);
    x.shadowColor = burst.col;
    x.lineWidth = 3;
    x.beginPath();
    x.arc(burst.x, burst.y, 18 + burst.r * t, 0, Math.PI * 2);
    x.stroke();
    x.restore();
  }
  /* 8-1과 1-1 수업은 같은 몸이다. 프롤로그에서 창밖을 지나간 것이 첫 수업의
     상대이고, 34스테이지 뒤 8-1에서 다시 만난다 — 그 연결이 성립하려면 두
     화면이 같은 그림이어야 한다. 수업에는 페이즈가 없으므로 항상 P1이다. */
  const stage = currentStage();
  const outerBody =
    stage?.world === "outside" || isTutorialOuterObserver(stage);
  const outsidePhase = stage?.world === "outside" ? outsideBossPhase() : 1;
  const outsideBoss = outerBody
    ? outsideBossFrame(OUTSIDE_BOSS_SIZE, outsidePhase)
    : null;
  // 그림자보다 먼저 갱신해야 한다 — 그림자가 호흡의 반대 위상을 타야 하므로.
  const outsideIdle = outsideBoss ? updateOutsideBossIdle(outsidePhase) : null;
  /* Ground the colossus so it stops floating over the carved floor.
     무게는 여기서 나온다. 몸이 떠오를 때 그림자가 함께 줄어들고 옅어지지
     않으면, 위아래로 움직이는 것이 바닥에 붙어 있지 않고 유리 위를 미끄러지는
     것으로 읽힌다. 타원 하나를 그리는 비용은 그대로다. */
  const shadowBob = outsideIdle?.bobY ?? 0,
    shadowLean = outsideIdle?.leanX ?? 0;
  x.fillStyle = "rgba(0,0,0," + (0.4 + shadowBob * 0.012).toFixed(3) + ")";
  x.beginPath();
  x.ellipse(
    boss.x + shadowLean * 0.5,
    boss.y + 76,
    76 + shadowBob * 0.7,
    17 + shadowBob * 0.22,
    0,
    0,
    Math.PI * 2,
  );
  x.fill();
  /* The flinch. Screen shake and hit-stop already exist, but the boss's own
     body showed nothing when hurt - the raster sheet only sped up its frames
     and the baked 8-1 canvas never changed at all, so hits read as landing on
     the UI rather than on the creature. While `hitFlash` runs (any damage,
     set in applyBossHit) the body reddens, jerks off its footing in 2px
     steps, and squashes toward the contact shadow. ctx.filter tints both the
     sprite-sheet draw and the baked-canvas blit without any re-bake; the
     wrapper stays outside drawFrame's own save/restore, which only sets a
     filter for hero skins and bosses have none. */
  /* 입장: 거상이 위에서 내려앉는다. 이미 구운 한 장을 blit 시점에 옮기는
     것뿐이라 프레임을 더 굽지 않는다 — 절차적 보스는 한 장이 14ms다.
     착지 충격 12px은 0.72 지점에서 한 번, 감쇠하며 사라진다. */
  const introT = introProgress(),
    bossIn = introBand(introT, 0.2, 0.72),
    bossLand = introBand(introT, 0.72, 0.86);
  /* 퇴장. 거상은 사라지는 것이 아니라 «부서진다» — 흰색으로 타고, 금이 가고,
     파편이 되고, 별빛으로 오른다. 전부 이미 구운 한 장에 얹는 변환과 캔버스
     원시 도형이라 새로 굽지 않는다. */
  const outroT = bossOutro ? (frameClock - bossOutro.at) / 1000 : -1;
  if (outroT >= 1.4) bossOutro = null;
  let introRestore = false;
  let outroRestore = false;
  if (outroT >= 0) {
    x.save();
    outroRestore = true;
    if (outroT < 0.78) {
      // 흩어지기 전까지는 자리를 지키되 점점 하얗게 탄다.
      const burn = Math.min(1, outroT / 0.18);
      if (outroT >= 0.62) {
        const k = (outroT - 0.62) / 0.16;
        x.globalAlpha = 1 - k;
        x.translate(boss.x, boss.y);
        x.scale(1 + k * 0.22, 1 - k * 0.1);
        x.translate(-boss.x, -boss.y);
      }
      x.filter =
        "brightness(" +
        (1 + burn * 1.9).toFixed(2) +
        ") saturate(" +
        (1 - burn * 0.85).toFixed(2) +
        ")";
    } else {
      // 0.78 이후 몸은 없다. 별빛만 남는다.
      x.globalAlpha = 0;
    }
  }
  if (bossIn < 1) {
    x.save();
    introRestore = true;
    x.globalAlpha = introEase(bossIn);
    x.translate(0, -160 * (1 - introEase(bossIn)));
  } else if (bossLand < 1) {
    x.save();
    introRestore = true;
    x.translate(0, 12 * Math.sin(bossLand * Math.PI) * (1 - bossLand));
  }
  const flinch = Math.min(1, (boss.hitFlash || 0) / 0.26);
  if (flinch > 0) {
    x.save();
    const jx = Math.round((Math.sin(frameClock * 0.11) * 3 * flinch) / 2) * 2,
      jy = Math.round((Math.cos(frameClock * 0.13) * 2 * flinch) / 2) * 2,
      foot = boss.y + 76;
    x.translate(boss.x + jx, foot + jy);
    x.scale(1 + 0.07 * flinch, 1 - 0.06 * flinch);
    x.translate(-boss.x, -foot);
    // Measured against the aries sprite: this reads as R132/G54/B26 versus
    // R58/G39/B81 untinted - unmistakably red - while grayscale(0.7) keeps
    // enough of the original shading that the silhouette stays readable.
    // A gentler sepia-only mix came out as warm brightening, not a hit.
    x.filter =
      "grayscale(0.7) sepia(1) saturate(5.5) hue-rotate(-28deg) brightness(1.2)";
  }
  if (outsideBoss) {
    // The baked body centre sits above the canvas centre, so the sprite is
    // nudged down to stand on the same contact shadow the raster boss uses.
    const bodyX = Math.round(boss.x - OUTSIDE_BOSS_SIZE / 2),
      bodyY = Math.round(boss.y - OUTSIDE_BOSS_SIZE / 2 - OUTSIDE_BOSS_LIFT),
      bob = outsideIdle?.bobY ?? 0,
      lean = outsideIdle?.leanX ?? 0;
    x.drawImage(outsideBoss, bodyX + lean, bodyY + bob);
    if (outsideIdle) {
      /* 소켓은 제자리에 두고 홍채만 그 안에서 옮긴다. 눈알 전체가 미끄러지면
         안구가 아니라 스티커가 움직이는 것으로 보인다. */
      const { g, pupil, gx = 0, gy = 0, lid } = outsideIdle,
        socket = outsideBossSocket(OUTSIDE_BOSS_SIZE, outsidePhase),
        iris = outsideBossIris(OUTSIDE_BOSS_SIZE, outsidePhase, pupil),
        half = socket ? socket.width / 2 : 0,
        ex = bodyX + lean + g.x,
        ey = bodyY + bob + g.y;
      if (socket) x.drawImage(socket, ex - half, ey - half);
      if (iris)
        x.drawImage(
          iris,
          Math.round(ex - half + outsideBossIdle.gx),
          Math.round(ey - half + outsideBossIdle.gy),
        );
      /* 눈꺼풀. 이 아트에 없는 기관이라 그려 넣는다. arc로 clip하면 경계가
         안티에일리어싱되어 픽셀 아트가 아닌 것이 섞이므로, 2px 격자에 맞춘
         가로 막대로 덮는다 — stepRing이 같은 이유로 오버샘플링하고 있다. */
      if (lid > 0) {
        x.save();
        x.fillStyle = "#0b1417";
        const R = g.R0;
        for (let yy = -R; yy < -R + lid * 2 * R; yy += 2) {
          const w = Math.sqrt(Math.max(0, R * R - yy * yy));
          x.fillRect(
            Math.round(ex - w),
            Math.round(ey + yy),
            Math.round(w * 2),
            2,
          );
        }
        x.restore();
      }
    }
  } else if (
    !drawFrame(
      stageBossArt(),
      boss.x,
      boss.y,
      Math.floor(frameClock / (boss.hitCooldown > 0 ? 70 : 145)),
      boss.scale,
      boss.hitCooldown > 0 ? "hit" : "idle",
    )
  )
    circle(boss.x, boss.y, 58, "#442b72", 16);
  if (flinch > 0) x.restore();
  if (introRestore) x.restore();
  if (outroRestore) x.restore();
  if (outroT >= 0.18) drawBossOutro(outroT);
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
  setCombatFont(x, "700 12px Galmuri11, ui-monospace");
  x.textAlign = "center";
  x.fillText(bossDisplayName(), boss.x, boss.y + 105);
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
  // A four-step pixel wake makes speed readable without another particle
  // system. It is derived from velocity, so it allocates nothing and remains
  // stable at every refresh rate.
  if (ball.moving) {
    const speed = Math.hypot(ball.vx, ball.vy),
      nx = speed > 1 ? ball.vx / speed : 0,
      ny = speed > 1 ? ball.vy / speed : 0;
    x.save();
    x.fillStyle = orbCol;
    for (let i = 1; i <= 4; i++) {
      const gap = 8 + i * 7,
        flicker = ((Math.floor(frameClock / 45) + i) & 1) * 2,
        size = Math.max(2, 6 - i);
      x.globalAlpha = 0.32 - i * 0.052;
      x.fillRect(
        Math.round((ball.x - nx * gap + ny * flicker) / 2) * 2,
        Math.round((ball.y - ny * gap - nx * flicker) / 2) * 2,
        size,
        size,
      );
    }
    x.restore();
  }
  for (const p of popups) {
    const a = 1 - p.t / 0.9;
    x.save();
    x.globalAlpha = a;
    x.fillStyle = "#071117";
    /* §9-2. 지금 모든 팝업이 같은 모노 서체·같은 크기라 「루나가 준 별」이
       피해량과 구별되지 않았다. 화자가 말하는 것은 다른 서체로 쓴다 —
       숫자가 아니라 말이라는 신호다. */
    setCombatFont(
      x,
      p.voice
        ? (p.big ? "bold 19px" : "bold 15px") + " Galmuri11, ui-monospace"
        : (p.huge ? "bold 30px" : p.big ? "bold 22px" : "bold 16px") +
            " ui-monospace",
    );
    x.textAlign = "center";
    x.fillText(p.text, p.x + 2, p.y - p.t * 34 + 2);
    x.fillStyle = p.col;
    x.fillText(p.text, p.x, p.y - p.t * 34);
    x.restore();
  }
  drawBossRoar();
  runRuntimeHooks("afterDraw");
  keepGhostFrame();
}
/* 포효(디자인 세션 §6-2). 비트는 이렇다 —
     0.00~0.12  숨을 들이켠다. 판이 어두워지고 유성이 끌려온다.
     0.12       파형 3겹이 0.09초 간격으로 밖으로 나간다.
     0.12~0.46  유성이 최근접 모서리로 «밀려난다»(순간이동 아님, 물리 쪽).
     0.46       모서리에 균열 쐐기와 섬광.
   방향 있는 어휘를 처음 쓰는 자리다 — 파형이 중심에서 밖으로 가고, 흔들림은
   균일 진동이 아니라 감쇠를 지닌다(§4의 지수감쇠가 이미 그렇게 한다). */
function drawBossRoar() {
  if (!bossRoar || !boss) return;
  const t = (frameClock - bossRoar.at) / 1000;
  if (t > 0.95) {
    bossRoar = null;
    return;
  }
  x.save();
  // 들이켜는 동안 판이 어두워진다. 밝아지는 것보다 「빨아들인다」로 읽힌다.
  if (t < 0.12) {
    x.globalAlpha = (t / 0.12) * 0.34;
    x.fillStyle = "#03070a";
    x.fillRect(0, 0, W, H);
  }
  // 파형 3겹. 0.09초씩 어긋나 같은 중심에서 밖으로 나간다.
  for (let i = 0; i < 3; i++) {
    const w = (t - 0.12 - i * 0.09) / 0.62;
    if (w <= 0 || w >= 1) continue;
    x.globalAlpha = (1 - w) * 0.5;
    x.strokeStyle = i === 0 ? "#fff1c7" : "#f6c48e";
    x.lineWidth = 5 - i * 1.4;
    x.beginPath();
    x.arc(boss.x, boss.y, 40 + w * 620, 0, Math.PI * 2);
    x.stroke();
  }
  // 0.46초, 유성이 닿는 순간 그 모서리에 균열 쐐기와 섬광.
  if (t > 0.46 && t < 0.78 && ball) {
    const k = (t - 0.46) / 0.32;
    x.globalAlpha = 1 - k;
    x.strokeStyle = "#fff1c7";
    x.lineWidth = 2;
    const inward = Math.atan2(H / 2 - ball.y, W / 2 - ball.x);
    for (let i = -2; i <= 2; i++) {
      const a = inward + i * 0.22,
        len = 26 + k * 54 + Math.abs(i) * 8;
      x.beginPath();
      x.moveTo(ball.x, ball.y);
      x.lineTo(ball.x + Math.cos(a) * len, ball.y + Math.sin(a) * len);
      x.stroke();
    }
  }
  x.restore();
}
/* 균열 → 파편 → 별빛. 세 구간이 이어져 「부서졌다」를 만든다(§11).
   각도는 보스 좌표에서 뽑은 고정 해시라 매번 같은 모양이 나온다 — 봇 하니스가
   기대는 결정론을 깨지 않기 위해 Math.random을 쓰지 않는다. */
function drawBossOutro(t) {
  if (!boss) return;
  const shards = 14;
  const hash = (n) => {
    let h = (n * 374761393) | 0;
    h = ((h ^ (h >>> 13)) * 1274126177) | 0;
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };
  x.save();
  // 0.18–0.62 금이 간다. 약점에서 바깥으로 번진다.
  if (t < 0.62) {
    const k = (t - 0.18) / 0.44;
    x.globalAlpha = Math.min(1, k * 2) * 0.9;
    x.strokeStyle = "#fff6d8";
    x.lineWidth = 2;
    for (let i = 0; i < 9; i++) {
      const a = hash(i) * Math.PI * 2,
        reach = 18 + k * (58 + hash(i + 40) * 46);
      x.beginPath();
      x.moveTo(boss.x, boss.y);
      x.lineTo(boss.x + Math.cos(a) * reach, boss.y + Math.sin(a) * reach);
      x.stroke();
    }
  }
  // 0.62–0.78 파편. 흔들림은 여기서 가장 크다.
  if (t >= 0.62 && t < 0.9) {
    const k = (t - 0.62) / 0.28;
    if (t < 0.66) screenShake = Math.max(screenShake, 34);
    x.globalAlpha = 1 - k;
    x.fillStyle = "#ffe9ad";
    for (let i = 0; i < shards; i++) {
      const a = hash(i + 7) * Math.PI * 2,
        d = k * (70 + hash(i + 90) * 120),
        sz = 6 - k * 4;
      x.fillRect(
        boss.x + Math.cos(a) * d - sz / 2,
        boss.y + Math.sin(a) * d - sz / 2,
        sz,
        sz,
      );
    }
  }
  // 0.78–1.40 별빛이 되어 오른다. 판이 비고 정산으로 넘어간다.
  if (t >= 0.78) {
    const k = (t - 0.78) / 0.62;
    x.globalAlpha = (1 - k) * 0.9;
    x.fillStyle = "#cfdad7";
    for (let i = 0; i < shards; i++) {
      const sway = Math.sin(k * 5 + i) * 12,
        rise = k * (170 + hash(i + 11) * 90);
      x.fillRect(
        boss.x + (hash(i) - 0.5) * 120 + sway,
        boss.y - rise,
        2,
        2 + (1 - k) * 2,
      );
    }
  }
  x.restore();
}
function drawCombo() {
  if (!comboTimer || !boss) return;
  const riposte = hitCombo >= 3,
    scale = 1 + comboPulse * 0.28;
  x.save();
  x.translate(boss.x, boss.y - 112);
  x.scale(scale, scale);
  x.textAlign = "center";
  setCombatFont(x, (riposte ? "bold 22px" : "bold 15px") + " ui-monospace");
  x.fillStyle = "#071117";
  x.fillText(riposte ? "연타!" : "COMBO x" + hitCombo, 2, 2);
  x.fillStyle = riposte ? "#fff08f" : "#d1efe2";
  x.shadowBlur = combatFxBlur(riposte ? 18 : 8);
  x.shadowColor = x.fillStyle;
  x.fillText(riposte ? "연타!" : "COMBO x" + hitCombo, 0, 0);
  x.restore();
}
function update(d) {
  advanceToastQueue(d);
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
  boss.hitFlash = Math.max(0, (boss.hitFlash || 0) - d);
  for (const g of gates) {
    g.on = Math.max(0, g.on - d);
    g.wakeFlash = Math.max(0, (g.wakeFlash || 0) - d);
    g.animClock = (g.animClock || 0) + d;
  }
  for (const b of bumpers) b.on = Math.max(0, b.on - d);
  if (!ball.moving) {
    /* 시각 감쇠는 유성과 함께 멈추면 안 된다. fieldFx와 발광 하이라이트의
       시계는 simulatePhysics 안에만 있어서, 정지 직전에 태어난 이펙트가
       (특히 정산 뒤 큐에 들어오는 지원·피니셔 장식이) 다음 발사 때까지 최대
       알파로 화면에 박제됐다 — 보스 옆에 이펙트가 「계속 남아 있다」는 제보의
       원인 중 하나다. 판이 쉬는 동안에도 장식은 마저 꺼지게 한다. 궤도 장벽의
       위치는 여전히 유성이 구를 때만 도는 규칙 그대로 두고, 빛만 끈다. */
    updateExpanded(d);
    for (const wall of stageWalls) wall.on = Math.max(0, wall.on - d);
    for (const pad of boostPads) pad.on = Math.max(0, pad.on - d);
    for (const pad of dragPads) pad.on = Math.max(0, pad.on - d);
    if (bossShield) bossShield.flash = Math.max(0, bossShield.flash - d);
    /* 칼날돔도 같은 이유로 박제됐다. 세기는 simulatePhysics 안에서만 줄어드는데
       그리기 훅은 유성이 멈춰도 계속 도니, 조준하는 내내 최대 세기로 켜져
       있었다. 위 목록과 같은 규칙으로 여기서도 꺼 준다. */
    for (const g of gates)
      if (g.bladeStrength)
        g.bladeStrength = Math.max(0, g.bladeStrength - d * 3.2);
    for (const orbit of orbitals) {
      orbit.hitCooldown = Math.max(0, orbit.hitCooldown - d);
      if (orbit.down > 0) orbit.down = Math.max(0, orbit.down - d);
    }
    return;
  }
  simulatePhysics(d);
}
