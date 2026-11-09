/* =========================================================
   Daily news: one international tech story a day, the same for everyone,
   made once on the server at six levels. This phone keeps today's copy at its level.
   ========================================================= */
const NEWS = {status:"idle", err:"", timer:0, tries:0};
function newsToday(){ return Object.values(S.news || {}).filter(x => x && x.kind === "news").sort((a, b) => b.date < a.date ? -1 : 1)[0] || null; }
async function loadNews(force){
  if (!Cloud.on() || NEWS.status === "loading") return;
  const have = newsToday();
  const fresh = have && have.date === todayTaipei() && (have.tier === tierIdx() || have.read);
  if (fresh && !force) { NEWS.status = "ready"; return; }
  NEWS.status = "loading"; NEWS.err = ""; renderNewsCard();
  try {
    const r = await fetch(Cloud.url() + "/news?tier=" + tierIdx(), {headers:{Authorization:"Bearer " + Cloud.cfg.token}});
    const j = await r.json().catch(() => ({}));
    if (r.status === 202 || j.pending){
      NEWS.status = "pending"; NEWS.err = j.error || "";
      clearTimeout(NEWS.timer);
      if (NEWS.tries++ < 30) NEWS.timer = setTimeout(() => { if (NEWS.status === "pending"){ NEWS.status = "idle"; loadNews(); } }, 6000);
    } else if (!r.ok || !j.ok) throw new Error(j.error || "伺服器回應 " + r.status);
    else {
      const n = j.news, old = S.news["news-" + n.date];
      const item = Object.assign({kind:"news", read:false}, n, old && old.read ? {read:true, readAt:old.readAt} : {});
      S.news["news-" + n.date] = item; Store.set("news-" + n.date, item).catch(() => {});
      NEWS.status = "ready"; NEWS.tries = 0;
    }
  } catch (e) { NEWS.status = "error"; NEWS.err = e.message || "連不上伺服器"; }
  renderNewsCard();
}
function todayTaipei(){ return new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10); }
function renderNewsCard(){ const el = $("#news-card"); if (el) el.outerHTML = newsCardHTML(); }
function newsCardHTML(){
  if (!Cloud.on()) return "";
  const n = newsToday(), today = n && n.date === todayTaipei();
  let inner;
  if (n && (today || NEWS.status !== "pending")){
    inner = '<div class="news-meta"><span class="chip">' + esc(n.source && n.source.site || "") + '</span><span class="chip">' + esc(n.level || "") + "</span>" + (today ? "" : '<span class="chip">' + esc(n.date.slice(5).replace("-", "/")) + "</span>") + (n.read ? '<span class="chip done">讀完了</span>' : "") + "</div>" +
      '<div class="news-title en">' + esc(n.title) + '</div><div class="news-zh">' + esc(n.title_zh || "") + "</div>" +
      (n.summary_zh ? '<p class="muted small" style="margin:0">' + esc(n.summary_zh) + "</p>" : "") +
      '<button class="btn' + (n.read ? " soft" : "") + ' block" data-act="open-news" data-id="news-' + esc(n.date) + '">' + (n.read ? "再讀一次" : "閱讀") + "</button>";
  } else if (NEWS.status === "error"){
    inner = '<div class="err">' + esc(NEWS.err) + '</div><button class="btn soft block" data-act="news-retry">再試一次</button>';
  } else {
    inner = '<div class="writing"><span class="spinner"></span>' + (NEWS.status === "pending" ? "今天的新聞正在準備中，大約一分鐘…" : "正在拿今天的新聞…") + "</div>";
  }
  return '<section class="card news-card" id="news-card"><div class="row between" style="align-items:center"><div class="label">國際科技</div><span class="small muted">每天一篇，大家讀同一則</span></div>' + inner + "</section>";
}
function openNews(id){
  const a = S.news[id]; if (!a) return;
  openReader({news:true, state:"ready", art:a});
  prepareArticleVoice(false);
}
function newsReaderHTML(a){
  const mins = Math.max(1, Math.round(String(a.body).split(/\s+/).length / 110));
  let html = '<div class="meta"><span class="chip">每日新聞 · ' + esc(a.date.slice(5).replace("-", "/")) + '</span><span class="chip">' + esc(a.level || "") + '</span><span class="chip">約 ' + mins + ' 分鐘</span><span class="chip" id="rd-voice" hidden></span></div>';
  html += '<div class="reader-title">' + esc(a.title) + "</div>" + (a.title_zh ? '<div class="reader-title-zh">' + esc(a.title_zh) + "</div>" : "");
  html += '<div class="legend"><span><i style="background:var(--yellow)"></i>新聞單字</span><span>點任何一個字看解釋</span></div>';
  html += renderBody(a.body, "reader", {words:a.words || [], pats:{}});
  if ((a.words || []).length) html += '<section class="card"><div class="label">新聞單字</div><div>' + a.words.map(x =>
    '<button class="word-row" data-act="say" data-text="' + esc(x.en) + '"><span class="w-main"><span class="w-en">' + esc(x.en) + '</span><div class="w-zh">' + esc(x.zh) + "</div></span>" + ICON.speaker.replace("<svg", '<svg width="18" height="18"') + "</button>").join("") + "</div></section>";
  if (a.source && a.source.link) html += '<div class="small muted news-src">資料來源：' + esc(a.source.site) + ' · <a href="' + esc(a.source.link) + '" target="_blank" rel="noopener">' + esc(a.source.title) + "</a><br>本文由 AI 依新聞改寫成學習用的英文。</div>";
  html += a.read ? '<div class="row"><span class="chip done">讀完了</span></div>' : '<button class="btn green block" data-act="mark-read">我讀完也唸完了</button>';
  return html;
}
function openArticle(id){
  const a = S.arts[id]; if (!a) return;
  openReader({week:a.week, day:a.day, k:a.k, genre:a.genre, topic:a.topic, state:"ready", art:a});
  prepareArticleVoice(false);
}
async function checkPractice(){
  const r = S.reader; if (!r || !r.art) return;
  const a = r.art, w = S.weeks[a.week];
  const val = ($("#pr-input") && $("#pr-input").value.trim()) || "";
  if (!val){ toast("先寫一句英文。"); return; }
  a.answer = val; S.busy.practice = true; S.err.practice = ""; drawReader(false);
  try {
    const P = weekPats(w);
    const fb = await aiJson("review", practicePrompt(a.practice_zh || "", P[a.practice_pattern] || P.A, val), {cache:false});
    const firstTry = !a.practicedAt;
    a.practicedAt = Date.now(); logActivity("practice");
    if (firstTry) earn(5, "造句練習");
    if (fb.ok && !a.coinOk){ a.coinOk = true; earn(5, "造句寫對了"); gainKnow(5, "造句寫對了"); }
    checkStreakBonus();
    a.feedback = {ok:!!fb.ok, corrected:String(fb.corrected || ""), notes_zh:Array.isArray(fb.notes_zh) ? fb.notes_zh.map(String).slice(0, 3) : [], natural:String(fb.natural || "")};
    Store.set(artId(a), a).catch(() => {});
  } catch (e) { S.err.practice = aiErr(e); }
  S.busy.practice = false; drawReader(false);
}
async function startTalk(){
  const {w, d, rev} = curChat(); if (!w || S.busy.talk) return;
  S.busy.talk = true; S.err.talk = ""; render();
  try {
    let scenario;
    if (d >= 6){
      const sc = await aiJson("talk", scenarioPrompt(w), {cache:false});
      if (!sc || !sc.opening) throw {code:"invalid_json"};
      scenario = {};
      ["title_zh","situation_zh","learner_role_zh","partner_role_zh","partner_name","opening"].forEach(k => { scenario[k] = String(sc[k] || ""); });
      scenario.partner_name = "Lisa";
    } else {
      const sc = await aiJson("talk", dailyChatPrompt(w, d, rev), {cache:false});
      if (!sc || !sc.opening) throw {code:"invalid_json"};
      scenario = {title_zh:String(sc.topic_zh || "今天的聊天"), situation_zh:"Lisa and the learner are friends having a casual everyday chat about " + w.theme_en + ".",
        learner_role_zh:"你自己", partner_role_zh:"你的英文朋友", partner_name:"Lisa", opening:String(sc.opening)};
    }
    const conv = {kind:d >= 6 ? "conv" : "chat", week:w.n, day:d, scenario, turns:[{role:"assistant", content:scenario.opening}], feedback:null, done:false, createdAt:Date.now()};
    if (d >= 6) S.convs[w.n] = conv; else S.chats[w.n + "-" + d] = conv;
    await Store.set(convKey(w, d), conv).catch(() => {});
    S.talk.scrollDown = true;
  } catch (e) { S.err.talk = aiErr(e); }
  S.busy.talk = false; render();
}
async function sendTalk(){
  const {w, d, conv, rev} = curChat();
  const box = $("#talk-input"); if (!conv || !box) return;
  S.talk.warn = "";
  const msg = box.value.trim(); if (!msg) return;
  if (S.busy.reply) return;
  conv.turns.push({role:"user", content:msg});
  box.value = ""; S.talk.draft = "";
  S.busy.reply = true; S.err.talk = ""; S.talk.live = ""; S.talk.scrollDown = true; render();
  const turns = [{role:"user", content:talkRules(w, conv.scenario, rev)}].concat(conv.turns.slice(-30));
  let pending = false;
  try {
    const res = await ai("talk", turns, {cache:false, onText: ({text}) => {
      S.talk.live = text;
      if (!pending){ pending = true; requestAnimationFrame(() => { pending = false; const b = $("#live-text"); if (b){ b.textContent = S.talk.live; const sc = $("#cc-body") || $("#main"); sc.scrollTop = sc.scrollHeight; } }); }
    }});
    conv.turns.push({role:"assistant", content:res.text.trim()});
  } catch (e) {
    S.err.talk = aiErr(e);
  }
  S.busy.reply = false; S.talk.live = ""; S.talk.scrollDown = true;
  Store.set(convKey(w, d), conv).catch(() => {});
  render();
  const nb = $("#talk-input"); if (nb) nb.focus();
}
async function endTalk(){
  const {w, d, conv, rev} = curChat();
  if (!conv || S.busy.fb) return;
  const mine = conv.turns.filter(t => t.role === "user").length;
  if (mine < 4){ S.talk.warn = "還不能結算：至少要聊 4 句（目前 " + mine + " 句）"; render(); return; }
  S.talk.warn = "";
  S.busy.fb = true; S.err.talk = ""; render();
  try {
    const f = await aiJson("review", feedbackPrompt(w, conv, rev), {cache:false});
    const P = weekPats(w);
    const weakLabels = Array.isArray(f.patterns_weak) ? f.patterns_weak.map(String).filter(k => P[k] && rev.pats.includes(k)) : [];
    conv.feedback = {
      score:Number(f.score) || 3, summary_zh:String(f.summary_zh || ""),
      words_used:Array.isArray(f.words_used) ? f.words_used.map(Number) : [],
      patterns_used:Array.isArray(f.patterns_used) ? f.patterns_used.map(String) : [],
      patterns_weak:weakLabels,
      corrections:Array.isArray(f.corrections) ? f.corrections.slice(0, 5).map(c => ({original:String(c.original || ""), better:String(c.better || ""), why_zh:String(c.why_zh || "")})) : [],
      try_next_zh:String(f.try_next_zh || "")
    };
    conv.done = true; conv.doneAt = Date.now();
    logActivity("talk");
    const score = Math.max(1, Math.min(5, conv.feedback.score));
    if (d >= 6){
      const map = {A:w.patterns[0], B:w.patterns[1]};
      (w.review || []).forEach((pid, i) => { map["R" + (i + 1)] = pid; });
      conv.weakPids = [...new Set(weakLabels.map(k => map[k]).filter(x => x != null))].slice(0, 2);
      w.completedAt = conv.doneAt; Store.set("week-" + w.n, w).catch(() => {});
      await Store.set(convKey(w, d), conv).catch(() => {});
      earn(Math.min(50, score * 10), "第 " + w.n + " 週總複習（" + conv.feedback.score + " 分）");
      gainKnow(score * 5, "週日總複習");
      checkStreakBonus(); checkWeekBonus(w);
    } else {
      await Store.set(convKey(w, d), conv).catch(() => {});
      earn(score * 4, DAY_NAMES[d] + "跟 Lisa 聊天（" + conv.feedback.score + " 分）");
      gainKnow(score * 2, "跟 Lisa 聊天");
      checkStreakBonus();
    }
  } catch (e) { S.err.talk = aiErr(e); }
  S.busy.fb = false; render();
}
async function toggleStar(){
  const o = S.sheet; if (!o) return;
  const d = o.data, head = d.lemma || d.en || d.word, id = slug(head);
  if (S.bank[id]){
    delete S.bank[id];
    Store.del("word-" + id).catch(() => {});
    toast("已取消收藏");
  } else {
    const entry = {kind:"word", en:head, ipa:d.ipa || "", pos:d.pos || "", zh:d.zh || "", note_zh:d.note_zh || d.in_context_zh || "", example_en:d.example_en || "", example_zh:d.example_zh || "", sentence:o.sentence || "", addedAt:Date.now()};
    S.bank[id] = entry;
    Store.set("word-" + id, entry).catch(() => {});
    toast("收進單字庫了");
  }
  drawSheet();
  if (S.view === "words" && !S.reader) render();
}
async function translateSentence(){
  const o = S.sheet; if (!o || !o.sentence || o.trBusy) return;
  o.trBusy = true; drawSheet();
  try {
    const r = await ai("lookup", "Translate this English sentence into natural Traditional Chinese as used in Taiwan. Reply with the translation only.\n\n" + o.sentence, {cache:{gcTime:86400000}});
    o.data.sentence_zh = r.text.trim();
  } catch (e) { toast(aiErr(e)); }
  o.trBusy = false; if (S.sheet === o) drawSheet();
}
function readAll(){
  const ctx = S.ctx.reader; const btn = $("#rd-play");
  if (!ctx || !ctx.paras.length) return;
  if (S.reading){ S.reading = false; TTS.stop(); document.querySelectorAll(".para.playing").forEach(p => p.classList.remove("playing")); if (btn){ btn.innerHTML = ICON.play; btn.classList.remove("on"); } return; }
  S.reading = true; if (btn){ btn.innerHTML = ICON.stop; btn.classList.add("on"); }
  let i = 0;
  const next = () => {
    document.querySelectorAll(".para.playing").forEach(p => p.classList.remove("playing"));
    if (!S.reading || i >= ctx.paras.length){ S.reading = false; const b = $("#rd-play"); if (b){ b.innerHTML = ICON.play; b.classList.remove("on"); } return; }
    const el = document.querySelector('#rd-body .para[data-pi="' + i + '"]');
    if (el){ el.classList.add("playing"); el.scrollIntoView({block:"center", behavior:"smooth"}); }
    const text = ctx.paras[i]; i++;
    TTS.prefetch(ctx.paras[i]);
    if (!TTS.speak(text, set().rate, next)){ S.reading = false; }
  };
  next();
}
function sayPara(btn){
  const ctxEl = btn.closest("[data-ctx]"); const ctx = ctxEl && S.ctx[ctxEl.dataset.ctx]; if (!ctx) return;
  const pi = Number(btn.dataset.pi), para = btn.closest(".para");
  S.reading = false;
  const pb = $("#rd-play"); if (pb){ pb.innerHTML = ICON.play; pb.classList.remove("on"); }
  document.querySelectorAll(".para.playing").forEach(p => p.classList.remove("playing"));
  para.classList.add("playing");
  TTS.speak(ctx.paras[pi], set().rate, () => para.classList.remove("playing"));
}
async function resetAll(){
  if (!(await confirmBox("全部重來？", "所有週次、文章、對話和收藏的單字都會刪除，無法復原。", "刪除並重來", true))) return;
  try {
    for (const kind of ["art","conv","chat","week","word","log","wallet","city"]){
      const docs = await Store.list(kind);
      for (const d of docs) await Store.del(d._id);
    }
    await Store.del("profile");
  } catch (e) { toast("刪除時出了問題，請再試一次。"); return; }
  S.profile = null; S.weeks = {}; S.arts = {}; S.news = {}; S.convs = {}; S.chats = {}; S.bank = {}; S.city = null; S.log = {kind:"log", days:{}}; S.wallet = newWallet(); S.onb = {step:0, stage:0}; S.pick = null;
  render();
}
async function testProvider(p){
  if (S.busy.provTest) return;
  S.busy.provTest = true; S.provTest[p] = null; render();
  try {
    const ids = await fetchModels(p), m = taskCfg("write").model;
    S.provTest[p] = ids.length && m && !ids.includes(m)
      ? {ok:false, msg:"金鑰可以用，但你的帳號清單裡找不到「" + m + "」，可能還不能用這個模型，換一個試試。"}
      : {ok:true, msg:"連線成功，可以開始使用。"};
  } catch (e) { S.provTest[p] = {ok:false, msg:aiErr(e)}; }
  S.busy.provTest = false; render();
}
