/* =========================================================
   聽學：用本週單字或收藏單字做成的 Podcast。
   AI 寫稿 → 電腦（GPT-SoVITS）唸成一整集 → 存在電腦，播放時串流過來。
   每一段：中文導讀 → 英文故事／對話 → 單字回顧（單字、原句重播、解釋、新例句、跟著說）。
   ========================================================= */
const POD_TYPE = {story:"故事", dialog:"對話情境"};
const POD_LEN = {short:{parts:2, label:"短", min:"約 8 分鐘"}, mid:{parts:3, label:"中", min:"約 12 分鐘"}, long:{parts:4, label:"長", min:"約 16 分鐘"}};
const POD_ZH = {more:"中文多", less:"中文少", none:"純英文"};
const NUM_ZH = ["一", "二", "三", "四", "五", "六"];
const NUM_EN = ["one", "two", "three", "four", "five", "six"];
ICON.headphones = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 15v-3a8 8 0 0 1 16 0v3"/><rect x="3" y="14" width="4.5" height="7" rx="1.8"/><rect x="16.5" y="14" width="4.5" height="7" rx="1.8"/></svg>';
ICON.pause = '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6.5" y="5" width="4" height="14" rx="1.2"/><rect x="13.5" y="5" width="4" height="14" rx="1.2"/></svg>';
ICON.back10 = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1"/><path d="M3 4v4.5h4.5"/><text x="12" y="15.6" text-anchor="middle" font-size="7.5" font-weight="700" fill="currentColor" stroke="none" font-family="Lexend,sans-serif">10</text></svg>';
ICON.fwd10 = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.5 12a8.5 8.5 0 1 1-2.6-6.1"/><path d="M21 4v4.5h-4.5"/><text x="12" y="15.6" text-anchor="middle" font-size="7.5" font-weight="700" fill="currentColor" stroke="none" font-family="Lexend,sans-serif">10</text></svg>';
ICON.plus = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>';
ICON.more = '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>';

function listenOpts(){
  const st = set();
  const o = Object.assign({type:"story", src:"week", len:"mid", zh:"more", follow:true, onlyEn:false, auto:true}, st.listen || {});
  if (!st.listen && S.profile){ st.listen = o; }
  return o;
}
function podList(){ return Object.values(S.pods || {}).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)); }
function podOf(id){ return (S.pods || {})[id] || null; }
function savePod(p){ S.pods[p.id] = p; return Store.set(p.id, p).catch(() => {}); }
function heardCount(word){ const h = S.log && S.log.m && S.log.m.h && S.log.m.h[String(word).toLowerCase()]; return h ? h.n : 0; }

/* ---------- 挑單字 ---------- */
function podWords(src){
  const norm = x => ({en:x.en, pos:x.pos || "", ipa:x.ipa || "", zh:x.zh || "", note_zh:x.note_zh || "", example_en:x.example_en || ""});
  const saved = Object.values(S.bank).filter(x => x && x.en)
    .sort((a, b) => (heardCount(a.en) - heardCount(b.en)) || ((b.addedAt || 0) - (a.addedAt || 0)));
  if (src === "star") return saved.slice(0, 8).map(x => Object.assign(norm(x), {saved:true}));
  const w = curWeek(); if (!w) return [];
  const mine = w.words.map(norm), have = new Set(mine.map(x => x.en.toLowerCase()));
  /* 本週單字，再加 2 個收藏單字（聽得最少、掌握度最低的先） */
  const extra = saved.filter(x => !have.has(x.en.toLowerCase()))
    .sort((a, b) => ({new:0, mid:1, ok:2}[mastery("w", a.en)] - {new:0, mid:1, ok:2}[mastery("w", b.en)]) || (heardCount(a.en) - heardCount(b.en)))
    .slice(0, 2).map(x => Object.assign(norm(x), {saved:true}));
  return mine.concat(extra);
}
/* 把單字分給每一段：8 個字 3 段 → 3、3、2 */
function splitWords(words, parts){
  const out = Array.from({length:parts}, () => []);
  words.forEach((w, i) => out[i % parts].push(w));
  return out;
}

