/**
 * 창 크기에 따라 «무엇이» 커지는지 센다.
 *
 * 프레임 시간은 기계 부하에 흔들리지만 이 값들은 흔들리지 않는다. 별 캔버스는
 * `starCanvas.width = clientWidth || innerWidth`(stella-ball-dawn.js)라 창을
 * 그대로 따라가고, 여백 하늘도 innerWidth로 배치된다. 캔버스 백버퍼(720x900)는
 * 고정이므로 그리기 호출 수는 그대로지만, 합성해야 할 «면적»은 창을 따라간다.
 *
 *   node scripts/probe-window-scale.mjs
 */
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DROP = process.argv.includes("--no-group-opacity");
const browser = [
  process.env.STELLA_BROWSER_PATH,
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
].find((p) => p && existsSync(p));
if (!browser) throw new Error("set STELLA_BROWSER_PATH");

const port = await new Promise((res) => {
  const s = createServer();
  s.listen(0, "127.0.0.1", () => {
    const { port } = s.address();
    s.close(() => res(port));
  });
});
const server = spawn(process.execPath, ["scripts/serve.mjs"], {
  cwd: root,
  env: { ...process.env, PORT: String(port) },
  stdio: "ignore",
});
for (let i = 0; i < 60; i++) {
  try {
    if ((await fetch(`http://127.0.0.1:${port}/`)).ok) break;
  } catch {}
  await delay(120);
}

