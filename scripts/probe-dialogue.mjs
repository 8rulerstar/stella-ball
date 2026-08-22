/**
 * 한 판에서 «누가 몇 마디 하는가».
 *
 * 대사가 늘었는지는 파일의 줄 수가 아니라 판에서 들리는 말의 수로만
 * 확인할 수 있다. say() 를 가로채 화자·문장·시각을 전부 적는다.
 *
 * 이 프로브가 틀리는 법:
 * 1. say() 를 «가로채고 원본을 안 부르면» 말풍선이 안 뜬다. 반드시 통과시킨다.
 * 2. 수업 중에는 판 위 대사를 일부러 안 낸다. 캠페인 판에서 재야 한다.
 * 3. 대사는 쿨다운이 있다. 샷을 몇 번 굴려야 표본이 모인다.
 * 4. 관측자 인트로가 켜져 있으면 판이 안 돈다.
 *
 *   node scripts/probe-dialogue.mjs
 */
import { setTimeout as delay } from "node:timers/promises";
import { launchProbe } from "./lib/probe-harness.mjs";

const probe = await launchProbe({ windowSize: "1280,900" });
const { evaluate, waitFor, close, errors } = probe;

/* 가로채기가 아니라 «관찰»한다.
   처음에는 StellaRuntime.modules.optional("speech").say 를 감쌌는데 0마디가
   나왔다 — 모듈 객체를 지나는 호출만 잡히고, 훅에서 부르는 맨 say() 는
   그대로 지나가기 때문이다. 화면에 실제로 뜬 것을 세는 편이 애초에 옳다:
   말풍선이 떴는가가 곧 대사가 들렸는가다. */
const OBSERVE = `(() => {
  if (window.__speechWatch) return "이미";
  window.__lines = [];
  const seen = new Set();
  const note = (who, text) => {
    if (!text) return;
    const key = who + "|" + text;
    if (seen.has(key)) return;
    seen.add(key);
    window.__lines.push({ who, text, at: Math.round(frameClock) });
  };
  window.__speechWatch = setInterval(() => {
    try {
      for (const b of speechOnBoard) note("unit:" + (b.gate?.s ?? "?"), b.text);
      if (speechBanner) note("boss", speechBanner.text);
      if (speechNarration) note("narration", speechNarration.text);
      const dock = document.querySelector("#lunaSpeech");
      if (dock && getComputedStyle(dock).opacity > 0.1)
        note("luna", (dock.querySelector(".luna-speech-text")?.textContent || "").trim());
    } catch (e) {}
  }, 90);
  return "설치";
})()`;

try {
  await waitFor("typeof setupBattle === 'function'", 30000);
  await evaluate("window.StellaIntroObserver?.stop(), 1"); // 함정 4
  await evaluate("progress.clears = 30, saveProgress(), 1").catch(() => {});
  console.log("관찰: " + (await evaluate(OBSERVE)));

  for (const id of ["1-3", "4-3", "7-4"]) {
    await evaluate(`(() => {
      const i = stages.findIndex((s) => s.id === ${JSON.stringify(id)});
      stageIndex = i;
      deployed = selected = Object.keys(heroes).slice(0, 3);
      resetBuild(); setupBattle(); window.__lines = [];
      return 1;
    })()`);
    await waitFor("!battleCine", 12000).catch(() => {});
    await evaluate("window.StellaIntroObserver?.stop(), 1").catch(() => {});
    await delay(900);
    // 함정 3 — 몇 발 굴려 표본을 모은다.
    for (let shot = 0; shot < 4; shot += 1) {
      await evaluate(`(() => {
        const n = aimNodes();
        const u = n.map((x, i) => [x, i]).filter(([x]) => x.unit).slice(0, 3).map(([, i]) => i);
        if (u.length >= 3) { aimPick = u; launchAimStarShot(); }
        return 1;
      })()`).catch(() => {});
      await delay(2600);
    }
    const lines = JSON.parse(
      await evaluate("JSON.stringify(window.__lines || [])"),
    );
    const byWho = {};
    for (const l of lines) (byWho[l.who] ??= []).push(l.text);
    console.log(`\n══ ${id} — 총 ${lines.length}마디`);
    for (const [who, texts] of Object.entries(byWho))
      console.log(
        `   ${who.padEnd(9)} ${texts.length}  ` +
          [...new Set(texts)]
            .slice(0, 4)
            .map((t) => "「" + t + "」")
            .join(" "),
      );
  }
  console.log(
    errors.length ? "\n콘솔 오류: " + errors.join(" | ") : "\n콘솔 오류 없음",
  );
} finally {
  close();
}
