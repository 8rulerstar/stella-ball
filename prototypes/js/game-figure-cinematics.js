/* Constellation cast cinematics — a PRESENTATION layer over game-figure.js.
 *
 * 반입 위치: prototypes/js/game-figure-cinematics.js
 * 로드 순서: js/game-figure.js «뒤», 같은 <script> 타일러에 한 줄 추가.
 *   <script src="./js/game-figure.js"></script>
 *   <script src="./js/game-figure-cinematics.js"></script>
 * scripts/smoke-runtime.mjs 의 expectedScripts 목록에도 같은 위치로 추가해야
 * smoke가 통과한다.
 *
 * 원칙: 판정·피해·부스트는 전부 기존 FIGURE_ABILITIES가 낸다. 이 파일은
 * 숫자를 만들지 않는다 — 캐스트 순간(FIGURE_CAST_AT)에 시작해 그 «위에»
 * 별자리별 시네마틱을 얹을 뿐이다. 능력 팝업·토스트·필드 버스트는 기존
 * 경로 그대로 나온다.
 *
 * 예외 하나: CINE.orionKnock — 오리온 처형 일격이 유성을 실제로 밀어낸다.
 * ball.moving 은 건드리지 않고(샷 수명주기·정산이 돌면 안 되므로) 좌표만
 * 이 파일이 직접 감쇠 반동으로 굴린다. 다음 샷의 티 위치가 바뀌는 실제
 * 게임플레이 변화이므로, 원치 않으면 false 로 끈다.
 */
const CINE = {
  enabled: true,
  /* 반입 시 false로 두었다. 이 파일에서 유일하게 게임플레이에 닿는 값이고,
     켜면 이 파일이 bot/runtime-harness.mjs의 runtimeFiles에 들어가야 한다 —
     그런데 이 파일은 Math.random을 20곳 넘게 쓰고, 하니스는 그 난수를 «한
     곳»(aimSigma)에서만 쓴다는 전제로 시드 재현성을 세워 두었다(BOT_REPORT
     0-3·0-7). 하니스에 넣는 순간 모든 밸런스 숫자가 무효가 된다.
     연출로만 쓰려면 false, 다음 샷 티 위치가 밀리는 것을 원하면 true로
     두되 그때는 위 문제를 함께 풀어야 한다. */
  orionKnock: false,
  partBudget: 140, // particles alive at once; cheap fillRect squares
  ringBudget: 24,
};
let cine = null; // { id, t, evts, ei, end, ...per-id state }
let cineFrameDelta = 1 / 60;
let cineParts = [],
  cineRings = [],
  cinePillars = [],
  cineFrags = [],
  cineKnock = null,
  cineDark = 0,
  cineWallPulse = 0;
registerRuntimeHook("afterBattleSetup", () => {
  cine = null;
  cineParts = [];
  cineRings = [];
  cinePillars = [];
  cineFrags = [];
  cineKnock = null;
  cineDark = 0;
  cineWallPulse = 0;
  // Silhouettes otherwise decode on the first cast, exactly when the screen is
  // already busiest. Battle setup gives all seven images several shots of lead.
  for (const tier of Object.values(FIGURE_SHAPES))
    for (const shape of tier) loadTexture(shape.art);
});
/* --- tiny fx helpers (mirror the game's ring/popup vocabulary) ----------- */
function cineRing(cx, cy, r0, r1, d, col, w = 3) {
  cineRings.push({ x: cx, y: cy, r0, r1, d, col, w, t: 0 });
  if (cineRings.length > CINE.ringBudget) cineRings.shift();
}
function cineBurst(cx, cy, col, n, sp, d, size = 3, grav = 120) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2,
      v = sp * (0.35 + Math.random() * 0.75);
    cineParts.push({
      x: cx,
      y: cy,
      vx: Math.cos(a) * v,
      vy: Math.sin(a) * v,
      grav,
      d: d * (0.6 + Math.random() * 0.7),
      t: 0,
      col,
      size,
    });
  }
  if (cineParts.length > CINE.partBudget)
    cineParts.splice(0, cineParts.length - CINE.partBudget);
}
function cinePart(p) {
  cineParts.push(p);
  if (cineParts.length > CINE.partBudget) cineParts.shift();
}
// Draw hooks can run at 60, 120 or 240 Hz. Convert the old 60-fps per-frame
// particle probabilities to a time-based chance so high-refresh monitors do
// not fill the particle budget several times faster than intended.
function cineChance(chanceAt60Fps) {
  return Math.random() < 1 - Math.pow(1 - chanceAt60Fps, cineFrameDelta * 60);
}
function compactCine(items) {
  let write = 0;
  for (let i = 0; i < items.length; i++)
    if (items[i].t < items[i].d) items[write++] = items[i];
  items.length = write;
}
function cinePillar(cx, cy, col) {
  cinePillars.push({ x: cx, y: cy, col, t: 0, d: 1.1 });
}
/* 6·7점 대격(2026-08-21 결정 2): 히트스톱 + 벽 살구 펄스. 표현만 — 숫자는
   그대로 FIGURE_ABILITIES가 낸다. impactStop/screenShake는 런타임의 시간·
   카메라 제어라 game-awaken-fx.js와 같은 정당한 쓰기 경로다. */
function cineTierHit() {
  impactStop = Math.max(impactStop, 0.14);
  cineWallPulse = 0.55;
}
const cineEase = (t) => {
  t = Math.max(0, Math.min(1, t));
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
};
/* 스켈레톤 별 s가 서 있는 실제 꼭짓점. fit.order[s] = drawn index. */
function cineStar(fx, s) {
  return fx.fit ? fx.fit.ideal[fx.fit.order[s]] : fx.ideal[s];
}
function cineOrigin(fx) {
  return fx.fit?.origin ?? figureCentroid(fx.ring);
}
/* --- per-constellation scripts ------------------------------------------- */
/* Each returns { end, evts:[{at,fn}] } with `at` seconds after the cast.
 * Impact moments add screenShake / screenFlash on top of what the ability
 * already did — Math.max keeps them from stacking. */
