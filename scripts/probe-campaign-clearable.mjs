/**
 * 캠페인 완주 프로브 (2026-08-22).
 *
 * 판이 «서는 것»과 «깰 수 있는 것»은 다르다. 각 월드의 첫 판과 마지막
 * 둘에서 유성을 전부 쓰며 노드 조준이 낼 수 있는 피해를 재고 보스 체력과
 * 비교한다.
 *
 * 정책은 일부러 최악이다 — 항상 별지기 셋만 찍는다. 별빛이 없는 판의
 * 유일 조합이자 1-1 수업이 가르치는 손이고, 사람이 이보다 못할 수는
 * 없다. 그러므로 여기서 «깬다»는 곧 바닥이 클리어라는 뜻이다.
 *
 * 승리는 battleComplete가 아니라 scheduleWin 호출로 가른다 — 유성 소진
 * (패배)도 battleComplete를 세우므로, 그 값을 클리어로 읽으면 진 판이
 * 이긴 판으로 집계된다(이 프로브를 처음 쓸 때 실제로 그렇게 틀렸다).
 *
 *   node scripts/probe-campaign-clearable.mjs
 */
import { setTimeout as delay } from "node:timers/promises";
import { launchProbe } from "./lib/probe-harness.mjs";
const probe = await launchProbe({
  headless: true,
  profilePrefix: "clearable-",
});
const rows = [];
try {
  const { evaluate, waitFor } = probe;
  await waitFor("typeof setupBattle === 'function'", 20000, "runtime");
  /* 기본은 월드마다 «첫 판»이다 — 사다리의 첫 칸이라 쉬운 것이 설계다.
     기믹이 난이도를 만들었는지 보려면 «마지막 칸»을 재야 한다:
       node scripts/probe-campaign-clearable.mjs --stages 1-3 2-4 3-4 4-5 5-5 6-6 7-7 */
  const ids = process.argv.includes("--stages")
    ? process.argv
        .slice(process.argv.indexOf("--stages") + 1)
        .filter((a) => /^\d-\d$/.test(a))
    : ["1-1", "2-1", "3-1", "4-1", "5-1", "6-1", "7-1", "7-7", "8-1"];
  for (const id of ids) {
    const setup = await evaluate(`(() => {
      const i = stages.findIndex(s => s.id === ${JSON.stringify(id)});
      if (i < 0) return null;
      const st = stages[i];
      stageIndex = i;
      deployed = ["gaon","biyeon","ria","lumi"].slice(0, st.slots.length);
      selected = [...deployed];
      resetBuild(); setupBattle(); settings.sfx = 0;
      if (typeof skipBattleIntro === "function") skipBattleIntro();
      /* 승리를 battleComplete로 읽으면 안 된다 — 패배(유성 소진)도 그 값을
         세운다. scheduleWin이 실제로 불렸는가로 가른다. */
      window.__won = false;
      if (typeof scheduleWin === "function" && !window.__winWrapped) {
        window.__winWrapped = true;
        const real = scheduleWin;
        scheduleWin = function (...a) { window.__won = true; return real.apply(this, a); };
      }
      return { hp: boss.maxHp, shots: battle.shots };
    })()`);
    if (!setup) continue;
    for (let shot = 0; shot < setup.shots + 2; shot++) {
      const fired = await evaluate(`(() => {
        if (!battle || battleComplete || ball.moving) return false;
        if (!aimStarReady()) return false;
        aimPick = [0,1,2];
        return launchAimStarShot();
      })()`);
      if (!fired) break;
      // 비행 + 정산 대기
      for (let t = 0; t < 200; t++) {
        const done = await evaluate(
          `!ball.moving && !(typeof isFigureResolutionPending === "function" && isFigureResolutionPending())`,
        );
        if (done) break;
        await delay(120);
      }
      await delay(400);
      if (await evaluate(`battleComplete === true || battle.shots <= 0`)) break;
    }
    const end = await evaluate(
      `({ hp: Math.max(0, boss.hp), max: boss.maxHp, complete: battleComplete, won: window.__won === true, shots: battle.shots })`,
    );
    const dealt = end.max - end.hp;
    rows.push({
      id,
      hp: end.max,
      dealt,
      pct: Math.round((dealt * 100) / end.max),
      cleared: end.won,
    });
    console.log(
      id.padEnd(4),
      "체력",
      String(end.max).padStart(4),
      "· 피해",
      String(dealt).padStart(4),
      "(" + Math.round((dealt * 100) / end.max) + "%)",
      end.won ? "· 클리어" : "· 실패",
    );
    await delay(200);
  }
} finally {
  probe.close();
}
process.exit(0);
