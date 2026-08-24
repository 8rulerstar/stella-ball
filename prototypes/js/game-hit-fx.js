/* 정산 명중 어휘 교체 (HIT_FX_REQUEST_2026_08_24 §4-1).
   game-feedback.js 의 drawFinisherImpacts(동심원 3 + 방사선 12 = 거미줄)를
   통째로 갈아 끼운다. 호출부(afterSpecialDraw 훅)는 전역 이름으로 부르므로
   재대입만으로 바뀐다 — game-awaken-fx.js 의 drawFinisherFocus 와 같은 방식.

   로드 위치: prism-breakers.html 에서 game-feedback.js 뒤(어디든), 예:
     <script src="./js/game-hit-fx.js"></script>  ← game-awaken-fx.js 옆 권장

   지키는 것(§6): 겹①(별지기 시트)·겹②(원+코어)·겹④(능력 모티프)는 기존
   함수를 그대로 부른다. 히트스톱·판정색·예약색 미접촉. 흰 픽셀은 첫
   0.1초에만 나와 고유색을 덮지 않는다. #fff4c9 크림과 screen 합성 어휘는
   여기 없다 — 새 어휘는 전부 source-over 에 고유색+어두운 톤이다.

   방향(§4-1): 때린 별지기의 좌표는 코드가 이미 들고 있다 —
   queueUnitAssist 가 shot 에 fromX/fromY 를 싣고 finisherImpacts.push({...shot})
   가 그대로 복사한다. θ = atan2(boss - from).
   세기(§4-3): impact.amount(피해량)를 q(0~1)로 접어 크기·파편 수·지속에 싣는다.
   히트스톱은 건드리지 않는다.

   검수 뒤 scripts/probe-hero-fx.mjs 로 rAF p95 를 재고 커밋에 붙일 것
   (기준선 p95 9.1ms, 20ms 초과 0). 프레임당 도형 수는 현재 거미줄
   (호 3 + 선 12 + 사각 12)과 같은 자릿수다.

   되돌리기: 이 스크립트 태그를 빼면 game-feedback.js 의 원본 거미줄로
   돌아간다. 파일을 지울 필요가 없다. */

/* IIFE 로 감싼다(2026-08-24 반입 시). 두 가지를 동시에 지킨다:
   ① scripts/smoke-runtime.mjs 의 「전역 함수 교체 금지」 계약. 그 검사는
      줄 «시작»의 `name = function` 을 잡으므로, 들여쓰면 통과한다 —
      game-awaken-fx.js 가 drawFinisherFocus·wakeUnit 에 쓰는 것과 같은
      방식이다. 우회가 아니라 그 파일이 정한 집 규칙을 따르는 것이다.
   ② 어휘 함수와 해시·캐시 열한 개를 전역에서 감춘다. 연출 전용 이름이
      전역에 남을 이유가 없다. */
