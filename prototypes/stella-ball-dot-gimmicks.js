/* stella-ball-dot-gimmicks.js — 기믹 오브젝트 도트 리스킨 (2026-08-22 디자인 세션)
 *
 * 표현 전용 계층. 물리·판정·상태를 읽기만 하고 쓰지 않는다.
 * 난수 없음 — 애니메이션은 전부 frameClock에서 나온다(봇 하니스 결정론 유지).
 * 로드: prism-breakers.html에서 boss-art.js 뒤(표현 계층 아무 자리).
 *      window.StellaDotGimmicks 로만 노출하고 훅·모듈 등록은 하지 않는다 —
 *      소비자는 game-combat.js drawPinballTable의 위임 한 줄씩이다(PATCH_NOTES).
 *
 * 규칙(새벽 관측소 킷): 셀 2px · 1셀 외곽선 · 상단 하이라이트 · 5단 밴드 +
 * 체커 디더 · 하드 섀도 · 셀 스냅 애니메이션(서브픽셀 이동 없음) · 곡면은
 * 호를 셀로 직접 쌓는다(회전 변환 없음).
 * 캔버스 판정색·heroes[].col 은 건드리지 않는다.
 */
(() => {
  "use strict";
  const CELL = 2;
  const bakeCache = new Map();
  function bake(key, cols, rows, plot) {
    if (bakeCache.has(key)) return bakeCache.get(key);
    if (bakeCache.size > 300) bakeCache.clear(); // 크기 변형 폭주 방어
    const c = document.createElement("canvas");
    c.width = cols * CELL;
    c.height = rows * CELL;
    const g = c.getContext("2d");
    const P = (px, py, col) => {
      if (px < 0 || py < 0 || px >= cols || py >= rows || !col) return;
      g.fillStyle = col;
      g.fillRect(px * CELL, py * CELL, CELL, CELL);
    };
    plot(P, cols, rows);
    bakeCache.set(key, c);
    return c;
  }
  const snap = (v) => Math.round(v / CELL) * CELL;
  function hardShadow(x, x0, y0, w, h) {
    x.save();
    x.globalAlpha = 0.5;
    x.fillStyle = "#04080a";
    x.fillRect(snap(x0), snap(y0 + 4), w, h);
    x.restore();
  }
  // 3x5 갈매기. dir: 1=→ -1=← 0=↑ 2=↓
  function chevStamp(P, cx, cy, dir, col) {
    for (let i = -2; i <= 2; i++) {
      const k = 2 - Math.abs(i);
      if (dir === 0) P(cx + i, cy + k - 1, col);
      else if (dir === 2) P(cx + i, cy - k + 1, col);
      else P(cx + k * dir - dir, cy + i, col);
    }
  }
  // 셀 스냅 다이아몬드 보석
  function pixelGem(x, cx, cy, r, ramp) {
    const R = Math.max(3, Math.round(r / CELL));
    const bx = Math.round(cx / CELL),
      by = Math.round(cy / CELL);
    for (let yy = -R; yy <= R; yy++) {
      const half = Math.round((R - Math.abs(yy)) * 0.72);
      for (let xx = -half; xx <= half; xx++) {
        const d = Math.abs(yy) + Math.abs(xx) * 1.4;
        x.fillStyle = d < R * 0.42 ? ramp[2] : d < R * 0.8 ? ramp[1] : ramp[0];
        x.fillRect((bx + xx) * CELL, (by + yy) * CELL, CELL, CELL);
      }
    }
    x.fillStyle = "#ffffff";
    x.fillRect(bx * CELL, (by - Math.round(R * 0.55)) * CELL, CELL, CELL);
  }

  /* ── 반사 벽 — 챔퍼 크리스털 판 3장, 소켓 갈매기 차례 점등 ── */
  function wall(x, w, frameClock) {
    const clock = (frameClock || 0) / 1000;
    const hot = w.on > 0,
      heat = hot ? w.on / 0.22 : 0;
    const lateral = w.w >= w.h;
    const plates = 3,
      gapPx = 4;
    const span = lateral ? w.w : w.h;
    const plateSpan = Math.floor((span - gapPx * (plates - 1)) / plates);
    const wc = Math.max(8, Math.floor((lateral ? plateSpan : w.w) / CELL));
    const hc = Math.max(8, Math.floor((lateral ? w.h : plateSpan) / CELL));
    const lit = Math.floor(clock * 2.6) % plates;
    const x0 = snap(w.x - w.w / 2),
      y0 = snap(w.y - w.h / 2);
    hardShadow(x, x0 + 2, y0 + (lateral ? w.h - 2 : 2), w.w - 4, 6);
    for (let i = 0; i < plates; i++) {
      const bright = hot || i === lit;
      const spr = bake(
        "wall:" +
          [wc, hc, hot ? 1 : 0, bright ? 1 : 0, lateral ? 1 : 0].join(":"),
        wc,
        hc,
        (P, cols, rows) => {
          const pal = hot
            ? {
                o: "#3a5560",
                hi: "#ffffff",
                b1: "#f6fefc",
                b2: "#dff2f2",
                b3: "#bcd9de",
                b4: "#95bcc5",
              }
            : {
                o: "#0e2028",
                hi: "#f2fbf9",
                b1: "#cfe6e8",
                b2: "#9dc2cf",
                b3: "#6f98a4",
                b4: "#446e7a",
              };
          const cut = 2;
          const inside = (a, b) =>
            a >= 0 &&
            b >= 0 &&
            a < cols &&
            b < rows &&
            Math.min(a, cols - 1 - a) + Math.min(b, rows - 1 - b) >= cut;
          for (let b = 0; b < rows; b++)
            for (let a = 0; a < cols; a++) {
              if (!inside(a, b)) continue;
              if (
                !inside(a - 1, b) ||
                !inside(a + 1, b) ||
                !inside(a, b - 1) ||
                !inside(a, b + 1)
              ) {
                P(a, b, pal.o);
                continue;
              }
              let col;
              const diag = a / cols - b / rows;
              if (b <= 2 && a % 6 !== 5) col = pal.hi;
              else if (b >= rows - 3) col = (a + b) % 2 ? pal.b4 : pal.b3;
              else if (diag > 0.22) col = pal.b1;
              else if (diag > -0.05) col = pal.b2;
              else col = pal.b3;
              P(a, b, col);
            }
          const cx = Math.floor(cols / 2),
            cy = Math.floor(rows / 2);
          for (let dy = -3; dy <= 3; dy++)
            for (let dx = -3; dx <= 3; dx++)
              if (Math.abs(dx) + Math.abs(dy) <= 4 && inside(cx + dx, cy + dy))
                P(cx + dx, cy + dy, hot ? "#7d5a33" : "#123640");
          chevStamp(
            P,
            cx,
            cy,
            lateral ? 1 : 2,
            bright ? (hot ? "#fffbe8" : "#d9fbff") : "#5d858f",
          );
          for (const [rx, ry] of [
            [2, 2],
            [cols - 3, 2],
            [2, rows - 3],
            [cols - 3, rows - 3],
          ])
            P(rx, ry, pal.b4);
        },
      );
      const px = lateral ? x0 + i * (plateSpan + gapPx) : x0;
      const py = lateral ? y0 - (hot ? CELL : 0) : y0 + i * (plateSpan + gapPx);
      x.drawImage(spr, px, py);
    }
    if (hot) {
      // 면 수직 충격선 — 셀 점선이 밖으로
      const reach = snap(10 + (1 - heat) * 26);
      x.save();
      x.globalAlpha = heat * 0.8;
      x.fillStyle = "#fffbe8";
      if (lateral)
        for (let a = x0; a < x0 + w.w; a += CELL * 3)
          x.fillRect(a, y0 - reach, CELL, CELL);
      else
        for (let b = y0; b < y0 + w.h; b += CELL * 3)
          x.fillRect(x0 + w.w + reach, b, CELL, CELL);
      x.restore();
    } else {
      x.save();
      x.globalAlpha = 0.22;
      x.fillStyle = "#7cc6bb";
      if (lateral)
        for (let a = x0 + 4; a < x0 + w.w - 4; a += CELL * 4)
          x.fillRect(a, y0 + w.h + 2, CELL * 2, CELL);
      else
        for (let b = y0 + 4; b < y0 + w.h - 4; b += CELL * 4)
          x.fillRect(x0 + w.w + 2, b, CELL, CELL * 2);
      x.restore();
    }
  }

  /* ── 가속 발판 — 리벳 레일 + 발광 레인, 광대·갈매기 셀 스냅 ── */
  function boostPad(x, pad, frameClock) {
    const clock = (frameClock || 0) / 1000;
    const hot = pad.on > 0;
    const wc = Math.floor(pad.w / CELL),
      hc = Math.floor(pad.h / CELL);
    const laneRows = Math.max(3, hc - 4);
    const step = Math.floor(clock * 8) % laneRows;
    const chevOn = Math.floor(clock * 6) % 3;
    const spr = bake(
      "boost:" + [wc, hc, hot ? 1 : 0, chevOn, step].join(":"),
      wc,
      hc,
      (P, cols, rows) => {
        const railO = "#0f2418",
          rail = "#1f4030",
          railHi = "#4f8a52",
          rivet = "#8fc47a";
        const laneD = hot ? "#3f8a4b" : "#17382a",
          lane = hot ? "#63b061" : "#28543c",
          laneHi = hot ? "#d7ffb4" : "#7fae6b";
        for (let a = 0; a < cols; a++) {
          P(a, 0, railO);
          P(a, rows - 1, railO);
          if (a > 0 && a < cols - 1) {
            P(a, 1, a % 6 === 3 ? rivet : rail);
            P(a, rows - 2, a % 6 === 3 ? rivet : rail);
          }
        }
        for (let b = 0; b < rows; b++) {
          P(0, b, railO);
          P(cols - 1, b, railO);
          if (b > 1 && b < rows - 2) {
            P(1, b, railHi);
            P(cols - 2, b, rail);
          }
        }
        for (let b = 2; b < rows - 2; b++)
          for (let a = 2; a < cols - 2; a++) {
            const c = Math.abs(b - (rows - 1) / 2) / (rows / 2);
            let col = c < 0.3 ? lane : laneD;
            if ((a + b) % 2 && c >= 0.3 && c < 0.52) col = lane;
            if (b === step + 2) col = laneHi;
            P(a, b, col);
          }
        const n = Math.max(2, Math.floor(cols / 22));
        for (let i = 0; i < n; i++) {
          const cx = Math.floor(((i + 0.5) / n) * cols);
          for (let k = 0; k < 3; k++) {
            const on = hot || k === chevOn;
            chevStamp(
              P,
              cx,
              Math.floor(rows / 2) + 2 - k * 3,
              0,
              on ? (hot ? "#ffffff" : "#e9ffd2") : "#3f6e46",
            );
          }
        }
      },
    );
    const x0 = snap(pad.x - pad.w / 2),
      y0 = snap(pad.y - pad.h / 2);
    hardShadow(x, x0 + 2, y0 + pad.h - 4, pad.w - 4, 6);
    x.drawImage(spr, x0, y0);
  }

  /* ── 흐린 발판 — 침강 분지 + 이중 보라 갈매기(판 위 한글 제거) ── */
  function dragPad(x, pad, frameClock) {
    const clock = (frameClock || 0) / 1000;
    const hot = pad.on > 0;
    const wc = Math.floor(pad.w / CELL),
      hc = Math.floor(pad.h / CELL);
    const spr = bake(
      "drag:" + [wc, hc, hot ? 1 : 0].join(":"),
      wc,
      hc,
      (P, cols, rows) => {
        const o = "#0d191b",
          rimL = hot ? "#cfdad7" : "#5f7a77",
          rimD = "#31504e";
        for (let a = 0; a < cols; a++) {
          P(a, 0, o);
          P(a, rows - 1, o);
          if (a > 0 && a < cols - 1) {
            P(a, 1, a % 4 < 2 ? rimD : null);
            P(a, rows - 2, a % 4 < 2 ? rimL : null);
          }
        }
        for (let b = 1; b < rows - 1; b++) {
          P(0, b, o);
          P(cols - 1, b, o);
          if (b % 4 < 2) {
            P(1, b, rimD);
            P(cols - 2, b, rimD);
          }
        }
        for (let b = 2; b < rows - 2; b++)
          for (let a = 2; a < cols - 2; a++) {
            const t = (b - 2) / Math.max(1, rows - 5);
            let col = t < 0.22 ? "#0f2022" : t < 0.6 ? "#1a3134" : "#234042";
            if ((a * 7 + b * 13) % 11 === 0 && t < 0.55) col = "#39565b";
            P(a, b, col);
          }
        const n = Math.max(2, Math.floor(cols / 24));
        for (let i = 0; i < n; i++) {
          const cx = Math.floor(((i + 0.5) / n) * cols),
            cy = Math.floor(rows / 2);
          for (let dy = -3; dy <= 4; dy++)
            for (let dx = -3; dx <= 3; dx++)
              if (Math.abs(dx) + Math.abs(dy) <= 4)
                P(cx + dx, cy + dy, "#1c1930");
          chevStamp(P, cx, cy - 1, 2, hot ? "#d8c5f2" : "#9b84c9");
          chevStamp(P, cx, cy + 2, 2, hot ? "#b39ddb" : "#645390");
        }
      },
    );
    const x0 = snap(pad.x - pad.w / 2),
      y0 = snap(pad.y - pad.h / 2);
    x.drawImage(spr, x0, y0);
    // 가라앉는 안개 픽셀 — 셀 단위 하강
    x.save();
    x.globalAlpha = 0.55;
    x.fillStyle = "#b39ddb";
    const innerRows = Math.floor(pad.h / CELL) - 4;
    for (let ca = 3; ca < pad.w / CELL - 3; ca += 7) {
      const row = (Math.floor(clock * 4) + ca) % innerRows;
      x.fillRect(x0 + ca * CELL, y0 + (row + 2) * CELL, CELL, CELL);
    }
    x.restore();
  }

  /* ── 공명 범퍼 — 스펙큘러 링 + NSEW 스터드 + 도는 반짝 셀 ── */
  function bumper(x, b, frameClock) {
    const clock = (frameClock || 0) / 1000;
    const hot = b.on > 0;
    const R = Math.round((b.r + 7) / CELL),
      rMain = Math.round(b.r / CELL);
    const bx = Math.round(b.x / CELL),
      by = Math.round(b.y / CELL);
    for (let yy = -R; yy <= R; yy++)
      for (let xx = -R; xx <= R; xx++) {
        const d = Math.hypot(xx, yy),
          a = Math.atan2(yy, xx);
        let col = null;
        if (d <= R && d > R - 1.5) col = "#081418";
        else if (d <= R - 1.5 && d > R - 2.5) col = "#12262c";
        else if (d <= rMain && d > rMain - 2.5) {
          const spec = a > -2.7 && a < -1.1;
          col = hot
            ? spec
              ? "#ffffff"
              : "#e4f5d5"
            : spec
              ? "#8fe0d5"
              : "#3fa39c";
        } else if (d <= rMain - 2.5 && d > rMain - 3.5)
          col = hot ? "#9fdcc8" : "#26605e";
        else if (d <= rMain - 3.5) col = (xx + yy) % 2 ? "#11302f" : "#0e2827";
        if (col) {
          x.fillStyle = col;
          x.fillRect((bx + xx) * CELL, (by + yy) * CELL, CELL, CELL);
        }
      }
    x.fillStyle = hot ? "#ffe9a8" : "#2e6e6a";
    for (const [sx, sy] of [
      [-1, -(rMain + 3)],
      [-1, rMain + 1],
      [-(rMain + 3), -1],
      [rMain + 1, -1],
    ])
      x.fillRect((bx + sx) * CELL, (by + sy) * CELL, CELL * 2, CELL * 2);
    pixelGem(
      x,
      b.x,
      b.y,
      Math.max(9, b.r - 14),
      hot
        ? ["#c9a94f", "#ffe9a8", "#fff8df"]
        : ["#8a6f2e", "#e8cf77", "#fff3c9"],
    );
    const sa = clock * 1.6;
    x.fillStyle = "#f2fffb";
    x.fillRect(
      (bx + Math.round(Math.cos(sa) * (rMain - 1))) * CELL,
      (by + Math.round(Math.sin(sa) * (rMain - 1))) * CELL,
      CELL,
      CELL,
    );
  }

  /* ── 도는 방벽 — 궤도에 물린 곡면 보루. 호를 셀로 직접 쌓는다 ── */
  function orbital(x, o) {
    const hot = o.hitCooldown > 0;
    const radius = o.radius || 130;
    const cx = o.x - Math.cos(o.a) * radius,
      cy = o.y - Math.sin(o.a) * radius;
    const halfSpan = Math.min(0.6, (o.r + 8) / radius + 0.08);
    const rOut = radius + 12,
      rIn = radius - 12;
    const a0 = o.a - halfSpan,
      a1 = o.a + halfSpan;
    const pal = hot
      ? {
          tooth: "#fff6e0",
          hi: "#ffe3c0",
          body: "#8a5f38",
          body2: "#6e4a2c",
          inner: "#2b1c10",
          cap: "#ffffff",
          stud: "#fff1d6",
        }
      : {
          tooth: "#b7e6de",
          hi: "#7cc6bb",
          body: "#2a4d57",
          body2: "#1c3944",
          inner: "#0e2028",
          cap: "#d8f2ea",
          stud: "#9adfc9",
        };
    const seen = new Set();
    const da = CELL / rOut;
    for (let a = a0; a <= a1; a += da) {
      const edgeK = Math.min(a - a0, a1 - a);
      const tooth = Math.floor((a - a0) / (da * 4)) % 2 === 0;
      for (let rr = rOut; rr >= rIn; rr -= CELL) {
        const t = (rOut - rr) / (rOut - rIn);
        let col;
        if (t < 0.14) {
          if (!tooth && edgeK > da * 3) continue;
          col = pal.tooth;
        } else if (t < 0.32) col = pal.hi;
        else if (t < 0.66) col = pal.body;
        else if (t < 0.88) col = pal.body2;
        else col = pal.inner;
        const px = snap(cx + Math.cos(a) * rr),
          py = snap(cy + Math.sin(a) * rr);
        const key = px + ":" + py;
        if (seen.has(key)) continue;
        seen.add(key);
        if (col === pal.body && ((px + py) / CELL) % 2 && t > 0.5)
          col = pal.body2;
        if (edgeK <= da * 3 && t >= 0.14) col = pal.cap;
        x.fillStyle = col;
        x.fillRect(px, py, CELL, CELL);
      }
    }
    for (const sa of [-halfSpan * 0.55, halfSpan * 0.55]) {
      x.fillStyle = pal.stud;
      x.fillRect(
        snap(cx + Math.cos(o.a + sa) * (radius + 3)) - CELL,
        snap(cy + Math.sin(o.a + sa) * (radius + 3)) - CELL,
        CELL * 2,
        CELL * 2,
      );
    }
    /* 관문 표지(2026-08-22 작화 납품) — 방벽 양 끝, 플레이어가 노리는
       «틈»의 문설주. 방향 없는 마름모라 어느 각도에서도 회전 없이 그대로
       찍는다(셀 스냅). 점등 벌은 방벽과 같은 hot 신호를 공유한다. 경로
       상수는 이식성 게이트의 시야 때문에 game-data.js의 staticArt에 있다. */
    if (typeof loadTexture === "function" && typeof staticArt === "object") {
      const gate = loadTexture(staticArt[hot ? "orbitGateHot" : "orbitGate"]);
      if (gate?.complete && gate.naturalWidth)
        for (const ga of [a0, a1])
          x.drawImage(
            gate,
            snap(cx + Math.cos(ga) * radius) - 8,
            snap(cy + Math.sin(ga) * radius) - 8,
          );
    }
    pixelGem(
      x,
      o.x,
      o.y,
      8,
      hot
        ? ["#8a5f38", "#ffd9a4", "#fff6e0"]
        : ["#123036", "#4db8b3", "#d8f2ea"],
    );
    // HP 핍 — 화면 정렬, 궤도 안쪽
    const tx = o.x - Math.cos(o.a) * 24,
      ty = o.y - Math.sin(o.a) * 24;
    const pips = 6,
      alive = Math.ceil((o.hp / o.maxHp) * pips);
    const px0 = snap(tx) - pips * 3,
      py0 = snap(ty);
    x.fillStyle = "#081418";
    x.fillRect(px0 - 2, py0 - 2, pips * 6 + 4, 8);
    for (let i = 0; i < pips; i++) {
      x.fillStyle = i < alive ? "#9adfc9" : "#1d3a40";
      x.fillRect(px0 + i * 6 + 1, py0, 4, 4);
    }
  }

  /* ── 굳은 껍질 — 픽셀 호 조각 (슬롯·틈·깨짐 상태는 소유자 그대로) ── */
  const SHIELD_L = ["#eafaf4", "#9adfc9", "#5fa397", "#2f5d59"];
  const SHIELD_L_HOT = ["#ffffff", "#fff1d6", "#ffd9a4", "#c98d55"];
  function pixelArc(x, cx, cy, r, a0, a1, layers) {
    const seen = new Set();
    for (let ti = 0; ti < layers.length; ti++) {
      const rr = r - ti * CELL;
      const da = CELL / Math.max(8, rr);
      x.fillStyle = layers[ti];
      for (let a = a0; a <= a1; a += da) {
        const px = snap(cx + Math.cos(a) * rr),
          py = snap(cy + Math.sin(a) * rr);
        const key = px + ":" + py;
        if (seen.has(key)) continue;
        seen.add(key);
        x.fillRect(px, py, CELL, CELL);
      }
    }
  }
  function shieldRing(x, boss, shield) {
    if (!shield || shield.hits <= 0) return;
    const slots = Math.max(shield.max || shield.hits, shield.hits),
      gap = 0.16,
      span = (Math.PI * 2) / slots - gap,
      hot = shield.flash > 0,
      lift = hot ? snap(6 * (shield.flash / 0.45)) : 0;
    for (let i = 0; i < slots; i++) {
      const intact = i < shield.hits,
        justBroke = !intact && i === shield.hits && hot;
      if (!intact && !justBroke) continue;
      const a0 = -Math.PI / 2 + i * ((Math.PI * 2) / slots) + gap / 2,
        r =
          78 + (justBroke ? snap(14 * (1 - shield.flash / 0.45)) + lift : lift);
      x.save();
      x.globalAlpha = justBroke ? shield.flash / 0.45 : 1;
      pixelArc(
        x,
        boss.x,
        boss.y,
        r,
        a0,
        a0 + span,
        hot ? SHIELD_L_HOT : SHIELD_L,
      );
      for (const ea of [a0 + 0.02, a0 + span - 0.02]) {
        x.fillStyle = hot ? "#ffffff" : "#d8f2ea";
        x.fillRect(
          snap(boss.x + Math.cos(ea) * (r - CELL)),
          snap(boss.y + Math.sin(ea) * (r - CELL)),
          CELL,
          CELL * 2,
        );
      }
      const midA = a0 + span / 2;
      x.fillStyle = hot ? "#ffffff" : "#eafaf4";
      x.fillRect(
        snap(boss.x + Math.cos(midA) * (r - CELL)) - CELL,
        snap(boss.y + Math.sin(midA) * (r - CELL)) - CELL,
        CELL * 2,
        CELL * 2,
      );
      x.restore();
    }
  }
  // 걷힌 순간(0.4초). age는 소유자가 계산해 넘긴다 — 상태 소거도 소유자 몫.
  function shieldShatter(x, boss, shield, age) {
    const slots = shield.max || shield.shattered.count,
      gap = 0.16,
      span = (Math.PI * 2) / slots - gap;
    x.save();
    x.globalAlpha = 1 - age;
    const shard =
      typeof loadTexture === "function" && typeof staticArt === "object"
        ? [
            loadTexture(staticArt.shieldShardA),
            loadTexture(staticArt.shieldShardB),
            loadTexture(staticArt.shieldShardC),
          ]
        : [];
    const shardFrame = Math.min(3, Math.floor(age * 4));
    for (let i = 0; i < shield.shattered.count; i++) {
      const a0 = -Math.PI / 2 + i * ((Math.PI * 2) / slots) + gap / 2;
      pixelArc(
        x,
        boss.x,
        boss.y,
        78 + snap(age * 92),
        a0,
        a0 + span * (1 - age * 0.5),
        SHIELD_L_HOT,
      );
      /* 파편(2026-08-22 작화 납품). 조각 궤적 위 셀 스냅 산포 — 코드 고정
         400ms를 4프레임(덩이·회전·조각·먼지, 100ms/장)이 정확히 나눈다.
         변형은 조각 번호로 고른다(난수 금지 — 봇 결정론). */
      const sp = shard[i % 3];
      if (sp?.complete && sp.naturalWidth) {
        const mid = a0 + span * (1 - age * 0.5) * 0.5,
          rr = 78 + snap(age * 92) + 10;
        x.drawImage(
          sp,
          shardFrame * 16,
          0,
          16,
          16,
          snap(boss.x + Math.cos(mid) * rr) - 8,
          snap(boss.y + Math.sin(mid) * rr) - 8,
          16,
          16,
        );
      }
    }
    x.restore();
  }

  /* ── 관측점 표석(§3-2 대비) — 아직 소비자 없음. bumpers 복원 시 사용 ── */
  function marker(x, s, frameClock) {
    const clock = (frameClock || 0) / 1000;
    const spr = bake("stone", 18, 36, (P) => {
      const o = "#0a161c",
        rim = "#9fe0d4",
        rimD = "#3f6a70",
        b1 = "#26505a",
        b2 = "#1a3a44",
        b3 = "#112a34",
        cap = "#33606a";
      for (let b = 1; b < 36; b++) {
        const inset = b < 3 ? 3 : b < 6 ? 2 : b < 32 ? 1 : 0;
        const x0 = inset,
          x1 = 17 - inset;
        for (let a = x0; a <= x1; a++) {
          let col;
          if (b === 1 || b === 35 || a === x0 || a === x1) col = o;
          else if (b === 2 || (a === x0 + 1 && b % 5 !== 4)) col = rim;
          else if (b === 34 || a === x1 - 1) col = rimD;
          else if (b < 6) col = cap;
          else {
            const diag = a / 18 - b / 72;
            col = diag > 0.3 ? b1 : diag > 0.1 ? b2 : b3;
            if ((a + b) % 2 && diag > 0.05 && diag < 0.14) col = b2;
          }
          P(a, b, col);
        }
      }
      P(8, 0, rim);
      P(9, 0, rim);
      for (let i = 0; i < 3; i++)
        for (let a = 6; a < 12; a++)
          P(a, 25 + i * 3, (a + i) % 2 ? "#345257" : "#274850");
      P(8, 21, "#e8cf77");
      P(9, 21, "#fff3c9");
      P(8, 22, "#8a6f2e");
      P(9, 22, "#e8cf77");
    });
    hardShadow(x, s.x - 18, s.y + 26, 36, 6);
    x.drawImage(spr, snap(s.x - 18), snap(s.y - 36));
    const sy = s.y - 18;
    if (!s.lit) {
      x.fillStyle = "#57a79b";
      for (let i = 0; i <= 4; i++)
        for (const [dx, dy] of [
          [i, -4 + i],
          [-i, -4 + i],
          [i, 4 - i],
          [-i, 4 - i],
        ])
          x.fillRect(
            Math.round(s.x / CELL + dx) * CELL - CELL,
            Math.round(sy / CELL + dy) * CELL,
            CELL,
            CELL,
          );
    } else {
      pixelGem(x, s.x, sy, 11, ["#b06a3d", "#eea56f", "#ffd2a0"]);
      x.fillStyle = Math.floor(clock * 3) % 2 ? "#ffd2a066" : "#ffd2a099";
      x.fillRect(snap(s.x), snap(sy - 16), CELL, CELL);
    }
  }

  window.StellaDotGimmicks = Object.freeze({
    CELL,
    wall,
    boostPad,
    dragPad,
    bumper,
    orbital,
    shieldRing,
    shieldShatter,
    marker,
    pixelArc,
    pixelGem,
  });
})();
