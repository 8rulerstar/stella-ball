#!/usr/bin/env node
/* Stella Ball — 보스 에셋 10종 재생성 스크립트 (2026-08-13)
 *
 *   node scripts/generate_boss_pack_10.mjs
 *
 * 외부 npm 의존성 없음 (node:zlib만 사용). 도트 정의와 애니메이션 곡선은
 * scripts/boss-pack-core.js 한 곳에만 있고, 이 파일은 PNG 인코딩만 담당한다.
 *
 * 출력
 *   assets/library/boss10/<slug>.png              384×384 정지 1프레임
 *   assets/library/boss10/<slug>-weakgem.png      256×256 약점 젬
 *   assets/library/anim/boss10/<slug>-idle.png    1536×384 (4프레임)
 *   ... -hit.png / -attack.png / -death.png
 *
 * 주의: 프레임 규격(384)과 시트 프레임 폭은 game-data.js의 bossArt.fw/fh/
 * sheetFrame과 묶여 있다. 값을 바꾸면 런타임 쪽도 같은 커밋에서 고친다.
 */
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import core from "./boss-pack-core.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PX = core.PX; // 셀 한 변의 픽셀 수 (4)

/* ---- 최소 PNG 인코더 (RGBA8, 무압축 필터 0) ---- */
const CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
function encodePNG(w, h, rgba) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
    rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/* ---- 셀 버퍼 → RGBA 캔버스 ---- */
function canvas(w, h) {
  return { w, h, data: Buffer.alloc(w * h * 4) };
}
function blit(cv, buf, ox, oy) {
  for (let y = 0; y < buf.n; y++) {
    for (let x = 0; x < buf.n; x++) {
      const cell = buf.px[y * buf.n + x];
      if (!cell) continue;
      const v = parseInt(cell.c.slice(1), 16);
      const r = (v >> 16) & 255,
        g = (v >> 8) & 255,
        b = v & 255,
        a = Math.round(cell.a * 255);
      for (let dy = 0; dy < PX; dy++) {
        for (let dx = 0; dx < PX; dx++) {
          const px = ox + x * PX + dx,
            py = oy + y * PX + dy;
          if (px < 0 || py < 0 || px >= cv.w || py >= cv.h) continue;
          const i = (py * cv.w + px) * 4;
          cv.data[i] = r;
          cv.data[i + 1] = g;
          cv.data[i + 2] = b;
          cv.data[i + 3] = a;
        }
      }
    }
  }
}
function write(rel, cv) {
  const out = resolve(ROOT, rel);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, encodePNG(cv.w, cv.h, cv.data));
  return rel;
}

const F = core.FRAME;
let count = 0;
for (const boss of core.BOSSES) {
  const still = canvas(F, F);
  blit(still, core.renderFrame(boss.slug, "idle", 0), 0, 0);
  console.log(write(`assets/library/boss10/${boss.slug}.png`, still));
  count++;

  const gem = canvas(core.GEM_PX, core.GEM_PX);
  blit(gem, core.renderGem(boss.slug), 0, 0);
  console.log(write(`assets/library/boss10/${boss.slug}-weakgem.png`, gem));
  count++;

  for (const state of core.STATES) {
    const sheet = canvas(F * 4, F);
    for (let f = 0; f < 4; f++)
      blit(sheet, core.renderFrame(boss.slug, state, f), f * F, 0);
    console.log(
      write(`assets/library/anim/boss10/${boss.slug}-${state}.png`, sheet),
    );
    count++;
  }
}
console.log(`\n${core.BOSSES.length}종 / ${count}개 파일 생성 완료`);
