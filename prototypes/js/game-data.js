/**
 * @typedef {{ id: number, shots: number, shotMax: number, startedAt: number, training: boolean, tutorial: boolean, victory?: { t: number, d: number, elapsedMs: number } }} BattleState
 * @typedef {{ x: number, y: number, vx: number, vy: number, r: number, moving: boolean, power: number, trail: Array<{x: number, y: number}> }} MeteorState
 * @typedef {{ phase: number, dialogue: number, contacts: Set<string>, bossHit: boolean, launched: boolean, replay: boolean }} OnboardingState
 */

const c = document.querySelector("#game"),
  x = c.getContext("2d"),
  W = c.width,
  H = c.height;
const LAUNCH_Y = H - 152;
x.imageSmoothingEnabled = false;
const UI_MONOSPACE_PATTERN = /\bui-monospace\b/g;
const canvasFontDescriptor = Object.getOwnPropertyDescriptor(
  CanvasRenderingContext2D.prototype,
  "font",
);
if (canvasFontDescriptor?.get && canvasFontDescriptor?.set)
  Object.defineProperty(CanvasRenderingContext2D.prototype, "font", {
    configurable: true,
    enumerable: canvasFontDescriptor.enumerable,
    get() {
      return canvasFontDescriptor.get.call(this);
    },
    set(value) {
      // The pattern is hoisted: this setter sits on the hot draw path (gate
      // labels, popups, combo, aim guide - roughly eight assignments a frame)
      // and a literal here rebuilt a RegExp on every one of them.
      canvasFontDescriptor.set.call(
        this,
        String(value).replace(UI_MONOSPACE_PATTERN, "Galmuri11"),
      );
    },
  });
const U = {
  shotsText: document.querySelector("#shotsText"),
  shotDots: document.querySelector("#shotDots"),
  phase: document.querySelector("#phaseText"),
  hp: document.querySelector("#hpText"),
  bossName: document.querySelector("#bossName"),
  hpFill: document.querySelector("#hpFill"),
  power: document.querySelector("#powerText"),
  chain: document.querySelector("#chainText"),
  tip: document.querySelector("#tip"),
  over: document.querySelector("#overlay"),
  toast: document.querySelector("#toast"),
  summary: document.querySelector("#runeSummary"),
  momentum: document.querySelector("#momentumText"),
  flash: document.querySelector("#impactFlash"),
  blaze: document.querySelector("#blazeValue"),
  blazeDetail: document.querySelector("#blazeDetail"),
  blazeCard: document.querySelector("#blazeCard"),
};
const stageEl = document.querySelector(".stage");
U.combo = document.querySelector("#comboText");
const RULES = {
  baseDamage: 24,
  chainStep: 0.55,
  // A bare boss rush is allowed as a recovery line, but it cannot replace the
  // party route. The opening direct hit is lower again when it is the shot's
  // first collision, before the meteor has touched a starkeeper or rail.
  unroutedBossDamage: 0.6,
  openingBossDamage: 0.5,
  shots: 5,
  coreHp: 260,
  // The last onboarding lesson is a real kill, so the colossus stops being
  // immortal there.  Half the campaign pool keeps it a two or three shot win.
  tutorialCoreHp: 120,
};
const ECONOMY = {
  clearGold: 100,
  gachaCost: 100,
  skinCost: 500,
  heroSkinCost: 320,
};
// Meteor skins are cosmetic only: they repaint the existing prism orb with a
// hue rotation and swap the trail/glow palette, so no new art is shipped and
// no skin can change damage, speed or any physics value.
const METEOR_SKINS = [
  {
    id: "prism",
    name: "프리즘 원석",
    note: "관측소 지급 기본 유성",
    hue: 0,
    moving: "#d3e7cf",
    rest: "#e0b45a",
    core: "#f6fdff",
    idle: "#a6f5ff",
  },
  {
    id: "ember",
    name: "잔불의 유성",
    note: "꺼지지 않은 별의 마지막 온기",
    hue: 128,
    moving: "#f2b184",
    rest: "#e07a3c",
    core: "#fff0dd",
    idle: "#ffc79a",
  },
  {
    id: "abyss",
    name: "심연의 유성",
    note: "공허를 삼키고 돌아온 빛",
    hue: 300,
    moving: "#9aa6f0",
    rest: "#6f63c8",
    core: "#eae6ff",
    idle: "#b0a8ff",
  },
  {
    id: "verdant",
    name: "이끼별 유성",
    note: "오래 잠든 자리에 돋아난 색",
    hue: 200,
    moving: "#a9dd94",
    rest: "#6aa457",
    core: "#effbe6",
    idle: "#c2f0ab",
  },
];
const DEFAULT_METEOR_SKIN = METEOR_SKINS[0].id;
// Starkeeper skins repaint the sprite with a hue rotation at draw time, the
// same trick the meteor skins use, so no new sheet is shipped.  `heroes[].col`
// is untouched: the ring, the name and every readability colour stay put, and
// a skin can never change a physics or damage value.
const HERO_SKINS = [
  { id: "origin", name: "본래 색", note: "관측소 지급", hue: 0, sat: 1 },
  {
    id: "azure",
    name: "청군",
    note: "새벽 전 가장 짙은 파랑",
    hue: 168,
    sat: 1.05,
  },
  {
    id: "crimson",
    name: "홍옥",
    note: "식지 않은 화로의 색",
    hue: 312,
    sat: 1.1,
  },
  {
    id: "violet",
    name: "자수정",
    note: "공허를 오래 본 자의 색",
    hue: 254,
    sat: 1,
  },
  {
    id: "verdigris",
    name: "청동",
    note: "오래 걸린 관측기의 녹",
    hue: 96,
    sat: 0.92,
  },
];
const DEFAULT_HERO_SKIN = HERO_SKINS[0].id;
// Slots used to be named after a trigger — "범퍼 충돌 시 연계 발동" and so on —
// but `triggerZone` was deleted when a starkeeper started waking from real
// movement alone, and nothing has read a slot's `zone` since.  The roster kept
// printing those conditions anyway, promising rules the build no longer has.
//
// What genuinely differs between slots is how far they begin from the colossus,
// and that is worth planning around: 샛별's cut is short-ranged, 미리내's shot
// pays for distance.  So the role is measured off the stage instead of invented.
const SLOT_BANDS = [
  {
    id: "near",
    name: "근접 자리",
    hint: "거상과 가깝게 시작 · 짧은 사거리에 유리",
    within: 300,
  },
  {
    id: "mid",
    name: "중거리 자리",
    hint: "거상과 중간 거리에서 시작",
    within: 390,
  },
  { id: "far", name: "원거리 자리", hint: "거상과 멀게 시작 · 저격에 유리" },
];
// Campaign slots measure 204-417 from their colossus, so the two thresholds
// split the real spread rather than a guessed one.
function slotRole(index, stage = currentStage()) {
  const seat = stage?.slots?.[index];
  if (!seat || !stage?.boss) return SLOT_BANDS[SLOT_BANDS.length - 1];
  const away = Math.hypot(seat[0] - stage.boss.x, seat[1] - stage.boss.y);
  return (
    SLOT_BANDS.find((band) => band.within && away <= band.within) ??
    SLOT_BANDS[SLOT_BANDS.length - 1]
  );
}
const heroes = {
  gaon: {
    n: "여명의 검사 샛별",
    s: "샛별",
    e: "근접 베기",
    d: "각성해 멈춘 자리에서 보스에게 검기를 보냅니다. 가까울수록 피해가 강합니다.",
    lore: "밤의 끝에서 가장 먼저 떠올라 새벽을 여는, 첫 별.",
    fx: "slash",
    col: "#f2c56b",
    sprite: "../assets/characters/gaon-warrior-idle.png",
    fw: 192,
    fh: 192,
    frames: 6,
    scale: 0.38,
  },
  biyeon: {
    n: "은하수 사수 미리내",
    s: "미리내",
    e: "거리 저격",
    d: "각성해 멈춘 자리에서 보스에게 화살을 쏩니다. 멀수록 피해가 커집니다.",
    lore: "잊힌 별들의 강을 홀로 건너며 화살을 줍는, 은하수의 별.",
    fx: "longshot",
    col: "#ef718d",
    sprite: "../assets/characters/biyeon-archer-idle.png",
    fw: 192,
    fh: 192,
    frames: 6,
    scale: 0.38,
  },
  lumi: {
    n: "쌍성 술사 별하",
    s: "별하",
    e: "이중 분열",
    d: "유성에 닿으면 이번 발사 동안 한 번, 공을 둘로 복제합니다.",
    lore: "혼자가 싫어 스스로를 둘로 나눈, 쌍둥이 별.",
    fx: "split",
    col: "#70dce1",
    sprite: "../assets/characters/lumi-shaman-idle.png",
    fw: 192,
    fh: 192,
    frames: 6,
    scale: 0.38,
  },
  haru: {
    n: "혜성 전령 살별",
    s: "살별",
    e: "강제 중계",
    d: "유성에 닿으면 가장 가까운 다른 별지기에게 즉시 재발사합니다.",
    lore: "긴 꼬리에 전할 말을 매달고 밤하늘을 달리는, 혜성의 별.",
    fx: "seek",
    col: "#9ee477",
    sprite: "../assets/characters/haru-lancer-idle.png",
    fw: 192,
    fh: 192,
    frames: 6,
    scale: 0.38,
  },
  ria: {
    n: "빛무리 무희 윤슬",
    s: "윤슬",
    e: "질풍 칼날",
    d: "정산 공격이 없습니다. 각성하면 보스·별지기를 관통하며, 속도에 비례해 회전 칼날로 벱니다.",
    lore: "물 위에 부서진 별빛처럼, 멈추면 사라지는 반짝임의 별.",
    fx: "bladewheel",
    col: "#5fe0cf",
    sprite: "../assets/characters/ria-bladewheel-idle.png",
    fw: 192,
    fh: 192,
    frames: 6,
    scale: 0.38,
  },
  sera: {
    n: "궤도 사제 달무리",
    s: "달무리",
    e: "전환 명령",
    d: "유성에 닿으면 기본 충돌 반응을 냅니다. 전환 명령의 새 발동 조건은 재설계 중입니다.",
    lore: "달을 지키는 고리가 되어 궤도를 다스리는, 고리의 별.",
    fx: "turn",
    col: "#bca7ff",
    sprite: "../assets/characters/sera-monk-idle.png",
    fw: 192,
    fh: 192,
    frames: 6,
    scale: 0.38,
  },
  taeo: {
    n: "별불 대장장이 모루",
    s: "모루",
    e: "충돌 충격파",
    d: "각성해 멈춘 자리에서 이번 샷의 충돌 수에 비례한 충격파를 일으킵니다.",
    lore: "떨어진 별을 두드려 다시 하늘로 벼려 올리는, 대장간의 별.",
    fx: "shockwave",
    col: "#ffac67",
    // The filename still says orc from the sheet this replaced.  Do NOT run
    // scripts/generate_taeo_orc_restyle.py against it: that script rebuilds the
    // old bronze Tiny RPG orc and would overwrite the roster art.
    sprite: "../assets/characters/taeo-orc-idle.png",
    fw: 192,
    fh: 192,
    frames: 6,
    scale: 0.38,
  },
  nyx: {
    n: "밤의 관측자 그믐",
    s: "그믐",
    e: "마지막 모사",
    d: "마지막으로 부딪힌 아군의 능력을 이번 샷에 그대로 복제합니다.",
    lore: "빛나기를 그만두고 다른 별의 빛을 기록하는, 어두운 달.",
    fx: "copycat",
    col: "#9f83ff",
    sprite: "../assets/characters/nyx-oracle-idle.png",
    fw: 192,
    fh: 192,
    frames: 6,
    scale: 0.38,
  },
};
const STARTER_HERO_IDS = Object.freeze(["gaon", "biyeon", "ria"]);
const GACHA_HERO_IDS = Object.freeze(
  Object.keys(heroes).filter((id) => !STARTER_HERO_IDS.includes(id)),
);
const abilityFx = {
  gaon: "../assets/library/restyle/fx/gaon-slash.png",
  biyeon: "../assets/library/restyle/fx/biyeon-volley.png",
  lumi: "../assets/library/restyle/fx/lumi-wave.png",
  haru: "../assets/library/restyle/fx/haru-dash.png",
  sera: "../assets/library/restyle/fx/rio-turn.png",
  taeo: "../assets/library/restyle/fx/taeo-quake.png",
  nyx: "../assets/library/restyle/fx/nyx-lock.png",
};
// 4-frame burst sheets keyed by ability kind; they play over the vector
// accents so a landed ability reads as one big signature flash.
const abilityFxSheets = {
  slash: "../assets/library/anim/fx/fx-slash-burst.png",
  longshot: "../assets/library/anim/fx/fx-longshot-burst.png",
  split: "../assets/library/anim/fx/fx-split-burst.png",
  seek: "../assets/library/anim/fx/fx-seek-burst.png",
  turn: "../assets/library/anim/fx/fx-turn-burst.png",
  shockwave: "../assets/library/anim/fx/fx-shockwave-burst.png",
  copycat: "../assets/library/anim/fx/fx-copycat-burst.png",
};
// Combat deliberately uses smaller, toy-like token art.  The full sprites
// remain available for the roster, while the table stays legible at a glance.
const combatUnitSize = {
  gaon: 108,
  biyeon: 109,
  lumi: 117,
  haru: 96,
  ria: 116,
  sera: 96,
  taeo: 118,
  nyx: 93,
};
for (const [id, size] of Object.entries(combatUnitSize))
  heroes[id].combatSize = size;
