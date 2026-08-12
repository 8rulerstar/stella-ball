/* Stella Ball — 새벽 관측소 픽셀 UI 킷 (2026-08-12)
 * 사용법: <script src="./stella-ball-pixel-ui.js"></script> 후
 *   - 버튼/패널: 요소에 data-pbtn="cta|sub|tab|tabActive|chip|star|moon|panel|panelWarm" 지정, StellaPixelUI.apply() 호출
 *   - DOM을 새로 그린 뒤(showMeta/showRoster 등)마다 StellaPixelUI.apply()를 다시 호출한다 (이미 처리된 요소는 건너뜀)
 *   - 배경 스프라이트: StellaPixelUI.sprite('rabbitUp') 등이 dataURL 반환
 *   - 스프라이트 시트 첫 프레임 크롭: StellaPixelUI.cropSheets('img[src*="-idle.png"]')
 * 규칙: 유닛 고유색·캔버스 판정색은 절대 바꾸지 않는다. 상세는 ../UI_KIT_DAWN.md */
(function () {
  const U = 3; // 셰이프 픽셀 유닛(px)
  const PAL = {
    warm:  { o:'#241106', L:'#ffe8c6', D:'#7e3f1c', b:['#ffd9a8','#f7b678','#e89252','#c26a38','#9c4f28'], shine:1 },
    warmH: { o:'#241106', L:'#fff3dd', D:'#8e4a22', b:['#ffe4bc','#ffc78c','#f2a262','#d17a44','#ab5c32'], shine:1 },
    warmP: { o:'#241106', L:'#d9a878', D:'#6e3616', b:['#e89252','#d98548','#c67840','#b06a38','#9c4f28'] },
    teal:  { o:'#020809', L:'#6fb3ac', D:'#091114', b:['#2f4d54','#27434b','#203941','#192e36','#13242b'] },
    tealH: { o:'#020809', L:'#9adfc9', D:'#0b1518', b:['#3a5e66','#31525c','#284650','#203a44','#182e38'] },
    tealP: { o:'#020809', L:'#2f4d54', D:'#091114', b:['#182e36','#152a32','#12262e','#10222a','#0e1e26'] },
    flat:  { o:'#04080a', L:'#3d585c', D:'#0a1114', b:['#1e3238','#1a2c32','#16262c','#122026','#0e1a20'] },
    gold:  { o:'#2a1a04', L:'#fff3cf', D:'#8a5f1e', b:['#ffe9a8','#ffd978','#f2c055','#d9a43e','#b9832c'], shine:1 },
    goldH: { o:'#2a1a04', L:'#fffbe0', D:'#9a6b24', b:['#fff3c2','#ffe392','#fbcd68','#e2b04a','#c28f34'], shine:1 },
    goldP: { o:'#2a1a04', L:'#d9b878', D:'#775117', b:['#e2b04a','#d2a242','#c2943a','#b28632','#a2782c'] },
    pale:  { o:'#241d10', L:'#fffbe8', D:'#b9a97e', b:['#fff3d2','#f7e6b8','#e8d6a4','#d4bf8c','#bfa972'] },
    paleH: { o:'#241d10', L:'#ffffff', D:'#c9b98c', b:['#fff9e2','#ffedc8','#f2e0b4','#dec99c','#c9b382'] },
    paleP: { o:'#241d10', L:'#d9c99c', D:'#a99970', b:['#e8d6a4','#dcca98','#d0be8c','#c4b280','#b8a674'] },
    panel: { o:'#04080a', L:'#31474b', D:'#080e10', b:['#152225','#131e22','#111b1f','#0f181c','#0d1519'] },
    panelW:{ o:'#241106', L:'#c97a45', D:'#20140c', b:['#1c2a30','#18242a','#152025','#121c21','#101a1e'] },
    rose:  { o:'#2a0a12', L:'#ffc2cd', D:'#7a2434', b:['#ff9fb0','#f47d92','#e2607a','#c44a64','#a03750'], shine:1 },
    sunny: { o:'#2a1a04', L:'#fff6d8', D:'#a8600f', b:['#ffe9a8','#ffd06a','#f9b543','#e29327','#c2761a'], shine:1 }
  };
  const KINDS = {
    cta:       { shape:'pill',     idle:PAL.warm, hover:PAL.warmH, press:PAL.warmP },
    sub:       { shape:'round',    idle:PAL.teal, hover:PAL.tealH, press:PAL.tealP },
    tab:       { shape:'pill',     idle:PAL.flat, hover:PAL.tealH, press:PAL.tealP },
    tabActive: { shape:'pill',     idle:PAL.warm, hover:PAL.warmH, press:PAL.warmP },
    chip:      { shape:'pill',     idle:PAL.flat },
    star:      { shape:'star',     idle:PAL.gold, hover:PAL.goldH, press:PAL.goldP },
    moon:      { shape:'crescent', idle:PAL.pale, hover:PAL.paleH, press:PAL.paleP },
    heart:     { shape:'heart',    idle:PAL.rose },
    sun:       { shape:'sun',      idle:PAL.sunny },
    panel:     { shape:'round',    idle:PAL.panel },
    panelWarm: { shape:'round',    idle:PAL.panelW }
  };
  function shape(kind, w, h, pal) {
    const cw = Math.max(6, Math.round(w / U)), ch = Math.max(6, Math.round(h / U));
    let inside;
    if (kind === 'star') {
      const cx = cw / 2, cy = ch / 2, R = Math.min(cw, ch) / 2 - .5, r = R * .47, pts = [];
      for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rad = i % 2 ? r : R; pts.push([cx + Math.cos(a) * rad, cy + Math.sin(a) * rad]); }
      inside = (x, y) => { const px = x + .5, py = y + .5; let c = false;
        for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const xi = pts[i][0], yi = pts[i][1], xj = pts[j][0], yj = pts[j][1];
          if ((yi > py) !== (yj > py) && px < (xj - xi) * (py - yi) / (yj - yi) + xi) c = !c; }
        return c; };
    } else if (kind === 'heart') {
      /* (u²+v²-1)³ - u²v³ ≤ 0 — the classic heart curve, nudged down so the
         cleft sits inside the box instead of on its top edge. */
      const cx = cw / 2, cy = ch / 2, R = Math.min(cw, ch) / 2 - .5;
      inside = (x, y) => {
        const u = (x + .5 - cx) / (R * 1.14), v = (cy + R * .3 - (y + .5)) / (R * 1.08);
        const t = u * u + v * v - 1;
        return t * t * t - u * u * v * v * v <= 0;
      };
    } else if (kind === 'sun') {
      const cx = cw / 2, cy = ch / 2, R = Math.min(cw, ch) / 2 - .5, core = R * .58;
      inside = (x, y) => {
        const dx = x + .5 - cx, dy = y + .5 - cy, d = Math.sqrt(dx * dx + dy * dy);
        if (d <= core) return true;
        if (d > R) return false;
        const a = Math.atan2(dy, dx) * 180 / Math.PI, m = ((a % 45) + 45) % 45;
        return Math.min(m, 45 - m) < 2 + 11 * (1 - (d - core) / (R - core));
      };
    } else if (kind === 'crescent') {
      const cx = cw / 2, cy = ch / 2, R = Math.min(cw, ch) / 2 - .5;
      inside = (x, y) => { const px = x + .5 - cx, py = y + .5 - cy;
        if (px * px + py * py > R * R) return false;
        const ox = x + .5 - (cx + R * .5), oy = y + .5 - (cy - R * .22);
        return ox * ox + oy * oy > R * .78 * R * .78; };
    } else {
      const r = kind === 'pill' ? ch / 2 : ch * .3;
      inside = (x, y) => { const px = x + .5, py = y + .5;
        const qx = Math.max(r - px, px - (cw - r), 0), qy = Math.max(r - py, py - (ch - r), 0);
        return qx * qx + qy * qy <= r * r + .25; };
    }
    const c = document.createElement('canvas'); c.width = cw * U; c.height = ch * U;
    const g = c.getContext('2d'), bands = pal.b, n = bands.length;
    for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
      if (!inside(x, y)) continue;
      let col;
      if (!inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1)) col = pal.o;
      else if ((!inside(x, y - 2) || !inside(x - 2, y)) && y < ch / 2) col = pal.L;
      else if ((!inside(x, y + 2) || !inside(x + 2, y)) && y > ch / 2) col = pal.D;
      else { const rel = y / ch; let bi = Math.min(n - 1, Math.floor(rel * n)); if (rel * n - bi > .78 && bi < n - 1 && (x + y) % 2) bi++; col = bands[bi]; }
      g.fillStyle = col; g.fillRect(x * U, y * U, U, U);
    }
    if (pal.shine) { g.fillStyle = pal.L; const sx = Math.round(cw * .16), sy = Math.round(ch * .26);
      [[0, 0], [1, 0], [0, 1]].forEach(p => g.fillRect((sx + p[0]) * U, (sy + p[1]) * U, U, U)); }
    return c.toDataURL();
  }
  function setImg(el, url) { el.style.backgroundImage = 'url(' + url + ')'; el.style.setProperty('--pbtn-img', 'url(' + url + ')'); }
  function paint(el) {
    const w = el.offsetWidth, h = el.offsetHeight; if (!w || !h) return;
    const key = w + 'x' + h; if (el.dataset.psz === key) return; el.dataset.psz = key;
    const d = KINDS[el.dataset.pbtn]; if (!d) return;
    el._pf = { idle: shape(d.shape, w, h, d.idle), hover: d.hover && shape(d.shape, w, h, d.hover), press: d.press && shape(d.shape, w, h, d.press) };
    setImg(el, el._pf.idle); el.style.backgroundSize = '100% 100%'; el.style.imageRendering = 'pixelated';
  }
  function apply(root) {
    (root || document).querySelectorAll('[data-pbtn]').forEach(el => {
      if (!el.dataset.pdone) { el.dataset.pdone = 1;
        const base = el.style.filter || '';
        el.addEventListener('mouseenter', () => { if (el._pf && el._pf.hover) setImg(el, el._pf.hover); });
        el.addEventListener('mouseleave', () => { if (el._pf) setImg(el, el._pf.idle); el.style.transform = el.dataset.lift || ''; el.style.filter = base; });
        el.addEventListener('mousedown', () => { if (!el._pf || !el._pf.press) return; setImg(el, el._pf.press); el.style.transform = (el.dataset.lift || '') + ' translateY(3px)'; el.style.filter = 'drop-shadow(0 1px 0 #04080a)'; });
        el.addEventListener('mouseup', () => { if (!el._pf) return; setImg(el, el._pf.hover || el._pf.idle); el.style.transform = el.dataset.lift || ''; el.style.filter = base; });
      }
      paint(el);
    });
  }
  /* ---- 배경 데코 스프라이트 (달토끼·우주비행사·소품·아이콘) ---- */
  function px(rows, pal, s) {
    s = s || 4;
    const w = Math.max.apply(null, rows.map(r => r.length));
    const c = document.createElement('canvas'); c.width = w * s; c.height = rows.length * s;
    const g = c.getContext('2d');
    rows.forEach((r, y) => { for (let x = 0; x < r.length; x++) { const k = pal[r[x]]; if (k) { g.fillStyle = k; g.fillRect(x * s, y * s, s, s); } } });
    return c.toDataURL();
  }
  const palR = { w:'#eef4ec', W:'#c2cec6', P:'#e8a3a3', k:'#2a2f2e', M:'#8a5a38', m:'#c99a63', u:'#6b5642', U:'#8a7258', p:'#ffe9d8' };
  const palA = { w:'#e8eef0', v:'#1d3a40', V:'#7cc6bb', g:'#9aa7ab', o:'#eea56f' };
  const MAPS = {
    rabbitUp: [['.ww...ww............','.wPw..wPw...........','.wPw..wPw...........','..wwwwww......MM....','.wwwwwwww....MMMM...','.wkwwwkww....MMMM...','.wwwWWwww.....mm....','..wwwwwww.....mm....','.wwwwwwwwww..mm.....','.wwwwwwwwwwmmm......','.wwwwwwwww..........','..wwwwww...ppp......','..ww.ww...uUUUUu....','..........uuuuuu....','...........uuuu....'], palR],
    rabbitDown: [['.ww...ww............','.wPw..wPw...........','.wPw..wPw...........','..wwwwww............','.wwwwwwww...........','.wkwwwkww...........','.wwwWWwww...........','..wwwwwww...........','.wwwwwwwww..........','.wwwwwwwwwmmm.......','.wwwwwwwww..mm......','..wwwwww....MMMM....','..ww.ww...uUMMMM....','..........uuuuuu....','...........uuuu....'], palR],
    astroIdle: [['....wwwww....','...wwwwwww...','...wvvvvvw...','...wvvVvvw...','...wwwwwww...','..wwwooowww..','.ww.wwwww.ww.','.ww.wwwww.ww.','.gg.wwwww.gg.','....wwwww....','...www.www...','...ww...ww...','...gg...gg...'], palA],
    astroWave: [['..........gg.','....wwwww.ww.','...wwwwwww.ww','...wvvvvvw.ww','...wvvVvvwww.','...wwwwwwww..','..wwwooow....','.ww.wwwww....','.ww.wwwww....','.gg.wwwww....','....wwwww....','...www.www...','...ww...ww...','...gg...gg...'], palA],
    tele: [['.............bb.','...........bttb.','..........tttt..','........tttt....','.......tttt.....','......ttt.......','.....btb........','.....bbb........','....B.b.B.......','...B..b..B......','..B...b...B.....','.BB...b...BB....'], { t:'#2e3f43', b:'#c99a63', B:'#8a5a38' }],
    compass: [['...ggggg...','..gwwwwwg..','.gwwww.rwg.','.gwww.rwwg.','.gww.r.wwg.','.gwwtwwwwg.','.gwtwwwwwg.','..gwwwwwg..','...ggggg...'], { g:'#c99a63', w:'#f0ead8', r:'#d96a4a', t:'#47837c' }],
    coin: [['..oooo..','.oyyyyo.','oyyGGyyo','oyGyyGyo','oyGyyGyo','oyyGGyyo','.oyyyyo.','..oooo..'], { o:'#8a5f2e', y:'#e8b45f', G:'#c08a3e' }],
    orr: [['....hhhhhh....','...hhhhhhhh...','..hhHHHHHHhh..','..hHh....hHh..','..hh.e..e.hh..','..hh......hh..','..hhh.HH.hhh..','...hhhhhhhh...','..hhhhhhhhhh..','.hhhhhhhhhhhh.','.hhh.hhhh.hhh.'], { h:'#2e3f43', H:'#47646a', e:'#eea56f' }],
    emblem: [['...ggggg...','..g.....g..','.g...y...g.','g...yyy...g','g..yyyyy..g','g...yyy...g','.g...y...g.','..g.....g..','...ggggg...'], { g:'#c99a63', y:'#eea56f' }],
    rank: [['....yy......','....gg......','....gg......','.gg.gg......','.gg.gg..gg..','.gg.gg..gg..','.gggggggggg.'], { g:'#c99a63', y:'#eea56f' }],
    mail: [['gggggggggggg','gGG......GGg','g..GG..GG..g','g....GG....g','g..........g','g..........g','gggggggggggg'], { g:'#c99a63', G:'#8a5f2e' }]
  };
  const spriteCache = {};
  function sprite(name, scale) {
    const key = name + (scale || 4);
    if (!spriteCache[key] && MAPS[name]) spriteCache[key] = px(MAPS[name][0], MAPS[name][1], scale);
    return spriteCache[key];
  }
  /* 가로 스프라이트 시트 <img>의 첫 프레임만 표시 (프레임=정사각, 한 변=naturalHeight) */
  function cropSheets(selector) {
    document.querySelectorAll(selector || 'img[data-crop-first]').forEach(el => {
      if (el.dataset.cropped) return;
      const fix = () => {
        if (el.dataset.cropped) return;
        if (!el.naturalWidth || el.naturalWidth <= el.naturalHeight) { el.dataset.cropped = 1; return; }
        const f = el.naturalHeight, c = document.createElement('canvas'); c.width = f; c.height = f;
        c.getContext('2d').drawImage(el, 0, 0, f, f, 0, 0, f, f);
        el.dataset.cropped = 1; el.src = c.toDataURL();
      };
      if (el.complete && el.naturalWidth) fix(); else el.addEventListener('load', fix, { once: true });
    });
  }
  /* A kind's silhouette on its own, for places that want the symbol rather
     than a button: profile icons, legends, decoration. */
  const iconCache = {};
  function icon(kind, size) {
    const px = size || 48, key = kind + '@' + px, d = KINDS[kind];
    if (!d) return '';
    if (!iconCache[key]) iconCache[key] = shape(d.shape, px, px, d.idle);
    return iconCache[key];
  }
  window.StellaPixelUI = { apply, paint, shape, icon, sprite, cropSheets, PAL, KINDS, MAPS };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => apply());
  else apply();
  if (document.fonts) document.fonts.ready.then(() => {
    document.querySelectorAll('[data-pbtn]').forEach(el => { delete el.dataset.psz; paint(el); });
  });
})();