function cineScriptFor(fx) {
  const id = fx.shape.id,
    E = [],
    o = cineOrigin(fx);
  const bx = boss?.x ?? W / 2,
    by = boss?.y ?? H / 3;
  /* 1b(2026-08-21): at은 이제 «성립» 기준. 궤적(0~1.12s)이 조주가 되고,
     최대 임팩트는 CAST — 능력·숫자와 같은 프레임 — 에 떨어진다.
     조주는 CAST 앞, 여운은 CAST 뒤로만 쓴다. 총길이는 전부 짧아진다. */
  const CAST = FIGURE_CAST_AT;
  if (id === "aries") {
    E.push({
      at: CAST,
      fn: () => {
        screenFlash = Math.max(screenFlash, 0.32);
        screenShake = Math.max(screenShake, 16);
        cineRing(bx, by, 16, 190, 0.5, "#f2c56b");
        cineRing(bx, by, 10, 120, 0.4, "#fff6e6");
        cineBurst(bx, by, "#f2c56b", 26, 300, 0.8);
      },
    });
    return {
      end: CAST + 0.9,
      evts: E,
      ram: {
        from: { x: -140, y: Math.min(H - 120, by + 300) },
        t0: CAST - 0.82,
        t1: CAST,
      },
    };
  }
  if (id === "sagitta") {
    const from = cineStar(fx, 3),
      tip = cineStar(fx, 0),
      dx = tip.x - from.x,
      dy = tip.y - from.y,
      L = Math.hypot(dx, dy) || 1;
    const A = {
      from,
      tip,
      ux: dx / L,
      uy: dy / L,
      len: L,
      phase: 0,
      pt: 0,
      matDur: CAST - 0.45,
    };
    // 기존 관통 빔은 이 화살이 대신한다 — 같은 선을 두 번 긋지 않는다.
    // 빔은 캐스트 순간에야 생기므로 null 지우기는 아무것도 못 막았다.
    // 대체를 «선언»해 두면 생성 지점(piercingShot)이 긋기를 건너뛴다.
    fx.beamReplaced = true;
    E.push({
      at: CAST - 0.22,
      fn: () => {
        A.phase = 1;
        A.pt = 0;
        screenShake = Math.max(screenShake, 7);
      },
    });
    E.push({
      at: CAST,
      fn: () => {
        screenFlash = Math.max(screenFlash, 0.26);
        screenShake = Math.max(screenShake, 12);
        cineBurst(bx, by, "#ffd2a0", 18, 260, 0.6);
      },
    });
    E.push({
      at: CAST + 0.1,
      fn: () => {
        const wp = cineWall(A);
        cineRing(wp.x, wp.y, 8, 120, 0.45, "#ffd2a0");
        cineBurst(wp.x, wp.y, "#fff6e6", 14, 220, 0.55);
        screenShake = Math.max(screenShake, 10);
        A.phase = 2;
        A.pt = 0;
      },
    });
    return { end: CAST + 1.2, evts: E, arrow: A };
  }
  if (id === "corvus") {
    const st = { t: 0, dive: false, scatter: false };
    E.push({
      at: CAST - 0.27,
      fn: () => {
        st.dive = true;
        st.t = 0;
      },
    });
    E.push({
      at: CAST,
      fn: () => {
        screenFlash = Math.max(screenFlash, 0.2);
        screenShake = Math.max(screenShake, 8);
        st.scatter = true;
        st.t = 0;
        st.sigil = 0;
        cineBurst(bx, by - 20, "#2c3a44", 12, 160, 0.9, 2, 60);
      },
    });
    return { end: CAST + 1.0, evts: E, crows: st };
  }
  if (id === "cassiopeia") {
    const st = { bolt: -1 };
    for (let i = 0; i < 5; i++)
      E.push({
        at: 0.1 + i * 0.12,
        fn: () => {
          const p = cineWPoint(i);
          cineBurst(p.x, p.y, "#dff3ea", 6, 60, 0.5, 2, -20);
        },
      });
    E.push({
      at: CAST,
      fn: () => {
        st.bolt = 0;
        screenFlash = Math.max(screenFlash, 0.32);
        screenShake = Math.max(screenShake, 13);
        cineShieldFrags();
      },
    });
    E.push({
      at: CAST + 0.5,
      fn: () => cineRing(bx, by, 30, 150, 0.5, "#9adfc9", 2),
    });
    return { end: CAST + 0.9, evts: E, cass: st };
  }
  if (id === "cygnus") {
    const st = { ribbon: [] };
    E.push({
      at: CAST,
      fn: () => {
        if (!ball) return;
        screenShake = Math.max(screenShake, 6);
        cineRing(ball.x, ball.y, 8, 60, 0.5, "#7cc6bb", 2);
        cineRing(ball.x, ball.y, 6, 40, 0.4, "#fff6e6", 2);
      },
    });
    return { end: CAST + 1.5, evts: E, swan: st };
  }
  if (id === "pentagram") {
    E.push({
      at: CAST,
      fn: () => {
        cineRing(o.x, o.y, 30, 290, 0.6, "#ffe6b0");
      },
    });
    gates.forEach((g, i) =>
      E.push({
        at: CAST + 0.06 + i * 0.09,
        fn: () => cinePillar(g.x, g.y, g.col),
      }),
    );
    return { end: CAST + 1.1, evts: E, circle: true };
  }
  if (id === "orion") {
    const strike = (big) => () => {
      screenFlash = Math.max(screenFlash, big ? 0.55 : 0.24);
      screenShake = Math.max(screenShake, big ? 26 : 12);
      if (big) cineTierHit();
      cineRing(bx, by, 14, big ? 260 : 150, big ? 0.6 : 0.4, "#ffd2a0");
      if (big) {
        cineRing(bx, by, 20, 340, 0.8, "#fff6e6", 2);
        cineBurst(bx, by, "#ffd2a0", 40, 380, 0.9);
        cineBurst(bx, by + 40, "#8d97b8", 22, 240, 1.0, 3, 260);
        if (CINE.orionKnock && ball && !ball.moving && !battleComplete) {
          const dx = ball.x - bx,
            dy = ball.y - by,
            L = Math.hypot(dx, dy) || 1;
          cineKnock = { vx: (dx / L) * 920, vy: (dy / L) * 920 };
          addPopup(ball.x, ball.y - 34, "충격 반동!", "#fff1bd");
        }
      } else cineBurst(bx, by, "#ffd2a0", 14, 220, 0.5);
      if (boss) boss.hitFlash = Math.max(boss.hitFlash || 0, 0.3);
    };
    E.push({ at: CAST, fn: strike(true) });
    E.push({ at: CAST + 0.22, fn: strike(false) });
    E.push({ at: CAST + 0.44, fn: strike(false) });
    return { end: CAST + 1.5, evts: E, orion: true };
  }
  if (id === "bigdipper") {
    /* 2026-08-24 오너 지시로 다시 짰다. 앞서는 «별빛비» — 화면 위에서 줄기가
       쏟아지는 0.27초짜리 비였다. 두 가지가 아쉬웠다. 국자가 하늘에 떠
       있는데 비는 화면 밖에서 왔고(국자가 한 일이 아니었다), 7점짜리
       최상위 티어가 전체 3.0초로 6점보다 짧았다.

       이제 «국자가 은하수를 떠서 판에 붓는다». 국자가 기울고, 주둥이에서
       별빛 띠가 흘러나와 판 바닥에 고이고, 수면이 «수영장처럼» 차오른다.
       대격 뒤에는 다시 빠진다. 시간도 늘렸다: 3.0 -> 4.6초.

       판 «안»에서 끝나는 것이 중요하다. 처음에는 판 밖 계기판까지 CSS로
       적셨는데(body.dipper-pour), 오너 지적대로 그건 다른 이야기였다 —
       캔버스와 DOM 사이에 이음매가 생기고, 무엇보다 「고인다」가 아니라
       「번진다」로 읽혔다. 채우는 그릇은 전투 판 하나다.

       미완성으로 남긴 것: 수면의 물결과 띠의 결. 지금은 사인 두 겹과 자리
       인덱스로 만든 별 흩뿌림이라 «고인 별빛»으로 읽히기는 하지만, 흐름의
       질감은 디자인 세션 몫이다(ASSET_BACKLOG 항목). */
    const st = { polaris: -1, aim: -1, pour: -1, tip: -1 };
    E.push({ at: CAST - 1.15, fn: () => (st.tip = 0) });
    E.push({
      at: CAST - 0.62,
      fn: () => {
        st.pour = 0;
      },
    });
    E.push({
      at: CAST,
      fn: () => {
        cineTierHit();
        screenFlash = Math.max(screenFlash, 0.5);
        screenShake = Math.max(screenShake, 24);
        cineRing(bx, by, 20, 300, 0.6, "#ffd2a0");
        cineRing(bx, by, 14, 200, 0.45, "#fff6e6", 2);
        cineBurst(bx, by, "#ffd2a0", 36, 360, 0.85);
        if (boss) boss.hitFlash = Math.max(boss.hitFlash || 0, 0.3);
      },
    });
    E.push({
      at: CAST + 0.22,
      fn: () => {
        screenShake = Math.max(screenShake, 10);
        cineRing(bx, by, 12, 150, 0.4, "#ffd2a0");
        cineBurst(bx, by, "#ffd2a0", 14, 220, 0.5);
      },
    });
    E.push({
      at: CAST + 0.44,
      fn: () => {
        screenShake = Math.max(screenShake, 10);
        cineRing(bx, by, 12, 150, 0.4, "#ffd2a0");
        cineBurst(bx, by, "#fff1bd", 14, 220, 0.5);
      },
    });
    gates.forEach((g, i) =>
      E.push({
        at: CAST + 0.15 + i * 0.09,
        fn: () => cinePillar(g.x, g.y, g.col),
      }),
    );
    E.push({ at: CAST + 0.9, fn: () => (st.polaris = 0) });
    E.push({ at: CAST + 1.25, fn: () => (st.aim = 0) });
    // 못이 빠지기 시작하는 시각. 대격보다 한참 뒤라 «부은 것이 남아 있다»가
    // 읽히고, 그 뒤 1초에 걸쳐 수면이 내려간다.
    /* 은하수가 «다 퍼진 뒤»에 걷힌다. 처음에는 CAST+1.0 이었는데, 실측으로
       그때 퍼짐이 0.28 이라 다 퍼지기도 전에 사라지고 있었다 —
       붓기 시작(CAST-0.62) + 닿기 0.9 + 퍼짐 0.75 = CAST+1.03 이 완성 시각이다. */
    E.push({ at: CAST + 1.6, fn: () => (st.drain = 0) });
    return { end: CAST + 2.8, evts: E, dipper: st };
  }
  return null;
}
function cineWall(A) {
  const m = 39;
  let t = Infinity;
  const cand = [];
  if (A.ux > 0) cand.push((W - m - A.from.x) / A.ux);
  if (A.ux < 0) cand.push((m - A.from.x) / A.ux);
  if (A.uy > 0) cand.push((H - m - A.from.y) / A.uy);
  if (A.uy < 0) cand.push((m - A.from.y) / A.uy);
  for (const k of cand) if (k > 0 && k < t) t = k;
  return t < Infinity
    ? { x: A.from.x + A.ux * t, y: A.from.y + A.uy * t }
    : { x: A.from.x + A.ux * 1200, y: A.from.y + A.uy * 1200 };
}
function cineWPoint(i) {
  const p = FIGURE_SHAPES[5][0].raw[i]; // cassiopeia skeleton, sky-scaled
  return { x: W / 2 + p.x * 130, y: 128 + p.y * 60 };
}
function cineShieldFrags() {
  const bx = boss?.x ?? W / 2,
    by = boss?.y ?? H / 3;
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    cineFrags.push({
      x: bx + Math.cos(a) * 110,
      y: by + Math.sin(a) * 110,
      vx: Math.cos(a) * 260,
      vy: Math.sin(a) * 260 - 60,
      t: 0,
      d: 0.8,
      a: Math.random() * 3,
    });
  }
}
/* --- clock ---------------------------------------------------------------- */
registerRuntimeHook("afterFeedbackUpdate", function advanceCine(d) {
  cineFrameDelta = Math.min(0.05, Math.max(0, d));
  if (!CINE.enabled) return;
  // Start when the reveal's own clock crosses the cast beat.
  // 1b: 성립 즉시 시작해 궤적 구간을 조주로 쓴다(임팩트는 CAST에 정렬).
  if (
    figureFx &&
    figureFx.battle === battle &&
    figureFx.shape &&
    !figureFx.cineStarted &&
    figureFx.t >= 0 &&
    !battleComplete
  ) {
    figureFx.cineStarted = true;
    const script = cineScriptFor(figureFx);
    if (script) {
      script.evts.sort((a, b) => a.at - b.at);
      cine = { id: figureFx.shape.id, fx: figureFx, t: 0, ei: 0, ...script };
    }
  }
  if (cine) {
    cine.t += d;
    while (cine.ei < cine.evts.length && cine.evts[cine.ei].at <= cine.t)
      cine.evts[cine.ei++].fn();
    if (cine.t >= cine.end) cine = null;
  }
  for (const r of cineRings) r.t += d;
  compactCine(cineRings);
  for (const p of cineParts) {
    p.t += d;
    p.vy += p.grav * d;
    p.x += p.vx * d;
    p.y += p.vy * d;
  }
  compactCine(cineParts);
  for (const p of cinePillars) p.t += d;
  compactCine(cinePillars);
  for (const f of cineFrags) {
    f.t += d;
    f.x += f.vx * d;
    f.y += f.vy * d;
    f.vy += 300 * d;
    f.a += d * 6;
  }
  compactCine(cineFrags);
  // orion vignette — 1b: 대격(CAST) 0.5초 뒤부터 걷는다.
  if (cine && cine.orion) {
    const s = cine.t;
    cineDark =
      s < 0.5
        ? (s / 0.5) * 0.45
        : s > FIGURE_CAST_AT + 0.5
          ? Math.max(0, 0.45 * (1 - (s - FIGURE_CAST_AT - 0.5) / 1.0))
          : 0.45;
  } else cineDark = Math.max(0, cineDark - d * 1.4);
  cineWallPulse = Math.max(0, cineWallPulse - d);
  if (cine?.arrow) cine.arrow.pt += d;
  if (cine?.crows) {
    cine.crows.t += d;
    if (cine.crows.sigil != null) cine.crows.sigil += d;
  }
  if (cine?.cass && cine.cass.bolt >= 0) cine.cass.bolt += d;
  if (cine?.dipper) {
    if (cine.dipper.polaris >= 0) cine.dipper.polaris += d;
    if (cine.dipper.aim >= 0) cine.dipper.aim += d;
    if (cine.dipper.tip >= 0) cine.dipper.tip += d;
    if (cine.dipper.pour >= 0) cine.dipper.pour += d;
    if (cine.dipper.drain >= 0) cine.dipper.drain += d;
  }
  // orion meteor knock — 좌표만 굴린다. moving 을 켜면 샷 수명주기가 돌므로 금지.
  if (cineKnock && ball && !ball.moving) {
    const m = 26 + ball.r;
    ball.x += cineKnock.vx * d;
    ball.y += cineKnock.vy * d;
    if (ball.x < m) {
      ball.x = m;
      cineKnock.vx *= -0.6;
      screenShake = Math.max(screenShake, 5);
    }
    if (ball.x > W - m) {
      ball.x = W - m;
      cineKnock.vx *= -0.6;
      screenShake = Math.max(screenShake, 5);
    }
    if (ball.y < m) {
      ball.y = m;
      cineKnock.vy *= -0.6;
      screenShake = Math.max(screenShake, 5);
    }
    if (ball.y > H - m) {
      ball.y = H - m;
      cineKnock.vy *= -0.6;
      screenShake = Math.max(screenShake, 5);
    }
    const sp = Math.hypot(cineKnock.vx, cineKnock.vy),
      dec = 420 * d;
    if (sp <= dec + 40) cineKnock = null;
    else {
      cineKnock.vx -= (cineKnock.vx / sp) * dec;
      cineKnock.vy -= (cineKnock.vy / sp) * dec;
    }
  } else if (cineKnock && ball?.moving) cineKnock = null;
});
/* --- drawing --------------------------------------------------------------
 * Registered after game-figure.js's hooks, so this layer paints over the
 * corrected figure and under nothing that matters. */
