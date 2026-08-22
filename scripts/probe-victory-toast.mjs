/**
 * 승리 화면 토스트 침범 프로브 (2026-08-23).
 *
 * 보스 격파 직전 1.6초 안에 잡힌 공허 잔재가 승리 연출 «위에서»
 * 되살아나며 「공허 잔재 재생성」 토스트로 결과 카드를 덮는지 잰다.
 * update()의 잔재 루프가 `if (!run) return`보다 먼저 돌고 scheduleWin이
 * run을 끄지 않는 것이 원인이었다.
 *
 * 재는 법 — 3-1(잔재 1)에서 잔재를 잡아 down을 태우고, 같은 순간
 * 보스를 0으로 만들어 scheduleWin을 부른다. 그 뒤 3초를 실제 프레임으로
 * 돌리며 (a) 잔재 hp가 되살아나는지 (b) 토스트 텍스트에 「재생성」이
 * 뜨는지를 매 프레임 감시한다.
 *
 * 함정 — scheduleWin 자신이 clearToastQueue 후 «별이 하늘로» 배너를
 * 올리므로, 텍스트 전체가 아니라 「재생성」 포함 여부만 본다.
 *
 * 대조군 — 같은 판에서 보스를 살려 둔 채 잔재만 잡으면 1.6초 뒤 재생성이
 * «여전히» 돌아야 한다. 수정이 승리 경로만 막았는지 여기서 확인한다.
 *
 *   node scripts/probe-victory-toast.mjs
 */
import { setTimeout as delay } from "node:timers/promises";
import { launchProbe } from "./lib/probe-harness.mjs";
const probe = await launchProbe({ headless: true, profilePrefix: "vtoast-" });
try {
  const { evaluate, waitFor } = probe;
  await waitFor("typeof setupBattle === 'function'", 20000, "runtime");
  await evaluate(`(() => {
    stageIndex = stages.findIndex(s => s.id === "3-1");
    deployed = ["gaon","biyeon","ria"]; selected = [...deployed];
    resetBuild(); setupBattle(); settings.sfx = 0;
    if (typeof skipBattleIntro === "function") skipBattleIntro();
    const a = adds[0];
    a.hp = 0; a.down = 1.6;            // 잔재 격파 직후 상태
    boss.hp = 0; scheduleWin();        // 같은 순간 보스 격파
    window.__watch = { respawned: false, toastHit: false, samples: [] };
    const el = document.getElementById("toast");
    const iv = setInterval(() => {
      if (a.hp > 0) window.__watch.respawned = true;
      const text = el ? el.textContent : "";
      if (text.includes("재생성")) window.__watch.toastHit = true;
    }, 16);
    setTimeout(() => { clearInterval(iv); window.__watch.done = true; }, 3600);
    return 1;
  })()`);
  await waitFor(
    "window.__watch && window.__watch.done === true",
    9000,
    "감시 종료",
  );
  const w = await evaluate(`window.__watch`);
  /* 결과 카드는 victory.d(2.55s)+impactStop 뒤에 선다 — 내용으로 확인한다.
     클래스만 보면 rAF가 늦게 도는 헤드리스에서 타이밍 경주가 된다. */
  await waitFor(
    `(document.getElementById("overlay")?.innerHTML ?? "").includes("outcome-cut win")`,
    6000,
    "결과 카드",
  );
  const won = true;
  console.log(JSON.stringify({ ...w, resultCardShown: won }, null, 2));
  /* 대조군: 보스가 살아 있는 판에서는 재생성이 여전히 돌아야 한다. */
  await evaluate(`(() => {
    stageIndex = stages.findIndex(s => s.id === "3-1");
    deployed = ["gaon","biyeon","ria"]; selected = [...deployed];
    resetBuild(); setupBattle(); settings.sfx = 0;
    if (typeof skipBattleIntro === "function") skipBattleIntro();
    const a = adds[0];
    a.hp = 0; a.down = 1.6;
    return 1;
  })()`);
  await delay(2400);
  const live = await evaluate(`({ hp: adds[0].hp, max: adds[0].maxHp })`);
  console.log("대조군(전투 중):", JSON.stringify(live));
  const ok = !w.respawned && !w.toastHit && won && live.hp === live.max;
  console.log(
    ok
      ? "판정: 승리 연출 중에는 조용하고, 전투 중에는 여전히 재생성된다."
      : "판정: 실패 — " +
          (live.hp !== live.max
            ? "전투 중 재생성이 죽었다(과잉 수정)."
            : "승리 화면 위로 재생성이 샌다."),
  );
  process.exitCode = ok ? 0 : 1;
} finally {
  await probe.close();
}
