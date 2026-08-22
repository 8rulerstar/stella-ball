/**
 * 어떤 소리가 «실제로» 나는가, 그리고 서로 다른가.
 *
 * 소리는 스크린샷에 안 찍힌다. combatSfx 를 통과시키면서 이름과 세기를
 * 기록하고, 음색 표에 그 이름이 «있는지»까지 함께 본다 — 표에 없으면
 * 소리는 나지만 전부 같은 기본음이라, 「울렸다」와 「구별된다」는 다른 말이다.
 *
 * 이 프로브가 틀리는 법:
 * 1. 원본을 안 부르면 소리가 사라진다. 반드시 통과시킨다.
 * 2. settings.sfx 가 0이면 combatSfx 가 첫 줄에서 되돌아간다. 켜 둔다.
 * 3. 관측자 인트로가 켜져 있으면 판이 안 돈다.
 *
 *   node scripts/probe-sound.mjs
 */
import { setTimeout as delay } from "node:timers/promises";
import { launchProbe } from "./lib/probe-harness.mjs";

const probe = await launchProbe({ windowSize: "1280,900" });
const { evaluate, waitFor, close, errors } = probe;

const TAP = `(() => {
  if (window.__sfxTapped) return "이미";
  window.__sfxTapped = 1;
  window.__sfx = [];
  const real = combatSfx;
  window.combatSfx = function (kind, strength, heroId) {
    window.__sfx.push({ kind, strength: Math.round((strength ?? 1) * 100) / 100 });
    return real.call(this, kind, strength, heroId); // 함정 1
  };
  return "설치";
})()`;

/* 표에 있는 이름인지 본다. 없으면 기본음 [260,420,0.08] 로 떨어진다.
   정규식을 템플릿 문자열 안에 쓰면 이스케이프가 두 겹이 되어 브라우저에
   깨진 채로 도착한다 — 실제로 그렇게 한 번 터졌다. 문자열 나누기로 푼다. */
const KNOWN = `(() => {
  const names = [];
  for (const line of String(combatSfx).split(String.fromCharCode(10))) {
    const t = line.trim();
    const at = t.indexOf(": [");
    if (at > 0 && !t.startsWith("//") && /^[a-zA-Z][a-zA-Z0-9]*$/.test(t.slice(0, at)) // figure4 처럼 숫자가 붙는다)
      names.push(t.slice(0, at));
  }
  return JSON.stringify(names);
})()`;

try {
  await waitFor("typeof combatSfx === 'function'", 30000);
  await evaluate("window.StellaIntroObserver?.stop(), 1"); // 함정 3
  await evaluate("settings.sfx = 1, progress.clears = 30, saveProgress(), 1"); // 함정 2
  /* 표를 «가로채기 전에» 읽어야 한다. combatSfx 를 감싸고 나면
     String(combatSfx) 가 내 래퍼를 돌려주므로 음색 표가 통째로 사라져,
     멀쩡한 이름 전부가 「표에없음」으로 찍힌다 — 실제로 그렇게 나왔다. */
  const known = JSON.parse(await evaluate(KNOWN));
  console.log("가로채기: " + (await evaluate(TAP)));
  console.log(`음색 표에 있는 이름 ${known.length}개`);

  for (const id of ["1-3", "2-2", "4-3", "5-4", "6-4"]) {
    await evaluate(`(() => {
      stageIndex = stages.findIndex((s) => s.id === ${JSON.stringify(id)});
      deployed = selected = Object.keys(heroes).slice(0, 3);
      resetBuild(); setupBattle(); window.__sfx = [];
      return 1;
    })()`);
    await waitFor("!battleCine", 12000).catch(() => {});
    await evaluate("window.StellaIntroObserver?.stop(), 1").catch(() => {});
    await delay(800);
    await evaluate("window.__sfx = [], 1");
    for (let shot = 0; shot < 3; shot += 1) {
      await evaluate(`(() => {
        const n = aimNodes();
        const u = n.map((x, i) => [x, i]).filter(([x]) => x.unit).slice(0, 3).map(([, i]) => i);
        if (u.length >= 3) { aimPick = u; launchAimStarShot(); }
        return 1;
      })()`).catch(() => {});
      await delay(2600);
    }
    const played = JSON.parse(
      await evaluate("JSON.stringify(window.__sfx || [])"),
    );
    const counts = {};
    for (const p of played) counts[p.kind] = (counts[p.kind] ?? 0) + 1;
    const rows = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    console.log(`\n══ ${id} — ${played.length}회 · ${rows.length}종`);
    console.log(
      "   " +
        rows
          .map(([k, n]) => `${k}×${n}${known.includes(k) ? "" : " ✗표에없음"}`)
          .join("  "),
    );
  }
  console.log(
    errors.length ? "\n콘솔 오류: " + errors.join(" | ") : "\n콘솔 오류 없음",
  );
} finally {
  close();
}
