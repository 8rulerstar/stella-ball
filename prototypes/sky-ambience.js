/* Stella Ball — 여백 하늘 · 이벤트 연출 시안 (design session, 2026-08-15)
   SKY_AMBIENCE_REQUEST_2026_08_14.md 산출물 1~5의 실행 가능한 제안 레이어.
   #dawn-sky의 자식으로 붙는다(모션 감소 규약 #dawn-sky * 적용을 받기 위함).
   전투 로직·판정색·입력에 관여하지 않는다. pointer-events:none 기본.

   반입 시 원본에서 세 가지를 조정했다 (2026-08-15).
     · 걸이 별자리를 시안의 황도 12궁 이름에서 이 게임의 실제 7월드
       (양자리3·화살자리4·까마귀자리4·카시오페이아5·백조자리5·오리온6·북두칠성7)로
       교체했다. META_UI_REQUEST 1-2와 같은 데이터를 쓰기 위한 전제다.
     · 데모 진행 상태(world:3, cleared:2)를 0으로 낮췄다. 새 설치가 되찾지 않은
       별자리를 걸어 두면 안 된다. 실제 값은 승인 뒤 setProgress로 잇는다.
     · postMessage 브리지를 제거했다. origin 검사 없는 외부 제어 표면이고
       README의 반입 절차에도 없다. QA는 window.SkyAmbience를 직접 부른다. */
