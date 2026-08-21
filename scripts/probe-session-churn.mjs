/**
 * 세션 누수 프로브 (2026-08-21).
 *
 * 표현 계층(하늘·픽셀 UI·외부 관측자)은 세션 내내 살아 있어, 한 번 새는
 * 것이 끝까지 남는다. 화면을 오래 오갔을 때 «무엇이 쌓이는가»를 잰다 —
 * 노드·리스너·캔버스·CSS 애니메이션, 그리고 강제 GC 뒤의 값까지.
 *
 * 읽는 법: 한 번의 증가는 누수가 아니다. 타이틀(버튼 3개)과 허브(버튼
 * 10여 개)는 화면 자체가 다르므로 리스너 수가 다른 것이 정상이다.
 * 판단 기준은 «왕복을 더 해도 계속 느는가»이고, 강제 GC 뒤에도 단조
 * 증가가 이어질 때만 누수다.
 *
 * 2026-08-21 기준선(왕복 10회 + 타이틀 10회): 리스너 30 -> 71에서 멈추고
 * GC 뒤에도 71, 캔버스 12 고정, 애니메이션 17~22, 힙 2~3MB. 누수 없음.
 *
 * 이름이 비슷한 probe-session-leak.mjs 와 재는 축이 다르다. 여기는 «화면을
 * 오간다»가 축이라 전투에 아예 안 들어간다 — 샷마다 쌓이는 것(이펙트 배열,
 * 대사·토스트 큐, 효과음 풀, 살아 있는 타이머)은 그쪽에서 잰다.
 *
 *   node scripts/probe-session-churn.mjs
 */
import { setTimeout as delay } from "node:timers/promises";
import { launchProbe } from "./lib/probe-harness.mjs";
const probe = await launchProbe({
  headless: true,
  windowSize: "1400,940",
  profilePrefix: "leak-",
});
try {
  const { send, evaluate, waitFor } = probe;
  await waitFor("typeof setupBattle === 'function'", 20000, "runtime");
  await evaluate(`localStorage.setItem("prism-breakers.story-intro.v1","1");
    localStorage.setItem("stella-ball.onboarding.v1","1");
    localStorage.setItem("stella-ball.onboarding-clear.v1","1");
    localStorage.setItem("stella-ball.party-slots.v1","3");
    localStorage.setItem("prism-breakers.progress.v1", JSON.stringify({ clears: 20 }));
    location.reload(); true`);
  await delay(5000);
  for (let i = 0; i < 2; i++) {
    await evaluate(
      "[...document.querySelectorAll('button')].find(b=>b.textContent.includes('건너뛰기'))?.click(); true",
    );
    await delay(1300);
  }
  const census = () =>
    evaluate(`({
    nodes: document.querySelectorAll("*").length,
    canvases: document.querySelectorAll("canvas").length,
    anims: document.getAnimations().length,
    skyKids: document.querySelector("#dawn-sky")?.childElementCount ?? -1,
    ambience: document.querySelector("#sky-ambience")?.querySelectorAll("*").length ?? -1,
    cin: document.querySelectorAll(".cin").length,
    overlayKids: document.querySelector("#overlay")?.childElementCount ?? -1,
  })`);
  await send("Performance.enable");
  const metrics = async () => {
    const m = Object.fromEntries(
      (await send("Performance.getMetrics")).metrics.map((x) => [
        x.name,
        x.value,
      ]),
    );
    return {
      nodes: m.Nodes,
      listeners: m.JSEventListeners,
      docs: m.Documents,
      heapMB: Math.round(m.JSHeapUsedSize / 1048576),
    };
  };
  console.log(
    "baseline:",
    JSON.stringify(await census()),
    JSON.stringify(await metrics()),
  );
  // 허브 <-> 전투 10회 왕복
  for (let i = 0; i < 10; i++) {
    await evaluate(
      `stageIndex = stages.findIndex(s=>s.id==="1-2"); deployed=["gaon","biyeon","ria"]; selected=[...deployed]; resetBuild(); setupBattle(); settings.sfx=0; true`,
    );
    await delay(500);
    await evaluate(`setScene("meta"); showMeta(); true`);
    await delay(300);
  }
  await delay(1200);
  console.log(
    "after 10 round trips:",
    JSON.stringify(await census()),
    JSON.stringify(await metrics()),
  );
  // 타이틀 <-> 허브 10회
  for (let i = 0; i < 10; i++) {
    await evaluate(`showTitle?.(); true`);
    await delay(220);
    await evaluate(`showMeta?.(); true`);
    await delay(220);
  }
  await delay(1200);
  console.log(
    "after title cycles:",
    JSON.stringify(await census()),
    JSON.stringify(await metrics()),
  );
  // GC를 강제해 «분리된 노드가 아직 안 치워진 것»과 «진짜 누수»를 가른다
  await send("HeapProfiler.enable");
  await send("HeapProfiler.collectGarbage");
  await delay(1200);
  console.log(
    "after forced GC:",
    JSON.stringify(await census()),
    JSON.stringify(await metrics()),
  );
  console.log("errors:", JSON.stringify(probe.errors.slice(0, 6)));
} finally {
  probe.close();
}
process.exit(0);
