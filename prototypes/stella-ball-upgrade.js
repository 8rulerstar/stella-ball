/* ============================================================
   시각 업그레이드 시안 킷 — VISUAL_UPGRADE_2026_08_22 §5·§6·§7
   stella-ball-pixel-ui.js 와 stella-ball-dawn.js «뒤»에 로드한다.
   전부 표현 계층: 판정색·heroes[].col·게임 규칙 불관여.
   ------------------------------------------------------------
   1) MAP 확장(§6-2·§7-7)  — .ig-cta / .oc-go / .world-step /
      .archive-tab / .constellation-node 카드가 킷 안으로 들어온다
   2) disabled 프레임(§6-4) — 냉색 팔레트, KINDS.disabled
   3) 픽셀 슬라이더(§5-1)   — 네이티브 range 를 킷 셰이프로
   4) 허브 탭 아이콘(§5-1)  — 글꼴 글리프 5개를 도트 시안으로
   5) 터치·포커스(§6-4)     — CSS는 upgrade.css 쪽
   ============================================================ */
(function () {
  "use strict";
  function ready(fn) {
    if (document.readyState === "loading")
      document.addEventListener("DOMContentLoaded", fn);
    else fn();
  }
  ready(function () {
    var kit = window.StellaPixelUI;
    if (!kit) return;

    /* ---- 2) disabled: 냉색(패배·냉각 계열, theme --cool-*) 프레임 ---- */
    kit.PAL.cool = {
      o: "#07020c",
      L: "#5c5470",
      D: "#141018",
      b: ["#3a3346", "#352f40", "#302a3a", "#2b2534", "#26202e"],
    };
    kit.KINDS.disabled = { shape: "pill", idle: kit.PAL.cool };
    /* 허브 지도 노드 카드용: 평상시 패널, 활성은 살구 림 */
    kit.KINDS.node = { shape: "round", idle: kit.PAL.panel };
    kit.KINDS.nodeActive = { shape: "round", idle: kit.PAL.panelW };

    /* ---- 1) dawn MAP 이 놓친 셀렉터 (§6-2 실측 23종 중 화면 8종 분) ---- */
    var MAP = [
      [".ig-cta, .stage-drawer-go, .oc-go, .outcome-cut button", "cta"],
      [
        ".oc-ghost, .world-step, .constellation-training, .language-choice button, #tutorialBack, #tutorialPrev, #tutorialNext",
        "sub",
      ],
      [".archive-tab", "tab"],
      [".archive-tab.on", "tabActive"],
      [".language-choice button.active", "tabActive"],
      [".constellation-node .stage-copy", "node"],
      [".constellation-node.active .stage-copy", "nodeActive"],
    ];
    function tagMap(root) {
      for (var i = 0; i < MAP.length; i++) {
        var els = (root || document).querySelectorAll(MAP[i][0]);
        for (var j = 0; j < els.length; j++) {
          if (els[j].dataset.pbtn !== MAP[i][1]) {
            els[j].dataset.pbtn = MAP[i][1];
            delete els[j].dataset.psz;
          }
        }
      }
    }
    /* 잠긴 컨트롤은 살구 CTA 프레임을 잃는다 (§6-3 소환 행) */
    function tagDisabled() {
      var els = document.querySelectorAll(
        ".gacha-draw.insufficient, .gacha-draw[disabled], button[disabled][data-pbtn]",
      );
      for (var i = 0; i < els.length; i++) {
        if (els[i].dataset.pbtn !== "disabled") {
          els[i].dataset.pbtn = "disabled";
          delete els[i].dataset.psz;
        }
      }
    }

    /* ---- 3) 픽셀 슬라이더: 트랙·채움을 킷 셰이프로 굽는다 ---- */
    var thumbUrl = kit.shape("round", 18, 18, kit.PAL.gold);
    var st = document.createElement("style");
    st.textContent =
      "input[type=range][data-pxr]::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;width:18px;height:18px;background:url(" +
      thumbUrl +
      ") 0 0/18px 18px no-repeat;image-rendering:pixelated;border:0;border-radius:0;margin-top:-2px;filter:drop-shadow(0 3px 0 #04080a)}" +
      "input[type=range][data-pxr]::-moz-range-thumb{width:18px;height:18px;background:url(" +
      thumbUrl +
      ") 0 0/18px 18px no-repeat;image-rendering:pixelated;border:0;border-radius:0}";
    document.head.appendChild(st);
    function paintRange(input) {
      var w = input.offsetWidth,
        h = 14;
      if (!w) return;
      var min = Number(input.min || 0),
        max = Number(input.max || 100),
        pct = (Number(input.value) - min) / (max - min || 1);
      var fillW = Math.max(0, Math.round((w * pct) / 3) * 3);
      var track = kit.shape("pill", w, h, kit.PAL.tealP);
      var imgs = "url(" + track + ")",
        sizes = w + "px " + h + "px";
      if (fillW >= 12) {
        imgs = "url(" + kit.shape("pill", fillW, h, kit.PAL.warm) + ")," + imgs;
        sizes = fillW + "px " + h + "px," + sizes;
      }
      input.style.backgroundImage = imgs;
      input.style.backgroundSize = sizes;
    }
    function skinRanges() {
      var els = document.querySelectorAll("input[type=range]");
      for (var i = 0; i < els.length; i++)
        (function (el) {
          if (el.dataset.pxr) return paintRange(el);
          el.dataset.pxr = "1";
          paintRange(el);
          el.addEventListener("input", function () {
            paintRange(el);
          });
        })(els[i]);
    }

    /* ---- 4) 허브 탭 아이콘 도트 시안 (§5-1: 글리프 ◎☄◈⚙ 대체) ----
       킷의 px 맵 관례(MAPS + sprite)를 그대로 쓴다. 8×8, 표시 16px = 2px 셀.
       ★(관측)만 킷의 star 셰이프를 재사용한다 — library/system 에 이미 있는
       icon-settings 는 재저장 대상(§4-12)이라 여기서는 시안 맵으로 통일. */
    var palI = { g: "#d9c2f0", o: "#ffd2a0", k: "#07020c" };
    kit.MAPS.tabProfile = [
      [
        "..gggg..",
        ".g....g.",
        ".g.oo.g.",
        ".g....g.",
        "..gggg..",
        ".gg..gg.",
        "gg....gg",
        "g......g",
      ],
      palI,
    ];
    kit.MAPS.tabSummon = [
      [
        "......oo",
        ".....ooo",
        "....oo..",
        "g..oo...",
        ".goo....",
        ".ooog...",
        "oo..g...",
        "o....g..",
      ],
      palI,
    ];
    kit.MAPS.tabShop = [
      [
        "..gggg..",
        ".g....g.",
        "g.o..o.g",
        "g......g",
        "g.o..o.g",
        "g..oo..g",
        ".g....g.",
        "..gggg..",
      ],
      palI,
    ];
    kit.MAPS.tabGear = [
      [
        "..g..g..",
        ".gggggg.",
        "gg.gg.gg",
        ".gg..gg.",
        ".gg..gg.",
        "gg.gg.gg",
        ".gggggg.",
        "..g..g..",
      ],
      palI,
    ];
    function tabIcons() {
      var map = {
        hubProfile: kit.sprite("tabProfile", 2),
        hubGacha: kit.sprite("tabSummon", 2),
        hubBattleTab: kit.icon("star", 20),
        hubShop: kit.sprite("tabShop", 2),
        hubSettings: kit.sprite("tabGear", 2),
      };
      for (var id in map) {
        var b = document.getElementById(id);
        if (!b || b.dataset.pxIcon) continue;
        var span = b.querySelector("span[aria-hidden]");
        if (!span || !map[id]) continue;
        b.dataset.pxIcon = "1";
        span.textContent = "";
        var im = document.createElement("img");
        im.src = map[id];
        im.alt = "";
        im.style.cssText =
          "width:16px;height:16px;image-rendering:pixelated;display:block;margin:0 auto";
        if (id === "hubBattleTab") im.style.width = im.style.height = "20px";
        span.appendChild(im);
      }
    }

    var timer;
    function pass() {
      tagMap();
      tagDisabled();
      skinRanges();
      tabIcons();
      kit.apply();
    }
    function schedule() {
      if (timer) return;
      timer = setTimeout(function () {
        timer = 0;
        pass();
      }, 140);
    }
    pass();
    setTimeout(pass, 350);
    new MutationObserver(schedule).observe(document.body, {
      childList: true,
      subtree: true,
    });
    addEventListener("resize", schedule);
  });
})();
