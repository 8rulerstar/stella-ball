import { STAGES, allParties, candidateAngles, simulateBattle } from './prism-sim.mjs';

const parties = allParties();
const report = [];
for (const stage of STAGES) {
  for (const party of parties) {
    let best = null;
    // Deterministic angle sweep: one candidate direction repeated for four shots.
    const probe = { ball: { x: 150, y: 422 }, tick: 0 };
    for (const angle of candidateAngles(probe, stage)) {
      const result = simulateBattle({ stage, party, angles: [angle, angle, angle, angle] });
      if (!best || result.remainingHp < best.remainingHp || (result.remainingHp === best.remainingHp && result.damage > best.damage)) best = { ...result, angle: Number(angle.toFixed(4)) };
    }
    report.push({ stage: stage.id, party, ...best });
  }
}
const cleared = report.filter(r => r.cleared);
const failures = report.filter(r => !r.cleared);
const summary = {
  generatedAt: new Date().toISOString(),
  model: 'headless-v1',
  cases: report.length,
  clearRate: Number((cleared.length / report.length * 100).toFixed(1)),
  averageRemainingHp: Number((report.reduce((sum, r) => sum + r.remainingHp, 0) / report.length).toFixed(1)),
  averageGateHits: Number((report.reduce((sum, r) => sum + r.gateHits, 0) / report.length).toFixed(1)),
  failedSeeds: failures.slice(0, 16).map(r => ({ stage: r.stage, party: r.party, remainingHp: r.remainingHp })),
};
console.log(JSON.stringify({ summary, report }, null, 2));
