import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { sweepPlainArena } from "./runtime-harness.mjs";

const report = sweepPlainArena();
const cleared = report.filter((entry) => entry.cleared);
const failures = report.filter((entry) => !entry.cleared);
// 정책을 뭉쳐 평균 내면 별자리를 쓰는 판과 못 쓰는 판이 섞여 아무 뜻도
// 없는 숫자가 된다. 정책별로 따로 낸다.
const byPolicy = {};
for (const entry of report) {
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
const summary = {
  generatedAt: new Date().toISOString(),
  model: "runtime-harness-v1",
  scenario:
    "plain arena / no gimmicks / 5 shots / manual steer excluded / " +
    "three aim policies: direct and contact never reach the 3 parry nodes " +
    "a constellation needs, chain aims to graze several starkeepers and " +
    "does. Read clearRate per policy, never pooled.",
  cases: report.length,
  byPolicy,
  clearRate: Number(((cleared.length / report.length) * 100).toFixed(1)),
  averageRemainingHp: Number(
    (
      report.reduce((sum, entry) => sum + entry.remainingHp, 0) / report.length
    ).toFixed(1),
  ),
  averageParries: Number(
    (
      report.reduce((sum, entry) => sum + entry.parries, 0) / report.length
    ).toFixed(1),
  ),
  failedCases: failures.slice(0, 16).map((entry) => ({
    partySize: entry.partySize,
    bossHp: entry.bossHp,
    policy: entry.policy,
    seed: entry.seed,
    remainingHp: entry.remainingHp,
  })),
};
const output = JSON.stringify({ summary, report }, null, 2) + "\n";
writeFileSync(
  fileURLToPath(new URL("./latest-report.json", import.meta.url)),
  output,
);
console.log(output);
