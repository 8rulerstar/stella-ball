/**
 * 연속 플레이 회귀 프로브 (2026-08-22).
 *
 * 세 판을 이어서 클리어하고 허브로 돌아온다. 한 화면씩 정지 검증하는
 * 것으로는 안 보이는 «누적된 이상»을 잡는 것이 목적이다 — 이번 밤에
 * 실제로 그런 계열을 셋 고쳤다(인트로 레이어 잔존, 컷신 상자 유령,
 * 메타 화면 토스트가 안 사라짐).
 *
 * 보는 것: 판마다 실제 승리(scheduleWin)·남은 유성·유령 컷신 상자,
 * 허브 복귀 뒤의 클리어 수·보상 적립·떠도는 인트로 레이어.
 *
 * 2026-08-22 기준선: 세 판 모두 승리, 유령 요소 0, 보상 3건 적립,
 * 콘솔 오류 0.
 *
 *   node scripts/probe-longplay.mjs
 */
import { setTimeout as delay } from "node:timers/promises";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { launchProbe } from "./lib/probe-harness.mjs";
const probe = await launchProbe({
  headless: true,
  windowSize: "1400,940",
  profilePrefix: "longplay-",
});
try {
  const { send, evaluate, waitFor } = probe;
  const snap = async (n) => {
    const c = await send("Page.captureScreenshot", { format: "png" });
    writeFileSync(
      join(process.env.TEMP, "lp-" + n + ".png"),
      Buffer.from(c.data, "base64"),
    );
  };
  await waitFor("typeof setupBattle === 'function'", 20000, "runtime");
  await evaluate(`localStorage.setItem("prism-breakers.story-intro.v1","1");
    localStorage.setItem("stella-ball.onboarding.v1","1");
    localStorage.setItem("stella-ball.onboarding-clear.v1","1");
    localStorage.setItem("stella-ball.party-slots.v1","3");
    localStorage.setItem("prism-breakers.progress.v1", JSON.stringify({ clears: 3, gold: 400 }));
    location.reload(); true`);
  await delay(4600);
  for (let i = 0; i < 2; i++) {
    await evaluate(
      "[...document.querySelectorAll('button')].find(b=>b.textContent.includes('건너뛰기'))?.click(); true",
    );
    await delay(1200);
  }
  // 세 판을 연속으로 클리어까지
  for (const [n, id] of [
    [1, "1-2"],
    [2, "1-3"],
    [3, "2-1"],
  ]) {
    await evaluate(`stageIndex = stages.findIndex(s=>s.id===${JSON.stringify(id)}); deployed=["gaon","biyeon","ria"]; selected=[...deployed]; resetBuild(); setupBattle(); settings.sfx=0; window.__won=false;
      if (!window.__wrap) { window.__wrap = true; const real = scheduleWin; scheduleWin = function(...a){ window.__won = true; return real.apply(this,a); }; }
      true`);
    await delay(7200);
    for (let shot = 0; shot < 7; shot++) {
      const fired = await evaluate(
        `(() => { if (!battle || battleComplete || ball.moving || !aimStarReady()) return false; aimPick=[0,1,2]; return launchAimStarShot(); })()`,
      );
      if (!fired) break;
      for (let t = 0; t < 200; t++) {
        if (
          await evaluate(
            `!ball.moving && !(typeof isFigureResolutionPending === "function" && isFigureResolutionPending())`,
          )
        )
          break;
        await delay(120);
      }
      await delay(350);
      if (await evaluate(`battleComplete === true`)) break;
    }
    await delay(3200);
    await snap("stage" + n);
    console.log(
      "판" + n,
      id,
      JSON.stringify(
        await evaluate(`({
      won: window.__won === true, hp: Math.max(0,boss.hp), shots: battle?.shots ?? null,
      cin: document.querySelectorAll(".cin").length,
      toasts: document.querySelector("#toast")?.textContent?.trim()?.slice(0,26) ?? null,
      dock: document.querySelector("#lunaSpeech, .luna-speech")?.textContent?.trim()?.slice(0,30) ?? null,
      overlay: document.querySelector("#overlay")?.className ?? null,
    })`),
      ),
    );
    await evaluate(`setScene("meta"); showMeta(); true`);
    await delay(1200);
  }
  await snap("hub-after");
  console.log(
    "허브 복귀:",
    JSON.stringify(
      await evaluate(`({
    gold: progress.gold, clears: progress.clears,
    pending: (progress.pendingRewards||[]).length,
    strayCin: document.querySelectorAll(".cin").length,
    strayLayer: document.querySelectorAll("#oo2-layer, .oo2-skip").length,
  })`),
    ),
  );
  console.log("errors:", JSON.stringify(probe.errors.slice(0, 8)));
} finally {
  probe.close();
}
process.exit(0);
