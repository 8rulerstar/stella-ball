/**
 * 메타 화면 다섯을 열어 «실제로 무엇이 적혀 있나»와 «닿을 수 없는 것이
 * 있나»를 본다.
 *
 * 전투는 프로브가 여럿인데 상점·소환·프로필·업적·설정은 한 번도 실기로
 * 본 적이 없다. 문안과 스크린샷은 판정 없이 모으고(눈으로 읽는다), 배치는
 * 판정한다 — 눌러야 하는 버튼이 화면 밖에 있고 스크롤로도 못 닿거나,
 * 스크롤 상자가 0px 로 눌려 내용이 통째로 사라지는 것은 취향이 아니라
 * 고장이다.
 *
 * 낮은 창에서만 드러난다. 1280x900 에서 멀쩡하던 업적 목록이 1280x760 에서
 * 높이 0이 되어 다섯 장이 한 장도 안 보였다(스크롤바조차 없었다). 그래서
 * 기본으로 두 크기를 돈다.
 *
 * 이 프로브가 틀리는 법:
 * 1. 외부 관측자 인트로가 화면을 덮은 채로 찍으면 전부 새까맣게 나온다.
 *    먼저 `StellaIntroObserver.stop()`.
 * 2. 화면을 연 직후는 진입 애니메이션 중이라 요소가 제자리에 없다. 열고
 *    충분히 기다린 뒤 찍는다.
 * 3. 저장이 비어 있으면 상점·소환이 「가진 것 없음」 상태만 보여 준다.
 *    실제 플레이 상태를 보려면 골드와 보유를 먼저 채워야 한다.
 * 4. 메타 상태는 전부 `progress.*` 아래에 있다. 맨 전역에 `gold = 4200`을
 *    쓰면 «성공»하고 아무것도 안 바뀐다 — 새 전역이 하나 생길 뿐이라
 *    오류도 안 난다. 실제로 첫 실행에서 다섯 화면이 전부 「보유 골드 0」을
 *    보여 주는 것을 게임 버그로 볼 뻔했다.
 *
 * 5. 「화면 밖에 있다」만으로 고장이라 하면 안 된다. 스크롤되는 조상이
 *    있으면 닿을 수 있다. 조상을 타고 올라가 실제로 스크롤 여유가 있는지
 *    확인해야 «못 닿는다»라고 말할 수 있다.
 *
 *   node scripts/probe-meta-screens.mjs
 *   node scripts/probe-meta-screens.mjs --sizes 1280,900 1024,680
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { setTimeout as delay } from "node:timers/promises";
import { launchProbe } from "./lib/probe-harness.mjs";

/* 기본 출력은 artifacts/ 아래다 — 저장소가 이미 무시하는 자리라 스크린샷
   수십 장이 커밋에 딸려 들어가지 않는다. */
const OUT = process.argv.includes("--out")
  ? process.argv[process.argv.indexOf("--out") + 1]
  : "artifacts/meta-screens";
mkdirSync(OUT, { recursive: true });

const SIZES = process.argv.includes("--sizes")
  ? process.argv
      .slice(process.argv.indexOf("--sizes") + 1)
      .filter((a) => /^\d+,\d+$/.test(a))
  : ["1280,900", "1280,760"];

const SCREENS = [
  ["title", "showTitle()"],
  ["hub", "showMeta()"],
  ["stage-select", "showStageSelect()"],
  ["roster", "showRoster()"],
  ["deployment", "showDeployment()"],
  ["shop", "showShop()"],
  ["gacha", "showGacha()"],
  ["profile", "showProfile()"],
  ["achievements", "showAchievements()"],
  ["library", "showLibrary()"],
  ["settings", "showSettings(() => {})"],
  /* 일시정지는 판이 서 있어야 뜬다. 앞의 것들과 달리 전투를 먼저 세운다. */
  [
    "pause",
    "(() => { deployed = selected = ['gaon','biyeon','ria']; stageIndex = 0; resetBuild(); setupBattle(); showPauseMenu(); })()",
  ],
];

