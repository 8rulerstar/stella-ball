/* 프레임 기록기 — 「너가 할 땐 렉이 안 걸린다」를 끝내기 위한 계기.

   프로브는 1280~1920 창의 헤드 크롬에서, 죽지 않는 보스로, 한두 샷만 굴린다.
   그 조건에서 잰 값의 잡음이 8~12ms라, 실제로 겪는 렉보다 크다. 그래서 조건을
   흉내 내는 대신 «그 자리에서» 재게 한다 — 이 파일은 게임 안에서 프레임을
   기록하고, 긴 프레임이 나온 순간 화면에 무엇이 있었는지 함께 남긴다.

   켜는 법 — 둘 중 아무거나.
     · 주소 끝에 ?perf=1 을 붙이고 새로고침
     · 언제든 F9
   끄는 법: F9 다시. 끄면 훅도 떼므로 비용이 0으로 돌아간다.

   보고: 화면 왼쪽 위에 실시간 요약이 뜨고, F10을 누르면 전체 기록이 콘솔에
   JSON으로 찍힌다(우클릭 → Copy). 그걸 그대로 주면 된다.

   기본 상태에서는 아무 일도 하지 않는다 — 훅을 걸지도, 무엇을 그리지도
   않는다. 켜지 않으면 이 파일의 비용은 0이다. */
