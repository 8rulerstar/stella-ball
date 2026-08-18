/* Stella Ball — 관측창 밖의 존재 · 인트로 v2 (2026-08-14 디자인 세션)

   원본: prototypes/outer-observer.js (6비트 9.8초, transition 3회)
   문제: 몸이 한 장의 PNG를 translateX로 밀기만 해서 「지나간다」가 아니라
        「미끄러진다」로 읽힌다. 눈이 멈추는 순간 말고는 프레임이 변하지 않는다.

   v2가 더하는 것 — 모두 표현 전용이고 게임 상태를 읽지도 쓰지도 않는다.
     · 20fps 스텝 보행: 걸음마다 몸이 눌리고 기울고, 착지마다 먼지와 별 흔들림
     · 잔상 3겹: 픽셀 스미어로 질량을 만든다
     · 별을 먹는 그림자: 실루엣 뒤 별이 실제로 사라진다 (명세 4절 「별이 비어 버린 음영」)
     · 통과 그림자: 몸보다 넓은 어둠이 하늘을 한 번 훑는다
     · 관측 고리: 눈 주변 눈금 고리 2겹이 정지 순간 수축한다
     · 동공 4프레임 수축 + 이후 느린 호흡(정지 상태에서도 프레임이 산다)
     · 발톱: 예비동작 → 2프레임 스냅 → 그립 플렉스 2회 + 모서리 픽셀 파편
     · 퇴장: 속도선 + 잔상, 마지막에 흔적 별 3개만 남는다

   지키는 제약 (OUTER_OBSERVER_INTRO_SPEC.md 2·4·9절)
     · 몸통·그림자·고리는 #dawn-sky 자식(z-index 0)이라 관측창을 절대 가리지 않는다
     · 앞으로 오는 것은 비트 5의 발톱 하나뿐이고 pointer-events:none이라 CTA는 계속 눌린다
     · 살구빛(#ffd2a0)은 쓰지 않는다. 청록-잿빛 저대비만 쓴다
     · prefers-reduced-motion에서는 정지한 한 장으로 떨어진다
     · 흔드는 것은 main 하나뿐이고 transform은 애니메이션으로만 걸어 남기지 않는다 */
