/* 각성 연출 — 디자인 세션 반입분 (AWAKEN_FX_REQUEST_2026_08_16.md)
 *
 * 반입 방법 — 이 파일 하나만 추가한다. 기존 파일은 고치지 않는다.
 *   1. prototypes/js/game-awaken-fx.js 로 저장한다.
 *   2. prototypes/prism-breakers.html 의 <script src="./js/game-speech.js"></script>
 *      바로 뒤에 아래 한 줄을 넣는다.
 *        <script src="./js/game-awaken-fx.js"></script>
 *      (game-combat.js 의 wakeUnit 과 game-feedback.js 의 drawFinisherFocus·
 *       assistShots·SETTLE_* 를 감싸므로 반드시 그 둘보다 뒤여야 한다.)
 *   3. scripts/smoke-runtime.mjs 의 expectedScripts 배열 같은 자리에
 *      "js/game-awaken-fx.js" 를 넣는다. 순서를 정확히 일치 검사하므로
 *      이 줄을 빠뜨리면 npm run smoke 가 떨어진다.
 *
 * 되돌리기 — 위 <script> 한 줄과 expectedScripts 항목만 지우면 원상복구된다.
 *
 * 이 파일이 하는 것 — 요청서 §6 의 결정 여섯.
 *   1. 다섯 박자 중 «깨어남»과 «정산» 둘에만 힘을 몬다. 굴러감·멈춤은 그대로 두고,
 *      명중은 이미 34px 을 갖고 있으므로 건드리지 않는다.
 *   2. 세기는 두 축이다 — 깨울 때는 «충돌 순간의 유성 속도»(그 프레임에 이미
 *      아는 유일한 값이다. 이동거리는 아직 0이다), 갚을 때는 «굴린 성적»
 *      (travel·collisions·wallHits, 정산 피해식 그대로).
 *   3. 깨어나는 순간 화면을 민다 — 흔들림 7→20px, 그리고 «밀린 방향으로»
 *      5→16px. 범퍼 8px 위, 강타 24px 아래. screenPushX/Y·screenTilt·
 *      screenGhost 는 저장소에 이미 있고 보스 포효만 쓰고 있던 것이다(§9).
 *      한 샷의 2·3번째 각성은 0.78·0.60배로 줄여 누적을 막는다.
 *   4. 굴러가는 동안은 각성한 별지기만 고유색 궤적을 남긴다. 윤슬의
 *      bladeStrength 와 같은 축(속도)이되 로스터 전체가 쓰는 어휘 하나다.
 *   5. 어휘를 시작·끝으로 나눈다. 「깨어남」은 굴러가기 시작한 순간,
 *      「각성」은 멈춘 자리에서 나가는 공격. 「공명 각성」은 「공명 깨어남」이 된다.
 *   6. 정산 리드 0.34초를 인원 표시에 쓴다. 깨어난 자리마다 조준 링이 동시에
 *      조여들고, 그 개수가 곧 인원이다.
 *
 * 정산을 컷인에서 «제자리»로 옮긴 이유(§5-1) — 지금 초점은 별지기를
 * W*0.27, H*0.77 로 옮겨 그린다. 플레이어가 «한 일»(때린 것)과 화면이
 * «반응한 곳»이 끝내 만나지 않는 것이 손맛이 없는 이유였다. 멈춘 자리에서
 * 쏘면 원인과 결과가 같은 좌표에 있고, 여러 명이 겹쳐도 누가 쏘는지 읽힌다.
 * 레터박스도 30px → 18px 로 줄인다. 1.3초에 최대 4발이 겹치는 구간에서
 * 판을 가릴 여유가 없다.
 *
 * 예산 — 그리는 값은 늘지 않는 쪽으로 짰다. 새 파티클 배열도, 새 DOM 갱신도,
 * 새 래스터도 없다. 캔버스 프리미티브와 이미 있는 *-attack.png 4프레임뿐이다
 * (§8: 초점이 떠 있는 프레임의 draw() 가 0.5ms 로 대기 상태와 같다).
 */
