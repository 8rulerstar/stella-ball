/**
 * 메타 화면 다섯을 열어 «실제로 무엇이 적혀 있나»를 뽑는다.
 *
 * 전투는 프로브가 여럿인데 상점·소환·프로필·업적·설정은 한 번도 실기로
 * 본 적이 없다. 여기서는 성능이 아니라 «문안과 상태»를 본다 — 판정 없는
 * 수집 도구다. 나온 것을 눈으로 읽고 판단한다.
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
 *   node scripts/probe-meta-screens.mjs
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { setTimeout as delay } from "node:timers/promises";
import { launchProbe } from "./lib/probe-harness.mjs";

const OUT = process.argv.includes("--out")
  ? process.argv[process.argv.indexOf("--out") + 1]
  : "shots";
mkdirSync(OUT, { recursive: true });

const probe = await launchProbe({ windowSize: "1280,900" });
const { evaluate, waitFor, send, close, errors } = probe;

const SCREENS = [
  ["shop", "showShop()"],
  ["gacha", "showGacha()"],
  ["profile", "showProfile()"],
  ["achievements", "showAchievements()"],
  ["settings", "showSettings(() => {})"],
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

try {
  await waitFor("typeof showShop === 'function'", 30000);
  await evaluate("window.StellaIntroObserver?.stop(), 1");
  /* 함정 3 — 비어 있는 저장은 화면의 절반을 안 보여 준다. */
  await evaluate(`(() => {
    progress.gold = 4200;
    progress.clears = 9;
    progress.ownedHeroes = ["gaon","biyeon","ria","yunseul","byeolha"];
    progress.bestTime = 41200;
    progress.bestShots = 3;
    progress.bestCombo = 7;
    progress.freeSummons = 1;
    saveProgress();
    return 1;
  })()`);
  await delay(600);

  for (const [name, call] of SCREENS) {
    await evaluate(`(() => { ${call}; return 1; })()`).catch(() => {});
    await delay(1400); // 함정 2
    const { data } = await send("Page.captureScreenshot", { format: "png" });
    writeFileSync(`${OUT}/${name}.png`, Buffer.from(data, "base64"));
    const d = JSON.parse(await evaluate(TEXT));
    console.log(`\n══════ ${name}  (글줄 ${d.lines.length} · 버튼 ${d.buttons.length} · 잠긴 버튼 ${d.disabled.length})`);
    console.log(d.lines.join(" / "));
    console.log("  버튼: " + d.buttons.join(" | "));
    if (d.disabled.length) console.log("  잠김: " + d.disabled.join(" | "));
    await evaluate("setScene('meta'), 1").catch(() => {});
    await delay(400);
  }

  if (errors.length) console.log("\n콘솔 오류: " + errors.join(" | "));
  console.log(`\n스크린샷 -> ${OUT}/`);
} finally {
  close();
}