// Action sheets recoloured from the same source frames as each hero: the
// tumbling roll plays while a starkeeper is knocked around, the attack sheet
// replaces the cute token for the wake-up strike itself.
for (const id of Object.keys(heroes))
  Object.assign(heroes[id], {
    sheetFrame: heroes[id].fw,
    animations: {
      move: "../assets/characters/anim/" + id + "-roll.png",
      attack: "../assets/characters/anim/" + id + "-attack.png",
    },
  });
// A constellation is a world and each of its stars is a stage, so stage names
// come from the sky instead of being invented.  `shape` is the real figure in
// percentages of the map box, in play order, which is also the order the nodes
// connect on the hub map.
/* 월드 색상환. 디자인 세션 §2의 답이다 — 지금 고유색 976개가 마주 보는 두 호에만
   몰려 있어 「색이 적은 게 아니라 갈래가 둘」인 상태라, 월드마다 hue만 돌려
   일곱 갈래로 벌린다. 인접한 월드끼리 50도 이상 떨어뜨려 캠페인을 이어서 하면
   따뜻함과 차가움이 번갈아 온다.
   L과 C는 톤 단계마다 고정이므로(WORLD_TONES) 어느 월드에서도 대비와 무게가
   같고, 글자 가독성이 월드마다 달라지지 않는다.
   `outside`는 색을 받지 않는다 — 관측되지 않은 점이고, 인트로가 「없는 별」로
   부르는 그 빈 좌표다. 색이 없다는 것 자체가 그 월드의 성질이다. */