registerRuntimeHook("afterDraw", function drawCine() {
  if (!CINE.enabled) return;
  const t = cine?.t ?? 0;
  if (cine?.circle) drawCineMagicCircle(t, cineOrigin(cine.fx));
  if (cine?.ram) drawCineRam(t);
  if (cine?.arrow) drawCineArrow(cine.arrow);
  if (cine?.crows) drawCineCrows(cine.crows, t);
  if (cine?.cass) drawCineCass(cine.cass, t);
  if (cine?.swan) drawCineSwan(cine.swan, t);
  if (cine?.orion) drawCineOrion(t);
  if (cine?.dipper) drawCineDipper(cine.dipper, t);
  for (const p of cinePillars) {
    const k = p.t / p.d,
      up = Math.min(1, k * 3),
      fade = 1 - Math.max(0, (k - 0.55) / 0.45),
      hgt = 300 * up;
    const gr = x.createLinearGradient(0, p.y, 0, p.y - hgt);
    gr.addColorStop(0, p.col + "cc");
    gr.addColorStop(1, p.col + "00");
    x.save();
    x.globalAlpha = 0.75 * fade;
    x.fillStyle = gr;
    x.fillRect(p.x - 14, p.y - hgt, 28, hgt);
    x.globalAlpha = 0.9 * fade;
    x.fillStyle = "#ffffffaa";
    x.fillRect(p.x - 3, p.y - hgt, 6, hgt);
    x.restore();
  }
  for (const r of cineRings) {
    const k = r.t / r.d;
    x.save();
    x.globalAlpha = 1 - k;
    x.strokeStyle = r.col;
    x.shadowBlur = combatFxBlur(16);
    x.shadowColor = r.col;
    x.lineWidth = r.w;
    x.beginPath();
    x.arc(r.x, r.y, r.r0 + (r.r1 - r.r0) * k, 0, Math.PI * 2);
    x.stroke();
    x.restore();
  }
  for (const p of cineParts) {
    x.save();
    x.globalAlpha = Math.max(0, 1 - p.t / p.d);
    x.fillStyle = p.col;
    x.fillRect(
      Math.round(p.x / 2) * 2,
      Math.round(p.y / 2) * 2,
      p.size,
      p.size,
    );
    x.restore();
  }
  for (const f of cineFrags) {
    x.save();
    x.globalAlpha = 1 - f.t / f.d;
    x.translate(f.x, f.y);
    x.rotate(f.a);
    x.strokeStyle = "#9adfc9";
    x.lineWidth = 3;
    x.beginPath();
    x.arc(0, 0, 12, 0, 0.9);
    x.stroke();
    x.restore();
  }
  if (cineDark > 0) {
    const v = x.createRadialGradient(
      W / 2,
      H * 0.42,
      120,
      W / 2,
      H * 0.42,
      H * 0.75,
    );
    v.addColorStop(0, "rgba(2,3,11,0)");
    v.addColorStop(1, "rgba(2,3,11," + (cineDark * 1.6).toFixed(2) + ")");
    x.fillStyle = v;
    x.fillRect(0, 0, W, H);
    x.fillStyle = "rgba(2,3,11," + cineDark.toFixed(2) + ")";
    x.fillRect(0, 0, W, H);
  }
  if (cineWallPulse > 0) {
    /* 결정 2: 6·7점 대격의 판 반응 — 벽 프레임 살구 펄스 한 번. */
    x.save();
    x.globalAlpha = cineWallPulse * 1.45;
    x.strokeStyle = "#ffd2a0";
    x.lineWidth = 8;
    x.strokeRect(21, 21, W - 42, H - 42);
    x.restore();
  }
});
function drawCineRam(s) {
  const img = textures[FIGURE_SHAPES[3][0].art],
    bx = boss?.x ?? W / 2,
    by = boss?.y ?? H / 3,
    from = cine.ram.from;
  const t0 = cine.ram.t0 ?? 0.15,
    t1 = cine.ram.t1 ?? 0.72;
  if (s < t0 || !img?.complete || !img.naturalWidth) return;
  const k = Math.min(1, (s - t0) / (t1 - t0));
  const px = from.x + (bx + 40 - from.x) * k,
    py = from.y + (by + 10 - from.y) * (k * k * (3 - 2 * k));
  if (s >= t1 + 0.5) return;
  const fade = s > t1 ? 1 - (s - t1) / 0.5 : 1;
  x.save();
  x.shadowBlur = combatFxBlur(30);
  x.shadowColor = "#f2c56b";
  for (let i = 2; i >= 0; i--) {
    x.globalAlpha = (i ? 0.18 : 0.9) * fade;
    const gx = px - i * 46 * (1 - k * 0.3);
    x.drawImage(
      img,
      gx - 130,
      py - 130 - Math.abs(Math.sin(k * 9)) * 14,
      260,
      260,
    );
  }
  x.restore();
  if (k < 1 && cineChance(0.7)) {
    cinePart({
      x: px - 60,
      y: py + 70,
      vx: -80 - Math.random() * 90,
      vy: -30 + Math.random() * 60,
      grav: 90,
      d: 0.5,
      t: 0,
      col: "#f2c56b",
      size: 3,
    });
    if (Math.random() < 0.3)
      cineRing(px - 40, py + 78, 4, 34, 0.35, "#f2c56b88", 2);
  }
}
function drawCineArrow(A) {
  const drawArrow = (cx, cy, alpha, scaleUp = 1) => {
    const L = A.len * 0.75 * scaleUp;
    x.save();
    x.translate(cx, cy);
    x.rotate(Math.atan2(A.uy, A.ux));
    x.globalAlpha = alpha;
    x.shadowBlur = combatFxBlur(22);
    x.shadowColor = "#ffd2a0";
    x.strokeStyle = "#fff6e6";
    x.lineWidth = 6;
    x.lineCap = "round";
    x.beginPath();
    x.moveTo(-L / 2, 0);
    x.lineTo(L / 2, 0);
    x.stroke();
    x.strokeStyle = "#ffd2a0";
    x.lineWidth = 3;
    x.beginPath();
    x.moveTo(L / 2, 0);
    x.lineTo(L / 2 - 34, -20);
    x.moveTo(L / 2, 0);
    x.lineTo(L / 2 - 34, 20);
    x.stroke();
    x.beginPath();
    x.moveTo(-L / 2, 0);
    x.lineTo(-L / 2 - 22, -14);
    x.moveTo(-L / 2, 0);
    x.lineTo(-L / 2 - 22, 14);
    x.moveTo(-L / 2 + 16, 0);
    x.lineTo(-L / 2 - 6, -14);
    x.moveTo(-L / 2 + 16, 0);
    x.lineTo(-L / 2 - 6, 14);
    x.stroke();
    x.restore();
  };
  const s = cine.t,
    mx = (A.from.x + A.tip.x) / 2,
    my = (A.from.y + A.tip.y) / 2;
  if (A.phase === 0) {
    const matDur = A.matDur ?? 0.55;
    const mat = Math.min(1, s / matDur),
      pull = s > matDur ? Math.min(1, (s - matDur) / 0.23) * 30 : 0;
    if (mat < 1 && cineChance(0.8)) {
      const an = Math.random() * Math.PI * 2,
        r = 90 + Math.random() * 60;
      cinePart({
        x: mx + Math.cos(an) * r,
        y: my + Math.sin(an) * r,
        vx: -Math.cos(an) * 180,
        vy: -Math.sin(an) * 180,
        grav: 0,
        d: 0.4,
        t: 0,
        col: "#ffd2a0",
        size: 2,
      });
    }
    drawArrow(mx - A.ux * pull, my - A.uy * pull, mat * 0.95, 0.9 + mat * 0.1);
  } else if (A.phase === 1) {
    const k = Math.min(1, A.pt / 0.2),
      wp = cineWall(A),
      cx = mx + (wp.x - mx) * k,
      cy = my + (wp.y - my) * k;
    x.save();
    x.globalAlpha = 0.55;
    x.strokeStyle = "#ffd2a0";
    x.shadowBlur = combatFxBlur(18);
    x.shadowColor = "#ffd2a0";
    x.lineWidth = 5;
    x.beginPath();
    x.moveTo(A.from.x, A.from.y);
    x.lineTo(cx, cy);
    x.stroke();
    x.restore();
    drawArrow(cx, cy, 1);
  } else {
    const wp = cineWall(A),
      // 종료가 CAST+1.2로 당겨졌다(잔광 창 1.1초). 1.4로 나누면 21%에서
      // 뚝 끊긴다 — 창 안에서 0까지 내려가게 맞춘다.
      life = Math.max(0, 1 - A.pt / 1.05);
    x.save();
    x.globalAlpha = 0.35 * life;
    x.strokeStyle = "#ffd2a0";
    x.lineWidth = 3;
    x.shadowBlur = combatFxBlur(12);
    x.shadowColor = "#ffd2a0";
    x.beginPath();
    x.moveTo(A.from.x, A.from.y);
    x.lineTo(wp.x, wp.y);
    x.stroke();
    x.restore();
    drawArrow(wp.x - A.ux * A.len * 0.28, wp.y - A.uy * A.len * 0.28, life);
  }
}
function drawCineCrows(cr, s) {
  const bx = boss?.x ?? W / 2,
    by = boss?.y ?? H / 3,
    now = frameClock / 1000;
  const drawCrow = (px, py, ang, sc = 1, al = 1) => {
    x.save();
    x.translate(px, py);
    x.rotate(ang);
    x.globalAlpha = al;
    x.fillStyle = "#232d3a";
    x.strokeStyle = "#7cc6bb";
    x.lineWidth = 1.5;
    x.shadowBlur = combatFxBlur(8);
    x.shadowColor = "#47837c";
    const flap = Math.sin(now * 16 + px) * 8 * sc;
    x.beginPath();
    x.moveTo(10 * sc, 0);
    x.lineTo(-6 * sc, -4 * sc);
    x.lineTo(-10 * sc, 0);
    x.lineTo(-6 * sc, 4 * sc);
    x.closePath();
    x.fill();
    x.stroke();
    x.beginPath();
    x.moveTo(0, 0);
    x.lineTo(-8 * sc, -10 * sc - flap);
    x.moveTo(0, 0);
    x.lineTo(-8 * sc, 10 * sc + flap);
    x.stroke();
    x.restore();
  };
  for (let i = 0; i < 6; i++) {
    let px,
      py,
      ang,
      al = 1;
    const phase = i * 1.05;
    if (cr.scatter) {
      const k = Math.min(1, cr.t / 0.8);
      al = 1 - k;
      if (al <= 0) continue;
      const an0 = now * 1.2 + phase;
      px = bx + Math.cos(an0) * (80 + k * 420);
      py = by + Math.sin(an0) * (60 + k * 320) - k * 120;
      ang = an0 + Math.PI / 2;
    } else if (cr.dive && i === 0) {
      const k = Math.min(1, cr.t / 0.27),
        sx = bx + Math.cos(phase) * 90,
        sy = by - 80;
      px = sx + (bx - sx) * k;
      py = sy + (by - 20 - sy) * k * k;
      ang = Math.atan2(by - 20 - sy, bx - sx);
    } else {
      const enter = Math.min(1, s / 0.5),
        orbT = Math.max(0, s - 0.5),
        r = 190 - Math.min(1, orbT / 1.1) * 110,
        an0 = phase + orbT * 4.2;
      const ox = bx + Math.cos(an0) * r * 1.15,
        oy = by + Math.sin(an0) * r * 0.62 - 20;
      const fx0 = i % 2 ? -60 : W + 60,
        fy = -40 + i * 22;
      px = fx0 + (ox - fx0) * cineEase(enter);
      py = fy + (oy - fy) * cineEase(enter);
      ang = an0 + Math.PI / 2;
    }
    drawCrow(px, py, ang, i === 0 ? 1.3 : 1, al);
  }
  if (cr.sigil != null) {
    const k = Math.min(1, cr.sigil / 0.25),
      br = 0.65 + 0.35 * Math.sin(now * 4);
    x.save();
    x.translate(bx, by - 18);
    x.scale(k, k);
    x.globalAlpha = 0.9 * br;
    x.strokeStyle = "#ffd2a0";
    x.shadowBlur = combatFxBlur(14);
    x.shadowColor = "#ffd2a0";
    x.lineWidth = 2.5;
    x.beginPath();
    x.arc(0, 0, 30, 0, Math.PI * 2);
    x.stroke();
    x.setLineDash([5, 7]);
    x.globalAlpha = 0.5 * br;
    x.beginPath();
    x.arc(0, 0, 42, now, now + Math.PI * 2);
    x.stroke();
    x.setLineDash([]);
    x.globalAlpha = br;
    x.lineWidth = 3;
    for (let i = 0; i < 4; i++) {
      const an = (i * Math.PI) / 2 + Math.PI / 4;
      x.beginPath();
      x.moveTo(Math.cos(an) * 22, Math.sin(an) * 22);
      x.lineTo(Math.cos(an) * 12, Math.sin(an) * 12);
      x.stroke();
    }
    x.fillStyle = "#fff1bd";
    x.beginPath();
    x.arc(0, 0, 4, 0, Math.PI * 2);
    x.fill();
    x.restore();
  }
}
function drawCineCass(st, s) {
  const bx = boss?.x ?? W / 2,
    by = boss?.y ?? H / 3,
    now = frameClock / 1000;
  const pts = [0, 1, 2, 3, 4].map(cineWPoint);
  const grow = Math.min(1, s / 0.6),
    segs = 4 * grow;
  x.save();
  x.strokeStyle = "#dff3ea";
  x.shadowBlur = combatFxBlur(18);
  x.shadowColor = "#9adfc9";
  x.lineCap = "round";
  const surge = s > 0.6 ? 0.7 + 0.3 * Math.sin(now * 18) : 0.8;
  x.lineWidth = s > 0.6 ? 5 : 3;
  // 종료 CAST+0.9 안에서 0에 닿아야 한다. 0.8로 나누면 25%에서 팝아웃.
  x.globalAlpha = surge * Math.max(0, 1 - (s - (FIGURE_CAST_AT + 0.3)) / 0.55);
  x.beginPath();
  for (let i = 0; i < 4; i++) {
    const span = Math.max(0, Math.min(1, segs - i));
    if (span <= 0) break;
    x.moveTo(pts[i].x, pts[i].y);
    x.lineTo(
      pts[i].x + (pts[i + 1].x - pts[i].x) * span,
      pts[i].y + (pts[i + 1].y - pts[i].y) * span,
    );
  }
  x.stroke();
  for (let i = 0; i < 5; i++) {
    if (grow * 5 < i) break;
    x.fillStyle = "#fff6e6";
    x.shadowBlur = combatFxBlur(12);
    x.beginPath();
    x.arc(pts[i].x, pts[i].y, 5, 0, Math.PI * 2);
    x.fill();
  }
  x.restore();
  if (st.bolt >= 0 && st.bolt < 0.45) {
    const life = 1 - st.bolt / 0.45;
    x.save();
    x.globalAlpha = Math.max(0, life);
    x.strokeStyle = "#eafff7";
    x.shadowBlur = combatFxBlur(26);
    x.shadowColor = "#9adfc9";
    x.lineWidth = 5;
    x.lineCap = "round";
    const zig = [
      [bx - 30, 240],
      [bx + 36, 310],
      [bx - 22, 380],
      [bx + 12, 440],
      [bx, by - 40],
    ];
    x.beginPath();
    x.moveTo(pts[2].x, pts[2].y);
    for (const [zx, zy] of zig) x.lineTo(zx + (Math.random() - 0.5) * 6, zy);
    x.stroke();
    x.lineWidth = 2;
    x.strokeStyle = "#9adfc9";
    x.globalAlpha = Math.max(0, life * 0.7);
    x.beginPath();
    x.moveTo(pts[2].x + 8, pts[2].y);
    for (const [zx, zy] of zig)
      x.lineTo(zx + 10 + (Math.random() - 0.5) * 8, zy + 4);
    x.stroke();
    x.restore();
  }
}
function drawCineSwan(st, s) {
  const img = textures[FIGURE_SHAPES[5][1].art],
    now = frameClock / 1000;
  const k = Math.min(1, s / 2.2);
  const bez = (t, a, b, c, dd) => {
    const u = 1 - t;
    return (
      u * u * u * a + 3 * u * u * t * b + 3 * u * t * t * c + t * t * t * dd
    );
  };
  const px = bez(k, 70, 240, 430, W - 50),
    py = bez(k, H - 70, 560, 420, 120);
  if (k < 1) {
    st.ribbon.push({ x: px, y: py + 20 });
    if (st.ribbon.length > 70) st.ribbon.shift();
  }
  if (st.ribbon.length > 2) {
    x.save();
    x.lineCap = "round";
    for (let L = 0; L < 2; L++) {
      x.beginPath();
      st.ribbon.forEach((p, i) => {
        const off = Math.sin(i * 0.4 + now * 3 + L * 2) * (6 + L * 8);
        if (i === 0) x.moveTo(p.x + off, p.y + off * 0.4);
        else x.lineTo(p.x + off, p.y + off * 0.4);
      });
      x.strokeStyle = L ? "#7cc6bb" : "#9adfc9";
      x.globalAlpha =
        (L ? 0.18 : 0.3) *
        Math.max(0, 1 - Math.max(0, s - (cine.end - 1.0)) / 1.0);
      x.lineWidth = L ? 16 : 7;
      x.shadowBlur = combatFxBlur(18);
      x.shadowColor = "#7cc6bb";
      x.stroke();
    }
    x.restore();
  }
  if (k < 1 && img?.complete && img.naturalWidth) {
    const flap = 1 + 0.1 * Math.sin(s * 9),
      fade = k > 0.92 ? (1 - k) / 0.08 : 1;
    x.save();
    x.globalAlpha = 0.95 * fade;
    x.shadowBlur = combatFxBlur(24);
    x.shadowColor = "#bfe9ff";
    const size = 210 * flap;
    x.drawImage(
      img,
      px - size / 2,
      py - size / 2 - 10 * Math.sin(s * 9),
      size,
      size,
    );
    x.restore();
    if (cineChance(0.6))
      cinePart({
        x: px - 30,
        y: py + 30,
        vx: -40 + Math.random() * 30,
        vy: 20 + Math.random() * 40,
        grav: 26,
        d: 1.2,
        t: 0,
        col: Math.random() < 0.5 ? "#dff3ea" : "#9adfc9",
        size: 2,
      });
  }
}
function drawCineMagicCircle(t, o) {
  const now = frameClock / 1000;
  const ins = Math.min(1, t / 0.7),
    dim =
      t > FIGURE_CAST_AT + 0.7
        ? Math.max(0.25, 1 - (t - FIGURE_CAST_AT - 0.7) / 1.2)
        : 1,
    ignite = t > 0.8 ? 1 + 0.15 * Math.sin(now * 6) : 0.8;
  x.save();
  x.translate(o.x, o.y);
  x.scale(1, 0.62);
  x.strokeStyle = "#ffcf8a";
  x.shadowBlur = combatFxBlur(20);
  x.shadowColor = "#ffcf8a";
  x.globalAlpha = 0.65 * dim * ignite;
  x.lineWidth = 4;
  x.beginPath();
  x.arc(0, 0, 262, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * ins);
  x.stroke();
  x.lineWidth = 1.5;
  x.globalAlpha = 0.4 * dim;
  x.beginPath();
  x.arc(0, 0, 238, 0, Math.PI * 2 * ins);
  x.stroke();
  if (ins >= 1) {
    const pts = [0, 1, 2, 3, 4].map((i) => {
      const an = -Math.PI / 2 + (i * Math.PI * 2) / 5;
      return [Math.cos(an) * 250, Math.sin(an) * 250];
    });
    x.globalAlpha = 0.55 * dim * ignite;
    x.lineWidth = 3;
    x.beginPath();
    for (const [i, j] of [
      [0, 2],
      [2, 4],
      [4, 1],
      [1, 3],
      [3, 0],
    ]) {
      x.moveTo(pts[i][0], pts[i][1]);
      x.lineTo(pts[j][0], pts[j][1]);
    }
    x.stroke();
    for (let i = 0; i < 8; i++) {
      const an = now * 0.8 + (i * Math.PI) / 4;
      x.save();
      x.translate(Math.cos(an) * 276, Math.sin(an) * 276);
      x.rotate(an);
      x.globalAlpha = 0.7 * dim;
      x.fillStyle = "#ffe6b0";
      x.fillRect(-4, -4, 8, 8);
      x.restore();
    }
    if (t > 1.0 && t < 2.4 && cineChance(0.5)) {
      const an = Math.random() * Math.PI * 2,
        r = Math.random() * 250;
      cinePart({
        x: o.x + Math.cos(an) * r,
        y: o.y + Math.sin(an) * r * 0.62,
        vx: 0,
        vy: -60 - Math.random() * 60,
        grav: -20,
        d: 1.0,
        t: 0,
        col: "#ffcf8a",
        size: 2,
      });
    }
  }
  x.restore();
}
function drawCineOrion(s) {
  const img = textures[FIGURE_SHAPES[6][0].art];
  for (let i = 0; i < 3; i++) {
    const at = 0.15 + i * 0.15;
    if (s > at && s < at + 0.4) {
      const k = (s - at) / 0.4;
      x.save();
      x.globalAlpha = 1 - k;
      x.fillStyle = "#fff6e6";
      x.shadowBlur = combatFxBlur(20);
      x.shadowColor = "#ffd2a0";
      x.beginPath();
      x.arc(W / 2 - 80 + i * 60, 110 + i * 12, 6 + k * 8, 0, Math.PI * 2);
      x.fill();
      x.restore();
    }
  }
  const rise = cineEase((s - 0.1) / 0.6);
  if (rise <= 0 || !img?.complete || !img.naturalWidth) return;
  const dissolve =
    s > FIGURE_CAST_AT + 0.6
      ? Math.min(1, (s - FIGURE_CAST_AT - 0.6) / 1.0)
      : 0;
  const cy = -120 + rise * 290;
  let strikeOff = 0,
    rot = 0,
    scl = 1;
  const sk = (at, big) => {
    if (s > at - 0.14 && s < at + 0.3) {
      const k = (s - (at - 0.14)) / 0.44;
      if (k < 0.32) {
        rot = -0.16 * (k / 0.32);
        scl = 1 + (big ? 0.1 : 0.04) * (k / 0.32);
      } else {
        const j = (k - 0.32) / 0.68;
        strikeOff = Math.sin(Math.min(1, j * 2.2) * Math.PI) * (big ? 66 : 34);
        rot = 0.12 * (1 - j);
      }
    }
  };
  sk(FIGURE_CAST_AT, true);
  sk(FIGURE_CAST_AT + 0.22, false);
  sk(FIGURE_CAST_AT + 0.44, false);
  if (s > FIGURE_CAST_AT - 0.28 && s < FIGURE_CAST_AT) {
    const w = (s - (FIGURE_CAST_AT - 0.28)) / 0.28;
    scl = 1 + w * 0.12;
    rot = -0.2 * w;
  }
  x.save();
  x.globalAlpha = Math.min(0.92, rise) * (1 - dissolve);
  x.translate(W / 2, cy + strikeOff);
  x.rotate(rot);
  x.scale(scl, scl);
  x.shadowBlur = combatFxBlur(40);
  x.shadowColor = "#ffd2a0";
  x.globalCompositeOperation = "lighter";
  x.globalAlpha *= 0.35;
  x.drawImage(img, -270, -270, 540, 540);
  x.globalCompositeOperation = "source-over";
  x.globalAlpha = Math.min(0.92, rise) * (1 - dissolve);
  x.drawImage(img, -260, -260, 520, 520);
  x.restore();
  if (dissolve > 0 && cineChance(0.8))
    cinePart({
      x: W / 2 + (Math.random() - 0.5) * 380,
      y: cy + (Math.random() - 0.5) * 380,
      vx: 0,
      vy: -120,
      grav: -40,
      d: 1.0,
      t: 0,
      col: "#ffd2a0",
      size: 3,
    });
}
/* 국자가 붓는 은하수. 주둥이에서 판 아래로 흐르는 별빛 띠 하나다.

   판 «안»에서만 산다. 띠는 바닥에 닿고 그 아래로 고인다(drawDipperPool) —
   채우는 그릇이 전투 판 하나라는 것이 이 연출의 전부다.

   난수를 쓰지 않는다. 별 하나하나의 흔들림을 자리 인덱스의 사인으로 정해,
   같은 별이 매 프레임 같은 자리에 있다 — 그래야 «흐르는 띠»로 보이고
   «지지직거리는 잡음»으로 안 보인다. */