(function () {
  "use strict";
  var RM = false;
  try {
    RM = matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch (e) {}

  var COL = {
    far: "#7cc6bb",
    mid: "#cfe8e0",
    warm: "#ffd2a0",
    void: "#0a0f12",
  };
  // 계층 규약: 시차 계수 / 불투명도 상한 / 입력
  var LAYERS = [
    { id: "L0", name: "먼 배경", par: 0.15, alpha: 0.1, input: false },
    { id: "L1", name: "중간 천체", par: 0.45, alpha: 0.38, input: false },
    { id: "L2", name: "가까운 소품", par: 1.0, alpha: 1.0, input: true },
  ];

  var sky, root, l0, l1, l2, hud, state;
  var cooldownUntil = 0;

  function el(parent, css, tag) {
    var d = document.createElement(tag || "div");
    d.style.cssText = css;
    parent.appendChild(d);
    return d;
  }

  function build() {
    sky = document.getElementById("dawn-sky");
    if (!sky || document.getElementById("sky-ambience")) return;
    root = el(sky, "position:absolute;inset:0;pointer-events:none");
    root.id = "sky-ambience";
    /* 항상 #dawn-sky의 첫 자식으로 둔다. 인트로의 oo2-layer는 z-index:0이고
       이 레이어는 auto라 같은 층에서는 DOM 순서가 위아래를 정하는데, 리로드
       직후에는 인트로가 이 build(+60ms)보다 먼저 레이어를 만들어 이 시안이
       인트로 위에 얹히는 경합이 있었다. 첫 자식이면 어느 쪽이 먼저 붙어도
       기존 별·소품·인트로가 전부 위에 그려진다. */
    sky.insertBefore(root, sky.firstChild);

    l0 = el(root, "position:absolute;inset:0;opacity:" + LAYERS[0].alpha);
    l1 = el(root, "position:absolute;inset:0;opacity:" + LAYERS[1].alpha);
    l2 = el(root, "position:absolute;inset:0");
    l0.dataset.skyLayer = "L0";
    l1.dataset.skyLayer = "L1";
    l2.dataset.skyLayer = "L2";

    /* ── L0 먼 배경 ─────────────────────────────────
       성운 2점 + 은하수 띠. 대비 상한 0.10, 6분 주기 드리프트.
       filter:blur는 쓰지 않는다 — dpr 2에서 600×480급 표면을 18~20px 커널로
       상시 재합성하는 비용이 전투 프레임을 실제로 깎았다(2026-08-15 렉 제보).
       부드러움은 그라데이션 정지점을 넓혀 같은 인상으로 굽는다. */
    el(
      l0,
      "position:absolute;left:2%;top:22%;width:300px;height:240px;border-radius:50%;" +
        "background:radial-gradient(ellipse at 50% 50%,#7cc6bb55,#5b9a9026 34%,#47837c14 58%,transparent 82%)" +
        (RM ? "" : ";animation:skyDriftA 360s linear infinite"),
    );
    el(
      l0,
      "position:absolute;right:1%;top:44%;width:260px;height:220px;border-radius:50%;" +
        "background:radial-gradient(ellipse at 50% 50%,#eea56f40,#c87d4a1d 36%,#b06a3d10 60%,transparent 84%)" +
        (RM ? "" : ";animation:skyDriftB 420s linear infinite"),
    );
    /* 먼 별점은 여기서 만들지 않는다. stella-ball-dawn.js의 별밭이 이미 전체
       화면에 뿌려져 여백까지 덮고, 두 벌을 각자 캔버스로 두면 전체 화면 텍스처가
       한 장 더 늘어난다 — 레이어 수를 줄이려다 면적을 늘리는 맞바꿈이 된다.
       밀도가 모자라면 그쪽 별 개수를 올린다. */

    /* ── L1 중간 천체 ───────────────────────────────
       되찾은 별자리 걸이 7점(META_UI_REQUEST 1-2의 노드 상태 4종과 같은 데이터).
       눈금 고리 1개(5점 별자리 반응이 수축시키는 대상). */
    state = { world: 0, cleared: 0, perfect: 0 };
    root.__hangers = [];
    /* 배치는 화면 폭이 아니라 관측소 컬럼(main)의 좌우 경계에서 산출한다.
       타이틀은 컬럼 920px(여백 180px씩), 허브·지도는 506px(387px씩)로 서로 다르다.
       side = 어느 여백, f = 그 여백을 0~1로 나눈 위치.
       w = 그 월드의 실제 스테이지 수(캠페인 3→4→4→5→5→6→7). */
    var HANG = [
      { n: "양자리", side: "L", f: 0.3, y: 62, w: 3 },
      { n: "화살자리", side: "L", f: 0.62, y: 79, w: 4 },
      { n: "까마귀자리", side: "L", f: 0.5, y: 33, w: 4 },
      { n: "카시오페이아", side: "R", f: 0.34, y: 30, w: 5 },
      { n: "백조자리", side: "R", f: 0.6, y: 60, w: 5 },
      { n: "오리온자리", side: "R", f: 0.42, y: 82, w: 6 },
      { n: "북두칠성", side: "R", f: 0.55, y: 10, w: 7 },
    ];
    for (var h = 0; h < HANG.length; h++)
      root.__hangers.push(hanger(l1, HANG[h], h));
    paintHangers();

    var ring = el(
      l1,
      "position:absolute;top:26%;width:170px;height:170px;border-radius:50%;" +
        "border:1px solid #7cc6bb55;box-shadow:inset 0 0 0 9px #7cc6bb0f,0 0 0 15px #7cc6bb0a",
    );
    ring.id = "sky-gauge-ring";
    for (var t = 0; t < 24; t++) {
      var a = (t / 24) * Math.PI * 2;
      el(
        ring,
        "position:absolute;left:" +
          (85 + Math.cos(a) * 85 - 1).toFixed(1) +
          "px;top:" +
          (85 + Math.sin(a) * 85 - 3).toFixed(1) +
          "px;width:2px;height:" +
          (t % 6 === 0 ? 7 : 4) +
          "px;background:" +
          COL.far +
          ";opacity:" +
          (t % 6 === 0 ? 0.7 : 0.4) +
          ";transform:rotate(" +
          ((a * 180) / Math.PI + 90).toFixed(1) +
          "deg)",
      );
    }

    /* ── L2 가까운 소품 ─────────────────────────────
       기존 stella-ball-dawn.js의 소품을 관측소 설정 하나로 묶는다.
       망원경 = 관측 도구, 나침반 = 다음 사건의 방위. */
    hud = el(
      l2,
      "position:absolute;left:50%;bottom:14px;transform:translateX(-50%);" +
        "font:10px Galmuri11,ui-monospace,monospace;color:#8ba39f;letter-spacing:.04em;" +
        "text-shadow:0 1px 0 #04080a;opacity:0;transition:opacity .4s",
    );
    wireProps();
    layoutBands();
    addEventListener("resize", layoutBands);

    /* 시안의 rAF 시차 드리프트(±12px, 6분 주기)는 여기서 부르지 않는다.
       매 프레임 l0·l1의 transform을 새로 쓰면 그 아래 모든 레이어가 프레임마다
       재합성돼 전투 내내 GPU가 쉬지 못했고, 움직임 자체는 6분에 12px라 눈에
       보이지도 않았다. 계층감은 성운의 CSS 드리프트가 이미 만든다. */
    if (!RM) schedule();
  }

  /* 걸이 하나 = 되찾은 별자리 한 점. 상태 4종을 대비로만 구분한다. */
  function hanger(parent, def, idx) {
    var c = document.createElement("canvas");
    c.width = def.w * 14 + 10;
    c.height = 46;
    c.style.cssText =
      "position:absolute;left:0;top:" +
      def.y +
      "%;transform:translate(-50%,-50%);image-rendering:pixelated;display:block;width:" +
      (def.w * 14 + 10) +
      "px;height:46px";
    c.dataset.name = def.n;
    parent.appendChild(c);
    def.idx = idx;
    c.__def = def;
    return c;
  }
  /* 여백 폭이 화면마다 달라도 소품이 컬럼 위로 올라오지 않게 매 리사이즈마다 재배치한다. */
  function layoutBands() {
    var m = document.querySelector("main");
    if (!m || !root) return;
    var r = m.getBoundingClientRect(),
      vw = window.innerWidth;
    var L = { a: 8, b: Math.max(8, r.left - 8) },
      R = { a: Math.min(vw - 8, r.right + 8), b: vw - 8 };
    root.__band = { L: L, R: R };
    var hs = root.__hangers || [];
    for (var i = 0; i < hs.length; i++) {
      var d = hs[i].__def,
        band = d.side === "L" ? L : R,
        span = Math.max(0, band.b - band.a);
      var x = band.a + span * d.f;
      hs[i].style.left = Math.round(x) + "px";
      hs[i].style.opacity = span < 120 ? "0" : "";
    }
    var ring = document.getElementById("sky-gauge-ring");
    if (ring) ring.style.left = Math.round(R.a + (R.b - R.a) / 2 - 85) + "px";
  }

  function paintHangers() {
    var hs = root.__hangers || [];
    for (var i = 0; i < hs.length; i++) {
      var c = hs[i],
        d = c.__def,
        g = c.getContext("2d");
      g.clearRect(0, 0, c.width, c.height);
      // 노드 상태 4종 → 걸이 4단계
      var st =
        i < state.perfect
          ? 3
          : i < state.cleared
            ? 2
            : i < state.world - 2
              ? 1
              : 0;
      if (st === 0) continue;
      var col = st === 3 ? COL.warm : st === 2 ? COL.mid : COL.far;
      var alpha = st === 3 ? 0.9 : st === 2 ? 0.6 : 0.28;
      g.globalAlpha = alpha;
      g.strokeStyle = col;
      g.fillStyle = col;
      g.lineWidth = 1;
      g.beginPath();
      for (var p = 0; p < d.w; p++) {
        var px = 5 + p * 14,
          py = 12 + ((p * 7) % 22);
        if (p === 0) g.moveTo(px + 0.5, py + 0.5);
        else g.lineTo(px + 0.5, py + 0.5);
      }
      g.stroke();
      for (var q = 0; q < d.w; q++) {
        var qx = 5 + q * 14,
          qy = 12 + ((q * 7) % 22);
        g.fillRect(qx - 1, qy - 1, st === 1 ? 2 : 3, st === 1 ? 2 : 3);
      }
    }
  }

  /* ── 소품 상호작용 통합 ───────────────────────────
     망원경을 천체(달·행성·고리·걸이) 위에 놓으면 그 천체가 '관측'된다. */
  function wireProps() {
    var tele = document.querySelector('[data-dawn-prop="telescope"]');
    var comp = document.querySelector('[data-dawn-prop="compass"]');
    if (tele) {
      tele.addEventListener("pointerup", function () {
        setTimeout(observeUnderTelescope, 30);
      });
    }
    if (comp) comp.style.transition = "transform .8s ease-out";
    root.__compass = comp;
  }
  function observeUnderTelescope() {
    var tele = document.querySelector('[data-dawn-prop="telescope"]');
    if (!tele) return;
    var r = tele.getBoundingClientRect(),
      cx = r.left + r.width / 2,
      cy = r.top + r.height / 2;
    var found = null;
    var targets = (root.__hangers || []).concat(
      Array.prototype.slice.call(
        document.querySelectorAll(
          "#dawn-sky > canvas, #dawn-sky > div > canvas",
        ),
      ),
    );
    for (var i = 0; i < targets.length; i++) {
      var b = targets[i].getBoundingClientRect();
      if (!b.width) continue;
      if (
        cx > b.left - 40 &&
        cx < b.right + 40 &&
        cy > b.top - 60 &&
        cy < b.bottom + 60
      ) {
        found = targets[i];
        break;
      }
    }
    say(
      found
        ? "관측 · " + (found.dataset.name || "이름 없는 천체") + " ✦"
        : "관측 · 아무것도 없다",
    );
    if (found) {
      found.style.transition = "filter .5s";
      found.style.filter = "drop-shadow(0 0 6px #ffd2a0aa)";
      setTimeout(function () {
        found.style.filter = "";
      }, 1400);
    }
  }
  function say(txt) {
    if (!hud) return;
    hud.textContent = txt;
    hud.style.opacity = "1";
    clearTimeout(hud.__t);
    hud.__t = setTimeout(function () {
      hud.style.opacity = "0";
    }, 2600);
  }
  function pointCompass(deg) {
    var c = root.__compass;
    if (!c) return;
    c.style.transform = "rotate(" + deg + "deg)";
    setTimeout(function () {
      c.style.transform = "rotate(0deg)";
    }, 2600);
  }

  /* ── 자율 연출 주기 ─────────────────────────────
     짧음(1~3s 반짝임, CSS) / 중간(5~11s 유성·구름) / 긺(4~7분 천체 드리프트).
     같은 2초 창에 최소 하나의 변화가 오도록 중간 주기를 3슬롯으로 쪼갠다. */
  var slots = [
    { every: [5200, 7400], fn: driftCloud },
    { every: [6800, 11000], fn: quietMeteor },
    { every: [9000, 14000], fn: blinkPair },
  ];
  function schedule() {
    for (var i = 0; i < slots.length; i++) plan(slots[i], 1200 * (i + 1));
  }
  function plan(slot, delay) {
    setTimeout(function run() {
      slot.fn();
      setTimeout(
        run,
        slot.every[0] + Math.random() * (slot.every[1] - slot.every[0]),
      );
    }, delay);
  }
  function driftCloud() {
    var left = Math.random() < 0.5;
    var d = el(
      l0,
      "position:absolute;" +
        (left ? "left:-16%" : "right:-16%") +
        ";top:" +
        (10 + Math.random() * 70).toFixed(0) +
        "%;width:230px;height:70px;border-radius:50%;background:radial-gradient(ellipse,#cfe8e018,#cfe8e00a 45%,transparent 78%);animation:skyCloud " +
        (16 + Math.random() * 10).toFixed(0) +
        "s linear forwards",
    );
    setTimeout(function () {
      d.remove();
    }, 28000);
  }
  function quietMeteor() {
    var w = el(
      l0,
      "position:absolute;left:" +
        (Math.random() < 0.5
          ? 4 + Math.random() * 18
          : 74 + Math.random() * 18
        ).toFixed(0) +
        "%;top:" +
        (8 + Math.random() * 40).toFixed(0) +
        "%;transform:rotate(" +
        (16 + Math.random() * 20).toFixed(0) +
        "deg)",
    );
    el(
      w,
      "width:64px;height:2px;background:linear-gradient(90deg,transparent,#cfe8e0aa);animation:dawnMeteor 2.4s linear forwards",
    );
    setTimeout(function () {
      w.remove();
    }, 2600);
  }
  function blinkPair() {
    var hs = root.__hangers || [];
    if (!hs.length) return;
    var c = hs[(Math.random() * hs.length) | 0];
    c.style.transition = "opacity .5s";
    c.style.opacity = "0.45";
    setTimeout(function () {
      c.style.opacity = "1";
    }, 620);
  }
  /* ── 이벤트 → 배경 반응 ─────────────────────────
     전역 쿨다운 45초, 동시 1개. 전투 중 대비 상한 0.38. */
  function gate(force) {
    var now = performance.now();
    if (!force && now < cooldownUntil) return false;
    cooldownUntil = now + 45000;
    return true;
  }

  // (A) 5점 이상 별자리 현현 — 스펙 6절 미구현 1
  function reactFigure(points) {
    if (RM) return staticFallback("figure");
    say("현현 " + (points || 5) + "점 · 하늘이 비켜난다");
    // 1) 별이 존재의 윤곽을 피해 흐른다 — 32프레임(≈0.53s) 이동 + 0.9s 복귀
    var stars = l0.querySelectorAll("div");
    var cx = window.innerWidth / 2;
    for (var i = 0; i < stars.length; i++) {
      var s = stars[i];
      if (s.style.width !== "1px") continue;
      var r = s.getBoundingClientRect();
      var dir = r.left < cx ? -1 : 1;
      var dist = 6 + Math.random() * 10;
      s.style.transition = "transform .53s cubic-bezier(.2,.8,.3,1)";
      s.style.transform =
        "translate(" +
        dir * dist +
        "px," +
        (-4 + Math.random() * 8).toFixed(1) +
        "px)";
      (function (n) {
        setTimeout(function () {
          n.style.transition = "transform .9s ease-in-out";
          n.style.transform = "";
        }, 900);
      })(s);
    }
    // 2) 눈금 고리 1회 수축 — 0.42s 수축, 1.1s 이완
    var ring = document.getElementById("sky-gauge-ring");
    if (ring) {
      ring.style.transition =
        "transform .42s cubic-bezier(.3,0,.2,1),opacity .42s";
      ring.style.transform = "scale(.86)";
      ring.style.opacity = "1";
      setTimeout(function () {
        ring.style.transition = "transform 1.1s ease-out,opacity 1.1s";
        ring.style.transform = "";
        ring.style.opacity = "";
      }, 460);
    }
  }

  // (B) 월드 첫 진입 / 첫 보스 처치 — 스펙 6절 미구현 2
  function reactFrameAnomaly(kind) {
    if (RM) return staticFallback("anomaly");
    say(kind === "boss" ? "관측 이상 · 첫 처치" : "관측 이상 · 새 월드");
    // 별 하나 역행: 3.2초 동안 반대 방향으로 흐르고 제자리로
    var hs = l0.querySelectorAll("div");
    var pick = null;
    for (var i = 0; i < hs.length && !pick; i++)
      if (hs[i].style.width === "1px" && Math.random() < 0.06) pick = hs[i];
    pick = pick || hs[3];
    if (pick) {
      pick.style.width = "2px";
      pick.style.height = "2px";
      pick.style.background = COL.warm;
      pick.style.transition = "transform 3.2s linear,opacity .6s";
      pick.style.opacity = "1";
      pick.style.transform = "translateX(-34px)";
      setTimeout(function () {
        pick.style.transition = "transform 1.2s ease-out,opacity 1.2s";
        pick.style.transform = "";
        pick.style.width = "1px";
        pick.style.height = "1px";
        pick.style.background = COL.mid;
        pick.style.opacity = ".5";
      }, 3300);
    }
    // 성운 굴절: 렌즈처럼 한 번 휜다. transform만 쓴다 — blur 반경을 트랜지션
    // 하면 텍스처 캐시가 깨져 3초 내내 큰 표면을 매 프레임 다시 흐리게 된다.
    var neb = l0.firstElementChild;
    if (neb) {
      neb.style.transition = "transform 1.4s ease-in-out";
      neb.style.transform = "skewX(7deg) scaleY(1.08)";
      setTimeout(function () {
        neb.style.transform = "";
      }, 1500);
    }
    if (kind === "boss") {
      state.cleared = Math.min(7, state.cleared + 1);
      paintHangers();
    }
    pointCompass(kind === "boss" ? 132 : -48);
  }

  // (C) 별지기 각성 — 세션 첫 1회만
  var blazeUsed = false;
  function reactBlaze() {
    if (blazeUsed) return say("각성 반응 · 세션당 1회 소진됨");
    blazeUsed = true;
    say("각성 · 여명이 한 번 밝아진다");
    var g = el(
      root,
      "position:absolute;inset:0;background:radial-gradient(ellipse 80% 40% at 50% 108%,#e8955f3d,transparent 66%);opacity:0;transition:opacity 1s",
    );
    requestAnimationFrame(function () {
      g.style.opacity = "1";
    });
    setTimeout(function () {
      g.style.opacity = "0";
      setTimeout(function () {
        g.remove();
      }, 1100);
    }, 1400);
  }

  function staticFallback(kind) {
    say("모션 감소 · 정지 한 장으로 대체 (" + kind + ")");
    var ring = document.getElementById("sky-gauge-ring");
    if (ring) ring.style.borderColor = "#7cc6bb99";
  }

  var API = {
    figure: function () {
      if (gate(true)) reactFigure(5);
    },
    world: function () {
      if (gate(true)) reactFrameAnomaly("world");
    },
    boss: function () {
      if (gate(true)) reactFrameAnomaly("boss");
    },
    blaze: function () {
      if (gate(true)) reactBlaze();
    },
    setProgress: function (v) {
      state.cleared = v.cleared;
      state.perfect = v.perfect;
      state.world = v.world;
      paintHangers();
    },
    layers: function (on) {
      root.style.display = on ? "" : "none";
    },
    debug: function (on) {
      var ids = ["L0", "L1", "L2"];
      for (var i = 0; i < ids.length; i++) {
        var n = root.querySelector('[data-sky-layer="' + ids[i] + '"]');
        n.style.outline = on
          ? "1px dashed " + ["#7cc6bb", "#eea56f", "#cfe8e0"][i]
          : "";
        n.style.outlineOffset = on ? -(i + 1) * 6 + "px" : "";
      }
      root.__debug = on;
    },
  };
  window.SkyAmbience = API;

  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", function () {
      setTimeout(build, 60);
    });
  else setTimeout(build, 60);
})();
