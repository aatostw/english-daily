/* =========================================================
   3D island (Townscaper / HEART-island style) drawn with Three.js.
   Same town data as the flat version; only the picture changes.
   Draws only when something changes (drag, pinch, a new building), so it
   doesn't keep the phone busy. Falls back to the flat island if 3D can't load.
   ========================================================= */
const THREE_URL = "https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.min.js";
const City3D = {
  T:null, loading:null, failed:false, r:null, scene:null, cam:null, group:null, overlay:null, host:null,
  sig:"", bgs:{}, ring:null, selShown:null, az:Math.PI / 5, el:1.0, dist:null, pick:[], labels:[], known:new Set(), grow:[], frame:0, mats:{},
  load(){
    if (!this.loading) this.loading = import(THREE_URL).then(m => (this.T = m)).catch(e => { this.loading = null; throw e; });
    return this.loading;
  },
  async mount(){
    if (this.failed || !$("#city3d")) return;
    try { await this.load(); } catch (e) { const w = $("#city3d .city-wait"); if (w) w.textContent = "城市要連上網路才能載入。"; return; }
    const host = $("#city3d"); if (!host || S.view !== "city") return;
    try { if (!this.r) this.init(); } catch (e) { this.failed = true; const w = $("#city3d .city-wait"); if (w) w.textContent = "這台裝置不能顯示 3D 城市。"; return; }
    if (this.host !== host || !host.contains(this.r.domElement)){
      host.innerHTML = ""; host.appendChild(this.r.domElement); host.appendChild(this.overlay); host.classList.add("live");
      this.host = host;
    }
    this.resize(); this.rebuild(); this.draw(); this.walkLoop();
  },
  mat(color, extra){
    const k = color + JSON.stringify(extra || {});
    if (!this.mats[k]) this.mats[k] = new this.T.MeshStandardMaterial(Object.assign({color, roughness:.88, metalness:0, flatShading:true}, extra || {}));
    return this.mats[k];
  },
  init(){
    const T = this.T;
    const r = this.r = new T.WebGLRenderer({antialias:true, powerPreference:"low-power"});
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    r.shadowMap.enabled = true; r.shadowMap.type = T.PCFSoftShadowMap;
    r.outputColorSpace = T.SRGBColorSpace; r.toneMapping = T.ACESFilmicToneMapping; r.toneMappingExposure = 1.05;
    r.domElement.className = "city-canvas";
    this.scene = new T.Scene();
    this.cam = new T.PerspectiveCamera(30, 1, .1, 300);
    this.hemi = new T.HemisphereLight(0xfff6e6, 0x86b3a6, 1.15); this.scene.add(this.hemi);
    const sun = this.sun = new T.DirectionalLight(0xfff0d6, 2.3);
    sun.position.set(7, 13, 6); sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024);
    Object.assign(sun.shadow.camera, {left:-9, right:9, top:9, bottom:-9, near:1, far:40}); sun.shadow.bias = -.0008; sun.shadow.normalBias = .02;
    this.scene.add(sun);
    /* sea, shallows and the scenery far away (hills with pines, little islets, wind turbines) */
    const sea = new T.Mesh(new T.CircleGeometry(90, 64), this.mat(0x76B8AE, {flatShading:false, roughness:.7}));
    sea.rotation.x = -Math.PI / 2; sea.position.y = -.42; sea.receiveShadow = true; this.scene.add(sea);
    this.shallow = new T.Mesh(new T.CircleGeometry(1, 48), this.mat(0x9BD0C4, {flatShading:false, transparent:true, opacity:.75}));
    this.shallow.rotation.x = -Math.PI / 2; this.shallow.position.y = -.41; this.scene.add(this.shallow);
    const far = new T.Group();
    const hill = (x, z, rad, h, col) => { const m = new T.Mesh(new T.ConeGeometry(rad, h, 7, 1), this.mat(col)); m.position.set(x, h / 2 - .45, z); m.scale.z = .75; far.add(m); return m; };
    const pine = (x, z, s) => { const m = new T.Mesh(new T.ConeGeometry(.35 * s, 1.1 * s, 5), this.mat(0x4E7F5A)); m.position.set(x, .1 + .5 * s, z); far.add(m); };
    [[-14, -24, 9, 6, 0xA9B98B], [6, -30, 12, 8, 0x9DAF80], [24, -22, 8, 5, 0xB2C194], [-30, -12, 7, 4, 0xA9B98B]].forEach(([x, z, rr, h, c]) => {
      hill(x, z, rr, h, c);
      for (let i = 0; i < 9; i++){ const a = i * 2.39, d = rr * (.35 + (i % 3) * .18); pine(x + Math.cos(a) * d, z + Math.sin(a) * d * .7 + 1, 1 + (i % 2) * .4); }
    });
    const islet = (x, z, rad) => {
      const m = new T.Mesh(new T.CylinderGeometry(rad, rad * 1.1, .5, 18), this.mat(0xE9DCC0)); m.position.set(x, -.3, z); far.add(m);
      const g = new T.Mesh(new T.CylinderGeometry(rad * .85, rad * .9, .12, 18), this.mat(0xA9CF7E)); g.position.set(x, -.02, z); far.add(g);
      this.tree(far, x + rad * .3, .05, z, .9, 0x86BF6A);
    };
    islet(-11, 6, 1.8); islet(12, 9, 1.4); islet(13, -6, 1.1); islet(-12, -8, 1.2);
    const turbine = (x, z) => {
      const p = new T.Mesh(new T.CylinderGeometry(.05, .07, 3, 6), this.mat(0xF4F4F0)); p.position.set(x, 1.1, z); far.add(p);
      for (let i = 0; i < 3; i++){ const b = new T.Mesh(new T.BoxGeometry(.06, 1.1, .02), this.mat(0xF4F4F0)); b.position.set(x, 2.6, z + .05); b.rotation.z = i * 2.094; b.geometry.translate(0, .55, 0); far.add(b); }
    };
    turbine(-11.4, 5.4); turbine(-10.4, 6.8);
    this.scene.add(far);
    this.group = new T.Group(); this.scene.add(this.group);
    /* labels and resident bubbles are HTML on top of the canvas */
    this.overlay = document.createElement("div"); this.overlay.className = "city-ov";
    this.controls(r.domElement);
    window.addEventListener("resize", () => { if (this.host && S.view === "city"){ this.resize(); this.draw(); } });
  },
  tree(parent, x, y, z, s, col){
    const T = this.T;
    const trunk = new T.Mesh(new T.CylinderGeometry(.04 * s, .05 * s, .22 * s, 5), this.mat(0x8A6A4A)); trunk.position.set(x, y + .11 * s, z); trunk.castShadow = true; parent.add(trunk);
    const top = new T.Mesh(new T.IcosahedronGeometry(.2 * s, 0), this.mat(col || 0x8CC46E)); top.position.set(x, y + .32 * s, z); top.castShadow = true; parent.add(top);
    const top2 = new T.Mesh(new T.IcosahedronGeometry(.14 * s, 0), this.mat(col || 0x9FD07E)); top2.position.set(x + .08 * s, y + .45 * s, z - .04 * s); top2.castShadow = true; parent.add(top2);
  },
  timeOfDay(){ const h = new Date().getHours(); return h >= 5 && h < 8 ? "dawn" : h >= 8 && h < 17 ? "day" : h >= 17 && h < 19 ? "dusk" : "night"; },
  light(){
    const T = this.T, t = this.timeOfDay();
    const p = {dawn:[0xF6DCC4, 0xfff0e0, 1.8, 1.0, .25], day:[0xD6EAE5, 0xfff2dc, 2.3, 1.15, 0], dusk:[0xF0C7A6, 0xffc89a, 1.6, .9, .45], night:[0x24314F, 0xaab8ff, .55, .45, 1]}[t];
    this.scene.background = new T.Color(p[0]); this.scene.fog = new T.Fog(p[0], 22, 60);
    this.sun.color.setHex(p[1]); this.sun.intensity = p[2]; this.hemi.intensity = p[3];
    const win = this.mat(0xFFF1C4, {emissive:0xFFC864, emissiveIntensity:0});
    win.emissiveIntensity = p[4] * 1.4;
    return win;
  },
  /* ---------- the town ---------- */
  rebuild(){
    const T = this.T, c = city();
    const sig = JSON.stringify([c.tiles, c.residents.map(r => r.home + r.color), c.day.fed, c.day.requests.map(q => q.id + q.status + q.who), c.avatar, this.timeOfDay()]);
    if (sig === this.sig) return;
    this.sig = sig;
    const win = this.light();
    const g = this.group;
    while (g.children.length) g.remove(g.children[0]);
    this.pick = []; this.labels = []; this.overlay.innerHTML = ""; this.bgs = {}; this.ring = null; this.selShown = null;
    const tiles = cityTiles(c), R = cityRadius(c), L = cityLinked(c);
    const H = .55, pos = (q, r) => [Math.sqrt(3) * (q + r / 2), 1.5 * r], posK = k => pos(...k.split(",").map(Number));
    this.shallow.scale.setScalar(R * 1.9 + 2.2);
    if (this.dist == null || this.lastR !== R){
      this.dist = 6 + 5 * R; this.lastR = R;
      const sc = this.sun.shadow.camera, e = R * 2 + 3; Object.assign(sc, {left:-e, right:e, top:e, bottom:-e}); sc.updateProjectionMatrix();
      this.scene.fog.near = this.dist + 6; this.scene.fog.far = this.dist + 44;
    }
    const centers = {};
    tiles.forEach(([q, r]) => {
      const key = q + "," + r, [x, z] = pos(q, r), it = c.tiles[key];
      const base = new T.Mesh(new T.CylinderGeometry(.95, 1, H, 6), this.mat(0xD7C09B)); base.position.set(x, -H / 2 - .02, z); base.castShadow = base.receiveShadow = true; g.add(base);
      const host = it && it.part ? c.tiles[it.part] : it;
      const ground = host && host.g && CITY_GROUNDS[host.g] ? CITY_GROUNDS[host.g][1] : null;   /* buildings, roads and the center can each have their own ground */
      /* land nobody has bought yet looks wild (grey-green, a plus sign and a bush); bought land is plain sand, the same as the 沙地 ground */
      const wild = !it && !landOwned(c, key);
      const top = new T.Mesh(new T.CylinderGeometry(.93, .95, .07, 6), this.mat(wild ? 0xC3C9AE : ground || (host && host.b === "park" ? 0xA8CF7C : host && host.b === "road" ? 0xE4D8C2 : host && host.b === "hall" ? 0xE6DCCB : 0xF2E6CE))); top.position.set(x, .015, z); top.receiveShadow = true;
      top.userData.key = key; g.add(top); this.pick.push(top);
      if (it && it.b === "road"){ this.road(g, c, q, r, x, z, pos); return; }
      if (it && it.part) return;
      if (it && !it.b && !it.d) return;   /* only a ground laid on it */
      if (!it && landOwned(c, key)) return;   /* a bought plot: plain sand */
      if (!it){
        /* an empty plot: a soft plus sign and a little bush on the edge */
        [[.36, .05], [.05, .36]].forEach(([w, d]) => { const m = new T.Mesh(new T.BoxGeometry(w, .02, d), this.mat(0xA4AC8C)); m.position.set(x, .06, z); g.add(m); });
        this.tree(g, x + .55, .05, z + .3, .6, 0x9ACB78);
        return;
      }
      /* the front of the building faces its door */
      const pts = [[x, z]], gx = x, gz = z;
      let rot = 0;
      if (hasDoor(it)){ const [dx, dz] = posK(doorKey(c, key)); rot = Math.atan2(dx - x, dz - z); }
      const spots = [[0, 0]];
      centers[key] = [gx, gz, pts];
      const lv = tileLv(it), linked = !it.b || L.has(key), b = it.b && CITY_BUILDINGS[it.b];
      const bg = new T.Group(); bg.position.set(gx, .05, gz); bg.rotation.y = rot; bg.userData.key = key;
      /* the landmark grows with the town: it takes the center's level */
      this.building(bg, it.b || it.d, win, (it.b && it.b !== "park" && it.b !== "hall" && !c.day.fed) || !linked, it.b === "landmark" ? hallLv(c) : lv, spots);
      bg.traverse(m => { if (m.isMesh){ m.castShadow = true; m.receiveShadow = true; m.userData.key = key; this.pick.push(m); } });
      const top3 = new T.Box3().setFromObject(bg).max.y;
      if (!this.known.has(key + ":" + lv) && this.known.size){ bg.scale.setScalar(.01); this.grow.push({g:bg, t0:performance.now()}); }
      g.add(bg); this.bgs[key] = bg;
      const off = b && !b.fixed && (b.food || b.coins || b.know || b.boost || b.residents) && !linked;
      this.label(new T.Vector3(gx, top3 + .08, gz), '<span class="lbl bname' + (off ? " off" : "") + '">' + esc(cityName(it)) + (off ? "・未接市中心" : "") + "</span>");
    });
    this.known = new Set(Object.keys(c.tiles).filter(k => !c.tiles[k].part).map(k => k + ":" + tileLv(c.tiles[k]))); if (!this.known.size) this.known.add("_");
    /* residents beside their homes; a "!" above the ones who need you */
    this.walkers = [];
    const roads = cityRoads(c);
    c.residents.forEach((p, i) => {
      const ct = centers[p.home]; if (!ct || !L.has(p.home)) return;      /* people only come out once their home reaches the center */
      const req0 = c.day.requests.find(q => q.who === i && q.status === "open");
      if (!req0 && roads.size){
        /* everyone without a request goes out walking: along the roads, into other buildings, and back */
        const wg = new T.Group(); this.person(wg, 0, 0, p.color, .9); wg.visible = false; g.add(wg);
        this.walkers.push({g:wg, at:p.home, q:[], wait:.5 + Math.random() * 4, lane:(Math.random() - .5) * .22, s:0});
        return;
      }
      const j = c.residents.slice(0, i).filter(o => o.home === p.home).length;
      let x, z, ox, oz;
      if (ct[2].length === 1){ [x, z] = ct[2][0]; ox = [-.58, .58, -.62, .62][j % 4]; oz = [.45, .45, -.05, -.05][j % 4]; }
      else {
        /* stand on the outside edge of a big building, spread along it */
        const [ax, az] = ct[2][j % ct[2].length], dx = ax - ct[0], dz = az - ct[1], d = Math.hypot(dx, dz) || 1;
        x = ax; z = az; ox = dx / d * .62 + (-dz / d) * .25 * (j >= ct[2].length ? 1 : -1); oz = dz / d * .62 + (dx / d) * .25 * (j >= ct[2].length ? 1 : -1);
      }
      this.person(g, x + ox, z + oz, p.color, .9);
      const req = c.day.requests.find(q => q.who === i && q.status === "open");
      if (req) this.label(new T.Vector3(x + ox, .62, z + oz), '<button class="req-pin" data-act="city-req" data-id="' + req.id + '" aria-label="' + esc(p.name) + ' 的請求">!</button>', true);
    });
    /* Lisa stands just in front of the city center; tap her to chat */
    if (curWeek()){
      this.person(g, -.45, .86, "#FAFAF7", 1.6);
      const hm = this.mat(0x7A4532, {flatShading:false});
      /* hair: a full cap over the crown, then the back and sides falling below the face, leaving the face open */
      const crown = new T.Mesh(new T.SphereGeometry(.122, 14, 10, 0, Math.PI * 2, 0, Math.PI * .3), hm); crown.position.set(-.45, .52, .85); g.add(crown);
      const sides = new T.Mesh(new T.SphereGeometry(.124, 14, 10, Math.PI * .8, Math.PI * 1.4, 0, Math.PI * .62), hm); sides.position.set(-.45, .52, .85); g.add(sides);
      const back = new T.Mesh(new T.CylinderGeometry(.115, .15, .22, 14, 1, false, Math.PI * .3, Math.PI * 1.4), hm); back.position.set(-.45, .43, .85); g.add(back);
      this.box(g, .07, .14, .02, 0xF3DCD3, -.45, .3, .965);   /* the floral top under her open white shirt */
      this.label(new T.Vector3(-.45, .8, .86), '<button class="lisa-pin" data-act="open-chat" aria-label="找 Lisa 聊天"><span class="lisa-mini">' + LISA_SVG + '</span>Lisa</button>', true);
    }
    /* you, standing at the front of the island */
    const [fx, fz] = pos(0, R);
    this.avatar(g, fx - .5, fz + .5, c.avatar);
    this.walkLoop();
  },
  /* the chosen building lifts up and bobs, with a glowing ring on its plot */
  selKey(){
    if (S.view !== "city") return null;
    if (S.cityEdit && S.cityEdit.moveFrom) return S.cityEdit.moveFrom;
    const o = S.sheet; return o && o.kind === "city" && (o.s === "tile" || o.s === "land") ? o.k : null;
  },
  animSel(now){
    if (!this.group || !this.T) return false;
    const T = this.T, k = this.selKey();
    if (k !== this.selShown){
      if (this.selShown && this.bgs[this.selShown]) this.bgs[this.selShown].position.y = .05;
      if (this.ring){ this.group.remove(this.ring); this.ring = null; }
      this.selShown = k;
      if (k){
        const [q, r] = k.split(",").map(Number);
        this.ring = new T.Mesh(new T.RingGeometry(.74, .9, 6), new T.MeshBasicMaterial({color:0x4DB892, transparent:true, opacity:.9, side:T.DoubleSide, depthWrite:false}));
        this.ring.rotation.x = -Math.PI / 2; this.ring.rotation.z = Math.PI / 6;
        this.ring.position.set(Math.sqrt(3) * (q + r / 2), .075, 1.5 * r);
        this.group.add(this.ring);
      }
    }
    if (!k) return false;
    const bg = this.bgs[k], t = now / 1000;
    if (bg) bg.position.y = .05 + .32 + Math.sin(t * 3.2) * .05;
    if (this.ring) this.ring.material.opacity = .55 + Math.sin(t * 4) * .35;
    return true;
  },
  label(v, html, live){
    const el = document.createElement("div"); el.className = "pin" + (live ? " live" : ""); el.innerHTML = html;
    this.overlay.appendChild(el); this.labels.push({v, el});
  },
  box(parent, w, h, d, col, x, y, z, extra){
    const m = new this.T.Mesh(new this.T.BoxGeometry(w, h, d), typeof col === "object" ? col : this.mat(col, extra)); m.position.set(x, y, z); parent.add(m); return m;
  },
  roof(parent, w, h, d, col, y){
    const T = this.T;
    /* a gable roof: a triangle (front view) pushed out along the house's width */
    const sh = new T.Shape();
    sh.moveTo(-d / 2, 0); sh.lineTo(d / 2, 0); sh.lineTo(0, h); sh.closePath();
    const geo = new T.ExtrudeGeometry(sh, {depth:w, bevelEnabled:false});
    geo.translate(0, 0, -w / 2); geo.rotateY(Math.PI / 2);
    const m = new T.Mesh(geo, this.mat(col)); m.position.y = y; parent.add(m); return m;
  },
  /* lv is the building's real level; every era has its own looks (city3d-tiers.js). The classic models below are
     kept for decorations and are reused by some era looks: classic = draw classic model lv (1–3) as is. */
  building(g, type, win, dim, lv, spots, classic){
    const T = this.T, w = (x, y, z) => this.box(g, .1, .1, .02, win, x, y, z);
    const shade = dim ? {color:0xbbbbbb} : null;
    lv = lv || 1; spots = spots || [[0, 0]];
    const B = CITY_BUILDINGS[type], cyl = (r, h, col, x, y, z) => { const m = new T.Mesh(new T.CylinderGeometry(r, r, h, 10), this.mat(col)); m.position.set(x, y, z); g.add(m); return m; };
    const t = tierOf(lv), ti = (lv - 1) % 3;
    if (!classic && B && this.tierModel(g, type, t, ti, win)){
      /* drawn by its tier */
    } else if ((classic || (lv = ti + 1)) && B && (B.coins || B.know) && lv > 1){
      /* bigger shops: Lv2 stretches over two plots with a big sign; Lv3 is a two-tier store with a little plaza in each plot */
      const sub = new T.Group(); g.add(sub); this.building(sub, type, win, false, 1, null, true);
      const col = {cafe:0xE8945A, bakery:0xC9574A, books:0x6E8FB0, market:0x6DB4A0}[type] || 0xE8945A, h1 = {cafe:.45, bakery:.74, books:1.0, market:.4}[type] || .5;
      if (lv === 2){
        /* a wider shop front with a big sign and plants by the door */
        sub.scale.set(1.25, 1.35, 1.2);
        this.box(g, .82, .22, .05, col, 0, h1 * 1.35 + .14, .2); this.box(g, .56, .05, .06, 0xFFFFFF, 0, h1 * 1.35 + .14, .23);
        [-.42, .42].forEach(x => { this.box(g, .13, .12, .13, 0xB98B5E, x, .06, .42); this.tree(g, x, .1, .42, .45, 0x7FB860); });
      } else {
        /* a two-tier store: glass ground floor, the shop on top, a golden flag and a table outside */
        this.box(g, 1.0, .42, .82, 0xEDE6DA, 0, .21, 0); this.box(g, .86, .26, .02, win, 0, .22, .42); this.box(g, 1.06, .05, .88, col, 0, .44, 0);
        sub.position.y = .46; sub.scale.set(1.15, 1.3, 1.15);
        const top = .46 + h1 * 1.3; this.box(g, .02, .45, .02, 0x6b5240, .38, top + .22, -.2); this.box(g, .2, .13, .01, 0xF3CC58, .49, top + .38, -.2);
        this.box(g, .02, .26, .02, 0xFFFFFF, .5, .13, .6); const u = new T.Mesh(new T.ConeGeometry(.18, .1, 8), this.mat(col)); u.position.set(.5, .3, .6); g.add(u);
        this.box(g, .16, .02, .16, 0x9C7B5B, .5, .14, .6);
      }
    } else if (type === "hall"){
      if (lv === 1){
        /* a timber town hall with a flag */
        this.box(g, .9, .5, .7, 0xE9D3A8, 0, .25, 0); this.roof(g, 1.0, .34, .82, 0xC9574A, .5);
        this.box(g, .18, .26, .02, 0x8A6A4A, 0, .13, .36); w(-.28, .28, .36); w(.28, .28, .36);
        this.box(g, .5, .05, .2, 0xCDBB9A, 0, .025, .48);
        this.box(g, .025, .8, .025, 0x6b5240, .55, .4, .3); this.box(g, .24, .14, .01, 0xDB6A41, .68, .72, .3);
      } else if (lv === 2){
        /* a stone hall with columns and a clock tower */
        this.box(g, 1.1, .6, .8, 0xEDE7DC, 0, .3, -.05); this.box(g, 1.2, .06, .9, 0xD5CBB8, 0, .63, -.05); this.roof(g, 1.2, .3, .92, 0x8E6B5A, .66);
        [-.42, -.14, .14, .42].forEach(x => cyl(.05, .55, 0xF7F3EC, x, .3, .42));
        this.box(g, 1.0, .06, .25, 0xD5CBB8, 0, .03, .5);
        this.box(g, .34, 1.6, .34, 0xEDE7DC, 0, .8, -.32);
        const face = new T.Mesh(new T.CylinderGeometry(.11, .11, .02, 16), this.mat(0xFFFFFF)); face.rotation.x = Math.PI / 2; face.position.set(0, 1.35, -.14); g.add(face);
        this.box(g, .015, .08, .01, 0x333333, 0, 1.38, -.13); this.box(g, .06, .015, .01, 0x333333, .025, 1.35, -.13);
        const cap = new T.Mesh(new T.ConeGeometry(.28, .38, 4), this.mat(0x8E6B5A)); cap.rotation.y = Math.PI / 4; cap.position.set(0, 1.79, -.32); g.add(cap);
        w(-.35, .35, .36); w(.35, .35, .36);
      } else {
        /* a grand hall with a golden dome */
        this.box(g, 1.3, .7, 1.0, 0xF4EFE6, 0, .35, 0); this.box(g, 1.38, .07, 1.08, 0xD9CDB5, 0, .73, 0);
        [-.55, -.33, -.11, .11, .33, .55].forEach(x => cyl(.045, .66, 0xFFFFFF, x, .35, .56));
        this.box(g, 1.3, .05, .3, 0xD9CDB5, 0, .025, .62); this.box(g, 1.1, .05, .2, 0xE6DCCB, 0, .07, .6);
        cyl(.38, .32, 0xF4EFE6, 0, .92, 0);
        const dome = new T.Mesh(new T.SphereGeometry(.4, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), this.mat(0xE8C35A, {metalness:.35, roughness:.5})); dome.position.y = 1.08; g.add(dome);
        cyl(.02, .35, 0xE8C35A, 0, 1.62, 0); const ball = new T.Mesh(new T.IcosahedronGeometry(.06, 1), this.mat(0xF3CC58, {metalness:.4})); ball.position.y = 1.82; g.add(ball);
        [-.6, .6].forEach((x, i) => { this.box(g, .025, .9, .025, 0x6b5240, x, .45, .8); this.box(g, .22, .13, .01, i ? 0xDB6A41 : 0x3f6fa8, x + .12, .82, .8); });
        [-.45, .45].forEach(x => { w(x, .5, -.51); });
      }
    } else if (type === "farm"){
      /* a field of crop rows; Lv2 adds a fence and a shed, Lv3 a greenhouse */
      this.box(g, 1.2, .05, .95, 0x8A6447, 0, .025, .05);
      const rows = lv >= 3 ? [-.1, .12, .34] : [-.3, -.08, .14, .36];
      rows.forEach((z, j) => { this.box(g, .98, .05, .1, 0x6E4E36, lv >= 3 ? .12 : 0, .06, z);
        for (let x = -.4; x <= .41; x += .16){ if (lv >= 3 && x < -.2) continue; const p = new T.Mesh(new T.IcosahedronGeometry(.055, 0), this.mat(j % 2 ? 0x8CC46E : 0x6FAE57)); p.position.set(x + (lv >= 3 ? .12 : 0), .12, z); g.add(p); } });
      if (lv >= 2){
        [[-.6, 0, .02, .95], [.6, 0, .02, .95], [0, -.47, 1.2, .02]].forEach(([x, z, w2, d2]) => this.box(g, w2, .1, d2, 0xC9A26B, x, .1, z));
        this.box(g, .32, .28, .26, 0xC9574A, lv >= 3 ? -.42 : .42, .14, -.3);
        const sh = new T.Group(); sh.position.set(lv >= 3 ? -.42 : .42, 0, -.3); g.add(sh); this.roof(sh, .38, .16, .32, 0x8A5A3A, .28);
      }
      if (lv >= 3){
        /* a little glass greenhouse */
        const gh = new T.Mesh(new T.BoxGeometry(.42, .3, .34), this.mat(0xCFEFF5, {transparent:true, opacity:.55})); gh.position.set(-.38, .2, .22); g.add(gh);
        const ghr = new T.Mesh(new T.CylinderGeometry(.17, .17, .42, 10, 1, false, 0, Math.PI), this.mat(0xCFEFF5, {transparent:true, opacity:.55})); ghr.rotation.z = Math.PI / 2; ghr.rotation.y = Math.PI / 2; ghr.position.set(-.38, .35, .22); g.add(ghr);
        [[-.58, .06], [-.18, .06], [-.58, .38], [-.18, .38]].forEach(([x, z]) => this.box(g, .02, .32, .02, 0xFFFFFF, x, .18, z));
        for (let x = -.52; x <= -.24; x += .1){ const p = new T.Mesh(new T.IcosahedronGeometry(.045, 0), this.mat(0xE57373)); p.position.set(x, .12, .22); g.add(p); }
      }
    } else if (type === "landmark"){
      /* a tall white spire with a glowing crystal on top */
      cyl(.45, .12, 0xE6DCCB, 0, .06, 0); cyl(.32, .1, 0xF4EFE6, 0, .17, 0);
      const sp = new T.Mesh(new T.CylinderGeometry(.06, .2, 1.9, 6), this.mat(0xF7F5F0)); sp.position.y = 1.15; g.add(sp);
      [.6, 1.1, 1.6].forEach(y => cyl(.16 - y * .05, .05, 0xE8C35A, 0, y, 0));
      const cr = new T.Mesh(new T.OctahedronGeometry(.17, 0), this.mat(0x9FE3FF, {emissive:0x58C6FF, emissiveIntensity:.6})); cr.position.y = 2.32; g.add(cr);
    } else if (type === "market"){
      [-.28, .28].forEach((x, i) => {
        this.box(g, .42, .3, .36, 0xF6E9D6, x, .15, .02);
        const a = this.box(g, .48, .03, .3, i ? 0xE8945A : 0x6DB4A0, x, .36, .26); a.rotation.x = .4;
        this.box(g, .03, .34, .03, 0xffffff, x - .22, .17, .38); this.box(g, .03, .34, .03, 0xffffff, x + .22, .17, .38);
        this.box(g, .12, .08, .1, 0xC9A26B, x - .08, .04, .44); this.box(g, .12, .08, .1, i ? 0xE57373 : 0xF3CC58, x + .08, .04, .44);
      });
      this.tree(g, 0, 0, -.45, .7);
    } else if (type === "house" && lv === 2){
      /* a two-storey house with a balcony and flower boxes */
      this.box(g, .7, .74, .56, 0xF8F3EA, 0, .37, 0); this.box(g, .74, .04, .6, 0xE9DFCF, 0, .38, 0);
      this.roof(g, .8, .32, .68, 0xDB6A41, .74);
      w(-.18, .22, .29); w(.18, .58, .29); w(-.18, .58, .29);
      this.box(g, .13, .22, .02, 0x8A6A4A, .18, .11, .29);
      this.box(g, .34, .03, .14, 0xE9DFCF, -.1, .44, .35); this.box(g, .34, .1, .01, 0xFFFFFF, -.1, .5, .42);
      this.box(g, .2, .05, .05, 0x8CC46E, -.18, .16, .31); this.box(g, .2, .05, .05, 0xF48FB1, -.18, .52, .31);
      this.box(g, .09, .22, .09, 0xC8B49A, .2, .98, -.1);
      this.tree(g, -.5, 0, -.3, .75);
    } else if (type === "house" && lv >= 3){
      /* a four-storey apartment with balconies and a roof garden */
      this.box(g, .82, 1.32, .7, 0xF3E9DA, 0, .66, 0); this.box(g, .88, .06, .76, 0xB9A58A, 0, 1.35, 0);
      this.box(g, .66, .05, .54, 0x8CC46E, 0, 1.4, 0); this.tree(g, .18, 1.4, .1, .45); this.tree(g, -.2, 1.4, -.12, .4, 0x7FB860);
      for (let f = 0; f < 4; f++){
        const y = .2 + f * .3;
        [-.25, 0, .25].forEach(x => { if (!(f === 0 && x === 0)) w(x, y, .36); });
        [-.2, .2].forEach(z => { this.box(g, .02, .09, .09, win, .42, y, z); this.box(g, .02, .09, .09, win, -.42, y, z); });
        if (f) this.box(g, .62, .03, .12, 0xDB6A41, 0, y - .09, .41);
      }
      this.box(g, .16, .22, .02, 0x8A6A4A, 0, .11, .36); this.box(g, .3, .03, .14, 0x6E8FB0, 0, .26, .42);
      this.tree(g, -.55, 0, .35, .6, 0x7FB860);
    } else if (type === "house"){
      this.box(g, .62, .44, .5, 0xF8F3EA, 0, .22, 0); this.roof(g, .7, .3, .62, 0xDB6A41, .44);
      this.box(g, .12, .2, .02, 0x8A6A4A, 0, .1, .26); w(-.18, .28, .26); w(.18, .28, .26);
      this.box(g, .08, .18, .08, 0xC8B49A, .18, .62, -.08);
      this.tree(g, -.5, 0, -.35, .7);
    } else if (type === "cafe"){
      this.box(g, .7, .4, .5, 0xF3E3CB, 0, .2, -.05); this.box(g, .74, .05, .56, 0xE7D2B3, 0, .42, -.05);
      const aw = this.box(g, .7, .03, .22, 0xE8945A, 0, .36, .3); aw.rotation.x = .35;
      w(-.2, .24, .21); w(.2, .24, .21);
      [[-.3, .55], [.3, .55]].forEach(([x, z]) => { this.box(g, .02, .26, .02, 0xffffff, x, .13, z); const u = new T.Mesh(new T.ConeGeometry(.17, .1, 8), this.mat(0xF6F1E7)); u.position.set(x, .3, z); g.add(u); this.box(g, .14, .02, .14, 0x9C7B5B, x, .14, z); });
    } else if (type === "bakery"){
      this.box(g, .6, .46, .52, 0xF9DCD6, 0, .23, 0); this.roof(g, .68, .28, .64, 0xC9574A, .46);
      const sign = new T.Mesh(new T.CylinderGeometry(.09, .09, .02, 14), this.mat(0xFFFFFF)); sign.rotation.x = Math.PI / 2; sign.position.set(0, .34, .27); g.add(sign);
      this.box(g, .12, .2, .02, 0x9C5B4A, -.15, .1, .27); w(.17, .2, .27);
    } else if (type === "books"){
      this.box(g, .5, .95, .5, 0xDDE7EF, 0, .475, 0); this.box(g, .56, .06, .56, 0x6E8FB0, 0, .97, 0);
      [.3, .52, .74].forEach(y => { w(-.12, y, .26); w(.12, y, .26); });
      this.box(g, .14, .18, .02, 0x6E8FB0, 0, .09, .26);
    } else if (type === "clinic"){
      this.box(g, .72, .5, .52, 0xFFFFFF, 0, .25, 0); this.box(g, .76, .06, .56, 0x48A88B, 0, .53, 0);
      this.box(g, .06, .2, .02, 0x48A88B, 0, .34, .27); this.box(g, .2, .06, .02, 0x48A88B, 0, .34, .27);
      w(-.24, .3, .27); w(.24, .3, .27); this.box(g, .14, .18, .02, 0x9BD3C0, 0, .09, .27);
    } else if (type === "park"){
      const bench = (x, z) => { this.box(g, .3, .04, .1, 0xA0784F, x, .12, z); this.box(g, .03, .1, .03, 0x6b5240, x - .12, .05, z); this.box(g, .03, .1, .03, 0x6b5240, x + .12, .05, z); };
      const flowers = (x, z, col) => { this.box(g, .22, .05, .14, 0x8A6A4A, x, .03, z); [-.06, 0, .06].forEach(dx => { const f = new T.Mesh(new T.IcosahedronGeometry(.035, 0), this.mat(col)); f.position.set(x + dx, .09, z); g.add(f); }); };
      if (lv === 1){
        /* a lawn with trees and a bench */
        this.tree(g, -.3, 0, -.2, 1.1); this.tree(g, .32, 0, -.3, .9); this.tree(g, .05, 0, .35, .8, 0x7FB860);
        bench(.3, .3);
      } else if (lv === 2){
        /* paths crossing at a little fountain, with flower beds */
        this.box(g, 1.3, .015, .2, 0xE9DCC3, 0, .02, 0); this.box(g, .2, .015, 1.3, 0xE9DCC3, 0, .02, 0);
        const basin = new T.Mesh(new T.CylinderGeometry(.26, .28, .1, 14), this.mat(0xD5DBDF)); basin.position.y = .05; g.add(basin);
        const water = new T.Mesh(new T.CylinderGeometry(.22, .22, .02, 14), this.mat(0x7EC8E3)); water.position.y = .1; g.add(water);
        const spout = new T.Mesh(new T.CylinderGeometry(.03, .05, .22, 8), this.mat(0xD5DBDF)); spout.position.y = .2; g.add(spout);
        const drop = new T.Mesh(new T.SphereGeometry(.07, 10, 8), this.mat(0xA8E0F0)); drop.position.y = .34; g.add(drop);
        flowers(-.42, -.4, 0xF48FB1); flowers(.42, -.4, 0xF3CC58); flowers(-.42, .42, 0xE57373); flowers(.42, .42, 0xBA68C8);
        this.tree(g, -.55, 0, 0, .8); this.tree(g, .55, 0, 0, .75, 0x7FB860); bench(0, -.5);
      } else {
        /* a garden with a pond, a little bridge, a pavilion and lamps */
        const pond = new T.Mesh(new T.CylinderGeometry(.34, .34, .02, 18), this.mat(0x6FBEDC)); pond.scale.z = .7; pond.position.set(-.22, .03, .25); g.add(pond);
        this.box(g, .4, .03, .12, 0xB98B5E, -.22, .08, .25); this.box(g, .03, .06, .14, 0x8A6A4A, -.4, .06, .25); this.box(g, .03, .06, .14, 0x8A6A4A, -.04, .06, .25);
        [[-.3, .2, 0xF48FB1], [-.12, .32, 0xFFFFFF]].forEach(([x, z, col]) => { const l = new T.Mesh(new T.CylinderGeometry(.05, .05, .01, 8), this.mat(0x8CC46E)); l.position.set(x, .045, z); g.add(l); const f = new T.Mesh(new T.IcosahedronGeometry(.025, 0), this.mat(col)); f.position.set(x, .06, z); g.add(f); });
        /* pavilion */
        [[-.15, -.15], [.15, -.15], [-.15, .15], [.15, .15]].forEach(([x, z]) => this.box(g, .04, .36, .04, 0xFFFFFF, .3 + x, .18, -.25 + z));
        this.box(g, .38, .03, .38, 0xD8CCB6, .3, .015, -.25);
        const pg = new T.Group(); pg.position.set(.3, 0, -.25); g.add(pg); this.roof(pg, .38, .22, .38, 0x6E8FB0, .36);
        /* lamps */
        [[-.62, -.3], [.62, .35]].forEach(([x, z]) => { this.box(g, .03, .42, .03, 0x3B4A59, x, .21, z); const b = new T.Mesh(new T.SphereGeometry(.055, 10, 8), this.mat(0xFFE9A8, {emissive:0xFFD36B, emissiveIntensity:.6})); b.position.set(x, .45, z); g.add(b); });
        flowers(.35, .4, 0xF3CC58); this.tree(g, -.5, 0, -.42, .9); this.tree(g, .62, 0, -.62, .7, 0x7FB860);
      }
    } else if (type === "statue"){
      this.box(g, .34, .2, .34, 0xD5DBDF, 0, .1, 0); const b = new T.Mesh(new T.CapsuleGeometry(.08, .2, 3, 6), this.mat(0xB8C2C9)); b.position.set(0, .38, 0); g.add(b);
      const h = new T.Mesh(new T.IcosahedronGeometry(.08, 0), this.mat(0xB8C2C9)); h.position.set(0, .58, 0); g.add(h);
    } else if (type === "fountain"){
      const basin = new T.Mesh(new T.CylinderGeometry(.42, .45, .14, 12), this.mat(0xD5DBDF)); basin.position.y = .07; g.add(basin);
      const water = new T.Mesh(new T.CylinderGeometry(.36, .36, .02, 12), this.mat(0x8ED1E6)); water.position.y = .14; g.add(water);
      const col = new T.Mesh(new T.CylinderGeometry(.05, .07, .35, 8), this.mat(0xD5DBDF)); col.position.y = .3; g.add(col);
      const top = new T.Mesh(new T.IcosahedronGeometry(.1, 0), this.mat(0xA8E0EE)); top.position.y = .5; g.add(top);
    } else if (type === "sakura"){
      this.tree(g, 0, 0, 0, 1.6, 0xF6B8CF); this.tree(g, .35, 0, .25, .8, 0xF9CADB);
    } else if (type === "lighthouse"){
      const t1 = new T.Mesh(new T.CylinderGeometry(.13, .2, 1.2, 10), this.mat(0xFFFFFF)); t1.position.y = .6; g.add(t1);
      [.25, .65].forEach(y => { const s = new T.Mesh(new T.CylinderGeometry(.18 - y * .04, .19 - y * .04, .16, 10), this.mat(0xDB6A41)); s.position.y = y; g.add(s); });
      this.box(g, .24, .16, .24, win, 0, 1.28, 0); const cap = new T.Mesh(new T.ConeGeometry(.2, .2, 8), this.mat(0xDB6A41)); cap.position.y = 1.46; g.add(cap);
    }
    if (classic) return;
    if (shade) g.traverse(m => { if (m.isMesh && m.material !== win){ m.material = m.material.clone(); m.material.color.lerp(new T.Color(0x9a9a9a), .35); } });
  },
  road(g, c, q, r, x, z, pos){
    /* a stone path that joins up with every road next to it */
    const T = this.T, col = this.mat(0xB7AA96), edge = this.mat(0xD8CCB6);
    const hub = new T.Mesh(new T.CylinderGeometry(.3, .3, .03, 6), col); hub.position.set(x, .065, z); hub.receiveShadow = true; g.add(hub);
    let links = 0;
    CITY_DIRS.forEach(([a, b]) => {
      const n = c.tiles[(q + a) + "," + (r + b)]; if (!n || n.b !== "road") return;
      links++;
      const [nx, nz] = pos(q + a, r + b), dx = (nx - x) / 2, dz = (nz - z) / 2;
      const seg = new T.Mesh(new T.BoxGeometry(.9, .03, .5), col); seg.position.set(x + dx / 2, .065, z + dz / 2); seg.rotation.y = Math.atan2(-dz, dx); seg.receiveShadow = true; g.add(seg);
      const line = new T.Mesh(new T.BoxGeometry(.5, .01, .05), edge); line.position.set(x + dx / 2, .085, z + dz / 2); line.rotation.y = seg.rotation.y; g.add(line);
    });
    /* a narrower path from the road up to every door that faces it (and to the city center) */
    CITY_DIRS.forEach(([a, b]) => {
      const nk = (q + a) + "," + (r + b), n = c.tiles[nk]; if (!n || !n.b || n.b === "road") return;
      if (n.b !== "hall" && doorKey(c, nk) !== q + "," + r) return;
      links++;
      const [nx, nz] = pos(q + a, r + b), dx = (nx - x) / 2, dz = (nz - z) / 2;
      const seg = new T.Mesh(new T.BoxGeometry(1.25, .03, .26), col); seg.position.set(x + dx * .62, .064, z + dz * .62); seg.rotation.y = Math.atan2(-dz, dx); seg.receiveShadow = true; g.add(seg);
    });
    if (!links){ const pl = new T.Mesh(new T.CylinderGeometry(.55, .55, .03, 6), col); pl.position.set(x, .06, z); g.add(pl); }
    [[.62, .3], [-.6, -.34]].forEach(([ox, oz]) => { const s = new T.Mesh(new T.IcosahedronGeometry(.07, 0), this.mat(0xC9BBA3)); s.position.set(x + ox, .09, z + oz); g.add(s); });
  },
  /* ---------- people walking around town ---------- */
  walkPlan(w){
    const c = city(), roads = cityRoads(c), L = cityLinked(c), posK = k => { const [q, r] = k.split(",").map(Number); return [Math.sqrt(3) * (q + r / 2), 1.5 * r]; };
    const nodes = new Set(roads); nodes.add("0,0");
    const entry = k => k === "0,0" ? "0,0" : doorKey(c, k);
    const spots = [...L].filter(k => nodes.has(entry(k)));
    if (!spots.length) return;
    const from = w.at, to = spots[Math.floor(Math.random() * spots.length)];
    /* shortest way along the roads */
    const a = entry(from), b = entry(to), prev = {[a]:null}, queue = [a];
    while (queue.length){ const k = queue.shift(); if (k === b) break; cityNear(k).forEach(n => { if (nodes.has(n) && !(n in prev)){ prev[n] = k; queue.push(n); } }); }
    if (!(b in prev)) return;
    const path = []; for (let k = b; k; k = prev[k]) path.unshift(k);
    const P = (k, t) => { const [x, z] = posK(k); return {x, z, s:t}; };
    const inside = k => c.tiles[k] && c.tiles[k].b === "park" ? 1 : 0;
    const edge = (bk, nk, f, s) => { const [x1, z1] = posK(bk), [x2, z2] = posK(nk); return {x:x1 + (x2 - x1) * f, z:z1 + (z2 - z1) * f, s}; };
    const q = [];
    if (from !== "0,0") q.push(edge(from, a, .15, inside(from)), edge(from, a, .55, 1));
    path.forEach(k => { const p = P(k, 1); if (k !== "0,0"){ p.x += w.lane; p.z += w.lane; } q.push(p); });
    if (to !== "0,0"){ q.push(edge(to, b, .55, 1)); q.push(edge(to, b, inside(to) ? .1 : .15, inside(to))); }
    else q.push(Object.assign(P("0,0", 0), {z:posK("0,0")[1] + .1}));
    w.q = q; w.at = to;
  },
  walkStep(dt){
    (this.walkers || []).forEach(w => {
      if (!w.q.length){
        w.wait -= dt; if (w.wait > 0) return;
        if (!w.started){ w.started = true; const [q, r] = w.at.split(",").map(Number); w.g.position.set(Math.sqrt(3) * (q + r / 2), .06, 1.5 * r); }
        this.walkPlan(w); w.wait = 2 + Math.random() * 6; if (!w.q.length) return;
        w.g.visible = true;
      }
      const t = w.q[0], g = w.g, dx = t.x - g.position.x, dz = t.z - g.position.z, d = Math.hypot(dx, dz), step = .55 * dt;
      if (d > .001) g.rotation.y = Math.atan2(dx, dz);
      if (!w.d0) w.d0 = d || 1;
      const k = d <= step ? 1 : step / d;
      g.position.x += dx * k; g.position.z += dz * k; g.position.y = .06 + Math.abs(Math.sin(performance.now() / 120)) * .02;
      w.s += (t.s - w.s) * Math.min(1, k * 1.2 + (d <= step ? 1 : 0)); g.scale.setScalar(Math.max(.001, w.s)); g.visible = w.s > .02;
      if (d <= step){ g.position.set(t.x, .06, t.z); w.s = t.s; g.scale.setScalar(Math.max(.001, t.s)); g.visible = t.s > .02; w.q.shift(); w.d0 = 0; }
    });
  },
  walkLoop(){
    if (this.walking) return;
    this.walking = true; let last = performance.now(), acc = 0;
    const tick = now => {
      if (!this.r || !this.host || !document.body.contains(this.host) || !(this.walkers || []).length){ this.walking = false; return; }
      const dt = Math.min(.1, (now - last) / 1000); last = now; acc += dt;
      if (!document.hidden && acc >= 1 / 30){ this.walkStep(acc); acc = 0; this.draw(); }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  },
  person(g, x, z, color, s){
    const T = this.T;
    const b = new T.Mesh(new T.CylinderGeometry(.06 * s, .08 * s, .2 * s, 8), this.mat(new T.Color(color).getHex())); b.position.set(x, .15 * s, z); b.castShadow = true; g.add(b);
    const h = new T.Mesh(new T.SphereGeometry(.07 * s, 10, 8), this.mat(0xF6D2B4, {flatShading:false})); h.position.set(x, .32 * s, z); h.castShadow = true; g.add(h);
  },
  avatar(g, x, z, av){
    const T = this.T, s = 2.1;
    const col = {tee:0x64B5F6, hoodie:0x9575CD, raincoat:0xFFD54F, suit:0x37474F, astro:0xECEFF1}[av.outfit] || 0x64B5F6;
    this.person(g, x, z, col, s);
    const hy = .32 * s, hr = .07 * s;
    const hair = new T.Mesh(new T.SphereGeometry(hr * 1.03, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2.2), this.mat(0x5b4a3a, {flatShading:false})); hair.position.set(x, hy, z - .01); g.add(hair);
    if (av.hat === "cap"){ const c = new T.Mesh(new T.SphereGeometry(hr * 1.1, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), this.mat(0xE57373)); c.position.set(x, hy + .02, z); g.add(c); this.box(g, .12, .015, .1, 0xE57373, x, hy + .03, z + .12); }
    if (av.hat === "beanie"){ const c = new T.Mesh(new T.SphereGeometry(hr * 1.12, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), this.mat(0x4DB6AC)); c.position.set(x, hy + .02, z); g.add(c); const p = new T.Mesh(new T.SphereGeometry(.03, 6, 6), this.mat(0x80CBC4)); p.position.set(x, hy + .19, z); g.add(p); }
    if (av.hat === "straw"){ const c = new T.Mesh(new T.CylinderGeometry(.22, .22, .02, 14), this.mat(0xF3CC58)); c.position.set(x, hy + .07, z); g.add(c); const t = new T.Mesh(new T.CylinderGeometry(.1, .12, .1, 12), this.mat(0xF3CC58)); t.position.set(x, hy + .12, z); g.add(t); }
    if (av.hat === "crown"){ const c = new T.Mesh(new T.CylinderGeometry(.11, .11, .08, 6, 1, true), this.mat(0xF3CC58, {side:T.DoubleSide, metalness:.3})); c.position.set(x, hy + .16, z); g.add(c); }
  },
  /* ---------- camera, touch and drawing ---------- */
  resize(){
    if (!this.host) return;
    /* fill the whole stage; fall back to a fixed shape if it has no height yet */
    const w = this.host.clientWidth || 320, ch = this.host.clientHeight, h = ch > 120 ? ch : Math.round(Math.min(380, Math.max(260, w * .85)));
    this.r.setSize(w, h); this.cam.aspect = w / h; this.cam.updateProjectionMatrix(); this.w = w; this.h = h;
  },
  place(){
    const asp = (this.w || 1) / (this.h || 1), d = this.dist * (!this.focus && asp < .95 ? Math.min(1.7, .95 / asp) : 1), el = this.el, az = this.az, f = this.focus || [(this.pan || [0, 0])[0], 0, -.9 + (this.pan || [0, 0])[1]];   /* a tall screen needs to stand further back to fit the island's width */   /* aim a little behind the center so the island sits below the request card */
    this.cam.position.set(f[0] + d * Math.cos(el) * Math.sin(az), f[1] + d * Math.sin(el), f[2] + d * Math.cos(el) * Math.cos(az));
    this.cam.lookAt(f[0], f[1], f[2]);
  },
  /* slide the view across the ground, as if dragging the map; kept within the island */
  panBy(dx, dy){
    const k = this.dist * .0024 * (this.w ? 340 / this.w : 1), sa = Math.sin(this.az), ca = Math.cos(this.az);
    const p = this.pan || [0, 0];
    p[0] += -ca * dx * k - sa * dy * k; p[1] += sa * dx * k - ca * dy * k;
    const lim = cityRadius(city()) * 2.2, len = Math.hypot(p[0], p[1]); if (len > lim){ p[0] *= lim / len; p[1] *= lim / len; }
    this.pan = p;
  },
  /* chatting with Lisa: swing the camera in close to her; afterwards go back to the whole island */
  focusLisa(on){
    if (on){ if (!this.saved) this.saved = {dist:this.dist, el:this.el, az:this.az}; this.focus = [-.45, .42, .86]; this.dist = 3.4; this.el = .42; this.az = .35; }
    else if (this.saved){ Object.assign(this, this.saved); this.saved = null; this.focus = null; }
    else this.focus = null;
    this.draw();
  },
  draw(){
    if (this.frame) return;
    this.frame = requestAnimationFrame(now => {
      this.frame = 0;
      if (!this.r || !this.host || !document.body.contains(this.host)) return;
      let more = false;
      this.grow = this.grow.filter(a => { const k = Math.min(1, (now - a.t0) / 450), e = 1 - Math.pow(1 - k, 3) * (1 - 1.7 * k * (1 - k)); a.g.scale.setScalar(Math.max(.01, e)); if (k < 1) more = true; return k < 1; });
      if (this.animSel(now)) more = true;
      this.place(); this.r.render(this.scene, this.cam);
      const v = new this.T.Vector3();
      this.labels.forEach(l => {
        v.copy(l.v).project(this.cam);
        const hide = v.z > 1 || Math.abs(v.x) > 1.1 || Math.abs(v.y) > 1.1;
        l.el.style.display = hide ? "none" : "";
        l.el.style.transform = "translate(" + ((v.x + 1) / 2 * this.w).toFixed(1) + "px," + ((1 - v.y) / 2 * this.h).toFixed(1) + "px) translate(-50%,-100%)";
      });
      if (more) this.draw();
    });
  },
  controls(cv){
    const pts = new Map(); let moved = 0, t0 = 0, pinch = 0;
    cv.addEventListener("pointerdown", e => { cv.setPointerCapture(e.pointerId); pts.set(e.pointerId, {x:e.clientX, y:e.clientY}); if (pts.size === 1){ moved = 0; t0 = performance.now(); } pinch = 0; });
    cv.addEventListener("pointermove", e => {
      const p = pts.get(e.pointerId); if (!p) return;
      const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY;
      if (pts.size === 1 && !(e.buttons & 2) && !e.shiftKey){
        moved += Math.abs(dx) + Math.abs(dy);
        this.az -= dx * .009; this.el = Math.min(1.3, Math.max(.55, this.el + dy * .006));
      } else if (pts.size === 2){
        const [a, b] = [...pts.values()], d = Math.hypot(a.x - b.x, a.y - b.y);
        if (pinch) this.dist = Math.min(26, Math.max(5, this.dist * pinch / d));
        pinch = d; moved = 99;
        this.panBy(dx / 2, dy / 2);          /* both fingers moving together slide the island */
      } else { moved += Math.abs(dx) + Math.abs(dy); this.panBy(dx, dy); }   /* mouse: right-drag or shift-drag */
      this.draw();
    });
    const up = e => {
      if (!pts.has(e.pointerId)) return;
      pts.delete(e.pointerId);
      if (!pts.size && moved < 8 && performance.now() - t0 < 400) this.tap(e);
    };
    cv.addEventListener("pointerup", up); cv.addEventListener("pointercancel", e => { pts.delete(e.pointerId); });
    cv.addEventListener("contextmenu", e => e.preventDefault());
    /* on phones a tap is followed by a "click" that would land on the sheet's backdrop and close it right away */
    cv.addEventListener("touchend", e => { if (e.cancelable) e.preventDefault(); }, {passive:false});
    cv.addEventListener("wheel", e => { e.preventDefault(); this.dist = Math.min(26, Math.max(5, this.dist * (e.deltaY > 0 ? 1.08 : .93))); this.draw(); }, {passive:false});
  },
  /* the island tile under a screen point, or "" */
  keyAt(x, y){
    if (!this.r || !this.cam) return "";
    const T = this.T, rect = this.r.domElement.getBoundingClientRect();
    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) return "";
    const v = new T.Vector2((x - rect.left) / rect.width * 2 - 1, -((y - rect.top) / rect.height) * 2 + 1);
    const ray = new T.Raycaster(); ray.setFromCamera(v, this.cam);
    const hit = ray.intersectObjects(this.pick, false)[0];
    return (hit && hit.object.userData.key) || "";
  },
  tap(e){
    if (S.cityChat) return;
    const k = this.keyAt(e.clientX, e.clientY); if (!k) return;
    if (S.cityEdit && S.cityEdit.sel) cityEditApply(k);
    else ACT["city-tile"]({dataset:{k}});
  }
};