/* 판 바닥에 «얕게 퍼지는» 은하수.

   앞서는 수영장이었다 — 수면이 화면 아래에서 위로 차올랐다. 오너 지적대로
   그건 측면도의 은유다. 이 판은 탑다운이라 화면의 세로축이 «높이»가 아니라
   «깊이»이고, 바닥에 부은 것은 위로 쌓이는 게 아니라 옆으로 번져야 한다.

   그래서 떨어진 자리에서 «타원»으로 퍼진다. 세로를 0.42배로 눌러 둔 것이
   탑다운의 원근이다 — 같은 반지름이라도 깊이 방향은 짧게 보인다.

   물이 아니다. 수면선도 깊이 그러데이션도 두지 않는다. 대신 별의 «밀도»가
   중심에서 가장자리로 옅어지고, 나선 팔 두 줄이 아주 느리게 돈다 — 고인
   것이 액체가 아니라 별빛이 담긴 은하수로 읽혀야 한다.

   별 자리는 인덱스로만 정해 프레임마다 떨지 않고, 회전만 시간을 탄다. */
function drawDipperGalaxy(cx, cy, spread, fade) {
  if (spread <= 0) return;
  /* 판 «전체»를 덮는 반지름(2026-08-24, 오너 지시 「화면 네모 전체를
     채워야지」). 떨어지는 자리가 W*0.5·H*0.44 이고 세로가 0.42배로 눌리므로,
     네 모서리까지 닿으려면 가로는 판 폭의 절반이면 되지만 «세로»가 모자란다 —
     아래 모서리까지의 깊이 0.56H 를 0.42 로 나눈 값이 실제로 필요한 반지름이다.
     여유 8%를 더해 가장자리가 판 밖에서 끝나게 한다. */
  const RX = Math.max(W * 0.5, (H * 0.56) / 0.42) * 1.08,
    SQUASH = 0.42, // 탑다운 원근: 깊이 방향은 짧게 보인다
    rx = RX * spread,
    ry = rx * SQUASH,
    now = frameClock / 1000,
    spin = now * 0.16;
  x.save();
  x.translate(cx, cy);
  /* 아주 옅은 바닥 물듦. «얕게»가 이 연출의 조건이라 판을 덮지 않는다 —
     아래의 바닥 각인과 별지기가 그대로 읽혀야 한다. */
  const g = x.createRadialGradient(0, 0, 0, 0, 0, rx || 1);
  g.addColorStop(0, "#9ec7ff4a");
  g.addColorStop(0.55, "#7fa8e02b");
  g.addColorStop(1, "#7fa8e000");
  x.globalAlpha = fade;
  x.save();
  x.scale(1, SQUASH);
  x.fillStyle = g;
  x.beginPath();
  x.arc(0, 0, rx, 0, Math.PI * 2);
  x.fill();
  x.restore();
  /* 별. 중심이 촘촘하고 가장자리로 갈수록 성기다 — sqrt 분포를 뒤집어
     r = u^1.6 으로 안쪽에 몰아 둔다. */
  const N = 340;
  for (let i = 0; i < N; i++) {
    const u = ((i * 61) % 197) / 197,
      a = (((i * 37) % 211) / 211) * Math.PI * 2,
      /* 나선 팔 둘. 반지름이 커질수록 각을 비틀어 팔이 생긴다. */
      arm = (i % 2) * Math.PI,
      r = Math.pow(u, 1.6),
      ang = a * 0.25 + arm + r * 2.6 + spin;
    if (r > spread) continue;
    const px = Math.cos(ang) * r * RX,
      py = Math.sin(ang) * r * RX * SQUASH;
    // 가장자리는 옅고, 갓 닿은 테두리는 잠깐 밝다.
    const edge = 1 - Math.min(1, Math.abs(spread - r) / 0.12);
    x.globalAlpha = (0.3 + 0.55 * (1 - r) + edge * 0.5) * fade;
    x.fillStyle = i % 7 === 0 ? "#fff6e6" : i % 3 === 0 ? "#cfe6ff" : "#9ec7ff";
    const sz = 1 + (i % 3 === 0 ? 1 : 0) + (edge > 0.6 ? 1 : 0);
    x.fillRect(Math.round(px), Math.round(py), sz, sz);
  }
  x.restore();
}
/* 떨어지는 자리. 판의 «가운데 조금 위»다 — 여기서 은하수가 사방으로
   퍼지므로, 너무 위면 아래 절반이 비고 너무 아래면 국자와 이어지지 않는다. */
