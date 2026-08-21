/**
 * 별지기 능력 회귀 프로브 (2026-08-22).
 *
 * 8종의 각성 능력이 실제로 «일어나는가»를 하나씩 깨워 확인한다. 능력은
 * 각자 다른 경로로 피해를 내므로(즉시 광역 / 어시스트 큐 / 연출 전용),
 * 한 지표로 묶지 않고 각성 여부·큐·필드FX·최종 피해를 함께 찍는다.
 *
 * 읽는 법:
 *   - 윤슬(bladewheel)의 피해 0은 정상이다. 정산 공격이 없고 각성 자체가
 *     회전 칼날로 나오는 설계다(PROJECT_CONTEXT).
 *   - 나머지 일곱은 피해가 있어야 한다. 다만 어시스트 큐를 타는 능력은
 *     착탄까지 2초 넘게 걸리므로 대기가 짧으면 0으로 보인다 — 이 프로브가
 *     처음 그렇게 오독했다(모루가 2.6초에 0, 4.2초에 15).
 *   - 사거리 변수는 일부러 없앴다. 별지기를 보스 옆에 세워 재므로,
 *     여기서 0이 나오면 «빗나갔다»가 아니라 «능력이 안 걸렸다»는 뜻이다.
 *     (기본 배치로 재던 때는 모루의 충격파가 닿지 않아 0으로 보였다.)
 *
 * 2026-08-22 기준선: 8종 모두 각성하고, 윤슬을 뺀 일곱이 피해를 낸다.
 *
 *   node scripts/probe-hero-abilities.mjs
 */
import { setTimeout as delay } from "node:timers/promises";
import { launchProbe } from "./lib/probe-harness.mjs";
const probe = await launchProbe({ headless: true, profilePrefix: "abil-" });
try {
  const { evaluate, waitFor } = probe;
  await waitFor("typeof setupBattle === 'function'", 20000, "runtime");
  const heroes = await evaluate(
    `Object.entries(heroes).map(([id,h]) => ({ id, name: h.s, fx: h.fx }))`,
  );
  for (const h of heroes) {
    const r = await evaluate(`(() => {
      try {
        stageIndex = stages.findIndex(s => s.id === "2-2");
        deployed = [${JSON.stringify(h.id)}, "biyeon", "ria"].slice(0, stages[stageIndex].slots.length);
        selected = [...deployed];
        resetBuild(); setupBattle(); settings.sfx = 0;
        boss.hp = boss.maxHp = 99999;
        if (typeof skipBattleIntro === "function") skipBattleIntro();
        const g = gates.find(x => x.id === ${JSON.stringify(h.id)});
        if (!g) return { err: "gate 없음" };
        /* 사거리 변수를 없앤다. 기본 배치에서는 광역·근접 능력이 보스에
           닿지 않아 «능력이 안 걸린 것»과 «빗나간 것»이 구분되지 않는다 —
           모루가 그렇게 0으로 보였다. 여기서 재려는 것은 조준이 아니라
           능력 자체이므로 보스 옆에 세운다. */
        g.x = boss.x + 60; g.y = boss.y + 70;
        const before = { hp: boss.hp, adds: adds.length, fieldFx: fieldFx.length, assists: assistShots.length };
        // 실제 경로로 깨운다 — 굴러간 것으로 만들고 정산을 부른다
        g.vx = 220; g.vy = -140; g.travel = 400;
        wakeUnit(g);
        g.awake = true;
        const settled = settleParty ? settleParty() : null;
        return {
          fx: g.fx, awake: Boolean(g.awake),
          bossDamage: before.hp - boss.hp,
          newFieldFx: fieldFx.length - before.fieldFx,
          queuedAssists: assistShots.length - before.assists,
          blade: g.bladeStrength || 0,
        };
      } catch (e) { return { err: String(e).slice(0, 70) }; }
    })()`);
    // 정산 대기 후 피해 재확인
    await delay(4200);
    const after = await evaluate(`({ hp: boss.hp, max: boss.maxHp })`);
    const dealt = after.max - after.hp;
    console.log(
      (h.name + " (" + h.fx + ")").padEnd(20),
      JSON.stringify({ ...r, totalDealt: dealt }),
    );
  }
  console.log("errors:", JSON.stringify(probe.errors.slice(0, 5)));
} finally {
  probe.close();
}
process.exit(0);