const WORLD_HUES = {
  aries: 45,
  sagitta: 255,
  corvus: 305,
  cass: 145,
  cygnus: 355,
  orion: 195,
  ursa: 95,
};
/* 톤 사다리. 이름은 쓰임새로 붙였다. 월드가 바뀌어도 이 L·C는 바뀌지 않는다. */
const WORLD_TONES = {
  deep: [0.26, 0.045],
  ground: [0.4, 0.075],
  line: [0.63, 0.115],
  node: [0.72, 0.09],
  glow: [0.79, 0.105],
  text: [0.86, 0.075],
  bright: [0.91, 0.055],
};
function worldTone(worldId, tone, alpha) {
  const hue = WORLD_HUES[worldId];
  const [l, c] = WORLD_TONES[tone] ?? WORLD_TONES.line;
  // 월드색이 없는 자리는 뼈대 회색으로 떨어진다. 일곱 월드가 공유하는 넷 중
  // 달빛 회색이다 — 색을 뺀 자리에 다른 월드의 색이 새면 안 된다.
  if (hue === undefined) return alpha === undefined ? "#cfdad7" : "#cfdad7";
  return (
    "oklch(" +
    l +
    " " +
    c +
    " " +
    hue +
    (alpha === undefined ? "" : " / " + alpha) +
    ")"
  );
}
const WORLDS = [
  {
    id: "aries",
    name: "양자리",
    bayer: "ARIES",
    lore: "세 점을 잇는 첫 관측 항로. 별지기 경유와 패링을 배운다.",
    shape: [
      [13, 62],
      [48, 27],
      [87, 55],
    ],
  },
  {
    id: "sagitta",
    name: "화살자리",
    bayer: "SAGITTA",
    lore: "네 점의 화살이 향하는 곳. 발사 뒤 궤도 전환을 익힌다.",
    shape: [
      [12, 55],
      [35, 55],
      [66, 24],
      [88, 55],
    ],
  },
  {
    id: "corvus",
    name: "까마귀자리",
    bayer: "CORVUS",
    lore: "네 점의 굽은 날개. 충돌 순서와 다음 샷의 자리를 읽는다.",
    shape: [
      [12, 61],
      [35, 28],
      [68, 37],
      [89, 62],
    ],
  },
  {
    id: "cass",
    name: "카시오페이아",
    bayer: "CASSIOPEIA",
    lore: "다섯 별의 W. 어느 별지기를 먼저 공명할지 고른다.",
    shape: [
      [12, 34],
      [30, 64],
      [50, 30],
      [70, 64],
      [88, 34],
    ],
  },
  {
    id: "cygnus",
    name: "백조자리",
    bayer: "CYGNUS",
    lore: "다섯 점의 긴 날개. 한 샷 안에서 접점을 이어 간다.",
    shape: [
      [12, 54],
      [35, 54],
      [52, 22],
      [68, 54],
      [90, 54],
    ],
  },
  {
    id: "orion",
    name: "오리온자리",
    bayer: "ORION",
    lore: "여섯 별의 사냥꾼. 조향 한 번과 패링을 함께 회수한다.",
    shape: [
      [12, 62],
      [28, 27],
      [46, 48],
      [60, 48],
      [76, 28],
      [89, 62],
    ],
  },
  {
    id: "ursa",
    name: "북두칠성",
    bayer: "URSA MAJOR",
    lore: "일곱 별의 국자. 모든 경로 판단을 묻는 마지막 관측.",
    shape: [
      [13, 20],
      [31, 30],
      [48, 36],
      [64, 42],
      [66, 66],
      [84, 58],
      [86, 30],
    ],
  },
  // 여덟 번째는 별자리가 아니다. 성도의 어느 그림에도 속하지 않는 점 하나라
  // `shape`가 비어 있고, 지도와 전장 아스트롤라베는 이을 선 없이 그린다.
  {
    id: "outside",
    name: "관측되지 않은 점",
    bayer: "∅",
    lore: "성도 밖의 좌표. 이름이 없고, 이미 이쪽을 보고 있다.",
    shape: [],
  },
];
// The table is 720x900, and `preview` is the same slot in percent so the
// squad minimap and the real table agree.  Every stage that introduces a
// gimmick carries that gimmick alone; only later stages combine two.
// Preserved only as a reference for retired gimmick layouts.  The active
// campaign below is intentionally a no-gimmick HP/route progression.
const LEGACY_GIMMICK_STAGES = [
  {
    id: "1-1",
    world: "ursa",
    star: { name: "두베", bayer: "α UMa" },
    name: "두베 · 첫 관측",
    terrain:
      "루나의 안내를 따라 직격, 근접 각성, 별자리 배율을 차례로 관측하세요.",
    slots: [
      [182, 542],
      [538, 542],
      [360, 470],
    ],
    preview: [
      [25.3, 60.2],
      [74.7, 60.2],
      [50, 52.2],
    ],
    boss: { x: 360, y: 190 },
    labels: ["왼쪽 별지기", "오른쪽 별지기", "첫 관측점"],
    bumpers: [],
    tutorial: true,
  },
  {
    id: "1-2",
    world: "ursa",
    star: { name: "메라크", bayer: "β UMa" },
    name: "메라크 · 공명의 문",
    terrain: "두 공명 범퍼를 오가며 속도를 만들고, 범퍼 충돌 연계를 익히세요.",
    slots: [
      [160, 518],
      [560, 518],
      [360, 438],
    ],
    preview: [
      [22.2, 57.6],
      [77.8, 57.6],
      [50, 48.7],
    ],
    boss: { x: 360, y: 192 },
    labels: ["좌측 중계점", "우측 중계점", "중앙 귀환점"],
    bumpers: [
      [240, 330, 27],
      [480, 330, 27],
    ],
  },
  {
    id: "1-3",
    world: "ursa",
    star: { name: "페크다", bayer: "γ UMa" },
    name: "페크다 · 반사의 계단",
    terrain: "반사 벽 두 개로 각을 만들어 거상의 약점까지 길을 그리세요.",
    slots: [
      [170, 446],
      [550, 358],
      [360, 550],
    ],
    preview: [
      [23.6, 49.6],
      [76.4, 39.8],
      [50, 61.1],
    ],
    boss: { x: 360, y: 190 },
    labels: ["좌측 계단", "우측 계단", "하단 귀환점"],
    bumpers: [],
    gimmicks: {
      walls: [
        { x: 150, y: 262, w: 118, h: 18 },
        { x: 570, y: 262, w: 118, h: 18 },
      ],
    },
  },
  {
    id: "1-4",
    world: "ursa",
    star: { name: "메그레즈", bayer: "δ UMa" },
    name: "메그레즈 · 잔재의 길목",
    terrain: "길을 막고 선 공허 잔재 두 기를 먼저 걷어내야 약점이 열립니다.",
    slots: [
      [186, 520],
      [534, 520],
      [360, 604],
    ],
    preview: [
      [25.8, 57.8],
      [74.2, 57.8],
      [50, 67.1],
    ],
    boss: { x: 360, y: 196 },
    labels: ["좌측 길목", "우측 길목", "하단 대기점"],
    bumpers: [],
    gimmicks: {
      adds: [
        { x: 268, y: 300, r: 23, hp: 52 },
        { x: 452, y: 300, r: 23, hp: 52 },
      ],
    },
  },
  {
    id: "1-5",
    world: "ursa",
    star: { name: "알리오트", bayer: "ε UMa" },
    name: "알리오트 · 굳은 껍질",
    terrain:
      "거상이 껍질을 세 겹 둘렀습니다. 약한 타격 세 번은 통째로 튕겨 나갑니다.",
    slots: [
      [172, 500],
      [548, 500],
      [360, 404],
    ],
    preview: [
      [23.9, 55.6],
      [76.1, 55.6],
      [50, 44.9],
    ],
    boss: { x: 360, y: 200 },
    labels: ["좌측 파쇄점", "우측 파쇄점", "중앙 파쇄점"],
    bumpers: [],
    gimmicks: {
      shield: { hits: 3 },
    },
  },
  {
    id: "1-6",
    world: "ursa",
    star: { name: "미자르", bayer: "ζ UMa" },
    name: "미자르 · 흐려지는 자리",
    terrain: "흐린 발판을 밟고 지나가면 쌓아 둔 별자리 배율이 깎여 나갑니다.",
    slots: [
      [176, 556],
      [544, 556],
      [360, 452],
    ],
    preview: [
      [24.4, 61.8],
      [75.6, 61.8],
      [50, 50.2],
    ],
    boss: { x: 360, y: 192 },
    labels: ["좌측 흐린 자리", "우측 흐린 자리", "중앙 관측점"],
    bumpers: [],
    gimmicks: {
      dragPads: [
        { x: 216, y: 664, w: 168, h: 42, drop: 0.5 },
        { x: 504, y: 664, w: 168, h: 42, drop: 0.5 },
      ],
    },
  },
  {
    id: "1-7",
    world: "ursa",
    star: { name: "알카이드", bayer: "η UMa" },
    name: "알카이드 · 도는 방벽",
    terrain: "체력을 가진 방벽 두 개가 거상 주위를 돕니다. 틈을 노리세요.",
    slots: [
      [166, 540],
      [554, 540],
      [360, 620],
    ],
    preview: [
      [23.1, 60],
      [76.9, 60],
      [50, 68.9],
    ],
    boss: { x: 360, y: 214 },
    labels: ["좌측 틈", "우측 틈", "하단 대기점"],
    bumpers: [],
    gimmicks: {
      orbits: [
        { r: 136, hp: 70, speed: 0.9, phase: 0 },
        { r: 136, hp: 70, speed: 0.9, phase: 3.14159 },
      ],
    },
  },
  {
    id: "2-1",
    world: "cass",
    star: { name: "카프", bayer: "β Cas" },
    name: "카프 · 밀려나는 밤",
    terrain:
      "거상의 체력이 꺾일 때마다 별지기 셋과 유성이 네 모서리로 밀려납니다.",
    slots: [
      [180, 498],
      [540, 498],
      [360, 420],
    ],
    preview: [
      [25, 55.3],
      [75, 55.3],
      [50, 46.7],
    ],
    boss: { x: 360, y: 198 },
    labels: ["좌측 고정점", "우측 고정점", "중앙 고정점"],
    bumpers: [],
    gimmicks: {
      phases: { at: [0.66, 0.33], effect: "push" },
    },
  },
  {
    id: "2-2",
    world: "cass",
    star: { name: "셰다르", bayer: "α Cas" },
    name: "셰다르 · 다시 잠드는 별",
    terrain:
      "거상의 체력이 꺾일 때마다 별지기가 다시 잠듭니다. 두 번 부딪혀야 깨어납니다.",
    slots: [
      [190, 520],
      [530, 520],
      [360, 596],
    ],
    preview: [
      [26.4, 57.8],
      [73.6, 57.8],
      [50, 66.2],
    ],
    boss: { x: 360, y: 194 },
    labels: ["좌측 잠자리", "우측 잠자리", "하단 잠자리"],
    bumpers: [],
    gimmicks: {
      phases: { at: [0.66, 0.33], effect: "sleep", wakeNeed: 2 },
    },
  },
  {
    id: "2-3",
    world: "cass",
    star: { name: "감마 카스", bayer: "γ Cas" },
    name: "감마 카스 · 가속의 등뼈",
    terrain: "중앙 가속 발판이 유성의 운동량을 밀어 올립니다.",
    slots: [
      [168, 560],
      [552, 560],
      [360, 466],
    ],
    preview: [
      [23.3, 62.2],
      [76.7, 62.2],
      [50, 51.8],
    ],
    boss: { x: 360, y: 190 },
    labels: ["좌측 등뼈", "우측 등뼈", "중앙 등뼈"],
    bumpers: [],
    gimmicks: {
      boostPads: [{ x: 360, y: 690, w: 190, h: 40, boost: 300 }],
    },
  },
  {
    id: "2-4",
    world: "cass",
    star: { name: "루크바", bayer: "δ Cas" },
    name: "루크바 · 겹친 궤도",
    terrain: "도는 방벽 하나와 반사 벽 두 개가 함께 길을 좁힙니다.",
    slots: [
      [174, 534],
      [546, 534],
      [360, 616],
    ],
    preview: [
      [24.2, 59.3],
      [75.8, 59.3],
      [50, 68.4],
    ],
    boss: { x: 360, y: 210 },
    labels: ["좌측 궤도", "우측 궤도", "하단 궤도"],
    bumpers: [],
    gimmicks: {
      orbits: [{ r: 128, hp: 82, speed: 1.05, phase: 0 }],
      walls: [
        { x: 132, y: 400, w: 108, h: 18 },
        { x: 588, y: 400, w: 108, h: 18 },
      ],
    },
  },
  {
    id: "2-5",
    world: "cass",
    star: { name: "세긴", bayer: "ε Cas" },
    name: "세긴 · 마지막 꼭짓점",
    terrain: "껍질 두 겹과 공명 범퍼 둘. 배율을 쌓아 한 번에 뚫으세요.",
    slots: [
      [162, 546],
      [558, 546],
      [360, 456],
    ],
    preview: [
      [22.5, 60.7],
      [77.5, 60.7],
      [50, 50.7],
    ],
    boss: { x: 360, y: 202 },
    labels: ["좌측 꼭짓점", "우측 꼭짓점", "중앙 꼭짓점"],
    bumpers: [
      [252, 348, 26],
      [468, 348, 26],
    ],
    gimmicks: {
      shield: { hits: 2 },
    },
  },
  {
    id: "T",
    name: "무한 훈련장",
    terrain:
      "불멸의 거상과 자동 보충 유성으로 충돌·분열·배율을 제한 없이 시험합니다.",
    // Prototype layout (2026-08-13): the colossus sits at the dead centre of
    // the 720x900 table instead of at the top, so a figure drawn by the party
    // can actually enclose it.  At y=194 a starkeeper cannot pass the boss (its
    // exclusion radius is g.r + 66 = 100), so surrounding it needed a vertex
    // threaded into a 60px band above it — one forced play, every shot.  Only
    // the training table moves; all twelve campaign stages keep their geometry.
    // Four seats, one per corner of a rectangle centred on the colossus.  With
    // the meteor that is five points, which is what the figure prototype needs
    // to be judged against the pentagram template.
    slots: [
      [170, 300],
      [550, 300],
      [170, 600],
      [550, 600],
    ],
    preview: [
      [23.6, 33.3],
      [76.4, 33.3],
      [23.6, 66.7],
      [76.4, 66.7],
    ],
    boss: { x: 360, y: 450 },
    labels: [
      "좌상 훈련 별지기",
      "우상 훈련 별지기",
      "좌하 훈련 별지기",
      "우하 훈련 별지기",
    ],
    // Bare table.  This used to run every gimmick module at once so a new one
    // could be exercised before a stage was designed for it, but the bumpers,
    // reflector walls, boost and drag pads, orbiting barriers and the void
    // remnant all deflected the party mid-roll — where a starkeeper comes to
    // rest is the whole of the figure prototype, so anything that moves it for
    // you is noise here.  Only the colossus and the four seats remain.  The
    // gimmick modules stay exercised by the twelve campaign stages.
    bumpers: [],
    gimmicks: {},
    training: true,
  },
];
const TRAINING_STAGE = LEGACY_GIMMICK_STAGES.find((stage) => stage.training);
const CAMPAIGN_LAYOUTS = [
  {
    slots: [
      [182, 542],
      [538, 542],
      [360, 470],
    ],
    boss: [360, 190],
  },
  {
    slots: [
      [156, 520],
      [486, 566],
      [352, 414],
    ],
    boss: [448, 202],
  },
  {
    slots: [
      [232, 564],
      [560, 438],
      [338, 506],
    ],
    boss: [274, 198],
  },
  {
    slots: [
      [162, 458],
      [526, 540],
      [390, 620],
    ],
    boss: [406, 214],
  },
  {
    slots: [
      [208, 536],
      [514, 432],
      [348, 598],
    ],
    boss: [332, 188],
  },
  {
    slots: [
      [142, 570],
      [454, 506],
      [586, 382],
    ],
    boss: [472, 210],
  },
  {
    slots: [
      [194, 406],
      [526, 584],
      [334, 632],
    ],
    boss: [244, 214],
  },
];
const CAMPAIGN_WORLD_PLANS = [
  {
    id: "aries",
    stages: [
      [
        "하말",
        "α Ari",
        "첫 관측",
        120,
        "루나와 함께 첫 패링 접점을 관측하세요.",
      ],
      [
        "셰라탄",
        "β Ari",
        "갈라진 뿔",
        155,
        "첫 성공 패링이 안내별 둘을 밝혀 첫 별자리를 돕습니다.",
        { guideStarCharges: 1 },
      ],
      [
        "메사르팀",
        "γ Ari",
        "세 점의 고리",
        180,
        "첫 성공 패링이 안내별 둘을 밝혀 별자리 루프를 돕습니다.",
        { guideStarCharges: 1 },
      ],
    ],
  },
  {
    id: "sagitta",
    stages: [
      [
        "샴",
        "α Sge",
        "첫 화살",
        190,
        "별지기 경유 뒤 보스에게 향하는 한 줄을 만드세요.",
      ],
      [
        "화살의 허리",
        "β Sge",
        "갈림 궤도",
        200,
        "발사당 한 번의 궤도 전환을 안전하게 써 보세요.",
      ],
      [
        "화살촉",
        "γ Sge",
        "먼저 꺾기",
        210,
        "보스보다 별지기를 먼저 맞히는 각을 찾으세요.",
      ],
      [
        "되돌림",
        "δ Sge",
        "끝의 방향",
        220,
        "패링 이후 남은 방향으로 다음 접점을 이어 가세요.",
      ],
    ],
  },
  {
    id: "corvus",
    stages: [
      [
        "알키바",
        "α Crv",
        "검은 첫 점",
        225,
        "첫 충돌 순서를 바꿔 보스 진입을 설계하세요.",
      ],
      [
        "크라즈",
        "β Crv",
        "굽은 날개",
        235,
        "멈춘 자리가 다음 샷의 출발점이 되는 것을 활용하세요.",
      ],
      [
        "기에나",
        "γ Crv",
        "중계 깃",
        245,
        "두 별지기를 연달아 깨우는 경로를 만드세요.",
      ],
      [
        "알고라브",
        "δ Crv",
        "돌아오는 그림자",
        250,
        "직격 대신 되돌아오는 공명 경로를 선택하세요.",
      ],
    ],
  },
  {
    id: "cass",
    stages: [
      [
        "카프",
        "β Cas",
        "W의 첫 점",
        255,
        "분산된 시작 배치에서 첫 목표를 정하세요.",
      ],
      [
        "셰다르",
        "α Cas",
        "갈라진 왕관",
        265,
        "서로 먼 별지기를 한 발 안에서 연결하세요.",
      ],
      [
        "감마 카스",
        "γ Cas",
        "중앙의 틈",
        275,
        "가운데를 비워 둔 경유선의 리턴을 확인하세요.",
      ],
      [
        "루크바",
        "δ Cas",
        "뒤집힌 W",
        285,
        "좌·우 전환 중 무엇을 남길지 판단하세요.",
      ],
      [
        "세긴",
        "ε Cas",
        "다섯 번째 점",
        295,
        "패링 실패 없이 다섯 발의 경로를 완주하세요.",
      ],
    ],
  },
  {
    id: "cygnus",
    stages: [
      [
        "데네브",
        "α Cyg",
        "긴 날개",
        300,
        "먼 별지기까지 닿는 첫 경로를 만드세요.",
      ],
      [
        "사드르",
        "γ Cyg",
        "교차점",
        305,
        "두 패링의 접점을 한 샷에 이어 보세요.",
      ],
      [
        "중앙 깃",
        "δ Cyg",
        "흐르는 선",
        310,
        "멈추지 않는 유성에서 다음 충돌을 예측하세요.",
      ],
      [
        "남쪽 날개",
        "ε Cyg",
        "백조의 턴",
        315,
        "조향 한 번으로 안전한 귀환선을 만드세요.",
      ],
      [
        "알비레오",
        "β Cyg",
        "두 빛의 끝",
        320,
        "별자리 후보를 남긴 채 보스 진입을 결정하세요.",
      ],
    ],
  },
  {
    id: "orion",
    stages: [
      [
        "베텔게우스",
        "α Ori",
        "어깨의 불꽃",
        325,
        "첫 샷에서 다음 샷의 자리를 확보하세요.",
      ],
      [
        "벨라트릭스",
        "γ Ori",
        "반대 어깨",
        330,
        "두 방향의 공명 중 더 긴 경로를 선택하세요.",
      ],
      [
        "알니타크",
        "ζ Ori",
        "허리의 시작",
        335,
        "패링과 조향의 사용 순서를 맞추세요.",
      ],
      [
        "알니람",
        "ε Ori",
        "허리의 중심",
        340,
        "세 접점으로 별자리 발동을 노리세요.",
      ],
      [
        "민타카",
        "δ Ori",
        "허리의 끝",
        345,
        "보스 앞에서 유성의 운동량을 보존하세요.",
      ],
      [
        "리겔",
        "β Ori",
        "사냥의 발",
        350,
        "다섯 발 전체를 쓰는 안정적인 경로를 완성하세요.",
      ],
    ],
  },
  {
    id: "ursa",
    stages: [
      [
        "두베",
        "α UMa",
        "국자의 시작",
        350,
        "마지막 월드의 첫 경유선을 세우세요.",
      ],
      [
        "메라크",
        "β UMa",
        "깊은 물",
        355,
        "패링 뒤의 유성 방향을 끝까지 읽으세요.",
      ],
      [
        "페크다",
        "γ UMa",
        "굽은 손잡이",
        360,
        "별지기 둘을 거쳐 보스에 닿으세요.",
      ],
      [
        "메그레즈",
        "δ UMa",
        "국자의 목",
        365,
        "별자리 노드와 직접 피해의 우선순위를 고르세요.",
      ],
      [
        "알리오트",
        "ε UMa",
        "기울어진 빛",
        370,
        "조향 1회를 가장 가치 있는 접점에 쓰세요.",
      ],
      [
        "미자르",
        "ζ UMa",
        "두 별의 선",
        375,
        "짧은 패링 창을 놓치지 않고 연쇄하세요.",
      ],
      [
        "알카이드",
        "η UMa",
        "마지막 꼭짓점",
        380,
        "모은 모든 경로 판단으로 거상을 끝내세요.",
      ],
    ],
  },
  // 여덟 번째 월드는 스테이지가 하나뿐이고 별자리를 잇지 않는다. 앞의 34개
  // 뒤에 붙으므로 기존 순차 해금(`progress.clears`)이 그대로 7-7 클리어를
  // 조건으로 만든다. 저장 형식은 바뀌지 않는다.
  {
    id: "outside",
    stages: [
      [
        "관측되지 않은 점",
        "∅",
        "성도 밖",
        1600,
        "이름 없는 좌표가 관측을 기다립니다. 이미 이쪽을 보고 있습니다.",
        {
          // 네 명이 서는 유일한 캠페인 전장.
          layout: {
            slots: [
              [170, 556],
              [550, 556],
              [268, 458],
              [452, 458],
            ],
            boss: [360, 214],
          },
          // 체력 70/40/15%에서 형태만 바뀐다. `form`은 `runStagePhase`가
          // 모르는 값이라 전투에 아무 효과도 주지 않고, `stagePhases.fired`만
          // 올라가 보스 아트의 페이즈 인자가 된다. 전투 룰은 그대로다.
          gimmicks: { phases: { at: [0.7, 0.4, 0.15], effect: "form" } },
        },
      ],
    ],
  },
];
function stagePreview(slots) {
  return slots.map(([x, y]) => [
    Number(((x / W) * 100).toFixed(1)),
    Number(((y / H) * 100).toFixed(1)),
  ]);
}
function buildCampaignStages() {
  let campaignIndex = 0;
  return CAMPAIGN_WORLD_PLANS.flatMap((world, worldIndex) =>
    world.stages.map(
      (
        [
          starName,
          bayer,
          subtitle,
          bossHp,
          terrain,
          // `layout` and `gimmicks` exist for the single stage that cannot use
          // the shared three-slot rotation. Every other stage omits them, so
          // the 34 campaign layouts keep their exact previous assignment.
          { guideStarCharges = 0, gimmicks = {}, layout: layoutOverride } = {},
        ],
        stageIndex,
      ) => {
        const layout =
          layoutOverride ??
          CAMPAIGN_LAYOUTS[campaignIndex % CAMPAIGN_LAYOUTS.length];
        campaignIndex += 1;
        return {
          id: worldIndex + 1 + "-" + (stageIndex + 1),
          world: world.id,
          star: { name: starName, bayer },
          name: starName + " · " + subtitle,
          terrain,
          slots: layout.slots.map(([x, y]) => [x, y]),
          preview: stagePreview(layout.slots),
          boss: { x: layout.boss[0], y: layout.boss[1] },
          bossHp,
          guideStarCharges,
          labels: ["좌측 항로", "우측 항로", "중앙 항로"],
          bumpers: [],
          gimmicks,
          tutorial: worldIndex === 0 && stageIndex === 0,
          /* 지형 세트는 월드를 따라간다. 통산 번호 기준이던 예전 값은
             한 월드 안에서 스테이지마다 지형이 바뀌고(큰곰자리는 다섯 세트를
             두 바퀴 돌았다) 월드끼리는 같은 세트가 반복됐다 — 월드가 바뀐 것이
             화면에 드러나지 않던 원인이다. 세트가 다섯이라 월드 여덟 중 셋은
             짝을 공유한다. 전용 세트는 `ASSET_BACKLOG.md` 항목이다. */
          art: worldIndex % 5,
        };
      },
    ),
  );
}
const stages = [...buildCampaignStages(), TRAINING_STAGE];