/* 화면에 실제로 보이는 글자만 긁는다 — 숨은 것은 빼고, 버튼은 따로 센다. */
const TEXT = `(() => {
  const root = document.querySelector("#overlay") || document.body;
  const vis = (el) => {
    const cs = getComputedStyle(el);
    return cs.display !== "none" && cs.visibility !== "hidden" && +cs.opacity > 0.05;
  };
  const lines = [];
  const walk = (el) => {
    if (!vis(el)) return;
    for (const n of el.childNodes) {
      if (n.nodeType === 3) {
        const t = n.textContent.trim();
        if (t) lines.push(t);
      } else if (n.nodeType === 1) walk(n);
    }
  };
  walk(root);
  const buttons = [...root.querySelectorAll("button")]
    .filter(vis)
    .map((b) => b.textContent.trim().slice(0, 30));
  return JSON.stringify({ lines, buttons, disabled: [...root.querySelectorAll("button:disabled")].filter(vis).map((b) => b.textContent.trim().slice(0, 24)) });
})()`;

/* 배치 판정. 네 가지만 본다 — 넷 다 «취향»이 아니라 «고장»이다.
   ① 눌러야 하는 버튼이 화면 밖인데 스크롤로도 못 닿는다.
   ② 스크롤 상자가 0px 로 눌려 내용이 통째로 안 보인다.
   ③ 자식이 제 상자 밖으로 나와 이웃에 겹친다(overflow:visible 인 곳).
   ④ 초상의 스프라이트 «칸»이 제 상자와 다르다(인물이 잘린다). */
const AUDIT = `(() => {
  const vw = innerWidth, vh = innerHeight;
  const vis = (el) => {
    const cs = getComputedStyle(el);
    return cs.display !== "none" && cs.visibility !== "hidden" && +cs.opacity > 0.05;
  };
  /* 함정 5 — 화면 밖이어도 스크롤되는 조상이 있으면 닿는다. */
  const scrollableUp = (el) => {
    for (let p = el.parentElement; p; p = p.parentElement) {
      const cs = getComputedStyle(p);
      if (/auto|scroll/.test(cs.overflowY) && p.scrollHeight - p.clientHeight > 1) return true;
      if (/auto|scroll/.test(cs.overflowX) && p.scrollWidth - p.clientWidth > 1) return true;
    }
    const d = document.scrollingElement;
    return !!d && (d.scrollHeight - d.clientHeight > 1 || d.scrollWidth - d.clientWidth > 1);
  };
  const name = (el) =>
    (el.id ? "#" + el.id : "") +
    (el.className ? "." + String(el.className).split(" ")[0] : "") +
    "[" + (el.textContent || "").trim().slice(0, 14) + "]";

  const unreachable = [];
  for (const b of document.querySelectorAll("button, [role=button], a[href]")) {
    if (!vis(b) || b.disabled) continue;
    const r = b.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) continue;
    if ((r.bottom > vh + 1 || r.top < -1 || r.right > vw + 1 || r.left < -1) && !scrollableUp(b))
      unreachable.push(name(b) + " @" + Math.round(r.top) + "," + Math.round(r.left));
  }

  const crushed = [];
  for (const el of document.querySelectorAll("*")) {
    if (!vis(el)) continue;
    if (!/auto|scroll/.test(getComputedStyle(el).overflowY)) continue;
    if (el.clientHeight < 8 && el.scrollHeight > 24 && el.children.length)
      crushed.push(name(el) + " " + el.clientHeight + "/" + el.scrollHeight + "px");
  }

  const spill = [];
  for (const el of document.querySelectorAll(
    ".achievement-card, .shop-card, .skin-card, .summon-card, .profile-panel, .setting-row, .claim-banner",
  )) {
    if (!vis(el) || /auto|scroll/.test(getComputedStyle(el).overflowY)) continue;
    const over = el.scrollHeight - el.clientHeight;
    if (over > 4) spill.push(name(el) + " +" + over + "px");
  }
  /* 초상이 제 틀에 안 맞는 것. setPortrait(el, hero, size) 는 인라인으로
     background-size: (칸수*size)px (size)px 을 쓰므로, size 가 곧 스프라이트
     «한 칸»의 변이다. 그 값이 요소 상자와 다르면 칸의 일부만 보이고 인물이
     구석으로 밀린다 — 소환 리빌이 상자 72px 에 칸 96px 이라 지팡이가
     잘려 있었다. 인라인 px 배경만 본다: 그것이 setPortrait 의 흔적이다. */
  const cropped = [];
  for (const el of document.querySelectorAll("[style*='background-size']")) {
    if (!vis(el)) continue;
    const m = /^(\\d+(?:\\.\\d+)?)px (\\d+(?:\\.\\d+)?)px$/.exec(el.style.backgroundSize || "");
    if (!m) continue;
    const cell = parseFloat(m[2]);
    const w = el.clientWidth, h = el.clientHeight;
    if (!w || !h) continue;
    if (Math.abs(cell - w) > 1 || Math.abs(cell - h) > 1)
      cropped.push(name(el) + " 칸 " + cell + "px / 상자 " + w + "x" + h);
  }
  return JSON.stringify({ unreachable, crushed, spill, cropped });
})()`;

