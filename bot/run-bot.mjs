import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  AIM_LADDER,
  sweepCampaign,
  sweepPlainArena,
} from "./runtime-harness.mjs";

/* 두 스윕을 함께 낸다.

   `plain`은 무기믹 회귀 기준선이다. 전투 규칙이 바뀌었는지 보는 데는 여전히
   쓸모가 있지만, 2026-08-15 지원 사격 전달 수정 이후 contact 91.7% / chain
   100%로 포화돼 **난이도 신호로는 쓸 수 없다.**

   `campaign`이 현재 난이도 계기다. 35개 실제 스테이지를 진짜 체력·배치·기믹
   그대로 돌리고, 시드 대신 조준 오차(라디안 시그마)를 축으로 쓴다. 시드는
   런타임에서 크리티컬 확률에만 닿아 변량을 거의 만들지 못했고, 조준 오차는
   시드마다 다른 손떨림이 되어 클리어율을 실제 곡선으로 만든다. */

const clearRate = (rows) =>
  rows.length
    ? Number(
        ((rows.filter((r) => r.cleared).length / rows.length) * 100).toFixed(1),
      )
    : 0;
const mean = (rows, key) =>
  rows.length
    ? Number((rows.reduce((s, r) => s + r[key], 0) / rows.length).toFixed(1))
    : 0;

const plain = sweepPlainArena();
const byPolicy = {};
for (const entry of plain) {
  const slot = (byPolicy[entry.policy] ??= {
    cases: 0,
    cleared: 0,
    constellations: 0,
  });
  slot.cases += 1;
  slot.cleared += entry.cleared ? 1 : 0;
  slot.constellations += entry.constellations;
}
for (const [name, slot] of Object.entries(byPolicy))
  byPolicy[name] = {
    ...slot,
    clearRate: Number(((slot.cleared / slot.cases) * 100).toFixed(1)),
  };

const campaign = sweepCampaign({ seeds: [11, 23, 47, 83, 101, 137] });
const aims = Object.keys(AIM_LADDER);
const policies = [...new Set(campaign.map((r) => r.policy))];

/* 조준 정확도 × 정책. 이 표의 단조성을 계기의 건강 신호로 쓰지 않는다 —
   0-7절에서 시드를 16개로 올리자 단조가 깨졌고, 원래의 매끄러운 곡선은 시드
   2~6개짜리 표본의 착시였다. */
const byAim = {};
for (const policy of policies) {
  byAim[policy] = {};
  for (const aim of aims) {
    const rows = campaign.filter((r) => r.policy === policy && r.aim === aim);
    /* aimSigma가 0이면 뽑은 난수에 0이 곱해져 사라지므로 시드가 아무것도
       바꾸지 못한다 — 6개 시드가 같은 한 줄을 재생한다. cases를 그대로 표본
       수로 읽으면 신뢰구간이 6배 좁아 보인다. 서로 다른 판이 실제로 몇 개인지
       같이 낸다. (0-3절에 사실이, 0-7절에 그 영향이 적혀 있다) */
    const distinctRuns =
      AIM_LADDER[aim] === 0
        ? new Set(rows.map((r) => r.campaignIndex + "/" + r.partySize)).size
        : rows.length;
    byAim[policy][aim] = {
      sigmaRad: AIM_LADDER[aim],
      cases: rows.length,
      distinctRuns,
      clearRate: clearRate(rows),
      averageShots: mean(rows, "shotsUsed"),
      constellations: rows.reduce((s, r) => s + r.constellations, 0),
    };
  }
}

// 스테이지별 곡선. 어느 정확도에서 무너지는지가 스테이지 난이도다.
const byStage = [];
for (let i = 0; i < 35; i++) {
  const rows = campaign.filter((r) => r.campaignIndex === i);
  if (!rows.length) continue;
  const curve = {};
  for (const policy of policies)
    curve[policy] = aims.map((aim) =>
      clearRate(rows.filter((r) => r.policy === policy && r.aim === aim)),
    );
  byStage.push({
    campaignIndex: i,
    stageId: rows[0].stageId ?? null,
    bossHp: rows[0].bossHp ?? null,
    partySize: rows[0].partySize,
    clearRate: clearRate(rows),
    averageShots: mean(rows, "shotsUsed"),
    curveByAim: curve,
  });
}

const summary = {
  generatedAt: new Date().toISOString(),
  model: "runtime-harness-v2",
  instrument:
    "campaign is the difficulty instrument; plain is a saturated regression " +
    "baseline. Read campaign.byAim per policy across the aim ladder - a " +
    "monotonic fall is a live signal, a flat row means the sweep cannot " +
    "distinguish that policy any more. Never pool policies. Two caveats: " +
    "the precise rung has sigma 0, so every seed replays one identical line " +
    "and it is a single deterministic probe (does any line work at all?), " +
    "not a six-sample rate; and the contact policy is non-monotonic across " +
    "the ladder because a wider error can graze more starkeepers than a " +
    "clean line does, so read chain for the difficulty curve.",
  plain: {
    scenario:
      "plain arena / no gimmicks / 5 shots / fixed spread / three aim policies",
    cases: plain.length,
    byPolicy,
    clearRate: clearRate(plain),
    averageRemainingHp: mean(plain, "remainingHp"),
    averageParries: mean(plain, "parries"),
    saturated:
      byPolicy.contact?.clearRate >= 85 && byPolicy.chain?.clearRate >= 95,
  },
  campaign: {
    scenario:
      "all 35 real campaign stages with their own boss health, layout and " +
      "gimmicks / 5 shots / aim error drawn per shot from the seeded RNG",
    aimLadderRad: AIM_LADDER,
    cases: campaign.length,
    seeds: 6,
    clearRate: clearRate(campaign),
    byAim,
    hardestStages: [...byStage]
      .sort((a, b) => a.clearRate - b.clearRate)
      .slice(0, 8)
      .map((s) => ({ campaignIndex: s.campaignIndex, clearRate: s.clearRate })),
    trivialStages: byStage
      .filter((s) => s.clearRate === 100)
      .map((s) => s.campaignIndex),
    byStage,
  },
};
const output = JSON.stringify({ summary, plain, campaign }, null, 2) + "\n";
writeFileSync(
  fileURLToPath(new URL("./latest-report.json", import.meta.url)),
  output,
);
console.log(JSON.stringify(summary, null, 2));