/* ---------- 稿子 ---------- */
function podPrompt(o, groups, prev){
  const w = curWeek(), P = w && o.src === "week" ? weekPats(w) : null;
  const story = o.type === "story";
  return [
    "You write one episode of a listening podcast for " + learnerNoun(true) + ". The learner listens while working (hands busy), so it must be easy to follow by ear.",
    "Learner level: " + levelText(),
    aboutPrompt(),
    w && o.src === "week" ? "Week theme: " + w.theme_en + " (" + w.theme_zh + ")" : "Theme: everyday life in Taiwan; pick one concrete situation that fits the words.",
    story ? "Type: a short serial story told by ONE narrator, warm and concrete, with a small turn in every part. Characters may speak inside the narration with quotation marks."
          : "Type: a natural everyday conversation between two people, A and B, in one real-life situation (work, shopping, friends, family, travel). Give them first names. They take turns; each line is what one person says.",
    prev ? "This continues earlier episodes. Keep the same characters and continue the story from here: " + prev : "",
    P ? "Sentence patterns of the week; use each one naturally a few times: A: " + P.A.en + " (" + P.A.zh + "); B: " + P.B.en + " (" + P.B.zh + ")" : "",
    "",
    "The episode has " + groups.length + " parts. Each part: " + (story ? "about 170 English words, split into lines of one or two sentences." : "12 to 16 short lines.") ,
    "Target words for each part (use every word of a part at least twice inside that part, inflected forms are fine; they may appear again later):",
    groups.map((g, i) => "Part " + (i + 1) + ": " + g.map(x => x.en + " (" + x.zh + ")").join("; ")).join("\n"),
    "",
    "Spoken English only: it will be read aloud by a voice engine. No markup, no emoji, no lists, no stage directions, no parentheses. Write numbers as words.",
    "",
    "Reply with only JSON in this shape:",
    '{"title":"English title, at most 7 words","title_zh":"中文標題",' + (story ? "" : '"cast":{"A":"Mia","B":"Ken"},') + '"summary_zh":"這一集發生了什麼（1～2 句，下一集接著寫用）",' +
    '"parts":[{"intro_zh":"用 1～2 句中文說這一段在發生什麼事，不要翻譯全文，40 字以內","lines":[{"who":"' + (story ? "N" : "A") + '","en":"..."}],' +
    '"words":[{"word":"the target word exactly as given","line":0,"explain_zh":"1～2 句中文：它在這個情境的意思、怎麼用、常跟什麼搭配（句子裡可以直接寫英文單字）","explain_en":"one short, simple English explanation","example_en":"one new short everyday example, at most 12 words, not from the story"}]}]}',
    story ? 'who is always "N".' : 'who is "A" or "B".',
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
  const o = p.opts, out = [], zh = o.zh, story = p.type === "story";
  const add = (k, v, t, gap, extra) => { t = cleanSpoken(t); if (!t && k !== "pause") return; out.push(Object.assign({k, v, lang:v === "zh" ? "zh" : "en", t, gap}, extra || {})); };
  const voiceOf = who => (!story && String(who).toUpperCase() === "B") ? "b" : "a";
  (p.script.parts || []).forEach((part, pi) => {
    zh === "none" ? add("cue", "a", "Part " + (NUM_EN[pi] || pi + 1) + ".", 0.6, {p:pi, cue:"part"}) : add("cue", "zh", "第" + (NUM_ZH[pi] || pi + 1) + "段。", 0.5, {p:pi, cue:"part"});
    if (zh !== "none") add("intro", "zh", part.intro_zh, 0.9, {p:pi});
    const lines = (part.lines || []).filter(l => l && cleanSpoken(l.en));
    lines.forEach((l, li) => add("en", voiceOf(l.who), l.en, 0.45, {p:pi, li, who:story ? "" : String(l.who || "A").toUpperCase()}));
    const words = part.words || [];
    if (words.length) zh === "none" ? add("cue", "a", "Now, the words.", 0.8, {p:pi, cue:"review"}) : add("cue", "zh", "來複習這一段的單字。", 0.8, {p:pi, cue:"review"});
    words.forEach(wd => {
      const info = p.words.find(x => x.en.toLowerCase() === String(wd.word || "").toLowerCase()) || {en:wd.word, zh:""};
      const re = wordRe(info.en);
      let li = Number(wd.line);
      if (!(lines[li] && re && re.test(lines[li].en))) li = re ? lines.findIndex(l => re.test(l.en)) : -1;
      const wi = p.words.indexOf(info);
      add("word", "a", info.en + ". " + info.en + ".", 0.6, {p:pi, w:wi});
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
  const words = podWords(o.src);
  if (words.length < 2){ S.err.pod = o.src === "star" ? "收藏的單字太少了，至少要 2 個。讀文章時點單字、按星號就能收藏。" : "還沒有本週單字，先到首頁開始這一週。"; drawSheet(); return; }
  const parts = POD_LEN[o.len] ? POD_LEN[o.len].parts : 3;
  const groups = splitWords(words, parts);
  const w = curWeek();
  const prevs = podList().filter(x => x.type === "story" && o.type === "story" && x.src === o.src && (o.src !== "week" || (w && x.week === w.n)) && x.script && x.script.summary_zh).slice(0, 3).reverse();
  const prev = prevs.map(x => x.script.summary_zh).join(" ");
  const id = "pod-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 6);
  const p = {kind:"pod", id, type:o.type, src:o.src, week:o.src === "week" && w ? w.n : 0, opts:o, words, state:"write", createdAt:Date.now(), ver:1, pos:0, heard:false};
  S.busy.pod = true; S.err.pod = ""; closeSheet();
  S.pods[id] = p; render();
  try {
    const sc = await aiJson("write", podPrompt(o, groups, prev));
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
  await listenApi("/listen/new", p.id, {id:p.id, title:p.title, lines:p.lines.map(l => ({v:l.v, lang:l.lang, t:l.t, gap:l.gap}))});
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
  return '<span class="chip">' + (POD_TYPE[p.type] || "") + "</span>" +
    '<span class="chip">' + (p.src === "week" ? "第 " + p.week + " 週單字" : "我的收藏") + "</span>" +
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
  const f = S.podFilter || "week", w = curWeek(), all = podList();
  const list = all.filter(p => f === "done" ? p.heard : !p.heard && (f === "week" ? p.src === "week" : p.src === "star"));
  const today = (S.log && S.log.days && S.log.days[todayStr()] || {}).listen || 0;
  let html = '<section class="card"><div class="row between"><div class="row" style="gap:6px"><button class="icon-btn" data-act="tab" data-v="words" aria-label="回收藏">' + ICON.back + '</button><div><div class="label">聽學</div><b>' +
    (w ? "第 " + w.n + " 週 · " + esc(w.theme_zh) : "用單字做成的 Podcast") + "</b></div></div>" +
    '<button class="btn sm" data-act="pod-new">' + ICON.plus.replace("<svg", '<svg width="18" height="18"') + "新的一集</button></div>" +
    '<div class="seg" role="group" aria-label="篩選"><button data-act="pod-filter" data-f="week" aria-pressed="' + (f === "week") + '">本週</button><button data-act="pod-filter" data-f="star" aria-pressed="' + (f === "star") + '">我的收藏</button><button data-act="pod-filter" data-f="done" aria-pressed="' + (f === "done") + '">已聽完</button></div>' +
    (today >= 60 ? '<div class="small muted">今天聽了 ' + Math.round(today / 60) + " 分鐘</div>" : "") + "</section>";
  if (!Cloud.voiceOk()) html += '<div class="note warn">聽學要用電腦語音（GPT-SoVITS）唸稿和存音檔。請先到「設定 → 帳號」登入，並請管理員開通電腦語音。</div>';
  if (!list.length){
    html += '<section class="card flat"><p class="muted" style="margin:0">' + (f === "done" ? "還沒有聽完的集數。" :
      "還沒有集數。按右上「新的一集」，用" + (f === "week" ? "本週單字" : "收藏的單字") + "做一集故事或對話，搬貨、通勤時都能聽。") + "</p></section>";
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
  const o = listenOpts(), story = p.type === "story", cast = (p.script && p.script.cast) || {};
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
        const name = !story && l.who ? '<span class="lp-who ' + (l.who === "B" ? "b" : "a") + '">' + esc(cast[l.who] || l.who) + "</span>" : "";
        html += '<button class="lp-line en"' + tap + ' data-i="' + i + '">' + name + "<span>" + markWords(l.t, p) + "</span></button>"; return;
      }
      const info = p.words[l.w] || {};
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
  html += '<div class="tiny muted" style="text-align:center;padding:4px 0 8px">點任何一句，就從那裡開始播</div>';
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
function podNewHTML(){
  const o = listenOpts(), w = curWeek(), words = podWords(o.src);
  const seg = (key, opts) => '<div class="seg" role="group">' + Object.keys(opts).map(k => '<button data-act="pod-opt" data-k="' + key + '" data-v="' + k + '" aria-pressed="' + (o[key] === k) + '">' + opts[k] + "</button>").join("") + "</div>";
  return '<div class="grab" aria-hidden="true"></div><div class="sh-head"><div class="sh-word phrase" style="flex:1;min-width:0">新的一集</div><button class="icon-btn" data-act="close-sheet" aria-label="關閉">×</button></div>' +
    '<div class="field"><label>類型</label>' + seg("type", POD_TYPE) + "</div>" +
    '<div class="field"><label>用哪些單字</label>' + seg("src", {week:w ? "第 " + w.n + " 週單字" : "本週單字", star:"我的收藏"}) +
    '<div class="row wrap" style="gap:6px;margin-top:8px">' + (words.length ? words.map(x => '<span class="chip word">' + esc(x.en) + "</span>").join("") : '<span class="small muted">' + (o.src === "star" ? "還沒有收藏的單字" : "還沒有本週單字") + "</span>") + "</div>" +
    (o.src === "week" && words.some(x => x.saved) ? '<div class="tiny muted">另外加了 ' + words.filter(x => x.saved).length + " 個比較少聽到的收藏單字</div>" : "") + "</div>" +
    '<div class="field"><label>長度</label>' + seg("len", {short:"短・2 段", mid:"中・3 段", long:"長・4 段"}) + "</div>" +
    '<div class="field"><label>中文</label>' + seg("zh", POD_ZH) +
    '<div class="tiny muted" style="margin-top:6px">' + {more:"中文導讀＋中文解釋單字。", less:"中文導讀＋單字只說中文意思，解釋留在畫面上。", none:"全部英文，中文只出現在畫面上。"}[o.zh] + "</div></div>" +
    '<label class="row small" style="gap:10px"><input type="checkbox" data-act="pod-follow"' + (o.follow ? " checked" : "") + '> 例句後停 2 秒，讓我跟著說</label>' +
    (S.err.pod ? '<div class="err">' + esc(S.err.pod) + "</div>" : "") +
    '<button class="btn block" data-act="pod-make"' + (S.busy.pod ? " disabled" : "") + ">" + (S.busy.pod ? '<span class="spinner"></span>寫稿中…' : "生成") + "</button>" +
    '<div class="tiny muted">AI 寫好稿子後，電腦會用 GPT-SoVITS 唸成一整集（幾分鐘），做好就能聽。音檔存在電腦，播放時才載入。</div>';
}

/* ---------- 按鈕 ---------- */
Object.assign(ACT, {
  "listen-open": () => { S.podOpen = null; go("listen"); pollPods(); },
  "pod-filter": el => { S.podFilter = el.dataset.f; render(); },
  "pod-new": () => { S.err.pod = ""; openSheet({kind:"podnew"}); },
  "pod-opt": el => { const o = listenOpts(); o[el.dataset.k] = el.dataset.v; set().listen = o; saveProfile(); S.err.pod = ""; drawSheet(); },
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
    const o = listenOpts(), list = [0.85, 1, 1.15], i = list.indexOf(o.rate || 1);
    o.rate = list[(i + 1) % list.length]; set().listen = o; saveProfile();
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
  if (e.target.matches && e.target.matches('[data-act="pod-follow"]')){ const o = listenOpts(); o.follow = e.target.checked; set().listen = o; saveProfile(); }
  if (e.target.id === "lp-seek"){ LP.drag = false; LP.seekTo(Number(e.target.value)); }
});
document.addEventListener("input", e => {
  if (e.target.id === "lp-seek"){ LP.drag = true; const tm = $("#lp-tm"), p = podOf(LP.id || S.podOpen); if (tm) tm.textContent = fmtT(e.target.value) + " / " + fmtT(p ? p.dur : 0); }
});
/* 自己往上捲逐字稿時，先不要自動捲回目前那一行；10 秒後恢復 */
document.addEventListener("touchmove", () => { if (S.view === "listen" && S.podOpen){ LP.userScroll = true; clearTimeout(LP.us); LP.us = setTimeout(() => { LP.userScroll = false; }, 10000); } }, {passive:true});
document.addEventListener("wheel", () => { if (S.view === "listen" && S.podOpen){ LP.userScroll = true; clearTimeout(LP.us); LP.us = setTimeout(() => { LP.userScroll = false; }, 10000); } }, {passive:true});
window.addEventListener("pagehide", () => LP.savePos());
document.addEventListener("visibilitychange", () => { if (document.hidden) LP.savePos(); else if (podList().some(p => p.state === "make")) pollPods(); });
