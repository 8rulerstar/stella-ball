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
  var off = { sky: false, blur: false, react: false };

  function toggleSky() {
    off.sky = !off.sky;
    ["dawn-sky", "sky-ambience"].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.style.display = off.sky ? "none" : "";
    });
  }
  var realBlur = null;
  function toggleBlur() {
    off.blur = !off.blur;
    var ctx = window.x;
    if (!ctx) return;
    if (off.blur) {
      realBlur = Object.getOwnPropertyDescriptor(
        Object.getPrototypeOf(ctx),
        "shadowBlur",
      );
      Object.defineProperty(ctx, "shadowBlur", {
        configurable: true,
        get: function () {
          return 0;
        },
        set: function () {},
      });
    } else if (realBlur) {
      delete ctx.shadowBlur;
    }
  }
  function toggleReact() {
    off.react = !off.react;
    // 값을 매 프레임 0으로 눌러 둔다. 원본 코드를 건드리지 않는 방법이다.
    if (off.react && !toggleReact.timer)
      toggleReact.timer = setInterval(function () {
        if (!off.react) return;
        try {
          screenGhost = 0;
          screenShake = 0;
          screenTilt = 0;
        } catch (e) {}
      }, 8);
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
    var out = {
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
    }
  });
  if (location.search.indexOf("perf=1") >= 0) addEventListener("load", start);
  window.StellaPerfWatch = { start: start, stop: stop, dump: dump };
})();
