/* =========================================================
   城市 v2 — the look of every building at every 階 (tier).
   City3D.tierModel(g, type, t, i, win) draws one building into group g and
   returns true; it returns false where the classic models in city3d.js are
   still used (most buildings' 1st tier, and the center's 2nd–4th tiers).
   t = tier 1..6, i = level inside the tier 0..2, win = the window material
   (glows at night). Front (the door) is +z; keep within about ±0.65.
   ========================================================= */
Object.assign(City3D, {
  /* small shape helpers */
  cy(g, rt, rb, h, col, x, y, z, seg, extra){ const m = new this.T.Mesh(new this.T.CylinderGeometry(rt, rb, h, seg || 12), typeof col === "object" ? col : this.mat(col, extra)); m.position.set(x, y, z); g.add(m); return m; },
  sp(g, r, col, x, y, z, extra, half){ const T = this.T, m = new T.Mesh(half ? new T.SphereGeometry(r, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2) : new T.SphereGeometry(r, 14, 10), typeof col === "object" ? col : this.mat(col, extra)); m.position.set(x, y, z); g.add(m); return m; },
  co(g, r, h, col, x, y, z, seg, extra){ const m = new this.T.Mesh(new this.T.ConeGeometry(r, h, seg || 10), this.mat(col, extra)); m.position.set(x, y, z); g.add(m); return m; },
  glass(col){ return this.mat(col || 0xBFE8F2, {transparent:true, opacity:.5, roughness:.2, metalness:.1}); },
  glow(col, e){ return this.mat(col, {emissive:e || col, emissiveIntensity:.7}); },
  /* a row of windows on the front (+z) face at depth z */
  winRow(g, win, n, w, y, z, gap){ for (let k = 0; k < n; k++) this.box(g, gap * .6, .1, .02, win, (k - (n - 1) / 2) * gap, y, z); },
  /* a band of windows round all four sides of a box (w × d): one strip per side keeps the mesh count low */
  winRing(g, win, w, d, y){
    this.box(g, w * .86, .09, .02, win, 0, y, d / 2 + .01); this.box(g, w * .86, .09, .02, win, 0, y, -d / 2 - .01);
    this.box(g, .02, .09, d * .86, win, w / 2 + .01, y, 0); this.box(g, .02, .09, d * .86, win, -w / 2 - .01, y, 0);
  },
  door(g, x, z, col){ this.box(g, .14, .22, .02, col || 0x8A6A4A, x, .11, z); },
  lamp(g, x, z, h){ this.box(g, .025, h || .4, .025, 0x3B4A59, x, (h || .4) / 2, z); this.sp(g, .05, 0xFFE9A8, x, (h || .4) + .03, z, {emissive:0xFFD36B, emissiveIntensity:.6}); },
  solar(g, x, y, z, w, d, tilt){ const m = this.box(g, w, .02, d, 0x2E4A7A, x, y, z, {metalness:.4, roughness:.35}); m.rotation.x = tilt == null ? -.35 : tilt; return m; },
  /* a small floating ring (the future tiers) */
  halo(g, r, y, col){ const T = this.T, m = new T.Mesh(new T.TorusGeometry(r, .025, 8, 40), this.glow(col || 0x7FE3FF)); m.rotation.x = Math.PI / 2; m.position.y = y; g.add(m); return m; },
  crop(g, x, z, col, s){ const p = new this.T.Mesh(new this.T.IcosahedronGeometry(.055 * (s || 1), 0), this.mat(col || 0x7FBF5E)); p.position.set(x, .12 * (s || 1), z); g.add(p); return p; },

  tierModel(g, type, t, i, win){
    const fn = this["tm_" + type]; if (!fn) return false;
    return fn.call(this, g, t, i, win) !== false;
  },

  /* ---------- 市中心: 農寮 → 村公所 → 鎮公所 → 市政廳 → 都市中心 → 宇宙文明中心 ---------- */
  tm_hall(g, t, i, win){
    if (t === 1){
      /* 農寮: a thatched shelter on wooden posts; then hay and a fence; then a storehouse and a flag */
      [[-.32, -.22], [.32, -.22], [-.32, .22], [.32, .22]].forEach(([x, z]) => this.box(g, .05, .42, .05, 0x8A6447, x, .21, z));
      this.box(g, .7, .03, .5, 0xB98B5E, 0, .03, 0);
      const th = this.co(g, .62, .34, 0xD9B76A, 0, .58, 0, 4); th.rotation.y = Math.PI / 4; th.scale.z = .75;
      this.box(g, .5, .08, .08, 0x9C7B5B, 0, .17, -.16); this.box(g, .12, .1, .12, 0xC9A26B, .18, .08, .06);
      if (i >= 1){
        [[-.5, .35], [-.36, .45]].forEach(([x, z]) => { const h = this.cy(g, .1, .1, .16, 0xE8C766, x, .08, z); h.rotation.z = Math.PI / 2; });
        for (let x = -.55; x <= .56; x += .22) this.box(g, .03, .16, .03, 0xA88760, x, .08, -.5);
        this.box(g, 1.15, .025, .025, 0xA88760, 0, .12, -.5);
      }
      if (i >= 2){
        this.box(g, .32, .3, .3, 0xC9A26B, .45, .15, -.18); const r = new this.T.Group(); r.position.set(.45, 0, -.18); g.add(r); this.roof(r, .38, .16, .36, 0x8A5A3A, .3);
        this.box(g, .02, .75, .02, 0x6b5240, -.5, .37, -.25); this.box(g, .2, .12, .01, 0xDB6A41, -.39, .66, -.25);
      }
      return true;
    }
    if (t <= 4) return false;   /* 村公所／鎮公所／市政廳: the classic timber hall, clock tower and golden dome */
    if (t === 5){
      /* 都市中心: glass towers on a wide podium, a sky bridge between them */
      this.box(g, 1.3, .3, 1.0, 0xE4E7EA, 0, .15, 0); this.box(g, 1.1, .2, .02, win, 0, .17, .51);
      const tw = (x, z, h, w) => { this.box(g, w, h, w, this.glass(0x9FD3E6), x, .3 + h / 2, z); this.box(g, w + .04, .05, w + .04, 0xE4E7EA, x, .3 + h, z);
        for (let y = .45; y < .3 + h - .05; y += .18) this.winRing(g, win, w, w, y, 3); };
      tw(-.32, -.1, 1.3 + i * .2, .4); tw(.34, .05, .95 + i * .15, .36);
      this.box(g, .3, .08, .12, 0xE4E7EA, 0, 1.0, -.03);
      this.box(g, .02, .35, .02, 0xC0C6CC, -.32, 1.8 + i * .2, -.1); this.sp(g, .035, 0xFF6B6B, -.32, 1.98 + i * .2, -.1, {emissive:0xFF3B3B, emissiveIntensity:.8});
      [-.5, .5].forEach(x => this.tree(g, x, .3, .4, .5, 0x7FB860));
      return true;
    }
    /* 宇宙文明中心: a white spire rising from a domed base, rings of light and a floating crystal */
    this.cy(g, .62, .66, .16, 0xF2F4F7, 0, .08, 0, 24); this.sp(g, .5, this.glass(0xBFEFFF), 0, .16, 0, null, true);
    this.cy(g, .1, .24, 1.6 + i * .2, 0xF7F8FA, 0, .9 + i * .1, 0, 16);
    this.halo(g, .42, .75, 0x7FE3FF); this.halo(g, .3, 1.25 + i * .1, 0xB89BFF);
    if (i >= 1) this.halo(g, .2, 1.6 + i * .1, 0x7FE3FF);
    const cr = new this.T.Mesh(new this.T.OctahedronGeometry(.16, 0), this.glow(0x9FE3FF, 0x58C6FF)); cr.position.y = 1.95 + i * .2; g.add(cr);
    [0, 1, 2, 3].forEach(k => { const a = k * Math.PI / 2 + Math.PI / 4; this.box(g, .06, .3, .06, 0xF7F8FA, Math.cos(a) * .55, .15, Math.sin(a) * .55); this.sp(g, .05, this.glow(0x7FE3FF), Math.cos(a) * .55, .34, Math.sin(a) * .55); });
    return true;
  },

  /* ---------- 小屋 → 磚房 → 公寓 → 大樓 → 未來住宅 ---------- */
  tm_house(g, t, i, win){
    if (t === 1){
      if (i === 0) return false;   /* the little house */
      if (i === 2){ this.building(g, "house", win, false, 2, null, true); return true; }   /* the classic two-storey house */
      /* the little house with a side room and a vegetable patch */
      this.box(g, .62, .44, .5, 0xF8F3EA, -.06, .22, 0); this.roof(g, .7, .3, .62, 0xDB6A41, .44);
      this.door(g, -.06, .26); this.box(g, .1, .1, .02, win, -.24, .28, .26); this.box(g, .1, .1, .02, win, .12, .28, .26);
      this.box(g, .3, .3, .4, 0xEFE6D6, .4, .15, -.02); this.box(g, .34, .04, .44, 0xC9574A, .4, .32, -.02); this.box(g, .1, .1, .02, win, .4, .17, .19);
      this.box(g, .3, .04, .2, 0x8A6447, -.45, .02, .42); [-.53, -.45, -.37].forEach(x => this.crop(g, x, .42, 0x7FBF5E, .8));
      return true;
    }
    if (t === 2){
      /* 磚房: red-brick townhouses with white trim, two to three floors */
      const fl = 2 + (i >= 1 ? 1 : 0), w = i === 2 ? 1.0 : .7, h = fl * .3;
      this.box(g, w, h, .55, 0xB8573E, 0, h / 2, 0); this.box(g, w + .04, .05, .59, 0xF4EFE6, 0, h, 0);
      this.roof(g, w + .06, .26, .62, 0x5B4A44, h + .02);
      for (let f = 0; f < fl; f++) for (let x = -w / 2 + .17; x < w / 2 - .1; x += .22){ if (f === 0 && Math.abs(x) < .08) continue; this.box(g, .12, .14, .02, win, x, .17 + f * .3, .285); this.box(g, .15, .025, .03, 0xF4EFE6, x, .09 + f * .3, .29); }
      this.door(g, 0, .285, 0x3F5A73); this.box(g, .26, .04, .1, 0xF4EFE6, 0, .02, .34);
      this.box(g, .09, .22, .09, 0x8A4A3A, w / 2 - .14, h + .2, -.1);
      if (i === 2) this.box(g, .02, h, .56, 0xF4EFE6, 0, h / 2, 0);
      this.tree(g, -w / 2 - .12, 0, .3, .6, 0x7FB860);
      return true;
    }
    if (t === 3){
      if (i === 0) return false;   /* the classic 4-floor apartment (lv3 model) */
      /* taller apartments with balconies, then twin blocks */
      const blk = (x, fl) => {
        const h = fl * .28;
        this.box(g, .62, h, .62, 0xF3E9DA, x, h / 2, 0); this.box(g, .66, .05, .66, 0xB9A58A, x, h + .02, 0);
        for (let f = 0; f < fl; f++){ const y = .16 + f * .28; [-.16, .16].forEach(dx => this.box(g, .12, .12, .02, win, x + dx, y, .32)); if (f) this.box(g, .5, .025, .1, 0xDB6A41, x, y - .08, .36); }
        this.box(g, .5, .04, .5, 0x8CC46E, x, h + .06, 0); this.tree(g, x + .12, h + .06, 0, .35);
      };
      if (i === 1) blk(0, 6); else { blk(-.34, 6); blk(.34, 5); this.box(g, .1, .2, .3, 0xE5DACA, 0, .1, 0); }
      this.door(g, i === 1 ? 0 : -.34, .32, 0x6E8FB0);
      return true;
    }
    if (t === 4){
      /* 大樓: a slim residential tower, growing taller, with a rooftop crown */
      const h = 1.6 + i * .35;
      this.box(g, .8, .22, .7, 0xD8DDE2, 0, .11, 0); this.box(g, .6, .2, .02, win, 0, .12, .36);
      this.box(g, .56, h, .5, 0xEDEFF2, 0, .22 + h / 2, 0);
      for (let y = .38; y < .22 + h - .1; y += .2){ this.box(g, .5, .1, .02, win, 0, y, .26); this.box(g, .02, .1, .4, win, .29, y, 0); this.box(g, .02, .1, .4, win, -.29, y, 0); this.box(g, .6, .02, .54, 0xC9CED4, 0, y - .07, 0); }
      this.box(g, .4, .14, .36, 0xC9CED4, 0, .29 + h, 0); this.box(g, .02, .3, .02, 0xC0C6CC, .1, .5 + h, 0); this.sp(g, .03, 0xFF6B6B, .1, .66 + h, 0, {emissive:0xFF3B3B, emissiveIntensity:.8});
      [-.5, .5].forEach(x => this.tree(g, x, 0, .35, .55, 0x7FB860));
      return true;
    }
    /* 未來住宅: round white pods stacked on a stem, with greenery and solar petals */
    const pods = [[0, .5, 0, .34]].concat(i >= 1 || t === 6 ? [[-.3, .95, .05, .26]] : [], i >= 2 || t === 6 ? [[.3, 1.3, -.05, .24]] : [], t === 6 ? [[0, 1.7, 0, .22]] : []);
    this.cy(g, .08, .12, pods[pods.length - 1][1], 0xF7F8FA, 0, pods[pods.length - 1][1] / 2, 0, 12);
    pods.forEach(([x, y, z, r]) => { const p = this.sp(g, r, 0xF7F8FA, x, y, z); p.scale.y = .62; const b = this.sp(g, r * .98, this.glass(0x9FD3E6), x, y + .02, z + .02); b.scale.set(.9, .32, 1); this.box(g, r * 1.2, .04, r * 1.2, 0x8CC46E, x, y - r * .5, z); });
    this.solar(g, .42, .25, .32, .22, .16); this.solar(g, -.42, .25, .32, .22, .16);
    if (t === 6) this.halo(g, .3, 2.0, 0xB89BFF);
    this.tree(g, -.45, 0, -.4, .6, 0x7FB860);
    return true;
  },

  /* ---------- 農田 → 溫室 → 室內農場 → 垂直農場 → 科技農場 ---------- */
  tm_farm(g, t, i, win){
    if (t === 1) return false;   /* the open field (lv1–3 in city3d.js) */
    if (t === 2){
      /* 溫室: one, two, then three glass arch greenhouses over rows of crops */
      this.box(g, 1.25, .04, 1.0, 0x8A6447, 0, .02, 0);
      const n = i + 1, w = 1.1 / n;
      for (let k = 0; k < n; k++){
        const x = (k - (n - 1) / 2) * w;
        const a = new this.T.Mesh(new this.T.CylinderGeometry(w * .45, w * .45, .86, 14, 1, false, -Math.PI / 2, Math.PI), this.glass()); a.rotation.x = Math.PI / 2; a.position.set(x, .06, 0); g.add(a);
        for (let z = -.3; z <= .31; z += .15) this.crop(g, x, z, k % 2 ? 0xE57373 : 0x7FBF5E, .9);
        this.box(g, .02, .02, .86, 0xFFFFFF, x, .06 + w * .45, 0);
      }
      return true;
    }
    if (t === 3){
      /* 室內農場: a warehouse whose windows glow grow-light purple, plus silos */
      this.box(g, .9, .5, .7, 0xE7E2DA, -.08, .25, 0); this.box(g, .96, .05, .76, 0x8E99A6, -.08, .52, 0);
      const pur = this.glow(0xC79BFF, 0xA06BFF);
      for (let x = -.38; x <= .25; x += .21) this.box(g, .14, .14, .02, pur, x, .32, .36);
      this.box(g, .2, .25, .02, 0x6E8FB0, -.08, .125, .36);
      this.cy(g, .14, .14, .7, 0xD9DDE2, .5, .35, -.15); this.co(g, .15, .12, 0xB0B8C0, .5, .76, -.15);
      if (i >= 1){ this.cy(g, .12, .12, .55, 0xD9DDE2, .5, .275, .2); this.co(g, .13, .1, 0xB0B8C0, .5, .6, .2); }
      if (i >= 2){ this.solar(g, -.3, .58, 0, .32, .5, -.25); this.solar(g, .12, .58, 0, .32, .5, -.25); }
      return true;
    }
    if (t === 4){
      /* 垂直農場: a glass tower with a green garden on every floor */
      const fl = 4 + i, h = fl * .26;
      this.box(g, .7, h, .7, this.glass(0xBFEFE0), 0, h / 2 + .02, 0);
      for (let f = 0; f < fl; f++){ const y = .04 + f * .26; this.box(g, .74, .03, .74, 0xE4E7EA, 0, y, 0); this.box(g, .6, .06, .6, 0x6FAE57, 0, y + .05, 0); for (let x = -.2; x <= .21; x += .2) this.crop(g, x, .2, 0x8CC46E, .8).position.y = y + .12; }
      this.box(g, .74, .04, .74, 0xE4E7EA, 0, h + .04, 0); this.cy(g, .03, .03, .5, 0xF4F4F0, .2, h + .3, .2, 6);
      for (let k = 0; k < 3; k++){ const b = this.box(g, .04, .32, .015, 0xF4F4F0, .2, h + .56, .22); b.rotation.z = k * 2.094; b.geometry.translate(0, .14, 0); }
      return true;
    }
    /* 科技農場: a glass dome of crops, robot arms, drones and a solar field */
    this.cy(g, .6, .62, .08, 0xE4E7EA, 0, .04, 0, 24);
    this.sp(g, .5 + (t === 6 ? .06 : 0), this.glass(0xBFEFE0), 0, .08, 0, null, true);
    for (let a = 0; a < 6; a++){ const r = .25; this.crop(g, Math.cos(a) * r, Math.sin(a) * r, a % 2 ? 0xF3CC58 : 0x7FBF5E, 1.2); }
    this.crop(g, 0, 0, 0xE57373, 1.4);
    const drone = (x, y, z) => { this.box(g, .12, .03, .12, 0x3B4A59, x, y, z); [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => this.cy(g, .04, .04, .01, 0x9FE3FF, x + a * .07, y + .02, z + b * .07, 8)); };
    drone(-.35, .85, .2); if (i >= 1 || t === 6) drone(.3, .95, -.15);
    if (i >= 2 || t === 6){ this.solar(g, .5, .12, .45, .26, .16); this.solar(g, -.5, .12, .45, .26, .16); }
    if (t === 6) this.halo(g, .62, .62, 0x7FE3FF);
    return true;
  },

  /* ---------- 小公園 → 廣場 → 中央公園 → 空中花園 → 生態穹頂 ---------- */
  tm_park(g, t, i, win){
    if (t === 1) return false;
    if (t === 2){
      /* 廣場: a paved square, a big fountain, then a statue and lamps */
      this.box(g, 1.3, .03, 1.1, 0xE6DCCB, 0, .015, 0); this.box(g, 1.0, .031, .8, 0xD8CCB6, 0, .016, 0);
      this.cy(g, .38, .4, .1, 0xD5DBDF, 0, .07, 0, 16); this.cy(g, .33, .33, .02, 0x7EC8E3, 0, .12, 0, 16);
      this.cy(g, .14, .16, .08, 0xD5DBDF, 0, .16, 0, 12); this.cy(g, .04, .05, .28, 0xD5DBDF, 0, .3, 0); this.sp(g, .08, 0xA8E0F0, 0, .46, 0);
      const bench = (x, z, r) => { const b = this.box(g, .3, .04, .1, 0xA0784F, x, .12, z); b.rotation.y = r || 0; };
      bench(-.5, .35); bench(.5, .35);
      if (i >= 1){ this.lamp(g, -.58, -.4, .45); this.lamp(g, .58, -.4, .45); [-.45, .45].forEach(x => this.tree(g, x, 0, -.25, .6, 0x7FB860)); }
      if (i >= 2){ this.box(g, .2, .2, .2, 0xD5DBDF, 0, .1, -.45); const s = new this.T.Mesh(new this.T.CapsuleGeometry(.07, .18, 3, 6), this.mat(0xC8A44A, {metalness:.4})); s.position.set(0, .35, -.45); g.add(s); this.sp(g, .07, 0xC8A44A, 0, .53, -.45, {metalness:.4}); }
      return true;
    }
    if (t === 3){
      /* 中央公園: a lake with an island, big old trees, a gazebo and a boat */
      this.box(g, 1.3, .02, 1.1, 0x8FC46A, 0, .01, 0);
      const lake = this.cy(g, .42, .42, .02, 0x6FBEDC, -.15, .03, .1, 20); lake.scale.z = .75;
      this.cy(g, .1, .1, .03, 0x8FC46A, -.2, .04, .1, 10); this.tree(g, -.2, .04, .1, .5);
      this.box(g, .12, .03, .06, 0xE8E2D6, .05, .05, .22);
      [[.45, -.35, 1.1], [-.5, -.4, 1.0], [.5, .4, .9]].forEach(([x, z, s]) => this.tree(g, x, 0, z, s, 0x6FAE57));
      if (i >= 1){ [[-.15, -.15], [.15, -.15], [-.15, .15], [.15, .15]].forEach(([x, z]) => this.box(g, .03, .3, .03, 0xFFFFFF, .35 + x, .15, .0 + z)); this.co(g, .28, .18, 0x6E8FB0, .35, .38, 0, 6); }
      if (i >= 2){ this.lamp(g, -.6, .45, .4); this.lamp(g, .6, -.05, .4); this.box(g, .9, .02, .14, 0xE9DCC3, .1, .025, -.45); }
      return true;
    }
    if (t === 4){
      /* 空中花園: stepped terraces spilling with plants and a waterfall */
      const steps = 3 + i;
      for (let k = 0; k < steps; k++){ const s = 1.1 - k * .2, y = k * .2; this.box(g, s, .2, s * .85, 0xE4DCCF, 0, y + .1, -k * .04); this.box(g, s - .06, .05, s * .85 - .06, 0x6FAE57, 0, y + .22, -k * .04); if (k < steps - 1) this.tree(g, s / 2 - .12, y + .2, s * .3, .45, k % 2 ? 0xF6B8CF : 0x7FB860); }
      this.box(g, .1, steps * .2, .02, this.mat(0x8ED1E6, {transparent:true, opacity:.75}), -.15, steps * .1, .48);
      this.tree(g, 0, steps * .2, -steps * .04, .7, 0x6FAE57);
      return true;
    }
    /* 生態穹頂: a glass dome full of trees, with a floating ring at the 6th tier */
    this.cy(g, .62, .64, .08, 0xE4E7EA, 0, .04, 0, 24);
    this.box(g, 1.0, .02, 1.0, 0x8FC46A, 0, .09, 0);
    [[-.2, -.15, 1.0], [.22, .05, .9], [-.05, .25, .8], [.15, -.3, .7]].forEach(([x, z, s]) => this.tree(g, x, .08, z, s, 0x5FB06A));
    const p = this.cy(g, .14, .14, .02, 0x6FBEDC, -.25, .1, .25, 14);
    this.sp(g, .6 + i * .03, this.glass(0xD8F4FF), 0, .08, 0, null, true);
    if (t === 6) this.halo(g, .66, .7, 0xB89BFF);
    return true;
  },

  /* ---------- 咖啡店 → 咖啡館 → 咖啡大樓 → 美食商場 → 未來咖啡站 ---------- */
  tm_cafe(g, t, i, win){
    if (t === 1) return false;
    const col = 0xE8945A;
    const umb = (x, z) => { this.box(g, .02, .26, .02, 0xffffff, x, .13, z); this.co(g, .17, .1, 0xF6F1E7, x, .3, z, 8); this.box(g, .16, .02, .16, 0x9C7B5B, x, .12, z); };
    if (t === 2){
      /* 咖啡館: a corner café with a terrace upstairs and umbrellas out front */
      this.box(g, .8, .7, .55, 0xF3E3CB, 0, .35, -.08); this.box(g, .84, .05, .6, 0xE7D2B3, 0, .72, -.08);
      this.box(g, .7, .26, .02, win, 0, .2, .2); const aw = this.box(g, .8, .03, .2, col, 0, .38, .3); aw.rotation.x = .35;
      this.winRow(g, win, 3, .7, .55, .2, .24);
      this.box(g, .84, .12, .02, 0xFFFFFF, 0, .8, .21); umb(-.3, .5); umb(.3, .5);
      if (i >= 1) this.box(g, .3, .2, .03, col, 0, .96, -.1);
      if (i >= 2){ this.tree(g, -.45, .72, -.25, .4); this.tree(g, .45, .72, -.25, .4); }
      return true;
    }
    if (t === 3){
      /* 咖啡大樓: three floors with a giant cup on the roof */
      const h = .9 + i * .2;
      this.box(g, .78, h, .6, 0xF6EBDD, 0, h / 2, 0);
      for (let y = .2; y < h - .1; y += .26) this.box(g, .68, .14, .02, win, 0, y, .31);
      this.box(g, .82, .05, .64, col, 0, h + .02, 0);
      const cup = this.cy(g, .16, .12, .2, 0xFFFFFF, 0, h + .15, 0, 14); this.cy(g, .14, .14, .02, 0x6B3F25, 0, h + .25, 0, 14);
      const hd = new this.T.Mesh(new this.T.TorusGeometry(.06, .02, 6, 12), this.mat(0xFFFFFF)); hd.position.set(.17, h + .15, 0); g.add(hd);
      umb(-.42, .45); umb(.42, .45);
      return true;
    }
    if (t === 4){
      /* 美食商場: a long glass mall with a curved roof and banners */
      this.box(g, 1.25, .5, .8, this.glass(0xCFEAF2), 0, .27, 0); this.box(g, 1.25, .04, .8, 0xE4E7EA, 0, .02, 0);
      const r = new this.T.Mesh(new this.T.CylinderGeometry(.42, .42, 1.25, 16, 1, false, -Math.PI / 2, Math.PI), this.mat(0xE4E7EA)); r.rotation.z = Math.PI / 2; r.scale.y = 1; r.position.y = .52; r.scale.set(1, 1, .45); g.add(r);
      [[-.4, 0xE8945A], [0, 0xC9574A], [.4, 0x4DB892]].forEach(([x, c]) => { this.box(g, .3, .3, .5, c, x, .2, -.05); this.box(g, .22, .14, .01, 0xFFFFFF, x, .3, .41); });
      for (let k = 0; k <= i; k++) this.box(g, .03, .5, .03, 0xC0C6CC, -.55 + k * .3, .25, .45);
      return true;
    }
    /* 未來咖啡站: a glowing disc café on a single stem */
    this.cy(g, .14, .2, .6, 0xF7F8FA, 0, .3, 0, 12);
    this.cy(g, .55, .4, .2, 0xF7F8FA, 0, .7, 0, 24); this.cy(g, .52, .52, .1, this.glass(0x9FD3E6), 0, .84, 0, 24);
    this.cy(g, .3, .45, .06, this.glow(0xFFB27A, 0xFF8A3D), 0, .6, 0, 24);
    const cup = this.cy(g, .1, .08, .14, 0xFFFFFF, 0, .96, 0, 12);
    if (i >= 1 || t === 6) this.halo(g, .62, .72, 0xFFB27A);
    if (t === 6) this.halo(g, .4, 1.15, 0x7FE3FF);
    return true;
  },

  /* ---------- 書店 → 圖書館 → 學院 → 大學 → 知識塔 ---------- */
  tm_books(g, t, i, win){
    if (t === 1) return false;
    if (t === 2){
      /* 圖書館: a stone library with columns and a pediment */
      this.box(g, 1.0, .55, .7, 0xEDE7DC, 0, .3, -.05); this.box(g, 1.1, .06, .8, 0xD5CBB8, 0, .6, -.05);
      const p = this.co(g, .62, .22, 0xD5CBB8, 0, .74, .25, 3); p.rotation.z = Math.PI / 2; p.rotation.y = Math.PI / 2; p.scale.set(.3, 1, 1.6);
      for (let x = -.38; x <= .39; x += .19) this.cy(g, .04, .045, .5, 0xF7F3EC, x, .3, .32, 8);
      this.box(g, 1.0, .05, .22, 0xD5CBB8, 0, .025, .38); this.door(g, 0, .31, 0x6E8FB0);
      if (i >= 1) this.box(g, .5, .25, .4, 0xEDE7DC, 0, .75, -.2);
      if (i >= 2){ this.sp(g, .2, 0x6E8FB0, 0, .88, -.2, null, true); this.tree(g, -.55, 0, .35, .55); this.tree(g, .55, 0, .35, .55); }
      return true;
    }
    if (t === 3){
      /* 學院: a brick hall with a clock tower and a green lawn */
      this.box(g, 1.1, .55, .55, 0xB8573E, 0, .28, -.1); this.roof(g, 1.16, .26, .62, 0x4F5D68, .55);
      this.winRow(g, win, 4, 1, .3, .18, .25);
      this.box(g, .28, 1.1 + i * .15, .28, 0xB8573E, 0, (1.1 + i * .15) / 2, -.1);
      this.cy(g, .09, .09, .02, 0xFFFFFF, 0, .95 + i * .15, .05).rotation.x = Math.PI / 2;
      this.co(g, .22, .3, 0x4F5D68, 0, 1.25 + i * .15, -.1, 4).rotation.y = Math.PI / 4;
      this.box(g, 1.1, .02, .3, 0x8FC46A, 0, .01, .4); this.door(g, 0, .18, 0x3F5A73);
      return true;
    }
    if (t === 4){
      /* 大學: wings round a quad and a great dome */
      [[-.42, 0], [.42, 0]].forEach(([x]) => { this.box(g, .32, .5, .9, 0xEDE7DC, x, .25, -.05); this.box(g, .36, .05, .94, 0x6E8FB0, x, .52, -.05); for (let z = -.35; z <= .36; z += .2) this.box(g, .02, .1, .1, win, x + (x < 0 ? .17 : -.17), .3, z); });
      this.box(g, .55, .6, .35, 0xEDE7DC, 0, .3, -.32); this.cy(g, .2, .22, .15, 0xEDE7DC, 0, .67, -.32);
      this.sp(g, .22 + i * .02, this.mat(0x6E8FB0, {metalness:.3}), 0, .74, -.32, null, true);
      this.box(g, .5, .02, .45, 0x8FC46A, 0, .01, .2); this.tree(g, 0, 0, .25, .5 + i * .1);
      return true;
    }
    /* 知識塔: a crystal tower full of light, with floating books */
    this.cy(g, .5, .55, .12, 0xE4E7EA, 0, .06, 0, 6);
    const tw = this.cy(g, .14, .34, 1.5 + i * .2, this.glass(0xC9C2FF), 0, .87 + i * .1, 0, 6);
    this.cy(g, .08, .2, 1.4 + i * .2, this.glow(0xB89BFF, 0x8A6BFF), 0, .85 + i * .1, 0, 6);
    const cr = new this.T.Mesh(new this.T.OctahedronGeometry(.15, 0), this.glow(0xE6DBFF, 0xB89BFF)); cr.position.y = 1.85 + i * .2; g.add(cr);
    [[.4, .7, 0xE57373], [-.4, .95, 0x4C8BE0], [.3, 1.25, 0xF3CC58]].forEach(([x, y, c]) => { const b = this.box(g, .14, .04, .1, c, x, y, .1); b.rotation.z = .3; });
    if (t === 6) this.halo(g, .45, 1.4, 0x7FE3FF);
    return true;
  },

  /* ---------- 診所 → 醫院 → 醫療中心 → 生技中心 ---------- */
  tm_clinic(g, t, i, win){
    if (t === 1) return false;
    const cross = (x, y, z, s) => { this.box(g, .06 * s, .2 * s, .02, 0xE53935, x, y, z); this.box(g, .2 * s, .06 * s, .02, 0xE53935, x, y, z); };
    if (t === 2){
      /* 醫院: three white floors with a red cross */
      const fl = 3 + (i >= 2 ? 1 : 0), h = fl * .28;
      this.box(g, .95, h, .6, 0xFFFFFF, 0, h / 2, 0); this.box(g, 1.0, .05, .65, 0x48A88B, 0, h + .02, 0);
      for (let f = 1; f < fl; f++) this.box(g, .85, .12, .02, win, 0, .14 + f * .28, .31);
      this.box(g, .3, .22, .02, 0x9BD3C0, 0, .11, .31); cross(.32, .16, .32, 1);
      if (i >= 1){ this.box(g, .4, .05, .2, 0x48A88B, 0, .25, .42); [-.18, .18].forEach(x => this.box(g, .03, .25, .03, 0xFFFFFF, x, .12, .5)); }
      return true;
    }
    if (t === 3){
      /* 醫療中心: a tower with a helipad, beside a low wing */
      const h = 1.3 + i * .2;
      this.box(g, .5, h, .5, 0xFFFFFF, -.2, h / 2, -.1); for (let y = .25; y < h; y += .22) this.winRing(g, win, .5, .5, y, 2);
      this.cy(g, .26, .26, .04, 0x5A6B78, -.2, h + .02, -.1, 16); this.box(g, .03, .02, .2, 0xFFFFFF, -.26, h + .05, -.1); this.box(g, .03, .02, .2, 0xFFFFFF, -.14, h + .05, -.1); this.box(g, .12, .02, .03, 0xFFFFFF, -.2, h + .05, -.1);
      this.box(g, .5, .35, .7, 0xF4F7F6, .35, .18, .05); this.box(g, .52, .04, .72, 0x48A88B, .35, .37, .05); cross(.35, .2, .41, 1);
      return true;
    }
    /* 生技中心: glass halls round a glowing DNA helix */
    this.box(g, 1.1, .35, .8, this.glass(0xCFF2E6), 0, .18, 0); this.box(g, 1.14, .04, .84, 0xF4F7F6, 0, .37, 0);
    const n = 12 + i * 4;
    for (let k = 0; k < n; k++){ const a = k * .55, y = .45 + k * .07, r = .16;
      this.sp(g, .04, this.glow(0x7FE3FF), Math.cos(a) * r, y, Math.sin(a) * r); this.sp(g, .04, this.glow(0x4DB892), -Math.cos(a) * r, y, -Math.sin(a) * r);
      if (k % 2 === 0){ const b = this.box(g, r * 2, .015, .015, 0xFFFFFF, 0, y, 0); b.rotation.y = -a; } }
    cross(.4, .2, .42, 1);
    if (t === 6) this.halo(g, .45, .45 + n * .07, 0x7FE3FF);
    return true;
  },

  /* ---------- 地標: the spire, then the spire with rings of light ---------- */
  tm_landmark(g, t, i, win){
    if (t < 6) return false;
    this.cy(g, .5, .55, .12, 0xE6DCCB, 0, .06, 0, 16); this.cy(g, .36, .4, .1, 0xF4EFE6, 0, .17, 0, 16);
    this.cy(g, .05, .22, 2.3 + i * .2, 0xF7F5F0, 0, 1.35 + i * .1, 0, 8);
    this.halo(g, .45, .8, 0xF3CC58); this.halo(g, .34, 1.5, 0x7FE3FF); this.halo(g, .24, 2.1, 0xB89BFF);
    const cr = new this.T.Mesh(new this.T.OctahedronGeometry(.2, 0), this.glow(0x9FE3FF, 0x58C6FF)); cr.position.y = 2.7 + i * .2; g.add(cr);
    return true;
  }
});
