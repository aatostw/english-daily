/* =========================================================
   Storage: this browser's localStorage (with a copy in memory).
   Every change is also queued for the cloud (see Cloud below).
   ========================================================= */
const LS = "eel1:";
function lsOk(){ try { localStorage.setItem(LS + "t", "1"); localStorage.removeItem(LS + "t"); return true; } catch (e) { return false; } }
const Store = {
  mem:new Map(), chains:new Map(),
  async get(id){
    if (this.mem.has(id)) return clone(this.mem.get(id));
    try { const v = localStorage.getItem(LS + id); return v ? JSON.parse(v) : null; } catch (e) { return null; }
  },
  /* writes to one id happen in order */
  set(id, data){
    const body = clone(data); delete body._id;
    const prev = this.chains.get(id) || Promise.resolve();
    const p = prev.catch(() => {}).then(() => this._write(id, body));
    this.chains.set(id, p);
    return p.catch(e => { toast("儲存失敗，稍後會再試。"); throw e; });
  },
  async _write(id, body){
    this.mem.set(id, body);
    try { localStorage.setItem(LS + id, JSON.stringify(body)); } catch (e) { toast("這支手機的儲存空間滿了。"); }
    Cloud.mark(id);
  },
  async del(id){
    this.mem.delete(id);
    try { localStorage.removeItem(LS + id); } catch (e) {}
    Cloud.mark(id);
  },
  async list(kind){
    const out = new Map();
    try {
      for (let i = 0; i < localStorage.length; i++){
        const k = localStorage.key(i);
        if (k && k.startsWith(LS)){ const v = JSON.parse(localStorage.getItem(k)); if (v && v.kind === kind) out.set(k.slice(LS.length), v); }
      }
    } catch (e) {}
    for (const [k, v] of this.mem) if (v.kind === kind) out.set(k, v);
    return [...out].map(([k, v]) => Object.assign(clone(v), {_id:k}));
  }
};