async function sample(w, h, dropOpacity) {
  const dir = mkdtempSync(join(tmpdir(), "winscale-"));
  const dbg = port + 1 + Math.floor(Math.random() * 0);
  const chrome = spawn(
    browser,
    [
      "--headless=new",
      `--remote-debugging-port=${dbg}`,
      `--user-data-dir=${dir}`,
      `--window-size=${w},${h}`,
      "--hide-scrollbars",
      "--no-first-run",
      "--disable-background-networking",
      `http://127.0.0.1:${port}/prototypes/prism-breakers.html`,
    ],
    { stdio: "ignore" },
  );
  let cdp,
    id = 0;
  const pending = new Map();
  for (let i = 0; i < 80 && !cdp; i++) {
    try {
      const list = await (
        await fetch(`http://127.0.0.1:${dbg}/json/list`)
      ).json();
      const t = list.find(
        (e) => e.type === "page" && e.url.includes("prism-breakers"),
      );
      if (t) {
        cdp = new WebSocket(t.webSocketDebuggerUrl);
        cdp.addEventListener("message", (e) => {
          const m = JSON.parse(String(e.data));
          const p = pending.get(m.id);
          if (!p) return;
          pending.delete(m.id);
          m.error ? p.reject(new Error(m.error.message)) : p.resolve(m.result);
        });
        await new Promise((r) =>
          cdp.addEventListener("open", r, { once: true }),
        );
      }
    } catch {}
    if (!cdp) await delay(150);
  }
  const send = (method, params = {}) =>
    new Promise((res, rej) => {
      const n = ++id;
      pending.set(n, { resolve: res, reject: rej });
      cdp.send(JSON.stringify({ id: n, method, params }));
    });
  await send("Runtime.enable");
  await send("LayerTree.enable");
  for (let i = 0; i < 60; i++) {
    const ready = await send("Runtime.evaluate", {
      expression: "document.readyState === 'complete'",
      returnByValue: true,
    });
    if (ready.result?.value) break;
    await delay(100);
  }
  await delay(1200);
  /* 인트로 중에 재면 안 된다. 관측자 레이어(oo2-dim 등)가 전체화면으로 여러 장
     깔려 있어 «전투 중 하늘»과 전혀 다른 그림이 나온다. 실제 판을 세우고 잰다. */
  await send("Runtime.evaluate", {
    expression: `(() => {
      try {
        stageIndex = stages.findIndex((s) => s.id === "2-2");
        deployed = ["gaon","biyeon","ria"]; selected = [...deployed];
        resetBuild(); setupBattle();
        document.querySelectorAll(".oo2, .cin, #introRoot").forEach((n) => n.remove());
        /* --no-group-opacity: 전체화면 레이어의 그룹 불투명도를 걷어 본다.
           걷었을 때 그 표면이 레이어 목록에서 사라지는지가, 색을 굽는 수술이
           값어치가 있는지를 가른다. 색이 달라지므로 측정 전용이다. */
        if (${dropOpacity ? "true" : "false"})
          document.querySelectorAll('[data-sky-layer]').forEach((n) => {
            n.style.opacity = "1";
          });
      } catch (e) {}
      return 1;
    })()`,
    returnByValue: true,
  });
  await delay(1500);

  /* 합성 레이어를 직접 센다. 「transform만 쓰니 안전하다」는 애니메이션도
     레이어가 크면 매 프레임 그만큼을 GPU가 섞는다 — 안전한 것과 싼 것은
     다르다. 넓이 순으로 큰 것부터 본다. */
  const layers = await new Promise((res) => {
    const seen = [];
    const h = (e) => {
      const m = JSON.parse(String(e.data));
      if (m.method === "LayerTree.layerTreeDidChange")
        seen.push(...(m.params.layers || []));
    };
    cdp.addEventListener("message", h);
    setTimeout(() => {
      cdp.removeEventListener("message", h);
      res(seen);
    }, 2500);
  });
  const uniq = [];
  for (const l of layers
    .map((l) => ({
      w: Math.round(l.width),
      h: Math.round(l.height),
      px: Math.round(l.width * l.height),
    }))
    .filter((l) => l.px > 50000)
    .sort((a, b) => b.px - a.px))
    if (!uniq.some((u) => u.w === l.w && u.h === l.h)) uniq.push(l);

  const r = await send("Runtime.evaluate", {
    expression: `(() => {
      const star = [...document.querySelectorAll("canvas")]
        .map((c) => ({ id: c.id || c.parentElement?.id || "", w: c.width, h: c.height }))
        .filter((c) => c.w * c.h > 4000);
      const px = star.reduce((sum, c) => sum + c.w * c.h, 0);
      return JSON.stringify({
        viewport: innerWidth + "x" + innerHeight,
        canvasPixels: px,
        animations: document.getAnimations().length,
        skyNodes: document.querySelectorAll('#dawn-sky *, #sky-ambience *').length,
        // 큰 레이어의 «정체». 회전한 요소는 경계상자가 정사각형에 가까워지므로
        // 레이어 목록만으로는 누구인지 알 수 없다. 실제 요소를 재서 짝짓는다.
        suspects: [...document.querySelectorAll('#dawn-sky > *, #sky-ambience > *, #sky-ambience *')]
          .map((e) => {
            const r = e.getBoundingClientRect();
            const cs = getComputedStyle(e);
            return { tag: e.tagName.toLowerCase(),
                     cls: (typeof e.className === "string" ? e.className : "").slice(0, 24),
                     w: Math.round(r.width), h: Math.round(r.height),
                     px: Math.round(r.width * r.height),
                     anim: cs.animationName === "none" ? "" : cs.animationName,
                     tf: cs.transform === "none" ? "" : "yes",
                     op: cs.opacity };
          })
          .filter((e) => e.px > 200000)
          .sort((a, b) => b.px - a.px)
          .slice(0, 8),
      });
    })()`,
    returnByValue: true,
  });
  cdp.close();
  chrome.kill();
  try {
    rmSync(dir, { recursive: true, force: true });
  } catch {}
  return {
    ...JSON.parse(r.result.value),
    layers: layers.length,
    bigLayers: uniq.slice(0, 8),
  };
}

try {
  for (const [w, h] of [
    [1280, 900],
    [1920, 1080],
    [2560, 1440],
  ]) {
    const s = await sample(w, h, DROP);
    console.log(
      `${String(w) + "x" + h}`.padEnd(11),
      "viewport",
      s.viewport.padEnd(10),
      "캔버스픽셀",
      String(s.canvasPixels).padStart(9),
      "애니",
      String(s.animations).padStart(3),
      "하늘노드",
      String(s.skyNodes).padStart(3),
      "| layers",
      s.layers,
      "| suspects",
      JSON.stringify(s.suspects),
    );
  }
} finally {
  server.kill();
}
