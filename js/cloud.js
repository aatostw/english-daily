/* =========================================================
   Cloud account (optional): log in with an email and password made by the admin,
   and this phone's progress is kept in sync with the server. Without logging in,
   everything stays on this phone as before.
   ========================================================= */
const CLOUD_URL = "https://eel-api.natursai-tw.workers.dev";
const CLOUD_SKIP = new Set(["t", "models", "lookup", "pocketSpeed"]);
const Cloud = {
  cfg:(() => { try { return JSON.parse(localStorage.getItem("eel-cloud") || "null"); } catch (e) { return null; } })(),
  busy:false, msg:"", err:"", pushing:false, again:false, lastPull:0, timer:0,
  url(){ return String((this.cfg && this.cfg.url) || CLOUD_URL).replace(/\/+$/, ""); },
  on(){ return !!(this.cfg && this.cfg.token) && S.canStore; },
  voiceOk(){ return this.on() && !!this.cfg.voice; },
  /* the admin can switch the computer voice on or off at any time; check again now and then */
  async refreshMe(){
    if (!this.on()) return;
    try { const j = await this.api("/me"); const v = !!j.user.voice; if (v !== !!this.cfg.voice || j.user.name !== this.cfg.name){ this.cfg.voice = v; this.cfg.name = j.user.name || ""; this.save(); render(); } } catch (e) {}
  },
  now(){ return Date.now() - (window.__timeOffset || 0); },
  save(){ try { this.cfg ? localStorage.setItem("eel-cloud", JSON.stringify(this.cfg)) : localStorage.removeItem("eel-cloud"); } catch (e) {} },
  queue(){ try { return JSON.parse(localStorage.getItem("eel-cloud-q") || "{}") || {}; } catch (e) { return {}; } },
  setQueue(q){ try { localStorage.setItem("eel-cloud-q", JSON.stringify(q)); } catch (e) {} },
  pending(){ return Object.keys(this.queue()).length; },
  /* every saved change calls this; the upload waits a moment so a burst of saves goes up together */
  mark(id){
    if (!this.on() || this.applying || CLOUD_SKIP.has(id)) return;
    const q = this.queue(); q[id] = this.now(); this.setQueue(q);
    clearTimeout(this.timer); this.timer = setTimeout(() => this.push(), 2000);
  },
  localIds(){
    const out = [];
    try { for (let i = 0; i < localStorage.length; i++){ const k = localStorage.key(i); if (k && k.startsWith(LS) && !CLOUD_SKIP.has(k.slice(LS.length))) out.push(k.slice(LS.length)); } } catch (e) {}
    return out;
  },
  /* the uploaded voice sample stays on the phone: it is large and the server has no room for it */
  strip(id, d){
    if (id === "profile" && d && d.settings && d.settings.pocketVoice && d.settings.pocketVoice.wavData){
      d = clone(d); d.settings.pocketVoice = Object.assign({}, d.settings.pocketVoice, {wavData:""});
    }
    return d;
  },
  async api(path, opts){
    opts = opts || {};
    const h = {"Content-Type":"application/json"};
    if (this.cfg && this.cfg.token) h.Authorization = "Bearer " + this.cfg.token;
    if (opts.admin){ h["X-Admin-Key"] = opts.admin; h["X-Admin-User"] = opts.adminUser != null ? opts.adminUser : admUser(); }
    let r;
    try { r = await fetch(this.url() + path, {method:opts.method || (opts.body ? "POST" : "GET"), headers:h, body:opts.body ? JSON.stringify(opts.body) : undefined}); }
    catch (e) { throw new Error("連不上伺服器，請確認網路。"); }
    let j = {}; try { j = await r.json(); } catch (e) {}
    if (r.status === 401 && j.relogin && this.cfg && this.cfg.token && !opts.admin){
      this.cfg.token = ""; this.save(); this.err = "登入已過期，請重新登入。"; render();
    }
    if (!r.ok || !j.ok) throw new Error(j.error || ("伺服器回應 " + r.status));
    return j;
  },
  async push(){
    if (!this.on()) return;
    if (this.pushing){ this.again = true; return; }
    this.pushing = true;
    try {
      let q = this.queue();
      const ids = Object.keys(q);
      for (let i = 0; i < ids.length; i += 100){
        const part = ids.slice(i, i + 100), items = [];
        part.forEach(id => {
          let v = null; try { v = localStorage.getItem(LS + id); } catch (e) {}
          if (v == null) items.push({id, del:true});
          else { try { items.push({id, data:this.strip(id, JSON.parse(v))}); } catch (e) {} }
        });
        await this.api("/sync", {body:{items}});
        /* only clear what didn't change again while it was uploading */
        const now = this.queue(); part.forEach(id => { if (now[id] === q[id]) delete now[id]; }); this.setQueue(now);
      }
      this.cfg.lastSync = this.now(); this.save(); this.err = "";
    } catch (e) { this.err = e.message; }
    this.pushing = false;
    if (this.again){ this.again = false; this.push(); }
    if (S.view === "prefs" && S.prefPage === "account") render();
  },
  async fetchAll(since){
    const out = [];
    let max = since || 0;
    for (let guard = 0; guard < 200; guard++){
      const j = await this.api("/sync?since=" + max);
      j.items.forEach(x => out.push(x));
      if (!j.items.length) break;
      const last = j.items[j.items.length - 1].at;
      max = j.more ? last - 1 : last;
      if (!j.more) break;
    }
    return {items:out, since:out.reduce((m, x) => Math.max(m, x.at), since || 0)};
  },
  /* write what came from the server into this phone; true when anything changed */
  apply(items, skip){
    let changed = false;
    this.applying = true;
    items.forEach(x => {
      if (CLOUD_SKIP.has(x.id) || (skip && skip[x.id])) return;
      let cur = null; try { cur = localStorage.getItem(LS + x.id); } catch (e) {}
      if (x.del){ if (cur != null){ Store.mem.delete(x.id); try { localStorage.removeItem(LS + x.id); } catch (e) {} changed = true; } return; }
      let data = x.data;
      if (x.id === "profile" && cur){
        try { const lp = JSON.parse(cur), w = lp.settings && lp.settings.pocketVoice && lp.settings.pocketVoice.wavData;
          if (w && data && data.settings && data.settings.pocketVoice) data.settings.pocketVoice.wavData = w; } catch (e) {}
      }
      const txt = JSON.stringify(data);
      if (txt === cur) return;
      Store.mem.delete(x.id);
      try { localStorage.setItem(LS + x.id, txt); changed = true; } catch (e) { this.err = "這支手機的儲存空間不夠，部分進度沒有下載。"; }
    });
    this.applying = false;
    return changed;
  },
  async pull(){
    if (!this.on() || this.pulling) return false;
    this.pulling = true;
    try {
      const r = await this.fetchAll(this.cfg.since || 0);
      const changed = this.apply(r.items, this.queue());
      this.cfg.since = r.since; this.cfg.lastSync = this.now(); this.save(); this.lastPull = Date.now(); this.err = "";
      return changed;
    } catch (e) { this.err = e.message; return false; }
    finally { this.pulling = false; }
  },
  async login(email, password){
    const url = this.url();
    const j = await this.api("/login", {body:{email, password}});
    this.cfg = {url, token:j.token, email:j.user.email, name:j.user.name || "", voice:!!j.user.voice, since:0};
    try {
      const r = await this.fetchAll(0);
      const serverHas = r.items.some(x => !x.del);
      let localHas = false; try { localHas = !!localStorage.getItem(LS + "profile"); } catch (e) {}
      let mode = !serverHas ? "upload" : !localHas ? "download" : "";
      if (!mode){
        const c = await choiceBox("這支手機和雲端都有進度", "要留下哪一份？另一份會被取代。", ["用雲端的進度", "用這支手機的進度"]);
        if (c < 0){ await this.api("/logout", {body:{}}).catch(() => {}); this.cfg = null; this.save(); return false; }
        mode = c === 0 ? "download" : "upload";
      }
      this.save();
      if (mode === "download"){
        this.applying = true;
        const keep = new Set(r.items.filter(x => !x.del).map(x => x.id));
        this.localIds().forEach(id => { if (!keep.has(id)){ Store.mem.delete(id); try { localStorage.removeItem(LS + id); } catch (e) {} } });
        this.applying = false;
        this.setQueue({});
        this.apply(r.items, null);
      } else {
        const q = {}, t = this.now(), mine = new Set(this.localIds());
        mine.forEach(id => q[id] = t);
        r.items.forEach(x => { if (!x.del && !mine.has(x.id)) q[x.id] = t; });
        this.setQueue(q);
      }
      this.cfg.since = r.since; this.cfg.lastSync = this.now(); this.save();
      if (mode === "upload") await this.push();
      await reloadFromStore();
      return true;
    } catch (e) { this.cfg = null; this.save(); throw e; }
  },
  async logout(wipe){
    await this.push().catch(() => {});
    if (this.cfg && this.cfg.token) await this.api("/logout", {body:{}}).catch(() => {});
    try { if (this.cfg && this.cfg.email) localStorage.setItem("eel-last-email", this.cfg.email); } catch (e) {}
    admForget();
    this.cfg = null; this.save(); this.setQueue({}); this.err = "";
    if (wipe){
      this.localIds().forEach(id => { Store.mem.delete(id); try { localStorage.removeItem(LS + id); } catch (e) {} });
      await reloadFromStore();
    }
  }
};
/* read everything again after the server changed it */
async function reloadFromStore(){
  KEYS = (() => { try { return JSON.parse(localStorage.getItem(KEYS_ID) || "{}") || {}; } catch (e) { return {}; } })();
  let p = null; try { p = await Store.get("profile"); } catch (e) {}
  if (!p){
    S.profile = null; S.weeks = {}; S.arts = {}; S.news = {}; S.convs = {}; S.chats = {}; S.bank = {}; S.city = null; S.log = {kind:"log", days:{}}; S.wallet = newWallet(); S.onb = {step:0, stage:0}; S.pick = null;
  } else {
    try { await loadAll(); } catch (e) {}
  }
  render();
}
function choiceBox(title, body, labels){
  return new Promise(resolve => {
    const d = $("#dialog");
    d.innerHTML = '<div class="card" role="alertdialog" aria-modal="true"><h3>' + esc(title) + '</h3><p class="muted" style="margin:0">' + esc(body) + '</p><div class="stack">' +
      labels.map((l, i) => '<button class="btn' + (i ? " soft" : "") + ' block" data-i="' + i + '">' + esc(l) + "</button>").join("") +
      '<button class="btn ghost block" data-i="-1">取消</button></div></div>';
    d.hidden = false;
    d.querySelectorAll("button[data-i]").forEach(b => b.onclick = () => { d.hidden = true; d.innerHTML = ""; resolve(Number(b.dataset.i)); });
  });
}
const saveProfile = (() => { let t; return () => { clearTimeout(t); t = setTimeout(() => { if (S.profile) Store.set("profile", S.profile).catch(() => {}); }, 500); }; })();
const artId = a => "art-" + a.week + "-" + a.day + "-" + a.k;
