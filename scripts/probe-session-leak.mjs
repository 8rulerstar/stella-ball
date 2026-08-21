/**
 * 세션 누적 프로브 — 「하다 보면 심해진다」를 잡는다.
 *
 * probe-settle-cost.mjs 는 한 샷만, 그것도 죽지 않는 보스로 잰다. 그래서 샷과
 * 전투를 거치며 «쌓이는» 것은 원리적으로 거기 나타나지 않는다. 여기서는 전투를
 * 여러 번 세우고 각 전투에서 여러 발을 굴리면서, 매 샷 뒤에 「자라면 안 되는
 * 값」을 전부 센다.
 *
 * 자라면 안 되는 값: JS 힙, DOM 노드 수, 도는 애니메이션 수, 이펙트 배열들,
 * 오디오 객체 수, 살아 있는 타이머 수, 런타임 훅 수.
 * 프레임 시간은 부하에 흔들리므로 여기서는 «개수»를 본다 — 개수는 안 흔들린다.
 *
 * 이름이 비슷한 probe-session-churn.mjs 와 재는 축이 다르다. 그쪽은 «화면을
 * 오간다»가 축이고 리스너 수와 강제 GC 뒤의 값까지 보지만 전투에 안 들어간다.
 * 여기는 반대로 전투 안만 본다. 누수를 의심하면 둘 다 돌려야 한다.
 *
 * 타이머 호출처가 함께 나오는데, 자기 자신을 다시 거는 «사슬»은 수가 커도
 * 누수가 아니다(하늘 소품이 그렇다). 재진입 가드 없이 같은 자리가 여러
 * 사슬을 시작하는 경우만 누수다.
 *
 *   node scripts/probe-session-leak.mjs
 *   node scripts/probe-session-leak.mjs --battles 5 --shots 6
 */
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const arg = (n, d) => {
  const i = process.argv.indexOf("--" + n);
  return i >= 0 ? process.argv[i + 1] : d;
};
const BATTLES = Number(arg("battles", 4));
const SHOTS = Number(arg("shots", 5));
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
const dir = mkdtempSync(join(tmpdir(), "leak-probe-"));
const dbg = port + 1;
const chrome = spawn(
  browser,
  [
    "--headless=new",
    `--remote-debugging-port=${dbg}`,
    `--user-data-dir=${dir}`,
    "--window-size=1600,1000",
    "--hide-scrollbars",
    "--no-first-run",
    "--js-flags=--expose-gc",
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
      await new Promise((r) => cdp.addEventListener("open", r, { once: true }));
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
const evaluate = async (expression) => {
  const r = await send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (r.exceptionDetails)
    throw new Error(r.exceptionDetails.exception?.description ?? "eval failed");
  return r.result?.value;
};

try {
  await send("Runtime.enable");
  await send("Performance.enable");
  for (let i = 0; i < 60; i++) {
    if (await evaluate("document.readyState === 'complete'")) break;
    await delay(100);
  }

  /* 타이머 누수를 세려면 만들어진 것과 지워진 것을 함께 알아야 한다.
     페이지가 살아 있는 동안 순증가만 보면 「도는 타이머 수」가 나온다. */
  await evaluate(`(() => {
    /* 「만든 수 - 지운 수」는 발화하고 끝난 setTimeout까지 살아 있는 것으로
       세어 버린다. 진짜로 남아 있는 것을 알려면 발화 시점도 잡아야 하고,
       setInterval은 지우기 전까지 영원히 도니 따로 세야 한다.
       그리고 개수보다 «누가 만드는가»가 고칠 거리다. */
    window.__t = { pendingTimeouts: new Set(), intervals: new Set(), by: {} };
    const where = () => {
      const lines = (new Error().stack || "").split(String.fromCharCode(10));
      const line = lines.find((l, i) => i > 2 && l.indexOf(".js") >= 0);
      return (line || "(unknown)").trim().slice(0, 88);
    };
    const st = window.setTimeout, si = window.setInterval,
          ct = window.clearTimeout, ci = window.clearInterval;
    window.setTimeout = function (fn, ms, ...rest) {
      const site = where();
      window.__t.by[site] = (window.__t.by[site] || 0) + 1;
      const wrapped = typeof fn === "function"
        ? function () { window.__t.pendingTimeouts.delete(handle); return fn.apply(this, arguments); }
        : fn;
      const handle = st.call(window, wrapped, ms, ...rest);
      window.__t.pendingTimeouts.add(handle);
      return handle;
    };
    window.setInterval = function (fn, ms, ...rest) {
      const site = where();
      window.__t.by["INTERVAL " + site] = (window.__t.by["INTERVAL " + site] || 0) + 1;
      const handle = si.call(window, fn, ms, ...rest);
      window.__t.intervals.add(handle);
      return handle;
    };
    window.clearTimeout = function (h) { window.__t.pendingTimeouts.delete(h); return ct.call(window, h); };
    window.clearInterval = function (h) { window.__t.intervals.delete(h); return ci.call(window, h); };
    return 1;
  })()`);

  const SAMPLE = `(() => {
    const len = (v) => (Array.isArray(v) ? v.length : v && v.size !== undefined ? v.size : -1);
    const g = (name) => { try { return eval(name); } catch { return undefined; } };
    return JSON.stringify({
      domNodes: document.getElementsByTagName("*").length,
      animations: document.getAnimations().length,
      pendingTimeouts: window.__t ? window.__t.pendingTimeouts.size : -1,
      liveIntervals: window.__t ? window.__t.intervals.size : -1,
      heapMB: performance.memory ? +(performance.memory.usedJSHeapSize / 1048576).toFixed(1) : null,
      fieldFx: len(g("fieldFx")),
      popups: len(g("popups")),
      areaBursts: len(g("areaBursts")),
      assistShots: len(g("assistShots")),
      abilityBursts: len(g("abilityBursts")),
      cloneBalls: len(g("cloneBalls")),
      finisherImpacts: len(g("finisherImpacts")),
      speechOnBoard: len(g("speechOnBoard")),
      speechQueue: len(g("speechQueue")),
      toastQueue: len(g("toastQueue")),
      sfxPools: len(g("sampleSfxPools")),
      audioEls: document.getElementsByTagName("audio").length,
      canvases: document.getElementsByTagName("canvas").length,
      figureNodes: (() => { try { return currentFigureShot().nodes.length; } catch { return -1; } })(),
      hooks: (() => { try {
        return Object.values(StellaRuntime.hooks ?? {}).reduce((n, a) => n + (a?.length || 0), 0);
      } catch { return -1; } })(),
    });
  })()`;

  const rows = [];
  /* 화면을 «오가는» 쪽도 돈다. 전투 루프만 돌면 이 저장소가 예전에 고쳤던
     자리(화면을 도중에 떠날 때의 생명주기 누수)를 한 번도 지나지 않는다.
     매 전투 앞뒤로 메타 화면을 훑는다. */
  const SCREENS = [
    "showStageSelect",
    "showGacha",
    "showShop",
    "showProfile",
    "showAchievements",
    "showSettings",
    "showLibrary",
  ];
  for (let b = 0; b < BATTLES; b++) {
    for (const fn of SCREENS) {
      await evaluate(
        `(() => { try { ${"$"}{fn}(); } catch (e) {} return 1; })()`.replace(
          "${fn}",
          fn,
        ),
      ).catch(() => {});
      await delay(180);
    }
    rows.push({
      battle: b + 1,
      shot: 0,
      phase: "screens",
      ...JSON.parse(await evaluate(SAMPLE)),
    });
    await evaluate(`(() => {
      const pool = ["gaon","biyeon","ria"];
      stageIndex = stages.findIndex((s) => s.id === "2-2");
      deployed = [...pool]; selected = [...pool];
      resetBuild(); setupBattle(); settings.sfx = 1;
      boss.maxHp = boss.hp = 999999; syncBossHealth();
      battle.shots = battle.shotMax = 99;
      return 1;
    })()`);
    for (let sh = 0; sh < SHOTS; sh++) {
      await evaluate(`(() => {
        const t = gates[0];
        const dx = t.x - ball.x, dy = t.y - ball.y, l = Math.hypot(dx, dy) || 1;
        ball.vx = dx / l * 1500; ball.vy = dy / l * 1500; ball.moving = true;
        ball.steerUsed = false; ball.firstImpact = null;
        ball.starkeeperTouched = false; ball.openingBossContact = false;
        battle.shots -= 1; chain = [];
        for (const g of gates) {
          const a = Math.atan2(boss.y - g.y, boss.x - g.x) + 0.6;
          g.vx = Math.cos(a) * 850; g.vy = Math.sin(a) * 850;
        }
        return 1;
      })()`);
      // 유성이 멈추고 정산이 끝날 때까지
      for (let i = 0; i < 90; i++) {
        const done = await evaluate(
          "!(ball && ball.moving) && !assistShots.length",
        );
        if (done) break;
        await delay(120);
      }
      await delay(400);
      rows.push({
        battle: b + 1,
        shot: sh + 1,
        ...JSON.parse(await evaluate(SAMPLE)),
      });
    }
  }
  const by = JSON.parse(
    await evaluate(
      "JSON.stringify(Object.fromEntries(Object.entries((window.__t||{by:{}}).by).sort((a,b)=>b[1]-a[1]).slice(0,10)))",
    ),
  );
  console.log(JSON.stringify({ rows, timerSites: by }));
} finally {
  cdp?.close?.();
  chrome.kill();
  server.kill();
  try {
    rmSync(dir, { recursive: true, force: true });
  } catch {}
}
