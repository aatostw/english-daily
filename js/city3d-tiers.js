/* =========================================================
   城市 — every building's look in every era (階) of human history:
   1 部落 2 古典城邦 3 中世紀 4 文藝復興 5 工業 6 現代 7 未來.
   City3D.tierModel(g, type, t, i, win) draws one building into group g.
   t = era 1..7, i = level inside the era 0..2, win = the window material
   (glows at night). Front (the door) is +z; keep within about ±0.65.
   ========================================================= */
Object.assign(City3D, {
  /* ---------- shape helpers ---------- */
  cy(g, rt, rb, h, col, x, y, z, seg, extra){ const m = new this.T.Mesh(new this.T.CylinderGeometry(rt, rb, h, seg || 12), typeof col === "object" ? col : this.mat(col, extra)); m.position.set(x, y, z); g.add(m); return m; },
  sp(g, r, col, x, y, z, extra, half){ const T = this.T, m = new T.Mesh(half ? new T.SphereGeometry(r, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2) : new T.SphereGeometry(r, 14, 10), typeof col === "object" ? col : this.mat(col, extra)); m.position.set(x, y, z); g.add(m); return m; },
  co(g, r, h, col, x, y, z, seg, extra){ const m = new this.T.Mesh(new this.T.ConeGeometry(r, h, seg || 10), typeof col === "object" ? col : this.mat(col, extra)); m.position.set(x, y, z); g.add(m); return m; },
  ico(g, r, col, x, y, z, det){ const m = new this.T.Mesh(new this.T.IcosahedronGeometry(r, det || 0), typeof col === "object" ? col : this.mat(col)); m.position.set(x, y, z); g.add(m); return m; },
  glass(col){ return this.mat(col || 0xBFE8F2, {transparent:true, opacity:.5, roughness:.2, metalness:.1}); },
  glow(col, e){ return this.mat(col, {emissive:e || col, emissiveIntensity:.7}); },
  /* a gable roof at height y over a w × d box; turned = the ridge runs front to back (a gable faces the street) */
  gable(g, w, h, d, col, y, x, z, turned){ const r = new this.T.Group(); r.position.set(x || 0, 0, z || 0); if (turned) r.rotation.y = Math.PI / 2; g.add(r); this.roof(r, turned ? d : w, h, turned ? w : d, col, y); return r; },
  /* a row of n windows across the front (+z) at height y */
  winRow(g, win, n, w, y, z, gap){ for (let k = 0; k < n; k++) this.box(g, gap * .6, .1, .02, win, (k - (n - 1) / 2) * gap, y, z); },
  /* a band of windows round all four sides (one strip per side keeps the mesh count low) */
  winRing(g, win, w, d, y, x, z){
    x = x || 0; z = z || 0;
    this.box(g, w * .86, .09, .02, win, x, y, z + d / 2 + .01); this.box(g, w * .86, .09, .02, win, x, y, z - d / 2 - .01);
    this.box(g, .02, .09, d * .86, win, x + w / 2 + .01, y, z); this.box(g, .02, .09, d * .86, win, x - w / 2 - .01, y, z);
  },
  door(g, x, z, col, w, h){ this.box(g, w || .14, h || .22, .02, col || 0x8A6A4A, x, (h || .22) / 2, z); },
  lamp(g, x, z, h){ this.box(g, .025, h || .4, .025, 0x3B4A59, x, (h || .4) / 2, z); this.sp(g, .05, 0xFFE9A8, x, (h || .4) + .03, z, {emissive:0xFFD36B, emissiveIntensity:.6}); },
  solar(g, x, y, z, w, d, tilt){ const m = this.box(g, w, .02, d, 0x2E4A7A, x, y, z, {metalness:.4, roughness:.35}); m.rotation.x = tilt == null ? -.35 : tilt; return m; },
  halo(g, r, y, col, x, z){ const T = this.T, m = new T.Mesh(new T.TorusGeometry(r, .025, 8, 40), this.glow(col || 0x7FE3FF)); m.rotation.x = Math.PI / 2; m.position.set(x || 0, y, z || 0); g.add(m); return m; },
  crop(g, x, z, col, s, y){ return this.ico(g, .055 * (s || 1), col || 0x7FBF5E, x, (y || 0) + .1 * (s || 1), z); },
  columns(g, n, w, h, z, col, y0, r){ for (let k = 0; k < n; k++) this.cy(g, r || .035, (r || .035) * 1.15, h, col || 0xF7F3EC, n > 1 ? -w / 2 + k * w / (n - 1) : 0, (y0 || 0) + h / 2, z, 8); },
  fire(g, x, z, s){ s = s || 1; [0, 1.05, 2.1].forEach(a => { const l = this.box(g, .26 * s, .04 * s, .04 * s, 0x6B4A32, x, .03, z); l.rotation.y = a; }); this.co(g, .07 * s, .18 * s, this.glow(0xFFB13B, 0xFF7A1A), x, .12 * s, z, 6); },
  stones(g, n, r, h, col, y){ for (let k = 0; k < n; k++){ const a = k / n * Math.PI * 2; const m = this.box(g, .1, h, .08, col || 0xA9A49A, Math.cos(a) * r, (y || 0) + h / 2, Math.sin(a) * r); m.rotation.y = -a; } },
  /* a round hut: walls of colour wc, a conical roof of colour rc */
  hut(g, x, z, r, h, wc, rc, door){ this.cy(g, r, r * 1.05, h, wc, x, h / 2, z, 10); this.co(g, r * 1.35, h * 1.15, rc, x, h + h * .55, z, 10); if (door !== false) this.box(g, .1, h * .7, .02, 0x4A3527, x, h * .35, z + r); },
  tent(g, x, z, s, col){ this.co(g, .2 * s, .32 * s, col || 0xD9C9A3, x, .16 * s, z, 4).rotation.y = Math.PI / 4; },
  barrel(g, x, z, col){ this.cy(g, .06, .06, .12, col || 0x9C6B42, x, .06, z, 8); },
  crate(g, x, z, s){ this.box(g, .1 * (s || 1), .1 * (s || 1), .1 * (s || 1), 0xC9A26B, x, .05 * (s || 1), z); },
  smoke(g, x, y, z){ [0, 1, 2].forEach(k => this.sp(g, .05 + k * .02, this.mat(0xE8E8E8, {transparent:true, opacity:.6 - k * .15}), x + k * .04, y + k * .1, z)); },
  /* a little round tower with a cone roof */
  tower(g, x, z, r, h, col, rc){ this.cy(g, r, r, h, col, x, h / 2, z, 10); this.co(g, r * 1.25, r * 1.8, rc || 0x4F5D68, x, h + r * .9, z, 10); },
  /* battlements along the top of a wall */
  crenel(g, w, y, z, col){ for (let x = -w / 2 + .04; x <= w / 2 - .03; x += .1) this.box(g, .05, .06, .06, col, x, y + .03, z); },
  /* a classical pediment: a triangle facing the street */
  ped(g, w, h, d, col, y, z){ this.gable(g, w, h, d, col, y, 0, z || 0, true); },

  tierModel(g, type, t, i, win){
    const fn = this["tm_" + type]; if (!fn) return false;
    return fn.call(this, g, Math.min(7, t), i, win) !== false;
  },

  /* ======================= 市中心 ======================= */
  tm_hall(g, t, i, win){
    if (t === 1){
      /* 部落中心: a chief's longhouse with totems; then a palisade; then huts round it */
      this.box(g, .9, .3, .5, 0xB98B5E, 0, .15, -.05); this.gable(g, 1.0, .38, .62, 0xD9B76A, .3, 0, -.05);
      this.box(g, .14, .22, .02, 0x4A3527, 0, .11, .21);
      [-.55, .55].forEach(x => { this.cy(g, .05, .06, .6 + i * .1, 0x8A6447, x, .3 + i * .05, .3, 8); this.box(g, .14, .05, .03, 0xC9574A, x, .5, .3); });
      this.fire(g, 0, .48, .8);
      if (i >= 1) for (let x = -.6; x <= .61; x += .1) this.cy(g, .025, .025, .3, 0x8A6447, x, .15, -.55, 5);
      if (i >= 2){ this.hut(g, -.5, -.3, .14, .16, 0xB98B5E, 0xD9B76A, false); this.hut(g, .52, -.3, .14, .16, 0xB98B5E, 0xD9B76A, false); }
      return true;
    }
    if (t === 2){
      /* 城邦: a marble council temple; more columns, then a statue */
      const w = .9 + i * .15, d = .7;
      this.box(g, w + .16, .08, d + .16, 0xE6E0D4, 0, .04, 0); this.box(g, w + .08, .06, d + .08, 0xEDE8DE, 0, .11, 0);
      this.box(g, w * .7, .45, d * .7, 0xEDE7DC, 0, .37, -.02);
      const n = 4 + i * 2; this.columns(g, n, w - .05, .46, d / 2 - .02, 0xF7F3EC, .14, .035); this.columns(g, n, w - .05, .46, -d / 2 + .02, 0xF7F3EC, .14, .035);
      this.box(g, w + .06, .06, d + .04, 0xE6E0D4, 0, .63, 0); this.ped(g, w + .06, .2, d + .04, 0xC8663E, .66);
      if (i >= 2){ this.box(g, .12, .14, .12, 0xE6E0D4, .62, .07, .5); this.cy(g, .045, .05, .14, 0xC8A44A, .62, .21, .5, 8, {metalness:.4}); this.sp(g, .05, 0xC8A44A, .62, .32, .5, {metalness:.4}); }
      return true;
    }
    if (t === 3){
      /* 城堡: a keep; then curtain walls; then four corner towers */
      const kh = .9 + i * .1;
      this.box(g, .42, kh, .42, 0xB9B4AA, 0, kh / 2, -.05); this.crenel(g, .42, kh, .14, 0xB9B4AA); this.crenel(g, .42, kh, -.24, 0xB9B4AA);
      this.box(g, .1, .1, .02, win, 0, kh * .7, .165); this.box(g, .16, .22, .02, 0x5B4636, 0, .11, .165);
      if (i >= 1){ [[0, .52, 1.2, .06], [0, -.6, 1.2, .06], [-.6, -.04, .06, 1.1], [.6, -.04, .06, 1.1]].forEach(([x, z, w, d]) => this.box(g, w, .3, d, 0xC4BFB5, x, .15, z)); this.box(g, .22, .22, .08, 0x5B4636, 0, .11, .53); }
      if (i >= 2) [[-.6, .52], [.6, .52], [-.6, -.6], [.6, -.6]].forEach(([x, z]) => this.tower(g, x, z, .1, .48, 0xB9B4AA, 0x4F5D68));
      this.box(g, .02, .35, .02, 0x5B4636, 0, kh + .17, -.05); this.box(g, .18, .1, .01, 0x3F6FA8, .09, kh + .28, -.05);
      return true;
    }
    if (t === 4){
      /* 市政廳: the clock-tower hall, then the domed hall, then the domed hall with wings */
      if (i === 0){ this.building(g, "hall", win, false, 2, null, true); return true; }
      const wg = new this.T.Group(); g.add(wg); this.building(wg, "hall", win, false, 3, null, true);
      if (i === 2) [-.82, .82].forEach(x => { this.box(g, .34, .5, .7, 0xF4EFE6, x, .25, 0); this.box(g, .38, .05, .74, 0xD9CDB5, x, .52, 0); this.box(g, .18, .1, .02, win, x, .3, .36); });
      return true;
    }
    if (t === 5){
      /* 工業都市: a red-brick town hall with a clock tower and factory chimneys */
      const w = .95 + i * .12;
      this.box(g, w, .55, .6, 0xA84B35, 0, .275, 0); this.box(g, w + .04, .05, .64, 0xE8DCC8, 0, .56, 0); this.gable(g, w, .22, .6, 0x4A4F55, .58);
      this.winRow(g, win, 5, w, .38, .31, w / 5.5); this.box(g, .2, .26, .03, 0x3F3A36, 0, .13, .31);
      this.box(g, .28, 1.25 + i * .1, .28, 0xA84B35, 0, (1.25 + i * .1) / 2, -.1); this.cy(g, .09, .09, .02, 0xFFFFFF, 0, 1.0 + i * .1, .05).rotation.x = Math.PI / 2;
      this.co(g, .22, .3, 0x4A4F55, 0, 1.4 + i * .1, -.1, 4).rotation.y = Math.PI / 4;
      [-.5, .5].slice(0, 1 + (i >= 1 ? 1 : 0)).forEach(x => { this.cy(g, .06, .08, .9, 0x7A3E2E, x, .45, -.42, 8); this.smoke(g, x, .95, -.42); });
      return true;
    }
    if (t === 6){
      /* 都市中心: glass towers on a podium with a sky bridge */
      this.box(g, 1.3, .3, 1.0, 0xE4E7EA, 0, .15, 0); this.box(g, 1.1, .2, .02, win, 0, .17, .51);
      const tw = (x, z, h, w) => { this.box(g, w, h, w, this.glass(0x9FD3E6), x, .3 + h / 2, z); this.box(g, w + .04, .05, w + .04, 0xE4E7EA, x, .3 + h, z); for (let y = .45; y < .3 + h - .05; y += .18) this.winRing(g, win, w, w, y, x, z); };
      tw(-.32, -.1, 1.3 + i * .2, .4); tw(.34, .05, .95 + i * .15, .36);
      this.box(g, .3, .08, .12, 0xE4E7EA, 0, 1.0, -.03);
      this.box(g, .02, .35, .02, 0xC0C6CC, -.32, 1.8 + i * .2, -.1); this.sp(g, .035, 0xFF6B6B, -.32, 1.98 + i * .2, -.1, {emissive:0xFF3B3B, emissiveIntensity:.8});
      [-.5, .5].forEach(x => this.tree(g, x, .3, .4, .5, 0x7FB860));
      return true;
    }
    /* 宇宙文明中心: a white spire from a domed base, rings of light and a floating crystal */
    this.cy(g, .62, .66, .16, 0xF2F4F7, 0, .08, 0, 24); this.sp(g, .5, this.glass(0xBFEFFF), 0, .16, 0, null, true);
    this.cy(g, .1, .24, 1.6 + i * .2, 0xF7F8FA, 0, .9 + i * .1, 0, 16);
    this.halo(g, .42, .75, 0x7FE3FF); this.halo(g, .3, 1.25 + i * .1, 0xB89BFF); if (i >= 1) this.halo(g, .2, 1.6 + i * .1, 0x7FE3FF);
    const cr = new this.T.Mesh(new this.T.OctahedronGeometry(.16, 0), this.glow(0x9FE3FF, 0x58C6FF)); cr.position.y = 1.95 + i * .2; g.add(cr);
    [0, 1, 2, 3].forEach(k => { const a = k * Math.PI / 2 + Math.PI / 4; this.box(g, .06, .3, .06, 0xF7F8FA, Math.cos(a) * .55, .15, Math.sin(a) * .55); this.sp(g, .05, this.glow(0x7FE3FF), Math.cos(a) * .55, .34, Math.sin(a) * .55); });
    if (i >= 2) this.halo(g, .66, .1, 0xB89BFF);
    return true;
  },

  /* ======================= 住家 ======================= */
  tm_house(g, t, i, win){
    if (t === 1){
      if (i === 0){ this.hut(g, 0, 0, .26, .22, 0xD9B76A, 0xC9A04E); this.tree(g, -.45, 0, -.3, .6); return true; }   /* 茅草屋 */
      if (i === 1){ this.hut(g, 0, 0, .3, .28, 0xB98B5E, 0xD9B76A); this.box(g, .3, .03, .2, 0x8A6447, .4, .02, .3); this.barrel(g, -.38, .3, 0xA87B52); return true; }   /* 泥土屋 */
      this.box(g, .62, .34, .5, 0xA9A49A, 0, .17, 0); this.gable(g, .7, .26, .6, 0xD9B76A, .34);   /* 石屋 */
      this.door(g, 0, .26, 0x4A3527); this.box(g, .08, .08, .02, win, .2, .22, .26); this.stones(g, 5, .55, .08, 0x9C978D);
      return true;
    }
    if (t === 2){
      if (i === 0){ this.box(g, .62, .2, .5, 0xA9A49A, 0, .1, 0); this.box(g, .62, .22, .5, 0xC9A26B, 0, .31, 0); this.gable(g, .7, .22, .6, 0xC8663E, .42); this.door(g, 0, .26); this.box(g, .1, .08, .02, win, .2, .3, .26); return true; }   /* 木石屋 */
      if (i === 1){ this.box(g, .7, .46, .54, 0xEADBC4, 0, .23, 0); this.gable(g, .78, .24, .64, 0xC8663E, .46); this.door(g, 0, .28); this.winRow(g, win, 2, .5, .3, .28, .4); this.cy(g, .06, .04, .18, 0xB86B3E, -.42, .09, .35, 8); return true; }   /* 磚瓦屋 */
      /* 庭院宅邸: four wings round a courtyard with a pool */
      [[0, -.36, 1.0, .28], [0, .36, 1.0, .28], [-.36, 0, .28, .44], [.36, 0, .28, .44]].forEach(([x, z, w, d]) => this.box(g, w, .3, d, 0xEADBC4, x, .15, z));
      [[0, -.36, 1.0, .28], [0, .36, 1.0, .28]].forEach(([x, z, w, d]) => this.gable(g, w + .04, .14, d + .06, 0xC8663E, .3, x, z));
      this.box(g, .2, .02, .2, 0x7EC8E3, 0, .02, 0); this.box(g, .14, .22, .02, 0x8A6A4A, 0, .11, .51); this.tree(g, .12, 0, -.08, .45, 0x8FA86A);
      return true;
    }
    if (t === 3){
      const beams = (w, h, z, y0) => { for (let x = -w / 2 + .02; x <= w / 2; x += w / 4) this.box(g, .025, h, .02, 0x4A3527, x, y0 + h / 2, z); this.box(g, w, .025, .02, 0x4A3527, 0, y0 + h * .5, z); };
      if (i === 0){ this.box(g, .6, .5, .5, 0xF1E6CF, 0, .25, 0); beams(.6, .5, .26, 0); this.gable(g, .66, .38, .58, 0x4F5D68, .5); this.door(g, .14, .27, 0x4A3527); return true; }   /* 木筋屋 */
      if (i === 1){ this.box(g, .7, .7, .55, 0xB9B4AA, 0, .35, 0); this.gable(g, .76, .34, .62, 0x4F5D68, .7); this.winRow(g, win, 2, .6, .5, .28, .36); this.door(g, 0, .28, 0x4A3527); this.box(g, .1, .3, .1, 0x9C978D, .25, .95, -.1); return true; }   /* 石造民宅 */
      /* 莊園宅邸: a stone manor with two gabled wings and a round tower */
      this.box(g, .9, .55, .45, 0xC4BFB5, 0, .275, -.05); this.gable(g, .96, .3, .52, 0x4F5D68, .55, 0, -.05);
      [-.42, .42].forEach(x => { this.box(g, .26, .5, .3, 0xC4BFB5, x, .25, .28); this.gable(g, .3, .26, .34, 0x4F5D68, .5, x, .28, true); this.box(g, .1, .12, .02, win, x, .3, .44); });
      this.tower(g, .5, -.35, .12, .8, 0xB9B4AA); this.door(g, 0, .18, 0x4A3527);
      return true;
    }
    if (t === 4){
      if (i === 0){   /* 聯排屋: three narrow canal houses with stepped gables */
        [[-.34, 0xC9826A, .8], [0, 0xE8C88F, .95], [.34, 0x8FA7B5, .85]].forEach(([x, c, h]) => {
          this.box(g, .32, h, .5, c, x, h / 2, 0); for (let k = 0; k < 3; k++) this.box(g, .32 - k * .1, .07, .5, c, x, h + .035 + k * .07, 0);
          this.box(g, .12, .12, .02, win, x, h - .2, .26); this.box(g, .12, .12, .02, win, x, h - .45, .26); this.box(g, .1, .2, .02, 0x3F3A36, x, .1, .26); });
        return true;
      }
      if (i === 1){   /* 商人宅邸 */
        this.box(g, .78, .9, .58, 0xE8C88F, 0, .45, 0); this.box(g, .82, .05, .62, 0xF4EFE6, 0, .9, 0); this.gable(g, .82, .26, .62, 0xC2553B, .92);
        [.3, .6].forEach(y => this.winRow(g, win, 3, .7, y, .3, .22)); this.box(g, .4, .03, .12, 0xF4EFE6, 0, .48, .35); this.box(g, .4, .08, .01, 0x3F3A36, 0, .53, .41); this.door(g, 0, .3, 0x6B3F25);
        return true;
      }
      /* 宮殿宅邸: a symmetrical palazzo with a pediment and a small garden */
      this.box(g, 1.15, .75, .55, 0xF0DDB4, 0, .375, -.05); this.box(g, 1.19, .06, .59, 0xF4EFE6, 0, .78, -.05);
      [.25, .55].forEach(y => this.winRow(g, win, 5, 1.0, y, .23, .22)); this.ped(g, .44, .18, .1, 0xF4EFE6, .81, .19);
      this.box(g, .2, .28, .03, 0x6B3F25, 0, .14, .23); this.box(g, 1.15, .02, .3, 0x8FC46A, 0, .01, .42); [-.4, .4].forEach(x => this.co(g, .08, .22, 0x5E9E4E, x, .12, .42, 8));
      return true;
    }
    if (t === 5){
      if (i === 0){   /* 工人排屋: a row of brick houses with chimneys */
        this.box(g, 1.1, .45, .5, 0xA84B35, 0, .225, 0); this.gable(g, 1.14, .22, .56, 0x4A4F55, .45);
        [-.36, 0, .36].forEach(x => { this.door(g, x - .07, .26, 0x2F3A44, .1, .2); this.box(g, .1, .1, .02, win, x + .08, .25, .26); this.box(g, .07, .16, .07, 0x7A3E2E, x, .7, -.08); });
        return true;
      }
      /* 紅磚公寓 / 鐵窗公寓 (with iron fire escapes) */
      const fl = i === 1 ? 4 : 6, h = fl * .22;
      this.box(g, .78, h, .6, 0xA84B35, 0, h / 2, 0); this.box(g, .82, .05, .64, 0xE8DCC8, 0, h + .02, 0);
      for (let f = 0; f < fl; f++){ const y = .14 + f * .22; this.winRow(g, win, 3, .7, y, .31, .22); if (f) this.box(g, .76, .02, .02, 0xE8DCC8, 0, y - .09, .31); }
      this.door(g, 0, .31, 0x2F3A44);
      if (i === 2){ for (let f = 1; f < fl; f++){ this.box(g, .3, .02, .12, 0x3B4046, .24, .06 + f * .22, .37); this.box(g, .3, .08, .01, 0x3B4046, .24, .1 + f * .22, .43); } this.box(g, .02, h - .2, .02, 0x3B4046, .38, h / 2 + .05, .43); }
      [-.25, .25].forEach(x => this.box(g, .08, .2, .08, 0x7A3E2E, x, h + .12, -.15));
      return true;
    }
    if (t === 6){
      /* 住宅大樓 → 摩天公寓 → 綠能大樓 */
      const h = [1.5, 2.3, 2.0][i];
      this.box(g, .8, .22, .7, 0xD8DDE2, 0, .11, 0); this.box(g, .6, .2, .02, win, 0, .12, .36);
      this.box(g, .56, h, .5, i === 2 ? 0xF2F4F0 : 0xEDEFF2, 0, .22 + h / 2, 0);
      for (let y = .38; y < .22 + h - .1; y += .2){ this.winRing(g, win, .56, .5, y); if (i === 2) this.box(g, .62, .05, .56, 0x6FAE57, 0, y - .08, 0); }
      if (i === 2){ this.solar(g, -.12, .26 + h, 0, .22, .3, -.3); this.solar(g, .14, .26 + h, 0, .22, .3, -.3); this.tree(g, 0, .22 + h, -.15, .4); }
      else { this.box(g, .4, .14, .36, 0xC9CED4, 0, .29 + h, 0); this.box(g, .02, .3, .02, 0xC0C6CC, .1, .5 + h, 0); }
      [-.5, .5].forEach(x => this.tree(g, x, 0, .35, .55, 0x7FB860));
      return true;
    }
    /* 未來住宅 → 浮空住宅 → 太空居住艙 */
    if (i === 0){
      this.cy(g, .08, .12, .9, 0xF7F8FA, 0, .45, 0, 12);
      [[0, .5, 0, .34], [-.3, .9, .05, .26]].forEach(([x, y, z, r]) => { if (x) this.box(g, Math.abs(x), .05, .06, 0xF7F8FA, x / 2, y - r * .3, z); const p = this.sp(g, r, 0xF7F8FA, x, y, z); p.scale.y = .62; const b = this.sp(g, r * .98, this.glass(0x9FD3E6), x, y + .02, z + .02); b.scale.set(.9, .32, 1); this.box(g, r * 1.2, .04, r * 1.2, 0x8CC46E, x, y - r * .5, z); });
      this.solar(g, .42, .25, .32, .22, .16); this.tree(g, -.45, 0, -.4, .6, 0x7FB860);
      return true;
    }
    if (i === 1){
      /* homes floating above glowing rings */
      [[-.2, .55, 0, .3], [.28, .95, -.1, .24], [-.05, 1.35, .05, .2]].forEach(([x, y, z, r]) => { const p = this.sp(g, r, 0xF7F8FA, x, y, z); p.scale.y = .6; const b = this.sp(g, r * .98, this.glass(0x9FD3E6), x, y + .02, z); b.scale.set(.92, .3, 1); this.halo(g, r * .8, y - r * .45, 0x7FE3FF, x, z); });
      this.cy(g, .3, .34, .06, this.glow(0x7FE3FF, 0x3FB8E8), 0, .03, 0, 20);
      return true;
    }
    /* 太空居住艙: a ring habitat round a central hub */
    const ring = new this.T.Mesh(new this.T.TorusGeometry(.48, .09, 10, 36), this.mat(0xF7F8FA)); ring.rotation.x = Math.PI / 2 - .3; ring.position.y = .85; g.add(ring);
    const band = new this.T.Mesh(new this.T.TorusGeometry(.48, .095, 6, 36), this.glass(0x9FD3E6)); band.rotation.x = Math.PI / 2 - .3; band.position.y = .85; band.scale.set(1, 1, .5); g.add(band);
    this.cy(g, .04, .04, .96, 0xE4E7EA, 0, .85, 0, 8).rotation.x = Math.PI / 2 - .3; this.sp(g, .14, this.glow(0x9FE3FF, 0x58C6FF), 0, .85, 0);
    this.cy(g, .06, .14, .7, 0xF7F8FA, 0, .35, 0, 10); this.cy(g, .35, .38, .05, 0xE4E7EA, 0, .025, 0, 20);
    return true;
  },

  /* ======================= 農田 ======================= */
  tm_farm(g, t, i, win){
    const soil = (w, d, col) => this.box(g, w || 1.2, .05, d || .95, col || 0x8A6447, 0, .025, 0);
    const wheat = (x0, x1, zs) => (zs || [-.32, -.16, 0, .16, .32]).forEach(z => { for (let x = x0; x <= x1; x += .1) this.box(g, .04, .16, .04, 0xE2C25C, x, .13, z); });
    if (t === 1){
      if (i === 0){   /* 採集地: berry bushes and a basket */
        this.box(g, 1.1, .03, .9, 0x9CB878, 0, .015, 0);
        [[-.3, -.2], [.25, -.25], [-.1, .2], [.35, .2]].forEach(([x, z]) => { this.ico(g, .14, 0x5E9E4E, x, .12, z); this.ico(g, .03, 0xC0392B, x + .06, .2, z + .08); this.ico(g, .03, 0x6B3FA0, x - .05, .18, z + .1); });
        this.cy(g, .08, .06, .1, 0xC9A04E, .1, .05, .42, 8); return true;
      }
      soil(); wheat(-.45, .45, i === 2 ? [-.36, -.2, .16, .32] : undefined);   /* 麥田 */
      if (i === 2){ this.box(g, 1.2, .03, .1, 0x6FBEDC, 0, .05, -.02); this.box(g, .1, .03, .5, 0x6FBEDC, -.55, .05, .22); }   /* 灌溉田 */
      return true;
    }
    if (t === 2){
      soil(1.2, .95, 0x9C7A55);
      if (i === 0){ [-.3, 0, .3].forEach(z => [-.4, -.13, .14, .41].forEach(x => { this.cy(g, .025, .03, .12, 0x6B5A48, x, .06, z, 5); this.ico(g, .12, 0x8FA86A, x, .2, z); })); return true; }   /* 橄欖園 */
      if (i === 1){ [-.3, -.1, .1, .3].forEach(z => { this.box(g, 1.0, .02, .02, 0x6B5240, 0, .2, z); [-.45, 0, .45].forEach(x => this.box(g, .02, .2, .02, 0x6B5240, x, .1, z)); for (let x = -.4; x <= .41; x += .13){ this.ico(g, .05, 0x6FAE57, x, .17, z); this.ico(g, .03, 0x6B3FA0, x, .11, z + .03); } }); return true; }   /* 葡萄園 */
      /* 莊園農地: vines, olives and a red-tiled farmhouse */
      [-.05, .15, .35].forEach(z => { for (let x = -.45; x <= .1; x += .13) this.ico(g, .05, 0x6FAE57, x, .14, z); });
      this.box(g, .4, .3, .3, 0xEADBC4, .35, .15, -.22); this.gable(g, .44, .14, .36, 0xC8663E, .3, .35, -.22); [-.35, -.1].forEach(x => this.ico(g, .12, 0x8FA86A, x, .2, -.3));
      return true;
    }
    if (t === 3){
      soil();
      if (i === 0){ [[-.36, 0xE2C25C], [0, 0x6FAE57], [.36, 0x9C7A55]].forEach(([x, c]) => { this.box(g, .34, .04, .9, c, x, .05, 0); if (c !== 0x9C7A55) for (let z = -.35; z <= .36; z += .14) this.box(g, .04, .1, .04, c, x, .12, z); }); return true; }   /* 三圃田 */
      wheat(-.45, .1);
      if (i === 1){   /* 水車磨坊 */
        this.box(g, .36, .36, .36, 0xB9B4AA, .38, .18, -.15); this.gable(g, .4, .2, .4, 0x8A5A3A, .36, .38, -.15);
        const wh = this.cy(g, .2, .2, .06, 0x8A6447, .38, .2, .07, 12); wh.rotation.x = Math.PI / 2; this.box(g, .7, .03, .12, 0x6FBEDC, .25, .03, .2); return true;
      }
      /* 修道院農園: a small stone chapel and a cloister wall */
      this.box(g, .3, .36, .5, 0xC4BFB5, .4, .18, -.1); this.gable(g, .3, .2, .54, 0x4F5D68, .36, .4, -.1, true); this.box(g, .1, .2, .1, 0xC4BFB5, .4, .46, .12); this.co(g, .08, .16, 0x4F5D68, .4, .64, .12, 4);
      this.box(g, 1.2, .14, .04, 0xC4BFB5, 0, .07, -.46);
      return true;
    }
    if (t === 4){
      soil(1.2, .95, 0x7FA35A);
      for (let x = -.58; x <= .59; x += .2) this.box(g, .03, .14, .03, 0xA88760, x, .07, .46); this.box(g, 1.2, .02, .02, 0xA88760, 0, .12, .46);
      if (i === 0){ [[-.3, .1], [.1, -.15], [.3, .2], [-.1, -.3]].forEach(([x, z]) => { this.box(g, .14, .1, .08, 0xF4F1EA, x, .1, z); this.box(g, .04, .05, .04, 0x3F3A36, x + .09, .12, z); }); return true; }   /* 圍欄農場 + 羊 */
      wheat(-.45, .1, [-.3, -.1, .1, .3]);
      if (i === 1){   /* 風車農場 */
        this.cy(g, .14, .2, .7, 0xEADBC4, .35, .35, -.1, 8); this.co(g, .18, .2, 0xC2553B, .35, .8, -.1, 8);
        for (let k = 0; k < 4; k++){ const b = this.box(g, .08, .5, .015, 0xF4F1EA, .35, .62, .12); b.geometry.translate(0, .25, 0); b.rotation.z = k * Math.PI / 2 + .4; } return true;
      }
      /* 莊園溫室: a classical orangery */
      this.box(g, .46, .34, .3, this.glass(0xD6F0F5), .32, .17, -.2); this.box(g, .5, .05, .34, 0xF4EFE6, .32, .36, -.2);
      for (let k = 0; k < 4; k++) this.cy(g, .02, .02, .32, 0xF4EFE6, .14 + k * .12, .16, -.04, 6);
      [.2, .44].forEach(x => this.ico(g, .07, 0xF3A43B, x, .12, -.2));
      return true;
    }
    if (t === 5){
      soil(); wheat(-.45, .05);
      if (i === 0){   /* 蒸汽農場: a steam engine */
        this.cy(g, .1, .1, .36, 0x3B4046, .35, .2, 0, 12).rotation.z = Math.PI / 2; this.cy(g, .03, .04, .3, 0x3B4046, .45, .45, 0, 8); this.smoke(g, .45, .65, 0);
        [.22, .48].forEach(x => { const w = this.cy(g, .1, .1, .03, 0x7A3E2E, x, .1, .12, 12); w.rotation.x = Math.PI / 2; }); return true;
      }
      if (i === 1){   /* 曳引機農場 */
        this.box(g, .26, .12, .16, 0xC0392B, .32, .16, .1); this.box(g, .1, .1, .14, 0xC0392B, .26, .27, .1); this.box(g, .02, .14, .02, 0x3B4046, .4, .3, .1);
        [[.22, .02], [.22, .18]].forEach(([x, z]) => { const w = this.cy(g, .09, .09, .04, 0x2F3A44, x, .09, z, 12); w.rotation.x = Math.PI / 2; });
        [[.42, .04], [.42, .17]].forEach(([x, z]) => { const w = this.cy(g, .05, .05, .03, 0x2F3A44, x, .05, z, 10); w.rotation.x = Math.PI / 2; }); return true;
      }
      /* 大穀倉: a red barn and two silos */
      this.box(g, .42, .4, .5, 0xB23A2E, .3, .2, -.15); this.gable(g, .46, .24, .54, 0x6B6B6B, .4, .3, -.15, true); this.box(g, .2, .22, .02, 0xF4F1EA, .3, .11, .11);
      [[-.45, -.3], [-.25, -.35]].forEach(([x, z]) => { this.cy(g, .1, .1, .7, 0xC9CED4, x, .35, z); this.sp(g, .1, 0xB0B8C0, x, .7, z, null, true); });
      return true;
    }
    if (t === 6){
      if (i === 0){   /* 溫室: glass arch greenhouses */
        soil();
        for (let k = 0; k < 3; k++){ const x = (k - 1) * .37; const a = new this.T.Mesh(new this.T.CylinderGeometry(.16, .16, .86, 14, 1, false, -Math.PI / 2, Math.PI), this.glass()); a.rotation.x = -Math.PI / 2; a.position.set(x, .06, 0); g.add(a); for (let z = -.3; z <= .31; z += .15) this.crop(g, x, z, k % 2 ? 0xE57373 : 0x7FBF5E, .9); }
        return true;
      }
      if (i === 1){   /* 室內農場: grow-light windows, silo and solar roof */
        this.box(g, .9, .5, .7, 0xE7E2DA, -.08, .25, 0); this.box(g, .96, .05, .76, 0x8E99A6, -.08, .52, 0);
        const pur = this.glow(0xC79BFF, 0xA06BFF); for (let x = -.38; x <= .25; x += .21) this.box(g, .14, .14, .02, pur, x, .32, .36);
        this.box(g, .2, .25, .02, 0x6E8FB0, -.08, .125, .36); this.cy(g, .14, .14, .7, 0xD9DDE2, .5, .35, -.15); this.co(g, .15, .12, 0xB0B8C0, .5, .76, -.15);
        this.solar(g, -.3, .58, 0, .32, .5, -.25); this.solar(g, .12, .58, 0, .32, .5, -.25); return true;
      }
      /* 垂直農場 */
      const fl = 5, h = fl * .26; this.box(g, .7, h, .7, this.glass(0xBFEFE0), 0, h / 2 + .02, 0);
      for (let f = 0; f < fl; f++){ const y = .04 + f * .26; this.box(g, .74, .03, .74, 0xE4E7EA, 0, y, 0); this.box(g, .6, .06, .6, 0x6FAE57, 0, y + .05, 0); }
      this.box(g, .74, .04, .74, 0xE4E7EA, 0, h + .04, 0); this.cy(g, .03, .03, .5, 0xF4F4F0, .2, h + .3, .2, 6);
      for (let k = 0; k < 3; k++){ const b = this.box(g, .04, .32, .015, 0xF4F4F0, .2, h + .56, .22); b.geometry.translate(0, .14, 0); b.rotation.z = k * 2.094; }
      return true;
    }
    /* 科技農場 → 水耕穹頂 → 太空農場 */
    this.cy(g, .6, .62, .08, 0xE4E7EA, 0, .04, 0, 24);
    if (i < 2){
      this.sp(g, .5, this.glass(0xBFEFE0), 0, .08, 0, null, true);
      for (let a = 0; a < 6; a++) this.crop(g, Math.cos(a) * .25, Math.sin(a) * .25, a % 2 ? 0xF3CC58 : 0x7FBF5E, 1.2);
      if (i === 0){ this.box(g, .12, .03, .12, 0x3B4A59, -.35, .85, .2); this.solar(g, .5, .12, .45, .26, .16); this.solar(g, -.5, .12, .45, .26, .16); }
      else { [-.2, 0, .2].forEach(x => this.cy(g, .03, .03, .4, this.glow(0x7FE3FF, 0x3FB8E8), x, .28, -.1, 8)); this.halo(g, .55, .45, 0x7FE3FF); }
      return true;
    }
    /* 太空農場: green domes on a platform under a halo */
    [[-.28, -.15, .24], [.28, -.1, .22], [0, .28, .2]].forEach(([x, z, r]) => { this.cy(g, r, r, .04, 0x6FAE57, x, .1, z, 16); this.sp(g, r, this.glass(0xBFEFE0), x, .1, z, null, true); this.ico(g, r * .5, 0x7FBF5E, x, .16, z); });
    this.halo(g, .62, .7, 0xB89BFF);
    return true;
  },

  /* ======================= 公園 ======================= */
  tm_park(g, t, i, win){
    const lawn = col => this.box(g, 1.3, .02, 1.1, col || 0x9CC77A, 0, .01, 0);
    const bench = (x, z) => this.box(g, .3, .04, .1, 0xA0784F, x, .12, z);
    if (t === 1){
      lawn(0xA7C084); this.fire(g, 0, 0);
      if (i === 0){ [[-.3, .15], [.3, .15], [0, -.32]].forEach(([x, z], k) => { const l = this.cy(g, .05, .05, .28, 0x8A6447, x, .05, z, 8); l.rotation.z = Math.PI / 2; l.rotation.y = k; }); this.tree(g, -.45, 0, -.4, .9); return true; }   /* 營火空地 */
      if (i === 1){ this.stones(g, 9, .32, .08, 0xA9A49A); this.cy(g, .05, .06, .6, 0x8A6447, -.5, .3, -.35, 8); [.15, .3, .45].forEach((y, k) => this.box(g, .13, .06, .13, [0xC9574A, 0xF3CC58, 0x4C8BE0][k], -.5, y, -.35)); return true; }   /* 聚會圈 */
      /* 石陣 */
      for (let k = 0; k < 8; k++){ const a = k / 8 * Math.PI * 2; this.box(g, .1, .42, .08, 0xA9A49A, Math.cos(a) * .42, .21, Math.sin(a) * .42).rotation.y = -a; if (k % 2 === 0){ const a2 = a + Math.PI / 8; this.box(g, .34, .06, .08, 0x9C978D, Math.cos(a2) * .42, .45, Math.sin(a2) * .42).rotation.y = -a2 + Math.PI / 2; } }
      return true;
    }
    if (t === 2){
      this.box(g, 1.3, .03, 1.1, 0xEDE6D8, 0, .015, 0);
      if (i < 2){   /* 集會廣場 / 雕像廣場: a stoa along the back */
        this.box(g, 1.1, .05, .28, 0xE6E0D4, 0, .03, -.38); this.columns(g, 7, 1.0, .36, -.28, 0xF7F3EC, .05, .03); this.box(g, 1.1, .05, .26, 0xE6E0D4, 0, .44, -.38); this.box(g, 1.0, .36, .04, 0xEDE7DC, 0, .23, -.5);
        bench(-.35, .3); bench(.35, .3);
        if (i === 1){ this.box(g, .16, .2, .16, 0xE6E0D4, 0, .1, .15); this.cy(g, .05, .06, .2, 0xF4F1EA, 0, .3, .15, 8); this.sp(g, .06, 0xF4F1EA, 0, .45, .15); }
        return true;
      }
      /* 露天劇場: half-rings of stone steps facing a stage */
      for (let k = 3; k >= 0; k--){ const r = .25 + k * .1; const m = new this.T.Mesh(new this.T.CylinderGeometry(r, r, .08 * (k + 1), 20, 1, false, Math.PI / 2, Math.PI), this.mat(k % 2 ? 0xC9BFAE : 0xDAD2C2)); m.position.set(0, .04 * (k + 1), -.05); g.add(m); }
      this.box(g, .5, .05, .2, 0xD8CCB6, 0, .03, .38); this.columns(g, 4, .44, .3, .45, 0xF7F3EC, .05, .025);
      return true;
    }
    if (t === 3){
      if (i === 0){   /* 修道院花園: square beds, a well, a wall */
        lawn(0x8FC46A);
        [[-.3, -.25], [.3, -.25], [-.3, .25], [.3, .25]].forEach(([x, z], k) => { this.box(g, .36, .06, .3, 0x6B4A32, x, .03, z); for (let dx = -.12; dx <= .13; dx += .12) this.crop(g, x + dx, z, [0xF48FB1, 0xBA68C8, 0x7FBF5E, 0xF3CC58][k], .8); });
        this.cy(g, .1, .1, .12, 0xB9B4AA, 0, .06, 0, 10); this.box(g, .02, .22, .02, 0x5B4636, -.08, .17, 0); this.box(g, .02, .22, .02, 0x5B4636, .08, .17, 0); this.gable(g, .22, .06, .12, 0x4F5D68, .28);
        this.box(g, 1.3, .12, .04, 0xB9B4AA, 0, .06, -.54); return true;
      }
      this.box(g, 1.3, .03, 1.1, 0xCFC6B6, 0, .015, 0);
      if (i === 1){   /* 市集廣場: stalls with awnings round a well */
        [[-.4, -.3, 0xC9574A], [.4, -.3, 0x3F6FA8], [-.4, .3, 0xE2A93B], [.4, .3, 0x4DB892]].forEach(([x, z, c]) => { this.box(g, .28, .14, .2, 0xC9A26B, x, .07, z); const a = this.box(g, .32, .02, .26, c, x, .3, z); a.rotation.x = .2; [-.13, .13].forEach(dx => this.box(g, .02, .3, .02, 0x6b5240, x + dx, .15, z + .1)); });
        this.cy(g, .1, .1, .12, 0xB9B4AA, 0, .06, 0, 10); return true;
      }
      /* 城堡庭園: hedges, a fountain and a corner tower */
      [[-.3, -.2], [.3, -.2], [-.3, .25], [.3, .25]].forEach(([x, z]) => this.box(g, .34, .14, .26, 0x4E8A44, x, .07, z));
      this.cy(g, .14, .16, .08, 0xB9B4AA, 0, .04, .02, 12); this.cy(g, .12, .12, .02, 0x7EC8E3, 0, .09, .02, 12);
      this.tower(g, -.55, -.45, .12, .6, 0xB9B4AA); this.box(g, 1.0, .25, .05, 0xB9B4AA, .1, .125, -.5); this.crenel(g, 1.0, .25, -.5, 0xB9B4AA);
      return true;
    }
    if (t === 4){
      this.box(g, 1.3, .02, 1.1, 0xE9DCC3, 0, .01, 0);
      const fountain = s => { this.cy(g, .32 * s, .34 * s, .1, 0xD5DBDF, 0, .06, 0, 16); this.cy(g, .28 * s, .28 * s, .02, 0x7EC8E3, 0, .11, 0, 16); this.cy(g, .04, .05, .3 * s, 0xD5DBDF, 0, .25 * s, 0, 8); this.sp(g, .07 * s, 0xA8E0F0, 0, .42 * s, 0); };
      if (i === 0){ fountain(1); bench(-.5, .35); bench(.5, .35); this.lamp(g, -.55, -.4, .45); this.lamp(g, .55, -.4, .45); return true; }   /* 噴泉廣場 */
      /* 幾何花園 / 宮廷花園: parterres of clipped hedges */
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => { const x = sx * .33, z = sz * .28; this.box(g, .4, .06, .03, 0x3F7A3A, x, .03, z - .12); this.box(g, .4, .06, .03, 0x3F7A3A, x, .03, z + .12); this.box(g, .03, .06, .27, 0x3F7A3A, x - .2, .03, z); this.box(g, .03, .06, .27, 0x3F7A3A, x + .2, .03, z); this.co(g, .05, .18, 0x3F7A3A, x, .09, z, 8); });
      if (i === 2){ fountain(.6); [-.6, .6].forEach(x => { this.box(g, .1, .14, .1, 0xF4EFE6, x, .07, 0); this.cy(g, .03, .04, .14, 0xF4EFE6, x, .21, 0, 8); this.sp(g, .04, 0xF4EFE6, x, .3, 0); }); }
      return true;
    }
    if (t === 5){
      if (i === 0){   /* 公共公園 */
        lawn(); this.box(g, 1.3, .015, .16, 0xE9DCC3, 0, .02, 0); this.box(g, .16, .015, 1.1, 0xE9DCC3, 0, .02, 0);
        [[-.4, -.3, 1], [.42, -.32, .9], [-.4, .32, .85], [.4, .3, 1]].forEach(([x, z, s]) => this.tree(g, x, 0, z, s, 0x6FAE57)); this.lamp(g, .12, .12, .45); bench(-.18, -.15); return true;
      }
      if (i === 1){   /* 玻璃溫室: a Victorian glasshouse */
        lawn();
        this.box(g, 1.0, .4, .55, this.glass(0xD6F0F5), 0, .2, 0); const r = new this.T.Mesh(new this.T.CylinderGeometry(.27, .27, 1.0, 14, 1, false, 0, Math.PI), this.glass(0xD6F0F5)); r.rotation.z = Math.PI / 2; r.position.y = .4; g.add(r);
        this.sp(g, .22, this.glass(0xD6F0F5), 0, .62, 0, null, true); for (let x = -.45; x <= .46; x += .15) this.box(g, .015, .4, .015, 0xFFFFFF, x, .2, .28); [-.25, .1, .3].forEach(x => this.tree(g, x, 0, 0, .6, 0x5FB06A)); return true;
      }
      /* 遊樂園: a Ferris wheel and a carousel */
      this.box(g, 1.3, .02, 1.1, 0xE9DCC3, 0, .01, 0);
      const wheel = new this.T.Group(); wheel.position.set(-.2, .62, -.2); g.add(wheel);
      wheel.add(new this.T.Mesh(new this.T.TorusGeometry(.48, .02, 6, 30), this.mat(0xE8E8E8)));
      for (let k = 0; k < 8; k++){ const a = k / 8 * Math.PI * 2; this.box(wheel, .015, .96, .015, 0xE8E8E8, 0, 0, 0).rotation.z = a; this.box(wheel, .08, .08, .08, [0xE57373, 0xF3CC58, 0x4C8BE0, 0x4DB892][k % 4], Math.cos(a) * .48, Math.sin(a) * .48 - .06, 0); }
      [-.15, .15].forEach(dx => this.box(g, .03, .66, .03, 0x9AA3AB, -.2 + dx, .31, -.2).rotation.z = dx > 0 ? .25 : -.25);
      this.cy(g, .25, .25, .05, 0xF4F1EA, .38, .05, .3, 16); this.cy(g, .02, .02, .35, 0xC8A44A, .38, .22, .3, 6); this.co(g, .28, .14, 0xE57373, .38, .44, .3, 12);
      [0, 1, 2, 3].forEach(k => this.box(g, .06, .08, .1, 0xF4F1EA, .38 + Math.cos(k * 1.57) * .18, .14, .3 + Math.sin(k * 1.57) * .18));
      return true;
    }
    if (t === 6){
      if (i === 0){   /* 中央公園 */
        lawn(0x8FC46A); const lake = this.cy(g, .42, .42, .02, 0x6FBEDC, -.15, .03, .1, 20); lake.scale.z = .75;
        [[.45, -.35, 1.1], [-.5, -.4, 1.0], [.5, .4, .9]].forEach(([x, z, s]) => this.tree(g, x, 0, z, s, 0x6FAE57)); this.lamp(g, -.6, .45, .4); return true;
      }
      if (i === 1){   /* 空中花園: stepped terraces */
        for (let k = 0; k < 4; k++){ const s = 1.1 - k * .2, y = k * .2; this.box(g, s, .2, s * .85, 0xE4DCCF, 0, y + .1, -k * .04); this.box(g, s - .06, .05, s * .85 - .06, 0x6FAE57, 0, y + .22, -k * .04); if (k < 3) this.tree(g, s / 2 - .12, y + .2, s * .3, .45, k % 2 ? 0xF6B8CF : 0x7FB860); }
        this.box(g, .1, .8, .02, this.mat(0x8ED1E6, {transparent:true, opacity:.75}), -.15, .4, .48); return true;
      }
      /* 運動公園: a running track round a pitch, with a stand */
      const tr = this.cy(g, .6, .6, .02, 0xC9574A, 0, .01, .05, 28); tr.scale.z = .7; const fd = this.cy(g, .45, .45, .025, 0x6FAE57, 0, .015, .05, 28); fd.scale.z = .58;
      this.box(g, .02, .03, .4, 0xFFFFFF, 0, .03, .05); [-.32, .32].forEach(x => this.box(g, .02, .12, .14, 0xFFFFFF, x, .07, .05));
      for (let k = 0; k < 3; k++) this.box(g, .9, .06, .08, 0x9AA3AB, 0, .03 + k * .06, -.42 - k * .06);
      return true;
    }
    /* 生態穹頂 → 全像公園 → 星空花園 */
    this.cy(g, .62, .64, .08, 0xE4E7EA, 0, .04, 0, 24); this.box(g, 1.0, .02, 1.0, 0x8FC46A, 0, .09, 0);
    if (i === 0){ [[-.2, -.15, 1.0], [.22, .05, .9], [-.05, .25, .8]].forEach(([x, z, s]) => this.tree(g, x, .08, z, s, 0x5FB06A)); this.sp(g, .6, this.glass(0xD8F4FF), 0, .08, 0, null, true); return true; }
    if (i === 1){ [[-.25, -.15, 0x7FE3FF], [.25, -.05, 0xB89BFF], [0, .25, 0x7FFFC8]].forEach(([x, z, c]) => { this.cy(g, .02, .02, .3, this.glow(c), x, .25, z, 6); this.ico(g, .16, this.mat(c, {emissive:c, emissiveIntensity:.6, transparent:true, opacity:.7}), x, .5, z); }); this.halo(g, .5, .12, 0x7FE3FF); return true; }
    /* planets drifting over a night garden */
    this.sp(g, .6, this.glass(0x2A3560), 0, .08, 0, null, true);
    [[-.15, .45, 0, .12, 0xF3CC58], [.22, .3, .1, .08, 0x7FE3FF], [.05, .62, -.15, .06, 0xE57373]].forEach(([x, y, z, r, c]) => this.sp(g, r, this.glow(c), x, y, z));
    this.halo(g, .2, .45, 0xF3CC58, -.15); this.tree(g, .3, .08, -.25, .6, 0x5FB06A);
    return true;
  },

  /* ======================= 商店（產金幣） ======================= */
  tm_cafe(g, t, i, win){
    if (t === 1){
      if (i === 0){   /* 以物易物攤: goods on a mat under a lean-to */
        this.box(g, .6, .02, .4, 0xC9A04E, 0, .01, .1); [[-.18, .05], [0, .15], [.18, .05]].forEach(([x, z], k) => this.ico(g, .06, [0xC0392B, 0xF3CC58, 0x8FA86A][k], x, .06, z));
        [-.3, .3].forEach(x => this.cy(g, .02, .02, .4, 0x8A6447, x, .2, -.1, 5)); this.box(g, .7, .03, .4, 0xD9B76A, 0, .4, 0).rotation.x = .3; this.cy(g, .08, .06, .1, 0xC9A04E, -.35, .05, .3, 8); return true;
      }
      if (i === 1){ this.hut(g, -.1, -.1, .26, .24, 0xB98B5E, 0xD9B76A); [[.35, .25], [.45, .05]].forEach(([x, z]) => this.crate(g, x, z)); this.cy(g, .07, .05, .14, 0xC9A04E, .2, .07, .4, 8); return true; }   /* 交易小屋 */
      /* 貿易營地 */
      this.tent(g, -.3, -.2, 1.3, 0xD9C9A3); this.tent(g, .3, -.25, 1.1, 0xC9B48C); this.tent(g, .05, .25, .9, 0xE0D2B0);
      [[-.45, .35], [.4, .25]].forEach(([x, z]) => this.crate(g, x, z)); this.barrel(g, .25, .45);
      return true;
    }
    if (t === 2){
      if (i === 0){ this.box(g, .62, .4, .5, 0xF2EEE6, 0, .2, 0); this.gable(g, .7, .2, .6, 0xC8663E, .4); this.door(g, 0, .26, 0x6B4A32); [-.4, -.3].forEach(x => this.cy(g, .05, .03, .16, 0xB86B3E, x, .08, .35, 8)); return true; }   /* 小酒館 */
      if (i === 1){   /* 市集攤 */
        this.box(g, 1.1, .04, .5, 0xE6E0D4, 0, .02, 0); this.columns(g, 5, 1.0, .34, .22, 0xF7F3EC, .04, .025); this.box(g, 1.1, .05, .5, 0xC8663E, 0, .41, 0);
        [-.36, 0, .36].forEach((x, k) => { this.box(g, .26, .1, .16, 0xC9A26B, x, .09, .05); this.ico(g, .05, [0xF3CC58, 0x8FA86A, 0xC0392B][k], x, .17, .05); }); return true;
      }
      /* 商行: two floors behind a colonnade */
      this.box(g, .9, .66, .5, 0xEADBC4, 0, .33, -.08); this.gable(g, .96, .2, .56, 0xC8663E, .66, 0, -.08); this.columns(g, 5, .86, .32, .24, 0xF7F3EC, 0, .025); this.box(g, .92, .04, .16, 0xEADBC4, 0, .34, .22);
      this.winRow(g, win, 3, .8, .5, .18, .26); [[-.45, .45], [-.32, .48], [.42, .45]].forEach(([x, z]) => this.crate(g, x, z, .9));
      return true;
    }
    if (t === 3){
      const beams = (w, h, z, x0) => { for (let x = -w / 2 + .02; x <= w / 2; x += w / 4) this.box(g, .025, h, .02, 0x4A3527, (x0 || 0) + x, h / 2, z); };
      if (i === 0){   /* 酒館 */
        this.box(g, .62, .5, .5, 0xF1E6CF, 0, .25, 0); beams(.62, .5, .26); this.gable(g, .68, .32, .58, 0x4F5D68, .5); this.door(g, -.12, .27, 0x4A3527);
        this.box(g, .2, .02, .02, 0x4A3527, .3, .42, .32); this.box(g, .12, .1, .01, 0xC8A44A, .36, .35, .32); this.barrel(g, .4, .4); return true;
      }
      if (i === 1){   /* 旅店 + stable */
        this.box(g, .7, .7, .5, 0xF1E6CF, -.1, .35, 0); beams(.7, .7, .26, -.1); this.box(g, .7, .02, .02, 0x4A3527, -.1, .35, .26); this.gable(g, .76, .32, .58, 0x4F5D68, .7, -.1);
        this.box(g, .12, .1, .02, win, -.3, .52, .27); this.box(g, .12, .1, .02, win, .1, .52, .27); this.door(g, -.1, .27, 0x4A3527);
        this.box(g, .3, .3, .4, 0x8A6447, .45, .15, .05); this.gable(g, .32, .12, .44, 0xD9B76A, .3, .45, .05); return true;
      }
      /* 行會會館: a tall stone guild hall with a stepped gable */
      this.box(g, .8, .9, .55, 0xC4BFB5, 0, .45, 0); for (let k = 0; k < 4; k++) this.box(g, .8 - k * .18, .1, .55, 0xC4BFB5, 0, .95 + k * .1, 0);
      [.3, .6].forEach(y => this.winRow(g, win, 3, .7, y, .28, .22)); this.box(g, .2, .26, .02, 0x5B4636, 0, .13, .28); this.box(g, .2, .12, .02, 0xC8A44A, 0, .95, .28);
      return true;
    }
    if (t === 4){
      if (i === 0){ this.building(g, "cafe", win, false, 2, null, true); return true; }   /* 咖啡館 */
      if (i === 1){   /* 商會: an ochre arcade house */
        this.box(g, .9, .75, .55, 0xE8C88F, 0, .375, 0); this.box(g, .94, .05, .59, 0xF4EFE6, 0, .77, 0); this.gable(g, .94, .2, .6, 0xC2553B, .8);
        for (let k = 0; k < 3; k++){ const x = (k - 1) * .28; this.box(g, .18, .24, .02, 0x6B3F25, x, .12, .28); this.cy(g, .09, .09, .02, 0x6B3F25, x, .24, .28, 10).rotation.x = Math.PI / 2; } this.winRow(g, win, 3, .8, .55, .28, .28); return true;
      }
      /* 交易所: a columned exchange with a clock */
      this.box(g, 1.1, .08, .7, 0xE6E0D4, 0, .04, 0); this.box(g, .9, .6, .5, 0xF0DDB4, 0, .38, -.05); this.columns(g, 6, 1.0, .5, .3, 0xF7F3EC, .08, .035);
      this.box(g, 1.06, .06, .66, 0xE6E0D4, 0, .61, 0); this.ped(g, 1.06, .2, .66, 0xE6E0D4, .64); this.cy(g, .07, .07, .02, 0xFFFFFF, 0, .73, .34, 14).rotation.x = Math.PI / 2;
      return true;
    }
    if (t === 5){
      if (i === 0){   /* 百貨公司 */
        this.box(g, 1.0, .8, .6, 0xA84B35, 0, .4, 0); this.box(g, 1.04, .06, .64, 0xE8DCC8, 0, .8, 0);
        this.box(g, .9, .24, .02, win, 0, .15, .31); this.box(g, 1.0, .03, .2, 0x2F6A5A, 0, .32, .38).rotation.x = .35; [.5, .68].forEach(y => this.winRow(g, win, 4, .9, y, .31, .24)); this.box(g, .4, .1, .02, 0xC8A44A, 0, .9, .3); return true;
      }
      if (i === 1){   /* 銀行 */
        this.box(g, 1.0, .1, .65, 0xC9C3B6, 0, .05, 0); this.box(g, .86, .6, .5, 0xD9D3C6, 0, .4, -.05); this.columns(g, 4, .7, .55, .26, 0xEDE8DE, .1, .05);
        this.box(g, .9, .06, .6, 0xC9C3B6, 0, .68, 0); this.ped(g, .9, .18, .6, 0xC9C3B6, .71); this.box(g, .16, .26, .02, 0x3F3A36, 0, .23, .21); return true;
      }
      /* 證券交易所 */
      this.box(g, 1.2, .1, .8, 0xC9C3B6, 0, .05, 0); this.box(g, 1.0, .85, .6, 0xD9D3C6, 0, .52, -.05); this.columns(g, 6, 1.0, .72, .32, 0xEDE8DE, .1, .045);
      this.box(g, 1.1, .08, .72, 0xC9C3B6, 0, .9, 0); this.ped(g, 1.1, .24, .72, 0xC9C3B6, .94); this.box(g, .02, .5, .02, 0x6b5240, .45, 1.2, -.1); this.box(g, .2, .12, .01, 0x3F6FA8, .56, 1.38, -.1);
      return true;
    }
    if (t === 6){
      if (i === 0){   /* 購物中心 */
        this.box(g, 1.25, .5, .8, this.glass(0xCFEAF2), 0, .27, 0); this.box(g, 1.25, .04, .8, 0xE4E7EA, 0, .02, 0);
        const r = new this.T.Mesh(new this.T.CylinderGeometry(.4, .4, 1.25, 16, 1, false, 0, Math.PI), this.mat(0xE4E7EA)); r.rotation.z = Math.PI / 2; r.scale.set(.45, 1, 1); r.position.y = .52; g.add(r);
        [[-.4, 0xE8945A], [0, 0xC9574A], [.4, 0x4DB892]].forEach(([x, c]) => { this.box(g, .3, .3, .5, c, x, .2, -.05); this.box(g, .22, .14, .01, 0xFFFFFF, x, .3, .41); }); return true;
      }
      const tw = (x, z, w, h, col) => { this.box(g, w, h, w, this.glass(col), x, h / 2, z); for (let y = .2; y < h - .05; y += .18) this.winRing(g, win, w, w, y, x, z); this.box(g, w + .04, .05, w + .04, 0xE4E7EA, x, h, z); };
      if (i === 1){ this.box(g, .9, .2, .8, 0xE4E7EA, 0, .1, .05); tw(0, 0, .55, 1.8, 0x9FC3D6); return true; }   /* 商業大樓 */
      tw(-.25, -.05, .42, 2.2, 0x8FB8D0); tw(.27, .05, .42, 2.0, 0x8FB8D0); this.box(g, .2, .06, .12, 0xE4E7EA, 0, 1.5, 0);   /* 金融中心 */
      return true;
    }
    /* 星際商站 → 貿易港 → 銀河交易所 */
    if (i === 0){ this.cy(g, .14, .2, .6, 0xF7F8FA, 0, .3, 0, 12); this.cy(g, .55, .4, .2, 0xF7F8FA, 0, .7, 0, 24); this.cy(g, .52, .52, .1, this.glass(0x9FD3E6), 0, .84, 0, 24); this.cy(g, .3, .45, .06, this.glow(0xFFB27A, 0xFF8A3D), 0, .6, 0, 24); return true; }
    if (i === 1){   /* a landing pad with a docked ship */
      this.cy(g, .6, .62, .1, 0xE4E7EA, 0, .05, 0, 6); this.halo(g, .5, .11, 0x7FE3FF);
      const ship = this.sp(g, .22, 0xF7F8FA, 0, .3, 0); ship.scale.set(1, .45, 1.8); this.box(g, .7, .02, .16, 0xF7F8FA, 0, .3, -.05); this.sp(g, .08, this.glass(0x9FD3E6), 0, .36, .22); this.co(g, .06, .14, this.glow(0xFFB27A, 0xFF8A3D), 0, .3, -.45, 8).rotation.x = Math.PI / 2;
      this.box(g, .1, .5, .1, 0xF7F8FA, .5, .25, -.4); this.sp(g, .05, this.glow(0xFF6B6B, 0xFF3B3B), .5, .53, -.4); return true;
    }
    this.cy(g, .14, .22, .8, 0xF7F8FA, 0, .4, 0, 12); this.cy(g, .55, .4, .2, 0xF7F8FA, 0, .9, 0, 24); this.sp(g, .4, this.glass(0x9FD3E6), 0, 1.0, 0, null, true);
    this.halo(g, .66, .92, 0xFFB27A); this.halo(g, .45, 1.35, 0x7FE3FF); this.sp(g, .08, this.glow(0xF3CC58), 0, 1.5, 0);
    return true;
  },

  /* ======================= 書店（產知識） ======================= */
  tm_books(g, t, i, win){
    if (t === 1){
      if (i === 0){   /* 故事圈: logs round a fire under a big tree */
        this.box(g, 1.1, .02, .9, 0xA7C084, 0, .01, 0); this.fire(g, .1, .15);
        [[-.18, .15], [.38, .15], [.1, .42], [.1, -.12]].forEach(([x, z], k) => { const l = this.cy(g, .04, .04, .2, 0x8A6447, x, .04, z, 8); l.rotation.z = Math.PI / 2; l.rotation.y = k * 1.5; }); this.tree(g, -.4, 0, -.3, 1.3, 0x5E9E4E); return true;
      }
      if (i === 1){   /* 壁畫洞穴: a rocky mound with a painted cave mouth */
        const m = this.ico(g, .5, 0xA9A49A, 0, .2, -.1, 1); m.scale.set(1.1, .7, .9);
        this.box(g, .22, .24, .1, 0x2E2620, 0, .12, .3); [[-.25, .3, 0xB0412E], [.24, .26, 0x8A5A2E], [.3, .38, 0xB0412E]].forEach(([x, y, c]) => this.box(g, .08, .05, .01, c, x, y, .37)); this.fire(g, 0, .5, .6); return true;
      }
      /* 石刻碑 */
      this.box(g, .36, .7, .1, 0xA9A49A, 0, .35, -.05); for (let y = .2; y < .62; y += .1) this.box(g, .24, .02, .01, 0x6E6A62, 0, y, .005); this.stones(g, 6, .45, .1, 0x9C978D);
      return true;
    }
    if (t === 2){
      if (i === 0){   /* 卷軸館: an open stone room full of scroll shelves */
        this.box(g, .7, .45, .45, 0xEDE7DC, 0, .225, -.05); this.box(g, .6, .35, .02, 0x6B4A32, 0, .2, .18);
        for (let y = .08; y < .36; y += .09) for (let x = -.24; x <= .25; x += .08) this.cy(g, .02, .02, .06, 0xF3E6C4, x, y, .2, 6).rotation.x = Math.PI / 2;
        this.gable(g, .76, .18, .52, 0xC8663E, .45, 0, -.05); return true;
      }
      if (i === 1){   /* 學園: a colonnaded courtyard with an olive tree */
        this.box(g, 1.1, .04, .9, 0xEDE6D8, 0, .02, 0);
        [[0, -.35, 1.0, .18], [-.42, .05, .18, .6], [.42, .05, .18, .6]].forEach(([x, z, w, d]) => this.box(g, w, .04, d, 0xE6E0D4, x, .38, z)); this.columns(g, 6, .9, .34, -.3, 0xF7F3EC, .02, .025);
        [-.42, .42].forEach(x => { for (let z = -.2; z <= .31; z += .17) this.cy(g, .025, .03, .34, 0xF7F3EC, x, .19, z, 8); }); this.cy(g, .03, .04, .18, 0x6B5A48, 0, .1, .1, 6); this.ico(g, .15, 0x8FA86A, 0, .28, .1); return true;
      }
      /* 大圖書館: a temple of books */
      this.box(g, 1.0, .55, .7, 0xEDE7DC, 0, .3, -.05); this.box(g, 1.1, .06, .8, 0xD5CBB8, 0, .6, -.05); this.ped(g, 1.1, .24, .84, 0xD5CBB8, .63, -.05);
      for (let x = -.38; x <= .39; x += .19) this.cy(g, .04, .045, .5, 0xF7F3EC, x, .3, .32, 8); this.box(g, 1.0, .05, .22, 0xD5CBB8, 0, .025, .38); this.door(g, 0, .31, 0x6E8FB0);
      return true;
    }
    if (t === 3){
      if (i === 0){   /* 抄寫室 */
        this.box(g, .6, .45, .45, 0xC4BFB5, 0, .225, 0); this.gable(g, .66, .26, .52, 0x4F5D68, .45);
        [-.15, .15].forEach(x => { this.box(g, .08, .14, .02, win, x, .26, .23); this.cy(g, .04, .04, .02, win, x, .33, .23, 8).rotation.x = Math.PI / 2; }); this.door(g, 0, .23, 0x4A3527, .1, .2); return true;
      }
      if (i === 1){   /* 修道院圖書館: a chapel hall with a bell tower */
        this.box(g, .45, .5, .8, 0xC4BFB5, -.1, .25, -.05); this.gable(g, .45, .28, .86, 0x4F5D68, .5, -.1, -.05, true);
        this.box(g, .2, .9, .2, 0xC4BFB5, .3, .45, -.25); this.co(g, .16, .3, 0x4F5D68, .3, 1.05, -.25, 4).rotation.y = Math.PI / 4; this.cy(g, .08, .08, .02, win, -.1, .45, .36, 12).rotation.x = Math.PI / 2; this.door(g, -.1, .36, 0x4A3527); return true;
      }
      /* 大學: a brick hall with a clock tower */
      this.box(g, 1.1, .55, .55, 0xB8573E, 0, .28, -.1); this.gable(g, 1.16, .26, .62, 0x4F5D68, .55, 0, -.1); this.winRow(g, win, 4, 1, .3, .18, .25);
      this.box(g, .28, 1.2, .28, 0xB8573E, 0, .6, -.1); this.cy(g, .09, .09, .02, 0xFFFFFF, 0, 1.0, .05).rotation.x = Math.PI / 2; this.co(g, .22, .3, 0x4F5D68, 0, 1.35, -.1, 4).rotation.y = Math.PI / 4;
      this.box(g, 1.1, .02, .3, 0x8FC46A, 0, .01, .4);
      return true;
    }
    if (t === 4){
      if (i === 0){   /* 印刷坊 */
        this.box(g, .7, .5, .5, 0xF1E6CF, 0, .25, 0); this.gable(g, .76, .3, .58, 0xC2553B, .5); this.box(g, .6, .2, .02, win, 0, .2, .26);
        const w = new this.T.Mesh(new this.T.TorusGeometry(.08, .015, 6, 14), this.mat(0x4A3527)); w.position.set(.42, .45, .28); g.add(w); this.crate(g, -.42, .35); return true;
      }
      if (i === 1){ this.building(g, "books", win, false, 1, null, true); this.box(g, .5, .1, .02, 0xC8A44A, 0, .78, .27); return true; }   /* 書店 */
      /* 皇家圖書館: wings round a domed reading room */
      [-.42, .42].forEach(x => { this.box(g, .32, .5, .9, 0xF0DDB4, x, .25, -.05); this.box(g, .36, .05, .94, 0xC2553B, x, .52, -.05); });
      this.box(g, .55, .6, .35, 0xF0DDB4, 0, .3, -.32); this.cy(g, .2, .22, .15, 0xF0DDB4, 0, .67, -.32); this.sp(g, .24, this.mat(0x7E9AA8, {metalness:.3}), 0, .74, -.32, null, true); this.box(g, .5, .02, .45, 0x8FC46A, 0, .01, .2);
      return true;
    }
    if (t === 5){
      if (i === 0){   /* 公共圖書館: brick with a columned porch */
        this.box(g, .9, .6, .55, 0xA84B35, 0, .3, -.05); this.box(g, .94, .05, .59, 0xE8DCC8, 0, .6, -.05); this.columns(g, 4, .5, .4, .28, 0xEDE8DE, 0, .03); this.box(g, .56, .05, .14, 0xE8DCC8, 0, .42, .27); this.ped(g, .56, .14, .14, 0xE8DCC8, .44, .27);
        this.box(g, .14, .12, .02, win, -.38, .35, .23); this.box(g, .14, .12, .02, win, .38, .35, .23); return true;
      }
      if (i === 1){   /* 報社: a brick block with a rooftop sign */
        this.box(g, .8, .9, .55, 0xA84B35, 0, .45, 0); [.25, .5, .72].forEach(y => this.winRow(g, win, 3, .7, y, .28, .22));
        this.box(g, .6, .16, .03, 0xF4F1EA, 0, 1.02, 0); [-.2, 0, .2].forEach(x => this.box(g, .1, .08, .01, 0x2F3A44, x, 1.02, .02)); this.box(g, .02, .14, .02, 0x3B4046, -.25, .97, 0); this.box(g, .02, .14, .02, 0x3B4046, .25, .97, 0); return true;
      }
      /* 科學院: stone halls with a domed observatory */
      this.box(g, 1.0, .5, .55, 0xD9D3C6, 0, .25, 0); this.winRow(g, win, 4, .9, .3, .28, .22); this.box(g, 1.04, .05, .59, 0xC9C3B6, 0, .52, 0);
      this.cy(g, .22, .22, .2, 0xD9D3C6, .25, .65, -.05, 16); this.sp(g, .22, this.mat(0xB0B8C0, {metalness:.4}), .25, .75, -.05, null, true); this.box(g, .06, .12, .3, 0x3B4046, .25, .88, -.05).rotation.x = -.6;
      return true;
    }
    if (t === 6){
      if (i === 0){   /* 大學 (modern campus) */
        [-.42, .42].forEach(x => { this.box(g, .32, .5, .9, 0xEDE7DC, x, .25, -.05); this.box(g, .36, .05, .94, 0x6E8FB0, x, .52, -.05); });
        this.box(g, .55, .6, .35, 0xEDE7DC, 0, .3, -.32); this.sp(g, .22, this.mat(0x6E8FB0, {metalness:.3}), 0, .64, -.32, null, true); this.box(g, .5, .02, .45, 0x8FC46A, 0, .01, .2); return true;
      }
      if (i === 1){ [[0, .3, 0, 1.0, .6], [-.1, .8, -.05, .7, .4], [.12, 1.15, 0, .5, .3]].forEach(([x, y, z, w, h]) => { this.box(g, w, h, w * .7, this.glass(0xBFD8E6), x, y, z); this.box(g, w + .02, .03, w * .7 + .02, 0xE4E7EA, x, y + h / 2, z); }); return true; }   /* 研究中心 */
      /* 資料中心: a windowless hall with blinking lights and cooling fans */
      this.box(g, 1.1, .5, .7, 0x5A6470, 0, .25, 0); for (let x = -.45; x <= .46; x += .1) this.box(g, .03, .03, .01, this.glow(x > 0 ? 0x7FFFC8 : 0x7FE3FF), x, .35, .36);
      [-.3, 0, .3].forEach(x => { this.cy(g, .1, .1, .06, 0xC9CED4, x, .53, -.1, 12); this.cy(g, .08, .08, .02, 0x3B4046, x, .57, -.1, 12); });
      return true;
    }
    /* 知識塔 → AI 中心 → 銀河資料庫 */
    this.cy(g, .5, .55, .12, 0xE4E7EA, 0, .06, 0, 6);
    if (i === 0){ this.cy(g, .14, .34, 1.5, this.glass(0xC9C2FF), 0, .87, 0, 6); this.cy(g, .08, .2, 1.4, this.glow(0xB89BFF, 0x8A6BFF), 0, .85, 0, 6); const cr = new this.T.Mesh(new this.T.OctahedronGeometry(.15, 0), this.glow(0xE6DBFF, 0xB89BFF)); cr.position.y = 1.85; g.add(cr); return true; }
    if (i === 1){ this.cy(g, .25, .35, .3, 0xF7F8FA, 0, .27, 0, 16); this.sp(g, .3, this.glow(0x9FE3FF, 0x3FB8E8), 0, .7, 0); this.halo(g, .42, .7, 0xB89BFF); this.halo(g, .36, .7, 0x7FE3FF).rotation.y = 1; return true; }
    this.cy(g, .1, .2, 2.0, 0xF7F8FA, 0, 1.1, 0, 8);
    for (let k = 0; k < 8; k++){ const a = k * .8, y = .5 + k * .2; this.box(g, .1, .1, .1, this.glow(k % 2 ? 0x7FE3FF : 0xB89BFF), Math.cos(a) * .35, y, Math.sin(a) * .35).rotation.y = a; }
    this.halo(g, .3, 2.1, 0x7FE3FF);
    return true;
  },

  /* ======================= 診所（全城產量） ======================= */
  tm_clinic(g, t, i, win){
    const cross = (x, y, z, s, col) => { s = s || 1; this.box(g, .06 * s, .2 * s, .02, col || 0xE53935, x, y, z); this.box(g, .2 * s, .06 * s, .02, col || 0xE53935, x, y, z); };
    if (t === 1){
      if (i === 0){   /* 草藥小屋: a hut and a rack of drying herbs */
        this.hut(g, -.12, -.05, .25, .22, 0xB98B5E, 0xD9B76A);
        [.3, .55].forEach(x => this.cy(g, .02, .02, .35, 0x8A6447, x, .17, .25, 5)); this.box(g, .3, .02, .02, 0x8A6447, .42, .33, .25); [.34, .42, .5].forEach(x => this.box(g, .04, .1, .03, 0x6FAE57, x, .27, .25)); return true;
      }
      if (i === 1){   /* 巫醫屋: a painted hut and a totem */
        this.hut(g, 0, -.05, .3, .26, 0xA87B52, 0xC9A04E); [0, 1, 2].forEach(k => this.box(g, .06, .03, .01, [0xC9574A, 0xF3CC58, 0xFFFFFF][k], -.12 + k * .12, .2, .26));
        this.cy(g, .05, .06, .6, 0x8A6447, .48, .3, .25, 8); this.box(g, .14, .1, .03, 0xC9574A, .48, .5, .28); this.fire(g, -.42, .35, .6); return true;
      }
      /* 療癒營地 */
      this.tent(g, -.3, -.2, 1.2, 0xE0D2B0); this.tent(g, .3, -.2, 1.2, 0xE0D2B0); this.fire(g, 0, .2, .8); [[-.4, .35], [.4, .35]].forEach(([x, z]) => this.cy(g, .05, .03, .14, 0xB86B3E, x, .07, z, 8));
      return true;
    }
    if (t === 2){
      if (i === 0){   /* 公共浴場 */
        this.box(g, 1.2, .05, .95, 0xEDE6D8, 0, .025, 0); this.box(g, .7, .02, .5, 0x6FBEDC, 0, .06, .05);
        this.columns(g, 5, 1.0, .4, -.35, 0xF7F3EC, .05, .03); this.box(g, 1.1, .05, .2, 0xE6E0D4, 0, .47, -.38); this.box(g, 1.1, .4, .04, 0xEDE7DC, 0, .25, -.47); return true;
      }
      if (i === 1){   /* 醫神廟: a small temple and a serpent staff */
        this.box(g, .7, .08, .6, 0xE6E0D4, 0, .04, 0); this.box(g, .45, .4, .4, 0xEDE7DC, 0, .28, -.05); this.columns(g, 4, .56, .4, .24, 0xF7F3EC, .08, .03); this.box(g, .66, .05, .56, 0xE6E0D4, 0, .5, 0); this.ped(g, .66, .16, .56, 0xC8663E, .52);
        this.box(g, .02, .4, .02, 0x8A6447, .45, .2, .35); const sn = new this.T.Mesh(new this.T.TorusGeometry(.04, .012, 6, 12), this.mat(0x4DB892)); sn.position.set(.45, .3, .35); g.add(sn); return true;
      }
      /* 醫學院 */
      this.box(g, .5, .6, .5, 0xEADBC4, -.25, .3, -.1); this.gable(g, .54, .18, .56, 0xC8663E, .6, -.25, -.1); this.box(g, .1, .1, .02, win, -.36, .4, .16); this.box(g, .1, .1, .02, win, -.14, .4, .16);
      this.box(g, .45, .04, .3, 0xE6E0D4, .3, .4, .1); for (let k = 0; k < 3; k++) this.cy(g, .025, .03, .38, 0xF7F3EC, .1 + k * .2, .19, .24, 8); cross(-.25, .2, .16, .8, 0x4DB892);
      return true;
    }
    if (t === 3){
      if (i === 0){   /* 藥草房 */
        this.box(g, .5, .4, .45, 0xC4BFB5, -.15, .2, -.1); this.gable(g, .56, .26, .52, 0x4F5D68, .4, -.15, -.1); this.door(g, -.15, .13, 0x4A3527);
        this.box(g, .3, .05, .4, 0x6B4A32, .38, .025, .1); for (let z = -.05; z <= .26; z += .1) this.crop(g, .38, z, 0x6FAE57, .8); return true;
      }
      if (i === 1){   /* 修道院醫院: a long hall with a cross */
        this.box(g, 1.1, .45, .45, 0xC4BFB5, 0, .225, -.05); this.gable(g, 1.14, .26, .52, 0x4F5D68, .45, 0, -.05); this.winRow(g, win, 4, 1, .27, .18, .24);
        this.box(g, .02, .22, .02, 0x5B4636, 0, .82, -.05); this.box(g, .12, .02, .02, 0x5B4636, 0, .88, -.05); this.door(g, 0, .18, 0x4A3527); return true;
      }
      /* 救濟院: buildings round a cloister */
      [[0, -.38, 1.0, .26], [-.4, .05, .24, .6], [.4, .05, .24, .6]].forEach(([x, z, w, d]) => this.box(g, w, .4, d, 0xC4BFB5, x, .2, z)); this.gable(g, 1.04, .2, .32, 0x4F5D68, .4, 0, -.38);
      [-.4, .4].forEach(x => this.gable(g, .28, .2, .64, 0x4F5D68, .4, x, .05, true)); this.box(g, .4, .02, .4, 0x8FC46A, 0, .01, .1); this.cy(g, .06, .06, .1, 0xB9B4AA, 0, .05, .1, 10);
      return true;
    }
    if (t === 4){
      if (i === 0){   /* 藥房: a shop with a green cross sign */
        this.box(g, .7, .6, .5, 0xE8C88F, 0, .3, 0); this.gable(g, .76, .24, .58, 0xC2553B, .6); this.box(g, .5, .22, .02, win, 0, .17, .26);
        this.box(g, .02, .02, .16, 0x3F3A36, .4, .45, .3); cross(.4, .38, .38, .7, 0x4DB892); return true;
      }
      if (i === 1){   /* 醫院: a grand ochre hall */
        this.box(g, 1.1, .6, .55, 0xE8C88F, 0, .3, 0); this.box(g, 1.14, .05, .59, 0xF4EFE6, 0, .6, 0); this.gable(g, 1.14, .2, .6, 0xC2553B, .62);
        [.22, .45].forEach(y => this.winRow(g, win, 5, 1.0, y, .28, .2)); cross(0, .72, .3, .6); return true;
      }
      /* 解剖學院: a round anatomy theatre with a dome */
      this.cy(g, .4, .42, .55, 0xF0DDB4, 0, .275, 0, 16); this.cy(g, .42, .42, .05, 0xF4EFE6, 0, .57, 0, 16); this.sp(g, .36, this.mat(0xC2553B), 0, .59, 0, null, true); this.cy(g, .06, .06, .14, 0xF4EFE6, 0, .98, 0, 8);
      this.box(g, .16, .26, .02, 0x6B3F25, 0, .13, .41);
      return true;
    }
    if (t === 5){
      if (i === 0){ this.building(g, "clinic", win, false, 1, null, true); return true; }   /* 診所 */
      if (i === 1){   /* 醫院: brick, three floors and a red cross */
        this.box(g, .95, .84, .6, 0xA84B35, 0, .42, 0); this.box(g, 1.0, .05, .65, 0xE8DCC8, 0, .86, 0);
        [.38, .62].forEach(y => this.winRow(g, win, 4, .9, y, .31, .22)); this.box(g, .3, .22, .02, 0xD6E8E2, 0, .11, .31); this.box(g, .3, .3, .02, 0xFFFFFF, .3, .2, .31); cross(.3, .2, .32, .9); return true;
      }
      /* 疫苗研究所: a lab with vents and glowing flasks */
      this.box(g, 1.0, .5, .6, 0xD9D3C6, 0, .25, 0); this.winRow(g, win, 4, .9, .3, .31, .22); [-.3, .3].forEach(x => { this.cy(g, .05, .05, .5, 0x9AA3AB, x, .75, -.15, 8); this.smoke(g, x, 1.02, -.15); });
      [[-.1, 0x7FE3FF], [.1, 0x7FFFC8]].forEach(([x, c]) => { this.sp(g, .07, this.glow(c), x, .6, .1); this.cy(g, .02, .02, .08, this.glass(0xFFFFFF), x, .7, .1, 6); });
      return true;
    }
    if (t === 6){
      if (i === 0){   /* 醫學中心: a tower with a helipad beside a low wing */
        const h = 1.4;
        this.box(g, .5, h, .5, 0xFFFFFF, -.2, h / 2, -.1); for (let y = .25; y < h; y += .22) this.winRing(g, win, .5, .5, y, -.2, -.1);
        this.cy(g, .26, .26, .04, 0x5A6B78, -.2, h + .02, -.1, 16); this.box(g, .03, .02, .2, 0xFFFFFF, -.26, h + .05, -.1); this.box(g, .03, .02, .2, 0xFFFFFF, -.14, h + .05, -.1); this.box(g, .12, .02, .03, 0xFFFFFF, -.2, h + .05, -.1);
        this.box(g, .5, .35, .7, 0xF4F7F6, .35, .18, .05); this.box(g, .52, .04, .72, 0x48A88B, .35, .37, .05); cross(.35, .2, .41); return true;
      }
      if (i === 1){   /* 急救中心: an emergency bay with an ambulance */
        this.box(g, 1.0, .55, .55, 0xFFFFFF, 0, .275, -.08); this.box(g, 1.04, .05, .59, 0xE53935, 0, .56, -.08); this.winRow(g, win, 4, .9, .4, .2, .22);
        this.box(g, .5, .04, .3, 0xE4E7EA, -.15, .3, .3); this.box(g, .3, .16, .16, 0xFFFFFF, .3, .1, .4); this.box(g, .3, .03, .17, 0xE53935, .3, .12, .4); this.box(g, .08, .03, .03, this.glow(0x4C8BE0), .3, .2, .4); cross(-.15, .42, .2); return true;
      }
      /* 生技中心: glass halls round a glowing DNA helix */
      this.box(g, 1.1, .35, .8, this.glass(0xCFF2E6), 0, .18, 0); this.box(g, 1.14, .04, .84, 0xF4F7F6, 0, .37, 0);
      for (let k = 0; k < 14; k++){ const a = k * .55, y = .45 + k * .07; this.sp(g, .04, this.glow(0x7FE3FF), Math.cos(a) * .16, y, Math.sin(a) * .16); this.sp(g, .04, this.glow(0x4DB892), -Math.cos(a) * .16, y, -Math.sin(a) * .16); }
      cross(.4, .2, .42);
      return true;
    }
    /* 再生醫學中心 → 奈米醫療艙 → 星際醫療站 */
    this.cy(g, .55, .58, .08, 0xF2F4F7, 0, .04, 0, 20);
    if (i === 0){ this.sp(g, .45, 0xF7F8FA, 0, .08, 0, null, true); this.cy(g, .1, .1, .5, this.glass(0x9FFFD8), 0, .5, 0, 12); this.sp(g, .07, this.glow(0x7FFFC8), 0, .5, 0); cross(0, .3, .46, .8, 0x4DB892); return true; }
    if (i === 1){ [[-.3, 0], [0, -.15], [.3, 0]].forEach(([x, z]) => { const p = this.cy(g, .1, .1, .5, this.glass(0x9FD3E6), x, .18, z, 12); p.rotation.x = Math.PI / 2; this.sp(g, .04, this.glow(0x7FE3FF), x, .18, z); }); this.halo(g, .5, .45, 0x7FFFC8); return true; }
    this.cy(g, .1, .14, .5, 0xF7F8FA, 0, .3, 0, 12); this.cy(g, .5, .5, .14, 0xF7F8FA, 0, .62, 0, 24); this.cy(g, .48, .48, .06, this.glass(0x9FD3E6), 0, .72, 0, 24);
    cross(0, .62, .51, 1, 0x4DB892); this.halo(g, .6, .62, 0x7FFFC8);
    return true;
  },

  /* ======================= 地標（跟著市中心的時代） ======================= */
  tm_landmark(g, t, i, win){
    if (t === 1){   /* 巨石陣 */
      for (let k = 0; k < 10; k++){ const a = k / 10 * Math.PI * 2; this.box(g, .12, .55, .1, 0xA9A49A, Math.cos(a) * .48, .275, Math.sin(a) * .48).rotation.y = -a; if (k % 2 === 0){ const a2 = a + Math.PI / 10; this.box(g, .32, .08, .1, 0x9C978D, Math.cos(a2) * .48, .59, Math.sin(a2) * .48).rotation.y = -a2 + Math.PI / 2; } }
      this.box(g, .3, .1, .14, 0x9C978D, 0, .05, 0); return true;
    }
    if (t === 2){   /* 神殿 */
      this.box(g, 1.2, .1, .9, 0xE6E0D4, 0, .05, 0); this.box(g, 1.1, .06, .8, 0xEDE8DE, 0, .13, 0); this.box(g, .7, .5, .45, 0xEDE7DC, 0, .41, 0);
      this.columns(g, 7, 1.0, .55, .34, 0xF7F3EC, .16, .04); this.columns(g, 7, 1.0, .55, -.34, 0xF7F3EC, .16, .04); this.box(g, 1.1, .07, .8, 0xE6E0D4, 0, .75, 0); this.ped(g, 1.1, .24, .8, 0xE6E0D4, .78); return true;
    }
    if (t === 3){   /* 大教堂: a gothic nave, twin spires and a rose window */
      this.box(g, .5, .7, 1.0, 0xC4BFB5, 0, .35, -.05); this.gable(g, .5, .35, 1.04, 0x4F5D68, .7, 0, -.05, true);
      [-.2, .2].forEach(x => { this.box(g, .2, 1.2, .2, 0xC4BFB5, x, .6, .42); this.co(g, .15, .5, 0x4F5D68, x, 1.45, .42, 4).rotation.y = Math.PI / 4; });
      this.cy(g, .1, .1, .02, this.glow(0xB89BFF, 0x8A6BFF), 0, .75, .53, 16).rotation.x = Math.PI / 2; this.box(g, .14, .3, .02, 0x4A3527, 0, .15, .53); return true;
    }
    if (t === 4){   /* 圓頂大教堂 */
      this.box(g, 1.1, .6, .7, 0xF0DDB4, 0, .3, 0); this.columns(g, 6, .9, .5, .37, 0xF7F3EC, .02, .035); this.box(g, 1.14, .06, .74, 0xF4EFE6, 0, .62, 0);
      this.cy(g, .32, .34, .3, 0xF0DDB4, 0, .8, 0, 18); this.sp(g, .34, this.mat(0xC2553B), 0, .95, 0, null, true); this.cy(g, .06, .07, .16, 0xF4EFE6, 0, 1.36, 0, 8); this.sp(g, .05, 0xC8A44A, 0, 1.47, 0, {metalness:.4}); return true;
    }
    if (t === 5){   /* 鐵塔: a lattice iron tower */
      const leg = (sx, sz) => { const l = this.box(g, .06, 1.5, .06, 0x6B5A48, sx * .22, .72, sz * .22); l.rotation.z = sx * .2; l.rotation.x = -sz * .2; };
      leg(-1, -1); leg(1, -1); leg(-1, 1); leg(1, 1); this.box(g, .7, .05, .7, 0x6B5A48, 0, .3, 0); this.box(g, .36, .05, .36, 0x6B5A48, 0, .9, 0); this.cy(g, .03, .1, .9, 0x6B5A48, 0, 1.85, 0, 4); this.sp(g, .04, this.glow(0xFFD36B), 0, 2.3, 0); return true;
    }
    if (t === 6){   /* 摩天塔 */
      this.box(g, .7, .2, .7, 0xE4E7EA, 0, .1, 0); this.cy(g, .2, .3, 2.2, this.glass(0x8FB8D0), 0, 1.3, 0, 8);
      for (let y = .4; y < 2.3; y += .25){ const r = .3 - (y / 2.4) * .1 + .01; this.cy(g, r, r, .02, 0xE4E7EA, 0, y, 0, 8); } this.cy(g, .01, .04, .6, 0xC0C6CC, 0, 2.7, 0, 6); this.sp(g, .03, this.glow(0xFF6B6B, 0xFF3B3B), 0, 3.0, 0); return true;
    }
    /* 太空電梯: a glowing cable into the sky from a ringed base */
    this.cy(g, .5, .55, .12, 0xE6DCCB, 0, .06, 0, 16); this.cy(g, .36, .4, .1, 0xF4EFE6, 0, .17, 0, 16);
    this.cy(g, .03, .03, 3.2, this.glow(0xBFEFFF, 0x7FE3FF), 0, 1.8, 0, 6); this.box(g, .14, .1, .14, 0xF7F8FA, 0, 1.0 + i * .4, 0);
    this.halo(g, .45, .5, 0xF3CC58); this.halo(g, .3, 1.6, 0x7FE3FF); this.halo(g, .2, 2.6, 0xB89BFF);
    const cr = new this.T.Mesh(new this.T.OctahedronGeometry(.18, 0), this.glow(0x9FE3FF, 0x58C6FF)); cr.position.y = 3.4; g.add(cr);
    return true;
  }
});
