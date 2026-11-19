/* =========================================================
   聽學：用本週單字或收藏單字做成的 Podcast。
   AI 寫稿 → 電腦（GPT-SoVITS）唸成一整集 → 存在電腦，播放時串流過來。
   每一段：中文導讀 → 英文故事／對話 → 單字回顧（單字、原句重播、解釋、新例句、跟著說）。
   ========================================================= */
const POD_TYPE = {story:"故事", dialog:"對話情境"};
const POD_SRC = {week:"本週單字", star:"我的收藏", custom:"自己新增"};
const POD_ZH = {more:"中英導讀", less:"中文少", none:"全英文"};
const POD_ZH_HINT = {more:"每段先用中文說大意，單字用中文解釋情境和用法。", less:"每段先用中文說大意，單字只說中文意思，詳細解釋留在畫面上。", none:"全部用英文唸，連單字解釋也是英文；中文只出現在畫面上。"};
const NUM_ZH = ["一", "二", "三", "四", "五", "六", "七", "八"];
const NUM_EN = ["one", "two", "three", "four", "five", "six", "seven", "eight"];
const LETTER = {a:"ay", b:"bee", c:"see", d:"dee", e:"ee", f:"f", g:"gee", h:"h", i:"eye", j:"jay", k:"kay", l:"el", m:"em", n:"en", o:"oh", p:"pee", q:"cue", r:"ar", s:"ess", t:"tee", u:"you", v:"vee", w:"double you", x:"ex", y:"why", z:"zee"};
const MAX_WORDS = 80;
ICON.headphones = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 15v-3a8 8 0 0 1 16 0v3"/><rect x="3" y="14" width="4.5" height="7" rx="1.8"/><rect x="16.5" y="14" width="4.5" height="7" rx="1.8"/></svg>';
ICON.pause = '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6.5" y="5" width="4" height="14" rx="1.2"/><rect x="13.5" y="5" width="4" height="14" rx="1.2"/></svg>';
ICON.back10 = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1"/><path d="M3 4v4.5h4.5"/><text x="12" y="15.6" text-anchor="middle" font-size="7.5" font-weight="700" fill="currentColor" stroke="none" font-family="Lexend,sans-serif">10</text></svg>';
ICON.fwd10 = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.5 12a8.5 8.5 0 1 1-2.6-6.1"/><path d="M21 4v4.5h-4.5"/><text x="12" y="15.6" text-anchor="middle" font-size="7.5" font-weight="700" fill="currentColor" stroke="none" font-family="Lexend,sans-serif">10</text></svg>';
ICON.plus = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>';
ICON.more = '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>';

function listenOpts(){
  const st = set();
  const o = Object.assign({types:["story"], srcs:["week"], sel:{}, custom:[], mins:12, zh:"more", follow:true, spell:false, speed:1, rate:1, onlyEn:false, auto:true}, st.listen || {});
  /* 舊的設定（一個類型、一個來源、短中長）換成新的 */
  if (o.type){ o.types = [o.type]; delete o.type; }
  if (o.src){ o.srcs = [o.src]; delete o.src; }
  if (o.len){ o.mins = {short:8, mid:12, long:16}[o.len] || 12; delete o.len; }
  if (S.profile) st.listen = o;
  return o;
}
function podList(){ return Object.values(S.pods || {}).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)); }
function podOf(id){ return (S.pods || {})[id] || null; }
function savePod(p){ S.pods[p.id] = p; return Store.set(p.id, p).catch(() => {}); }
function heardCount(word){ const h = S.log && S.log.m && S.log.m.h && S.log.m.h[String(word).toLowerCase()]; return h ? h.n : 0; }
function podTypes(p){ return p.types || [p.type || "story"]; }
function podSrcs(p){ return p.srcs || [p.src || "week"]; }

/* ---------- 挑單字 ---------- */
/* 三個來源的所有單字，每個都標好有沒有勾選。
   沒動過的預設全部勾選（勾「我的收藏」就是所有收藏單字）。 */
function podCandidates(o){
  const norm = (x, from) => ({en:String(x.en).trim(), pos:x.pos || "", ipa:x.ipa || "", zh:x.zh || "", note_zh:x.note_zh || "", example_en:x.example_en || "", from});
  const out = [], seen = new Set();
  const push = (x, on) => { const k = x.en.toLowerCase(); if (!x.en || seen.has(k)) return; seen.add(k); x.key = k; x.on = o.sel[k] != null ? !!o.sel[k] : on; out.push(x); };
  const w = curWeek();
  if (w) w.words.forEach(x => push(norm(x, "week"), true));
  Object.values(S.bank).filter(x => x && x.en)
    .sort((a, b) => (heardCount(a.en) - heardCount(b.en)) || ({new:0, mid:1, ok:2}[mastery("w", a.en)] - {new:0, mid:1, ok:2}[mastery("w", b.en)]) || ((b.addedAt || 0) - (a.addedAt || 0)))
    .forEach(x => push(norm(x, "star"), true));
  (o.custom || []).forEach(x => push(norm(x, "custom"), true));
  return out;
}
function podWords(o){
  return podCandidates(o).filter(x => x.on && o.srcs.includes(x.from)).slice(0, MAX_WORDS)
    .map(x => { const y = Object.assign({}, x); delete y.on; delete y.key; if (x.from === "star") y.saved = true; return y; });
}
/* 把單字分給每一段：8 個字 3 段 → 3、3、2 */
function splitWords(words, parts){
  const out = Array.from({length:parts}, () => []);
  words.forEach((w, i) => out[i % parts].push(w));
  return out;
}
function spellText(word){
  return String(word).toLowerCase().split(/\s+/).filter(Boolean).map(t => t.replace(/[^a-z]/g, "").split("").map(c => LETTER[c]).join(", ")).filter(Boolean).join(". ") + ".";
}
function spellShow(word){ return String(word).toUpperCase().split(/\s+/).map(t => t.replace(/[^A-Z]/g, "").split("").join(" ")).join("  ·  "); }

/* 用時間長度推算：幾段、每段英文大概幾個字（單字回顧的時間先扣掉） */
function podPlan(o, n){
  const mins = Math.max(3, Math.min(30, Number(o.mins) || 12)), sp = Number(o.speed) || 1;
  let parts = Math.max(1, Math.min(8, Math.round(mins / 4)));
  if (n) parts = Math.min(parts, n);
  /* 秒數是用電腦實際唸出來的一集量的（英文每秒約 3.2 個字，加上每句之間的停頓） */
  const perWord = (1.6 + (o.spell ? 4.3 : 0) + 2.2 + 2.1) / sp + (o.zh === "more" ? 5 : o.zh === "less" ? 2.3 : 3 / sp) + 2 + (o.spell ? 1.2 : 0) + (o.follow ? 2.6 : 0.9);
  const perPart = o.zh !== "none" ? 9.5 : 5;
  const review = n * perWord, story = mins * 60 - review - parts * perPart - 4;
  const enWords = Math.round(Math.max(40, Math.min(700, story / parts * 2.6 * sp)) / 10) * 10;
  return {mins, parts, enWords, reviewMin:Math.round(review / 60 * 10) / 10, short:story / parts < 30};
}

