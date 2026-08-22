/**
 * 죽은 CSS 애니메이션 프로브 (2026-08-23).
 *
 * 「돌고는 있지만 화면을 아무것도 바꾸지 않는」 애니메이션을 찾는다.
 * 이 저장소에서 실제로 한 건 나왔다 — 타이틀 CTA의 igCtaGlow 는 픽셀 버튼
 * 킷의 `box-shadow: none !important` 에 눌려(CSS 캐스케이드: !important 저자
 * 선언 > 애니메이션) 그림은 하나도 안 바꾸면서 4초 창 스타일 재계산을
 * 165.6ms → 68.6ms 만큼 물고 있었다.
 *
 * 재는 법 — 시간을 기다리지 않고 «위상을 직접 지정»한다. 애니메이션을 멈추고
 * currentTime 을 다섯 지점에 세워 계산값을 읽어, 다섯이 전부 같으면 죽은
 * 것이다. 읽고 나면 원래 상태로 되돌린다.
 *
 * 이 프로브가 틀리는 법 — 넷 다 실제로 겪었고, 그래서 지금 코드가 이렇다:
 *   1. 시간을 흘려보내며 표본하면 주기가 긴 것(하늘 드리프트 420초)이 전부
 *      「죽음」으로 나온다. 위상을 지정해야 한다.
 *   2. currentTime 은 «지연부터» 센다. 지속시간으로만 위상을 잡으면 지연이 긴
 *      애니메이션은 표본이 전부 지연 구간에 떨어져 fill 이전 값 하나만 읽힌다.
 *   3. 의사 요소(::before/::after) 애니메이션은 effect.target 이 원본 요소다.
 *      getComputedStyle 에 의사 인자를 안 넘기면 엉뚱한 값을 읽는다.
 *   4. 타이틀은 외부 관측자 인트로가 «다시 무장»할 수 있는데, body.oo-intro 의
 *      `opacity: 0 !important` 가 모든 ig-* 를 이겨 전부 죽은 것으로 보인다.
 *      표본 직전에 다시 확인하고, 진행 중이면 판정을 무효로 표시한다.
 *
 * 2026-08-23 기준선: 세 화면(타이틀 40 · 허브 9 · 소환 10) 전부 죽음 0.
 *
 *   node scripts/probe-dead-anim.mjs
 */
import { setTimeout as delay } from "node:timers/promises";
import { launchProbe } from "./lib/probe-harness.mjs";
const probe = await launchProbe({
  headless: true,
  profilePrefix: "deadanim2-",
});
try {
  const { evaluate, waitFor } = probe;
  await waitFor(
    "typeof setupBattle === 'function' && typeof combatSfx === 'function'",
    20000,
    "runtime",
  );
  await waitFor(`Boolean(document.querySelector(".ig-cta"))`, 25000, "타이틀");
  await waitFor(
    `!document.body.classList.contains("oo-intro")`,
    40000,
    "인트로 종료",
  );
  await delay(2000);

  const PROBE = `(() => {
    const rows = [];
    const delayOf = (t) => (typeof t.delay === "number" ? t.delay : 0);
    let idx = 0;
    for (const a of document.getAnimations()) {
      const t = a.effect?.target;
      if (!a.animationName || !t || !t.style) continue;
      const timing = a.effect.getTiming();
      const dur = typeof timing.duration === "number" ? timing.duration : 0;
      if (!(dur > 0)) continue;
      const props = new Set();
      for (const kf of a.effect.getKeyframes())
        for (const k of Object.keys(kf))
          if (!["offset","computedOffset","easing","composite"].includes(k)) props.add(k);
      if (!props.size) continue;
      const list = [...props];
      const wasPaused = a.playState === "paused";
      const saved = a.currentTime;
      /* 의사 요소 애니메이션(::before/::after)은 effect.target 이 «원본»
         요소다. getComputedStyle 에 의사 인자를 넘기지 않으면 엉뚱한
         요소의 값을 읽어 「죽었다」로 오검출한다 — gachaSweep 이 그렇게
         잡혔다. */
      const pseudo = a.effect.pseudoElement || null;
      const read = (ct) => {
        a.currentTime = ct;
        const cs = getComputedStyle(t, pseudo);
        return list.map((p) => cs[p]).join(" | ");
      };
      a.pause();
      /* currentTime 은 «지연부터» 센다. 지속시간만으로 위상을 잡으면 지연이
         긴 애니메이션은 표본이 전부 지연 구간에 떨어져 fill 이전 값 하나만
         읽힌다 — igFade(지연 있음)가 그렇게 「죽음」으로 오검출됐다.
         끝점(1.0)도 반드시 넣는다: to 한 칸짜리 키프레임은 앞부분이
         평평해 중간 표본만으로는 변화가 안 보인다. */
      const d0 = delayOf(timing);
      const vals = [0, 0.25, 0.5, 0.75, 1].map((k) => read(d0 + dur * k));
      a.currentTime = saved;
      if (!wasPaused) a.play();
      rows.push({
        name: a.animationName,
        props: list.join(","),
        dur: Math.round(dur),
        tag: (a.effect.pseudoElement || "") + t.tagName.toLowerCase() + (typeof t.className === "string" && t.className ? "." + t.className.trim().split(/\s+/)[0] : ""),
        distinct: new Set(vals).size,
        sample: vals[0].slice(0, 46),
      });
      idx++;
    }
    return rows;
  })()`;

  let dead = 0;
  for (const [label, arm] of [
    ["타이틀", ""],
    ["허브", "showMeta?.()"],
    ["소환", "showGacha?.()"],
  ]) {
    if (arm) {
      await evaluate(arm + ", 1");
      await delay(1400);
    }
    /* 인트로가 «다시 무장»할 수 있다. body.oo-intro 가 붙어 있으면 그 규칙의
       opacity:0 !important 가 모든 ig-* 애니메이션을 이겨서 전부 죽은 것으로
       보인다 — 이 저장소에서 두 번 걸린 함정이다. 표본 직전에 다시 본다. */
    const intro = await evaluate(
      `document.body.classList.contains("oo-intro")`,
    );
    if (intro) {
      await evaluate(
        `(async () => { for (let i = 0; i < 60 && document.body.classList.contains("oo-intro"); i++) await new Promise(r => setTimeout(r, 250)); return 1; })()`,
      );
    }
    const guard = await evaluate(
      `document.body.classList.contains("oo-intro")`,
    );
    const rows = await evaluate(PROBE);
    const infinite = rows.filter((r) => r.dur >= 400);
    console.log(
      `\n[${label}] 애니메이션 ${rows.length}종 (주기 0.4s 이상 ${infinite.length}종)`,
    );
    for (const r of rows.sort((a, b) => a.distinct - b.distinct)) {
      const dead = r.distinct <= 1;
      console.log(
        `  ${dead ? "죽음" : "산다"}  ${r.name.padEnd(16)} ${r.tag.padEnd(22)} ${r.props.padEnd(22)} 위상5개중 서로다른값 ${r.distinct}` +
          (dead ? "   ← " + r.sample : ""),
      );
    }
    if (rows.some((r) => r.distinct <= 1) && !guard)
      dead += rows.filter((r) => r.distinct <= 1).length;
  }
  console.log(
    dead === 0
      ? String.fromCharCode(10) +
          "판정: 죽은 애니메이션 없음 — 도는 것은 전부 화면을 바꾼다."
      : String.fromCharCode(10) +
          "판정: 화면을 바꾸지 않는 애니메이션 " +
          dead +
          "종 (위 «죽음» 줄)",
  );
  process.exitCode = dead === 0 ? 0 : 1;
} finally {
  await probe.close();
}