// Campaign order is the flat stage order minus the training table, and one
// clear opens the next star.  `progress.clears` is the only save field this
// needs, so no migration is required for players already part way in.
const campaignStages = stages.filter((stage) => !stage.training);
function worldOf(stage) {
  return WORLDS.find((world) => world.id === stage?.world) ?? null;
}
// Every campaign colossus is the same void colossus except the stage 8-1
// occupant, which is deliberately never named. That stage shows its coordinate
// instead, so no screen has to claim a name the story has not given yet.
/* 월드마다 다른 몸을 그리면서 이름만 전부 「공허 거상」이면 화면과 글이
   어긋난다. 공허 거상은 종족 이름으로 남기고 폴백으로만 쓴다.
   8-1은 끝까지 이름을 주지 않기로 했으므로 좌표를 쓴다. */
function bossDisplayName(stage = currentStage()) {
  if (!stage) return "공허 거상";
  if (stage.world === "outside") return stage.star.name;
  if (stage.training) return "불멸의 허수아비";
  // 1-1 수업의 상대는 최종 보스와 같은 몸이라 이름도 그쪽을 따른다.
  if (isTutorialOuterObserver(stage)) return outsideStarName();
  return WORLD_BOSS[stage.world]?.name ?? "공허 거상";
}
// 8-1의 별 이름. 수업이 같은 상대를 부를 때 표기가 갈리지 않게 한 곳에서 읽는다.
function outsideStarName() {
  return (
    campaignStages.find((entry) => entry.world === "outside")?.star.name ??
    "관측되지 않은 점"
  );
}
/* 1-1 수업의 상대를 최종 보스와 같은 개체로 둔다. 프롤로그에서 창밖을
   지나간 것이 첫 수업의 상대이고, 34스테이지 뒤 8-1에서 다시 만난다.
   수업 중에는 불멸이라 해칠 수 없고, 마지막 수업만 실제로 눕힌다 —
   그 화면은 「무너뜨렸다」가 아니라 「첫 관측자의 증명」 업적을 띄운다. */
