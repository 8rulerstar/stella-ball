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
 * 한 번 돌린 결과는 «판정이 아니다»(2026-08-23 실측). 이 정책은 매 샷
 * 판에 남은 별빛 앞 셋을 찍으므로 조준 방향이 직전 샷이 남긴 것에 따라
 * 달라지고, 같은 판을 세 번 돌리면 7-7이 42%·77%·63%, 6-6이 100%·100%·8%
 * 로 갈렸다. 그래서 스테이지마다 여러 번 돌려 «최선»으로 가른다 —
 * 「바닥이 깰 수 있는가」는 존재 질문이라 한 번이라도 깨면 깰 수 있는
 * 것이고, 그 편이 회차 운에 휘둘리지 않는다. 반복 수는 --runs 로 바꾼다.
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
  const runsArg = process.argv.indexOf("--runs");
  const RUNS =
    runsArg >= 0 && Number(process.argv[runsArg + 1]) > 0
      ? Number(process.argv[runsArg + 1])
      : /* 3회로는 가장자리 판을 못 가른다 — 7-7 이 3회에서 「실패」, 6회에서
         「2/6 클리어」로 갈렸다(2026-08-23). 기본을 5로 둔다. */
        5;
  const ids = process.argv.includes("--stages")
    ? process.argv
        .slice(process.argv.indexOf("--stages") + 1)
        .filter((a) => /^\d-\d$/.test(a))
    : ["1-1", "2-1", "3-1", "4-1", "5-1", "6-1", "7-1", "7-7", "8-1"];
  for (const id of ids) {
    const attempts = [];
    for (let run = 0; run < RUNS; run++) {
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
        if (await evaluate(`battleComplete === true || battle.shots <= 0`))
          break;
      }
      const end = await evaluate(
        `({ hp: Math.max(0, boss.hp), max: boss.maxHp, complete: battleComplete, won: window.__won === true, shots: battle.shots })`,
      );
      attempts.push({ max: end.max, dealt: end.max - end.hp, won: end.won });
      await delay(200);
    }
    /* 최선으로 가른다 — 위 헤더 참고. 폭도 함께 찍어 「이 판이 얼마나
      회차 운을 타는가」가 숫자로 남게 한다. */
    const best = attempts.reduce((a, b) => (b.dealt > a.dealt ? b : a));
    const pcts = attempts.map((a) => Math.round((a.dealt * 100) / a.max));
    const wonCount = attempts.filter((a) => a.won).length;
    const cleared = wonCount > 0;
    rows.push({
      id,
      hp: best.max,
      dealt: best.dealt,
      pct: Math.max(...pcts),
      cleared,
      clearRate: wonCount + "/" + RUNS,
      spread: pcts,
    });
    console.log(
      id.padEnd(4),
      "체력",
      String(best.max).padStart(4),
      "· 최선 피해",
      String(best.dealt).padStart(4),
      "(" + Math.max(...pcts) + "%)",
      cleared ? "· 클리어" : "· 실패",
      "· " + wonCount + "/" + RUNS + "회 " + pcts.map((p) => p + "%").join("/"),
    );
  }
} finally {
  probe.close();
}
process.exit(0);