(function () {
  "use strict";

  /* ── 결정 2 · 세기 축 ────────────────────────────────────────────────
     발사 속도는 750 + force*975 (game-combat.js) 이라 750~1725 이고,
     범퍼·발판을 거치면 최대 1900 까지 간다. 별지기에 닿을 때쯤에는
     감쇠하므로 바닥을 420 으로 잡고 900 폭으로 편다. */
  const SPEED_FLOOR = 420,
    SPEED_SPAN = 900;

  /* ── 결정 3 · 눈금 ──────────────────────────────────────────────────
     impact() 의 현행 눈금: 접촉 4 · 보통 8 · 강타 24 · 정산 명중 34px. */
  const SHAKE_MIN = 7,
    SHAKE_MAX = 20,
    PUSH_MIN = 5,
    PUSH_MAX = 16,
    TILT_MAX = 0.0095,
    GHOST_MAX = 0.24,
    FLASH_MAX = 0.3,
    /* 히트스톱만 반입 뒤에 다시 잘랐다(0.02~0.052 → 0~0.018).

       `impactStop > 0`인 프레임은 update()가 아예 불리지 않는다 — 판이 실제로
       언다. 프레임 지표에는 안 보인다: rAF는 계속 4ms로 돌고 draw()도 0.8ms
       그대로다. 그래서 반입 검증을 통과했다.

       실측(probe-settle-cost.mjs, 각성을 프레임마다 흩어서). 유성은 별지기를
       차례로 때리므로 정지도 차례로 생긴다 — 같은 프레임에 몰아 재면
       Math.max로 하나가 되어 문제가 사라져 보인다:

         반입 전   비행 중 얼어 있던 시간  18ms, 구간 3개
         반입 후                        194ms, 구간 7개 (22~58ms)

       58ms는 60Hz에서 3.5프레임이고, 그것이 한 샷에 일곱 번이다. 게다가 하필
       «유성이 날아가는 동안»인데, 그 선을 읽는 것이 이 게임의 조작 그 자체다.
       각성은 문장의 끝이 아니라 중간이다 — 보스 타격처럼 시간을 멈춰 세울
       사건이 아니다.

       세션의 설계(밀림·기울기·잔상·흔들림)는 그대로 둔다. 그쪽은 시간을 멈추지
       않고도 「밀렸다」를 전한다. 한 프레임(0.018초)이면 충돌을 찍기에 충분하고,
       SOFTEN이 2·3번째를 14·11ms로 더 줄인다. */
    STOP_MIN = 0,
    STOP_MAX = 0.018,
    // 한 샷의 n번째 각성이 받는 배수. 매 샷 3회가 기본이 된 지금(§2)
    // 같은 세기를 세 번 주면 세 번째가 첫 번째를 못 이긴다.
    SOFTEN = [1, 0.78, 0.6];

  /* ── 결정 4 · 궤적 ──────────────────────────────────────────────────
     한 별지기가 들고 다니는 표본 수. 0.02초 간격 24개 = 0.48초. */
  const TRAIL_MAX = 24,
    TRAIL_STEP = 0.02;

  /* ── 결정 6 · 정산 ──────────────────────────────────────────────────*/
  const BAND = 18, // 레터박스 (현행 30)
    DIM = 0.62, // 판을 덮는 정도 (현행 0.78~0.92 + 전면 사선)
    FADE = 0.18; // 덮개가 서고 지는 시간

  let shotWakeCount = 0,
    settleFade = 0;
  const trails = new Map();

  function reduced() {
    return (
      typeof reducedMotionPreferred === "function" && reducedMotionPreferred()
    );
  }

  function collisionStrength() {
    const speed = Math.hypot(
      (typeof ball !== "undefined" && ball && ball.vx) || 0,
      (typeof ball !== "undefined" && ball && ball.vy) || 0,
    );
    return Math.max(0, Math.min(1, (speed - SPEED_FLOOR) / SPEED_SPAN));
  }

  /* 갚을 때의 세기. game-combat-physics.js 의 정산 피해식 그대로다 —
     연출이 읽는 값과 피해가 읽는 값이 다르면 그림이 거짓말을 한다. */
  function settleWeight(g) {
    return (
      14 +
      Math.min(22, Math.round((g.travel || 0) / 28)) +
      (g.collisions || 0) * 3 +
      (g.wallHits || 0) * 4 +
      (g.bossHit ? 11 : 0)
    );
  }

  /* ═══ 1. 깨어나는 순간 ═════════════════════════════════════════════ */

  const baseWakeUnit = wakeUnit;
  wakeUnit = function (g, options) {
    const wasAwake = g.awake;
    baseWakeUnit(g, options);
    // 잠금 가드에 막혔거나 이미 깨어 있던 프레임은 사건이 아니다.
    if (wasAwake || !g.awake) return;

    const subtle = !!(options && options.subtle),
      k = collisionStrength(),
      soft =
        SOFTEN[Math.min(SOFTEN.length - 1, shotWakeCount)] *
        (subtle ? 0.72 : 1),
      /* 정지는 한 샷에 한 번만. 나머지 어휘(흔들림·밀림·기울기·잔상)는 전부
         받되 시간을 멈추는 것만 첫 각성이 가진다.
         유성이 날아가는 동안 판이 서는 것은 다른 사건과 뜻이 다르다 — 그 선을
         읽는 것이 이 게임의 조작 자체라, 셋이 차례로 얼면 조작을 끊는다.
         실측에서 각성 셋이 비행 중 83ms를 얼렸다. */
      firstWake = shotWakeCount === 0;
    shotWakeCount++;

    // 밀린 방향 = 유성에서 별지기로 향하는 방향. §4-1 이 없다고 지적한 값이다.
    let dx = g.x - ((typeof ball !== "undefined" && ball && ball.x) || g.x),
      dy = g.y - ((typeof ball !== "undefined" && ball && ball.y) || g.y);
    const m = Math.hypot(dx, dy) || 1;
    dx /= m;
    dy /= m;

    g.wakeK = k;
    g.wakeDirX = dx;
    g.wakeDirY = dy;
    g.wakeSoft = soft;
    g.wakeFxT = 0;
    g.wakeSubtle = subtle;

    /* 확산 링이 세기를 읽는다. 지금은 g.r + 34 고정이라 잘 굴린 각성과 살짝
       밀린 각성이 완전히 같은 그림이었다(§5-2). 링 하나를 새로 만들지 않고
       baseWakeUnit 이 방금 밀어 넣은 것의 반지름만 고쳐 쓴다. */
    const burst = areaBursts[areaBursts.length - 1];
    if (burst && burst.x === g.x && burst.y === g.y) {
      burst.r = g.r + (subtle ? 10 : 20) + k * (subtle ? 26 : 58);
      burst.d = (subtle ? 0.26 : 0.44) + k * 0.1;
    }

    /* 결정 5 · 어휘. 「각성」은 정산 공격에만 남긴다. */
    const pop = popups[popups.length - 1];
    if (pop && typeof pop.text === "string") {
      if (pop.text.indexOf(" 공명 각성") >= 0)
        pop.text = pop.text.replace(" 공명 각성", " 공명 깨어남");
      else if (pop.text.indexOf(" 깨어남!") >= 0) pop.text = g.s + " 깨어남";
    }

    /* 화면 반응. 지금 0px 인 자리다(§4-1). impact() 를 부르지 않는 이유는
       그쪽이 feedbackBeat·combatSfx·연타 판정까지 함께 울리기 때문이다 —
       깨어남은 baseWakeUnit 이 이미 awaken 소리를 냈다. 건드리는 값은
       impact() 가 쓰는 것과 정확히 같은 여섯이다. */
    if (firstWake)
      impactStop = Math.max(
        impactStop || 0,
        (STOP_MIN + k * (STOP_MAX - STOP_MIN)) * soft,
      );
    screenShake = Math.max(
      screenShake || 0,
      (SHAKE_MIN + k * (SHAKE_MAX - SHAKE_MIN)) * soft,
    );
    screenFlash = Math.max(screenFlash || 0, FLASH_MAX * k * soft);
    if (!reduced()) {
      const push = (PUSH_MIN + k * (PUSH_MAX - PUSH_MIN)) * soft;
      screenPushX = dx * push;
      screenPushY = dy * push;
      const tilt = TILT_MAX * k * soft * (g.x < W / 2 ? -1 : 1);
      if (Math.abs(tilt) > Math.abs(screenTilt || 0)) screenTilt = tilt;
      screenGhost = Math.max(screenGhost || 0, GHOST_MAX * k * soft);
    }
    safeVibrate(Math.round(6 + k * 10));
  };

  registerRuntimeHook("afterShotStart", () => {
    shotWakeCount = 0;
    trails.clear();
  });

  /* ═══ 2. 시계와 궤적 표본 ══════════════════════════════════════════ */

  registerRuntimeHook("afterFeedbackUpdate", (d) => {
    if (typeof gates === "undefined" || !gates) return;
    for (const g of gates) {
      if (g.wakeFxT !== undefined && g.wakeFxT < 1) g.wakeFxT += d;
      if (!g.awake) {
        trails.delete(g.id);
        continue;
      }
      let rec = trails.get(g.id);
      if (!rec) {
        rec = { pts: [], acc: 0, px: g.x, py: g.y, speed: 0 };
        trails.set(g.id, rec);
      }
      const moved = Math.hypot(g.x - rec.px, g.y - rec.py);
      rec.speed = d > 0 ? moved / d : 0;
      rec.px = g.x;
      rec.py = g.y;
      rec.acc += d;
      if (rec.acc >= TRAIL_STEP) {
        rec.acc = 0;
        rec.pts.push({ x: g.x, y: g.y, s: rec.speed });
        if (rec.pts.length > TRAIL_MAX) rec.pts.shift();
      }
      if (rec.speed < 12 && rec.pts.length) rec.pts.shift();
    }
    // 정산 덮개는 살아 있는 피니셔 샷이 있는 동안만 서 있는다.
    let alive = false;
    if (typeof assistShots !== "undefined" && assistShots)
      for (const s of assistShots)
        if (s.finisher) {
          alive = true;
          break;
        }
    settleFade = Math.max(0, Math.min(1, settleFade + (alive ? d : -d) / FADE));
  });

  /* ═══ 3. 굴러가는 동안 — 결정 4 ════════════════════════════════════
     afterArenaDraw 라 별지기 토큰 «아래»에 깔린다. 궤적이 스프라이트를
     덮으면 누가 굴러가는지가 오히려 안 보인다. */

  registerRuntimeHook("afterArenaDraw", () => {
    if (!trails.size || reduced()) return;
    for (const g of gates) {
      const rec = trails.get(g.id);
      if (!rec || rec.pts.length < 2) continue;
      x.save();
      for (let i = 0; i < rec.pts.length; i++) {
        const p = rec.pts[i],
          fade = (i + 1) / rec.pts.length,
          size = p.s > 320 ? 9 : p.s > 150 ? 6 : 4;
        x.globalAlpha = Math.min(0.7, p.s / 380) * fade;
        x.fillStyle = g.col;
        x.fillRect(
          Math.round(p.x / 2) * 2 - size / 2,
          Math.round(p.y / 2) * 2 - size / 2,
          size,
          size,
        );
        // 속도가 붙은 구간에만 링이 남는다 — 윤슬의 bladeStrength 와 같은 축.
        if (i % 4 === 0 && p.s > 120) {
          x.globalAlpha = Math.min(0.45, p.s / 520) * fade;
          x.strokeStyle = g.col;
          x.lineWidth = 2;
          x.beginPath();
          x.arc(p.x, p.y, g.r + Math.min(24, p.s * 0.03), 0, Math.PI * 2);
          x.stroke();
        }
      }
      x.restore();
    }
  });

  /* ═══ 4. 깨어남의 방향 어휘 — 결정 3 ═══════════════════════════════
     afterDraw 라 game-combat.js 의 회전 점선 링 위에 얹힌다. */

  registerRuntimeHook("afterDraw", () => {
    if (typeof gates === "undefined" || !gates) return;
    for (const g of gates) {
      if (g.wakeFxT === undefined || g.wakeFxT >= 0.42) continue;
      const k = g.wakeK || 0,
        soft = g.wakeSoft || 1,
        dx = g.wakeDirX || 0,
        dy = g.wakeDirY || -1;

      // 밀린 쪽으로 나가는 쐐기. 「어느 쪽에서 와서 어느 쪽으로 밀었는가」다.
      const wq = Math.min(1, g.wakeFxT / 0.34);
      if (wq < 1) {
        const reach = (46 + k * 80) * wq * soft;
        x.save();
        x.globalAlpha = (1 - wq) * 0.9;
        x.translate(g.x, g.y);
        x.rotate(Math.atan2(dy, dx));
        x.strokeStyle = "#fff4dc";
        x.lineWidth = 2 + k * 2;
        x.beginPath();
        x.moveTo(reach * 0.35, -14 - k * 12);
        x.lineTo(reach, 0);
        x.lineTo(reach * 0.35, 14 + k * 12);
        x.stroke();
        // 반대편에는 맞은 면이 남는다.
        x.globalAlpha = (1 - wq) * 0.55;
        x.strokeStyle = g.col;
        x.lineWidth = 5 + k * 5;
        x.beginPath();
        x.arc(0, 0, g.r - 7 + reach * 0.5, -0.62, 0.62);
        x.stroke();
        x.restore();
      }

      // 접점 파편. 개수가 세기다 — 약 5개, 강 14개.
      const sq = Math.min(1, g.wakeFxT / 0.4);
      if (sq < 1) {
        const count = Math.round((5 + k * 9) * soft),
          base = Math.atan2(dy, dx);
        x.save();
        x.globalAlpha = 1 - sq;
        x.fillStyle = "#fff4dc";
        for (let i = 0; i < count; i++) {
          const a = base + (i / count - 0.5) * 1.5,
            r = g.r - 5 + sq * (60 + k * 90) * (0.6 + (i % 4) * 0.16),
            size = i % 3 === 0 ? 4 : 2;
          x.fillRect(
            Math.round(g.x + Math.cos(a) * r),
            Math.round(g.y + Math.sin(a) * r),
            size,
            size,
          );
        }
        x.restore();
      }
    }
  });

  /* ═══ 5. 정산 — 결정 1·2·6 ════════════════════════════════════════
     drawFinisherFocus 를 통째로 갈아 끼운다. 호출부(afterSpecialDraw 훅)는
     전역 이름으로 부르므로 재대입만으로 바뀐다. finisherFocus 자체는
     건드리지 않아 슬로모션(battle.slow)과 초점 진입 연출은 그대로다. */

  function drawSettleReticle(gate, q) {
    // 리드 0.34초. 지금은 아무것도 없는 대기다 — 여기에 인원을 넣는다.
    x.save();
    x.globalAlpha = q;
    x.strokeStyle = gate.col;
    x.lineWidth = 2;
    const r = 130 - q * 84;
    for (let c = 0; c < 4; c++) {
      const a = (c * Math.PI) / 2 + Math.PI / 4,
        cx = gate.x + Math.cos(a) * r,
        cy = gate.y + Math.sin(a) * r;
      x.beginPath();
      x.moveTo(cx - Math.cos(a) * 13, cy - Math.sin(a) * 13);
      x.lineTo(cx, cy);
      x.stroke();
    }
    x.globalAlpha = q * 0.85;
    x.lineWidth = 1;
    x.beginPath();
    x.arc(gate.x, gate.y, gate.r + 13 + (1 - q) * 40, 0, Math.PI * 2);
    x.stroke();
    x.restore();
  }

  function drawSettleBeam(gate, shot, weight) {
    const rel = Math.min(1, shot.t / shot.dur),
      // 굵기가 그 별지기의 성적이다. 17(최소)~59(최대) 사이를 4~30px 로 편다.
      thick = 4 + (weight - 17) * 0.62,
      reach = Math.min(1, Math.max(0, (rel - 0.16) / 0.5)),
      bx = gate.x + (boss.x - gate.x) * reach,
      by = gate.y + (boss.y - gate.y) * reach;
    x.save();
    x.globalAlpha = 0.22 + rel * 0.6;
    x.strokeStyle = gate.col;
    x.shadowBlur = combatFxBlur(20);
    x.shadowColor = gate.col;
    x.lineCap = "square";
    x.lineWidth = thick;
    x.beginPath();
    x.moveTo(gate.x, gate.y);
    x.lineTo(bx, by);
    x.stroke();
    x.globalAlpha = 0.5 + rel * 0.5;
    x.strokeStyle = "#fff6e6";
    x.lineWidth = Math.max(1, thick * 0.28);
    x.beginPath();
    x.moveTo(gate.x, gate.y);
    x.lineTo(bx, by);
    x.stroke();
    x.restore();

    if (reach >= 1) {
      const hq = Math.min(1, (rel - 0.66) / 0.3);
      x.save();
      x.globalAlpha = 1 - hq;
      x.strokeStyle = gate.col;
      x.shadowBlur = combatFxBlur(18);
      x.shadowColor = gate.col;
      x.lineWidth = 3;
      x.beginPath();
      x.arc(boss.x, boss.y, 26 + hq * (46 + thick * 3), 0, Math.PI * 2);
      x.stroke();
      x.textAlign = "center";
      x.font = "900 " + Math.round(17 + thick) + "px Galmuri11, ui-monospace";
      x.fillStyle = "#07100f";
      x.fillText(
        String(weight),
        boss.x + 46 + shot.finisherOrder * 6 + 2,
        boss.y - 54 - hq * 30 + 2,
      );
      x.fillStyle = gate.col;
      x.fillText(
        String(weight),
        boss.x + 46 + shot.finisherOrder * 6,
        boss.y - 54 - hq * 30,
      );
      x.restore();
    }

    // 이름은 «쏘는 자리»에 붙는다. 초점이 하나여도 겹친 발이 서로 구분된다.
    x.save();
    x.textAlign = "center";
    x.font = "900 15px Galmuri11, ui-monospace";
    x.fillStyle = "#07100f";
    x.fillText(gate.s + " 각성", gate.x + 2, gate.y + gate.r + 43);
    x.fillStyle = gate.col;
    x.fillText(gate.s + " 각성", gate.x, gate.y + gate.r + 41);
    x.font = "700 9px Galmuri11, ui-monospace";
    x.fillStyle = "#8ba39f";
    x.fillText(
      String(shot.finisherOrder + 1).padStart(2, "0"),
      gate.x,
      gate.y + gate.r + 57,
    );
    x.restore();
  }

  drawFinisherFocus = function () {
    if (!boss || settleFade <= 0.001) return;
    const shots = [];
    if (typeof assistShots !== "undefined" && assistShots)
      for (const s of assistShots) if (s.finisher) shots.push(s);
    if (!shots.length && settleFade <= 0.001) return;

    const fade = settleFade;
    x.save();
    x.globalAlpha = DIM * fade;
    x.fillStyle = "#040a0df2";
    x.fillRect(0, 0, W, H);
    x.globalAlpha = fade;
    x.fillStyle = "#02060a";
    x.fillRect(0, 0, W, BAND);
    x.fillRect(0, H - BAND, W, BAND);
    x.restore();

    let waiting = 0,
      firing = 0;
    for (const shot of shots) {
      const gate = gates.find((unit) => unit.id === shot.sourceId);
      if (!gate) continue;
      if (shot.delay > 0) {
        waiting++;
        drawSettleReticle(gate, 1 - Math.min(1, shot.delay / 0.34));
        continue;
      }
      firing++;
      if (!shot.__wokeAttack) {
        shot.__wokeAttack = true;
        if (typeof playUnitAttack === "function") playUnitAttack(gate);
      }
      drawSettleBeam(gate, shot, settleWeight(gate));
    }

    // 결정 6 · 인원수. 판 위쪽 한 줄, DOM 을 늘리지 않는다(§8).
    x.save();
    x.globalAlpha = fade;
    x.textAlign = "left";
    x.font = "700 10px Galmuri11, ui-monospace";
    x.fillStyle = "#7d9a97";
    x.fillText("STELLAR SETTLEMENT", 34, BAND + 28);
    x.font = "900 22px Galmuri11, ui-monospace";
    x.fillStyle = "#ffd2a0";
    x.fillText(waiting + firing + "인 일제 사격", 34, BAND + 54);
    for (let i = 0; i < waiting + firing; i++) {
      const shot = shots[i],
        gate = shot && gates.find((unit) => unit.id === shot.sourceId);
      x.fillStyle =
        shot && shot.delay <= 0 ? (gate ? gate.col : "#ffd2a0") : "#243438";
      x.fillRect(34 + i * 15, BAND + 64, 11, 5);
    }
    x.restore();

    // 초점이 잡힌 한 발만 능력 모티프를 얹는다. 겹쳐 그리면 판이 읽히지 않는다.
    if (finisherFocus) {
      const gate = gates.find((unit) => unit.id === finisherFocus.sourceId);
      if (
        gate &&
        finisherFocus.delay <= 0 &&
        typeof drawFinisherMotif === "function"
      )
        drawFinisherMotif(
          gate,
          gate.x,
          gate.y,
          Math.min(1, finisherFocus.t / finisherFocus.dur),
          fade * 0.8,
        );
    }
  };
})();