function isTutorialOuterObserver(stage = currentStage()) {
  return Boolean(
    stage?.tutorial && StellaRuntime.modules.optional("onboarding")?.isActive(),
  );
}
function campaignIndexOf(stage) {
  return campaignStages.indexOf(stage);
}
function worldStages(worldId) {
  return campaignStages.filter((stage) => stage.world === worldId);
}
// One place names a stage's gimmicks, so the hub map, the mission bar and the
// library never drift apart on what a stage actually contains.
function stageGimmickLabels(stage) {
  const g = stage?.gimmicks ?? {};
  return [
    stage?.bumpers?.length && "공명 범퍼 ×" + stage.bumpers.length,
    stage?.guideStarCharges && "관측 잔광 ×" + stage.guideStarCharges,
    g.walls?.length && "반사 벽 ×" + g.walls.length,
    g.boostPads?.length && "가속 발판 ×" + g.boostPads.length,
    g.dragPads?.length && "흐린 발판 ×" + g.dragPads.length,
    g.adds?.length && "공허 잔재 ×" + g.adds.length,
    g.orbits?.length && "도는 방벽 ×" + g.orbits.length,
    g.shield && "굳은 껍질 " + g.shield.hits + "겹",
    g.phases &&
      (g.phases.effect === "push"
        ? "페이즈 · 모서리 밀어내기"
        : g.phases.effect === "sleep"
          ? "페이즈 · 재수면 " + (g.phases.wakeNeed ?? 2) + "회"
          : "페이즈 · 형태 변화 " + g.phases.at.length + "단"),
  ].filter(Boolean);
}

