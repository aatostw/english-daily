/* =========================================================
   Boot
   ========================================================= */
async function loadAll(){
  const p = await Store.get("profile");
  if (!p) return;
  const base = defaultSettings();
  p.settings = Object.assign(base, p.settings || {});
  p.settings.models = Object.assign(defaultSettings().models, (p.settings && p.settings.models) || {});
  const [weeks, arts, convs, words, chats, news] = await Promise.all([Store.list("week"), Store.list("art"), Store.list("conv"), Store.list("word"), Store.list("chat"), Store.list("news")]);
  S.news = {}; news.forEach(x => { const id = x._id; delete x._id; S.news[id] = x; });
  S.chats = {}; chats.forEach(c => { delete c._id; S.chats[c.week + "-" + c.day] = c; });
  S.weeks = {}; weeks.forEach(w => { delete w._id; S.weeks[w.n] = w; });
  S.arts = {}; arts.forEach(a => { delete a._id; S.arts[artId(a)] = a; });
  S.convs = {}; convs.forEach(c => { delete c._id; S.convs[c.week] = c; });
  S.bank = {}; words.forEach(x => { const id = x._id.replace(/^word-/, ""); delete x._id; S.bank[id] = x; });
  S.log = (await Store.get("log")) || {kind:"log", days:{}};
  S.city = Object.assign(newCity(), (await Store.get("city")) || {});
  if (S.city.knowledge == null){
    const arts = Object.values(S.arts).filter(a => a.read).length, okPr = Object.values(S.arts).filter(a => a.coinOk).length;
    const sun = Object.values(S.convs).filter(c => c.done && c.feedback), day = Object.values(S.chats).filter(c => c.done && c.feedback);
    S.city.knowledge = arts * 3 + okPr * 5 + sun.reduce((t, c) => t + (c.feedback.score || 3) * 5, 0) + day.reduce((t, c) => t + (c.feedback.score || 3) * 2, 0);
  }
  S.wallet = Object.assign(newWallet(), (await Store.get("wallet")) || {});
  if (!S.log.days) S.log.days = {};
  if (!S.weeks[p.currentWeek]){ const ns = Object.keys(S.weeks).map(Number); p.currentWeek = ns.length ? Math.max.apply(null, ns) : 0; }
  /* once: the default model became Gemini 3.5 Flash Lite; anything still on the old default moves over */
  if (p.settings && !p.settings.liteDefault){
    p.settings.liteDefault = true;
    if (p.settings.ai && p.settings.ai.provider === "gemini" && p.settings.ai.model === "gemini-3.8-flash") p.settings.ai.model = "gemini-3.5-flash-lite";
    Object.values(p.settings.models || {}).forEach(m => { if (m && m.provider === "gemini" && m.model === "gemini-3.8-flash") m.model = "gemini-3.5-flash-lite"; });
    Store.set("profile", p).catch(() => {});
  }
  S.profile = p;
}
async function boot(){
  if (window.__timeOffset){
    /* a reminder in the header while the developer test clock is on */
    const t = document.createElement("span"); t.className = "pill bad test-clock"; t.textContent = "測試時間 " + (new Date().getMonth() + 1) + "/" + new Date().getDate();
    const sp = document.querySelector(".top .spacer"); if (sp) sp.before(t);
  }
  const v = location.hash.slice(1);
  if (["learn","home","city","talk","words","prefs"].includes(v)) S.view = v;
  S.canStore = lsOk();
  /* logged in: get what other devices saved before showing anything (gives up after 4 seconds) */
  if (Cloud.on()){
    await Promise.race([Cloud.push().then(() => Cloud.pull()), new Promise(r => setTimeout(r, 4000))]);
    KEYS = (() => { try { return JSON.parse(localStorage.getItem(KEYS_ID) || "{}") || {}; } catch (e) { return {}; } })();
  }
  try { await loadAll(); } catch (e) {}
  render();
  Cloud.refreshMe();
}
boot();
setTimeout(() => { TTS.warmSeq = TTS.seq; TTS.pocketWarm(); }, 800);
/* Background audio work pauses while the app isn't on screen, and picks up again when you come back. */
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) TTS.pocketPump();
  if (!Cloud.on()) return;
  /* leaving: upload now. Coming back: download what other devices saved, unless something is open */
  if (document.hidden){ clearTimeout(Cloud.timer); Cloud.push(); return; }
  const busy = S.reader || !$("#sheet").hidden || !$("#dialog").hidden || S.busy && Object.values(S.busy).some(Boolean);
  if (!busy && Date.now() - Cloud.lastPull > 30000){ Cloud.pull().then(ch => { if (ch) reloadFromStore(); }); Cloud.refreshMe(); }
});
/* Offline cache: only works when the app is opened from an https:// address. */
if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")){
  navigator.serviceWorker.register("sw.js").catch(() => {});
}
