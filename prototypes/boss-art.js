/* Stella Ball — 보스 「보행 행성」 절차적 픽셀 아트 (2026-08-14)
   게임의 drawMoon/drawRed(stella-ball-dawn.js)와 같은 방식: 저해상도 캔버스에 픽셀을 찍고
   image-rendering:pixelated로 확대한다. 래스터 에셋 없이 페이즈별 변형까지 코드로 돈다.
   window.StellaBossArt.draw(ctx, variant, { size, phase })

   표현 전용: 게임 상태를 읽거나 쓰지 않는다. 호출자가 size와 phase만 넘긴다.

   팔레트는 디자인 시안의 남보라+자홍에서 OUTER_OBSERVER_INTRO_SPEC.md 4절의
   청록-잿빛 저대비로 교체했다. 명도 구조는 그대로라 음영은 동일하게 읽힌다.
   살구빛(--star #ffd2a0)은 보상·CTA 전용이므로 존재에는 쓰지 않는다.
   시안 원본 값: PAL #07050e~#3d2d70, HOT #a83f88, HOT2 #c05ea0,
   COOL #3d1a44, RIM #7a54ae. 채도 재검토는 디자인 세션 회신 대기 중이다. */
(function () {
  "use strict";
  /* --night-0/1/2, --void, --line 을 6단으로 편 밤 램프.
     상단 세 단은 전장 264px에서 실루엣이 배경에 묻히지 않을 만큼만 올렸다.
     최상단도 --star(#ffd2a0)보다 훨씬 어두우므로 플레이어의 시선은
     자기가 만든 살구빛 별자리 노드를 여전히 먼저 잡는다. */
  var PAL = ["#070b0d", "#0d1418", "#142226", "#1e3338", "#2c4a4e", "#3f6669"];
  var HOT = "#4d7f80",
    HOT2 = "#5f9b98",
    COOL = "#16242a",
    RIM = "#6f8b8c";

  function newMask(w, h) {
    return { w: w, h: h, d: new Uint8Array(w * h) };
  }
  function disc(m, cx, cy, r) {
    var r2 = r * r,
      x0 = Math.max(0, Math.floor(cx - r)),
      x1 = Math.min(m.w - 1, Math.ceil(cx + r)),
      y0 = Math.max(0, Math.floor(cy - r)),
      y1 = Math.min(m.h - 1, Math.ceil(cy + r));
    for (var y = y0; y <= y1; y++)
      for (var x = x0; x <= x1; x++) {
        var dx = x - cx,
          dy = y - cy;
        if (dx * dx + dy * dy <= r2) m.d[y * m.w + x] = 1;
      }
  }
  /* 마디 다리: 직선 구간 + 관절 혹. 매끈한 촉수가 아니라 절지·크레인으로 읽히게 한다. */
  function strut(m, joints, radii) {
    for (var k = 0; k < joints.length - 1; k++) {
      var x0 = joints[k][0],
        y0 = joints[k][1],
        x1 = joints[k + 1][0],
        y1 = joints[k + 1][1];
      var r0 = radii[k],
        r1 = radii[k + 1];
      var n = Math.max(6, Math.round(Math.hypot(x1 - x0, y1 - y0)));
      for (var i = 0; i <= n; i++) {
        var t = i / n;
        if (t > 0.9 && k < joints.length - 2) continue;
        disc(m, x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, r0 + (r1 - r0) * t);
      }
      if (k > 0) disc(m, x0, y0, r0 * 1.34);
    }
  }
  function distField(m) {
    var w = m.w,
      h = m.h,
      D = new Int32Array(w * h),
      i,
      x,
      y,
      v;
    for (i = 0; i < w * h; i++) D[i] = m.d[i] ? 99999 : 0;
    for (y = 0; y < h; y++)
      for (x = 0; x < w; x++) {
        i = y * w + x;
        if (!D[i]) continue;
        v = D[i];
        if (x > 0) v = Math.min(v, D[i - 1] + 2);
        if (y > 0) v = Math.min(v, D[i - w] + 2);
        if (x > 0 && y > 0) v = Math.min(v, D[i - w - 1] + 3);
        if (x < w - 1 && y > 0) v = Math.min(v, D[i - w + 1] + 3);
        D[i] = v;
      }
    for (y = h - 1; y >= 0; y--)
      for (x = w - 1; x >= 0; x--) {
        i = y * w + x;
        if (!D[i]) continue;
        v = D[i];
        if (x < w - 1) v = Math.min(v, D[i + 1] + 2);
        if (y < h - 1) v = Math.min(v, D[i + w] + 2);
        if (x < w - 1 && y < h - 1) v = Math.min(v, D[i + w + 1] + 3);
        if (x > 0 && y < h - 1) v = Math.min(v, D[i + w - 1] + 3);
        D[i] = v;
      }
    return D;
  }
  function shadeMask(g, m, D, opt) {
    var w = m.w,
      h = m.h,
      lx = opt.lx,
      ly = opt.ly,
      deep = opt.deep || 26;
    for (var y = 0; y < h; y++)
      for (var x = 0; x < w; x++) {
        var i = y * w + x;
        if (!m.d[i]) continue;
        var dep = D[i] / 2;
        var gx =
          D[Math.min(w - 1, x + 1) + y * w] - D[Math.max(0, x - 1) + y * w];
        var gy =
          D[x + Math.min(h - 1, y + 1) * w] - D[x + Math.max(0, y - 1) * w];
        var len = Math.hypot(gx, gy) || 1;
        var tilt = Math.max(0, 1 - dep / deep);
        var nl = -((gx / len) * lx + (gy / len) * ly);
        var v = 0.28 + 0.44 * nl * Math.pow(tilt, 0.6) + 0.07 * (1 - tilt);
        if (opt.detail) v += opt.detail(x, y, dep);
        var col = PAL[Math.max(0, Math.min(5, Math.round(v * 5)))];
        if (dep < 1.3 && nl > 0.55) col = RIM;
        if (opt.seamAt) {
          var s = opt.seamAt(x, y, dep);
          if (s) col = s === 2 ? opt.hot || HOT : COOL;
        }
        g.fillStyle = col;
        g.fillRect(x, y, 1, 1);
      }
  }
  function seedRnd(seed) {
    var s = seed;
    return function () {
      return (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648;
    };
  }
  function plateSeeds(n, cx, cy, r, seed) {
    var rr = seedRnd(seed),
      out = [];
    for (var i = 0; i < n; i++) {
      var a = rr() * Math.PI * 2,
        d = Math.sqrt(rr()) * r;
      out.push([cx + Math.cos(a) * d, cy + Math.sin(a) * d]);
    }
    return out;
  }
  function seamTester(seeds) {
    return function (x, y, dep) {
      if (dep < 1.6) return 0;
      var b1 = 1e9,
        b2 = 1e9;
      for (var k = 0; k < seeds.length; k++) {
        var dx = x - seeds[k][0],
          dy = y - seeds[k][1],
          d = dx * dx + dy * dy;
        if (d < b1) {
          b2 = b1;
          b1 = d;
        } else if (d < b2) b2 = d;
      }
      var gap = Math.sqrt(b2) - Math.sqrt(b1);
      return gap < 0.7 ? 2 : gap < 1.9 ? 1 : 0;
    };
  }
  /* 눈: 안구가 아니라 지각에 뚫린 관측 기관. 홍채는 방사 지각 고리, 동공은 구멍. */
  function eye(g, m, ex, ey, R0, irisR, pupR, opt) {
    opt = opt || {};
    for (var y = Math.floor(ey - R0 - 2); y <= ey + R0 + 2; y++)
      for (var x = Math.floor(ex - R0 - 2); x <= ex + R0 + 2; x++) {
        if (x < 0 || y < 0 || x >= m.w || y >= m.h) continue;
        if (!opt.free && !m.d[y * m.w + x]) continue;
        var dx = x - ex,
          dy = y - ey,
          d = Math.hypot(dx, dy);
        if (d > R0) continue;
        var c;
        if (d > R0 - Math.max(2, R0 * 0.09)) c = dy < 0 ? PAL[5] : PAL[1];
        else if (d > irisR)
          c =
            (Math.round(d) + Math.round(Math.atan2(dy, dx) * 9)) % 7 < 2
              ? COOL
              : PAL[2];
        else if (d > pupR) {
          var a = Math.atan2(dy, dx),
            spoke = Math.round(a * (opt.spokes || 13)) % 2 === 0;
          var band =
            Math.round((d - pupR) / Math.max(1.6, (irisR - pupR) / 3.4)) % 3;
          c = spoke
            ? band === 0
              ? opt.hot || HOT2
              : "#3d5f63"
            : band === 2
              ? "#122024"
              : PAL[2];
        } else if (d > pupR - 2) c = opt.rimHot || "#8ba39f";
        else c = "#050809";
        g.fillStyle = c;
        g.fillRect(x, y, 1, 1);
      }
    if (opt.ticks !== false) {
      for (var k = 0; k < 40; k++) {
        var ta = (k / 40) * Math.PI * 2;
        for (var r = R0 + 2; r < R0 + (k % 5 ? 5 : 9); r += 1) {
          var tx = Math.round(ex + Math.cos(ta) * r),
            ty = Math.round(ey + Math.sin(ta) * r);
          if (tx < 0 || ty < 0 || tx >= m.w || ty >= m.h) continue;
          if (!opt.free && !m.d[ty * m.w + tx]) continue;
          g.fillStyle = k % 5 ? "#2c4145" : "#4d7f80";
          g.fillRect(tx, ty, 1, 1);
        }
      }
    }
  }
  function craters(g, m, list) {
    for (var k = 0; k < list.length; k++) {
      var cx = list[k][0],
        cy = list[k][1],
        cr = list[k][2];
      for (var y = Math.floor(cy - cr); y <= cy + cr; y++)
        for (var x = Math.floor(cx - cr); x <= cx + cr; x++) {
          if (x < 0 || y < 0 || x >= m.w || y >= m.h || !m.d[y * m.w + x])
            continue;
          var dx = x - cx,
            dy = y - cy,
            d = Math.hypot(dx, dy);
          if (d <= cr) {
            g.fillStyle = d > cr - 1.5 && dy < 0 ? PAL[4] : PAL[1];
            g.fillRect(x, y, 1, 1);
          }
        }
    }
  }
  function debris(g, S, cx, cy, rx, ry, rot, n, seed, skip) {
    var rr = seedRnd(seed);
    for (var k = 0; k < n; k++) {
      var a = rr() * Math.PI * 2,
        j = 0.86 + rr() * 0.3;
      var ux = Math.cos(a) * rx * j,
        uy = Math.sin(a) * ry * j;
      var x = Math.round(cx + ux * Math.cos(rot) - uy * Math.sin(rot));
      var y = Math.round(cy + ux * Math.sin(rot) + uy * Math.cos(rot));
      if (x < 0 || y < 0 || x > S - 2 || y > S - 2) continue;
      if (skip && skip(x, y)) continue;
      var w = 1 + Math.round(rr() * 4 * (S / 180)),
        hh = 1 + Math.round(rr() * 3 * (S / 180));
      g.fillStyle = PAL[1];
      g.fillRect(x, y, w, hh);
      g.fillStyle = Math.sin(a) > 0 ? PAL[3] : PAL[5];
      g.fillRect(x, y, w, 1);
      if (rr() < 0.22) {
        g.fillStyle = HOT;
        g.fillRect(x + (w >> 1), y + hh - 1, 1, 1);
      }
    }
  }

  /* ── 보행 행성 ─────────────────────────────────────────────────────
     페이즈는 다리 손실로 표현한다. 체력이 깎일수록 마디가 하나씩 부러지고,
     몸이 기울며, 눈의 동공이 열리고 이음매가 뜨거워진다. 별도 스프라이트 불필요. */
  /* pupilScale은 인트로 전용이다. 페이즈는 1(다리 넷)로 두고 동공만 줄여
     「지나가던 것이 관측창을 알아본다」한 프레임을 만든다. 전투에서는 쓰지 않는다. */
  function drawStrider(g, S, phase, pupilScale) {
    var K = S / 180,
      P = phase || 1;
    var tilt = [0, 0, 5, 11, 18][P] * K; // 다리를 잃을수록 몸이 주저앉는다
    var bx = 92 * K,
      by = 72 * K + tilt,
      br = 52 * K;
    var m = newMask(S, S);
    disc(m, bx, by, br);
    // 다리 4개. broken[i]가 참이면 무릎에서 끊어진 그루터기만 남는다.
    var legs = [
      [
        [
          [58, 96],
          [26, 128],
          [18, 178],
        ],
        [11, 8, 6],
      ],
      [
        [
          [76, 116],
          [58, 152],
          [62, 180],
        ],
        [12, 9, 7],
      ],
      [
        [
          [116, 114],
          [142, 148],
          [140, 180],
        ],
        [13, 10, 7],
      ],
      [
        [
          [130, 92],
          [166, 118],
          [178, 162],
        ],
        [11, 8, 6],
      ],
    ];
    var brokenCount = [0, 0, 1, 2, 3][P];
    var brokenOrder = [3, 0, 2],
      stumps = [];
    for (var i = 0; i < legs.length; i++) {
      var joints = legs[i][0].map(function (p) {
        return [p[0] * K, p[1] * K + tilt];
      });
      var radii = legs[i][1].map(function (r) {
        return r * K;
      });
      var broken =
        brokenOrder.indexOf(i) > -1 && brokenOrder.indexOf(i) < brokenCount;
      if (broken) {
        // 무릎 앞에서 끊긴 그루터기. 끊긴 면은 뒤에서 뜨겁게 칠한다.
        var cut = 0.42,
          jx = joints[0][0] + (joints[1][0] - joints[0][0]) * cut,
          jy = joints[0][1] + (joints[1][1] - joints[0][1]) * cut;
        strut(m, [joints[0], [jx, jy]], [radii[0], radii[0] * 0.6]);
        stumps.push([jx, jy, radii[0] * 0.6]);
      } else strut(m, joints, radii);
    }
    strut(
      m,
      [
        [100 * K, 24 * K + tilt],
        [122 * K, -8 * K + tilt],
      ],
      [9 * K, 6 * K],
    );
    var D = distField(m);
    var st = seamTester(plateSeeds(13, bx, by, br - 2, 7373));
    // 부서질수록 이음매가 차갑게 밝아진다. 살구빛으로는 가지 않는다.
    var hotSeam = ["#3f6b6d", "#3f6b6d", "#4d7f80", "#5f9b98", "#74bfc0"][P];
    shadeMask(g, m, D, {
      lx: -0.6,
      ly: -0.78,
      deep: 24 * K,
      hot: hotSeam,
      seamAt: function (x, y, d) {
        var dx = x - bx,
          dy = y - by;
        return dx * dx + dy * dy < br * br ? st(x, y, d) : 0;
      },
    });
    craters(g, m, [
      [62 * K, 44 * K + tilt, 8 * K],
      [124 * K, 96 * K + tilt, 7 * K],
    ]);
    // 끊긴 단면
    for (var sI = 0; sI < stumps.length; sI++) {
      var sx = stumps[sI][0],
        sy = stumps[sI][1],
        sr = stumps[sI][2];
      for (var yy = Math.floor(sy - sr - 1); yy <= sy + sr + 1; yy++)
        for (var xx = Math.floor(sx - sr - 1); xx <= sx + sr + 1; xx++) {
          if (xx < 0 || yy < 0 || xx >= S || yy >= S || !m.d[yy * S + xx])
            continue;
          var sd = Math.hypot(xx - sx, yy - sy);
          if (sd > sr) continue;
          g.fillStyle =
            sd > sr - Math.max(1, sr * 0.3)
              ? "#74bfc0"
              : sd > sr * 0.4
                ? "#1d3438"
                : "#070d0f";
          g.fillRect(xx, yy, 1, 1);
        }
    }
    // 페이즈가 오를수록 지각이 갈라진다
    if (P >= 3) {
      var rr = seedRnd(808 + P);
      for (var c = 0; c < (P === 3 ? 5 : 10); c++) {
        var a0 = rr() * Math.PI * 2,
          r0 = (0.2 + rr() * 0.4) * br,
          x = bx + Math.cos(a0) * r0,
          y = by + Math.sin(a0) * r0;
        var dir = rr() * Math.PI * 2;
        for (var t = 0; t < br * 0.8; t += 0.8) {
          x += Math.cos(dir) * 0.8;
          y += Math.sin(dir) * 0.8;
          dir += (rr() - 0.5) * 0.5;
          var px = Math.round(x),
            py = Math.round(y);
          if (px < 0 || py < 0 || px >= S || py >= S || !m.d[py * S + px])
            break;
          g.fillStyle = t < br * 0.4 ? hotSeam : COOL;
          g.fillRect(px, py, 1, 1);
        }
      }
    }
    // 눈: 페이즈가 오를수록 동공이 열린다
    var pupil =
        [0, 7, 12, 17, 23][P] * K * (pupilScale == null ? 1 : pupilScale),
      iris = [0, 21, 23, 25, 27][P] * K;
    eye(
      g,
      m,
      Math.round(88 * K),
      Math.round(66 * K + tilt),
      31 * K,
      iris,
      pupil,
      {
        spokes: 15,
        hot: hotSeam,
        rimHot: P >= 3 ? "#a9c6c2" : "#8ba39f",
        ticks: S >= 140,
      },
    );
    debris(
      g,
      S,
      bx,
      by,
      74 * K,
      24 * K,
      -0.42,
      Math.round(20 + P * 6),
      2929,
      function (x, y) {
        var dx = x - bx,
          dy = y - by;
        return dx * dx + dy * dy < (br + 2) * (br + 2);
      },
    );
  }

  /* ── 프레임을 짚는 발톱 하나 ────────────────────────────────────────
     인트로 전용이다. 몸통은 계속 관측창 뒤에 있고 이 마디 하나만 앞으로
     올라와 프레임 모서리를 짚는다. drawStrider의 다리와 같은 마스크·같은
     램프·같은 광원을 쓰므로, 앞으로 나와도 다른 개체로 읽히지 않는다.
     오른쪽 위에서 들어와 왼쪽 아래로 꺾이고 끝이 갈고리로 말린다. */
  function drawClaw(g, S) {
    var K = S / 180;
    var m = newMask(S, S);
    function pts(list) {
      return list.map(function (p) {
        return [p[0] * K, p[1] * K];
      });
    }
    function radii(list) {
      return list.map(function (r) {
        return r * K;
      });
    }
    // 본체에서 뻗어 나온 큰 마디. 굵은 쪽은 화면 밖으로 잘려 나간다.
    strut(
      m,
      pts([
        [192, -6],
        [132, 44],
        [92, 92],
      ]),
      radii([27, 20, 14]),
    );
    /* 끝은 갈고리 하나가 아니라 마주 보는 두 갈래다. 벌어졌다 다시 모이는
       윤곽이 있어야 「짚는다」로 읽힌다 — 하나짜리 갈고리는 그냥 가지다. */
    strut(
      m,
      pts([
        [92, 92],
        [60, 114],
        [42, 146],
        [58, 163],
      ]),
      radii([13, 10, 7, 5]),
    );
    strut(
      m,
      pts([
        [92, 92],
        [80, 134],
        [92, 168],
        [112, 174],
      ]),
      radii([12, 9, 6, 4]),
    );
    // 관절 혹. 매끈한 촉수가 아니라 마디 구조물로 읽히게 한다.
    disc(m, 132 * K, 44 * K, 24 * K);
    disc(m, 92 * K, 92 * K, 17 * K);
    shadeMask(g, m, distField(m), { lx: -0.6, ly: -0.78, deep: 20 * K });
  }

  window.StellaBossArt = {
    draw: function (g, variant, opt) {
      opt = opt || {};
      if (variant === "claw") return drawClaw(g, opt.size || 180);
      drawStrider(g, opt.size || 180, opt.phase || 1, opt.pupil);
    },
    drawStrider: drawStrider,
    drawClaw: drawClaw,
    PAL: PAL,
  };
})();