function setupStageGimmicks(stage) {
  const gimmicks = stage.gimmicks ?? {};
  stageWalls = (gimmicks.walls ?? []).map((wall, index) => ({
    id: wall.id ?? "wall-" + index,
    x: wall.x,
    y: wall.y,
    w: wall.w ?? 96,
    h: wall.h ?? 18,
    restitution: wall.restitution ?? 1.01,
    on: 0,
  }));
  boostPads = (gimmicks.boostPads ?? []).map((pad, index) => ({
    id: pad.id ?? "boost-" + index,
    x: pad.x,
    y: pad.y,
    w: pad.w ?? 140,
    h: pad.h ?? 34,
    boost: pad.boost ?? 260,
    maxSpeed: pad.maxSpeed ?? 1900,
    on: 0,
  }));
  adds = (gimmicks.adds ?? []).map((add, index) => {
    const hp = add.hp ?? 48;
    return {
      id: add.id ?? "add-" + index,
      x: add.x,
      y: add.y,
      r: add.r ?? 23,
      hp,
      maxHp: hp,
      down: 0,
      frozen: 0,
      hitCooldown: 0,
    };
  });
  // Fading pads are the mirror of boost pads: same rectangle test, but they
  // take constellation multiplier away instead of adding speed.
  dragPads = (gimmicks.dragPads ?? []).map((pad, index) => ({
    id: pad.id ?? "drag-" + index,
    x: pad.x,
    y: pad.y,
    w: pad.w ?? 150,
    h: pad.h ?? 38,
    drop: pad.drop ?? 0.5,
    on: 0,
  }));
  // Barriers with health that circle the colossus.  `a` is the live angle;
  // `phase` only seeds it so two barriers can start opposite each other.
  orbitals = (gimmicks.orbits ?? []).map((orbit, index) => {
    const hp = orbit.hp ?? 70;
    return {
      id: orbit.id ?? "orbit-" + index,
      radius: orbit.r ?? 130,
      speed: orbit.speed ?? 1,
      a: orbit.phase ?? 0,
      r: orbit.size ?? 26,
      x: stage.boss.x,
      y: stage.boss.y,
      hp,
      maxHp: hp,
      down: 0,
      hitCooldown: 0,
    };
  });
  bossShield = gimmicks.shield
    ? {
        hits: gimmicks.shield.hits ?? 3,
        max: gimmicks.shield.hits ?? 3,
        flash: 0,
      }
    : null;
  // Phase rules fire once each time the colossus drops past a health ratio.
  stagePhases = gimmicks.phases
    ? {
        at: [...(gimmicks.phases.at ?? [])],
        effect: gimmicks.phases.effect ?? "push",
        wakeNeed: gimmicks.phases.wakeNeed ?? 2,
        fired: 0,
      }
    : null;
}
const bossArt = {
  sprite: "../assets/library/boss2/void-colossus.png",
  fw: 384,
  fh: 384,
  frames: 1,
  scale: 0.48,
  sheetFrame: 384,
  animations: {
    idle: "../assets/library/anim/boss2/void-colossus-idle.png",
    hit: "../assets/library/anim/boss2/void-colossus-hit.png",
  },
};
/* --- the boss pack --------------------------------------------------------
 * Ten colossi, one per constellation world plus three specials, all sharing
 * the frame contract above so `loadSpec` needs no new case.  The art and the
 * two generator scripts came in together; `node scripts/generate_boss_pack_10.mjs`
 * rebuilds all sixty files from `scripts/boss-pack-core.js`, which is the
 * single source for the dot definitions — edit that and regenerate rather
 * than touching a PNG.
 *
 * `weakCount` is recorded here because the pack ships a gem sheet per boss
 * drawn for that many weak points.  Nothing reads it yet: the rule that a
 * multi-gem boss discounts body damage until its gems are broken is not
 * implemented, and neither are the attack and death states, which have sheets
 * but no state selection in `game-core-render.js`.  The data is here so that
 * work has something to attach to; see the guide's §5.
 */
