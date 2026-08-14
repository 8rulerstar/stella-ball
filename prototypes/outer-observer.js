/* Stella Ball — 관측창 밖의 존재 · 인트로 컷신 (2026-08-14)

   명세: ../OUTER_OBSERVER_INTRO_SPEC.md 5절. 6비트 9.8초.
     1 정적 0.0–1.1s · 2 이상 1.1–2.4s · 3 통과 2.4–5.6s
     4 정지 5.6–7.0s · 5 붙잡음 7.0–8.6s · 6 점등 8.2–9.8s

   표현 전용이다. 게임 상태를 읽지도 쓰지도 않고, 전투·입력·보상 경로에
   손대지 않는다. 타이틀 화면이 DOM에 나타나는 것만 보고 재생한다.

   레이어는 #dawn-sky의 자식으로 붙는다. 그래야 stella-ball-dawn.css의
   `#dawn-sky * { animation: none }` 모션 감소 규칙이 형제가 아니라
   자식으로서 그대로 적용된다.

   존재는 boss-art.js가 그린 8-1 보스와 같은 몸이다. 저해상도로 한 번
   구워 image-rendering:pixelated로 확대하므로, 화면을 채우는 크기여도
   비용은 캔버스 한 장이다. */
(function () {
  "use strict";

  var SESSION_KEY = "stella-ball.outer-observer.played";
  var BAKE = 360; // 굽는 해상도. 표시 크기는 CSS가 키운다.
  var LAYER_ID = "outer-observer";

  function reducedMotion() {
    return (
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    );
  }

  // sessionStorage는 사파리 프라이빗 등에서 던질 수 있다. 실패하면 매번
  // 전체 연출을 보여주는 쪽이 아니라, 조용히 약식으로 떨어뜨린다.
  function playedThisSession() {
    try {
      return window.sessionStorage.getItem(SESSION_KEY) === "1";
    } catch (e) {
      return false;
    }
  }
  function markPlayed() {
    try {
      window.sessionStorage.setItem(SESSION_KEY, "1");
    } catch (e) {
      /* 저장이 막혀도 연출 자체는 이미 끝났다 */
    }
  }

  // 결과를 data URL로 빼서 <img>로 붙인다. 타이틀 화면에는
  // `.title-mode canvas { display:none }`이 걸려 있어 캔버스를 그대로 두면
  // 이 연출이 통째로 사라진다. dawn.js의 소품도 같은 이유로 <img>를 쓴다.
  function bakeBeing(pupil) {
    var c = document.createElement("canvas");
    c.width = BAKE;
    c.height = BAKE;
    // 페이즈는 항상 1이다. 인트로의 몸은 다리 넷이 온전한 상태여야
    // 보스전 첫 대면이 "아까 그것"으로 연결된다.
    window.StellaBossArt.draw(c.getContext("2d"), "strider", {
      size: BAKE,
      phase: 1,
      pupil: pupil,
    });
    return c.toDataURL("image/png");
  }

  /* 비트 2 · 관측 이상.
     자연 성야에는 없는 규칙성을 만든다. 기존 별 90개를 옮기는 대신
     양옆 여백에 70px 등간격 점을 따로 얹어, 하늘의 순서가 틀렸다는 것만
     보이게 한다. 기존 소품과 클릭 동작은 건드리지 않는다. */
  function buildAnomaly(layer) {
    var wrap = document.createElement("div");
    wrap.className = "oo-anomaly";
    wrap.style.cssText =
      "position:absolute;inset:0;opacity:0;transition:opacity .55s ease-out";
    for (var side = 0; side < 2; side++) {
      for (var i = 0; i < 9; i++) {
        var d = document.createElement("i");
        d.style.cssText =
          "position:absolute;width:2px;height:2px;background:#cfe8e0;" +
          "box-shadow:0 0 4px #cfe8e066;" +
          (side ? "right:" : "left:") +
          (4 + (i % 2) * 3).toFixed(0) +
          "%;top:" +
          (12 + (i * 70) / 9).toFixed(1) +
          "%";
        wrap.appendChild(d);
      }
    }
    layer.appendChild(wrap);
    return wrap;
  }

  function buildLayer(sky) {
    var layer = document.createElement("div");
    layer.id = LAYER_ID;
    // main(z-index:1) 뒤에 남고, 여백의 기존 클릭 소품을 절대 가리지 않는다.
    layer.style.cssText =
      "position:absolute;inset:0;overflow:hidden;pointer-events:none;z-index:0";
    var being = document.createElement("img");
    being.src = bakeBeing(1);
    being.alt = "";
    being.setAttribute("aria-hidden", "true");
    being.className = "oo-being";
    /* 크기와 자리.
       몸은 뷰포트 높이의 1.5배라 사방이 프레임 밖으로 잘린다 — 작아 보이는
       대신 일부만 보인다. 눈은 그림의 가로 49%·세로 37% 지점에 있으므로,
       정지 지점에서 눈이 오른쪽 여백에 오도록 역산해 둔다. 화면 오른쪽 끝을
       기준으로 잡아 `main`의 실제 폭에 의존하지 않는다.
         0.49 × 150vh = 73.5vh,  0.37 × 150vh = 55.5vh */
    being.style.cssText =
      "position:absolute;left:calc(100% - 130px - 73.5vh);top:-17.5vh;" +
      "width:150vh;height:auto;image-rendering:pixelated;opacity:0;" +
      "will-change:transform;transform:translateX(-160vw)";
    layer.appendChild(being);
    var anomaly = buildAnomaly(layer);
    sky.appendChild(layer);
    // 수축한 눈은 미리 구워 둔다. 비트 4에서 굽기 시작하면 그 프레임이 튄다.
    return {
      layer: layer,
      being: being,
      anomaly: anomaly,
      tight: bakeBeing(0.42),
      claw: null,
    };
  }

  /* 비트 5 · 관측창을 짚는 발톱.
     몸통은 계속 `main` 뒤에 있고 이 마디 하나만 앞(z-index 2)으로 올라온다.
     그래서 `#dawn-sky` 안에 둘 수 없다 — 그 레이어는 z-index 0이라 관측창
     뒤에 갇힌다. body 직계로 붙이는 대신 두 가지를 직접 책임진다:
       · 모션 감소는 `#dawn-sky *` 규칙이 덮지 않으므로 이 비트를 통째로 뺀다
       · 타이틀을 벗어날 때 teardown()이 반드시 제거한다
     `pointer-events: none`이라 CTA는 흔들리는 동안에도 계속 눌린다. */
  var CLAW_BAKE = 300;
  function buildClaw() {
    var img = document.createElement("img");
    var c = document.createElement("canvas");
    c.width = CLAW_BAKE;
    c.height = CLAW_BAKE;
    window.StellaBossArt.draw(c.getContext("2d"), "claw", { size: CLAW_BAKE });
    img.src = c.toDataURL("image/png");
    img.alt = "";
    img.setAttribute("aria-hidden", "true");
    img.className = "oo-claw";
    img.style.cssText =
      "position:fixed;z-index:2;width:34vh;height:auto;pointer-events:none;" +
      "image-rendering:pixelated;opacity:0;will-change:transform;" +
      "transition:transform .5s cubic-bezier(.2,.8,.3,1),opacity .4s ease-out";
    document.body.appendChild(img);
    return img;
  }

  // 관측창의 오른쪽 위 모서리를 짚는다. 존재가 오른쪽 여백에 서 있으므로
  // 팔이 건너오는 방향과 짚는 자리가 어긋나지 않는다.
  function placeClaw(claw, gripped) {
    var main = document.querySelector("main");
    if (!main) return;
    var r = main.getBoundingClientRect();
    var w = claw.getBoundingClientRect().width || window.innerHeight * 0.34;
    claw.style.left = Math.round(r.right - w * 0.52) + "px";
    claw.style.top = Math.round(r.top - w * 0.12) + "px";
    claw.style.transform = gripped ? "translate(0,0)" : "translate(26vw,-14vh)";
    claw.style.opacity = gripped ? "0.96" : "0";
  }

  /* 비트 3 · 소품이 처음으로 스스로 반응한다.
     지금까지 클릭해야 움직이던 것들이라, 이 한 번이 존재가 실재한다는
     증명이 된다. 명세 5절대로 제자리로 되돌리지 않는다. */
  function startleProps(sky) {
    var move = {
      astronaut: "translate(14vw,-46vh) rotate(414deg)",
      rabbit: "translate(-26px,16px)",
      telescope: "rotate(74deg) translate(10px,16px)",
      compass: "rotate(1080deg)",
    };
    Object.keys(move).forEach(function (name) {
      var el = sky.querySelector('[data-dawn-prop="' + name + '"]');
      if (!el) return;
      // 기존 떠다니는 애니메이션이 transform을 계속 덮어쓰므로 멈춘다.
      el.style.animation = "none";
      el.style.transition = "transform 2.6s cubic-bezier(.22,.9,.3,1)";
      el.style.transform = move[name];
      if (name === "rabbit") el.style.opacity = "0";
    });
  }

  function play(sky, parts, short) {
    var being = parts.being;
    var timers = [];
    function at(ms, fn) {
      timers.push(window.setTimeout(fn, ms));
    }

    if (short) {
      // 같은 세션 재진입: 1·5비트만. 통과 없이 잔상만 남긴다.
      being.style.transition = "opacity 1.2s ease-out";
      being.style.transform = "translateX(0)";
      at(120, function () {
        being.style.opacity = "0.2";
      });
      return;
    }

    // 비트 2 · 관측 이상
    at(1100, function () {
      parts.anomaly.style.opacity = "1";
    });

    // 비트 3 · 외부 통과 (2.4 → 5.6s). 정지 지점까지 3.2초.
    at(2400, function () {
      being.style.transition =
        "transform 3.2s cubic-bezier(.36,.02,.28,1), opacity .8s ease-in";
      being.style.opacity = "0.84";
      being.style.transform = "translateX(0)";
      startleProps(sky);
    });

    // 비트 4 · 눈이 멈춘다 (5.6 → 7.0s). 위치는 그대로 두고 동공만 수축한다.
    // 지나가던 것이 관측창을 알아본 유일한 프레임이다. 대사도 이름도 없다.
    at(5600, function () {
      being.src = parts.tight;
      parts.anomaly.style.opacity = "0.35";
    });

    /* 비트 5 · 붙잡는다 (7.0 → 8.6s).
       알아본 다음에 손이 온다. 발톱이 모서리를 짚는 순간 관측창만 흔들리고,
       여백의 달·소품은 제자리에 남는다 — 저쪽이 잡은 것이 화면 전체가 아니라
       이 창이라는 게 그 대비로 읽힌다. */
    at(7000, function () {
      var claw = parts.claw;
      if (!claw) return;
      placeClaw(claw, false);
      // 다음 프레임에 짚어야 전환이 걸린다. 같은 프레임에 두 값을 주면
      // 브라우저가 시작 상태를 못 잡고 즉시 최종값으로 튄다.
      window.requestAnimationFrame(function () {
        placeClaw(claw, true);
      });
      var main = document.querySelector("main");
      if (main) {
        main.classList.remove("oo-grabbed");
        void main.offsetWidth; // 재생을 위해 애니메이션을 되감는다
        main.classList.add("oo-grabbed");
      }
    });

    /* 비트 6 · 관측창 점등 (8.2 → 9.8s). 발톱이 놓고, 존재는 빠져나가고,
       흔들림이 잦아든 자리에 CTA가 선명해진다. */
    at(8200, function () {
      if (parts.claw) placeClaw(parts.claw, false);
      being.style.transition =
        "transform 1.6s cubic-bezier(.5,0,.7,.4), opacity 1.6s ease-in";
      being.style.transform = "translateX(62vw)";
      being.style.opacity = "0.16";
      parts.anomaly.style.opacity = "0";
    });
    at(9800, function () {
      // 흔들림 클래스를 반드시 벗긴다. main에 transform이 남으면
      // position:fixed 전체화면 오버레이가 캔버스 폭에 갇힌다.
      document.querySelector("main")?.classList.remove("oo-grabbed");
      markPlayed();
    });

    return timers;
  }

  function run() {
    var sky = document.getElementById("dawn-sky");
    if (!sky || !window.StellaBossArt) return;
    if (document.getElementById(LAYER_ID)) return;
    var parts = buildLayer(sky);
    if (reducedMotion()) {
      // 움직임 없이 한 장으로. 존재는 이미 여백에 서 있고, 붙잡는 비트는
      // 통째로 뺀다 — 흔들림은 모션 감소에서 남길 수 있는 종류가 아니다.
      parts.being.style.transform = "translateX(0)";
      parts.being.style.opacity = "0.22";
      markPlayed();
      return;
    }
    var short = playedThisSession();
    // 약식 재생에는 붙잡는 비트가 없으므로 발톱도 만들지 않는다.
    if (!short) parts.claw = buildClaw();
    play(sky, parts, short);
  }

  function teardown() {
    var layer = document.getElementById(LAYER_ID);
    if (layer) layer.remove();
    // 발톱은 body 직계라 레이어와 같이 지워지지 않는다. 흔들림 클래스도
    // 여기서 확실히 벗긴다 — main에 transform이 남은 채 편성·소환 화면으로
    // 넘어가면 그 전체화면 오버레이가 캔버스 폭에 갇힌다.
    var claw = document.querySelector(".oo-claw");
    if (claw) claw.remove();
    var main = document.querySelector("main");
    if (main) main.classList.remove("oo-grabbed");
  }

  /* 타이틀이 DOM에 나타날 때만 재생한다. 게임 코드에 훅을 걸지 않으므로
     전투·온보딩 경로는 이 파일의 존재를 모른다. */
  function watch() {
    var seen = false;
    new MutationObserver(function () {
      var onTitle = !!document.querySelector(".title-sequence");
      if (onTitle === seen) return;
      seen = onTitle;
      if (onTitle) run();
      else teardown();
    }).observe(document.body, { childList: true, subtree: true });
    if (document.querySelector(".title-sequence")) {
      seen = true;
      run();
    }
  }

  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", watch);
  else watch();
})();
