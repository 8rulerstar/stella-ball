/**
 * 전용 하늘 오버레이가 로드되고 두 수동 QA 반응에서 실제로 보이는지 확인한다.
 * 캡처는 반응 직후에 해야 한다. figure는 1.1초 뒤부터 사라진다.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { setTimeout as delay } from "node:timers/promises";
import { launchProbe } from "./lib/probe-harness.mjs";

const OUT = "artifacts/sky-reactions";
mkdirSync(OUT, { recursive: true });
const probe = await launchProbe({ headless: true, windowSize: "1280,900" });
const { evaluate, waitFor, send, close, errors } = probe;

async function capture(name, trigger) {
  await evaluate(trigger);
  await delay(320);
  const state = JSON.parse(
    await evaluate(`(() => {
      const image = document.querySelector('#sky-ambience img[src*="constellation-reaction"]');
      return JSON.stringify({
        complete: Boolean(image?.complete),
        width: image?.naturalWidth || 0,
        height: image?.naturalHeight || 0,
        opacity: Number(getComputedStyle(image).opacity || 0),
      });
    })()`),
  );
  const { data } = await send("Page.captureScreenshot", { format: "png" });
  writeFileSync(`${OUT}/${name}.png`, Buffer.from(data, "base64"));
  if (!state.complete || state.width !== 768 || state.height !== 512)
    throw new Error("sky asset did not load: " + JSON.stringify(state));
  if (state.opacity < (name === "boss" ? 0.2 : 0.3))
    throw new Error("sky reaction stayed hidden: " + JSON.stringify(state));
  return state;
}

try {
  await waitFor(
    "window.SkyAmbience && document.querySelector('#sky-ambience img')",
  );
  await evaluate("window.StellaIntroObserver?.stop(), showMeta(), 1");
  await delay(500);
  const figure = await capture("figure", "SkyAmbience.figure(), 1");
  const boss = await capture("boss", "SkyAmbience.boss(), 1");
  if (errors.length) throw new Error(errors.join(" | "));
  console.log(JSON.stringify({ result: "passed", figure, boss }, null, 2));
  console.log(`screenshots -> ${OUT}/`);
} finally {
  close();
}