const BOSS_PACK_SPEC = {
  fw: 384,
  fh: 384,
  frames: 1,
  scale: 0.48,
  sheetFrame: 384,
};
const bossPack = {
  "aries-horngate": { weakCount: 1, tier: "void" },
  "sagitta-archon": { weakCount: 2, tier: "teal" },
  "corvus-swarm": { weakCount: 3, tier: "void" },
  "cassiopeia-throne": { weakCount: 2, tier: "apricot" },
  "cygnus-drifter": { weakCount: 1, tier: "pale" },
  "orion-hunter": { weakCount: 3, tier: "apricot" },
  "dipper-crawler": { weakCount: 4, tier: "teal" },
  "training-effigy": { weakCount: 1, tier: "pale" },
  "pentacle-core": { weakCount: 5, tier: "void" },
  "erosion-warden": { weakCount: 2, tier: "teal" },
};
/* 팩의 슬러그는 이미 월드 이름으로 지어져 있어 배정이 자명하다. 북두칠성은
   Big Dipper라 `dipper-crawler`가 그 자리다. 8-1은 여백과 전장을 같은 절차적
   코드로 그리므로 여기 없다 — 이 표는 래스터 보스만 다룬다. */
const WORLD_BOSS = Object.freeze({
  aries: { slug: "aries-horngate", name: "뿔문의 거상" },
  sagitta: { slug: "sagitta-archon", name: "화살의 집정관" },
  corvus: { slug: "corvus-swarm", name: "까마귀 군체" },
  cass: { slug: "cassiopeia-throne", name: "기울어진 왕좌" },
  cygnus: { slug: "cygnus-drifter", name: "백조자리 표류자" },
  orion: { slug: "orion-hunter", name: "사냥꾼의 잔영" },
  ursa: { slug: "dipper-crawler", name: "국자를 끄는 것" },
});
/* 스테이지가 실제로 그릴 보스. 훈련장은 전용 허수아비를 쓰고, 표에 없는
   월드는 기존 공허 거상으로 떨어진다. 1-1 수업도 양자리라 같은 보스를
   보게 되므로, 수업에서 만난 적과 캠페인 첫 판의 적이 어긋나지 않는다. */
function stageBossArt(stage) {
  const target = stage ?? currentStage();
  if (!target) return bossArt;
  if (target.training) return bossArtFor("training-effigy");
  const entry = WORLD_BOSS[target.world];
  return entry ? bossArtFor(entry.slug) : bossArt;
}
// Memoised by slug: draw() calls stageBossArt() -> bossArtFor() inline in its
// drawFrame arguments every frame, and each miss allocated the merged spec, the
// nested animations object and six fresh template strings. The pack is a fixed
// seven-entry table and the specs are immutable, so one object per slug for the
// session is enough - and the paths become interned, so the texture cache can
// compare keys by pointer instead of hashing a new string each frame.
const bossArtSpecs = new Map();
function bossArtFor(slug) {
  const cached = bossArtSpecs.get(slug);
  if (cached) return cached;
  const spec = buildBossArtSpec(slug);
  bossArtSpecs.set(slug, spec);
  return spec;
}
function buildBossArtSpec(slug) {
  const meta = bossPack[slug];
  // Falls back to the void colossus rather than throwing, so a stage naming a
  // boss that does not exist yet still opens.
  if (!meta) return bossArt;
  return Object.assign({}, BOSS_PACK_SPEC, {
    slug,
    sprite: `../assets/library/boss10/${slug}.png`,
    weak: `../assets/library/boss10/${slug}-weakgem.png`,
    weakCount: meta.weakCount,
    tier: meta.tier,
    animations: {
      idle: `../assets/library/anim/boss10/${slug}-idle.png`,
      hit: `../assets/library/anim/boss10/${slug}-hit.png`,
      attack: `../assets/library/anim/boss10/${slug}-attack.png`,
      death: `../assets/library/anim/boss10/${slug}-death.png`,
    },
  });
}
const staticArt = {
  orb: "../assets/original/prism-orb.svg",
  weak: "../assets/library/boss2/void-colossus-weakgem.png",
  rock1: "../assets/terrain/rock-01.png",
  rock4: "../assets/terrain/rock-04.png",
  wispIdle: "../assets/enemies/void-wisp-idle.png",
  wispHit: "../assets/enemies/void-wisp-hit.png",
};
// Existing pixel FX are intentionally reused in the combat pass.  They give
// high-value events a recognizable silhouette instead of another coloured ring.
const feedbackArt = {
  impact: "../assets/library/fx/prism-impact.png",
  shockwave: "../assets/library/fx/rune-shockwave.png",
  comet: "../assets/library/fx/prism-comet.png",
  electric: "../assets/fx/electric-ring.png",
  burst: "../assets/library/fx/prism-impact.png",
  corebreak: "../assets/library/fx/core-break-signature-512.png",
  critStar: "../assets/library/restyle/fx/crit-star.png",
};
// The art table is smaller than the stage list on purpose: stages share
// terrain sets rather than each shipping its own.  A stage can name a set with
// `art`; otherwise it falls back instead of throwing when the campaign grows.
function stageArtFor(index = stageIndex) {
  const table = libraryArt.stages,
    named = stages[index]?.art;
  if (named != null && table[named]) return table[named];
  return table[index] ?? table[index % table.length] ?? table[0];
}
const libraryArt = {
  stages: [
    {
      tile: "../assets/library/stages/tile-corridor.png",
      emblem: "../assets/library/stages/emblem-corridor.png",
      frame: [
        "../assets/library/arena-frames/corridor-edge-h.png",
        "../assets/library/arena-frames/corridor-edge-v.png",
        "../assets/library/arena-frames/corridor-corner.png",
      ],
      props: [
        ["../assets/library/props/rune-pillar.png", 82, 642, 58],
        ["../assets/library/props/void-lantern.png", 638, 570, 40],
      ],
    },
    {
      tile: "../assets/library/stages/tile-corridor.png",
      emblem: "../assets/library/stages/emblem-corridor.png",
      frame: [
        "../assets/library/arena-frames/corridor-edge-h.png",
        "../assets/library/arena-frames/corridor-edge-v.png",
        "../assets/library/arena-frames/corridor-corner.png",
      ],
      props: [
        ["../assets/library/props/rune-pillar.png", 82, 642, 58],
        ["../assets/library/props/void-lantern.png", 638, 570, 40],
      ],
    },
    {
      tile: "../assets/library/stages/tile-stairs.png",
      emblem: "../assets/library/stages/emblem-stairs.png",
      frame: [
        "../assets/library/arena-frames/stairs-edge-h.png",
        "../assets/library/arena-frames/stairs-edge-v.png",
        "../assets/library/arena-frames/stairs-corner.png",
      ],
      props: [
        ["../assets/library/props/void-lantern.png", 94, 540, 42],
        ["../assets/library/props/crystal-spire.png", 622, 388, 56],
      ],
    },
    {
      tile: "../assets/library/stages/tile-garden.png",
      emblem: "../assets/library/stages/emblem-garden.png",
      frame: [
        "../assets/library/arena-frames/garden-edge-h.png",
        "../assets/library/arena-frames/garden-edge-v.png",
        "../assets/library/arena-frames/garden-corner.png",
      ],
      props: [
        ["../assets/library/props/crystal-spire.png", 104, 420, 56],
        ["../assets/library/props/void-portal.png", 616, 538, 58],
      ],
    },
    {
      tile: "../assets/library/stages/tile-corridor.png",
      emblem: "../assets/library/stages/emblem-corridor.png",
      frame: [
        "../assets/library/arena-frames/corridor-edge-h.png",
        "../assets/library/arena-frames/corridor-edge-v.png",
        "../assets/library/arena-frames/corridor-corner.png",
      ],
      props: [
        ["../assets/library/props/void-lantern.png", 84, 616, 44],
        ["../assets/library/props/crystal-spire.png", 636, 456, 50],
      ],
    },
  ],
  tutorial: {
    drag: "../assets/library/tutorial/hint-drag-shot.png",
    gaugeFrame: "../assets/library/tutorial/power-gauge-frame.png",
    gaugeFill: "../assets/library/tutorial/power-gauge-fill.png",
  },
  projectile: {
    charged: "../assets/library/projectiles/charged-orb.png",
    homing: "../assets/library/projectiles/homing-orb.png",
    marked: "../assets/library/projectiles/marked-orb.png",
    support: "../assets/library/projectiles/support-bolt.png",
  },
  result: {
    clear: "../assets/library/results/medal-clear.png",
    sharp: "../assets/library/results/medal-sharp.png",
    flawless: "../assets/library/results/medal-flawless.png",
    time: "../assets/library/results/metric-time.png",
    shots: "../assets/library/results/metric-shots.png",
    damage: "../assets/library/results/metric-damage.png",
  },
  cutin: {
    win: "../assets/library/cutin/win-backplate.png",
    fail: "../assets/library/cutin/fail-backplate.png",
  },
};
const metaArt = {
  wordmark: "../assets/original/stella-ball-wordmark.svg",
  /* 「별빛 점화」 타이틀 (INTRO_REDESIGN_HANDOFF.md §2-2·§3). 도트 워드마크는
     8px 유닛 5×7 비트맵이라 정수 배율로만 키워야 뭉개지지 않는다. */
  wordmarkDot: "../assets/redesign/wordmark-stella-dot.png",
  keyartObservatory: "../assets/redesign/keyart-observatory.png",
  luna: "../assets/library/guide/luna-portrait.png",
  daily: "../assets/library/record/daily-challenge-badge.png",
  play: "../assets/library/system/icon-play.png",
  home: "../assets/library/system/icon-home.png",
  help: "../assets/library/system/icon-help.png",
  mouse: "../assets/library/input/mouse-left.png",
  touch: "../assets/library/input/touch-drag.png",
  keyR: "../assets/library/input/keycap-r.png",
};
const runeStone = (id) =>
  ["gaon", "biyeon", "lumi", "haru", "sera", "taeo", "nyx"].includes(id)
    ? "../assets/library/runes/rune-stone-" + id + ".png"
    : heroes[id].sprite;
