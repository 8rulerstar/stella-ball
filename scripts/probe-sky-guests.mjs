/**
 * Sky-guest placement probe.
 *
 * The in-app Browser pane can report a 0x0 viewport when it is not displayed,
 * which makes every geometry check read zero - `main`, `.stage` and the sky
 * layers all measure empty and a placement bug is indistinguishable from a
 * pane that simply is not laid out. This drives a real headless Chromium, which
 * always has a viewport, and asks the sky module to fire each guest on demand
 * through SkyAmbience.guest().
 *
 *   node scripts/probe-sky-guests.mjs
 */
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
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
// serve.mjs takes its port from PORT, not from argv - passing it as an argument
// leaves the server on its default while the browser goes to an empty port, and
// the page comes up blank in a way that looks exactly like a broken build.
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
const profile = mkdtempSync(join(tmpdir(), "sky-probe-"));
const debugPort = port + 1;
const chrome = spawn(browser, [
  "--headless=new",
  `--remote-debugging-port=${debugPort}`,
  `--user-data-dir=${profile}`,
  "--window-size=1440,900",
  "--no-first-run",
  "--disable-background-networking",
  `http://127.0.0.1:${port}/prototypes/prism-breakers.html`,
], { stdio: "ignore" });

let cdp, id = 0;
const pending = new Map();
async function connect() {
  for (let i = 0; i < 80; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json();
      const target = list.find((t) => t.type === "page" && t.url.includes("prism-breakers"));
      if (target) {
        cdp = new WebSocket(target.webSocketDebuggerUrl);
        cdp.addEventListener("message", (e) => {
          const m = JSON.parse(String(e.data));
          const p = pending.get(m.id);
          if (!p) return;
          pending.delete(m.id);
          m.error ? p.reject(new Error(m.error.message)) : p.resolve(m.result);
        });
        await new Promise((r) => cdp.addEventListener("open", r, { once: true }));
        return;
      }
    } catch {}
    await delay(150);
  }
  throw new Error("no page target");
}
const send = (method, params = {}) =>
  new Promise((res, rej) => {
    const n = ++id;
    pending.set(n, { resolve: res, reject: rej });
    cdp.send(JSON.stringify({ id: n, method, params }));
  });
const evaluate = async (expression) => {
  const r = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? "eval failed");
  return r.result?.value;
};

try {
  await connect();
  await send("Runtime.enable");
  for (let i = 0; i < 60; i++) {
    if (await evaluate("document.readyState === 'complete'")) break;
    await delay(100);
  }
  const report = await evaluate(`(async () => {
    document.querySelector('#titleHelp')?.click();
    document.querySelector('#onboardingContinue')?.click();
    await new Promise(r => setTimeout(r, 400));
    const mainEl = document.querySelector('main');
    if (!mainEl)
      return { error: 'no <main>', bodyClass: document.body.className,
        topLevel: [...document.body.children].map(n => n.tagName + '.' + (n.className || '')).slice(0, 12) };
    const main = mainEl.getBoundingClientRect();
    const out = {
      viewport: innerWidth + 'x' + innerHeight,
      board: { left: Math.round(main.left), right: Math.round(main.right) },
      margins: [Math.round(main.left), Math.round(innerWidth - main.right)],
      guests: {},
    };
    for (const which of ['rocket', 'ufo', 'alien']) {
      SkyAmbience.guest(which);
      await new Promise(r => setTimeout(r, 350));
      const imgs = [...document.querySelectorAll('[data-sky-layer="L1"] img')];
      const last = imgs[imgs.length - 1];
      const b = last && last.getBoundingClientRect();
      out.guests[which] = last
        ? { w: Math.round(b.width), h: Math.round(b.height),
            left: Math.round(b.left), right: Math.round(b.right),
            insideMargin: b.right <= main.left + 1 || b.left >= main.right - 1,
            loaded: last.complete && last.naturalWidth > 0 }
        : { missing: true };
      await new Promise(r => setTimeout(r, 250));
    }
    return out;
  })()`);
  console.log(JSON.stringify(report, null, 2));
} finally {
  cdp?.close();
  chrome.kill();
  server.kill();
  try { rmSync(profile, { recursive: true, force: true }); } catch {}
}
