/**
 * Prism Breakers headless battle model.
 * No DOM, Canvas, Image, or browser APIs: it exists for repeatable balance checks.
 */
export const RULES = Object.freeze({
  width: 900,
  height: 520,
  shots: 4,
  bossHp: 240,
  baseDamage: 16,
  chainStep: 0.55,
});

export const STAGES = Object.freeze([
  {
    id: "S-01",
    name: "균열 정원",
    boss: [667, 220],
    weakRadius: 84,
    slots: [
      [380, 320],
      [510, 150],
      [705, 355],
    ],
  },
  {
    id: "S-02",
    name: "월광 회랑",
    boss: [650, 245],
    weakRadius: 84,
    slots: [
      [355, 180],
      [535, 370],
      [740, 175],
    ],
  },
  {
    id: "S-03",
    name: "공허의 제단",
    boss: [675, 230],
    weakRadius: 84,
    slots: [
      [360, 345],
      [565, 120],
      [755, 350],
    ],
  },
]);

export const HEROES = Object.freeze({
  gaon: { name: "샛별", gate: 9, rebound: 1.16 },
  biyeon: { name: "미리내", gate: 12, weakMult: 1.28 },
  lumi: { name: "별하", gate: 11, pulse: 7 },
  haru: { name: "살별", gate: 10, relay: 8 },
  sera: { name: "달무리", gate: 13, orbit: 10 },
  taeo: { name: "모루", gate: 8, wall: 8 },
  nyx: { name: "그믐", gate: 14, mark: 9 },
  rio: { name: "리오", gate: 12, turn: 7 },
});

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const group = (ids) => ids.map((id) => HEROES[id]);

function weakPoint(stage, tick) {
  const [x, y] = stage.boss;
  const a = tick * 0.62;
  return {
    x: x + Math.cos(a) * stage.weakRadius,
    y: y + Math.sin(a) * stage.weakRadius,
  };
}

function launch(state, angle) {
  state.ball.vx = Math.cos(angle) * 630;
  state.ball.vy = Math.sin(angle) * 630;
  state.ball.moving = true;
}

function hitBoss(state, weak) {
  const chainBonus = 1 + Math.max(0, state.chain - 1) * RULES.chainStep;
  let damage = RULES.baseDamage * chainBonus * (weak ? 1.8 : 0.72);
  if (weak) damage *= state.weakMult;
  damage *= 1 + Math.min(0.4, state.bounces * 0.04);
  state.hp = Math.max(0, state.hp - damage);
  state.damage += damage;
  state.hits += 1;
  if (weak) state.weakHits += 1;
  state.chain = 0;
}

/** Runs one deterministic 4-shot battle using the legacy board model. */
export function simulateBattle({
  stage = STAGES[0],
  party = ["gaon", "biyeon", "lumi"],
  angles = [],
} = {}) {
  const heroes = group(party);
  const state = {
    hp: RULES.bossHp,
    damage: 0,
    hits: 0,
    weakHits: 0,
    gateHits: 0,
    bounces: 0,
    chain: 0,
    weakMult: heroes.reduce((m, h) => m * (h.weakMult ?? 1), 1),
    ball: { x: 150, y: 422, vx: 0, vy: 0, moving: false },
    tick: 0,
  };
  const gates = stage.slots.map((p, index) => ({
    x: p[0],
    y: p[1],
    hero: heroes[index],
  }));

  for (let shot = 0; shot < RULES.shots && state.hp > 0; shot += 1) {
    launch(state, angles[shot] ?? -0.34);
    let gateCooldown = new Set();
    let bossCooldown = 0;
    for (
      let step = 0;
      step < 1800 && state.ball.moving && state.hp > 0;
      step += 1
    ) {
      const dt = 1 / 120;
      state.tick += dt;
      const b = state.ball;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.vx *= 0.993;
      b.vy *= 0.993;
      bossCooldown = Math.max(0, bossCooldown - dt);

      if (b.x < 13 || b.x > RULES.width - 13) {
        b.x = clamp(b.x, 13, RULES.width - 13);
        b.vx *= -1.03;
        state.bounces += 1;
        state.damage += heroes.reduce((n, h) => n + (h.wall ?? 0), 0);
      }
      if (b.y < 13 || b.y > RULES.height - 13) {
        b.y = clamp(b.y, 13, RULES.height - 13);
        b.vy *= -1.03;
        state.bounces += 1;
        state.damage += heroes.reduce((n, h) => n + (h.wall ?? 0), 0);
      }

      for (const gate of gates) {
        if (gateCooldown.has(gate)) continue;
        if (distance(b, gate) < 44) {
          const dx = b.x - gate.x,
            dy = b.y - gate.y,
            len = Math.hypot(dx, dy) || 1;
          const nx = dx / len,
            ny = dy / len,
            dot = b.vx * nx + b.vy * ny;
          if (dot < 0) {
            b.vx -= 2 * dot * nx;
            b.vy -= 2 * dot * ny;
            b.vx *= gate.hero.rebound ?? 1;
            b.vy *= gate.hero.rebound ?? 1;
            state.damage += gate.hero.gate;
            state.hp = Math.max(0, state.hp - gate.hero.gate);
            state.chain += 1;
            state.gateHits += 1;
            gateCooldown.add(gate);
          }
        }
      }
      if (gateCooldown.size) {
        for (const gate of gates)
          if (distance(b, gate) > 55) gateCooldown.delete(gate);
      }

      const boss = { x: stage.boss[0], y: stage.boss[1] };
      const weak = weakPoint(stage, state.tick);
      if (
        bossCooldown === 0 &&
        (distance(b, weak) < 34 || distance(b, boss) < 71)
      ) {
        hitBoss(state, distance(b, weak) < 34);
        bossCooldown = 0.25;
        b.vx *= -0.78;
        b.vy *= -0.78;
      }
      if (Math.hypot(b.vx, b.vy) < 28) b.moving = false;
    }
  }
  state.damage = Math.round(state.damage);
  state.remainingHp = Math.ceil(state.hp);
  state.cleared = state.hp <= 0;
  return state;
}

export function allParties() {
  const ids = Object.keys(HEROES),
    result = [];
  for (let a = 0; a < ids.length - 2; a += 1)
    for (let b = a + 1; b < ids.length - 1; b += 1)
      for (let c = b + 1; c < ids.length; c += 1)
        result.push([ids[a], ids[b], ids[c]]);
  return result;
}

export function candidateAngles(state, stage) {
  const targets = [
    { x: stage.boss[0], y: stage.boss[1] },
    weakPoint(stage, state.tick),
    ...stage.slots.map(([x, y]) => ({ x, y })),
  ];
  const offsets = [-0.18, -0.09, 0, 0.09, 0.18];
  return targets.flatMap((target) =>
    offsets.map(
      (offset) =>
        Math.atan2(target.y - state.ball.y, target.x - state.ball.x) + offset,
    ),
  );
}
