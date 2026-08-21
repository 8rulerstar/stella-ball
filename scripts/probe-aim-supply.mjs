/**
 * 별빛 공급 프로브 (2026-08-21).
 *
 * 무게중심 조준은 고른 노드들의 «가운데»로 간다 — 별지기 셋을 고르면 그
 * 가운데는 셋 «사이»의 빈 곳이다. 접촉이 없으면 자동 공명도 없고 별빛도
 * 안 남아, 다음 샷의 조준 메뉴가 다시 별지기 셋 하나로 좁아진다.
 * 그 «자기 재료를 갉아먹는 고리»가 실제로 도는지 잰다.
 *
 * 정책은 일부러 최악을 쓴다 — 항상 별지기 셋만 찍는다. 별빛 0인 판에서
 * 유일하게 가능한 조합이고, 1-1 수업이 가르치는 손이다. 실제 플레이어는
 * 별빛을 섞어 찍으므로 이 값은 상한이 아니라 «그 손의 값»이다.
 *
 * 근거와 결정 요청은 AIM_SUPPLY_REQUEST_2026_08_21.md에 있다.
 *
 *   node scripts/probe-aim-supply.mjs
 */
import { setTimeout as delay } from "node:timers/promises";
import { launchProbe } from "./lib/probe-harness.mjs";
const probe = await launchProbe({
  headless: true,
  windowSize: "1200,900",
  profilePrefix: "supply-",
});
const rows = [];
try {
  const { evaluate, waitFor } = probe;
  await waitFor("typeof setupBattle === 'function'", 20000, "runtime");
  for (const stage of ["1-2", "2-2", "3-2", "5-2"]) {
    const ok = await evaluate(`(() => {
      const i = stages.findIndex(s=>s.id===${JSON.stringify(stage)});
      if (i<0) return false;
      stageIndex = i; deployed=["gaon","biyeon","ria"]; selected=[...deployed];
      resetBuild(); setupBattle(); boss.hp = boss.maxHp = 999999; settings.sfx=0;
      // 입장 연출을 건너뛴다(측정만 한다)
      if (typeof skipBattleIntro === "function") skipBattleIntro();
      return true;
    })()`);
    if (!ok) continue;
    await delay(600);
    for (let shot = 0; shot < 8; shot++) {
      const before = await evaluate(
        "({ stars: aimStars.length, nodes: aimNodes().length })",
      );
      // 정책: 별지기 셋을 찍는다(수업이 가르치는 그 손, 별빛 없으면 유일 조합)
      const fired = await evaluate(`(() => {
        if (!aimStarReady()) return false;
        aimPick = [0,1,2];
        return launchAimStarShot();
      })()`);
      if (!fired) break;
      await waitFor("ball.moving", 8000, "fire").catch(() => {});
      const touched = await evaluate(`new Promise((res) => {
        let hit = 0;
        const off = registerRuntimeHook("afterParryContact", () => { hit++; });
        const t0 = Date.now();
        const poll = () => {
          if (!ball.moving || Date.now() - t0 > 30000) { off(); res(hit); }
          else setTimeout(poll, 100);
        };
        poll();
      })`);
      await delay(500);
      const after = await evaluate(
        "({ stars: aimStars.length, shots: battle.shots })",
      );
      rows.push({
        stage,
        shot: shot + 1,
        nodesBefore: before.nodes,
        starsBefore: before.stars,
        contacts: touched,
        starsAfter: after.stars,
      });
      if (after.shots <= 0) break;
    }
  }
} finally {
  probe.close();
}
const noContact = rows.filter((r) => r.contacts === 0).length;
const starved = rows.filter((r) => r.starsAfter === 0).length;
console.log(
  JSON.stringify(
    {
      shots: rows.length,
      noContactShots: noContact,
      noContactPct: rows.length
        ? Math.round((noContact * 100) / rows.length)
        : null,
      zeroStarBoards: starved,
      medianStarsAfter:
        rows.map((r) => r.starsAfter).sort((a, b) => a - b)[
          Math.floor(rows.length / 2)
        ] ?? null,
      rows,
    },
    null,
    1,
  ),
);
process.exit(0);
