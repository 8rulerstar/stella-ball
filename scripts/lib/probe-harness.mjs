/**
 * CDP 프로브 공용 하니스.
 *
 * probe-*.mjs 여덟 파일이 같은 ~100줄(브라우저 탐색, 포트 확보, serve 기동,
 * 크롬 기동, CDP 연결, evaluate/waitFor)을 각자 들고 있었고 이미 서로
 * 드리프트했다 — 새 프로브부터는 여기서 가져다 쓴다. 기존 프로브는 측정
 * 증거 도구라 동작 보존을 위해 점진 이관한다.
 *
 *   const probe = await launchProbe();
 *   try {
 *     await probe.waitFor("typeof setupBattle === 'function'");
 *     const v = await probe.evaluate("1 + 1");
 *   } finally {
 *     probe.close(); // 크롬·정적 서버·임시 프로필을 정리한다
 *   }
 */
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

function freePort() {
  return new Promise((res) => {
    const s = createServer();
    s.listen(0, "127.0.0.1", () => {
      const { port } = s.address();
      s.close(() => res(port));
    });
  });
}

export async function launchProbe({
  headless = false,
  windowSize = "1280,900",
  page = "prototypes/prism-breakers.html",
  profilePrefix = "stella-probe-",
} = {}) {
  /* 2026-08-21: 후보에 mac·리눅스를 넣었다. 앞서는 STELLA_BROWSER_PATH와
     윈도우 경로 둘뿐이라, 이 하니스를 쓰는 프로브는 mac에서 환경변수를
     세우지 않으면 무조건 죽었다 — 「새 프로브는 여기서 가져다 쓴다」는
     이 파일의 규약과 CROSS_PLATFORM.md가 어긋나 있던 자리다. */
  const browser = [
    process.env.STELLA_BROWSER_PATH,
    process.env.CHROME_PATH,
    ...(process.platform === "win32"
      ? [
          "C:/Program Files/Google/Chrome/Application/chrome.exe",
          "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
          "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
        ]
      : process.platform === "darwin"
        ? [
            "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
            "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
          ]
        : [
            "/usr/bin/google-chrome",
            "/usr/bin/chromium",
            "/usr/bin/chromium-browser",
          ]),
  ].find((p) => p && existsSync(p));
  if (!browser) throw new Error("set STELLA_BROWSER_PATH");

  /* 포트 둘을 각자 임시 소켓으로 받는다. 예전의 port+1은 예약된 적 없는
     번호라 다른 프로세스나 윈도우 예약 대역과 충돌할 수 있었다. close와
     실제 사용 사이의 레이스는 남지만, 연결 루프의 재시도가 흡수한다. */
  const port = await freePort();
  const debugPort = await freePort();
  const server = spawn(process.execPath, ["scripts/serve.mjs"], {
    cwd: root,
    env: { ...process.env, PORT: String(port) },
    stdio: "ignore",
  });
  let serverUp = false;
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(`http://127.0.0.1:${port}/`)).ok) {
        serverUp = true;
        break;
      }
    } catch {}
    await delay(120);
  }
  const chrome = spawn(
    browser,
    [
      `--remote-debugging-port=${debugPort}`,
      `--user-data-dir=${mkdtempSync(join(tmpdir(), profilePrefix))}`,
      ...(headless ? ["--headless=new"] : []),
      "--window-position=0,0",
      "--window-size=" + windowSize,
      "--disable-features=CalculateNativeWinOcclusion",
      "--disable-backgrounding-occluded-windows",
      "--disable-renderer-backgrounding",
      "--disable-background-timer-throttling",
      "--no-first-run",
      "--disable-background-networking",
      `http://127.0.0.1:${port}/${page}`,
    ],
    { stdio: "ignore" },
  );
  const close = () => {
    try {
      chrome.kill();
    } catch {}
    try {
      server.kill();
    } catch {}
  };
  if (!serverUp) {
    close();
    throw new Error("static server never answered on " + port);
  }

  let cdp,
    id = 0;
  const pending = new Map();
  try {
    for (let i = 0; i < 80 && !cdp; i++) {
      try {
        const list = await (
          await fetch(`http://127.0.0.1:${debugPort}/json/list`)
        ).json();
        const target = list.find(
          (t) => t.type === "page" && t.url.includes(page.split("/").pop()),
        );
        if (target) {
          cdp = new WebSocket(target.webSocketDebuggerUrl);
          cdp.addEventListener("message", (e) => {
            const m = JSON.parse(String(e.data));
            const p = pending.get(m.id);
            if (!p) return;
            pending.delete(m.id);
            m.error
              ? p.reject(new Error(m.error.message))
              : p.resolve(m.result);
          });
          await new Promise((r) =>
            cdp.addEventListener("open", r, { once: true }),
          );
          break;
        }
      } catch {}
      if (!cdp) await delay(150);
    }
    if (!cdp) throw new Error("no page target");
  } catch (error) {
    close();
    throw error;
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
      throw new Error(
        r.exceptionDetails.exception?.description ?? "eval failed",
      );
    return r.result?.value;
  };
  async function waitFor(expr, timeoutMs = 30000, label = expr) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      if (await evaluate(expr)) return;
      await delay(200);
    }
    throw new Error("timeout: " + label);
  }

  return { port, debugPort, send, evaluate, waitFor, close };
}