let broken = 0;
for (const size of SIZES) {
  const probe = await launchProbe({ windowSize: size });
  const { evaluate, waitFor, send, close, errors } = probe;
  console.log(`\n████ 창 ${size}`);
  try {
    await waitFor("typeof showShop === 'function'", 30000);
    await evaluate("window.StellaIntroObserver?.stop(), 1");
    /* 함정 3·4 — 비어 있는 저장은 화면의 절반을 안 보여 주고, 상태는
       전부 progress.* 아래에 있다. */
    await evaluate(`(() => {
      progress.gold = 4200;
      progress.clears = 9;
      progress.bestTime = 41200;
      progress.bestShots = 3;
      progress.bestCombo = 7;
      progress.freeSummons = 1;
      /* 「시작 데이터로만 본 화면은 안 본 것이다」(MAINTENANCE). 보유 셋이면
         트레이·상점·도감이 절반만 그려지고, 트레이는 일곱부터 초상을 32px
         로 줄이는 가지가 아예 안 돌아 본다. 전원 보유로 돌린다. */
      progress.ownedHeroes = Object.keys(heroes).slice(0, 8);
      saveProgress();
      return 1;
    })()`);
    await delay(600);

    for (const [name, call] of SCREENS) {
      await evaluate(`(() => { ${call}; return 1; })()`).catch(() => {});
      await delay(1400); // 함정 2
      const { data } = await send("Page.captureScreenshot", { format: "png" });
      writeFileSync(
        `${OUT}/${name}-${size.replace(",", "x")}.png`,
        Buffer.from(data, "base64"),
      );
      const d = JSON.parse(await evaluate(TEXT));
      const a = JSON.parse(await evaluate(AUDIT));
      const bad =
        a.unreachable.length +
        a.crushed.length +
        a.spill.length +
        a.cropped.length;
      if (bad) broken += 1;
      console.log(
        `\n══ ${name}  글줄 ${d.lines.length} · 버튼 ${d.buttons.length} · 잠김 ${d.disabled.length}  ${bad ? "✗ 배치 문제 " + bad + "건" : "· 배치 정상"}`,
      );
      if (a.crushed.length)
        console.log("   눌려 죽은 스크롤 상자: " + a.crushed.join(", "));
      if (a.unreachable.length)
        console.log("   못 닿는 버튼: " + a.unreachable.join(", "));
      if (a.spill.length)
        console.log("   상자 밖으로 나온 것: " + a.spill.join(", "));
      if (size === SIZES[0]) console.log("   " + d.lines.join(" / "));
      await evaluate("setScene('meta'), 1").catch(() => {});
      await delay(400);
    }
    if (errors.length) console.log("\n   콘솔 오류: " + errors.join(" | "));
  } finally {
    close();
  }
}
console.log(`\n════ 배치 문제가 있는 화면 ${broken}건 · 스크린샷 -> ${OUT}/`);
