/* Stella Ball — Dawn pass 통합 스크립트 (2026-08-12)
   1) 게임이 그리는 버튼/탭/칩에 data-pbtn을 자동 부여하고 StellaPixelUI로 픽셀 실루엣을 입힌다.
   2) body 뒤에 #dawn-sky 배경 데코(달+달토끼, 행성, 오로라, 유성, 우주비행사, 드래그 소품)를 만든다.
   stella-ball-pixel-ui.js 다음에 로드한다. 전투 로직·판정색 불관여. 문서: ../UI_KIT_DAWN.md */
(function () {
  "use strict";
  var RM = false;
  try {
    RM = matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch (e) {}

  var MAP = [
    [".hub-tab.center", "tabActive", "translateY(-6px)"],
    [
      ".meta-launch, .hub-battle-play, .title-enter, .hub-start, .gacha-draw, .pause-primary, .confirm-yes, #startTeam",
      "cta",
    ],
    [
      ".hub-stage-change, .settings-actions button, .profile-exit, .shop-buy, .claim-banner button, .achievement-claim, .mail-item button, .pause-actions button, .confirm-actions button, header button, #shopBack, #gachaBack, #profileBack, #settingsBack, #settingsReset, #achievementBack, #backMeta, #profileIconClose, #hubTraining",
      "sub",
    ],
    [".meta-tab, .hub-tab", "tab"],
    [".hub-battle-tags span, .hub-record-chip", "chip"],
    /* The pause button keeps the plain round CSS control.  A crescent
       silhouette behind the ❚❚ glyph read as a shoe, not as pause. */
  ];
  var TAG_SELECTOR = MAP.map(function (entry) {
    return entry[0];
  }).join(",");
  function tag() {
    for (var i = 0; i < MAP.length; i++) {
      var els = document.querySelectorAll(MAP[i][0]);
      for (var j = 0; j < els.length; j++) {
        var el = els[j];
        if (el.dataset.pbtn) continue;
        el.dataset.pbtn = MAP[i][1];
        if (MAP[i][2]) el.dataset.lift = MAP[i][2];
      }
    }
    if (window.StellaPixelUI) window.StellaPixelUI.apply();
  }
  var timer;
  /* 매 변경마다 타이머를 다시 걸면 변경이 창보다 촘촘할 때 영영 합쳐지지
     않는다 — 실제로 HUD가 83ms마다 DOM을 건드리는 동안 이 80ms 창은 한 번도
     묶이지 못하고 전량 통과시켰다. 선두 타이머를 유지해 창당 한 번으로
     고정한다. 굶길 수 없는 형태다. */
  function schedule() {
    if (timer) return;
    timer = setTimeout(function () {
      timer = 0;
      tag();
    }, 120);
  }
  function scheduleRelevant(records) {
    for (var i = 0; i < records.length; i++) {
      var added = records[i].addedNodes;
      for (var j = 0; j < added.length; j++) {
        var node = added[j];
        if (
          (node.nodeType === 1 && node.matches(TAG_SELECTOR)) ||
          ((node.nodeType === 1 || node.nodeType === 11) &&
            node.querySelector(TAG_SELECTOR))
        ) {
          schedule();
          return;
        }
      }
    }
  }

  function drawMoon(g) {
    var R = 21,
      cx = 22,
      cy = 22;
    var craters = [
      [14, 17, 4],
      [27, 12, 3],
      [21, 29, 5],
      [32, 25, 2],
      [11, 29, 2],
      [30, 33, 2],
    ];
    for (var y = 0; y < 44; y++)
      for (var x = 0; x < 44; x++) {
        var dx = x - cx,
          dy = y - cy;
        if (dx * dx + dy * dy > R * R) continue;
        var col = "#e3e0ce";
        if (dx * 0.8 + dy > 9) col = "#c4c2ae";
        if (dx + dy < -16) col = "#f2efdd";
        for (var k = 0; k < craters.length; k++) {
          var ax = craters[k][0],
            ay = craters[k][1],
            ar = craters[k][2],
            ddx = x - ax,
            ddy = y - ay;
          if (ddx * ddx + ddy * ddy <= ar * ar) col = "#a9a893";
          else if (ddx * ddx + ddy * ddy <= (ar + 1) * (ar + 1) && ddy > 0)
            col = "#f2efdd";
        }
        g.fillStyle = col;
        g.fillRect(x, y, 1, 1);
      }
  }
  function drawRed(g) {
    for (var y = 0; y < 26; y++)
      for (var x = 0; x < 26; x++) {
        var dx = x - 13,
          dy = y - 13;
        if (dx * dx + dy * dy > 144) continue;
        var col = "#c4614d";
        if (y === 8 || y === 9 || y === 15 || (y === 16 && x % 7 < 5))
          col = "#a34a3a";
        if (dx * 0.7 + dy > 7) col = "#8f4234";
        if (dx + dy < -12) col = "#dd8a6f";
        g.fillStyle = col;
        g.fillRect(x, y, 1, 1);
      }
  }
  function drawRing(g) {
    var cx = 24,
      cy = 13;
    for (var y = 0; y < 26; y++)
      for (var x = 0; x < 48; x++) {
        var dx = x - cx,
          dy = y - cy;
        if (dx * dx + dy * dy > 64) continue;
        var col = "#d9b088";
        if (y === 10 || y === 14) col = "#b98f66";
        if (y === 12) col = "#e8c9a0";
        if (dx * 0.7 + dy > 4) col = "#a97f58";
        g.fillStyle = col;
        g.fillRect(x, y, 1, 1);
      }
    for (var a = 0; a < 360; a += 1.2) {
      var rad = (a * Math.PI) / 180;
      var px = Math.round(cx + Math.cos(rad) * 21),
        py = Math.round(cy + Math.sin(rad) * 6);
      if (Math.sin(rad) < 0 && Math.abs(px - cx) < 9) continue;
      g.fillStyle = a % 20 < 10 ? "#9578ca" : "#e8c9a0";
      g.fillRect(px, py, 1, 1);
    }
  }
  function spriteImg(name, css) {
    var im = new Image();
    im.src = window.StellaPixelUI.sprite(name);
    im.style.cssText = css + ";image-rendering:pixelated";
    im.draggable = false;
    return im;
  }
  function drag(elm) {
    elm.addEventListener("pointerdown", function (e) {
      e.preventDefault();
      elm.setPointerCapture(e.pointerId);
      var r = elm.getBoundingClientRect(),
        sx = e.clientX,
        sy = e.clientY;
      elm.style.right = "auto";
      elm.style.bottom = "auto";
      elm.style.left = r.left + "px";
      elm.style.top = r.top + "px";
      function mv(ev) {
        elm.style.left = r.left + ev.clientX - sx + "px";
        elm.style.top = r.top + ev.clientY - sy + "px";
      }
      function up() {
        elm.removeEventListener("pointermove", mv);
        elm.removeEventListener("pointerup", up);
        elm.removeEventListener("pointercancel", up);
        elm.removeEventListener("lostpointercapture", up);
      }
      elm.addEventListener("pointermove", mv);
      elm.addEventListener("pointerup", up);
      elm.addEventListener("pointercancel", up);
      elm.addEventListener("lostpointercapture", up);
    });
  }
  function sparkle(x, y, txt) {
    var p = document.createElement("div");
    p.textContent = txt || "✦";
    p.style.cssText =
      "position:fixed;left:" +
      x +
      "px;top:" +
      y +
      "px;color:#ffd2a0;font:12px Galmuri11,ui-monospace,monospace;text-shadow:0 1px 0 #07020c;pointer-events:none;z-index:60;animation:dawnPop .9s ease-out forwards";
    document.body.appendChild(p);
    setTimeout(function () {
      p.remove();
    }, 950);
  }
  function buildSky() {
    if (document.getElementById("dawn-sky") || !window.StellaPixelUI) return;
    var S = document.createElement("div");
    S.id = "dawn-sky";
    document.body.insertBefore(S, document.body.firstChild);
    function add(css) {
      var d = document.createElement("div");
      d.style.cssText = css;
      S.appendChild(d);
      return d;
    }
    add(
      "position:absolute;inset:0;background:radial-gradient(ellipse 75% 45% at 50% 110%,#e8955f26,#f2b35c12 45%,transparent 72%)",
    );
    /* 은하수 띠에는 filter를 걸지 않는다. 이 띠는 뷰포트 1.5배 폭 × 200px인데
       안에 반짝이는 별 30개가 살아서, blur(2px)라도 dpr 2에서는 ~3840×400
       텍스처를 사실상 매 프레임 다시 흐리게 만든다(2026-08-15 렉 제보의 두
       번째 원인). 띠의 부드러움은 그라데이션 정지점이 이미 만든다. */
    add(
      "position:absolute;left:-14%;top:16%;width:150%;height:200px;transform:rotate(-13deg);background:linear-gradient(180deg,transparent,#d6cee910 24%,#d6cee916 38%,#f6e8d518 52%,#f6e8d512 62%,#d6cee90c 74%,transparent)",
    );
    /* 오로라도 filter를 걸지 않는다. 747×170에 blur(15px)이 걸린 채 9초 주기
       변형 애니메이션까지 도는 조합이라, 커널 패딩까지 포함한 큰 중간 표면을
       쉬지 않고 다시 흐리게 만든다 — 은하수·성운의 blur를 걷은 뒤 남아 있던
       마지막이자 가장 비싼 하나였다. 부드러움은 정지점을 넓혀 대신한다. */
    add(
      "position:absolute;left:16%;top:-2%;width:56%;height:170px;background:linear-gradient(100deg,transparent,#9578ca14 22%,#ad97e224 40%,#ad97e22e 52%,#c9b48a1e 64%,#eea56f12 78%,transparent);animation:dawnAurora 9s ease-in-out infinite alternate",
    );
    /* 별밭은 DOM이 아니라 캔버스 한 장이다.

       측정으로 확정한 것: 애니메이션이 걸린 하늘 요소는 하나하나가 자기 합성
       레이어가 된다. 온보딩 화면의 합성 레이어 117개 중 102개가 #dawn-sky의
       것이었고 그중 48개가 이 별점들이었다 — 게임 캔버스 자체는 5개뿐이다.

       반짝임을 되살리면서 그 비용을 다시 부르지 않는 방법이 부분 갱신이다.
       버린 대안 셋: 요소마다 CSS 애니메이션(레이어 160장), 전체 캔버스를 8fps로
       재그리기(레이어 면적 9.4→12.3Mpx), 엇갈린 주기를 위해 캔버스를 다섯 장으로
       나누기(17.0Mpx). 지금은 별을 한 번만 그려 두고, 반짝이는 소수의 별만 자기
       4×4 상자를 지우고 다시 그린다 — 더럽혀지는 면적이 tile 한두 개라 텍스처가
       사실상 다시 올라가지 않고, 레이어는 여전히 한 장이다. */
    var starCanvas = document.createElement("canvas");
    starCanvas.style.cssText =
      "position:absolute;inset:0;width:100%;height:100%;pointer-events:none";
    S.appendChild(starCanvas);
    var starCtx = starCanvas.getContext("2d");
    var stars = [];
    /* sky-ambience가 따로 뿌리던 여백 별 70개를 걷어냈으므로(전체 화면 텍스처가
       한 장 더 늘어나서) 밀도는 이쪽에서 맞춘다. */
    for (var i = 0; i < 130; i++)
      stars.push({
        // 앞의 2/3는 하늘 전면, 나머지는 은하수 띠를 따라 눕힌다.
        band: i >= 87,
        u: Math.random(),
        v: Math.random(),
        warm: Math.random() < 0.15,
        // 반짝이는 별은 1/5만. 전부 깜빡이면 갱신 면적이 화면 전체가 된다.
        twinkles: i % 5 === 0,
        phase: Math.random() * 6.28,
        period: 1.6 + Math.random() * 2.6,
        x: 0,
        y: 0,
      });
    function starPosition(st, w, h) {
      if (!st.band) {
        st.x = Math.round(st.u * w);
        st.y = Math.round(st.v * h);
        return;
      }
      // 띠의 국소 좌표(길이 1.5w, 두께 200px)를 -13도 회전시켜 얹는다.
      var bx = (st.u - 0.14) * w * 1.5,
        by = h * 0.16 + st.v * 200;
      st.x = Math.round(bx * 0.974 + by * 0.225);
      st.y = Math.round(-bx * 0.225 + by * 0.974);
    }
    function starAlpha(st, t) {
      if (!st.twinkles || RM) return 0.6;
      return 0.24 + 0.5 * (0.5 + 0.5 * Math.sin(t / st.period + st.phase));
    }
    /* 「없는 별」(디자인 세션 §10, 비트 7). 하늘이 제자리로 돌아왔는데 별 하나만
       없다 — 그 빈 좌표가 8번째 월드, WORLDS의 「관측되지 않은 점」이다.
       새 서사를 만드는 것이 아니라 이미 코드에 있는 것을 첫 화면에서 미리
       보여 준다. 새 애니메이션을 더하지 않는다: 도는 별 하나를 «끄는» 것이다. */
    var missingIndex = -1;
    function markMissingStar(on) {
      if (!on) {
        missingIndex = -1;
        paintStars();
        return;
      }
      // 눈에 띄되 한가운데는 아닌 자리. 위쪽 3분의 1에서 하나 고른다.
      for (var k = 0; k < stars.length; k++)
        if (!stars[k].band && stars[k].v < 0.34 && stars[k].u > 0.2) {
          missingIndex = k;
          break;
        }
      if (missingIndex < 0) missingIndex = 0;
      paintStars();
    }
    function drawStar(st, t) {
      starCtx.globalAlpha = starAlpha(st, t);
      starCtx.fillStyle = st.warm ? "#ffd2a0" : "#d6cee9";
      starCtx.fillRect(st.x, st.y, 2, 2);
    }
    function paintStars() {
      var w = (starCanvas.width = S.clientWidth || window.innerWidth),
        h = (starCanvas.height = S.clientHeight || window.innerHeight);
      starCtx.clearRect(0, 0, w, h);
      var t = performance.now() / 1000;
      for (var k = 0; k < stars.length; k++) {
        starPosition(stars[k], w, h);
        if (k === missingIndex) {
          // 빈 좌표만 남는다. 별이 아니라 «자리»가 보여야 한다.
          starCtx.globalAlpha = 0.5;
          starCtx.strokeStyle = "#786a87";
          starCtx.lineWidth = 1;
          starCtx.beginPath();
          starCtx.arc(stars[k].x + 1, stars[k].y + 1, 4.5, 0, Math.PI * 2);
          starCtx.stroke();
          continue;
        }
        drawStar(stars[k], t);
      }
      starCtx.globalAlpha = 1;
    }
    // 반짝이는 별만 자기 자리를 지우고 다시 그린다. 130개 중 26개, 각 4×4다.
    function twinkleStars() {
      // The moving battle canvas already supplies motion. Avoid uploading 26
      // tiny dirty rectangles twelve times a second behind it.
      if (document.hidden || document.body.classList.contains("game-mode"))
        return;
      var t = performance.now() / 1000;
      for (var k = 0; k < stars.length; k++) {
        var st = stars[k];
        if (!st.twinkles || k === missingIndex) continue;
        starCtx.clearRect(st.x - 1, st.y - 1, 4, 4);
        drawStar(st, t);
      }
      starCtx.globalAlpha = 1;
    }
    /* 인트로 비트 7이 이 스위치를 켠다(§10). 별밭이 buildSky의 클로저 안에
       있으므로, 밖에서 부를 수 있게 창구 하나만 내놓는다. */
    window.StellaDawnSky = { missingStar: markMissingStar };
    paintStars();
    var starResizeTimer;
    addEventListener("resize", function () {
      clearTimeout(starResizeTimer);
      starResizeTimer = setTimeout(paintStars, 200);
    });
    // 12fps. 반짝임에 이보다 촘촘한 해상도는 눈에 보이지 않고, rAF로 돌리면
    // 전투 프레임과 같은 예산을 두고 다투게 된다.
    if (!RM) setInterval(twinkleStars, 84);
    var moonWrap = add(
      "position:absolute;left:1.5%;top:4%;width:150px;height:150px",
    );
    var mc = document.createElement("canvas");
    mc.width = 44;
    mc.height = 44;
    mc.style.cssText =
      "width:150px;height:150px;image-rendering:pixelated;display:block";
    moonWrap.appendChild(mc);
    drawMoon(mc.getContext("2d"));
    var rb = spriteImg(
      "rabbitUp",
      "position:absolute;left:40px;top:-30px;width:68px;cursor:pointer",
    );
    rb.title = "달토끼";
    rb.alt = "달토끼";
    rb.dataset.dawnProp = "rabbit";
    moonWrap.appendChild(rb);
    var pounding = false;
    rb.addEventListener("click", function (e) {
      e.stopPropagation();
      if (pounding) return;
      pounding = true;
      var i2 = 0,
        iv = setInterval(function () {
          i2++;
          rb.src = window.StellaPixelUI.sprite(
            i2 % 2 ? "rabbitDown" : "rabbitUp",
          );
          if (i2 >= 8) {
            clearInterval(iv);
            rb.src = window.StellaPixelUI.sprite("rabbitUp");
            pounding = false;
          }
        }, 140);
    });
    var rc = document.createElement("canvas");
    rc.width = 26;
    rc.height = 26;
    rc.style.cssText =
      "position:absolute;right:2.5%;top:48%;width:72px;height:72px;image-rendering:pixelated";
    S.appendChild(rc);
    drawRed(rc.getContext("2d"));
    var gc = document.createElement("canvas");
    gc.width = 48;
    gc.height = 26;
    gc.style.cssText =
      "position:absolute;right:1%;top:8%;width:160px;height:87px;image-rendering:pixelated";
    S.appendChild(gc);
    drawRing(gc.getContext("2d"));
    var aw = add(
      "position:absolute;left:2%;bottom:9%;cursor:pointer" +
        (RM ? "" : ";animation:dawnFloat 6s ease-in-out infinite"),
    );
    var av = spriteImg("astroIdle", "width:72px;display:block");
    av.alt = "우주비행사";
    aw.dataset.dawnProp = "astronaut";
    aw.appendChild(av);
    var waving = false;
    aw.addEventListener("mouseenter", function () {
      if (waving) return;
      waving = true;
      var i3 = 0,
        iv = setInterval(function () {
          i3++;
          av.src = window.StellaPixelUI.sprite(
            i3 % 2 ? "astroWave" : "astroIdle",
          );
          if (i3 >= 5) {
            clearInterval(iv);
            av.src = window.StellaPixelUI.sprite("astroIdle");
            waving = false;
          }
        }, 220);
    });
    var tele = spriteImg(
      "tele",
      "position:absolute;right:2%;bottom:5%;width:84px;cursor:grab;touch-action:none",
    );
    tele.dataset.dawnProp = "telescope";
    S.appendChild(tele);
    drag(tele);
    var comp = spriteImg(
      "compass",
      "position:absolute;left:3%;top:56%;width:48px;cursor:grab;touch-action:none" +
        (RM ? "" : ";animation:dawnFloat 8s ease-in-out infinite"),
    );
    comp.dataset.dawnProp = "compass";
    S.appendChild(comp);
    drag(comp);
    function meteor() {
      var w = document.createElement("div");
      w.style.cssText =
        "position:absolute;left:" +
        (5 + Math.random() * 45).toFixed(0) +
        "%;top:" +
        (5 + Math.random() * 28).toFixed(0) +
        "%;transform:rotate(" +
        (14 + Math.random() * 22).toFixed(0) +
        "deg);pointer-events:none";
      var m = document.createElement("div");
      m.style.cssText =
        "width:110px;height:3px;background:linear-gradient(90deg,transparent,#ffd2a0);box-shadow:0 0 8px #ffd2a0aa;cursor:pointer;pointer-events:auto;animation:dawnMeteor 1.8s linear forwards";
      m.addEventListener("click", function (e) {
        e.stopPropagation();
        sparkle(e.clientX, e.clientY, "소원을 빌었다 ✦");
        w.remove();
      });
      w.appendChild(m);
      S.appendChild(w);
      setTimeout(function () {
        w.remove();
      }, 2000);
    }
    if (!RM) {
      /* 전투 중에는 띄우지 않는다. 바로 위 twinkleStars가 쓰는 것과 같은
         가드다 — 판 뒤에서 9초마다 새 요소가 붙어 dawnMeteor 애니메이션을
         돌리면 합성 레이어가 하나씩 생기는데, CSS의 game-mode 일시정지
         규칙은 이름 목록(skyDrift·dawnFloat·dawnAurora·skyCloud)으로 잡아
         dawnMeteor를 덮지 못한다. 중앙 캔버스가 이미 움직이는 동안 여백에
         새 움직임을 얹을 이유가 없다. */
      var quiet = function () {
        return document.hidden || document.body.classList.contains("game-mode");
      };
      setInterval(function () {
        if (!quiet()) meteor();
      }, 9000);
      setTimeout(function () {
        if (!quiet()) meteor();
      }, 2500);
    }
    S.addEventListener("click", function (e) {
      sparkle(e.clientX, e.clientY);
    });
  }
  /* 킷의 금속 아이콘(코인·엠블럼·순위·우편)을 CSS 변수로 1회 등록한다.
     화면 코드는 그대로 두고, 스타일 레이어가 자리 표시용 CSS 도형을 이 스프라이트로 바꾼다. */
  function registerKitIcons() {
    var kit = window.StellaPixelUI;
    if (!kit) return;
    var root = document.documentElement,
      names = ["coin", "emblem", "rank", "mail"];
    for (var i = 0; i < names.length; i++) {
      var url = kit.sprite(names[i]);
      if (url) root.style.setProperty("--px-" + names[i], "url(" + url + ")");
    }
    root.classList.add("pixel-kit-icons");
  }
  function boot() {
    tag();
    buildSky();
    registerKitIcons();
    /* 전투 팝업·토스트·HUD도 body 아래에서 계속 교체된다. 버튼 후보가 실제로
       추가된 변경만 다시 훑어, 관계없는 전투 DOM이 픽셀 UI 전역 검색을 깨우지
       않게 한다. 제거만 일어난 변경도 다시 칠할 이유가 없다. */
    new MutationObserver(scheduleRelevant).observe(document.body, {
      childList: true,
      subtree: true,
    });
  }
  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
