import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { sweepPlainArena } from "./runtime-harness.mjs";

const report = sweepPlainArena();
const cleared = report.filter((entry) => entry.cleared);
const failures = report.filter((entry) => !entry.cleared);
const summary = {
  generatedAt: new Date().toISOString(),
  model: "runtime-harness-v1",
  scenario: "plain arena / no gimmicks / 5 shots / manual steer excluded",
  cases: report.length,
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
