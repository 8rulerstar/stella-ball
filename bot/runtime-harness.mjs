/**
 * Runtime balance harness for the current Stella Ball combat scripts.
 *
 * This is deliberately not another physics approximation. It loads the same
 * ordered classic-script combat runtime in a VM with inert DOM/canvas/audio
 * substitutes, then advances `update`, `updateSpecial`, and `updateFeedback`
 * at a fixed step. Rendering and browser timing remain outside its scope.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import vm from "node:vm";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const runtimeFiles = [
  "prototypes/js/game-platform.js",
  "prototypes/js/game-data.js",
  "prototypes/js/game-ui.js",
  "prototypes/js/game-session.js",
  "prototypes/js/game-core-physics.js",
  "prototypes/js/game-core-render.js",
  "prototypes/js/game-meta.js",
  "prototypes/js/game-combat.js",
  "prototypes/js/game-figure.js",
  "prototypes/js/game-feedback.js",
];

const slots = [
  [188, 594],
  [522, 564],
  [188, 352],
  [522, 382],
];
const plainArena = Object.freeze({
  id: "BOT-PLAIN",
  name: "하니스 · 무기믹 전장",
  terrain: "하니스 전용. 기믹 없이 유성, 별지기, 거상만 측정한다.",
  slots,
  preview: slots.map(([x, y]) => [Number((x / 7.2).toFixed(1)), y / 9]),
  // Do not put the colossus above the launch stone: that geometry creates a
  // ceiling ping-pong exploit and would measure the shortcut, not the party.
  boss: { x: 456, y: 282 },
  labels: ["좌하", "우하", "좌상", "우상"],
  bumpers: [],
  gimmicks: {},
});

function mulberry32(seed) {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function element() {
  const classes = new Set();
  return {
    style: {},
    dataset: {},
    className: "",
    textContent: "",
    innerHTML: "",
    disabled: false,
    children: [],
    classList: {
      add: (...names) => names.forEach((name) => classes.add(name)),
      remove: (...names) => names.forEach((name) => classes.delete(name)),
      contains: (name) => classes.has(name),
      toggle: (name, force) => {
        const on = force ?? !classes.has(name);
        if (on) classes.add(name);
        else classes.delete(name);
        return on;
      },
    },
    append(...children) {
      this.children.push(...children);
    },
    appendChild(child) {
      this.children.push(child);
      return child;
    },
    remove() {},
    replaceChildren(...children) {
      this.children = children;
    },
    addEventListener() {},
    removeEventListener() {},
    setAttribute() {},
    removeAttribute() {},
    querySelector: () => element(),
    querySelectorAll: () => [],
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 720, height: 900 }),
    focus() {},
  };
}

function createCanvas() {
  const canvas = element();
  canvas.width = 720;
  canvas.height = 900;
  const context = new Proxy(
    { canvas, imageSmoothingEnabled: false },
    {
      get(target, key) {
        if (key in target) return target[key];
        if (key === "measureText") return () => ({ width: 0 });
        if (key === "getImageData")
          return () => ({ data: new Uint8ClampedArray(4) });
        return () => {};
      },
    },
  );
  canvas.getContext = () => context;
  canvas.setPointerCapture = () => {};
  return canvas;
}

function createContext(seed) {
  const game = createCanvas();
  const nodes = new Map([["#game", game]]);
  const query = (selector) => {
    if (!nodes.has(selector)) nodes.set(selector, element());
    return nodes.get(selector);
  };
  class CanvasRenderingContext2D {}
  class Image {
    set src(value) {
      this._src = value;
    }
    get src() {
      return this._src;
    }
  }
  const random = mulberry32(seed);
  const sandbox = {
    console: { log() {}, warn() {}, error() {} },
    Math: Object.assign(Object.create(Math), { random }),
    Date,
    JSON,
    Map,
    Set,
    WeakMap,
    WeakSet,
    Array,
    Object,
    Number,
    String,
    Boolean,
    RegExp,
    Promise,
    Error,
    TypeError,
    Uint8ClampedArray,
    CanvasRenderingContext2D,
    Image,
    Audio: class {},
    AudioContext: class {},
    webkitAudioContext: class {},
    navigator: { vibrate() {} },
    performance: { now: () => sandbox.__botClock },
    localStorage: {
      getItem: () => null,
      setItem() {},
      removeItem() {},
    },
    document: {
      hidden: false,
      visibilityState: "visible",
      body: element(),
      fonts: { add() {}, ready: Promise.resolve() },
      querySelector: query,
      querySelectorAll: () => [],
      createElement: (tag) => (tag === "canvas" ? createCanvas() : element()),
      addEventListener() {},
    },
    addEventListener() {},
    removeEventListener() {},
    requestAnimationFrame: () => 0,
    cancelAnimationFrame() {},
    setTimeout: () => 0,
    clearTimeout() {},
    setInterval: () => 0,
    clearInterval() {},
    matchMedia: () => ({ matches: false, addEventListener() {} }),
    getComputedStyle: () => ({ getPropertyValue: () => "" }),
    URL: { createObjectURL: () => "", revokeObjectURL() {} },
    atob: (value) => Buffer.from(value, "base64").toString("binary"),
    btoa: (value) => Buffer.from(value, "binary").toString("base64"),
    __botClock: 0,
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  return vm.createContext(sandbox);
}

const harnessRuntime = `
function __botStart(config) {
  const stage = {
    ...config.arena,
    slots: config.arena.slots.slice(0, config.party.length),
    preview: config.arena.preview.slice(0, config.party.length),
    labels: config.arena.labels.slice(0, config.party.length),
  };
  stages.push(stage);
  stageIndex = stages.length - 1;
  deployed = [...config.party];
  selected = [...config.party];
  resetBuild();
  settings.sfx = 0;
  RULES.coreHp = config.bossHp;
  setupBattle();
  __botMetrics = {
    parries: 0,
    lateParries: 0,
    constellations: 0,
    maxNodes: 0,
    directBossHits: 0,
    openingDirectHits: 0,
    unroutedBossHits: 0,
    directBossDamage: 0,
    steers: 0,
    guideStarsAtStart: battle.guideStarCharges || 0,
  };
  const originalResolve = resolveMeteorParryContact;
  resolveMeteorParryContact = function (g, contact) {
    if (contact && currentFigureShot().contact === null) __botMetrics.parries += 1;
    return originalResolve(g, contact);
  };
  const originalFigure = resolveFigure;
  resolveFigure = function (points) {
    __botMetrics.constellations += 1;
    return originalFigure(points);
  };
  const originalDamage = damage;
  damage = function (weak) {
    const opening = ball.openingBossContact;
    const unrouted = !ball.starkeeperTouched;
    const before = boss.hp;
    __botMetrics.directBossHits += 1;
    if (opening) __botMetrics.openingDirectHits += 1;
    if (unrouted) __botMetrics.unroutedBossHits += 1;
    const result = originalDamage(weak);
    __botMetrics.directBossDamage += Math.max(0, before - boss.hp);
    return result;
  };
}
function __botLaunch(angle) {
  const speed = 1725;
  ball.vx = Math.cos(angle) * speed;
  ball.vy = Math.sin(angle) * speed;
  ball.moving = true;
  ball.steerUsed = false;
  ball.steerFlash = 0;
  ball.firstImpact = null;
  ball.starkeeperTouched = false;
  ball.openingBossContact = false;
  battle.shots -= 1;
  chain = [];
}
function __botAngle(mode, shot, spread) {
  const targets = mode === "direct" ? [boss] : gates;
  const target = targets[shot % targets.length] || boss;
  return Math.atan2(target.y - ball.y, target.x - ball.x) + spread;
}
function __botTryParry(mode) {
  const state = currentFigureShot();
  __botMetrics.maxNodes = Math.max(__botMetrics.maxNodes, state.nodes.length);
  if (mode === "direct") return;
  if (state.contact && state.contact.t > 0) {
    if (requestTrainingParry()) __botMetrics.lateParries += 1;
    return;
  }
  if (state.parry > 0 || state.cooldown > 0 || state.nearMiss > 0) return;
  for (const gate of gates) {
    const dx = gate.x - ball.x, dy = gate.y - ball.y;
    const distance = Math.hypot(dx, dy);
    const closing = (ball.vx * dx + ball.vy * dy) / Math.max(distance, 1);
    if (closing > 0 && distance < gate.r + ball.r + 112) {
      requestTrainingParry();
      return;
    }
  }
}
function __botRun(config) {
  __botStart(config);
  const duration = [];
  let shot = 0, frames = 0, shotFrames = 0;
  while (run && !battleComplete && shot < config.shots && frames < config.frameLimit) {
    if (!ball.moving) {
      __botLaunch(__botAngle(config.policy, shot, config.spread[shot % config.spread.length]));
      shot += 1;
      shotFrames = 0;
    }
    __botTryParry(config.policy);
    if (config.steer && ball.moving && !ball.steerUsed && shotFrames === config.steerAt) {
      if (steerMeteor(shot % 2 ? -1 : 1)) __botMetrics.steers += 1;
    }
    update(1 / 60);
    updateSpecial(1 / 60);
    updateFeedback(1 / 60);
    shotFrames += 1;
    frames += 1;
    if (!ball.moving && shotFrames) duration.push(shotFrames / 60);
  }
  return {
    cleared: boss.hp <= 0,
    remainingHp: Math.round(boss.hp),
    shotsUsed: shot,
    shotDuration: duration,
    maxShotDuration: Math.max(0, ...duration),
    averageShotDuration: duration.length
      ? duration.reduce((sum, value) => sum + value, 0) / duration.length
      : 0,
    guideStarsRemaining: battle.guideStarCharges || 0,
    ...__botMetrics,
  };
}
function __botCampaignRun(config) {
  const source = stages[config.campaignIndex];
  if (!source || source.training) throw new Error("campaign stage is unavailable");
  return __botRun({
    ...config,
    arena: { ...source, tutorial: false },
    bossHp: source.bossHp,
  });
}
function __botIndividualClaimProbe() {
  progress = {
    ...progress,
    gold: 0,
    pendingGold: 0,
    pendingRewards: [],
    pendingRewardSerial: 0,
  };
  accrueGold(100, "1-2 클리어 보상");
  accrueGold(100, "1-3 클리어 보상");
  const before = pendingRewardEntries();
  const claimed = claimPendingGold(before[0].id);
  const afterOne = pendingRewardEntries();
  progress.pendingGold = 60;
  const legacy = pendingRewardEntries().find(
    (entry) => entry.id === "legacy-pending-gold",
  );
  const legacyClaim = claimPendingGold(legacy.id);
  return {
    before,
    claimed,
    afterOne,
    legacyClaim,
    finalEntries: pendingRewardEntries(),
    gold: progress.gold,
  };
}
function __botSteerProbe(config, side) {
  __botStart(config);
  ball.vx = 1000;
  ball.vy = 0;
  ball.moving = true;
  ball.steerUsed = false;
  const firstUse = steerMeteor(side);
  const lateralVelocity = ball.vy;
  const secondUse = steerMeteor(-side);
  return { firstUse, secondUse, lateralVelocity };
}
`;

function runInRuntime(config, entryPoint = "__botRun") {
  const context = createContext(config.seed);
  for (const file of runtimeFiles) {
    vm.runInContext(readFileSync(resolve(root, file), "utf8"), context, {
      filename: file,
    });
  }
  vm.runInContext(harnessRuntime, context, { filename: "bot-runtime" });
  context.__botConfig = config;
  return vm.runInContext(`${entryPoint}(__botConfig)`, context);
}

export const PARTY_POOLS = Object.freeze({
  2: ["gaon", "biyeon"],
  3: ["gaon", "biyeon", "ria"],
  4: ["gaon", "biyeon", "ria", "taeo"],
});

export function runPlainArena({
  partySize = 3,
  bossHp = 260,
  policy = "contact",
  seed = 1,
  steer = false,
} = {}) {
  const party = PARTY_POOLS[partySize];
  if (!party) throw new Error("partySize must be 2, 3, or 4");
  return runInRuntime({
    arena: plainArena,
    party,
    bossHp,
    policy,
    seed,
    steer,
    shots: 5,
    steerAt: 26,
    frameLimit: 7200,
    spread: [-0.1, -0.04, 0.04, 0.1],
  });
}

export function probeSteerDirection(side) {
  if (side !== -1 && side !== 1) throw new Error("side must be -1 or 1");
  return runInRuntime(
    {
      arena: plainArena,
      party: PARTY_POOLS[2],
      bossHp: 260,
      policy: "direct",
      seed: 1,
      steer: false,
      shots: 1,
      steerAt: 0,
      frameLimit: 1,
      spread: [0],
    },
    `__botSteerProbe.bind(null, __botConfig, ${side})`,
  );
}

export function runCampaignStage({
  campaignIndex = 0,
  partySize = 3,
  policy = "contact",
  seed = 1,
  steer = false,
} = {}) {
  const party = PARTY_POOLS[partySize];
  if (!party) throw new Error("partySize must be 2, 3, or 4");
  return runInRuntime(
    {
      campaignIndex,
      party,
      policy,
      seed,
      steer,
      shots: 5,
      steerAt: 26,
      frameLimit: 7200,
      spread: [-0.1, -0.04, 0.04, 0.1],
    },
    "__botCampaignRun",
  );
}

export function probeIndividualClaims() {
  return runInRuntime({ seed: 1 }, "__botIndividualClaimProbe");
}

export function sweepPlainArena({
  partySizes = [2, 3, 4],
  bossHp = [180, 260, 340, 420],
  seeds = [11, 29, 47, 83],
  policies = ["direct", "contact"],
  steer = false,
} = {}) {
  const report = [];
  for (const partySize of partySizes)
    for (const hp of bossHp)
      for (const policy of policies)
        for (const seed of seeds)
          report.push({
            partySize,
            bossHp: hp,
            policy,
            steer,
            seed,
            ...runPlainArena({ partySize, bossHp: hp, policy, seed, steer }),
          });
  return report;
}