const textures = {};
function loadTexture(path) {
  if (!path) return null;
  if (!textures[path]) {
    const im = new Image();
    im.decoding = "async";
    im.src = path;
    // Starting a decode now keeps the first collision/cut-in from paying image
    // decode plus texture upload in the impact frame. decode() waits for the
    // network load itself and failure still falls through to the old fallback.
    const decode = im.decode?.();
    decode?.catch?.(() => {});
    textures[path] = im;
  }
  return textures[path];
}
function loadSpec(spec) {
  loadTexture(spec.sprite);
  for (const path of Object.values(spec.animations ?? {})) loadTexture(path);
}
/* `stage`는 전투 진입 때만 넘어온다. 이 함수는 모듈 로드 시점에도 한 번
   불리는데, 그때는 `currentStage`가 아직 초기화 전이라 스스로 알아낼 수 없다. */
function primeCombatTextures(stage = null) {
  loadSpec(bossArt);
  // 지금 들어갈 판의 보스도 함께 읽는다. 기본값만 예열하면 월드 보스가
  // 첫 프레임에 비어 폴백 원으로 한 번 깜빡인다.
  const staged = stage ? stageBossArt(stage) : bossArt;
  if (staged !== bossArt) loadSpec(staged);
  for (const path of [
    ...Object.values(staticArt),
    ...Object.values(feedbackArt),
  ])
    loadTexture(path);
  for (const path of Object.values(abilityFx)) loadTexture(path);
  for (const path of Object.values(abilityFxSheets)) loadTexture(path);
  // `tile` / `frame` / `props` stopped reaching the arena when the floor became
  // procedural, so priming them only slowed the first entry.  `emblem` stays,
  // because the hub cards still read it through `stageArtFor()`.
  for (const path of [
    ...Object.values(libraryArt.tutorial),
    ...Object.values(libraryArt.projectile),
  ])
    loadTexture(path);
  for (const id of deployed) loadSpec(heroes[id]);
}
let selected = [],
  deployed = [],
  stageIndex = 0,
  placementPick = null;
let build,
  ball,
  boss,
  gates = [],
  bumpers = [],
  stageWalls = [],
  boostPads = [],
  adds = [],
  areaBursts = [],
  battle,
  drag = null,
  /* 별빛 조준(2026-08-18). 패링과 안내별이 남긴 점이 판에 머무르고, 그중 셋을
     순서대로 골라 다음 유성을 쏜다 — 방향은 세 점의 «무게중심», 세기는 세 점이
     이루는 삼각형의 «크기»다.
     연속 조준을 버리는 것이 목적이다. 실측(BOT_REPORT 0-11)으로 조준을 0.25도
     — 마우스 두세 픽셀 — 만 움직여도 그 판의 피해가 40% 널뛴다. 그 지형 위에서는
     아무리 정밀하게 겨눠도 실력이 되지 않는다. 고를 수 있는 방향을 유한한
     «선택지»로 바꾸면 「거의 맞췄는데 빗나감」이 존재하지 않는다.
     점이 셋 미만이면 예전 드래그 조준으로 떨어진다 — 튜토리얼과 온보딩 E2E가
     드래그를 쓰므로 그 경로는 살아 있어야 한다. */
  aimStars = [],
  aimPick = [],
  // 마우스가 올라간 별빛. 셋째를 «찍는 순간» 발사되므로, 그 전에 무엇이
  // 나올지 보여주려면 후보를 알아야 한다.
  aimHover = -1,
  // 발사 순간의 수렴 연출. 고른 노드에서 무게중심으로 빛이 모여드는 한 박자 -
  // 조준 화면(drawAimStars)은 유성이 구르면 꺼지므로 따로 산다.
  aimLaunchFx = null,
  // 하한 미달 Space의 거절 연출 타이머. HUD 카운트가 잠깐 붉게 흔들린다.
  aimDenyT = 0,
  // 셋째 노드를 찍어 «조준이 성립한» 순간의 플래시. 조준선이 한 박자 빛난다.
  aimReadyFlash = 0,
  run = false,
  chain = [],
  popups = [],
  assistShots = [],
  fieldFx = [],
  dragPads = [],
  orbitals = [],
  bossShield = null,
  stagePhases = null,
  // 포효 연출 상태. 그리기 쪽이 파형을 읽고, 물리 쪽이 밀림을 진행한다.
  bossRoar = null,
  /* 전투 입장·퇴장 연출(디자인 세션 §8·§11). setupBattle이 지금 하는 일은
     값을 채우고 화면을 켜는 것뿐이라, 첫 프레임에 모든 것이 이미 제자리에
     완성돼 있었다 — 등장이라는 개념 자체가 없었다. */
  battleIntro = null,
  bossOutro = null,
  frameClock = 0,
  last = 0,
  lastRafFrame = 0,
  nextPresentedFrame = 0,
  fastRafSamples = 0,
  toastTimer = 0,
  currentToastText = "",
  impactStop = 0,
  screenShake = 0,
  // 방향 어휘 셋(디자인 세션 §4). 밀림·기울기·잔상.
  screenPushX = 0,
  screenPushY = 0,
  screenTilt = 0,
  screenGhost = 0,
  screenFlash = 0,
  hitCombo = 0,
  comboTimer = 0,
  comboPulse = 0,
  battleSerial = 0,
  battleComplete = false,
  msg = "파티를 편성하세요.",
  flippers = { left: 0, right: 0 };

// Canvas shadowBlur re-rasterizes every affected primitive and measured 83 ms
// impact frames even on the real Chromium probe. The same scene without that
// kernel stayed below 17 ms. Geometry, colour, additive rings and flashes carry
// the bloom vocabulary without making collisions depend on GPU acceleration.
function combatFxBlur(_amount) {
  return 0;
}
function setCombatFont(context, font) {
  if (context.font !== font) context.font = font;
}
function safeVibrate(pattern) {
  if (
    typeof navigator === "undefined" ||
    typeof navigator.vibrate !== "function" ||
    (navigator.userActivation && !navigator.userActivation.hasBeenActive)
  )
    return false;
  try {
    return navigator.vibrate(pattern);
  } catch {
    return false;
  }
}

// Short-lived combat arrays are updated every frame. Compacting them in place
// avoids new arrays and garbage-collection hitches during busy combos.
function advanceTimed(items, delta) {
  let write = 0;
  for (let index = 0; index < items.length; index++) {
    const item = items[index];
    item.t += delta;
    if (item.t < item.d) items[write++] = item;
  }
  items.length = write;
}

primeCombatTextures();
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const currentStage = () => stages[stageIndex];
