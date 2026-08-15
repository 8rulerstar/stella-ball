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
  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(tag, 80);
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
      g.fillStyle = a % 20 < 10 ? "#7cc6bb" : "#e8c9a0";
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
      "px;color:#ffd2a0;font:12px Galmuri11,ui-monospace,monospace;text-shadow:0 1px 0 #04080a;pointer-events:none;z-index:60;animation:dawnPop .9s ease-out forwards";
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
      "position:absolute;inset:0;background:radial-gradient(ellipse 75% 45% at 50% 110%,#e8955f26,#c97a4512 45%,transparent 72%)",
    );
    /* 은하수 띠에는 filter를 걸지 않는다. 이 띠는 뷰포트 1.5배 폭 × 200px인데
       안에 반짝이는 별 30개가 살아서, blur(2px)라도 dpr 2에서는 ~3840×400
       텍스처를 사실상 매 프레임 다시 흐리게 만든다(2026-08-15 렉 제보의 두
       번째 원인). 띠의 부드러움은 그라데이션 정지점이 이미 만든다. */
    add(
      "position:absolute;left:-14%;top:16%;width:150%;height:200px;transform:rotate(-13deg);background:linear-gradient(180deg,transparent,#cfe8e010 24%,#cfe8e016 38%,#f6e8d518 52%,#f6e8d512 62%,#cfe8e00c 74%,transparent)",
    );
    /* 오로라도 filter를 걸지 않는다. 747×170에 blur(15px)이 걸린 채 9초 주기
       변형 애니메이션까지 도는 조합이라, 커널 패딩까지 포함한 큰 중간 표면을
       쉬지 않고 다시 흐리게 만든다 — 은하수·성운의 blur를 걷은 뒤 남아 있던
       마지막이자 가장 비싼 하나였다. 부드러움은 정지점을 넓혀 대신한다. */
    add(
      "position:absolute;left:16%;top:-2%;width:56%;height:170px;background:linear-gradient(100deg,transparent,#7cc6bb14 22%,#9adfc924 40%,#9adfc92e 52%,#c9b48a1e 64%,#eea56f12 78%,transparent);animation:dawnAurora 9s ease-in-out infinite alternate",
    );
    /* 별밭은 DOM이 아니라 캔버스 세 장이다.

       측정으로 확정한 것: 애니메이션이 걸린 하늘 요소는 하나하나가 자기 합성
       레이어가 된다. 온보딩 화면의 합성 레이어 117개 중 102개가 #dawn-sky의
       것이었고 그중 48개가 이 별점들이었다 — 게임 캔버스 자체는 5개뿐이다.

       두 번의 시행착오를 거쳐 지금 형태가 됐다. 캔버스 한 장을 주기적으로 다시
       그리면 전체 화면 텍스처를 계속 올려보내게 되어 레이어 면적이 9.4→12.3Mpx로
       늘었고, 별을 세 벌로 나눠 엇갈리게 깜빡이려 하자 전체 화면 캔버스가 다섯
       장이 되어 17.0Mpx까지 올라갔다. 전체 화면 캔버스는 장수가 곧 비용이다.
       그래서 한 장에 모두 그려 한 번만 올리고, 반짝임은 그 캔버스의 opacity
       애니메이션 하나로 낸다 — 별이 제각각 깜빡이지는 않고 하늘이 함께 숨쉬지만,
       재그리기 0에 레이어 1장이다. */
    var STAR_SETS = 1;
    var starCanvases = [];
    for (var sIdx = 0; sIdx < STAR_SETS; sIdx++) {
      var sc = document.createElement("canvas");
      // 애니메이션을 걸지 않는다. 캔버스에 opacity 애니메이션을 주면 이 한
      // 장이 매 프레임 재합성 대상이 되어, 레이어 수를 줄여 아낀 것을 전체
      // 화면 크기의 상시 재합성으로 되돌려준다. 정적 레이어는 합성기가 그대로
      // 재사용한다. 하늘의 움직임은 유성·오로라·구름이 이미 맡고 있다.
      sc.style.cssText =
        "position:absolute;inset:0;width:100%;height:100%;pointer-events:none";
      S.appendChild(sc);
      starCanvases.push(sc);
    }
    var stars = [];
    for (var i = 0; i < 90; i++)
      stars.push({
        // 60개는 하늘 전면, 30개는 은하수 띠를 따라 눕힌다(원래 배치와 같다).
        band: i >= 60,
        u: Math.random(),
        v: Math.random(),
        warm: Math.random() < 0.15,
        set: i % STAR_SETS,
      });
    function paintStars() {
      var w = S.clientWidth || window.innerWidth,
        h = S.clientHeight || window.innerHeight;
      var ctxs = starCanvases.map(function (c) {
        c.width = w;
        c.height = h;
        return c.getContext("2d");
      });
      for (var k = 0; k < stars.length; k++) {
        var st = stars[k],
          px,
          py;
        if (st.band) {
          // 띠의 국소 좌표(길이 1.5w, 두께 200px)를 -13도 회전시켜 얹는다.
          var bx = (st.u - 0.14) * w * 1.5,
            by = h * 0.16 + st.v * 200;
          px = bx * 0.974 + by * 0.225;
          py = -bx * 0.225 + by * 0.974;
        } else {
          px = st.u * w;
          py = st.v * h;
        }
        var g = ctxs[st.set];
        g.globalAlpha = 0.6;
        g.fillStyle = st.warm ? "#ffd2a0" : "#cfe8e0";
        g.fillRect(Math.round(px), Math.round(py), 2, 2);
      }
    }
    paintStars();
    var starResizeTimer;
    addEventListener("resize", function () {
      clearTimeout(starResizeTimer);
      starResizeTimer = setTimeout(paintStars, 200);
    });
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
      setInterval(meteor, 9000);
      setTimeout(meteor, 2500);
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
    new MutationObserver(schedule).observe(document.body, {
      childList: true,
      subtree: true,
    });
  }
  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