(function () {
  "use strict";

  var LAYER_ID = "oo2-layer";
  var BAKE = 360;
  /* 20fps. 12fps는 픽셀 느낌은 나지만 몸이 810px로 확대된 상태라 한 프레임에
     40px씩 튀어서 「끊긴다」로 읽혔다. 프레임은 여전히 잠겨 있고 이동량만 촘촘하다. */
  var FPS = 20;
  var STEP_HZ = 2.05; // 초당 걸음 수
  var EYE_X = 0.49,
    EYE_Y = 0.37; // 그림 안에서의 눈 위치 (boss-art.js drawStrider 기준)

  function reducedMotion() {
    try {
      return matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch (e) {
      return false;
    }
  }
  var bakeCache = {};
  function bakeBeing(pupil) {
    var key = "b" + pupil;
    if (bakeCache[key]) return bakeCache[key];
    var c = document.createElement("canvas");
    c.width = c.height = BAKE;
    window.StellaBossArt.draw(c.getContext("2d"), "strider", {
      size: BAKE,
      phase: 1,
      pupil: pupil,
    });
    return (bakeCache[key] = c.toDataURL("image/png"));
  }
  function el(tag, css, parent) {
    var d = document.createElement(tag);
    if (css) d.style.cssText = css;
    if (parent) parent.appendChild(d);
    return d;
  }
  function img(src, css, parent) {
    var i = el("img", css, parent);
    i.src = src;
    i.alt = "";
    i.setAttribute("aria-hidden", "true");
    i.draggable = false;
    return i;
  }

  /* v2 전용 키프레임. 픽셀 흔들림은 steps()로 잠가 CSS 특유의 매끄러움을 뺀다. */
  function injectCss() {
    if (document.getElementById("oo2-css")) return;
    var s = document.createElement("style");
    s.id = "oo2-css";
    s.textContent = [
      /* 발톱이 짚는 순간의 관측창 흔들림. 원본 ooFrameGrab보다 첫 타격이 크고
         감쇠가 빠르다. fill-mode 없음 — main에 transform이 남으면 전체화면
         오버레이가 캔버스 폭에 갇힌다. */
      "@keyframes oo2Grab{",
      "0%{transform:none}",
      "4%{transform:translate(-13px,7px) rotate(-0.8deg)}",
      "9%{transform:translate(10px,-5px) rotate(0.58deg)}",
      "15%{transform:translate(-9px,6px) rotate(-0.5deg)}",
      "22%{transform:translate(7px,-4px) rotate(0.4deg)}",
      "31%{transform:translate(-6px,3px) rotate(-0.3deg)}",
      "42%{transform:translate(4px,-3px) rotate(0.22deg)}",
      "55%{transform:translate(-3px,2px) rotate(-0.15deg)}",
      "70%{transform:translate(2px,-1px) rotate(0.09deg)}",
      "85%{transform:translate(-1px,1px) rotate(-0.04deg)}",
      "100%{transform:none}}",
      "main.oo2-grabbed{animation:oo2Grab 1.7s cubic-bezier(.2,.9,.2,1)}",
      /* 붙잡힌 관측창. 첫 타격이 크고 진폭이 오래 남는다 — 발톱이 쥐고 있는
         동안은 흔들림이 잦아들지 않아야 「놓아 주기를 기다린다」가 된다. */
      "@keyframes oo2Shake{0%{transform:none}",
      "3%{transform:translate(-38px,20px) rotate(-2.6deg)}",
      "7%{transform:translate(31px,-16px) rotate(2deg)}",
      "11%{transform:translate(-33px,17px) rotate(-2.25deg)}",
      "15%{transform:translate(26px,-13px) rotate(1.7deg)}",
      "20%{transform:translate(-28px,14px) rotate(-1.9deg)}",
      "25%{transform:translate(21px,-11px) rotate(1.4deg)}",
      "31%{transform:translate(-23px,11px) rotate(-1.55deg)}",
      "37%{transform:translate(17px,-9px) rotate(1.15deg)}",
      "44%{transform:translate(-19px,9px) rotate(-1.3deg)}",
      "51%{transform:translate(14px,-7px) rotate(.95deg)}",
      "58%{transform:translate(-16px,8px) rotate(-1.05deg)}",
      "66%{transform:translate(12px,-6px) rotate(.78deg)}",
      "74%{transform:translate(-13px,6px) rotate(-.85deg)}",
      "82%{transform:translate(9px,-5px) rotate(.6deg)}",
      "90%{transform:translate(-9px,4px) rotate(-.55deg)}",
      "100%{transform:translate(6px,-3px) rotate(.34deg)}}",
      "main.oo2-shake{animation:oo2Shake 1.7s linear}",
      /* 쥐는 힘이 한 번씩 더 들어가는 순간 */
      "@keyframes oo2Squeeze{0%{transform:translate(6px,-3px) rotate(.34deg)}",
      "12%{transform:translate(-30px,16px) rotate(-2.1deg)}",
      "28%{transform:translate(22px,-11px) rotate(1.45deg)}",
      "46%{transform:translate(-15px,7px) rotate(-.9deg)}",
      "66%{transform:translate(10px,-5px) rotate(.55deg)}",
      "84%{transform:translate(-7px,3px) rotate(-.3deg)}",
      "100%{transform:translate(6px,-3px) rotate(.34deg)}}",
      "main.oo2-squeeze{animation:oo2Squeeze .7s cubic-bezier(.2,.85,.25,1)}",
      /* 놓는 순간. 쥐었던 방향으로 한 번 밀어 던지고 관측창이 제자리를 찾는다. */
      "@keyframes oo2Kick{0%{transform:translate(6px,-3px) rotate(.34deg)}",
      "8%{transform:translate(54px,-22px) rotate(2.1deg)}",
      "22%{transform:translate(-26px,11px) rotate(-1deg)}",
      "38%{transform:translate(15px,-6px) rotate(.55deg)}",
      "54%{transform:translate(-9px,4px) rotate(-.3deg)}",
      "70%{transform:translate(5px,-2px) rotate(.16deg)}",
      "85%{transform:translate(-3px,1px) rotate(-.08deg)}",
      "100%{transform:none}}",
      "main.oo2-kick{animation:oo2Kick 1.15s cubic-bezier(.18,.9,.2,1)}",
      /* 착지마다 하늘 전체가 1픽셀 어긋난다. 별을 옮기는 게 아니라
         관측 자체가 흔들린 것으로 읽히게 프레임을 잠근다. */
      "@keyframes oo2Jolt{0%{transform:translate(0,0)}",
      "34%{transform:translate(1px,-1px)}",
      "67%{transform:translate(-1px,1px)}",
      "100%{transform:translate(0,0)}}",
      ".oo2-jolt{animation:oo2Jolt .18s steps(1) 1}",
      /* 착지 먼지 — 여백 바닥에서만 퍼진다 */
      "@keyframes oo2Dust{0%{transform:translate(-50%,0) scaleX(.4);opacity:.5}",
      "100%{transform:translate(-50%,-14px) scaleX(2.4);opacity:0}}",
      /* 관측 고리 수축 */
      "@keyframes oo2Ring{0%{transform:translate(-50%,-50%) scale(1.35);opacity:0}",
      "22%{opacity:.5}",
      "100%{transform:translate(-50%,-50%) scale(.55);opacity:0}}",
      /* 모서리 파편 */
      "@keyframes oo2Chip{0%{transform:translate(0,0);opacity:.85}",
      "100%{transform:translate(var(--cx),var(--cy));opacity:0}}",
      /* 퇴장 속도선 */
      "@keyframes oo2Streak{0%{transform:scaleX(0);opacity:0}",
      "30%{transform:scaleX(1);opacity:.42}",
      "100%{transform:scaleX(1.6) translateX(30vw);opacity:0}}",
      "@media (prefers-reduced-motion:reduce){main.oo2-grabbed,main.oo2-shake,",
      "main.oo2-squeeze,main.oo2-kick{animation:none}",
      "#" + LAYER_ID + " *{animation:none!important}}",
      "@keyframes oo2Diamond{0%{opacity:0;transform:translate(-50%,-50%) ",
      "rotate(45deg) scale(1.6)}100%{opacity:1;transform:translate(-50%,-50%) ",
      "rotate(45deg) scale(1)}}",
      /* 「관측당한다」 신호 전용 수축 링(§1-3). 확장 링과 방향이 반대다 —
         밖에서 조여 들어오는 것이 이 연출의 문장이다. */
      "@keyframes oo2Contract{0%{transform:translate(-50%,-50%) scale(1.5);",
      "opacity:0}18%{opacity:.7}100%{transform:translate(-50%,-50%) ",
      "scale(.5);opacity:0}}",
      "@keyframes oo2Flash{0%{opacity:.92}100%{opacity:0}}",
      "@media (prefers-reduced-motion:reduce){",
      ".oo2-cine{transition:none!important;animation:none!important}}",
    ].join("");
    document.head.appendChild(s);
  }

  /* ── 레이어 ─────────────────────────────────────────────────────────
     main(z-index:1) 뒤에 남는다. 여백의 클릭 소품 위를 덮지 않는다. */
  function build(sky) {
    injectCss();
    var layer = el(
      "div",
      "position:absolute;inset:0;overflow:hidden;pointer-events:none;z-index:0",
      sky,
    );
    layer.id = LAYER_ID;

    // 통과 그림자: 몸보다 넓은 어둠. 하늘을 한 번 훑고 별을 눌러 놓는다.
    var sweep = el(
      "div",
      "position:absolute;left:0;top:-10%;width:62vw;height:120%;opacity:0;" +
        "background:radial-gradient(ellipse 60% 50% at 50% 50%,#04080ae6,#04080a99 46%,transparent 74%);" +
        "will-change:transform,opacity",
      layer,
    );

    // 배후광: 몸이 지나가는 자리의 성운이 굴절해 실루엣 뒤에서만 옅게 밝아진다.
    // 이게 없으면 청록-잿빛 저대비 몸이 밤하늘과 같은 값이라 「지나갔는지」조차
    // 읽히지 않는다. CTA·별자리보다 밝아지지 않는 알파만 쓴다.
    var glow = el(
      "div",
      "position:absolute;width:132vh;height:132vh;left:0;top:0;opacity:0;" +
        "background:radial-gradient(circle closest-side,#3f666944 0%,#2c4a4e2e 42%,#16242a00 72%);" +
        "will-change:transform,opacity",
      layer,
    );

    // 별을 먹는 그림자: 실루엣 바로 뒤를 따라가며 별을 지운다.
    var eater = el(
      "div",
      "position:absolute;width:120vh;height:120vh;left:0;top:0;opacity:0;" +
        "background:radial-gradient(circle closest-side,#050809f2 52%,#050809a8 72%,transparent 88%);" +
        "will-change:transform,opacity",
      layer,
    );

    // 그림자가 별을 지운 다음에 배후광이 온다. 순서가 뒤집히면 halo가 먹힌다.
    layer.appendChild(glow);

    // 잔상 3겹 → 본체. 뒤에 깔린 것이 먼저 그려져야 스미어로 읽힌다.
    var frame = bakeBeing(1);
    var boxCss =
      "position:absolute;left:0;top:0;width:150vh;height:auto;" +
      "image-rendering:pixelated;opacity:0;will-change:transform;transform-origin:49% 37%";
    var echoes = [];
    for (var i = 0; i < 3; i++) echoes.push(img(frame, boxCss, layer));
    var being = img(frame, boxCss, layer);

    // 관측 눈금 고리 2겹. 눈 위에 겹쳐 정지 순간 한 번 수축한다.
    var rings = el(
      "div",
      "position:absolute;left:0;top:0;width:0;height:0;opacity:0",
      layer,
    );
    for (var r = 0; r < 2; r++) {
      el(
        "div",
        "position:absolute;left:0;top:0;width:" +
          (30 + r * 16) +
          "vh;height:" +
          (30 + r * 16) +
          "vh;margin:" +
          -(15 + r * 8) +
          "vh 0 0 " +
          -(15 + r * 8) +
          "vh;border:2px " +
          (r ? "dashed" : "solid") +
          " #4d7f8055;border-radius:50%;opacity:0",
        rings,
      );
    }

    // 관측 이상: 자연 성야에 없는 등간격 점. 원본과 같은 배치를 유지한다.
    var anomaly = el(
      "div",
      "position:absolute;inset:0;opacity:0;transition:opacity .5s ease-out",
      layer,
    );
    var grid = el("div", "position:absolute;inset:0", anomaly);
    for (var side = 0; side < 2; side++)
      for (var k = 0; k < 9; k++)
        el(
          "i",
          "position:absolute;width:2px;height:2px;background:#cfe8e0;" +
            "box-shadow:0 0 4px #cfe8e066;" +
            (side ? "right:" : "left:") +
            (4 + (k % 2) * 3) +
            "%;top:" +
            (12 + (k * 70) / 9).toFixed(1) +
            "%",
          grid,
        );

    return {
      layer: layer,
      sweep: sweep,
      glow: glow,
      eater: eater,
      being: being,
      echoes: echoes,
      rings: rings,
      anomaly: anomaly,
      grid: grid,
      tight: [bakeBeing(0.74), bakeBeing(0.56), bakeBeing(0.42)],
      wide: frame,
      claw: null,
    };
  }

  /* ── 발톱 리그 ──────────────────────────────────────────────────────
     기존 발톱은 `boss-art.js`의 drawClaw 한 장을 통째로 밀어 넣은 것이라,
     가지 세 개가 붙은 실루엣이 그대로 미끄러졌다 — 짚는 동작이 아니라
     스티커가 이동하는 것으로 읽힌다. 여기서는 팔·위집게·아래집게를 따로
     구워 관절로 묶는다. 벌렸다가 물고, 문 채 두 번 더 조이고, 놓을 때
     펴진다. 같은 마디 문법·같은 램프·같은 광원(lx -0.6, ly -0.78)이라
     본체와 다른 개체로 읽히지 않는다. */
  var ART = (function () {
    var PAL = (window.StellaBossArt && window.StellaBossArt.PAL) || [
      "#070b0d",
      "#0d1418",
      "#142226",
      "#1e3338",
      "#2c4a4e",
      "#3f6669",
    ];
    var RIM = "#6f8b8c",
      COOL = "#16242a";
    function mk(w, h) {
      return { w: w, h: h, d: new Uint8Array(w * h) };
    }
    function disc(m, cx, cy, r) {
      var r2 = r * r,
        x0 = Math.max(0, Math.floor(cx - r)),
        x1 = Math.min(m.w - 1, Math.ceil(cx + r)),
        y0 = Math.max(0, Math.floor(cy - r)),
        y1 = Math.min(m.h - 1, Math.ceil(cy + r));
      for (var y = y0; y <= y1; y++)
        for (var x = x0; x <= x1; x++) {
          var dx = x - cx,
            dy = y - cy;
          if (dx * dx + dy * dy <= r2) m.d[y * m.w + x] = 1;
        }
    }
    // 마디 다리: 직선 구간 + 관절 혹. 매끈한 촉수가 아니라 절지로 읽히게 한다.
    function strut(m, joints, radii) {
      for (var k = 0; k < joints.length - 1; k++) {
        var a = joints[k],
          b = joints[k + 1],
          r0 = radii[k],
          r1 = radii[k + 1];
        var n = Math.max(6, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1])));
        for (var i = 0; i <= n; i++) {
          var t = i / n;
          disc(
            m,
            a[0] + (b[0] - a[0]) * t,
            a[1] + (b[1] - a[1]) * t,
            r0 + (r1 - r0) * t,
          );
        }
        if (k > 0) disc(m, a[0], a[1], r0 * 1.32);
      }
    }
    function dist(m) {
      var w = m.w,
        h = m.h,
        D = new Int32Array(w * h),
        i,
        x,
        y,
        v;
      for (i = 0; i < w * h; i++) D[i] = m.d[i] ? 99999 : 0;
      for (y = 0; y < h; y++)
        for (x = 0; x < w; x++) {
          i = y * w + x;
          if (!D[i]) continue;
          v = D[i];
          if (x > 0) v = Math.min(v, D[i - 1] + 2);
          if (y > 0) v = Math.min(v, D[i - w] + 2);
          if (x > 0 && y > 0) v = Math.min(v, D[i - w - 1] + 3);
          if (x < w - 1 && y > 0) v = Math.min(v, D[i - w + 1] + 3);
          D[i] = v;
        }
      for (y = h - 1; y >= 0; y--)
        for (x = w - 1; x >= 0; x--) {
          i = y * w + x;
          if (!D[i]) continue;
          v = D[i];
          if (x < w - 1) v = Math.min(v, D[i + 1] + 2);
          if (y < h - 1) v = Math.min(v, D[i + w] + 2);
          if (x < w - 1 && y < h - 1) v = Math.min(v, D[i + w + 1] + 3);
          if (x > 0 && y < h - 1) v = Math.min(v, D[i + w - 1] + 3);
          D[i] = v;
        }
      return D;
    }
    function shade(g, m, D, deep) {
      var w = m.w,
        h = m.h,
        lx = -0.6,
        ly = -0.78;
      for (var y = 0; y < h; y++)
        for (var x = 0; x < w; x++) {
          var i = y * w + x;
          if (!m.d[i]) continue;
          var dep = D[i] / 2;
          var gx =
            D[Math.min(w - 1, x + 1) + y * w] - D[Math.max(0, x - 1) + y * w];
          var gy =
            D[x + Math.min(h - 1, y + 1) * w] - D[x + Math.max(0, y - 1) * w];
          var len = Math.hypot(gx, gy) || 1;
          var tilt = Math.max(0, 1 - dep / deep);
          var nl = -((gx / len) * lx + (gy / len) * ly);
          var v = 0.28 + 0.44 * nl * Math.pow(tilt, 0.6) + 0.07 * (1 - tilt);
          // 마디 껍질의 결. 두 값 사이를 오가는 얇은 띠만 넣는다.
          if (dep > 2.4 && (x + y * 2) % 13 < 2) v -= 0.1;
          var col = PAL[Math.max(0, Math.min(5, Math.round(v * 5)))];
          if (dep < 1.3 && nl > 0.55) col = RIM;
          if (dep > 3 && (x * 2 + y) % 29 < 2) col = COOL;
          g.fillStyle = col;
          g.fillRect(x, y, 1, 1);
        }
    }
    function bake(S, paint, deep) {
      var c = document.createElement("canvas");
      c.width = c.height = S;
      var m = mk(S, S);
      paint(m, S / 180);
      shade(c.getContext("2d"), m, dist(m), deep * (S / 180));
      return c.toDataURL("image/png");
    }
    return {
      // 팔: 오른쪽 위 화면 밖에서 들어와 손목에서 끝난다. 굵은 쪽은 잘려 나간다.
      arm: function (S) {
        return bake(
          S,
          function (m, K) {
            strut(
              m,
              [
                [206 * K, -34 * K],
                [150 * K, 22 * K],
                [104 * K, 74 * K],
              ],
              [36 * K, 27 * K, 19 * K],
            );
            disc(m, 150 * K, 22 * K, 31 * K);
            disc(m, 104 * K, 74 * K, 23 * K);
          },
          22,
        );
      },
      // 집게 한 갈래. 손목(24,24)에서 시작해 안쪽으로 말린다.
      digit: function (S, big) {
        return bake(
          S,
          function (m, K) {
            var p = big
              ? [
                  [24, 24],
                  [78, 52],
                  [116, 94],
                  [104, 132],
                ]
              : [
                  [24, 24],
                  [52, 78],
                  [58, 124],
                  [92, 142],
                ];
            var r = big ? [15, 11, 7, 4] : [13, 9.5, 6, 3.5];
            strut(
              m,
              p.map(function (q) {
                return [q[0] * K, q[1] * K];
              }),
              r.map(function (v) {
                return v * K;
              }),
            );
          },
          14,
        );
      },
    };
  })();

  /* 리그는 관측창 앞(z-index 2)이라 #dawn-sky 안에 둘 수 없다.
     body 직계 대신 두 책임을 직접 진다: 모션 감소에서 비트 5를 빼고,
     stop()에서 반드시 제거한다. pointer-events:none이라 CTA는 계속 눌린다. */
  var RIG = 300; // 굽는 해상도
  /* 리그 하나를 만들어 낸다. mirror가 참이면 상하·좌우로 뒤집어 아래에서
     올라오는 팔이 된다 — 같은 스프라이트를 재사용하므로 위아래 두 팔이
     한 몸에서 나왔다는 것이 유지된다. */
  function buildRig(mirror) {
    var rig = el(
      "div",
      "position:fixed;z-index:2;width:46vh;height:46vh;pointer-events:none;" +
        "opacity:0;will-change:transform;transform-origin:50% 50%",
      document.body,
    );
    rig.className = "oo2-claw";
    var inner = el(
      "div",
      "position:absolute;inset:0" + (mirror ? ";transform:scale(-1,-1)" : ""),
      rig,
    );
    img(
      bakeCache.arm || (bakeCache.arm = ART.arm(RIG)),
      "position:absolute;inset:0;width:100%;height:100%;image-rendering:pixelated",
      inner,
    );
    // 손목에 두 집게를 매단다. 회전 중심이 손목이어야 「물었다」가 된다.
    var hand = el(
      "div",
      "position:absolute;left:57.8%;top:41.1%;width:0;height:0",
      inner,
    );
    var dCss =
      "position:absolute;left:-4vh;top:-4vh;width:30vh;height:30vh;image-rendering:pixelated";
    function digit(src) {
      var d = el(
        "div",
        "position:absolute;left:0;top:0;width:0;height:0;transform-origin:0 0;will-change:transform",
        hand,
      );
      img(src, dCss, d);
      return d;
    }
    return {
      rig: rig,
      mirror: !!mirror,
      top: digit(
        bakeCache.digitBig || (bakeCache.digitBig = ART.digit(RIG, true)),
      ),
      bot: digit(
        bakeCache.digitSm || (bakeCache.digitSm = ART.digit(RIG, false)),
      ),
    };
  }
  // 위에서 하나, 아래에서 하나. 무는 순간이 엇갈려 관측창이 두 번 들린다.
  function buildClaw() {
    return [buildRig(false), buildRig(true)];
  }

  /* 손목을 관측창 오른쪽 위 모서리 밖에 둔다. 존재가 오른쪽 여백에 서 있으니
     팔이 넘어오는 방향과 짚는 자리가 어긋나지 않는다. */
  function clawPlace(P) {
    var m = document.querySelector("main");
    if (!m || !P.claw) return;
    /* 위쪽 팔은 관측창 오른쪽 상부를, 아래 팔은 왼쪽 하부를 맞잡는다 —
       대각으로 어긋난 두 지점이라 흔들림이 회전으로 읽힌다.
       자리는 한 번만 쟀다: main은 잡힌 동안 흔들리므로 매번 rect를 재면
       발톱이 조금씩 밀린다. offset* 는 transform을 타지 않는다. */
    P.claw.forEach(function (c) {
      if (!c.pos) {
        var W = c.rig.offsetWidth || window.innerHeight * 0.46;
        c.pos = c.mirror
          ? {
              left: Math.round(m.offsetLeft + 14 - 0.422 * W),
              top: Math.round(m.offsetTop + m.offsetHeight * 0.87 - 0.589 * W),
            }
          : {
              left: Math.round(m.offsetLeft + m.offsetWidth - 14 - 0.578 * W),
              top: Math.round(m.offsetTop + m.offsetHeight * 0.13 - 0.411 * W),
            };
      }
      c.rig.style.left = c.pos.left + "px";
      c.rig.style.top = c.pos.top + "px";
    });
  }
  /* 자리는 한 번만 잰다. main은 붙잡히는 동안 흔들리므로 매번
       getBoundingClientRect로 재면 흔들린 값을 따라가 발톱이 조금씩 밀린다.
       offset* 는 transform을 타지 않는 레이아웃 값이라 흔들림과 무관하다.
       손목은 모서리보다 살짝 아래를 짚는다 — 그래야 팔의 앞마디가 화면 위로
       잘려 나가지 않고 「밖에서 들어온 팔」로 읽힌다. */

  /* 발톱 상태. 감정은 집게에 있다 — 팔은 거의 안 움직이고, 벌림·물림·조이기만
     바뀌면서 「짚고 있다」가 유지된다. */
  function claw(P, mode, which) {
    if (!P.claw) return;
    clawPlace(P);
    P.claw.forEach(function (c, i) {
      if (which != null && which !== i) return;
      var s = c.mirror ? -1 : 1; // 아래 팔은 밀려나는 방향이 반대다
      function set(tr, dur, ease, op) {
        c.rig.style.transition =
          "transform " + dur + " " + ease + ",opacity .3s ease-out";
        c.rig.style.transform = tr;
        if (op != null) c.rig.style.opacity = op;
      }
      function digits(a, b, dur, ease) {
        c.top.style.transition = "transform " + dur + " " + ease;
        c.bot.style.transition = "transform " + dur + " " + ease;
        c.top.style.transform = "rotate(" + a + "deg)";
        c.bot.style.transform = "rotate(" + b + "deg)";
      }
      if (mode === "in") {
        c.rig.style.transition = "none";
        c.rig.style.transform =
          "translate(" +
          19 * s +
          "vw," +
          -9 * s +
          "vh) rotate(" +
          -12 * s +
          "deg) scale(1.09)";
        c.rig.style.opacity = "0.46";
        digits(-31, 27, "0s", "linear");
      } else if (mode === "bite") {
        set(
          "translate(0,0) rotate(0) scale(1)",
          ".17s",
          "cubic-bezier(.2,.9,.2,1.08)",
          "0.96",
        );
        digits(3, -3, ".12s", "cubic-bezier(.3,1.45,.5,1)");
      } else if (mode === "squeeze") {
        set(
          "translate(" +
            -7 * s +
            "px," +
            5 * s +
            "px) rotate(" +
            -1.6 * s +
            "deg) scale(1.012)",
          ".18s",
          "cubic-bezier(.3,.9,.2,1)",
        );
        digits(12, -10, ".18s", "cubic-bezier(.3,1.25,.4,1)");
      } else if (mode === "hold") {
        set(
          "translate(" +
            -2 * s +
            "px," +
            1 * s +
            "px) rotate(" +
            -0.4 * s +
            "deg) scale(1)",
          ".32s",
          "cubic-bezier(.3,.1,.2,1)",
        );
        digits(5, -4, ".32s", "cubic-bezier(.3,.1,.2,1)");
      } else if (mode === "open") {
        set(
          "translate(" +
            7 * s +
            "px," +
            -5 * s +
            "px) rotate(" +
            1.2 * s +
            "deg) scale(1.02)",
          ".13s",
          "cubic-bezier(.2,.9,.2,1)",
        );
        digits(-36, 31, ".13s", "cubic-bezier(.2,.9,.2,1)");
      } else {
        set(
          "translate(" +
            23 * s +
            "vw," +
            -12 * s +
            "vh) rotate(" +
            -7 * s +
            "deg) scale(1.05)",
          ".5s",
          "cubic-bezier(.4,0,.7,.42)",
          "0",
        );
        digits(-22, 19, ".4s", "ease-out");
      }
    });
  }

  /* 시네마 레이어 (INTRO_REDESIGN_HANDOFF.md §2-1 추가분).
     레터박스·캡션·아이컷은 발톱과 같은 이유로 body 직계다 — #dawn-sky 안에
     두면 관측창 뒤로 깔려 인서트 컷이 되지 못한다. pointer-events:none이라
     건너뛰기와 CTA는 계속 눌린다. 전부 .oo2-cine을 달고 stop()이 지운다. */
  function buildCine() {
    function add(css) {
      var n = el(
        "div",
        "position:fixed;z-index:6;pointer-events:none;" + css,
        document.body,
      );
      n.className = "oo2-cine";
      return n;
    }
    var bars = [
      add(
        "left:0;right:0;top:0;height:6.5vh;background:#03020c;transform:translateY(-100%);transition:transform .5s cubic-bezier(.3,.1,.2,1)",
      ),
      add(
        "left:0;right:0;bottom:0;height:6.5vh;background:#03020c;transform:translateY(100%);transition:transform .5s cubic-bezier(.3,.1,.2,1)",
      ),
    ];
    var cap = add(
      "left:0;right:0;bottom:12vh;display:grid;justify-items:center;opacity:0;transition:opacity .3s",
    );
    var kick = el(
      "small",
      "display:block;white-space:nowrap;color:#c94ff0;font:700 11px 'Galmuri11',monospace;letter-spacing:.3em;margin-bottom:9px;text-shadow:0 0 12px #c94ff055",
      cap,
    );
    var line = el(
      "div",
      "max-width:640px;padding:0 20px;text-align:center;color:#fdf6e8;font:22px 'Galmuri11',sans-serif;line-height:1.6;text-shadow:0 2px 0 #0a0418,0 0 18px #ffd98e33",
      cap,
    );
    var veil = add(
      "inset:0;background:#070312;opacity:0;transition:opacity .4s ease-out",
    );
    var eye = add(
      "left:50%;top:43%;width:288px;height:288px;transform:translate(-50%,-50%);opacity:0",
    );
    el(
      "div",
      "position:absolute;left:50%;top:50%;width:330px;height:330px;border:3px solid #e84ff0aa;transform:translate(-50%,-50%) rotate(45deg);box-shadow:0 0 26px #c94ff044,inset 0 0 26px #c94ff022;animation:oo2Diamond .5s cubic-bezier(.2,.85,.3,1) both",
      eye,
    );
    /* 시트는 384×96(96px 4프레임). 3배로 키우면 프레임이 288px이 되어 정수
       배율이 유지된다 — 시안이 쓰는 1152×288이 바로 그 값이다. */
    var frame = el(
      "div",
      "position:absolute;inset:0;background:url('../assets/redesign/observer-eye-sheet.png') 0 0/1152px 288px no-repeat;image-rendering:pixelated",
      eye,
    );
    var ring1 = el(
      "div",
      "position:absolute;left:50%;top:50%;width:380px;height:380px;border:2px solid #c94ff066;border-radius:50%;transform:translate(-50%,-50%);opacity:0",
      eye,
    );
    var ring2 = el(
      "div",
      "position:absolute;left:50%;top:50%;width:450px;height:450px;border:2px dashed #ffd98e44;border-radius:50%;transform:translate(-50%,-50%);opacity:0",
      eye,
    );
    return {
      bars: bars,
      cap: cap,
      kick: kick,
      line: line,
      veil: veil,
      eye: eye,
      frame: frame,
      ring1: ring1,
      ring2: ring2,
    };
  }
  function cineBars(C, inward) {
    C.bars[0].style.transform = inward ? "translateY(0)" : "translateY(-100%)";
    C.bars[1].style.transform = inward ? "translateY(0)" : "translateY(100%)";
  }
  /* 킥커는 즉시, 본문은 한 글자씩 26ms(§1-2). 한 캡션이 끝나기 전에 다음이
     오면 앞의 타이머가 남아 두 문장이 섞이므로 매번 지우고 시작한다. */
  function cineCaption(C, kicker, text) {
    if (live && live.typeIv) clearInterval(live.typeIv);
    C.cap.style.opacity = "1";
    C.kick.textContent = kicker;
    C.line.textContent = "";
    var i = 0;
    var iv = setInterval(function () {
      C.line.textContent = text.slice(0, ++i);
      if (i >= text.length) clearInterval(iv);
    }, 26);
    if (live) live.typeIv = iv;
  }
  function cineFlash() {
    var f = el(
      "div",
      "position:fixed;inset:0;z-index:7;background:#fff3d6;pointer-events:none;animation:oo2Flash .2s steps(2) forwards",
      document.body,
    );
    f.className = "oo2-cine";
    setTimeout(function () {
      f.remove();
    }, 240);
  }
  function startleProps(sky) {
    var move = {
      astronaut: "translate(14vw,-46vh) rotate(414deg)",
      rabbit: "translate(-26px,16px)",
      telescope: "rotate(74deg) translate(10px,16px)",
      compass: "rotate(1080deg)",
    };
    Object.keys(move).forEach(function (name) {
      var e = sky.querySelector('[data-dawn-prop="' + name + '"]');
      if (!e) return;
      // 원래 값을 남긴다. stella-ball-dawn.js가 떠다니는 애니메이션을 인라인으로
      // 걸어 두므로, 그냥 지우면 타이틀을 떠난 뒤 영영 돌아오지 않는다.
      if (e.dataset.ooRestore == null)
        e.dataset.ooRestore = JSON.stringify({
          animation: e.style.animation || "",
          transition: e.style.transition || "",
          transform: e.style.transform || "",
          opacity: e.style.opacity || "",
        });
      e.style.animation = "none";
      e.style.transition = "transform 2.6s cubic-bezier(.22,.9,.3,1)";
      e.style.transform = move[name];
      if (name === "rabbit") e.style.opacity = "0";
    });
  }

  /* 흩어진 소품은 타이틀에 머무는 동안만 그대로 둔다(명세 5절). 그대로 두면
     허브·편성·전투까지 방금 있지도 않은 사건의 잔해를 이고 간다.
     전부 동기로 되돌린다 — rAF에 미루면 탭이 가려진 채 나갔을 때 콜백이
     영영 오지 않아 소품이 멈춘 상태로 남는다.
     dataset.ooRestore는 실제 속성이 data-oo-restore다. 카멜케이스 셀렉터로
     찾으면 하나도 잡히지 않는다. */
  function restoreProps() {
    document.querySelectorAll("[data-oo-restore]").forEach(function (e) {
      var saved;
      try {
        saved = JSON.parse(e.dataset.ooRestore);
      } catch (err) {
        saved = null;
      }
      delete e.dataset.ooRestore;
      if (!saved) return;
      e.style.transition = "none";
      e.style.transform = saved.transform;
      e.style.opacity = saved.opacity;
      e.style.animation = saved.animation;
      void e.offsetWidth;
      e.style.transition = saved.transition;
    });
  }

  // ── 재생기 ──────────────────────────────────────────────────────────
  var live = null;

  function play(mode) {
    var sky = document.getElementById("dawn-sky");
    if (!sky || !window.StellaBossArt) return;
    stop();
    var P = build(sky);
    live = { parts: P, timers: [], raf: 0, sky: sky };

    if (reducedMotion()) {
      // 움직임 없이 한 장. 존재는 이미 오른쪽 여백에 서 있다.
      layout(P, { x: 0, bob: 0, rot: 0, scale: 1 });
      P.being.style.opacity = "0.22";
      P.anomaly.style.opacity = "0.5";
      return;
    }
    if (mode === "short") return playShort(P);
    // 전체 연출일 때만 잠근다. 약식은 짧고, 이미 본 사람이다.
    holdStart();
    setTimeout(showSkip, 1000);
    playV2(P, sky);
  }

  function at(ms, fn) {
    live.timers.push(setTimeout(fn, ms));
  }

  /* 몸의 자리. 눈이 오른쪽 여백에 오도록 역산한 원본 좌표를 그대로 쓴다:
     눈은 그림의 49%·37%, 몸 폭은 150vh → 눈까지 73.5vh, 위 여백 -17.5vh.
     x는 그 정지 지점 기준의 화면 폭 배율(-1.6 = 왼쪽 화면 밖). */
  function layout(P, s) {
    var H = window.innerHeight,
      W = window.innerWidth;
    var baseLeft = W - 130 - H * 1.5 * EYE_X;
    var baseTop = -H * 0.175;
    var px = Math.round(baseLeft + s.x * W),
      py = Math.round(baseTop + s.bob);
    var t =
      "translate(" +
      px +
      "px," +
      py +
      "px) rotate(" +
      s.rot.toFixed(2) +
      "deg) scale(" +
      s.scale.toFixed(3) +
      ")";
    P.being.style.transform = t;
    // 눈·그림자·고리는 몸에서 파생된다 — 따로 타이밍을 두면 어긋난다.
    var eyeX = px + H * 1.5 * EYE_X,
      eyeY = py + H * 1.5 * EYE_Y;
    P.eye = [eyeX, eyeY];
    P.eater.style.transform =
      "translate(" +
      Math.round(eyeX - H * 0.6) +
      "px," +
      Math.round(eyeY - H * 0.6) +
      "px)";
    if (P.glow)
      P.glow.style.transform =
        "translate(" +
        Math.round(eyeX - H * 0.66 + H * 0.06) +
        "px," +
        Math.round(eyeY - H * 0.66 + H * 0.08) +
        "px)";
    P.rings.style.transform =
      "translate(" + Math.round(eyeX) + "px," + Math.round(eyeY) + "px)";
    P.sweep.style.transform = "translateX(" + Math.round(px + H * 0.2) + "px)";
    return { px: px, py: py };
  }

  function dust(P, x) {
    var d = el(
      "div",
      "position:absolute;left:" +
        Math.round(x) +
        "px;bottom:2%;width:120px;height:6px;transform:translate(-50%,0);" +
        "background:radial-gradient(ellipse at 50% 100%,#2c4a4ecc,transparent 70%);" +
        "animation:oo2Dust 1.1s ease-out forwards",
      P.layer,
    );
    setTimeout(function () {
      d.remove();
    }, 1200);
  }
  function jolt(P) {
    P.grid.classList.remove("oo2-jolt");
    void P.grid.offsetWidth;
    P.grid.classList.add("oo2-jolt");
  }
  function ringPulse(P, delay) {
    P.rings.style.opacity = "1";
    Array.prototype.forEach.call(P.rings.children, function (c, i) {
      c.style.animation = "none";
      void c.offsetWidth;
      c.style.animation =
        "oo2Ring 1.5s cubic-bezier(.3,.1,.2,1) " +
        (delay + i * 0.18) +
        "s 1 forwards";
    });
  }

  /* ── v2 6비트 ───────────────────────────────────────────────────────
     1 정적 0.0–0.9 · 2 이상 0.9–2.3 · 3 통과 2.3–6.1
     4 정지 6.1–7.7 · 5 붙잡음 7.7–9.5 · 6 점등 9.3–11.2 */
  function playV2(P, sky) {
    var IN = -1.62,
      OUT = 0.66;
    var st = { x: IN, bob: 0, rot: 0, scale: 1, phase: "idle" };
    layout(P, st);
    P.claw = buildClaw();

    var t0 = performance.now();
    var lastStep = -1,
      lastFrame = -1,
      hist = [];

    function ease(u) {
      /* 통과 공식. 이전에는 u=0.72에서 식을 갈았기 때문에 그 지점에서 속도가
         확 꺾여 「끊긴다」로 읽혔다. 한 식으로 이었고, 오버슈트도 sin으로
         감쇠도 끊기지 않게 넣어 속도가 어디서도 점프하지 않는다. */
      var p = 1 - Math.pow(1 - u, 3.1);
      return p + 0.028 * Math.sin(Math.PI * Math.min(1, u * 1.02));
    }

    function loop(now) {
      if (!live) return;
      var t = (now - t0) / 1000;
      var qf = Math.floor(t * FPS); // 몸의 프레임 번호
      if (qf !== lastFrame) {
        lastFrame = qf;
        var qt = qf / FPS;
        var walking = st.phase === "pass" || st.phase === "exit";
        var gait = Math.sin(qt * STEP_HZ * Math.PI * 2);
        if (st.phase === "pass") {
          var u = Math.min(1, Math.max(0, (qt - 2.3) / 3.8));
          st.x = IN + (0 - IN) * ease(u);
          st.scale = 1 + 0.055 * u;
          st.bob = -Math.abs(gait) * 7.5 - 2;
          st.rot = gait * 0.42;
          // 착지: 반주기마다 한 번. 하늘 흔들림은 드문드문 넣어야 건물이
          // 진동하는 것으로 읽힌다 — 매 걸음이면 화면 전제가 떨려 끊긴다.
          var step = Math.floor(qt * STEP_HZ * 2);
          if (step !== lastStep) {
            lastStep = step;
            if (u > 0.06 && u < 0.995) {
              dust(P, P.eye ? P.eye[0] - window.innerHeight * 0.2 : 0);
              if (step % 2 === 0) jolt(P);
            }
          }
        } else if (st.phase === "hold") {
          // 정지해도 프레임은 산다: 아주 느린 호흡과 미세한 기울기.
          var b = Math.sin(qt * 1.15);
          st.bob = b * 2.4 - 2;
          st.rot = b * 0.08;
        } else if (st.phase === "exit") {
          var v = Math.min(1, Math.max(0, (qt - 10.4) / 2));
          st.x = 0 + OUT * (v * v * (3 - 2 * v));
          st.scale = 1.055 - 0.1 * v;
          st.bob = -Math.abs(gait) * 5 - 2;
          st.rot = gait * 0.3;
        } else if (st.phase === "rest") {
          var s2 = Math.sin(qt * 0.5);
          st.bob = s2 * 3 - 2;
          st.rot = s2 * 0.05;
        }
        layout(P, st);
        // 잔상: 최근 프레임의 자리를 3겹으로 늦게 따라간다.
        hist.unshift(P.being.style.transform);
        if (hist.length > 10) hist.pop();
        for (var i = 0; i < P.echoes.length; i++) {
          var h = hist[(i + 1) * 3];
          if (!h) continue;
          P.echoes[i].style.transform = h;
          P.echoes[i].style.opacity = walking
            ? String((0.16 - i * 0.045).toFixed(3))
            : "0";
        }
      }
      live.raf = requestAnimationFrame(loop);
    }
    live.raf = requestAnimationFrame(loop);

    /* 비트 1 · 정적 (§2-1). 아직 아무 일도 없다는 것을 말로 먼저 세운다 —
       뒤에 오는 「간격이 틀렸다」가 대비를 가지려면 기준이 있어야 한다. */
    var C = buildCine();
    at(30, function () {
      cineBars(C, true);
      cineCaption(
        C,
        "OBSERVATION LOG — 04:17",
        "마지막 천문대, 여느 때와 같은 밤.",
      );
    });

    // 비트 2 · 관측 이상. 점이 한 번에 켜지지 않고 계단으로 들어온다.
    at(900, function () {
      cineCaption(C, "ANOMALY", "…별의 간격이, 틀렸다.");
      P.anomaly.style.opacity = "1";
      Array.prototype.forEach.call(P.grid.children, function (c, i) {
        c.style.opacity = "0";
        c.style.transition = "opacity .12s steps(1)";
        setTimeout(function () {
          c.style.opacity = "1";
        }, i * 55);
      });
      ringPulse(P, 0.2);
    });

    // 비트 3 · 통과. 그림자가 몸보다 먼저 도착한다.
    at(2300, function () {
      st.phase = "pass";
      P.sweep.style.transition = "opacity 1.1s ease-out";
      P.sweep.style.opacity = "0.9";
      P.eater.style.transition = "opacity 1.4s ease-out";
      P.eater.style.opacity = "0.92";
      P.glow.style.transition = "opacity 1.6s ease-out";
      P.glow.style.opacity = "1";
      P.being.style.transition = "opacity .9s ease-in";
      P.being.style.opacity = "0.86";
      startleProps(sky);
    });

    // 비트 4 · 눈이 멈춘다. 동공이 4프레임으로 조여든다.
    at(6100, function () {
      st.phase = "hold";
      P.anomaly.style.opacity = "0.4";
      P.sweep.style.opacity = "0.34";
      [0, 130, 260, 390].forEach(function (d, i) {
        at(d, function () {
          P.being.src = i === 0 ? P.wide : P.tight[i - 1];
        });
      });
      ringPulse(P, 0);
      /* 아이컷 인서트 (§2-1). 멀리 있는 몸의 동공이 조여드는 것만으로는
         「눈이 마주쳤다」가 읽히지 않는다 — 화면을 덮고 눈만 크게 넣는다.
         플래시로 하드컷을 만든다. 크로스페이드는 픽셀을 뭉갠다(§1-3). */
      cineFlash();
      /* 시안은 빈 하늘 위에 인서트를 얹지만 게임은 «타이틀 위»다. 0.86으로는
         워드마크와 CTA가 비쳐 인서트가 아니라 겹쳐 어질러진 화면으로 읽힌다
         — 실제로 「인트로 때 UI가 가린다」는 제보가 그것이었다. 완전히 덮어야
         하드컷이 된다. 건너뛰기(z-index 70)는 그대로 위에 남는다. */
      C.veil.style.opacity = "0.985";
      C.eye.style.transition = "opacity .2s steps(2)";
      C.eye.style.opacity = "1";
      [0, 150, 300, 450].forEach(function (d, i) {
        at(d, function () {
          C.frame.style.backgroundPosition = -i * 288 + "px 0";
        });
      });
      C.ring1.style.animation =
        "oo2Contract 1.2s cubic-bezier(.3,.1,.2,1) both";
      C.ring2.style.animation =
        "oo2Contract 1.2s cubic-bezier(.3,.1,.2,1) .16s both";
      cineCaption(C, "CONTACT", "저쪽이 먼저, 이쪽을 보았다.");
    });
    // 알아본 뒤 한 번 더 조인다 — 이 반복이 「보고 있다」를 확정한다.
    at(7100, function () {
      P.being.src = P.tight[1];
      at(120, function () {
        P.being.src = P.tight[2];
      });
      // 인서트 쪽도 같이 조인다. 두 화면이 어긋나면 같은 눈으로 안 읽힌다.
      C.frame.style.backgroundPosition = "-576px 0";
      at(120, function () {
        C.frame.style.backgroundPosition = "-864px 0";
      });
      C.ring1.style.animation = "none";
      void C.ring1.offsetWidth;
      C.ring1.style.animation = "oo2Contract .8s cubic-bezier(.3,.1,.2,1) both";
    });

    // 비트 5 · 붙잡는다. 예비동작 → 스냅 → 그립 플렉스.
    function shake(cls) {
      var m = document.querySelector("main");
      if (!m) return;
      m.classList.remove("oo2-shake", "oo2-squeeze", "oo2-kick");
      void m.offsetWidth;
      m.classList.add(cls);
    }
    at(7700, function () {
      claw(P, "in");
      // 위에서 한 번, 0.18초 뒤 아래에서 한 번. 한 번에 물면 타격이 한 번이지만,
      // 엇갈리면 관측창이 잡힐 때까지 둘째 발톱을 기다리게 된다.
      at(280, function () {
        claw(P, "bite", 0);
        shake("oo2-shake");
        chips(P, 14, "tr");
        jolt(P);
        // 여기까지가 이 연출이 하려는 말이다. 흔드는 순간 시작 버튼을 푼다.
        releaseStart();
      });
      at(460, function () {
        claw(P, "bite", 1);
        shake("oo2-shake");
        chips(P, 14, "bl");
        jolt(P);
      });
      at(1150, function () {
        claw(P, "squeeze");
        shake("oo2-squeeze");
        chips(P, 8, "tr");
        chips(P, 8, "bl");
      });
      at(1650, function () {
        claw(P, "hold");
      });
      at(2000, function () {
        claw(P, "squeeze");
        shake("oo2-squeeze");
        chips(P, 8, "tr");
        chips(P, 8, "bl");
        jolt(P);
      });
      at(2500, function () {
        claw(P, "open");
        shake("oo2-kick");
        chips(P, 12, "tr");
        chips(P, 12, "bl");
      });
      at(2650, function () {
        claw(P, "out");
      });
    });

    // 비트 6 · 점등. 발톱이 놓고, 몸은 속도선을 남기고 빠져나간다.
    at(10400, function () {
      cineFlash();
      C.veil.style.opacity = "0";
      C.eye.style.opacity = "0";
      C.cap.style.opacity = "0";
      claw(P, "out");
      st.phase = "exit";
      streaks(P);
      P.eater.style.transition = "opacity 1.8s ease-in";
      P.eater.style.opacity = "0";
      P.glow.style.transition = "opacity 1.8s ease-in";
      P.glow.style.opacity = "0.25";
      P.sweep.style.opacity = "0";
      P.being.style.transition = "opacity 1.8s ease-in";
      P.being.style.opacity = "0.15";
      P.anomaly.style.opacity = "0.18";
      P.being.src = P.wide;
    });
    /* 비트 7 · 없는 별 (디자인 세션 §10). 하늘이 제자리로 돌아왔는데 별 하나가
       없다 — 빈 좌표만 남는다. 그 자리가 8번째 월드, WORLDS의 「관측되지 않은
       점」(bayer ∅, 1600 HP, 4인 파티)이다. 첫 실행 30초에 본 빈 자리가 7-7을
       깨고 나서 열린다 — 새 서사가 아니라 이미 코드에 있는 것을 미리 보여
       주는 것이다.
       새 CSS 애니메이션을 더하지 않는다. 도는 별 하나를 «끄는» 것이다 —
       타이틀에 이미 141개가 도는데 전투에는 사실상 없으므로, 여기서 늘리면
       잘못된 쪽을 더 채운다. */
    at(10200, function () {
      window.StellaDawnSky?.missingStar(true);
    });
    /* 레터박스는 타이틀 리빌 직전에 열린다 — 화면이 넓어지는 것 자체가
       「관측이 끝났다」는 신호다(§2-1 9300 점등). */
    at(11900, function () {
      cineBars(C, false);
    });
    at(12300, function () {
      // 흔들림 클래스는 반드시 벗긴다. main에 transform이 남으면
      // position:fixed 전체화면 오버레이가 캔버스 폭에 갇힌다.
      var m = document.querySelector("main");
      if (m) m.classList.remove("oo2-shake", "oo2-squeeze", "oo2-kick");
      if (P.claw)
        P.claw.forEach(function (c) {
          c.rig.style.opacity = "0";
        });
      st.phase = "rest";
      // 연출이 끝나면 건너뛸 것이 없다. stop()에만 걸어 두면 타이틀에 머무는
      // 동안 버튼이 계속 남는다.
      hideSkip();
      // 흔적: 등간격 점 중 셋만 남는다. 하늘은 원래대로 돌아오지 않는다.
      Array.prototype.forEach.call(P.grid.children, function (c, i) {
        c.style.transition = "opacity .8s ease-out";
        c.style.opacity = i % 6 === 0 ? "1" : "0";
      });
      P.anomaly.style.opacity = "0.55";
      P.rings.style.opacity = "0";
    });
  }

  // 짚은 모서리에서 튀는 픽셀 파편. 어둡고 작아서 CTA보다 밝아지지 않는다.
  function chips(P, count, corner) {
    var m = document.querySelector("main");
    if (!m) return;
    var n = count || 14,
      bottom = corner === "bl";
    var r = m.getBoundingClientRect(),
      host = el(
        "div",
        "position:fixed;z-index:2;left:" +
          Math.round(bottom ? r.left + 18 : r.right - 18) +
          "px;top:" +
          Math.round(bottom ? r.bottom - 22 : r.top + 22) +
          "px;pointer-events:none",
        document.body,
      );
    host.className = "oo2-chips";
    for (var i = 0; i < n; i++) {
      var a = bottom
          ? 0.2 + Math.random() * 2.2 // 아래 모서리는 아래·오른쪽으로 튄다
          : -0.2 - Math.random() * 2.2,
        d = 30 + Math.random() * 70;
      el(
        "i",
        "position:absolute;width:" +
          (2 + (i % 3 | 0)) +
          "px;height:2px;background:" +
          (i % 4 ? "#2c4a4e" : "#4d7f80") +
          ";--cx:" +
          Math.round(Math.cos(a) * d) +
          "px;--cy:" +
          Math.round(Math.sin(a) * d) +
          "px;animation:oo2Chip " +
          (0.5 + Math.random() * 0.5).toFixed(2) +
          "s ease-out forwards",
        host,
      );
    }
    setTimeout(function () {
      host.remove();
    }, 1200);
  }

  // 퇴장 속도선. 몸이 지나간 높이에만 그린다.
  function streaks(P) {
    for (var i = 0; i < 7; i++) {
      var y = 14 + i * 11 + Math.random() * 6;
      el(
        "div",
        "position:absolute;right:2%;top:" +
          y.toFixed(1) +
          "%;width:" +
          (10 + Math.random() * 26).toFixed(0) +
          "vw;height:2px;transform-origin:100% 50%;" +
          "background:linear-gradient(90deg,transparent,#4d7f8099);" +
          "animation:oo2Streak " +
          (0.8 + Math.random() * 0.6).toFixed(2) +
          "s ease-out " +
          (i * 0.06).toFixed(2) +
          "s forwards",
        P.layer,
      );
    }
    setTimeout(function () {
      P.layer.querySelectorAll('[style*="oo2Streak"]').forEach(function (n) {
        n.remove();
      });
    }, 2200);
  }

  function stop() {
    if (live) {
      live.timers.forEach(clearTimeout);
      if (live.typeIv) clearInterval(live.typeIv);
      cancelAnimationFrame(live.raf);
      live = null;
    }
    var l = document.getElementById(LAYER_ID);
    if (l) l.remove();
    document.querySelectorAll(".oo2-chips").forEach(function (n) {
      n.remove();
    });
    var m = document.querySelector("main");
    if (m) m.classList.remove("oo2-shake", "oo2-squeeze", "oo2-kick");
    releaseStart();
    hideSkip();
    // 발톱은 body 직계라 레이어와 같이 지워지지 않는다.
    document.querySelectorAll(".oo2-claw").forEach(function (n) {
      n.remove();
    });
    document.querySelectorAll(".oo2-cine").forEach(function (n) {
      n.remove();
    });
    restoreProps();
  }

  /* 같은 세션 재진입은 약식이다 — 통과도 발톱도 없이, 이번엔 이미 지나간
     자리에 잔상만 남은 하늘을 보여 준다. 매번 긴 컷신을 강제하지 않는다. */
  function playShort(P) {
    var st = { x: 0, bob: -2, rot: 0, scale: 1 };
    layout(P, st);
    P.being.src = P.tight[2];
    P.being.style.transition = "opacity 1.4s ease-out";
    P.glow.style.transition = "opacity 1.4s ease-out";
    P.eater.style.transition = "opacity 1.4s ease-out";
    P.sweep.remove();
    P.echoes.forEach(function (e) {
      e.remove();
    });
    setTimeout(function () {
      P.being.style.opacity = "0.2";
      P.glow.style.opacity = "0.5";
      P.eater.style.opacity = "0.5";
      P.anomaly.style.opacity = "0.5";
      ringPulse(P, 0.4);
    }, 120);
    var t0 = performance.now();
    (function loop(now) {
      if (!live) return;
      var t = (now - t0) / 1000,
        s = Math.sin((Math.floor(t * FPS) / FPS) * 0.5);
      st.bob = s * 3 - 2;
      st.rot = s * 0.05;
      layout(P, st);
      live.raf = requestAnimationFrame(loop);
    })(performance.now());
  }

  /* 게임에 드롭인할 때를 위한 자동 재생. 원본과 같이 타이틀이 DOM에
     나타나는 것만 보고 재생하고 런타임 훅은 걸지 않는다.
     QA용으로는 window.StellaIntroObserver.play() / .stop()을 쓴다. */
  /* 「첫 실행 때만」이 되려면 저장소가 세션이 아니라 설치 단위여야 한다.
     sessionStorage는 탭을 새로 열 때마다 비므로, 이 연출은 첫 실행 한정이
     아니라 «탭마다 한 번»이었다. 두 번째부터는 지금처럼 약식(short)이 돈다. */
  var SESSION_KEY = "stella-ball.outer-observer.played";
  function played() {
    try {
      return (
        localStorage.getItem(SESSION_KEY) === "1" ||
        sessionStorage.getItem(SESSION_KEY) === "1"
      );
    } catch (e) {
      return false;
    }
  }
  function markPlayed() {
    try {
      localStorage.setItem(SESSION_KEY, "1");
    } catch (e) {
      try {
        sessionStorage.setItem(SESSION_KEY, "1");
      } catch (e2) {}
    }
  }

  /* 시작 버튼을 연출이 끝날 때까지 잠근다. 처음 온 사람이 가장 먼저 하는
     행동이 「버튼을 찾아 누르기」인데, 그 버튼이 살아 있으면 그 행동이 곧
     연출을 건너뛰는 행동이 된다 — 보라고 만든 것을 보지 못한다.
     푸는 시점은 발톱이 관측창을 붙잡고 흔드는 순간(7700+280ms)이다. 그때까지가
     이 연출이 하려는 말이고, 그 뒤로는 퇴장이라 기다리게 할 이유가 없다.
     안전장치를 함께 둔다: 무슨 일이 있어도 9.5초 뒤에는 풀린다. 연출이 실패해도
     플레이어가 갇히면 안 된다. 튜토리얼 버튼은 잠그지 않는다 — 그쪽을 누르는
     사람은 건너뛰는 게 아니라 참여하는 것이다. */
  /* CTA 정책 충돌의 타협안(§10-2). 인트로 스펙 §5는 「CTA는 연출 완료를
     기다리지 않고 접근 가능해야 한다」이고, 오너 지시는 「흔들기 전까지는
     게임 시작 비활성」이다. 둘 다 지킨다 —
       · 「건너뛰기」는 1.0초부터 «항상» 활성 (스펙의 접근성 의도)
       · 「게임 시작」은 비트 5(발톱이 짚는 순간)부터 활성 (오너의 의도)
     건너뛰면 즉시 타이틀로 가고 시작 버튼도 함께 켜진다. 갇히는 사람이 없다. */
  var skipNode = null;
  function showSkip() {
    if (skipNode) return;
    skipNode = document.createElement("button");
    skipNode.className = "oo2-skip";
    skipNode.type = "button";
    skipNode.textContent = "건너뛰기";
    skipNode.addEventListener("click", function () {
      stop();
      markPlayed();
    });
    document.body.appendChild(skipNode);
  }
  function hideSkip() {
    if (!skipNode) return;
    skipNode.remove();
    skipNode = null;
  }
  var holdTimer = 0;
  function startButton() {
    return document.getElementById("enterHub");
  }
  /* 버튼을 잠그는 것만으로는 부족했다 — 잠긴 「관측 시작」이 컷신 내내 화면에
     떠 있어서 연출 위에 UI가 겹쳐 보였다(제보). 규격도 타이틀 리빌을 「컷신
     종료 직후」로 두므로, 잠그는 동안에는 타이틀 문안 자체를 감춘다.
     푸는 시점은 그대로다(발톱이 관측창을 잡는 7700+280ms). 그 순간 타이틀이
     리빌 연출과 함께 들어온다 — 보이는 때와 누를 수 있는 때가 같아진다. */
  function holdStart() {
    var b = startButton();
    if (b) {
      b.disabled = true;
      b.setAttribute("aria-disabled", "true");
    }
    document.body.classList.add("oo-intro");
    clearTimeout(holdTimer);
    holdTimer = setTimeout(releaseStart, 9500);
  }
  function releaseStart() {
    clearTimeout(holdTimer);
    holdTimer = 0;
    var b = startButton();
    if (b) {
      b.disabled = false;
      b.removeAttribute("aria-disabled");
    }
    if (document.body.classList.contains("oo-intro")) {
      document.body.classList.remove("oo-intro");
      // 감춰 둔 동안 리빌을 미뤄 두었다. 이제 한 번 돌린다.
      window.StellaTitleReveal?.();
    }
  }
  function watch() {
    var seen = false;
    var observer = null;
    var pending = 0;
    function check() {
      /* 존재 여부만으로는 부족하다. 타이틀을 떠나도 마크업은 오버레이 안에
         `display:none`으로 남아 있어서 이 셀렉터가 계속 맞고, 그래서 stop()이
         한 번도 불리지 않았다 — 인트로 레이어와 눈금 고리 두 개가 전투 내내
         #dawn-sky에서 계속 합성됐다. 보이는지까지 확인한다. */
      pending = 0;
      var node = document.querySelector(".title-sequence");
      var on = !!(node && node.offsetParent !== null);
      if (on === seen) return;
      seen = on;
      if (!on) {
        /* 타이틀은 다시 돌아오지 않는다. 감시를 끊지 않으면 이 옵저버가 남은
           세션 내내 body의 모든 childList 변경마다 깨어난다. */
        if (observer) observer.disconnect();
        observer = null;
        return stop();
      }
      play(played() ? "short" : "v2");
      markPlayed();
    }
    /* `offsetParent` 읽기는 문서 전체의 강제 동기 레이아웃이다. 이걸 옵저버
       콜백에서 곧바로 하면 body 아래 어디서든 노드가 하나 붙고 떨어질 때마다
       레이아웃이 한 번씩 돈다. 타이틀이 나타나고 사라지는 건 초 단위 사건이니
       프레임 뒤로 미뤄 한 번만 재도 결과는 같다. */
    function scheduleCheck() {
      if (pending) return;
      pending = setTimeout(check, 150);
    }
    observer = new MutationObserver(scheduleCheck);
    observer.observe(document.body, { childList: true, subtree: true });
    check();
  }

  /* 프레임을 미리 구워 둔다. 360px 절차적 픽셀 5장 + toDataURL이 2초 가까이
     메인 스레드를 잡으므로, 재생 시점에 구우면 비트 1~3이 통째로 밀린다.
     타이틀은 그 사이에도 정상적으로 보이고, 재생은 다 구운 뒤에 시작한다. */
  var warmed = false;
  function warm() {
    if (!window.StellaBossArt) return setTimeout(warm, 60);
    var jobs = [
      function () {
        bakeBeing(1);
      },
      function () {
        bakeBeing(0.74);
      },
      function () {
        bakeBeing(0.56);
      },
      function () {
        bakeBeing(0.42);
      },
      function () {
        bakeCache.arm = ART.arm(RIG);
      },
      function () {
        bakeCache.digitBig = ART.digit(RIG, true);
      },
      function () {
        bakeCache.digitSm = ART.digit(RIG, false);
      },
    ];
    (function next(i) {
      if (i >= jobs.length) {
        warmed = true;
        return;
      }
      jobs[i]();
      setTimeout(function () {
        next(i + 1);
      }, 16);
    })(0);
  }
  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", function () {
      warm();
      watch();
    });
  else {
    setTimeout(warm, 0);
    watch();
  }

  window.StellaIntroObserver = {
    play: play,
    stop: stop,
    isWarm: function () {
      return warmed;
    },
  };
})();
