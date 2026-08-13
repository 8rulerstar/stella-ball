/* Stella Ball — 보스 에셋 10종 절차 생성 코어 (2026-08-13)
 *
 * 이 파일은 렌더 호스트를 모른다. 48유닛 좌표계로 정의된 보스 파츠를
 * 96×96 셀 격자(셀 4px = 384×384 프레임)로 래스터화해 셀 배열만 돌려준다.
 * PNG 인코딩은 호스트가 한다 (scripts/generate_boss_pack_10.mjs = node,
 * 갤러리 DC = canvas).
 *
 * 좌표 규약
 *   - 논리 공간 48×48, 중심 x=24, 접지선 y=44
 *   - 셀 격자 96×96 (1유닛 = 2셀), 프레임 384×384 (셀 4px)
 *   - 약점 젬 시트만 64×64 셀 = 256×256 (기존 void-colossus-weakgem.png와 동일)
 *
 * 상태는 idle / hit / attack / death 4종, 각 4프레임 가로 시트.
 */
(function () {
  const GRID = 48; // 논리 유닛
  const N = 96; // 셀
  let SUB = N / GRID; // 유닛당 셀 (젬 시트를 구울 때만 일시적으로 바뀐다)
  const GEM_N = 64;

  /* ---- 팔레트 계층 4종. UI_KIT_DAWN.md 팔레트와 기존 공허 보스 램프 기준 ---- */
  const TIERS = {
    void: {
      label: "공허 보라",
      o: "#170c28",
      d: "#2a1a4a",
      m: "#4b3184",
      l: "#7d63c4",
      h: "#b9a6ef",
      core: "#e340e8",
      coreHi: "#ffd9ff",
    },
    teal: {
      label: "관측 청록",
      o: "#041014",
      d: "#0e2a2e",
      m: "#1f5257",
      l: "#47837c",
      h: "#7cc6bb",
      core: "#2fd6b8",
      coreHi: "#d8fff4",
    },
    apricot: {
      label: "여명 살구",
      o: "#14100e",
      d: "#262223",
      m: "#46403d",
      l: "#eea56f",
      h: "#ffd2a0",
      core: "#ff9a2e",
      coreHi: "#ffe9b8",
    },
    pale: {
      label: "창백 달빛",
      o: "#161822",
      d: "#2c2e3e",
      m: "#4a4d63",
      l: "#b3b7cc",
      h: "#f3ede2",
      core: "#5fb8f0",
      coreHi: "#e2f6ff",
    },
  };

  /* ---- 색 보간: hit 플래시와 death 페이드에 쓴다 ---- */
  function mix(a, b, t) {
    if (t <= 0) return a;
    if (t >= 1) return b;
    const pa = parseInt(a.slice(1), 16),
      pb = parseInt(b.slice(1), 16);
    const r = Math.round((((pa >> 16) & 255) * (1 - t) + ((pb >> 16) & 255) * t) | 0);
    const g = Math.round((((pa >> 8) & 255) * (1 - t) + ((pb >> 8) & 255) * t) | 0);
    const bl = Math.round(((pa & 255) * (1 - t) + (pb & 255) * t) | 0);
    return "#" + ((1 << 24) | (r << 16) | (g << 8) | bl).toString(16).slice(1);
  }

  /* ---- 파츠 헬퍼: 논리 좌표만 받는다 ---- */
  const rect = (x, y, w, h, o) => Object.assign({ k: "rect", x, y, w, h }, o);
  const dia = (cx, cy, rx, ry, o) => Object.assign({ k: "dia", cx, cy, rx, ry }, o);
  const circ = (cx, cy, r, o) => Object.assign({ k: "circ", cx, cy, r }, o);
  const ring = (cx, cy, r, t, o) => Object.assign({ k: "ring", cx, cy, r, t }, o);
  const tri = (cx, cy, w, h, dir, o) => Object.assign({ k: "tri", cx, cy, w, h, dir }, o);
  const star = (cx, cy, rx, ry, o) => Object.assign({ k: "star", cx, cy, rx, ry }, o);
  const shadow = (cx, rx, ry) => dia(cx, 44.5, rx, ry, { mv: "shadow", role: "shadow" });
  const core = (cx, cy, r) => star(cx, cy, r, r, { mv: "core", role: "core" });
  const weak = (cx, cy) => dia(cx, cy, 2.2, 2.8, { mv: "core", role: "weak" });

  /* ---- 보스 10종. 월드 순서 = 캠페인 별자리 순서 ---- */
  const BOSSES = [
    {
      slug: "aries-horngate",
      name: "각석 문지기",
      world: "양자리 (3점)",
      tier: "void",
      weakCount: 1,
      brief: "뿔이 달린 문형 구조물. 아치 중앙의 단일 핵만 유효타.",
      parts: [
        shadow(24, 14, 2.6),
        rect(8.5, 17, 7, 27, { mv: "body", seam: 1 }),
        rect(32.5, 17, 7, 27, { mv: "body", seam: 1 }),
        rect(6.5, 10, 35, 8, { mv: "body", seam: 1 }),
        dia(9.5, 9, 3, 4.5, { mv: "float", lit: 1 }),
        dia(38.5, 9, 3, 4.5, { mv: "float", lit: 1 }),
        ring(24, 27, 8.5, 0.8, { mv: "body", role: "glow" }),
        core(24, 27, 5),
        weak(24, 27),
      ],
    },
    {
      slug: "sagitta-archon",
      name: "관통 사수",
      world: "화살자리 (4점)",
      tier: "teal",
      weakCount: 2,
      brief: "회전 파편 3기와 고정 화살대. 위아래 두 접합부가 약점.",
      parts: [
        shadow(24, 10, 2.2),
        rect(23, 4, 2, 13, { mv: "body", lit: 1 }),
        tri(24, 3, 6, 5, "up", { mv: "body", lit: 1 }),
        tri(24, 40, 5, 4, "down", { mv: "body" }),
        ring(24, 24, 12.5, 0.8, { mv: "body", role: "glow" }),
        circ(24, 24, 7.5, { mv: "body", seam: 1 }),
        dia(24, 24, 3.4, 4.6, { mv: "orbit", orb: { r: 13, a: 0 }, lit: 1 }),
        dia(24, 24, 3.4, 4.6, { mv: "orbit", orb: { r: 13, a: 120 }, lit: 1 }),
        dia(24, 24, 3.4, 4.6, { mv: "orbit", orb: { r: 13, a: 240 }, lit: 1 }),
        core(24, 24, 4.4),
        weak(24, 15.5),
        weak(24, 32.5),
      ],
    },
    {
      slug: "corvus-swarm",
      name: "까마귀 군체",
      world: "까마귀자리 (4점)",
      tier: "void",
      weakCount: 3,
      brief: "머리 여럿이 한 몸을 공유한다. 세 머리를 모두 깨야 한다.",
      parts: [
        shadow(24, 15, 2.8),
        circ(24, 33, 8.5, { mv: "body", seam: 1 }),
        circ(13, 28, 6, { mv: "limbL", seam: 1 }),
        circ(35, 28, 6, { mv: "limbR", seam: 1 }),
        tri(6.5, 28, 5, 4, "left", { mv: "limbL", lit: 1 }),
        tri(41.5, 28, 5, 4, "right", { mv: "limbR", lit: 1 }),
        circ(17, 17, 5.5, { mv: "float", seam: 1 }),
        circ(31, 15, 5.5, { mv: "float", seam: 1 }),
        tri(17, 11, 4, 4, "up", { mv: "float", lit: 1 }),
        tri(31, 9, 4, 4, "up", { mv: "float", lit: 1 }),
        core(24, 33, 4),
        weak(17, 17),
        weak(31, 15),
        weak(24, 33),
      ],
    },
    {
      slug: "cassiopeia-throne",
      name: "왕좌 파수",
      world: "카시오페이아 (5점)",
      tier: "apricot",
      weakCount: 2,
      brief: "다섯 첨탑이 얹힌 왕좌. 등받이 핵과 좌대 핵이 따로 있다.",
      parts: [
        shadow(24, 15, 2.6),
        rect(9, 36, 30, 8, { mv: "body", seam: 1 }),
        rect(12, 28, 24, 8, { mv: "body" }),
        rect(16, 8, 16, 20, { mv: "body", seam: 1 }),
        rect(6.5, 26, 6, 7, { mv: "limbL", mid: 1 }),
        rect(35.5, 26, 6, 7, { mv: "limbR", mid: 1 }),
        rect(15.5, 3.5, 3, 6, { mv: "float", lit: 1 }),
        rect(19.5, 5.5, 3, 4, { mv: "float", lit: 1 }),
        rect(23.5, 2, 3, 7.5, { mv: "float", lit: 1 }),
        rect(27.5, 5.5, 3, 4, { mv: "float", lit: 1 }),
        rect(31.5, 4, 3, 5.5, { mv: "float", lit: 1 }),
        core(24, 19, 4.4),
        core(24, 31, 3.2),
        weak(24, 19),
        weak(24, 31),
      ],
    },
    {
      slug: "cygnus-drifter",
      name: "백조 부유체",
      world: "백조자리 (5점)",
      tier: "pale",
      weakCount: 1,
      brief: "접지하지 않는다. 세 겹 날개가 열릴 때 핵이 드러난다.",
      parts: [
        shadow(24, 9, 1.8),
        rect(23, 11, 2.4, 9, { mv: "float" }),
        dia(24, 8.5, 3.2, 3.6, { mv: "float", lit: 1 }),
        tri(19.5, 8.5, 4, 3, "left", { mv: "float", lit: 1 }),
        tri(8, 19, 10, 5.5, "left", { mv: "limbL", lit: 1 }),
        tri(5.5, 24.5, 12.5, 6, "left", { mv: "limbL", mid: 1 }),
        tri(8.5, 30, 9.5, 5, "left", { mv: "limbL", lit: 1 }),
        tri(40, 19, 10, 5.5, "right", { mv: "limbR", lit: 1 }),
        tri(42.5, 24.5, 12.5, 6, "right", { mv: "limbR", mid: 1 }),
        tri(39.5, 30, 9.5, 5, "right", { mv: "limbR", lit: 1 }),
        dia(24, 24, 6.5, 9, { mv: "float", seam: 1 }),
        core(24, 24, 4.2),
        weak(24, 24),
      ],
    },
    {
      slug: "orion-hunter",
      name: "사냥꾼 거상",
      world: "오리온자리 (6점)",
      tier: "apricot",
      weakCount: 3,
      brief: "가장 큰 직립 실루엣. 허리띠 세 젬이 순서대로 열린다.",
      parts: [
        shadow(24, 14, 2.6),
        rect(15.5, 32, 5.5, 12, { mv: "body" }),
        rect(27, 32, 5.5, 12, { mv: "body" }),
        rect(13.5, 13, 21, 19, { mv: "body", seam: 1 }),
        rect(18.5, 5, 11, 8, { mv: "body" }),
        rect(20.5, 8, 1.6, 1.6, { mv: "body", role: "eye" }),
        rect(23.2, 8, 1.6, 1.6, { mv: "body", role: "eye" }),
        rect(25.9, 8, 1.6, 1.6, { mv: "body", role: "eye" }),
        dia(9.5, 16, 4.2, 6.5, { mv: "limbL", lit: 1 }),
        dia(38.5, 16, 4.2, 6.5, { mv: "limbR", lit: 1 }),
        rect(7, 9, 2.4, 27, { mv: "limbL", mid: 1 }),
        tri(8.2, 7.5, 4, 4, "up", { mv: "limbL", lit: 1 }),
        core(24, 18, 4),
        weak(18, 26.5),
        weak(24, 26.5),
        weak(30, 26.5),
      ],
    },
    {
      slug: "dipper-crawler",
      name: "국자 절지체",
      world: "북두칠성 (7점)",
      tier: "teal",
      weakCount: 4,
      brief: "일곱 체절이 국자 궤적을 그린다. 홀수 체절만 유효타.",
      parts: [
        shadow(24, 16, 2.4),
        rect(11, 30, 1.8, 12, { mv: "limbL" }),
        rect(17, 30, 1.8, 13, { mv: "limbL" }),
        rect(29, 30, 1.8, 13, { mv: "limbR" }),
        rect(34, 30, 1.8, 12, { mv: "limbR" }),
        circ(10, 26, 4.2, { mv: "body", seam: 1 }),
        circ(16, 23.5, 4.2, { mv: "body", seam: 1 }),
        circ(22.5, 22, 4.6, { mv: "body", seam: 1 }),
        circ(29, 23.5, 4.2, { mv: "body", seam: 1 }),
        circ(33, 29.5, 3.8, { mv: "body", seam: 1 }),
        circ(27.5, 34, 3.8, { mv: "body", seam: 1 }),
        circ(21, 33.5, 3.8, { mv: "body", seam: 1 }),
        core(22.5, 22, 3.4),
        weak(10, 26),
        weak(22.5, 22),
        weak(33, 29.5),
        weak(21, 33.5),
      ],
    },
    {
      slug: "training-effigy",
      name: "훈련 표적 골렘",
      world: "무한 훈련장",
      tier: "pale",
      weakCount: 1,
      brief: "물리·능력 QA용. 무기믹 판정 확인을 위해 실루엣을 단순하게 유지한다.",
      parts: [
        shadow(24, 12, 2.4),
        dia(24, 36, 9.5, 6.5, { mv: "body", seam: 1 }),
        dia(24, 25, 7.5, 7, { mv: "body", seam: 1 }),
        dia(24, 14, 5.5, 6, { mv: "float", lit: 1 }),
        ring(24, 25, 11.5, 0.8, { mv: "body", role: "glow" }),
        dia(24, 25, 3, 3.6, { mv: "orbit", orb: { r: 12.5, a: 30 }, lit: 1 }),
        dia(24, 25, 3, 3.6, { mv: "orbit", orb: { r: 12.5, a: 210 }, lit: 1 }),
        core(24, 25, 4),
        weak(24, 25),
      ],
    },
    {
      slug: "pentacle-core",
      name: "오망성 핵",
      world: "특수 · 오망성 발동",
      tier: "void",
      weakCount: 5,
      brief: "다섯 꼭짓점이 동시에 살아 있다. 하나만 남으면 재생한다.",
      parts: [
        shadow(24, 11, 2.2),
        ring(24, 24, 10.5, 0.8, { mv: "body", role: "glow" }),
        circ(24, 24, 7, { mv: "body", seam: 1 }),
        dia(24, 24, 3, 4, { mv: "orbit", orb: { r: 14.5, a: -90 }, lit: 1 }),
        dia(24, 24, 3, 4, { mv: "orbit", orb: { r: 14.5, a: -18 }, lit: 1 }),
        dia(24, 24, 3, 4, { mv: "orbit", orb: { r: 14.5, a: 54 }, lit: 1 }),
        dia(24, 24, 3, 4, { mv: "orbit", orb: { r: 14.5, a: 126 }, lit: 1 }),
        dia(24, 24, 3, 4, { mv: "orbit", orb: { r: 14.5, a: 198 }, lit: 1 }),
        core(24, 24, 5.5),
        weak(24, 9.5),
        weak(37.8, 19.5),
        weak(32.5, 35.8),
        weak(15.5, 35.8),
        weak(10.2, 19.5),
      ],
    },
    {
      slug: "erosion-warden",
      name: "침식 파수",
      world: "1-3 침식의 계단",
      tier: "teal",
      weakCount: 2,
      brief: "기존 공허 거상 계열의 반사 벽 담당. 가슴·복부 두 핵.",
      parts: [
        shadow(24, 14, 2.6),
        rect(16.5, 31, 5.5, 13, { mv: "body" }),
        rect(26, 31, 5.5, 13, { mv: "body" }),
        rect(14, 13, 20, 18, { mv: "body", seam: 1 }),
        rect(18, 4, 12, 9, { mv: "body" }),
        rect(20, 7.5, 1.6, 1.6, { mv: "body", role: "eye" }),
        rect(23.2, 7.5, 1.6, 1.6, { mv: "body", role: "eye" }),
        rect(26.4, 7.5, 1.6, 1.6, { mv: "body", role: "eye" }),
        dia(10, 15.5, 4.5, 7, { mv: "limbL", lit: 1 }),
        dia(38, 15.5, 4.5, 7, { mv: "limbR", lit: 1 }),
        circ(24, 26, 4.5, { mv: "orbit", orb: { r: 17, a: 170 }, mid: 1 }),
        circ(24, 26, 4.5, { mv: "orbit", orb: { r: 17, a: 10 }, mid: 1 }),
        ring(24, 19, 7, 0.8, { mv: "body", role: "glow" }),
        core(24, 19, 4.2),
        core(24, 28, 2.8),
        weak(24, 19),
        weak(24, 28),
      ],
    },
  ];

  /* ---- 상태별 프레임 곡선. 값은 논리 유닛(이동) 또는 0..1(비율) ---- */
  function curves(state, f) {
    const pick = (a) => a[f];
    if (state === "idle")
      return {
        bob: pick([0, -0.5, -1, -0.5]),
        shake: 0,
        ext: 0,
        pulse: pick([0, 0.2, 0.35, 0.2]),
        tint: 0,
        decay: 0,
        spin: f * 24,
        wave: 0,
      };
    if (state === "hit")
      return {
        bob: pick([-0.5, 0, 0.5, 0]),
        shake: pick([1.5, -1.5, 0.75, 0]),
        ext: 0,
        pulse: pick([0.7, 0.45, 0.2, 0.05]),
        tint: pick([0.85, 0.5, 0.22, 0]),
        decay: 0,
        spin: f * 10,
        wave: 0,
      };
    if (state === "attack")
      return {
        bob: pick([0.5, 0, -1, -1.5]),
        shake: pick([0, 0.5, -0.5, 0]),
        ext: pick([0, 0.35, 1, 0.7]),
        pulse: pick([0.1, 0.5, 1, 0.6]),
        tint: pick([0, 0.1, 0.3, 0.12]),
        decay: 0,
        spin: f * 40,
        wave: pick([0, 0, 0.55, 1]),
      };
    return {
      bob: pick([0, 0.5, 1.5, 3]),
      shake: pick([1, -0.5, 0, 0]),
      ext: 0,
      pulse: pick([0.8, 0.3, 0, 0]),
      tint: pick([0.35, 0.05, 0, 0]),
      decay: pick([0.15, 0.45, 0.75, 1]),
      spin: f * 14,
      wave: 0,
    };
  }

  function motion(part, m) {
    const mv = part.mv || "body";
    let dx = m.shake,
      dy = m.bob,
      a = 1,
      sc = 1;
    if (mv === "shadow") {
      dx = 0;
      dy = 0;
      sc = 1 - m.decay * 0.55 - m.pulse * 0.02;
      a = 0.42 * (1 - m.decay);
    } else if (mv === "float") {
      dy = m.bob * 1.9 - m.ext * 1.2;
      dx = m.shake * 0.5;
    } else if (mv === "limbL") {
      dx = m.shake - m.ext * 3.2;
      dy = m.bob - m.ext * 0.6;
    } else if (mv === "limbR") {
      dx = m.shake + m.ext * 3.2;
      dy = m.bob - m.ext * 0.6;
    } else if (mv === "core") {
      sc = 1 + m.pulse * (part.role === "weak" ? 0.35 : 0.5);
    }
    if (m.decay > 0 && mv !== "shadow") {
      const ox = (part.cx != null ? part.cx : part.x + part.w / 2) - 24;
      const oy = (part.cy != null ? part.cy : part.y + part.h / 2) - 26;
      dx += ox * m.decay * 0.45;
      dy += oy * m.decay * 0.3 + m.decay * 2;
      a *= 1 - m.decay * 0.92;
      if (part.role === "core" || part.role === "weak") sc *= 1 - m.decay;
    }
    return { dx, dy, a, sc };
  }

  /* ---- 셀 버퍼 ---- */
  function buffer(n) {
    return { n, px: new Array(n * n).fill(null) };
  }
  function put(buf, x, y, c, a) {
    if (x < 0 || y < 0 || x >= buf.n || y >= buf.n) return;
    if (a <= 0.04) return;
    buf.px[y * buf.n + x] = { c, a: a > 1 ? 1 : a };
  }

  function insideFn(p, sc, ox, oy) {
    const S = sc;
    if (p.k === "rect") {
      const cx = p.x + p.w / 2 + ox,
        cy = p.y + p.h / 2 + oy,
        hw = (p.w / 2) * S,
        hh = (p.h / 2) * S;
      return (u, v) => Math.abs(u - cx) <= hw && Math.abs(v - cy) <= hh;
    }
    if (p.k === "dia") {
      const cx = p.cx + ox,
        cy = p.cy + oy,
        rx = p.rx * S,
        ry = p.ry * S;
      return (u, v) => Math.abs(u - cx) / rx + Math.abs(v - cy) / ry <= 1;
    }
    if (p.k === "circ") {
      const cx = p.cx + ox,
        cy = p.cy + oy,
        r = p.r * S;
      return (u, v) => (u - cx) * (u - cx) + (v - cy) * (v - cy) <= r * r;
    }
    if (p.k === "ring") {
      const cx = p.cx + ox,
        cy = p.cy + oy,
        r = p.r * S,
        t = p.t;
      return (u, v) => Math.abs(Math.sqrt((u - cx) * (u - cx) + (v - cy) * (v - cy)) - r) <= t;
    }
    if (p.k === "tri") {
      const cx = p.cx + ox,
        cy = p.cy + oy,
        w = p.w * S,
        h = p.h * S,
        d = p.dir;
      return (u, v) => {
        const du = u - cx,
          dv = v - cy;
        if (d === "up") return dv >= 0 && dv <= h && Math.abs(du) <= (w / 2) * (dv / h);
        if (d === "down") return dv <= 0 && dv >= -h && Math.abs(du) <= (w / 2) * (-dv / h);
        if (d === "left") return du >= 0 && du <= w && Math.abs(dv) <= (h / 2) * (du / w);
        return du <= 0 && du >= -w && Math.abs(dv) <= (h / 2) * (-du / w);
      };
    }
    /* star: 4점 성형(애스트로이드). 핵과 약점 젬에 쓴다 */
    const cx = p.cx + ox,
      cy = p.cy + oy,
      rx = p.rx * S,
      ry = p.ry * S;
    return (u, v) =>
      Math.sqrt(Math.abs(u - cx) / rx) + Math.sqrt(Math.abs(v - cy) / ry) <= 1;
  }

  function bbox(p, sc, ox, oy) {
    let x0, y0, x1, y1;
    if (p.k === "rect") {
      const cx = p.x + p.w / 2 + ox,
        cy = p.y + p.h / 2 + oy;
      x0 = cx - (p.w / 2) * sc;
      x1 = cx + (p.w / 2) * sc;
      y0 = cy - (p.h / 2) * sc;
      y1 = cy + (p.h / 2) * sc;
    } else if (p.k === "circ") {
      x0 = p.cx + ox - p.r * sc;
      x1 = p.cx + ox + p.r * sc;
      y0 = p.cy + oy - p.r * sc;
      y1 = p.cy + oy + p.r * sc;
    } else if (p.k === "ring") {
      const r = p.r * sc + p.t + 1;
      x0 = p.cx + ox - r;
      x1 = p.cx + ox + r;
      y0 = p.cy + oy - r;
      y1 = p.cy + oy + r;
    } else if (p.k === "tri") {
      const w = p.w * sc,
        h = p.h * sc;
      x0 = p.cx + ox - (p.dir === "right" ? w : w / 2 + 1);
      x1 = p.cx + ox + (p.dir === "left" ? w : w / 2 + 1);
      y0 = p.cy + oy - (p.dir === "down" ? h : h / 2 + 1);
      y1 = p.cy + oy + (p.dir === "up" ? h : h / 2 + 1);
    } else {
      x0 = p.cx + ox - p.rx * sc;
      x1 = p.cx + ox + p.rx * sc;
      y0 = p.cy + oy - p.ry * sc;
      y1 = p.cy + oy + p.ry * sc;
    }
    return { x0: x0 - 1, y0: y0 - 1, x1: x1 + 1, y1: y1 + 1 };
  }

  /* 파츠 하나를 셀 격자에 굽는다. 외곽선 1셀, 상단 하이라이트, 하단 베벨,
     밴드 그라디언트 + 체커 디더링 — 기존 픽셀 UI 킷과 같은 마감 규칙. */
  function bake(buf, p, pal, m, extra) {
    const mo = motion(p, m);
    const partA = p.a != null ? p.a : p.role === "glow" ? 0.62 : 1;
    const alpha = mo.a * partA * (extra && extra.alpha != null ? extra.alpha : 1);
    if (alpha <= 0.04) return;
    let ox = mo.dx,
      oy = mo.dy;
    if (p.orb) {
      const ang = ((p.orb.a + m.spin) * Math.PI) / 180,
        rr = p.orb.r * (1 + m.ext * 0.28 + m.decay * 0.6);
      ox = mo.dx + Math.cos(ang) * rr;
      oy = mo.dy + Math.sin(ang) * rr * 0.55;
    }
    const sc = mo.sc,
      inside = insideFn(p, sc, ox, oy),
      bb = bbox(p, sc, ox, oy);
    const step = 1 / SUB;
    const role = p.role;
    let ramp, outline, hi, lo;
    if (role === "core") {
      ramp = [pal.coreHi, pal.core, pal.core, mix(pal.core, pal.o, 0.35)];
      outline = mix(pal.core, pal.o, 0.55);
      hi = pal.coreHi;
      lo = pal.core;
    } else if (role === "weak") {
      ramp = [pal.coreHi, pal.core, mix(pal.core, pal.o, 0.3), pal.core];
      outline = pal.h;
      hi = "#ffffff";
      lo = pal.core;
    } else if (role === "glow") {
      ramp = [pal.core, pal.core, pal.core, pal.core];
      outline = pal.core;
      hi = pal.coreHi;
      lo = pal.core;
    } else if (role === "eye") {
      ramp = [pal.core, pal.core, pal.core, pal.core];
      outline = pal.core;
      hi = pal.coreHi;
      lo = pal.core;
    } else if (p.lit) {
      ramp = [pal.h, pal.l, pal.l, pal.m];
      outline = pal.o;
      hi = pal.h;
      lo = pal.d;
    } else if (p.mid) {
      ramp = [pal.l, pal.m, pal.m, pal.d];
      outline = pal.o;
      hi = pal.h;
      lo = pal.d;
    } else {
      ramp = [pal.m, pal.d, pal.d, mix(pal.d, pal.o, 0.5)];
      outline = pal.o;
      hi = pal.l;
      lo = mix(pal.o, pal.d, 0.4);
    }
    if (m.tint > 0) {
      const t = m.tint * 0.9;
      ramp = ramp.map((c) => mix(c, pal.coreHi, t));
      hi = mix(hi, "#ffffff", t);
      lo = mix(lo, pal.coreHi, t * 0.7);
      outline = mix(outline, pal.core, t * 0.6);
    }
    const gx0 = Math.max(0, Math.floor(bb.x0 * SUB)),
      gx1 = Math.min(buf.n - 1, Math.ceil(bb.x1 * SUB));
    const gy0 = Math.max(0, Math.floor(bb.y0 * SUB)),
      gy1 = Math.min(buf.n - 1, Math.ceil(bb.y1 * SUB));
    const h = Math.max(1, bb.y1 - bb.y0);
    for (let gy = gy0; gy <= gy1; gy++) {
      for (let gx = gx0; gx <= gx1; gx++) {
        const u = (gx + 0.5) / SUB,
          v = (gy + 0.5) / SUB;
        if (!inside(u, v)) continue;
        let c;
        /* 핵과 약점은 섬유 단계 대슴 내→외 밝기 감상으로 칬다.
           기존 공허 거상의 핵은 어려운 테를 갖지 않는다. */
        if (role === "core" || role === "weak") {
          const pcx = p.cx + ox,
            pcy = p.cy + oy,
            rx = Math.max(0.001, (p.rx || p.r) * sc),
            ry = Math.max(0.001, (p.ry || p.r) * sc);
          const dt = Math.sqrt(((u - pcx) / rx) ** 2 + ((v - pcy) / ry) ** 2);
          put(buf, gx, gy, dt < 0.3 ? ramp[0] : dt < 0.72 ? ramp[1] : ramp[2], alpha);
          continue;
        }
        const edge =
          !inside(u - step, v) || !inside(u + step, v) || !inside(u, v - step) || !inside(u, v + step);
        if (edge && role !== "glow" && role !== "eye") c = outline;
        else if (!inside(u, v - step * 2) && role !== "glow") c = hi;
        else if (!inside(u, v + step * 2) && role !== "glow") c = lo;
        else {
          const rel = (v - bb.y0) / h;
          let bi = Math.min(3, Math.floor(rel * 4));
          if (rel * 4 - bi > 0.72 && bi < 3 && (gx + gy) % 2) bi++;
          c = ramp[bi];
          if (p.seam && Math.abs((v * 2) % 6) < 0.6) c = lo;
        }
        put(buf, gx, gy, c, alpha);
      }
    }
  }

  /* death 프레임의 파편. 슬러그 해시로 결정적. */
  function fragments(buf, boss, pal, m) {
    if (m.decay <= 0) return;
    let seed = 0;
    for (let i = 0; i < boss.slug.length; i++) seed = (seed * 31 + boss.slug.charCodeAt(i)) % 99991;
    const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
    const count = 18;
    for (let i = 0; i < count; i++) {
      const a = rnd() * Math.PI * 2,
        d = 6 + rnd() * 14,
        s = rnd() < 0.4 ? 2 : 1;
      const u = 24 + Math.cos(a) * d * (0.4 + m.decay),
        v = 24 + Math.sin(a) * d * (0.4 + m.decay) + m.decay * 4;
      const c = rnd() < 0.3 ? pal.core : rnd() < 0.5 ? pal.l : pal.m;
      const gx = Math.round(u * SUB),
        gy = Math.round(v * SUB);
      for (let dy = 0; dy < s; dy++)
        for (let dx = 0; dx < s; dx++) put(buf, gx + dx, gy + dy, c, (1 - m.decay * 0.55) * 0.95);
    }
  }

  /* attack 프레임의 충격 링 — 전용 아트 없이 코드 드로잉으로만 낸다 */
  function shock(buf, pal, m) {
    if (!m.wave) return;
    const r = 9 + m.wave * 10,
      alpha = 0.8 - m.wave * 0.4;
    const cx = 24,
      cy = 26,
      step = 1 / SUB;
    for (let gy = 0; gy < buf.n; gy++)
      for (let gx = 0; gx < buf.n; gx++) {
        const u = (gx + 0.5) / SUB,
          v = (cy + ((gy + 0.5) / SUB - cy) / 0.62);
        const dd = Math.sqrt((u - cx) * (u - cx) + (v - cy) * (v - cy));
        if (Math.abs(dd - r) <= 0.9 && (gx + gy) % 2 === 0) put(buf, gx, gy, pal.coreHi, alpha);
        else if (Math.abs(dd - r) <= 1.6 && (gx + gy) % 3 === 0) put(buf, gx, gy, pal.core, alpha * 0.7);
        void step;
      }
  }

  function renderFrame(slug, state, f) {
    const boss = BOSSES.find((b) => b.slug === slug);
    if (!boss) throw new Error("unknown boss: " + slug);
    const pal = TIERS[boss.tier],
      m = curves(state, f),
      buf = buffer(N);
    boss.parts.forEach((p) => {
      /* 핵 주위 얇은 발광 링. 정의에 이미 글로우 링이 겹쳐 있으면 생략한다 */
      if (p.role === "core") {
        const ringed = boss.parts.some(
          (q) =>
            q.role === "glow" &&
            q.k === "ring" &&
            Math.abs(q.cx - p.cx) < 3 &&
            Math.abs(q.cy - p.cy) < 3,
        );
        if (!ringed)
          bake(
            buf,
            { k: "ring", cx: p.cx, cy: p.cy, r: (p.rx || 4) * 1.55, t: 0.55, mv: p.mv, role: "glow", a: 0.5 },
            pal,
            m,
          );
      }
      bake(buf, p, pal, m);
    });
    if (state === "attack") shock(buf, pal, m);
    if (state === "death") fragments(buf, boss, pal, m);
    return buf;
  }

  /* 약점 젬 시트: 64셀(=256px) 한 장. 보스 팔레트의 핵 색만 쓴다. */
  function renderGem(slug) {
    const boss = BOSSES.find((b) => b.slug === slug),
      pal = TIERS[boss.tier];
    const g = buffer(GEM_N),
      m = curves("idle", 0);
    const parts = [
      ring(24, 24, 13, 1.4, { role: "glow" }),
      dia(24, 24, 10, 12, { lit: 1 }),
      star(24, 24, 8.5, 8.5, { role: "core" }),
      star(24, 24, 4.5, 4.5, { role: "weak" }),
    ];
    /* 젬 격자는 48유닛을 64셀에 담으므로 SUB가 다르다 — 굽는 동안만 바꾼다 */
    const prev = SUB;
    SUB = GEM_N / GRID;
    parts.forEach((p) => bake(g, p, pal, m));
    SUB = prev;
    return g;
  }

  const api = {
    GRID,
    N,
    GEM_N,
    PX: 4,
    FRAME: 384,
    GEM_PX: 256,
    STATES: ["idle", "hit", "attack", "death"],
    TIERS,
    BOSSES,
    renderFrame,
    renderGem,
  };
  globalThis.BossPackCore = api;
})();
export default globalThis.BossPackCore;