(function () {
  "use strict";

  var LONG_MS = 25, // 이보다 긴 프레임만 기록한다. 60Hz의 1.5프레임.
    KEEP = 60; // 최근 몇 건까지 들고 있을지
  var on = false,
    gaps = [],
    longs = [],
    last = 0,
    raf = 0,
    dock = null,
    startedAt = 0;

  /* ── 용의자 스위치 ──────────────────────────────────────────────────
     프로브로는 판별이 안 된다. 이 기계에서 프로브의 p50은 4.2ms인데 실제
     플레이는 16.7ms — 하나는 vsync에 안 물려 「얼마나 빨리 만드나」를 재고,
     다른 하나는 「16.7ms 안에 들어오나」를 잰다. 오너 기록의 긴 프레임이
     33·50·75·100·117ms로 전부 16.7의 배수인 것이 그 증거다.

     그래서 «그 자리에서» 하나씩 꺼 본다. 렉이 사라지는 스위치가 곧 원인이다.
       F7  여백 하늘 레이어 (1920 창에서 1898x982 캔버스 — 판의 2.9배)
       F8  캔버스 흐림 (shadowBlur. 실측으로 프레임 비용의 대부분)
       F6  화면 반응 (잔상·흔들림·기울기) */
  var off = {
    sky: false,
    blur: false,
    react: false,
    stars: false,
    decor: false,
    guests: false,
    twinkle: false,
  };

  function hide(id, flag) {
    var el = document.getElementById(id);
    if (el) el.style.display = flag ? "none" : "";
  }
  function toggleSky() {
    off.sky = !off.sky;
    hide("dawn-sky", off.sky);
    hide("sky-ambience", off.sky);
    off.stars = off.decor = off.guests = off.sky;
  }
  /* F7이 하늘 전체를 껐을 때 렉이 사라졌다. 하늘 안에서 무엇이 값을 치르는지
     세 조각으로 더 가른다 — 고칠 자리가 셋 다 다르기 때문이다.
       F4  별 캔버스 자체 (뷰포트 크기 1898x982, 판의 2.9배)
       F3  반짝임만 (setInterval 84ms = 12Hz로 그 큰 캔버스를 건드린다)
       F2  하늘 소품 DOM (구름·유성·오로라 등 CSS 애니메이션) */
  function toggleStars() {
    off.stars = !off.stars;
    var sky = document.getElementById("dawn-sky");
    var cv =
      sky &&
      [].slice.call(sky.children).filter(function (e) {
        return e.tagName === "CANVAS";
      })[0];
    if (cv) cv.style.display = off.stars ? "none" : "";
  }
  function toggleDecor() {
    off.decor = !off.decor;
    var sky = document.getElementById("dawn-sky");
    if (!sky) return;
    [].slice.call(sky.children).forEach(function (e) {
      if (e.tagName !== "CANVAS") e.style.display = off.decor ? "none" : "";
    });
  }
  function toggleGuests() {
    off.guests = !off.guests;
    hide("sky-ambience", off.guests);
  }
  /* 반짝임만 멈춘다. 캔버스는 그대로 두고 «건드리는 것»만 없앤다 — 큰 레이어를
     12Hz로 더럽히는 것이 값인지, 레이어가 커서 값인지를 가른다. */
  function toggleTwinkle() {
    off.twinkle = !off.twinkle;
    if (off.twinkle && !toggleTwinkle.saved) {
      toggleTwinkle.saved = CanvasRenderingContext2D.prototype.fillRect;
      var sky = document.getElementById("dawn-sky");
      var cv =
        sky &&
        [].slice.call(sky.children).filter(function (e) {
          return e.tagName === "CANVAS";
        })[0];
      toggleTwinkle.ctx = cv && cv.getContext("2d");
      if (toggleTwinkle.ctx) {
        toggleTwinkle.realFill = toggleTwinkle.ctx.fillRect.bind(
          toggleTwinkle.ctx,
        );
        toggleTwinkle.realClear = toggleTwinkle.ctx.clearRect.bind(
          toggleTwinkle.ctx,
        );
        toggleTwinkle.ctx.fillRect = function () {
          if (!off.twinkle) toggleTwinkle.realFill.apply(null, arguments);
        };
        toggleTwinkle.ctx.clearRect = function () {
          if (!off.twinkle) toggleTwinkle.realClear.apply(null, arguments);
        };
      }
    }
  }
  var blurOn = false;
  /* 캔버스 컨텍스트는 game-data.js에서 top-level `const x`로 선언된다. 고전
     스크립트의 top-level const는 «전역 렉시컬 환경»에 들어가지 window에는
     붙지 않는다 — 그래서 window.x는 undefined였고, 이 스위치는 눌러도 조용히
     아무 일도 하지 않았다. 이름으로 직접 잡는다. */
  function ctx2d() {
    try {
      return typeof x !== "undefined" ? x : null;
    } catch (e) {
      return null;
    }
  }
  function toggleBlur() {
    var ctx = ctx2d();
    if (!ctx) return;
    off.blur = !off.blur;
    if (off.blur && !blurOn) {
      blurOn = true;
      Object.defineProperty(ctx, "shadowBlur", {
        configurable: true,
        get: function () {
          return 0;
        },
        set: function () {},
      });
    } else if (!off.blur && blurOn) {
      blurOn = false;
      delete ctx.shadowBlur;
    }
  }
  /* F6은 잔상·흔들림·기울기 셋을 함께 껐다. 셋 중 값을 치르는 것은 잔상뿐이라고
     보고 고쳤으므로, 그 판단을 확인할 수 있게 잔상만 따로 끄는 스위치를 둔다.
       F6  셋 다
       F5  잔상만 */
  function pinReact(which) {
    if (pinReact.timer) return;
    pinReact.timer = setInterval(function () {
      try {
        if (off.react || off.ghost) screenGhost = 0;
        if (off.react) {
          screenShake = 0;
          screenTilt = 0;
        }
      } catch (e) {}
    }, 8);
  }
  function toggleReact() {
    off.react = !off.react;
    pinReact();
  }
  function toggleGhost() {
    off.ghost = !off.ghost;
    pinReact();
  }
  /* F1 — 판 레이어를 살려 둔다.

     흔들림·밀림·기울기는 캔버스가 아니라 .stage의 CSS transform으로 적용되고,
     반응이 끝나면 그 문자열이 ""가 되어 transform이 «사라진다». 그때마다 브라우저는
     .stage의 합성 레이어를 버리고, 다음 타격에 다시 만든다 — 그 서브트리에는
     720x900 캔버스와 토스트·플래시·안내가 전부 들어 있다.

     각성이 매 샷 2~4번 이것을 일으킨다(각성 연출이 밀림·기울기·잔상을 세운다).
     F6이 렉을 없앤 이유가 잔상이 아니라 이것이라면, transform을 «지우지 않고»
     0으로 두기만 해도 사라져야 한다. 그 차이를 여기서 시험한다.

     원본 코드는 건드리지 않는다 — 매 프레임 뒤에 빈 transform만 0으로 되돌린다. */
  function toggleStageLayer() {
    off.stage = !off.stage;
  }
  function holdStageLayer() {
    if (!off.stage) return;
    var st = document.querySelector(".stage");
    if (st && st.style.transform === "")
      st.style.transform = "translate(0px,0px)";
  }

  /* ── 어디에 시간이 쓰이는가 ────────────────────────────────────────
     오늘 내내 스위치로 «무엇을 끄면 사라지는가»만 물었고, 그 답에서 내가 세운
     원인 가설 넷이 전부 틀렸다. 끄면 사라지는 것과 시간을 쓰는 것은 다르다.

     그래서 이번에는 그 기계에서 직접 잰다. 게임의 주요 함수를 감싸 프레임마다
     걸린 시간을 재고, 긴 프레임에는 그 프레임의 내역을 통째로 붙인다. 내 프로브는
     vsync에 안 물려 있어 이 값을 낼 수 없다 — 여기서만 나온다. */
  var W_LIST = [
    "draw",
    "update",
    "updateSpecial",
    "updateFeedback",
    "sync",
    "toast",
  ];
  var cost = {},
    frameCost = {},
    wrapped = false;
  function wrapAll() {
    if (wrapped) return;
    wrapped = true;
    W_LIST.forEach(function (name) {
      var real;
      try {
        real = eval(name);
      } catch (e) {
        return;
      }
      if (typeof real !== "function") return;
      cost[name] = [];
      var w = function () {
        var t0 = performance.now();
        try {
          return real.apply(this, arguments);
        } finally {
          var d = performance.now() - t0;
          frameCost[name] = (frameCost[name] || 0) + d;
        }
      };
      /* 전역 함수 선언은 재대입이 되지만, 이름이 const로 잡힌 것도 있으므로
         실패는 조용히 넘긴다 — 못 감싼 것은 아래 표에 아예 안 나온다. */
      try {
        eval(name + " = w");
      } catch (e) {}
    });
  }
  function frameLedger() {
    var out = {},
      any = false;
    for (var k in frameCost)
      if (frameCost[k] > 0.15) {
        out[k] = +frameCost[k].toFixed(1);
        any = true;
      }
    frameCost = {};
    return any ? out : null;
  }

  function snapshot() {
    var g = function (n) {
      try {
        return eval(n);
      } catch (e) {
        return undefined;
      }
    };
    var len = function (v) {
      return Array.isArray(v) ? v.length : -1;
    };
    var b = g("ball");
    return {
      // 무엇을 하는 중이었나
      scene:
        typeof isRuntimeScene === "function"
          ? ["title", "meta", "menu", "game"].filter(isRuntimeScene)[0] || "?"
          : "?",
      moving: !!(b && b.moving),
      settling: len(g("assistShots")) > 0,
      finisher: !!g("finisherFocus"),
      figure: !!g("figureFx"),
      intro: !!g("battleCine") || !!g("battleIntro"),
      // 화면 반응이 켜져 있었나 — 잔상은 매 프레임 캔버스를 통째로 두 번 복사한다
      ghost: +(g("screenGhost") || 0).toFixed(2),
      shake: Math.round(g("screenShake") || 0),
      stop: +(g("impactStop") || 0).toFixed(3),
      // 얼마나 쌓여 있었나
      fieldFx: len(g("fieldFx")),
      popups: len(g("popups")),
      bursts: len(g("areaBursts")),
      assists: len(g("assistShots")),
      anims: document.getAnimations ? document.getAnimations().length : -1,
      // 죽음 연출·승리 컷신. 오너 기록의 가장 긴 20프레임이 여기 몰려 있었는데
      // 첫 판에는 이 둘을 아예 기록하지 않아 「settling: false」로만 보였다.
      outro: !!g("bossOutro"),
      victory: !!(g("battle") && g("battle").victory),
      complete: !!g("battleComplete"),
      off:
        off.sky || off.blur || off.react
          ? (off.sky ? "sky " : "") +
            (off.blur ? "blur " : "") +
            (off.react ? "react" : "")
          : "",
    };
  }

  function tick(now) {
    if (!on) return;
    var ledger = frameLedger();
    if (last) {
      var d = now - last;
      gaps.push(d);
      if (gaps.length > 3000) gaps.shift();
      if (d >= LONG_MS) {
        longs.push({
          ms: Math.round(d),
          at: Math.round(now - startedAt),
          ...snapshot(),
        });
        if (longs.length > KEEP) longs.shift();
      }
    }
    last = now;
    holdStageLayer();
    raf = requestAnimationFrame(tick);
    render();
  }

  var painted = 0;
  function render() {
    // 요약은 4Hz만 갱신한다. 재는 도구가 스스로 프레임을 먹으면 안 된다.
    if (performance.now() - painted < 250 || !dock) return;
    painted = performance.now();
    var s = gaps.slice().sort(function (a, b) {
      return a - b;
    });
    var at = function (p) {
      return s.length ? s[Math.min(s.length - 1, Math.floor(s.length * p))] : 0;
    };
    var over = s.filter(function (v) {
      return v >= LONG_MS;
    }).length;
    dock.textContent =
      "FPS " +
      (s.length
        ? Math.round(1000 / (s.reduce((a, b) => a + b, 0) / s.length))
        : 0) +
      "  p50 " +
      at(0.5).toFixed(1) +
      "  p95 " +
      at(0.95).toFixed(1) +
      "  worst " +
      (s.length ? s[s.length - 1].toFixed(0) : 0) +
      "  긴프레임 " +
      over +
      "/" +
      s.length +
      "   [F10: 기록 복사]";
  }

  function build() {
    dock = document.createElement("div");
    dock.id = "perfwatch";
    dock.style.cssText =
      "position:fixed;left:8px;top:8px;z-index:99999;font:11px/1.5 ui-monospace,monospace;" +
      "background:#0a0f14e8;color:#9fe8d0;padding:6px 9px;border:1px solid #2c4a48;" +
      "border-radius:6px;pointer-events:none;white-space:pre";
    document.body.appendChild(dock);
  }

  function start() {
    if (on) return;
    on = true;
    gaps = [];
    longs = [];
    last = 0;
    startedAt = performance.now();
    build();
    wrapAll();
    raf = requestAnimationFrame(tick);
  }
  function stop() {
    on = false;
    cancelAnimationFrame(raf);
    if (dock) dock.remove();
    dock = null;
  }
  function dump() {
    var s = gaps.slice().sort(function (a, b) {
      return a - b;
    });
    var at = function (p) {
      return s.length ? +s[Math.floor(s.length * p)].toFixed(1) : 0;
    };
    /* 긴 프레임들이 «어디에» 시간을 썼는지 합산한다. 이 표가 비어 있으면
       그 프레임들은 JS가 아니라 합성·래스터에서 늦은 것이고, 그러면 끄는
       실험(F2·F6)이 답이지 코드 안을 더 파도 나오지 않는다. */
    var spentTotals = {};
    for (var i = 0; i < longs.length; i++) {
      var sp = longs[i].spent;
      if (!sp) continue;
      for (var k in sp)
        spentTotals[k] = +((spentTotals[k] || 0) + sp[k]).toFixed(1);
    }
    var withJs = longs.filter(function (l) {
      return l.spent;
    }).length;
    var out = {
      spentTotals: spentTotals,
      longFramesWithJsCost: withJs + "/" + longs.length,
      seconds: +((performance.now() - startedAt) / 1000).toFixed(1),
      viewport: innerWidth + "x" + innerHeight,
      dpr: devicePixelRatio,
      ua: navigator.userAgent,
      frames: s.length,
      p50: at(0.5),
      p95: at(0.95),
      p99: at(0.99),
      worst: s.length ? Math.round(s[s.length - 1]) : 0,
      longFrames: longs,
    };
    console.log("=== STELLA PERFWATCH ===");
    console.log(JSON.stringify(out, null, 1));
    return out;
  }

  addEventListener("keydown", function (e) {
    if (e.code === "F9") {
      e.preventDefault();
      on ? stop() : start();
    } else if (e.code === "F10" && on) {
      e.preventDefault();
      dump();
    } else if (e.code === "F7" && on) {
      e.preventDefault();
      toggleSky();
      gaps = [];
      longs = [];
    } else if (e.code === "F8" && on) {
      e.preventDefault();
      toggleBlur();
      gaps = [];
      longs = [];
    } else if (e.code === "F6" && on) {
      e.preventDefault();
      toggleReact();
      gaps = [];
      longs = [];
    } else if (e.code === "F4" && on) {
      e.preventDefault();
      toggleStars();
      gaps = [];
      longs = [];
    } else if (e.code === "F3" && on) {
      e.preventDefault();
      toggleTwinkle();
      gaps = [];
      longs = [];
    } else if (e.code === "F1" && on) {
      e.preventDefault();
      toggleStageLayer();
      gaps = [];
      longs = [];
    } else if (e.code === "F5" && on) {
      e.preventDefault();
      toggleGhost();
      gaps = [];
      longs = [];
    } else if (e.code === "F2" && on) {
      e.preventDefault();
      toggleDecor();
      toggleGuests();
      gaps = [];
      longs = [];
    }
  });
  if (location.search.indexOf("perf=1") >= 0) addEventListener("load", start);
  window.StellaPerfWatch = { start: start, stop: stop, dump: dump };
})();