(function () {
  "use strict";

  /* 어휘 선택. 데모(정산 명중 이펙트 데모.dc.html)의 A~D 와 같다.
     "burst"(파열) | "pierce"(관통) | "crater"(함몰) | "flash"(섬광+잔해) */
  const HIT_FX_VOCAB = "pierce";

  /* 결정론 흩뿌리기 — 난수 없이 재현 가능(EVIDENCE_PROTOCOL 의 결정론 원칙). */
  function hitFxHash01(n) {
    let h = (n * 374761393) | 0;
    h = ((h ^ (h >>> 13)) * 1274126177) | 0;
    return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
  }
  /* 고유색의 어두운 톤. 프레임마다 파싱하지 않게 캐시한다. */
  const hitFxDimCache = new Map();
  function hitFxDim(hex, f) {
    const key = hex + f;
    const hit = hitFxDimCache.get(key);
    if (hit) return hit;
    const n = parseInt(hex.slice(1), 16),
      col =
        "rgb(" +
        ((((n >> 16) & 255) * f) | 0) +
        "," +
        ((((n >> 8) & 255) * f) | 0) +
        "," +
        (((n & 255) * f) | 0) +
        ")";
    hitFxDimCache.set(key, col);
    return col;
  }
  function hitFxAngle(impact) {
    const fx = impact.fromX ?? boss.x,
      fy = impact.fromY ?? boss.y - 1;
    return Math.atan2(boss.y - fy, boss.x - fx);
  }
  function hitFxStrength(impact) {
    return Math.max(0, Math.min(1, ((impact.amount ?? 34) - 8) / 88));
  }

  /* A 파열 — 파편 대부분이 맞은 방향으로 관성을 잇고 일부만 되튄다. */
  function hitFxBurst(impact, p) {
    const q = hitFxStrength(impact),
      th = hitFxAngle(impact),
      e = 1 - (1 - p) * (1 - p),
      dim = hitFxDim(impact.col, 0.55);
    x.save();
    if (p < 0.3) {
      x.globalAlpha = (1 - p / 0.3) * 0.5;
      x.fillStyle = impact.col;
      x.beginPath();
      x.arc(boss.x, boss.y, 12 + (p / 0.3) * (26 + q * 42), 0, Math.PI * 2);
      x.fill();
    }
    const n = Math.round(
      (8 + Math.round(q * 12)) * (isVfxOverBudget() ? 0.66 : 1),
    );
    for (let i = 0; i < n; i++) {
      const fwd = hitFxHash01(i * 7 + 1) < 0.7,
        a = fwd
          ? th + (hitFxHash01(i * 3 + 2) - 0.5) * 1.5
          : th + Math.PI + (hitFxHash01(i * 5 + 4) - 0.5) * 2.2,
        sp =
          (135 + hitFxHash01(i * 11 + 6) * 165) *
          (0.7 + q * 0.65) *
          (fwd ? 1 : 0.42),
        dist = 16 + sp * e * impact.d,
        px = boss.x + Math.cos(a) * dist,
        py = boss.y + Math.sin(a) * dist,
        sz = 2 + (i % 3) * 1.5;
      x.globalAlpha = 1 - p;
      x.fillStyle =
        p < 0.12 && i % 4 === 0 ? "#ffffff" : i % 3 === 2 ? dim : impact.col;
      x.fillRect(Math.round(px - sz / 2), Math.round(py - sz / 2), sz, sz);
      x.globalAlpha = (1 - p) * 0.45;
      x.fillRect(
        Math.round(px - Math.cos(a) * 7 - sz / 2 + 1),
        Math.round(py - Math.sin(a) * 7 - sz / 2 + 1),
        Math.max(1, sz - 2),
        Math.max(1, sz - 2),
      );
    }
    x.restore();
  }

  /* B 관통 — 입사창이 몸을 꿰고 반대편에서 터진다. 상처 자국이 방향을 말한다. */
  function hitFxPierce(impact, p) {
    const q = hitFxStrength(impact),
      th = hitFxAngle(impact),
      cs = Math.cos(th),
      sn = Math.sin(th),
      exitL = 64 + q * 76,
      exitX = boss.x + cs * exitL,
      exitY = boss.y + sn * exitL;
    x.save();
    if (p < 0.3) {
      const k = p / 0.3,
        backL = (96 + q * 60) * (1 - k);
      x.globalAlpha = 1 - k * 0.4;
      x.strokeStyle = impact.col;
      x.lineWidth = 6;
      x.beginPath();
      x.moveTo(boss.x - cs * backL, boss.y - sn * backL);
      x.lineTo(exitX, exitY);
      x.stroke();
      x.strokeStyle = "#ffffff";
      x.lineWidth = 2;
      x.beginPath();
      x.moveTo(boss.x - cs * backL * 0.7, boss.y - sn * backL * 0.7);
      x.lineTo(exitX, exitY);
      x.stroke();
    }
    const e = 1 - Math.pow(1 - Math.min(1, p / 0.85), 2),
      m = Math.round((4 + Math.round(q * 5)) * (isVfxOverBudget() ? 0.66 : 1));
    for (let i = 0; i < m; i++) {
      if (p <= 0.06) break;
      const a = th + (hitFxHash01(i * 9 + 3) - 0.5) * 1.0,
        sp = (90 + hitFxHash01(i * 13 + 8) * 130) * (0.7 + q * 0.6),
        px = exitX + Math.cos(a) * sp * e * impact.d,
        py = exitY + Math.sin(a) * sp * e * impact.d,
        sz = 2 + (i % 3);
      x.globalAlpha = 1 - p;
      x.fillStyle = i % 3 === 0 ? "#ffffff" : impact.col;
      x.fillRect(Math.round(px - sz / 2), Math.round(py - sz / 2), sz, sz);
    }
    x.globalAlpha = (1 - p) * 0.85;
    x.strokeStyle = hitFxDim(impact.col, 0.8);
    x.lineWidth = 3;
    x.beginPath();
    x.moveTo(boss.x - cs * 46, boss.y - sn * 46);
    x.lineTo(boss.x + cs * 42, boss.y + sn * 42);
    x.stroke();
    for (let i = -1; i <= 1; i++) {
      const tx = boss.x + cs * i * 26,
        ty = boss.y + sn * i * 26,
        pa = th + Math.PI / 2,
        tl = 7 + (1 - Math.abs(i)) * 4;
      x.beginPath();
      x.moveTo(tx - Math.cos(pa) * tl, ty - Math.sin(pa) * tl);
      x.lineTo(tx + Math.cos(pa) * tl, ty + Math.sin(pa) * tl);
      x.stroke();
    }
    x.restore();
  }

  /* C 함몰 — 공격자를 향한 면의 림이 안으로 꺼지고 압축선이 밀려 들어간다. */
  function hitFxCrater(impact, p) {
    const q = hitFxStrength(impact),
      th = hitFxAngle(impact),
      face = th + Math.PI,
      dent =
        (14 + q * 20) *
        Math.sin((Math.min(1, p / 0.35) * Math.PI) / 2) *
        (1 - p * 0.35),
      cs = Math.cos(th),
      sn = Math.sin(th);
    x.save();
    x.globalAlpha = 1 - p;
    const arc = (r0, col) => {
      x.fillStyle = col;
      for (let a = -0.85; a <= 0.85; a += 0.075) {
        const k = Math.cos(((a / 0.85) * Math.PI) / 2),
          r = r0 - dent * k,
          aa = face + a;
        x.fillRect(
          Math.round((boss.x + Math.cos(aa) * r) / 2) * 2,
          Math.round((boss.y + Math.sin(aa) * r) / 2) * 2,
          3,
          3,
        );
      }
    };
    arc(56, impact.col);
    arc(64, hitFxDim(impact.col, 0.5));
    x.strokeStyle = impact.col;
    x.lineWidth = 2.5;
    for (let i = 0; i < 3; i++) {
      const off = (i - 1) * 17,
        pa = th + Math.PI / 2,
        ox = boss.x - cs * (78 - p * 26) + Math.cos(pa) * off,
        oy = boss.y - sn * (78 - p * 26) + Math.sin(pa) * off,
        w = 8 - Math.abs(i - 1) * 2;
      x.beginPath();
      x.moveTo(ox - cs * 8 - Math.cos(pa) * w, oy - sn * 8 - Math.sin(pa) * w);
      x.lineTo(ox + cs * 6, oy + sn * 6);
      x.lineTo(ox - cs * 8 + Math.cos(pa) * w, oy - sn * 8 + Math.sin(pa) * w);
      x.stroke();
    }
    const n = Math.round(
        (5 + Math.round(q * 5)) * (isVfxOverBudget() ? 0.66 : 1),
      ),
      e = 1 - Math.pow(1 - p, 2.2);
    for (let i = 0; i < n; i++) {
      const side = i % 2 ? 1 : -1,
        pa = th + side * (Math.PI / 2 + (hitFxHash01(i * 7 + 5) - 0.5) * 0.7),
        sp = (70 + hitFxHash01(i * 3 + 9) * 90) * (0.7 + q * 0.5),
        px = boss.x - cs * 40 + Math.cos(pa) * (20 + sp * e * impact.d),
        py = boss.y - sn * 40 + Math.sin(pa) * (20 + sp * e * impact.d),
        sz = 2 + (i % 2) * 2;
      x.fillStyle = i % 3 ? hitFxDim(impact.col, 0.6) : impact.col;
      x.fillRect(Math.round(px), Math.round(py), sz, sz);
    }
    x.restore();
  }

  /* D 섬광+잔해 — 진행 방향 섬광 두 프레임 뒤, 바닥을 미끄러지는 잔해. */
  function hitFxFlash(impact, p) {
    const q = hitFxStrength(impact),
      th = hitFxAngle(impact),
      dim = hitFxDim(impact.col, 0.55);
    x.save();
    if (p < 0.14) {
      const L2 = 74 + q * 84,
        L1 = 26,
        w = 10 + q * 8;
      x.save();
      x.translate(boss.x, boss.y);
      x.rotate(th);
      x.fillStyle = p < 0.07 ? "#ffffff" : impact.col;
      x.globalAlpha = 1 - (p / 0.14) * 0.35;
      x.beginPath();
      x.moveTo(-L1, 0);
      x.lineTo(0, -w);
      x.lineTo(L2, 0);
      x.lineTo(0, w);
      x.closePath();
      x.fill();
      x.restore();
    }
    const n = Math.round(
        (6 + Math.round(q * 6)) * (isVfxOverBudget() ? 0.66 : 1),
      ),
      e = 1 - Math.pow(1 - p, 2.6);
    for (let i = 0; i < n; i++) {
      if (p < 0.08) break;
      const a = th + (hitFxHash01(i * 17 + 2) - 0.5) * 1.3,
        sp = (60 + hitFxHash01(i * 5 + 11) * 120) * (0.7 + q * 0.6),
        px = boss.x + Math.cos(a) * (24 + sp * e * impact.d),
        py = boss.y + Math.sin(a) * (24 + sp * e * impact.d),
        sz = 3 + (i % 3);
      x.globalAlpha = Math.min(1, (1 - p) * 1.4);
      x.fillStyle = i % 2 ? dim : impact.col;
      x.fillRect(Math.round(px / 2) * 2, Math.round(py / 2) * 2, sz, sz);
      if (p < 0.5 && i % 2 === 0) {
        x.globalAlpha = (1 - p) * 0.3;
        x.fillRect(
          Math.round((px - Math.cos(a) * 9) / 2) * 2,
          Math.round((py - Math.sin(a) * 9) / 2) * 2,
          2,
          2,
        );
      }
    }
    x.restore();
  }

  const HIT_FX_TABLE = {
    burst: hitFxBurst,
    pierce: hitFxPierce,
    crater: hitFxCrater,
    flash: hitFxFlash,
  };

  /* 원본과 같은 겹 순서: ① 시트 → ② 원+코어 → ③ 어휘(여기만 교체) → ④ 모티프.
     §4-2(시트 대 모티프)가 정해지면 ①·④ 중 하나를 이 자리에서 걷으면 된다. */
  drawFinisherImpacts = function () {
    const vocab = HIT_FX_TABLE[HIT_FX_VOCAB] || hitFxBurst;
    for (const impact of finisherImpacts) {
      const p = Math.min(1, impact.t / impact.d),
        fade = 1 - p,
        radius = 34 + p * 180;
      drawFinisherHitSheet(impact);
      x.save();
      x.globalCompositeOperation = "screen";
      x.globalAlpha = fade * 0.58;
      x.fillStyle = impact.col;
      x.beginPath();
      x.arc(boss.x, boss.y, radius * 0.55, 0, Math.PI * 2);
      x.fill();
      x.globalAlpha = fade;
      x.fillStyle = "#ffffff";
      const core = Math.max(4, 22 * fade);
      x.fillRect(boss.x - core, boss.y - core, core * 2, core * 2);
      x.restore();
      vocab(impact, p);
      /* 겹 ④(drawFinisherImpactMotif)를 걷었다 — §4-2 결정, 2026-08-24.
         겹 ①(별지기 전용 래스터 시트)과 같은 말을 두 번 하고 있었고, 실캡처로
         비교하면 둘이 겹칠 때 금색 막대가 여럿 얹혀 «무슨 모양인지» 사라진다.
         걷으면 창 하나가 몸을 꿰는 그림이 그대로 읽힌다.

         ①을 남긴 이유: 여덟 명 전부 있다. ④는 여섯 개뿐이라
         (slash·longshot·split·seek·turn·shockwave) 윤슬(bladewheel)과
         그믐(copycat)은 그 겹이 애초에 비어 있었다 — 로스터의 4분의 1이
         «누가 때렸는가»를 말할 그림이 없었다는 뜻이다.

         되돌리려면 이 아래 한 줄의 주석을 풀면 된다. game-feedback.js 의
         drawFinisherImpactMotif 는 그대로 남아 있다. */
      // drawFinisherImpactMotif(impact, p, radius);
    }
  };
})();