/* ---------- 稿子 ---------- */
function podPrompt(o, groups, prev, plan){
  const w = curWeek(), P = w && o.srcs.includes("week") ? weekPats(w) : null;
  const types = o.types.length ? o.types : ["story"], mixed = types.length > 1, anyDialog = types.includes("dialog");
  const typeOf = i => types[i % types.length];
  return [
    "You write one episode of a listening podcast for " + learnerNoun(true) + ". The learner listens while working (hands busy), so it must be easy to follow by ear.",
    "Learner level: " + levelText(),
    aboutPrompt(),
    P ? "Week theme: " + w.theme_en + " (" + w.theme_zh + ")" : "Theme: everyday life in Taiwan; pick one concrete situation that fits the words.",
    types.includes("story") ? "Story parts: told by ONE narrator, warm and concrete, with a small turn in every part. Characters may speak inside the narration with quotation marks. Every line has who \"N\"." : "",
    anyDialog ? "Dialogue parts: a natural everyday conversation between two people, A and B, in a real-life situation (work, shopping, friends, family, travel). They take turns; each line is what one person says. Every line has who \"A\" or \"B\"." : "",
    mixed ? "Story parts and dialogue parts belong to ONE continuous plot with the same characters (A and B are characters of the story)." : "",
    prev ? "This continues earlier episodes. Keep the same characters and continue the story from here: " + prev : "",
    P ? "Sentence patterns of the week; use each one naturally a few times: A: " + P.A.en + " (" + P.A.zh + "); B: " + P.B.en + " (" + P.B.zh + ")" : "",
    "",
    "The episode has " + groups.length + " parts and must last about " + plan.mins + " minutes when read aloud, so the LENGTH of each part matters: write the full number of English words given for each part (count them). If a part feels finished too early, add more scenes, details and events; never pad with repeated sentences.",
    "Split the English into lines of one or two sentences (about 9 words per line).",
    "Target words for each part (use every word of a part at least twice inside that part, inflected forms are fine; they may appear again later):",
    groups.map((g, i) => "Part " + (i + 1) + " (" + (typeOf(i) === "story" ? "story" : "dialogue") + ", about " + plan.enWords + " English words = about " + Math.max(4, Math.round(plan.enWords / 9)) + " lines): " + g.map(x => x.en + (x.zh ? " (" + x.zh + ")" : "")).join("; ")).join("\n"),
    "",
    "Spoken English only: it will be read aloud by a voice engine. No markup, no emoji, no lists, no stage directions, no parentheses. Write numbers as words.",
    "",
    "Reply with only JSON in this shape:",
    '{"title":"English title, at most 7 words","title_zh":"中文標題",' + (anyDialog ? '"cast":{"A":"Mia","B":"Ken"},' : "") + '"summary_zh":"這一集發生了什麼（1～2 句，下一集接著寫用）",' +
    '"parts":[{"intro_zh":"用 1～2 句中文說這一段在發生什麼事，不要翻譯全文，40 字以內","lines":[{"who":"' + (types[0] === "story" ? "N" : "A") + '","en":"..."}],' +
    '"words":[{"word":"the target word exactly as given","zh":"簡短中文意思","ipa":"/American IPA/","line":0,"explain_zh":"1～2 句中文：它在這個情境的意思、怎麼用、常跟什麼搭配（句子裡可以直接寫英文單字）","explain_en":"one short, simple English explanation","example_en":"one new short everyday example, at most 12 words, not from the story"}]}]}',
    '"line" is the 0-based index of the line in that part where the word is used most clearly. "words" lists exactly the target words of that part, in the order given.',
    "All Chinese in Traditional Chinese as used in Taiwan."
  ].filter(x => x !== "").join("\n");
}
/* 單字在句子裡的樣子：settle in → settled in、settles in 都要認得 */
function wordRe(word){
  const toks = String(word).toLowerCase().replace(/[^a-z' -]/g, " ").split(/[\s-]+/).filter(Boolean);
  if (!toks.length) return null;
  const part = t => t.length > 4 ? escRe(t.replace(/(e|y)$/, "")) + "[a-z']*" : escRe(t) + "(?:s|es|ed|d|ing)?";
  try { return new RegExp("\\b" + toks.map(part).join("[\\s-]+") + "\\b", "i"); } catch (e) { return null; }
}
function cleanSpoken(t){ return String(t || "").replace(/[*_#{}\[\]()]/g, "").replace(/\s+/g, " ").trim(); }

/* 把 AI 的稿子變成一行一行要唸的東西（每行：誰唸、語言、文字、唸完停多久） */
function compilePod(p){
  const o = p.opts, out = [], zh = o.zh, types = podTypes(p), sp = Number(o.speed) || 1;
  /* 英文照設定的語速唸；中文一律正常速度 */
  const add = (k, v, t, gap, extra) => { t = cleanSpoken(t); if (!t && k !== "pause") return; out.push(Object.assign({k, v, lang:v === "zh" ? "zh" : "en", t, gap, s:v === "zh" ? 1 : sp}, extra || {})); };
  (p.script.parts || []).forEach((part, pi) => {
    const story = types[pi % types.length] === "story";
    const voiceOf = who => (!story && String(who).toUpperCase() === "B") ? "b" : "a";
    zh === "none" ? add("cue", "a", "Part " + (NUM_EN[pi] || pi + 1) + ".", 0.6, {p:pi, cue:"part"}) : add("cue", "zh", "第" + (NUM_ZH[pi] || pi + 1) + "段。", 0.5, {p:pi, cue:"part"});
    if (zh !== "none") add("intro", "zh", part.intro_zh, 0.9, {p:pi});
    const lines = (part.lines || []).filter(l => l && cleanSpoken(l.en));
    lines.forEach((l, li) => add("en", voiceOf(l.who), l.en, 0.45, {p:pi, li, who:story ? "" : String(l.who || "A").toUpperCase()}));
    const words = part.words || [];
    if (words.length) zh === "none" ? add("cue", "a", "Now, the words.", 0.8, {p:pi, cue:"review"}) : add("cue", "zh", "來複習這一段的單字。", 0.8, {p:pi, cue:"review"});
    words.forEach(wd => {
      let info = p.words.find(x => x.en.toLowerCase() === String(wd.word || "").toLowerCase());
      if (!info){ info = {en:String(wd.word || ""), zh:"", ipa:""}; p.words.push(info); }
      /* 自己新增的單字沒有中文和音標：用 AI 給的補上 */
      if (!info.zh && wd.zh) info.zh = String(wd.zh);
      if (!info.ipa && wd.ipa) info.ipa = String(wd.ipa);
      const re = wordRe(info.en);
      let li = Number(wd.line);
      if (!(lines[li] && re && re.test(lines[li].en))) li = re ? lines.findIndex(l => re.test(l.en)) : -1;
      const wi = p.words.indexOf(info);
      add("word", "a", info.en + ". " + info.en + ".", 0.6, {p:pi, w:wi});
      if (o.spell && /[a-z]/i.test(info.en)) add("spell", "a", spellText(info.en), 0.5, {p:pi, w:wi, show:spellShow(info.en), s:Math.min(sp, 0.9)}), add("word", "a", info.en + ".", 0.7, {p:pi, w:wi, again:true});
      if (li >= 0) add("replay", voiceOf(lines[li].who), lines[li].en, 0.7, {p:pi, w:wi, who:story ? "" : String(lines[li].who || "A").toUpperCase()});
      if (zh === "more") add("explain", "zh", wd.explain_zh || (info.en + "，" + info.zh + "。"), 0.7, {p:pi, w:wi});
      else if (zh === "less") add("explain", "zh", info.en + "，" + (info.zh || "") + "。", 0.6, {p:pi, w:wi, zh:wd.explain_zh || ""});
      else add("explain", "a", wd.explain_en, 0.7, {p:pi, w:wi, zh:wd.explain_zh || ""});
      if (wd.example_en) add("example", "a", wd.example_en, o.follow ? 2.6 : 0.9, {p:pi, w:wi, follow:!!o.follow});
    });
    out.push({k:"pause", v:"a", lang:"en", t:"", gap:1.2, p:pi});
  });
  zh === "none" ? add("cue", "a", "That's all for this episode. See you next time.", 1, {cue:"end"}) : add("cue", "zh", "這一集結束了，下一集見。", 1, {cue:"end"});
  return out;
}

/* ---------- 和電腦說話（經過伺服器，電腦的位址和密碼不會到手機） ---------- */
function listenErr(status, j){
  const e = (j && j.error) || "";
  if (j && j.offline) return "連不到電腦。請確認電腦開著，而且「start-voice-server.bat」的視窗開著。";
  if (j && j.noVoice) return "管理員還沒幫你開通電腦語音。";
  if (status === 404 && e === "沒有這個功能") return "Cloudflare 伺服器（eel-api）還沒更新成有「聽學」的版本。";
  if (status === 404 && /只開放/.test(e)) return "電腦上的語音伺服器還是舊版。請關掉語音伺服器視窗，再雙擊「start-voice-server.bat」。";
  return e || ("電腦回應 " + status);
}
async function listenApi(path, id, body){
  const base = voiceBase();
  if (!base) throw new Error("聽學要用電腦語音（GPT-SoVITS）。請先登入，並請管理員開通電腦語音。");
  const url = base + path + "?" + new URLSearchParams({k:Cloud.cfg.token, id:id || ""}).toString();
  let r;
  try { r = await fetch(url, body ? {method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(body), cache:"no-store"} : {cache:"no-store"}); }
  catch (e) { throw new Error("連不上伺服器，請確認網路。"); }
  let j = {}; try { j = await r.json(); } catch (e) {}
  if (!r.ok || !j.ok){ const err = new Error(listenErr(r.status, j)); err.missing = !!j.missing; throw err; }
  return j;
}
function podAudioUrl(p){ return voiceBase() + "/listen/audio?" + new URLSearchParams({k:Cloud.cfg.token, id:p.id, v:String(p.ver || 1)}).toString(); }

/* ---------- 做一集 ---------- */
async function makePod(){
  if (S.busy.pod) return;
  const o = clone(listenOpts());
  if (!Cloud.voiceOk()){ S.err.pod = "聽學要用電腦語音（GPT-SoVITS）。請先到「設定 → 帳號」登入，並請管理員開通電腦語音。"; drawSheet(); return; }
  if (!o.types.length){ S.err.pod = "至少勾一種類型。"; drawSheet(); return; }
  if (!o.srcs.length){ S.err.pod = "至少勾一個單字來源。"; drawSheet(); return; }
  const words = podWords(o);
  if (words.length < 2){ S.err.pod = "勾選的單字太少了，至少要 2 個。按「詳情」可以挑單字，也可以自己新增。"; drawSheet(); return; }
  const plan = podPlan(o, words.length);
  const groups = splitWords(words, plan.parts);
  const w = curWeek(), src = o.srcs.includes("week") ? "week" : "star";
  const prevs = o.types.includes("story") ? podList().filter(x => podTypes(x).includes("story") && (x.src || "week") === src && (src !== "week" || (w && x.week === w.n)) && x.script && x.script.summary_zh).slice(0, 3).reverse() : [];
  const prev = prevs.map(x => x.script.summary_zh).join(" ");
  const id = "pod-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 6);
  const p = {kind:"pod", id, types:o.types.slice(), srcs:o.srcs.slice(), src, week:src === "week" && w ? w.n : 0, opts:o, words, state:"write", createdAt:Date.now(), ver:1, pos:0, heard:false};
  S.busy.pod = true; S.err.pod = ""; closeSheet();
  S.pods[id] = p; render();
  try {
    const sc = await aiJson("write", podPrompt(o, groups, prev, plan));
    if (!sc || !Array.isArray(sc.parts) || !sc.parts.length) throw {code:"invalid_json"};
    p.script = sc; p.title = String(sc.title || "Episode"); p.title_zh = String(sc.title_zh || "");
    p.lines = compilePod(p);
    if (p.lines.filter(l => l.k === "en").length < 3) throw {code:"invalid_json"};
    p.state = "make"; await savePod(p); render();
    await sendPod(p);
  } catch (e) {
    p.state = "error"; p.err = e && e.message && !e.code ? e.message : aiErr(e);
    if (p.lines) savePod(p); render();
  } finally { S.busy.pod = false; }
  pollPods();
}
async function sendPod(p){
  p.state = "make"; p.err = ""; p.prog = null;
  await listenApi("/listen/new", p.id, {id:p.id, title:p.title, lines:p.lines.map(l => ({v:l.v, lang:l.lang, t:l.t, gap:l.gap, s:l.s || 1}))});
  await savePod(p); render(); pollPods();
}
/* 等電腦做好：做的中每 4 秒問一次 */
async function pollPods(){
  clearTimeout(pollPods.t);
  const making = podList().filter(p => p.state === "make");
  if (!making.length || !Cloud.voiceOk()) return;
  let changed = false;
  for (const p of making){
    try {
      const j = await listenApi("/listen/status", p.id);
      if (j.state === "done"){ p.state = "ready"; p.times = j.times; p.dur = j.dur; p.prog = null; await savePod(p); changed = true; toast("「" + (p.title_zh || p.title) + "」做好了，可以聽了"); }
      else if (j.state === "error"){ p.state = "error"; p.err = "電腦唸的時候出錯：" + (j.error || ""); p.prog = null; await savePod(p); changed = true; }
      else { const prog = {done:j.done, total:j.total, ahead:j.ahead || 0}; if (JSON.stringify(prog) !== JSON.stringify(p.prog)){ p.prog = prog; changed = true; } }
    } catch (e) {
      if (e.missing){ p.state = "error"; p.err = "電腦上找不到這一集，按「重新做音檔」再送一次。"; await savePod(p); changed = true; }
      else if (p.prog == null || !p.prog.off){ p.prog = Object.assign({}, p.prog, {off:e.message}); changed = true; }
    }
  }
  if (changed && S.view === "listen") render();
  if (podList().some(p => p.state === "make")) pollPods.t = setTimeout(pollPods, 4000);
}

/* ---------- 播放器 ---------- */
const LP = {
  au:null, id:"", want:false, retry:0, lastT:0, acc:0, saveAt:0, cur:-1,
  el(){
    if (!this.au){
      const a = this.au = new Audio(); a.preload = "metadata";
      ["timeupdate", "play", "pause", "loadedmetadata", "durationchange", "ratechange"].forEach(ev => a.addEventListener(ev, () => this.tick()));
      a.addEventListener("playing", () => { this.retry = 0; this.tick(); });
      a.addEventListener("ended", () => this.ended());
      a.addEventListener("error", () => this.recover());
      a.addEventListener("stalled", () => {
        if (!this.want) return;
        clearTimeout(this.st);
        this.st = setTimeout(() => { if (this.want && this.au.paused) this.recover(); }, 8000);
      });
    }
    return this.au;
  },
  load(p, at){
    const a = this.el();
    if (this.id !== p.id){
      this.savePos();
      this.id = p.id; this.cur = -1;
      a.src = podAudioUrl(p);
      a.playbackRate = listenOpts().rate || 1;
      const t = at != null ? at : (p.pos && p.dur && p.pos < p.dur - 5 ? p.pos : 0);
      const go = () => { try { a.currentTime = t; } catch (e) {} };
      if (t) a.addEventListener("loadedmetadata", go, {once:true});
    }
    this.session(p);
  },
  play(p, at){
    TTS.stop && TTS.stop();
    this.load(p, at);
    if (at != null) try { this.au.currentTime = at; } catch (e) {}
    this.want = true;
    this.au.play().catch(() => { this.want = false; this.tick(); toast("播不出來，請再按一次播放。"); });
  },
  toggle(){
    const p = podOf(this.id); if (!p) return;
    if (this.au && !this.au.paused){ this.want = false; this.au.pause(); this.savePos(); }
    else this.play(p);
  },
  seekTo(t){ const a = this.el(); try { a.currentTime = Math.max(0, Math.min(t, (a.duration || 1e9) - 0.2)); } catch (e) {} this.tick(); },
  skip(d){ if (this.au) this.seekTo(this.au.currentTime + d); },
  /* 跳到上一段／下一段的開頭（藍牙耳機的上一首、下一首） */
  part(d){
    const p = podOf(this.id); if (!p || !p.times) return;
    const t = this.au.currentTime, heads = p.lines.map((l, i) => l.cue === "part" && p.times[i] ? p.times[i][0] : null).filter(x => x != null);
    if (d > 0){ const n = heads.find(h => h > t + 0.5); if (n != null) this.seekTo(n); }
    else { const prev = heads.filter(h => h < t - 2); this.seekTo(prev.length ? prev[prev.length - 1] : 0); }
  },
  /* 網路斷掉：記住位置，3 秒後重新接上，最多試 20 次 */
  recover(){
    const p = podOf(this.id); if (!p || !this.want) { this.tick(); return; }
    if (this.retry >= 20){ this.want = false; toast("一直連不到電腦，先暫停。網路好了再按播放。"); this.tick(); return; }
    this.retry++;
    const t = this.au.currentTime || p.pos || 0;
    clearTimeout(this.rt);
    this.rt = setTimeout(() => {
      if (!this.want) return;
      const a = this.au; a.src = podAudioUrl(p) + "&r=" + this.retry;
      a.addEventListener("loadedmetadata", () => { try { a.currentTime = t; } catch (e) {} }, {once:true});
      a.play().catch(() => {});
    }, 3000);
    const b = $("#lp-state"); if (b) b.textContent = "網路不穩，重新連線中…";
  },
  ended(){
    const p = podOf(this.id); this.want = false;
    if (p){ markHeard(p); p.pos = 0; savePod(p); }
    this.tick();
    /* 自動接下一集：還沒聽完、已經做好的，從舊的開始 */
    if (listenOpts().auto){
      const next = podList().filter(x => x.state === "ready" && !x.heard && x.id !== (p && p.id)).sort((a, b) => a.createdAt - b.createdAt)[0];
      if (next){ toast("接著播：" + (next.title_zh || next.title)); if (S.view === "listen" && S.podOpen) S.podOpen = next.id; this.play(next, null); render(); }
    }
  },
  savePos(){
    const p = podOf(this.id); if (!p || !this.au) return;
    const t = Math.round(this.au.currentTime || 0);
    if (t && Math.abs((p.pos || 0) - t) >= 3){ p.pos = t; savePod(p); }
  },
  session(p){
    if (!("mediaSession" in navigator)) return;
    try {
      navigator.mediaSession.metadata = new MediaMetadata({title:p.title_zh ? p.title + "｜" + p.title_zh : p.title, artist:"每日英文 · 聽學", album:POD_TYPE[p.type] || "聽學",
        artwork:[{src:"icons/icon-512.png", sizes:"512x512", type:"image/png"}, {src:"icons/icon-192.png", sizes:"192x192", type:"image/png"}]});
      const ms = navigator.mediaSession, act = (n, f) => { try { ms.setActionHandler(n, f); } catch (e) {} };
      act("play", () => { const q = podOf(this.id); if (q) this.play(q); });
      act("pause", () => { this.want = false; this.au.pause(); this.savePos(); });
      act("seekbackward", d => this.skip(-((d && d.seekOffset) || 10)));
      act("seekforward", d => this.skip((d && d.seekOffset) || 10));
      act("previoustrack", () => this.part(-1));
      act("nexttrack", () => this.part(1));
      act("seekto", d => { if (d && d.seekTime != null) this.seekTo(d.seekTime); });
    } catch (e) {}
  },
  tick(){
    const a = this.au, p = podOf(this.id); if (!a || !p) return;
    const t = a.currentTime || 0, dur = p.dur || a.duration || 0;
    /* 學習紀錄：今天聽了幾秒 */
    if (!a.paused && this.lastT && t > this.lastT && t - this.lastT < 3) this.acc += (t - this.lastT) / (a.playbackRate || 1);
    this.lastT = t;
    if (this.acc >= 30){ logListen(Math.round(this.acc)); this.acc = 0; this.savePos(); }
    if (!p.heard && dur && t > dur * 0.92) markHeard(p);
    try { if ("mediaSession" in navigator && dur && navigator.mediaSession.setPositionState) navigator.mediaSession.setPositionState({duration:dur, position:Math.min(t, dur), playbackRate:a.playbackRate || 1}); } catch (e) {}
    const tm = $("#lp-tm"), sk = $("#lp-seek"), btn = $("#lp-btn"), stEl = $("#lp-state");
    if (tm) tm.textContent = fmtT(t) + " / " + fmtT(dur);
    if (sk && !sk.matches(":active") && !LP.drag){ sk.max = Math.max(1, Math.round(dur)); sk.value = Math.round(t); }
    if (btn) btn.innerHTML = a.paused ? ICON.play : ICON.pause;
    if (stEl && a.readyState >= 3) stEl.textContent = "";
    /* 逐字稿：唸到哪一行就亮哪一行 */
    if (S.podOpen === p.id && p.times){
      let cur = -1;
      for (let i = 0; i < p.times.length; i++){ if (p.times[i] && p.times[i][0] <= t + 0.15 && p.lines[i].t) cur = i; if (p.times[i] && p.times[i][0] > t + 0.15) break; }
      if (cur !== this.cur){
        this.cur = cur;
        document.querySelectorAll(".lp-line.now").forEach(e => e.classList.remove("now"));
        const el = document.querySelector('.lp-line[data-i="' + cur + '"]');
        if (el){ el.classList.add("now"); if (!a.paused && !LP.userScroll) el.scrollIntoView({block:"center", behavior:"smooth"}); }
      }
    }
  }
};
function fmtT(s){ s = Math.max(0, Math.floor(Number(s) || 0)); return Math.floor(s / 60) + ":" + pad(s % 60); }
function logListen(sec){
  if (!S.log) S.log = {kind:"log", days:{}};
  const d = todayStr(), day = S.log.days[d] || (S.log.days[d] = {read:0, practice:0, talk:0});
  day.listen = (day.listen || 0) + sec;
  Store.set("log", S.log).catch(() => {});
}
/* 聽完一集：記下每個單字「聽過」一次（另外記，不會把掌握度直接變成熟練） */
function markHeard(p){
  if (p.heard) return;
  p.heard = true; p.heardAt = Date.now(); savePod(p);
  if (!S.log) S.log = {kind:"log", days:{}};
  const m = S.log.m || (S.log.m = {p:{}, w:{}}), h = m.h || (m.h = {});
  (p.words || []).forEach(x => { const k = String(x.en).toLowerCase(), e = h[k] || (h[k] = {n:0, last:""}); e.n++; e.last = todayStr(); });
  Store.set("log", S.log).catch(() => {});
}

/* ---------- 畫面 ---------- */
function podMeta(p){
  return '<span class="chip">' + podTypes(p).map(t => POD_TYPE[t]).join("＋") + "</span>" +
    '<span class="chip">' + podSrcs(p).map(x => x === "week" ? "第 " + p.week + " 週單字" : POD_SRC[x]).join("＋") + "</span>" +
    (p.dur ? '<span class="chip">' + fmtT(p.dur) + "</span>" : "") +
    (p.heard ? '<span class="chip done">聽完了</span>' : p.pos && p.dur ? '<span class="chip">聽到 ' + Math.min(99, Math.round(p.pos / p.dur * 100)) + "%</span>" : "");
}
function podStateHTML(p){
  if (p.state === "write") return '<div class="row small muted"><span class="spinner"></span>AI 正在寫稿…</div>';
  if (p.state === "make"){
    const g = p.prog || {}, pct = g.total ? Math.round(g.done / g.total * 100) : 0;
    return '<div class="stack"><div class="row small muted"><span class="spinner"></span>' +
      (g.off ? esc(g.off) : g.ahead ? "電腦排隊中（前面還有 " + g.ahead + " 集）" : g.total ? "電腦唸稿中 " + g.done + " / " + g.total + " 句" : "送到電腦了，等它開始唸…") +
      '</div><div class="lp-prog"><i style="width:' + pct + '%"></i></div></div>';
  }
  if (p.state === "error") return '<div class="err">' + esc(p.err || "做不出來") + '</div><div class="row">' +
    (p.lines ? '<button class="btn soft sm" data-act="pod-resend" data-id="' + p.id + '">重新做音檔</button>' : "") +
    '<button class="btn ghost sm" data-act="pod-del" data-id="' + p.id + '">刪除</button></div>';
  return "";
}
function renderListen(){
  if (S.podOpen && podOf(S.podOpen) && podOf(S.podOpen).lines) return renderPod(podOf(S.podOpen));
  S.podOpen = null;
  const f = S.podFilter === "done" ? "done" : "todo", w = curWeek(), all = podList();
  /* 待聽：做音檔中的最上面，再來是聽到一半的，然後還沒聽過的（舊的在前，跟自動接下一集的順序一樣）。已聽完：最近聽完的在前 */
  const rank = p => p.state !== "ready" ? 0 : p.pos ? 1 : 2;
  const list = f === "done" ? all.filter(p => p.heard).sort((a, b) => (b.heardAt || 0) - (a.heardAt || 0))
    : all.filter(p => !p.heard).sort((a, b) => (rank(a) - rank(b)) || (a.createdAt - b.createdAt));
  const today = (S.log && S.log.days && S.log.days[todayStr()] || {}).listen || 0;
  let html = '<section class="card"><div class="row between"><div class="row" style="gap:6px"><button class="icon-btn" data-act="tab" data-v="words" aria-label="回收藏">' + ICON.back + '</button><div><div class="label">聽學</div><b>' +
    (w ? "第 " + w.n + " 週 · " + esc(w.theme_zh) : "用單字做成的 Podcast") + "</b></div></div>" +
    '<button class="btn sm" data-act="pod-new">' + ICON.plus.replace("<svg", '<svg width="18" height="18"') + "新的一集</button></div>" +
    '<div class="seg" role="group" aria-label="篩選"><button data-act="pod-filter" data-f="todo" aria-pressed="' + (f === "todo") + '">待聽</button><button data-act="pod-filter" data-f="done" aria-pressed="' + (f === "done") + '">已聽完</button></div>' +
    (today >= 60 ? '<div class="small muted">今天聽了 ' + Math.round(today / 60) + " 分鐘</div>" : "") + "</section>";
  if (!Cloud.voiceOk()) html += '<div class="note warn">聽學要用電腦語音（GPT-SoVITS）唸稿和存音檔。請先到「設定 → 帳號」登入，並請管理員開通電腦語音。</div>';
  if (!list.length){
    html += '<section class="card flat"><p class="muted" style="margin:0">' + (f === "done" ? "還沒有聽完的集數。" :
      "還沒有要聽的集數。按右上「新的一集」做一集。") + "</p></section>";
    return html;
  }
  list.forEach(p => {
    const playing = LP.id === p.id && LP.au && !LP.au.paused;
    html += '<section class="card pod-card"><button class="pod-open" data-act="pod-open" data-id="' + p.id + '"' + (p.lines ? "" : " disabled") + '>' +
      '<span class="pod-ic' + (playing ? " on" : "") + '">' + (playing ? ICON.pause : ICON.headphones) + '</span><span class="pod-t"><b class="en">' + esc(p.title || (p.state === "write" ? "寫稿中…" : "新的一集")) + "</b>" +
      (p.title_zh ? '<span class="small muted">' + esc(p.title_zh) + "</span>" : "") + '<span class="row wrap" style="gap:6px">' + podMeta(p) + "</span></span></button>" +
      ((p.words || []).length ? '<div class="row wrap" style="gap:6px">' + p.words.map(x => '<span class="chip word">' + esc(x.en) + "</span>").join("") + "</div>" : "") +
      podStateHTML(p) + "</section>";
  });
  return html;
}
function markWords(text, p){
  let html = esc(text);
  (p.words || []).forEach(x => {
    const re = wordRe(x.en); if (!re) return;
    html = html.replace(new RegExp(re.source, "gi"), m => '<mark class="lp-w">' + m + "</mark>");
  });
  return html;
}
function renderPod(p){
  const o = listenOpts(), cast = (p.script && p.script.cast) || {};
  const ready = p.state === "ready" && p.times;
  let html = '<section class="card"><div class="row between"><button class="icon-btn" data-act="pod-close" aria-label="回聽學">' + ICON.back + "</button>" +
    '<div class="row" style="gap:6px"><button class="btn soft sm" data-act="pod-only-en" aria-pressed="' + !!o.onlyEn + '">' + (o.onlyEn ? "顯示中文" : "只看英文") + "</button>" +
    '<button class="icon-btn" data-act="pod-menu" data-id="' + p.id + '" aria-label="更多">' + ICON.more + "</button></div></div>" +
    '<div><b class="en" style="font-size:20px">' + esc(p.title) + "</b>" + (p.title_zh ? '<div class="muted">' + esc(p.title_zh) + "</div>" : "") + "</div>" +
    '<div class="row wrap" style="gap:6px">' + podMeta(p) + "</div>" + podStateHTML(p) +
    (S.podMenu === p.id ? '<div class="stack pod-menu"><button class="btn soft sm" data-act="pod-resend" data-id="' + p.id + '">重新做音檔（稿子不變）</button>' +
      '<button class="btn soft sm" data-act="pod-unheard" data-id="' + p.id + '">' + (p.heard ? "標成還沒聽完" : "標成聽完了") + "</button>" +
      '<button class="btn ghost sm" data-act="pod-del" data-id="' + p.id + '" style="color:var(--danger)">刪除這一集</button></div>' : "") + "</section>";
  const parts = {};
  p.lines.forEach((l, i) => { (parts[l.p == null ? "end" : l.p] = parts[l.p == null ? "end" : l.p] || []).push([l, i]); });
  Object.keys(parts).forEach(k => {
    if (k === "end") return;
    html += '<section class="card lp-part' + (o.onlyEn ? " only-en" : "") + '"><div class="label">第 ' + (Number(k) + 1) + " 段</div>";
    parts[k].forEach(([l, i]) => {
      if (l.k === "pause" || (l.k === "cue" && l.cue !== "review")) return;
      if (l.k === "cue"){ html += '<div class="lp-review-h">單字回顧</div>'; return; }
      const tap = ready ? ' data-act="pod-seek" data-i="' + i + '"' : "";
      if (l.k === "intro"){ html += '<button class="lp-line zh intro"' + tap + ' data-i="' + i + '">' + esc(l.t) + "</button>"; return; }
      if (l.k === "en"){
        const name = l.who ? '<span class="lp-who ' + (l.who === "B" ? "b" : "a") + '">' + esc(cast[l.who] || l.who) + "</span>" : "";
        html += '<button class="lp-line en"' + tap + ' data-i="' + i + '">' + name + "<span>" + markWords(l.t, p) + "</span></button>"; return;
      }
      const info = p.words[l.w] || {};
      if (l.k === "word" && l.again) return;
      if (l.k === "spell"){ html += '<button class="lp-line sub en"' + tap + ' data-i="' + i + '"><span class="lp-tag">拼字</span><span class="lp-spell">' + esc(l.show || "") + "</span></button>"; return; }
      if (l.k === "word"){ html += '<button class="lp-line lp-word"' + tap + ' data-i="' + i + '"><span class="en">' + esc(info.en) + '</span><span class="w-ipa">' + esc(info.ipa || "") + '</span><span class="lp-zh">' + esc(info.zh || "") + "</span></button>"; return; }
      if (l.k === "replay"){ html += '<button class="lp-line en sub"' + tap + ' data-i="' + i + '"><span class="lp-tag">原句</span><span>' + markWords(l.t, p) + "</span></button>"; return; }
      if (l.k === "explain"){
        html += '<button class="lp-line sub' + (l.v === "zh" ? " zh" : " en") + '"' + tap + ' data-i="' + i + '"><span class="lp-tag">解釋</span><span>' + esc(l.t) +
          (l.zh ? '<span class="lp-zh block">' + esc(l.zh) + "</span>" : "") + "</span></button>"; return;
      }
      if (l.k === "example"){ html += '<button class="lp-line en sub"' + tap + ' data-i="' + i + '"><span class="lp-tag">例句' + (l.follow ? "・跟著說" : "") + "</span><span>" + markWords(l.t, p) + "</span></button>"; return; }
    });
    html += "</section>";
  });
  return html;
}
function podDockHTML(){
  const p = podOf(S.podOpen) || podOf(LP.id);
  if (!p || p.state !== "ready" || !p.times) return "";
  if (LP.id !== p.id && S.podOpen !== p.id) return "";
  const cur = LP.id === p.id && LP.au, a = cur ? LP.au : null, t = a ? a.currentTime : (p.pos || 0), dur = p.dur || 0;
  const rate = listenOpts().rate || 1;
  return '<div class="lp-player">' +
    (S.podOpen !== p.id ? '<button class="lp-title" data-act="pod-open" data-id="' + p.id + '"><b class="en">' + esc(p.title) + "</b></button>" : "") +
    '<div class="row lp-row"><input type="range" id="lp-seek" min="0" max="' + Math.max(1, Math.round(dur)) + '" step="1" value="' + Math.round(t) + '" aria-label="播放位置">' +
    '<span class="lp-tm" id="lp-tm">' + fmtT(t) + " / " + fmtT(dur) + "</span></div>" +
    '<div class="row lp-ctl"><button class="lp-rate" data-act="pod-rate">' + rate + "×</button>" +
    '<button class="icon-btn" data-act="pod-skip" data-d="-10" aria-label="倒退 10 秒">' + ICON.back10 + "</button>" +
    '<button class="lp-play" id="lp-btn" data-act="pod-play" data-id="' + p.id + '" aria-label="播放／暫停">' + (a && !a.paused ? ICON.pause : ICON.play) + "</button>" +
    '<button class="icon-btn" data-act="pod-skip" data-d="10" aria-label="快轉 10 秒">' + ICON.fwd10 + "</button>" +
    '<button class="lp-rate ghost" data-act="pod-part" data-d="1" aria-label="下一段">下一段</button></div>' +
    '<div class="tiny muted" id="lp-state" style="text-align:center"></div></div>';
}
function speedLabel(v){ v = Number(v) || 1; return v.toFixed(2).replace(/0$/, "") + "×"; }
function podNewHTML(){
  const o = listenOpts(), w = curWeek(), cands = podCandidates(o), words = podWords(o), plan = podPlan(o, words.length);
  const chk = (act, on, label, extra) => '<button class="pod-chk" role="checkbox" aria-checked="' + !!on + '" data-act="' + act + '"' + (extra || "") + '><span class="box" aria-hidden="true">' + (on ? ICON.check : "") + "</span><span>" + label + "</span></button>";
  const count = from => { const c = cands.filter(x => x.from === from); return c.length ? "（" + c.filter(x => x.on).length + "/" + c.length + "）" : "（0）"; };
  let html = '<div class="grab" aria-hidden="true"></div><div class="sh-head"><div class="sh-word phrase" style="flex:1;min-width:0">新的一集</div><button class="icon-btn" data-act="close-sheet" aria-label="關閉">×</button></div>' +
    '<div class="field"><label>類型（可複選）</label><div class="pod-chks">' + Object.keys(POD_TYPE).map(k => chk("pod-type", o.types.includes(k), POD_TYPE[k], ' data-v="' + k + '"')).join("") + "</div>" +
    "</div>" +
    '<div class="field"><div class="row between"><label>用哪些單字（可複選）</label><button class="btn ghost sm" data-act="pod-detail">' + (S.podDetail ? "收起" : "詳情") + "</button></div>" +
    '<div class="pod-chks col">' + chk("pod-src", o.srcs.includes("week"), (w ? "第 " + w.n + " 週單字" : "本週單字") + '<span class="muted small">' + count("week") + "</span>", ' data-v="week"') +
    chk("pod-src", o.srcs.includes("star"), "我的收藏" + '<span class="muted small">' + count("star") + "</span>", ' data-v="star"') +
    chk("pod-src", o.srcs.includes("custom"), "自己新增" + '<span class="muted small">' + count("custom") + "</span>", ' data-v="custom"') + "</div>";
  if (S.podDetail){
    html += '<div class="pod-detail">';
    ["week", "star", "custom"].forEach(from => {
      const list = cands.filter(x => x.from === from), off = !o.srcs.includes(from);
      html += '<div class="label" style="margin-top:6px">' + (from === "week" && w ? "第 " + w.n + " 週單字" : POD_SRC[from]) + "</div>";
      if (from === "custom"){
        html += '<div class="row pod-add"><input class="input" id="pod-cw-en" placeholder="英文單字或片語" maxlength="40" autocapitalize="off" spellcheck="false"><input class="input" id="pod-cw-zh" placeholder="中文（可不填）" maxlength="20"><button class="btn sm" data-act="pod-cw-add">新增</button></div>';
      }
      if (!list.length){ if (from !== "custom") html += '<div class="small muted">' + (from === "star" ? "還沒有收藏的單字" : "還沒有本週單字") + "</div>"; return; }
      html += '<div class="' + (off ? "pod-off" : "") + '">' + list.map(x => '<div class="pod-wrow">' + chk("pod-word", x.on, '<span class="w-en">' + esc(x.en) + '</span><span class="w-ipa">' + esc(x.ipa || "") + '</span><span class="w-zh">' + esc(x.zh || (from === "custom" ? "（AI 會補上中文）" : "")) + "</span>" +
        "", ' data-key="' + esc(x.key) + '"') +
        (from === "custom" ? '<button class="icon-btn" data-act="pod-cw-del" data-key="' + esc(x.key) + '" aria-label="移除">×</button>' : "") + "</div>").join("") + "</div>";
    });
    html += "</div>";
  }
  html += "</div>" +
    '<div class="field"><div class="row between"><label for="pod-mins">長度</label><b id="pod-mins-v">' + plan.mins + ' 分鐘</b></div>' +
    '<input type="range" id="pod-mins" min="5" max="30" step="1" value="' + plan.mins + '" aria-label="一集的長度（分鐘）">' +
    "</div>" +
    '<div class="field"><label>語言規則</label><div class="seg" role="group">' + Object.keys(POD_ZH).map(k => '<button data-act="pod-opt" data-k="zh" data-v="' + k + '" aria-pressed="' + (o.zh === k) + '">' + POD_ZH[k] + "</button>").join("") + "</div>" +
    "</div>" +
    '<div class="field"><div class="row between"><label for="pod-speed">英文語速</label><b id="pod-speed-v">' + speedLabel(o.speed) + "</b></div>" +
    '<input type="range" id="pod-speed" min="0.7" max="1.3" step="0.05" value="' + (Number(o.speed) || 1) + '" aria-label="英文語速">' +
    "</div>" +
    '<div class="pod-chks col">' + chk("pod-flag", o.follow, "例句後停 2 秒，讓我跟著說", ' data-k="follow"') +
    chk("pod-flag", o.spell, "拼出單字", ' data-k="spell"') + "</div>" +
    (S.err.pod ? '<div class="err">' + esc(S.err.pod) + "</div>" : "") +
    '<button class="btn block" data-act="pod-make"' + (S.busy.pod ? " disabled" : "") + ">" + (S.busy.pod ? '<span class="spinner"></span>寫稿中…' : "生成") + "</button>";
  return html;
}
function planText(plan, n){
  if (!n) return "先勾選單字，才能估算。";
  return "約 " + plan.parts + " 段，每段英文約 " + plan.enWords + " 字；單字回顧約 " + plan.reviewMin + " 分鐘" +
    (plan.short ? "。<b>時間有點短</b>：故事會很短，可以拉長時間或少選幾個單字。" : "。");
}
function saveListen(o){ set().listen = o; saveProfile(); }

/* 重畫面板但保留捲動位置和正在打的字 */
function podRedraw(){
  const card = $("#sheet-card"), top = card ? card.scrollTop : 0;
  const en = $("#pod-cw-en"), zh = $("#pod-cw-zh"), keep = en ? [en.value, zh ? zh.value : ""] : null;
  drawSheet();
  if (card) card.scrollTop = top;
  if (keep && document.activeElement !== en){ const a = $("#pod-cw-en"), b = $("#pod-cw-zh"); if (a) a.value = keep[0]; if (b) b.value = keep[1]; }
}

/* ---------- 按鈕 ---------- */
Object.assign(ACT, {
  "listen-open": () => { S.podOpen = null; go("listen"); pollPods(); },
  "pod-filter": el => { S.podFilter = el.dataset.f; render(); },
  "pod-new": () => { S.err.pod = ""; openSheet({kind:"podnew"}); },
  "pod-opt": el => { const o = listenOpts(); o[el.dataset.k] = el.dataset.v; saveListen(o); S.err.pod = ""; podRedraw(); },
  "pod-type": el => { const o = listenOpts(), v = el.dataset.v, set2 = new Set(o.types); set2.has(v) ? set2.delete(v) : set2.add(v); o.types = ["story", "dialog"].filter(t => set2.has(t)); saveListen(o); S.err.pod = ""; podRedraw(); },
  "pod-src": el => { const o = listenOpts(), v = el.dataset.v, set2 = new Set(o.srcs); set2.has(v) ? set2.delete(v) : set2.add(v); o.srcs = ["week", "star", "custom"].filter(t => set2.has(t)); saveListen(o); S.err.pod = ""; podRedraw(); },
  "pod-word": el => { const o = listenOpts(), k = el.dataset.key, c = podCandidates(o).find(x => x.key === k); if (!c) return; o.sel[k] = !c.on; if (!c.on && !o.srcs.includes(c.from)) o.srcs.push(c.from); saveListen(o); podRedraw(); },
  "pod-flag": el => { const o = listenOpts(); o[el.dataset.k] = !o[el.dataset.k]; saveListen(o); podRedraw(); },
  "pod-detail": () => { S.podDetail = !S.podDetail; podRedraw(); },
  "pod-cw-add": () => {
    const en = String(($("#pod-cw-en") || {}).value || "").replace(/\s+/g, " ").trim(), zh = String(($("#pod-cw-zh") || {}).value || "").trim();
    if (!/[a-z]/i.test(en)){ toast("請輸入英文單字或片語"); return; }
    const o = listenOpts(), k = en.toLowerCase();
    if (podCandidates(o).some(x => x.key === k)){ o.sel[k] = true; toast("「" + en + "」已經在清單裡，幫你勾起來了"); }
    else { o.custom = (o.custom || []).concat([{en, zh}]); o.sel[k] = true; }
    if (!o.srcs.includes("custom")) o.srcs.push("custom");
    $("#pod-cw-en").value = ""; if ($("#pod-cw-zh")) $("#pod-cw-zh").value = "";
    saveListen(o); podRedraw(); setTimeout(() => { const i = $("#pod-cw-en"); if (i) i.focus(); }, 30);
  },
  "pod-cw-del": el => { const o = listenOpts(), k = el.dataset.key; o.custom = (o.custom || []).filter(x => x.en.toLowerCase() !== k); delete o.sel[k]; saveListen(o); podRedraw(); },
  "pod-make": () => makePod(),
  "pod-open": el => {
    const p = podOf(el.dataset.id); if (!p || !p.lines) return;
    S.podOpen = p.id; S.podMenu = null; LP.cur = -1; render(); $("#main").scrollTop = 0;
    if (p.state === "ready" && LP.id !== p.id) LP.load(p);
    setTimeout(() => LP.tick(), 50);
  },
  "pod-close": () => { S.podOpen = null; S.podMenu = null; render(); },
  "pod-play": el => { const p = podOf(el.dataset.id); if (!p) return; if (LP.id !== p.id) LP.play(p); else LP.toggle(); },
  "pod-seek": el => { const p = podOf(S.podOpen); const i = Number(el.dataset.i); if (!p || !p.times || !p.times[i]) return; LP.userScroll = false; LP.play(p, p.times[i][0]); },
  "pod-skip": el => LP.skip(Number(el.dataset.d)),
  "pod-part": el => LP.part(Number(el.dataset.d)),
  "pod-rate": () => {
    const o = listenOpts(), list = [0.75, 0.85, 1, 1.15, 1.25, 1.5], i = list.indexOf(o.rate || 1);
    o.rate = list[(i + 1) % list.length]; saveListen(o);
    if (LP.au) LP.au.playbackRate = o.rate;
    const b = document.querySelector('[data-act="pod-rate"]'); if (b) b.textContent = o.rate + "×";
  },
  "pod-only-en": () => { const o = listenOpts(); o.onlyEn = !o.onlyEn; set().listen = o; saveProfile(); render(); LP.cur = -1; LP.tick(); },
  "pod-menu": el => { S.podMenu = S.podMenu === el.dataset.id ? null : el.dataset.id; render(); },
  "pod-unheard": el => { const p = podOf(el.dataset.id); if (!p) return; if (p.heard){ p.heard = false; savePod(p); } else markHeard(p); S.podMenu = null; render(); },
  "pod-resend": async el => {
    const p = podOf(el.dataset.id); if (!p || !p.lines) return;
    if (LP.id === p.id && LP.au){ LP.want = false; LP.au.pause(); LP.au.removeAttribute("src"); LP.id = ""; }
    p.ver = (p.ver || 1) + 1; p.times = null; p.dur = 0; S.podMenu = null;
    try { await sendPod(p); } catch (e) { p.state = "error"; p.err = e.message; savePod(p); render(); }
  },
  "pod-del": async el => {
    const p = podOf(el.dataset.id); if (!p) return;
    if (!(await confirmBox("刪除這一集？", "手機上的稿子會刪掉；電腦上的音檔會搬到 listen\\_removed 資料夾，要清空間時再自己刪。", "刪除", true))) return;
    if (LP.id === p.id && LP.au){ LP.want = false; LP.au.pause(); LP.au.removeAttribute("src"); LP.id = ""; }
    if (Cloud.voiceOk() && p.state !== "write") listenApi("/listen/remove", p.id, {}).catch(() => {});
    delete S.pods[p.id]; Store.del(p.id); S.podOpen = null; S.podMenu = null; render();
  }
});
document.addEventListener("change", e => {
  if (e.target.id === "pod-mins" || e.target.id === "pod-speed"){ const o = listenOpts(); o[e.target.id === "pod-mins" ? "mins" : "speed"] = Number(e.target.value); saveListen(o); }
  if (e.target.id === "lp-seek"){ LP.drag = false; LP.seekTo(Number(e.target.value)); }
});
document.addEventListener("input", e => {
  /* 拉長度、語速時只更新數字和估算，不重畫整個面板（不然拖不動） */
  if (e.target.id === "pod-mins" || e.target.id === "pod-speed"){
    const o = clone(listenOpts()); o[e.target.id === "pod-mins" ? "mins" : "speed"] = Number(e.target.value);
    const n = podWords(o).length, plan = podPlan(o, n);
    const mv = $("#pod-mins-v"), sv = $("#pod-speed-v"), pl = $("#pod-plan");
    if (mv) mv.textContent = plan.mins + " 分鐘"; if (sv) sv.textContent = speedLabel(o.speed); if (pl) pl.innerHTML = planText(plan, n);
  }
  if (e.target.id === "lp-seek"){ LP.drag = true; const tm = $("#lp-tm"), p = podOf(LP.id || S.podOpen); if (tm) tm.textContent = fmtT(e.target.value) + " / " + fmtT(p ? p.dur : 0); }
});
/* 自己往上捲逐字稿時，先不要自動捲回目前那一行；10 秒後恢復 */
document.addEventListener("touchmove", () => { if (S.view === "listen" && S.podOpen){ LP.userScroll = true; clearTimeout(LP.us); LP.us = setTimeout(() => { LP.userScroll = false; }, 10000); } }, {passive:true});
document.addEventListener("wheel", () => { if (S.view === "listen" && S.podOpen){ LP.userScroll = true; clearTimeout(LP.us); LP.us = setTimeout(() => { LP.userScroll = false; }, 10000); } }, {passive:true});
window.addEventListener("pagehide", () => LP.savePos());
document.addEventListener("visibilitychange", () => { if (document.hidden) LP.savePos(); else if (podList().some(p => p.state === "make")) pollPods(); });
document.addEventListener("keydown", e => {
  if (e.key === "Enter" && !e.isComposing && (e.target.id === "pod-cw-en" || e.target.id === "pod-cw-zh")){ e.preventDefault(); ACT["pod-cw-add"](); }
});
