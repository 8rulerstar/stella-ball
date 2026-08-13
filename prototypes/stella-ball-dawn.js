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
    var mw = add(
      "position:absolute;left:-14%;top:16%;width:150%;height:200px;transform:rotate(-13deg);background:linear-gradient(180deg,transparent,#cfe8e014 30%,#f6e8d518 52%,#cfe8e010 72%,transparent);filter:blur(2px)",
    );
    add(
      "position:absolute;left:16%;top:-2%;width:56%;height:170px;background:linear-gradient(100deg,transparent,#7cc6bb22 30%,#9adfc932 52%,#eea56f18 72%,transparent);filter:blur(15px);animation:dawnAurora 9s ease-in-out infinite alternate",
    );
    for (var i = 0; i < 90; i++) {
      var s = document.createElement("div");
      s.style.cssText =
        "position:absolute;left:" +
        (Math.random() * 100).toFixed(1) +
        "%;top:" +
        (Math.random() * 100).toFixed(1) +
        "%;width:2px;height:2px;background:" +
        (Math.random() < 0.15 ? "#ffd2a0" : "#cfe8e0") +
        ";opacity:.6;animation:dawnTwinkle " +
        (2 + Math.random() * 3).toFixed(1) +
        "s " +
        (Math.random() * 3).toFixed(1) +
        "s infinite";
      (i < 60 ? S : mw).appendChild(s);
    }
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
    S.appendChild(tele);
    drag(tele);
    var comp = spriteImg(
      "compass",
      "position:absolute;left:3%;top:56%;width:48px;cursor:grab;touch-action:none" +
        (RM ? "" : ";animation:dawnFloat 8s ease-in-out infinite"),
    );
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