const DIPPER_LAND = { x: 0.5, y: 0.44 };
function drawDipperPour(lip, tip, age, fade, st) {
  const RUN = 0.9; // 띠가 바닥에 닿는 데 걸리는 시간
  const grow = Math.min(1, age / RUN);
  const lz = { x: W * DIPPER_LAND.x, y: H * DIPPER_LAND.y };
  /* 퍼짐. 띠가 «닿은 뒤»부터 번진다 — 닿기도 전에 고이면 어디서 온 것인지
     읽히지 않는다. 대격 뒤에는 1초에 걸쳐 옅어지며 걷힌다. */
  const spread = Math.max(0, Math.min(1, (age - RUN) / 0.75)),
    drained = st?.drain >= 0 ? Math.min(1, st.drain / 1.0) : 0;
  drawDipperGalaxy(lz.x, lz.y, spread, fade * (1 - drained));
  if (grow <= 0) return;
  // 기운 국자의 주둥이. tip 만큼 돌린 자리에서 흘러나온다.
  const lx = lip.x + Math.cos(tip - 0.35) * 62,
    ly = lip.y + Math.sin(tip - 0.35) * 62 + 26;
  /* 떨어지는 자리까지 짧게 휜다. 예전에는 판 바닥(H+40)까지 길게 흘렀는데,
     퍼지는 자리가 판 가운데인 지금은 거기서 «끊겨야» 「부어서 고였다」가
     된다 — 계속 흐르면 관통해 지나간 것으로 읽힌다. */
  const ex = lz.x,
    ey = lz.y,
    cx = lx + (ex - lx) * 0.35 + 80,
    cy = ly + (ey - ly) * 0.62;
  const at = (t) => ({
    x: (1 - t) * (1 - t) * lx + 2 * (1 - t) * t * cx + t * t * ex,
    y: (1 - t) * (1 - t) * ly + 2 * (1 - t) * t * cy + t * t * ey,
  });
  x.save();
  x.globalAlpha = 0.5 * fade;
  x.strokeStyle = "#cfe6ff";
  x.shadowBlur = combatFxBlur(18);
  x.shadowColor = "#9ec7ff";
  x.lineWidth = 3;
  x.beginPath();
  x.moveTo(lx, ly);
  x.quadraticCurveTo(
    lx + (cx - lx) * grow,
    ly + (cy - ly) * grow,
    at(grow).x,
    at(grow).y,
  );
  x.stroke();
  /* 띠의 «몸». 곡선을 따라 별을 흩되 폭이 아래로 갈수록 넓어진다 — 국자에서
     나온 한 줄기가 판 아래에서 은하수가 된다. */
  const N = 132;
  for (let i = 0; i < N; i++) {
    const t = i / (N - 1);
    if (t > grow) break;
    const p = at(t),
      /* 띠는 아래로 갈수록 «좁아진다». 예전에는 넓어졌는데, 그때는 띠가 곧
         은하수였다. 지금 은하수는 닿은 자리에서 따로 퍼지므로, 띠는 부어
         내리는 줄기로 남아야 두 그림이 같은 일을 두 번 하지 않는다. */
      band = 26 - t * 18,
      wob = Math.sin(i * 1.7) * 0.5 + Math.sin(i * 0.41) * 0.5,
      off = wob * band,
      nx = Math.sin(i * 2.3) * band * 0.35;
    const px = p.x + off,
      py = p.y + nx * 0.2;
    // 앞머리가 가장 밝다 — 지금 «흘러 나오는» 자리가 눈에 걸리게.
    const head = 1 - Math.min(1, (grow - t) / 0.22),
      size = 1 + (i % 3) + head * 2;
    x.globalAlpha = (0.22 + 0.5 * (1 - t) + head * 0.4) * fade;
    x.fillStyle = i % 5 === 0 ? "#fff6e6" : i % 3 === 0 ? "#cfe6ff" : "#9ec7ff";
    x.fillRect(Math.round(px), Math.round(py), size, size);
  }
  x.restore();
}
function drawCineDipper(st, s) {
  const shape = FIGURE_SHAPES[7][0],
    img = textures[shape.art],
    fx = cine.fx,
    now = frameClock / 1000;
  const skyC = { x: W / 2 + 70, y: 160 };
  const sky = shape.raw.map((p) => ({
    x: skyC.x + p.x * 125,
    y: skyC.y + p.y * 78,
  }));
  // 승천 0.6 -> 0.9초. 7점짜리 최상위 티어가 6점보다 빨리 끝나고 있었다.
  const fly = cineEase(s / 0.9);
  for (let i = 0; i < 7; i++) {
    const from = cineStar(fx, i),
      to = sky[i];
    const px = from.x + (to.x - from.x) * fly,
      py = from.y + (to.y - from.y) * fly;
    x.save();
    x.shadowBlur = combatFxBlur(14);
    x.shadowColor = "#ffe6b0";
    x.fillStyle = "#fff6e6";
    x.globalAlpha = 0.95;
    x.beginPath();
    x.arc(px, py, 5, 0, Math.PI * 2);
    x.fill();
    x.restore();
    if (fly < 1 && cineChance(0.4))
      cinePart({
        x: px,
        y: py,
        vx: 0,
        vy: 40,
        grav: 0,
        d: 0.4,
        t: 0,
        col: "#ffe6b0",
        size: 2,
      });
  }
  if (fly >= 1) {
    /* 국자를 «앞으로» 깊게 기울인다(0.62 -> 0.95 rad). 탑다운 판에서
       앞으로 기운다는 것은 화면 아래쪽으로 주둥이가 돌아간다는 뜻이고,
       그래야 쏟아진 것이 판 위에 떨어지는 것으로 읽힌다. */
    const tip = cineEase(st.tip >= 0 ? st.tip / 0.75 : 0) * 0.95,
      fade =
        s > cine.end - 1.0 ? Math.max(0, 1 - (s - (cine.end - 1.0)) / 1.0) : 1;
    x.save();
    x.translate(skyC.x, skyC.y);
    x.rotate(tip);
    x.translate(-skyC.x, -skyC.y);
    x.globalAlpha = 0.5 * fade;
    x.strokeStyle = "#dff3ea";
    x.shadowBlur = combatFxBlur(14);
    x.shadowColor = "#9adfc9";
    x.lineWidth = 2.5;
    x.beginPath();
    for (const [i, j] of shape.edges) {
      x.moveTo(sky[i].x, sky[i].y);
      x.lineTo(sky[j].x, sky[j].y);
    }
    x.stroke();
    if (img?.complete && img.naturalWidth) {
      x.globalAlpha = 0.55 * fade;
      x.drawImage(img, skyC.x - 175, skyC.y - 175, 350, 350);
    }
    x.restore();
    /* 국자 주둥이에서 흘러나오는 은하수(2026-08-24).

       회전한 좌표계 «밖»에서 그린다 — 띠는 국자를 따라 기울지 않고 중력을
       따라 떨어져야 한다. 시작점만 기운 국자의 주둥이에서 얻는다.

       모양은 2차 곡선 하나에 별을 흩은 것이다. 진행률에 따라 곡선의 앞쪽
       부터 «차오르고», 각 별의 좌우 흔들림은 자리 인덱스로만 정해 프레임
       마다 떨지 않게 했다. 결이나 흐름의 질감은 디자인 세션 몫이다. */
    if (st.pour >= 0) drawDipperPour(skyC, tip, st.pour, fade, st);
  }
  if (st.polaris >= 0) {
    const k = Math.min(1, st.polaris / 0.3),
      br = 0.7 + 0.3 * Math.sin(now * 5);
    x.save();
    x.translate(W - 106, 84);
    x.globalAlpha = br;
    x.strokeStyle = "#fff6e6";
    x.shadowBlur = combatFxBlur(22);
    x.shadowColor = "#fff1bd";
    x.lineWidth = 3;
    const R = 20 * k;
    x.beginPath();
    x.moveTo(0, -R * 1.6);
    x.lineTo(0, R * 1.6);
    x.moveTo(-R, 0);
    x.lineTo(R, 0);
    x.stroke();
    x.fillStyle = "#fff6e6";
    x.beginPath();
    x.arc(0, 0, 5 * k, 0, Math.PI * 2);
    x.fill();
    x.restore();
  }
  if (st.aim >= 0 && ball && boss) {
    const k = Math.min(1, st.aim / 0.5);
    x.save();
    x.globalAlpha = 0.85;
    x.strokeStyle = "#fff1bd";
    x.shadowBlur = combatFxBlur(10);
    x.shadowColor = "#fff1bd";
    x.lineWidth = 2.5;
    x.setLineDash([7, 8]);
    x.lineDashOffset = -now * 60;
    x.beginPath();
    x.moveTo(ball.x, ball.y);
    x.lineTo(
      ball.x + (boss.x - ball.x) * k,
      ball.y + (boss.y + 60 - ball.y) * k,
    );
    x.stroke();
    x.setLineDash([]);
    if (k >= 1) {
      const an = Math.atan2(boss.y + 60 - ball.y, boss.x - ball.x);
      x.beginPath();
      x.moveTo(boss.x, boss.y + 60);
      x.lineTo(
        boss.x - Math.cos(an - 0.4) * 16,
        boss.y + 60 - Math.sin(an - 0.4) * 16,
      );
      x.moveTo(boss.x, boss.y + 60);
      x.lineTo(
        boss.x - Math.cos(an + 0.4) * 16,
        boss.y + 60 - Math.sin(an + 0.4) * 16,
      );
      x.stroke();
    }
    x.restore();
  }
}
