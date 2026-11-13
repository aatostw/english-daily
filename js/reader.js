/* ---------- reader ---------- */
function openReader(r){
  S.reader = r; TTS.stop();
  const el = $("#reader"); el.hidden = false;
  drawReader(true);
}
/* After an article is made (or opened): prepare its sentences first, then all its words.
   A new article shows a progress screen for 5-10 seconds while the first sentences are made. */
function prepareArticleVoice(isNew){
  const r = S.reader, ctx = S.ctx.reader || {}; if (!r || !TTS.pocketOn()) return;   /* the device voice needs no preparing */
  const w = S.weeks[r.week];
  TTS.prefetchAll(ctx.paras);
  const sents = TTS.pcOn() ? [] : (ctx.sentences || []).filter(Boolean);
  const kw = (w ? w.words : []).concat(r.extra || [], r.news && r.art.words || []).map(x => x && x.en).filter(Boolean);
  const saved = Object.values(S.bank || {}).map(x => x && x.en).filter(Boolean).map(x => x.toLowerCase());
  const words = [];
  (ctx.paras || []).forEach(p => (String(p).match(/[A-Za-z][A-Za-z'’-]*/g) || []).forEach(x => {
    const lw = x.replace(/’/g, "'").toLowerCase();
    if (saved.includes(lw) || (lw.length > 2 && !COMMON_WORDS.has(lw))) words.push(lw);
  }));
  TTS.batchStart(sents, kw.concat(words).slice(0, 200));
  if (isNew) showPrepOverlay();
}
function showPrepOverlay(){
  const rd = $("#reader"); if (!rd || !TTS.batchInfo) return;
  const old = $("#prep-ov"); if (old) old.remove();
  const ov = document.createElement("div");
  ov.id = "prep-ov"; ov.className = "prep-ov";
  ov.innerHTML = '<div class="prep-card"><div class="prep-t">正在準備語音</div><div class="bar"><span></span></div>' +
    '<div class="row between small muted"><span class="prep-s"></span><span class="prep-w"></span></div>' +
    '<div class="small muted">先把句子做好，按播放就不用等。單字會在背景繼續準備。</div>' +
    '<button class="btn soft block" data-act="prep-skip">先開始讀</button></div>';
  rd.appendChild(ov); TTS.batchShow();
  const t0 = Date.now();
  const tick = () => {
    const el = $("#prep-ov"); if (!el) return;
    const b = TTS.batchInfo, ms = Date.now() - t0, sentsDone = !b || b.doneS.size >= b.sents.size;
    if (ms >= 10000 || (ms >= 5000 && sentsDone)) el.remove(); else setTimeout(tick, 250);
  };
  setTimeout(tick, 250);
}
function closeReader(){
  if (S.reader && S.reader.ctl){ try { S.reader.ctl.abort(); } catch (e) {} }
  TTS.stop(); S.reader = null; TTS.batchInfo = null;
  const el = $("#reader"); el.hidden = true; el.innerHTML = "";
  render();
}
function readerShell(){
  return '<div class="reader-top"><button class="back-btn" data-act="close-reader" aria-label="返回">' + GATE_ICON.back + '</button><div class="ttl" id="rd-ttl"></div>' +
    '<button class="icon-btn" id="rd-play" data-act="read-all" aria-label="朗讀全文">' + ICON.play + "</button>" +
    '<button class="icon-btn" data-act="font-cycle" aria-label="字體大小">' + ICON.font + "</button>" +
    '<button class="icon-btn" id="rd-del" data-act="del-art" aria-label="刪除這篇文章" hidden>' + ICON.trash + "</button></div>" +
    '<div class="reader-body" id="rd-body"></div>';
}
function drawReader(first){
  const r = S.reader; if (!r) return;
  const el = $("#reader");
  if (first || !$("#rd-body")) el.innerHTML = readerShell();
  const del = $("#rd-del"); if (del) del.hidden = !!r.news || r.state !== "ready" || !r.art;
  if (r.news){
    $("#rd-ttl").textContent = "每日新聞";
    $("#rd-body").innerHTML = newsReaderHTML(r.art);
    if (TTS.batchInfo) TTS.batchShow();
    return;
  }
  const w = S.weeks[r.week];
  const a = r.art;
  const streaming = r.state === "stream";
  const parsed = streaming ? parseRaw(r.raw || "") : a;
  $("#rd-ttl").textContent = (DAY_NAMES[r.day] || "") + " · " + genreLabel(r);
  const L = LENGTHS[set().length] || LENGTHS.mid;
  let html = '<div class="meta"><span class="chip">第 ' + w.n + " 週 · " + DAY_NAMES[r.day] + '</span><span class="chip">' + genreLabel(r) + '</span><span class="chip">約 ' + L.min + ' 分鐘</span><span class="chip" id="rd-voice" hidden></span></div>';
  if (parsed && parsed.title) html += '<div class="reader-title">' + esc(parsed.title) + "</div>" + (parsed.title_zh ? '<div class="reader-title-zh">' + esc(parsed.title_zh) + "</div>" : "");
  html += '<div class="legend"><span><i style="background:var(--yellow)"></i>本週單字</span><span><i style="background:var(--green)"></i>本週句型</span><span>點任何一個字看解釋</span></div>';
  if (streaming){
    if (parsed.body) html += renderBody(parsed.body, "reader", {words:w.words.concat(r.extra || []), pats:weekPats(w), cursor:true});
    else html += '<div class="writing"><span class="spinner"></span>' + (r.raw ? "正在寫…" : "正在構思今天的文章，大約需要 20–60 秒…") + "</div>";
    html += '<button class="btn soft" data-act="stop-gen">停止</button>';
  } else if (r.state === "error"){
    html += '<div class="err">' + esc(r.err) + '</div><button class="btn" data-act="retry-gen">再試一次</button>';
  } else {
    html += renderBody(a.body, "reader", {words:w.words.concat(a.extraWords || []), pats:weekPats(w)});
    html += practiceHTML(a, w);
    html += a.read
      ? '<div class="row"><span class="chip done">讀完了</span><span class="small" style="opacity:.7">明天再唸一次，記得更牢。</span></div>'
      : '<button class="btn green block" data-act="mark-read">我讀完也唸完了</button>';
  }
  const body = $("#rd-body");
  const atBottom = body.scrollTop + body.clientHeight >= body.scrollHeight - 40;
  body.innerHTML = html;
  if (TTS.total && TTS.pcOn() && r.state === "ready") TTS.showPrep();
  if (TTS.batchInfo && r.state === "ready") TTS.batchShow();
  if (streaming && atBottom && r.raw) body.scrollTop = body.scrollHeight;
}
function practiceHTML(a, w){
  const P = weekPats(w), p = P[a.practice_pattern] || P.A;
  const fb = a.feedback, busy = S.busy.practice;
  let html = '<section class="card"><div class="label">換你寫寫看</div><p style="margin:0">' + esc(a.practice_zh || "用今天的句型，寫一句關於你自己的英文。") + "</p>" +
    '<div class="pattern-card" style="padding:10px"><span class="' + (a.practice_pattern === "B" ? "tag-b" : "tag-a") + '">' + (a.practice_pattern || "A") + '</span><div><div class="en">' + esc(p.en) + '</div><div class="small muted">' + esc(p.zh) + "</div></div></div>" +
    '<textarea class="input" id="pr-input" rows="3" placeholder="用英文寫一句…（也可以用鍵盤的麥克風說）" aria-label="你的句子">' + esc(a.answer || "") + "</textarea>" +
    '<button class="btn" data-act="practice"' + (busy ? " disabled" : "") + ">" + (busy ? '<span class="spinner"></span>批改中' : fb ? "再批改一次" : "送出批改") + "</button>";
  if (S.err.practice) html += '<div class="err">' + esc(S.err.practice) + "</div>";
  if (fb){
    /* a small play button sits right after each sentence worth hearing: the fix, and the more natural version */
    const play = t => '<button class="icon-btn play-mini" data-act="say" data-text="' + esc(t) + '" aria-label="播放">' + ICON.play + "</button>" +
      '<button class="icon-btn play-mini mic" data-act="shadow" data-text="' + esc(t) + '" aria-label="跟讀評分">' + MIC_SVG + "</button>";
    const line = (cls, t, id) => '<span class="fix-line"><span class="' + cls + '">' + tapText(t, id) + "</span>" + play(t) + "</span>";
    const fixed = fb.corrected && fb.corrected.trim() !== (a.answer || "").trim();
    html += '<div class="fix">' + (fb.ok ? '<span class="to">寫得很好！</span>' : "") +
      (fixed ? '<span class="from">' + esc(a.answer) + "</span>" + line("to", fb.corrected, "fb1") : fb.ok && !fb.natural && a.answer ? line("to", a.answer, "fb1") : "") +
      (fb.notes_zh || []).map(n => '<span class="small">・' + esc(n) + "</span>").join("") +
      (fb.natural ? '<span class="small muted">更自然的說法：</span>' + line("en", fb.natural, "fb2") : "") + "</div>";
  }
  return html + "</section>";
}

/* ---------- word sheet ---------- */
const LOOKUP = new Map((() => { try { return Object.entries(JSON.parse(localStorage.getItem(LS + "lookup") || "{}")); } catch (e) { return []; } })());
function saveLookup(){ try { localStorage.setItem(LS + "lookup", JSON.stringify(Object.fromEntries([...LOOKUP].slice(-400)))); } catch (e) {} }
/* Open an outside page in a new browser tab, leaving this one where it is.
   (window.open with "noopener" always returns null, so it must not be used to detect a blocked pop-up.)
   In the installed app on Android, a link would open in a small viewer inside the app, so ask Chrome
   to open it as its own tab instead; only if Chrome never takes over, open it normally. */
function openExternal(url){
  const standalone = matchMedia("(display-mode: standalone)").matches || navigator.standalone;
  if (standalone && /Android/i.test(navigator.userAgent)){
    let left = false;
    const away = () => { left = true; };
    window.addEventListener("blur", away, {once:true});
    document.addEventListener("visibilitychange", away, {once:true});
    location.href = "googlechrome://navigate?url=" + encodeURIComponent(url);
    setTimeout(() => {
      window.removeEventListener("blur", away); document.removeEventListener("visibilitychange", away);
      if (!left && !document.hidden && document.hasFocus()) { const w = window.open(url, "_blank"); if (w) w.opener = null; }
    }, 2000);
    return;
  }
  const w = window.open(url, "_blank");
  if (w) w.opener = null;
}
function cambridge(w){ return "https://dictionary.cambridge.org/dictionary/english-chinese-traditional/" + encodeURIComponent(String(w).toLowerCase().trim().replace(/\s+/g, "-")); }
/* Google's translate box on the search page: unlike translate.google.com links, the Translate app
   doesn't take these over (it opened without the word), so the word is always filled in */
function gtrans(w){ return "https://www.google.com/search?hl=zh-TW&q=" + encodeURIComponent(String(w).trim() + " 中文翻譯"); }
function openSheet(o){
  S.sheet = o; S.sheetAt = performance.now();
  $("#sheet").hidden = false;
  drawSheet();
  if (o.state === "loading") lookupWord(o);
}
function tapText(text, id){
  S.ctx[id] = {sentences:[text], paras:[text], words:[], pats:{}};
  return '<span data-ctx="' + id + '">' + String(text).split(/([A-Za-z][A-Za-z'’-]*)/).map((t, i) => i % 2 ? '<span class="w" data-s="0">' + esc(t) + "</span>" : esc(t)).join("") + "</span>";
}
function phrasePrompt(text, sentence){
  return [
    "An English learner in Taiwan selected this part of a text and wants it explained.",
    'Selected: "' + text + '"',
    'Context: "' + sentence + '"',
    "Reply with only JSON. All Chinese in Traditional Chinese (Taiwan).",
    '{"zh":"<natural translation of the selected text>","in_context_zh":"<what it means here and any key grammar or phrase worth noticing, 1-2 short sentences>","example_en":"<a new simple sentence using the key phrase>","example_zh":"<its translation>"}'
  ].join("\n");
}
/* Selecting a passage (long-press / drag) opens an explanation of it. */
let selTimer = null, ptrDown = false;
function scheduleSel(){ clearTimeout(selTimer); selTimer = setTimeout(checkSelection, 700); }
document.addEventListener("pointerdown", () => { ptrDown = true; }, true);
["pointerup","touchend","pointercancel"].forEach(ev => document.addEventListener(ev, () => { ptrDown = false; scheduleSel(); }, true));
document.addEventListener("selectionchange", scheduleSel);
function checkSelection(){
  if (ptrDown) return;
  const sel = window.getSelection && window.getSelection();
  if (!sel || sel.isCollapsed) return;
  const text = sel.toString().replace(/\s+/g, " ").trim();
  if (text.length < 2 || text.length > 300 || !/[A-Za-z]/.test(text)) return;
  const n = sel.anchorNode, el = n && (n.nodeType === 1 ? n : n.parentElement);
  if (!el || el.closest("#sheet") || !el.closest("[data-ctx], .fix, .ex-box, .sent-box, .reader-title")) return;
  if (S.sheet && S.sheet.selText === text) return;
  const ctxEl = el.closest("[data-ctx]"), ctx = ctxEl && S.ctx[ctxEl.dataset.ctx];
  const wEl = el.closest(".w") || (ctxEl && ctxEl.querySelector(".w"));
  const sentence = (ctx && wEl && ctx.sentences[Number(wEl.dataset.s)]) || (el.closest(".fix, .ex-box, .sent-box, .para, .reader-title") || el).textContent.trim().slice(0, 400);
  const phrase = /\s/.test(text);
  openSheet({state:"loading", phrase, selText:text, sentence, pat:null, data:{word:text.replace(/^[^A-Za-z]+|[^A-Za-z]+$/g, ""), lemma:""}});
}
/* ---------- 跟讀評分：錄你唸的句子，送到電腦的 Whisper 聽寫並評分 ---------- */
const MIC_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3" fill="currentColor"/><path d="M6 11a6 6 0 0 0 12 0M12 17v3.5M8.5 20.5h7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
const REC = {mr:null, stream:null, chunks:[], timer:null, url:""};
function voiceBase(){ return Cloud.voiceOk() ? Cloud.url() + "/voice" : ""; }
function asrBase(){ return voiceBase(); }
function asrKey(){ return encodeURIComponent((Cloud.cfg && Cloud.cfg.token) || ""); }
/* what the voice route said, in words */
function voiceProblem(j){
  if (j.noVoice) return "管理員還沒幫你開通電腦語音。";
  if (j.noKey) return "管理員還沒設定電腦語音的密碼。";
  if (j.offline) return "連不到電腦，確認電腦開著、語音伺服器視窗也開著。";
  if (j.key === false) return "管理員設定的電腦語音密碼不對，請管理員到帳號管理更新。";
  return "";
}
/* the last score for each paragraph you read, kept on this phone */
function shadowKey(t){ return String(t || "").trim().toLowerCase().replace(/\s+/g, " ").slice(0, 300); }
function shadowAll(){ try { return JSON.parse(localStorage.getItem(LS + "shadow") || "{}"); } catch (e) { return {}; } }
function shadowSaved(t){ return shadowAll()[shadowKey(t)] || null; }
function shadowSave(t, res){
  const all = shadowAll(); all[shadowKey(t)] = Object.assign({}, res, {at:Date.now()});
  const keys = Object.keys(all).sort((a, b) => all[b].at - all[a].at); keys.slice(200).forEach(k => delete all[k]);
  try { localStorage.setItem(LS + "shadow", JSON.stringify(all)); Cloud.mark("shadow"); } catch (e) {}
  /* light up the paragraph's button right away */
  document.querySelectorAll("[data-act=shadow-para]").forEach(b => {
    const ctxEl = b.closest("[data-ctx]"), ctx = ctxEl && S.ctx[ctxEl.dataset.ctx];
    if (ctx && shadowKey(ctx.paras[Number(b.dataset.pi)]) === shadowKey(t)) b.classList.add("has");
  });
}
function openShadow(text, list){
  list = (list || [text]).map(t => String(t || "").trim()).filter(Boolean); if (!list.length) return;
  const saved = list.length === 1 ? shadowSaved(list[0]) : null;
  S.sheet = {kind:"shadow", list, i:0, text:list[0], scores:[], state:saved ? "done" : asrBase() ? "idle" : "nourl", res:saved}; S.sheetAt = performance.now();
  $("#sheet").hidden = false; drawSheet();
}
/* go through a whole article sentence by sentence */
function shadowGo(o, step){
  const i = o.i + step; if (i < 0 || i > o.list.length) return;
  o.i = i; o.res = null; o.err = "";
  if (i === o.list.length){ o.state = "summary"; drawSheet(); return; }
  o.text = o.list[i]; o.state = "idle"; drawSheet();
  TTS.speak(o.text);   /* hear it first, then read it back */
}
function shadowHTML(o){
  const many = o.list && o.list.length > 1;
  const head = '<div class="grab" aria-hidden="true"></div><div class="sh-head"><div class="sh-word phrase" style="flex:1;min-width:0">跟讀評分' +
    (many && o.state !== "summary" ? '<span class="shadow-count">第 ' + (o.i + 1) + " / " + o.list.length + " 句</span>" : "") + '</div><button class="icon-btn" data-act="close-sheet" aria-label="關閉">×</button></div>' +
    (many ? '<div class="shadow-prog"><b style="width:' + Math.round(Math.min(o.i, o.list.length) / o.list.length * 100) + '%"></b></div>' : "");
  if (o.state === "summary"){
    const done = o.scores.filter(x => x != null), avg = done.length ? Math.round(done.reduce((a, b) => a + b, 0) / done.length) : 0;
    const col = avg >= 85 ? "#3E9C7A" : avg >= 65 ? "#E0A21E" : "#D9534F";
    return head + '<div class="shadow-score" style="justify-content:center"><div class="ring" style="--c:' + col + ";--v:" + avg + '"><b>' + avg + '</b><span>平均</span></div>' +
      '<div class="small muted">整篇跟讀完成！<br>評了 ' + done.length + " / " + o.list.length + " 句" + (done.length ? "，最高 " + Math.max.apply(null, done) + " 分" : "") + "</div></div>" +
      '<div class="shadow-list">' + o.list.map((t, i) => '<button class="day-row" data-act="shadow-jump" data-i="' + i + '"><span class="t"><div class="en">' + esc(t) + '</div></span><span class="state ' + (o.scores[i] >= 80 ? "done" : "") + '">' + (o.scores[i] != null ? o.scores[i] + " 分" : "沒唸") + "</span></button>").join("") + "</div>" +
      '<button class="btn block" data-act="close-sheet">完成</button>';
  }
  const say = '<button class="icon-btn" data-act="say" data-text="' + esc(o.text) + '" aria-label="聽示範">' + ICON.speaker + "</button>";
  let target = esc(o.text);
  /* while recording or waiting, show the plain text so it is easy to read; the marked-up result only after scoring */
  if (o.res && o.res.diff && o.state === "done"){
    /* the sentence again, word by word: green = said right, red = heard as something else, grey = missed */
    target = o.res.diff.map(d => d.t === "ok" ? '<span class="sw ok' + (d.p < .55 ? " weak" : "") + '">' + esc(d.show || d.w) + "</span>"
      : d.t === "sub" ? '<span class="sw sub">' + esc(d.show || d.w) + "<small>聽成 " + esc(d.heard) + "</small></span>"
      : d.t === "miss" ? '<span class="sw miss">' + esc(d.show || d.w) + "<small>漏了</small></span>"
      : '<span class="sw extra">+' + esc(d.heard) + "</span>").join(" ");
  }
  let html = head + '<div class="shadow-target' + (o.text.length > 90 ? " long" : "") + '"><div class="en">' + target + "</div>" + say + "</div>";
  if (o.state === "nourl")
    return html + '<p class="muted" style="margin:0">跟讀評分要用電腦語音（Whisper 聽寫）。請管理員在帳號管理幫你開通。</p>';
  if (o.state === "rec")
    return html + '<button class="rec-btn on" data-act="shadow-stop" aria-label="停止錄音"><span class="rec-dot"></span></button><div class="rec-hint"><b id="rec-time">0.0</b> 秒・唸完按一下停止</div>';
  if (o.state === "up")
    return html + '<div class="rec-wait"><span class="spinner"></span>電腦正在聽…</div>';
  if (o.state === "err")
    html += '<div class="err">' + esc(o.err) + "</div>";
  if (o.state === "done" && o.res){
    const r = o.res, col = v => v >= 85 ? "#3E9C7A" : v >= 65 ? "#E0A21E" : "#D9534F";
    const bar = (label, v) => '<div class="sbar"><span>' + label + '</span><i><b style="width:' + Math.max(3, v) + "%;background:" + col(v) + '"></b></i><em>' + v + "</em></div>";
    const hints = [...new Set(r.diff.filter(d => d.hint).map(d => d.hint))];
    const notes = [];
    if (r.wpm) notes.push("語速每分鐘 " + r.wpm + " 字" + (r.wpm < 90 ? "，可以再順一點" : r.wpm > 210 ? "，稍微放慢會更清楚" : "，很自然"));
    (r.pauses || []).forEach(p => notes.push("在 <b>" + esc(p.after) + "</b> 和 <b>" + esc(p.before) + "</b> 之間停了 " + p.sec + " 秒"));
    if ((r.unclear || []).length) notes.push("唸得不太清楚：" + r.unclear.map(esc).join("、"));
    html += '<div class="shadow-score"><div class="ring" style="--c:' + col(r.score) + ";--v:" + r.score + '"><b>' + r.score + "</b><span>分</span></div>" +
      '<div class="sbars">' + bar("說對了", r.accuracy) + bar("流暢度", r.fluency) + bar("清楚度", r.clarity) + "</div></div>" +
      (hints.length ? '<div class="shadow-hints">' + hints.map(h => "<div><b>提示</b>　" + esc(h) + "</div>").join("") + "</div>" : "") +
      (notes.length ? '<div class="small muted">' + notes.join("<br>") + "</div>" : "") +
      '<div class="small muted">電腦聽到：<span class="en">' + esc(r.heard || "（沒聽到聲音）") + "</span></div>" +
      (REC.url ? '<button class="btn soft sm" data-act="shadow-mine" style="align-self:flex-start">聽我剛剛唸的</button>' : "");
  }
  const nav = many ? '<div class="row between shadow-nav"><button class="btn ghost sm" data-act="shadow-prev"' + (o.i ? "" : " disabled") + ">上一句</button>" +
    '<button class="btn ' + (o.state === "done" ? "" : "ghost ") + 'sm" data-act="shadow-next">' + (o.i === o.list.length - 1 ? "看總成績" : o.state === "done" ? "下一句" : "跳過") + "</button></div>" : "";
  return html + '<button class="rec-btn" data-act="shadow-start" aria-label="開始錄音">' + MIC_SVG + '</button><div class="rec-hint">' + (o.state === "done" ? "再唸一次" : "按一下開始唸，唸完再按一下") + "</div>" + nav;
}
async function shadowStart(){
  const o = S.sheet; if (!o || o.kind !== "shadow") return;
  TTS.stop && TTS.stop();
  try {
    REC.stream = await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true, noiseSuppression:true}});
  } catch (e) { o.state = "err"; o.err = "沒辦法用麥克風，請在瀏覽器允許麥克風權限。"; drawSheet(); return; }
  const type = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"].find(t => window.MediaRecorder && MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(t)) || "";
  try { REC.mr = new MediaRecorder(REC.stream, type ? {mimeType:type} : undefined); }
  catch (e) { shadowRelease(); o.state = "err"; o.err = "這個瀏覽器不能錄音。"; drawSheet(); return; }
  REC.chunks = [];
  REC.mr.ondataavailable = e => { if (e.data && e.data.size) REC.chunks.push(e.data); };
  REC.mr.onstop = () => shadowSend(o);
  REC.mr.start();
  o.state = "rec"; o.t0 = performance.now(); o.maxSec = Math.min(120, Math.max(30, o.text.split(/\s+/).length * 1.2)); drawSheet();
  clearInterval(REC.timer);
  REC.timer = setInterval(() => {
    const sec = (performance.now() - o.t0) / 1000, el = $("#rec-time"); if (el) el.textContent = sec.toFixed(1);
    if (sec >= o.maxSec) shadowStop();    /* about a second per word, plenty for one paragraph */
  }, 100);
}
function shadowStop(){ clearInterval(REC.timer); if (REC.mr && REC.mr.state === "recording") REC.mr.stop(); }
function shadowRelease(){ clearInterval(REC.timer); try { REC.stream && REC.stream.getTracks().forEach(t => t.stop()); } catch (e) {} REC.stream = null; REC.mr = null; }
async function shadowSend(o){
  const type = (REC.mr && REC.mr.mimeType) || "audio/webm";
  const blob = new Blob(REC.chunks, {type});
  shadowRelease();
  if (REC.url) URL.revokeObjectURL(REC.url);
  REC.url = URL.createObjectURL(blob);
  if (S.sheet !== o) return;
  if (blob.size < 1200){ o.state = "err"; o.err = "沒錄到聲音，再試一次。"; drawSheet(); return; }
  o.state = "up"; drawSheet();
  const ctl = new AbortController(), timeout = setTimeout(() => ctl.abort(), 60000);
  try {
    const r = await fetch(asrBase() + "/asr?k=" + asrKey() + "&target=" + encodeURIComponent(o.text), {method:"POST", body:blob, headers:{"Content-Type":type.split(";")[0]}, signal:ctl.signal});
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.ok) throw new Error(j.error || ("電腦回應錯誤（" + r.status + "）"));
    o.res = j; o.state = "done";
    shadowSave(o.text, j);
    if (o.scores) o.scores[o.i] = Math.max(o.scores[o.i] || 0, j.score || 0);
    if (typeof j.score === "number") logScore("sh", j.score);
    if (j.score >= 80) earnShadow(o.text);
  } catch (e) {
    o.state = "err";
    o.err = e.name === "AbortError" ? "電腦太久沒回應。" : String(e.message || e);
    if (/Failed to fetch|NetworkError|Load failed/i.test(String(e.message))) o.err = await asrDiagnose();
  } finally { clearTimeout(timeout); }
  if (S.sheet === o) drawSheet();
}
/* when sending the recording fails, ask the computer what's wrong so the message says what to do */
async function asrDiagnose(){
  try {
    const r = await fetch(asrBase() + "/ping?k=" + asrKey(), {cache:"no-store"}), j = await r.json();
    if (voiceProblem(j)) return voiceProblem(j);
    if (!j.asr) return "電腦連得到，但電腦上的語音伺服器是舊版，還不能評分。請關掉電腦上的語音伺服器視窗，重新雙擊「啟動語音伺服器.bat」，再把新網址貼過來。";
    if (j.asr === "loading") return "電腦的 Whisper 還在準備（第一次要下載模型，可能要幾分鐘），等一下再唸一次。";
    if (j.asr !== "ready") return "電腦的跟讀評分沒開啟（" + j.asr + "），看一下電腦上語音伺服器視窗的訊息。";
    return "錄音傳到電腦時斷掉了，再唸一次試試。";
  } catch (e) { return "連不到伺服器，確認網路正常。"; }
}
/* a little reward: 2 coins for every sentence read well (80+), up to 20 coins a day */
function earnShadow(text){
  const w = wallet(), t = todayStr();
  w.shadow = w.shadow && w.shadow.date === t ? w.shadow : {date:t, coins:0, done:[]};
  const key = text.toLowerCase().slice(0, 120);
  if (w.shadow.coins >= 20 || w.shadow.done.includes(key)) return;
  w.shadow.done.push(key); w.shadow.coins += 2;
  earn(2, "跟讀評分"); toast("唸得很好！+2 金幣");
}
function closeSheet(){
  if (S.sheet && S.sheet.kind === "shadow"){ shadowStop(); shadowRelease(); }
  try { if (S.sheet && S.sheet.selText) window.getSelection().removeAllRanges(); } catch (e) {}
  S.sheet = null; $("#sheet").hidden = true; $("#sheet-card").innerHTML = "";
  document.querySelectorAll(".w.picked").forEach(x => x.classList.remove("picked"));
  if (S.view === "city" && typeof City3D !== "undefined") City3D.draw();
}
function themeSheetHTML(){
  const need = themeNeed();
  if (!need) return '<div class="grab" aria-hidden="true"></div><p style="margin:0">這週已經有主題了。</p>';
  const A = PATTERNS[need.pair * 2], B = PATTERNS[need.pair * 2 + 1];
  return '<div class="grab" aria-hidden="true"></div><div class="label">第 ' + need.n + " 週</div><h2>想讀什麼主題？</h2>" +
    '<p class="muted small" style="margin:0">這週句型：<span class="en"><b>' + esc(A.en) + '</b></span>、<span class="en"><b>' + esc(B.en) + "</b></span>。主題決定這週的 6 個單字和文章內容。</p>" +
    (need.skip ? '<div class="note warn">上週的對話還沒做。選了新主題就會直接開始新的一週。</div>' : "") +
    themePickerHTML() +
    (S.err.week ? '<div class="err">' + esc(S.err.week) + "</div>" : "") +
    '<button class="btn block" data-act="start-week"' + (S.busy.week ? " disabled" : "") + ">" + (S.busy.week ? '<span class="spinner"></span>正在挑這週的單字…' : "開始第 " + need.n + " 週") + "</button>" +
    (aiMissing().length ? '<div class="note warn">還沒連接 AI。先到「設定 → AI 服務」貼上 API Key。</div>' : "");
}
function drawSheet(){
  const o = S.sheet; if (!o) return;
  $("#sheet-card").setAttribute("aria-label", o.kind === "theme" ? "選主題" : "單字解釋");
  if (o.kind === "theme"){ $("#sheet-card").innerHTML = themeSheetHTML(); return; }
  if (o.kind === "shadow"){ $("#sheet-card").setAttribute("aria-label", "跟讀評分"); $("#sheet-card").innerHTML = shadowHTML(o); return; }
  if (o.kind === "genpick"){ $("#sheet-card").setAttribute("aria-label", "再讀一篇"); $("#sheet-card").innerHTML = genPickHTML(o); return; }
  if (o.kind === "quiz"){ $("#sheet-card").setAttribute("aria-label", "月考"); $("#sheet-card").innerHTML = '<div class="sh-head"><div class="sh-word phrase" style="flex:1;min-width:0">月考</div>' + (S.quiz && S.quiz.done ? "" : '<button class="icon-btn" data-act="quiz-close" aria-label="離開">×</button>') + "</div>" + quizSheetHTML(); return; }
  if (o.kind === "admdetail"){ $("#sheet-card").setAttribute("aria-label", "詳細資訊"); $("#sheet-card").innerHTML = admDetailHTML(o); return; }
  if (o.kind === "city"){ $("#sheet-card").setAttribute("aria-label", "我的城市"); $("#sheet-card").innerHTML = citySheetHTML(o); const tc = $(".talk-chat"); if (tc) tc.scrollTop = tc.scrollHeight; return; }

  const d = o.data;
  const head = d.lemma || d.en || d.word;
  const starred = !!S.bank[slug(head)];
  let html = '<div class="grab" aria-hidden="true"></div>' +
    '<div class="sh-head"><div style="min-width:0"><div class="sh-word' + (o.phrase ? " phrase" : "") + '">' + esc(d.en || d.word) + "</div>" +
    '<div class="sh-ipa">' + (d.ipa ? esc(d.ipa) : (o.state === "loading" ? '<span class="skel" style="width:90px"></span>' : "")) + (d.pos ? '<span class="chip">' + esc(d.pos) + "</span>" : "") +
    (d.lemma && d.word && d.lemma.toLowerCase() !== d.word.toLowerCase() ? '<span class="small">原形：<span class="en">' + esc(d.lemma) + "</span></span>" : "") + "</div></div>" +
    '<div class="sh-say"><button class="icon-btn" data-act="say" data-text="' + esc(head) + '" aria-label="朗讀">' + ICON.speaker + '</button><button class="icon-btn mic" data-act="shadow" data-text="' + esc(head) + '" aria-label="跟讀評分">' + MIC_SVG + '</button></div></div>';
  if (o.state === "loading"){
    html += '<div class="stack"><div class="skel" style="width:70%"></div><div class="skel" style="width:45%"></div><div class="skel" style="width:85%"></div></div>';
  } else if (o.state === "error" || o.state === "noai"){
    html += '<div class="err">' + esc(o.err || aiErr({code:"no_ai"})) + "</div>" + (o.state === "error" ? '<button class="btn soft sm" data-act="lookup-retry">再查一次</button>' : "");
  } else {
    if (d.in_context_zh) html += '<div class="ctx-box"><span class="label">在這句的意思</span><b>' + esc(d.in_context_zh) + "</b></div>";
    if (d.zh) html += '<div class="sh-zh">' + esc(d.zh) + "</div>";
    if (d.note_zh) html += '<div class="small muted">' + esc(d.note_zh) + "</div>";
    if (d.example_en) html += '<div class="ex-box"><span class="en">' + esc(d.example_en) + ' <button class="btn ghost sm" style="padding:2px 6px;min-height:0;vertical-align:middle" data-act="say" data-text="' + esc(d.example_en) + '" aria-label="朗讀例句">' + ICON.speaker.replace("<svg", '<svg width="16" height="16"') + '</button></span><span class="zh">' + esc(d.example_zh) + "</span></div>";
  }
  if (o.pat) html += '<div class="pat-box"><span class="label">這裡用了句型</span><span class="en">' + esc(o.pat.en) + '</span><span class="small">' + esc(o.pat.zh) + "</span></div>";
  if (o.sentence){
    html += '<div class="sent-box"><span class="label">整句</span><span class="en">' + esc(o.sentence) + "</span>" +
      (d.sentence_zh ? '<span class="small">' + esc(d.sentence_zh) + "</span>" : (o.state === "ready" ? '<button class="btn ghost sm" style="align-self:flex-start;padding:4px 0" data-act="tr-sent"' + (o.trBusy ? " disabled" : "") + ">" + (o.trBusy ? "翻譯中…" : "翻譯整句") + "</button>" : "")) +
      '<div class="row" style="gap:14px"><button class="btn ghost sm" style="padding:4px 0" data-act="say" data-text="' + esc(o.sentence) + '">' + ICON.speaker.replace("<svg", '<svg width="16" height="16"') + "唸整句</button>" +
      '<button class="btn ghost sm" style="padding:4px 0" data-act="shadow" data-text="' + esc(o.sentence) + '">' + MIC_SVG.replace("<svg", '<svg width="16" height="16"') + "跟讀這句</button></div></div>";
  }
  html += '<div class="links"><a class="btn soft sm" href="' + cambridge(head) + '" target="_blank" rel="noopener" data-act="open-ext">劍橋字典 ↗</a><a class="btn soft sm" href="' + gtrans(head) + '" target="_blank" rel="noopener" data-act="open-ext">Google 翻譯 ↗</a>' +
    '<button class="icon-btn ' + (starred ? "on" : "") + '" data-act="star" aria-pressed="' + starred + '" aria-label="' + (starred ? "取消收藏" : "收藏") + '"' + (o.state === "loading" ? " disabled" : "") + ">" + (starred ? ICON.starOn : ICON.star) + "</button></div>";
  $("#sheet-card").innerHTML = html;
  /* Start making the audio now, so pressing play is instant: word first, then the sentences. */
  const says = [...document.querySelectorAll("#sheet-card [data-act=say]")].map(b => b.dataset.text).filter(Boolean);
  if (says.length) TTS.pocketPrefetch([...new Set(says)], true);
}
async function lookupWord(o){
  const key = o.data.word.toLowerCase() + "|" + (o.sentence || "");
  if (LOOKUP.has(key)){ o.data = Object.assign({}, o.data, LOOKUP.get(key)); o.state = "ready"; drawSheet(); return; }
  try {
    const r = await aiJson("lookup", o.phrase ? phrasePrompt(o.data.word, o.sentence || o.data.word) : lookupPrompt(o.data.word, o.sentence || o.data.word), {cache:{gcTime:86400000}});
    if (!r || typeof r !== "object") throw {code:"invalid_json"};
    const clean = {};
    ["lemma","ipa","pos","zh","in_context_zh","example_en","example_zh","sentence_zh"].forEach(k => { if (r[k]) clean[k] = String(r[k]); });
    LOOKUP.set(key, clean); saveLookup();
    if (S.sheet !== o) return;
    o.data = Object.assign({}, o.data, clean); o.state = "ready"; drawSheet();
  } catch (e) {
    if (S.sheet !== o) return;
    o.state = "error"; o.err = aiErr(e); drawSheet();
  }
}
function onWordTap(el){
  const ctxEl = el.closest("[data-ctx]"); if (!ctxEl) return;
  const ctx = S.ctx[ctxEl.dataset.ctx]; if (!ctx) return;
  const kwEl = el.closest(".kw");
  const wEl = el.classList.contains("w") ? el : el.querySelector(".w");
  const si = wEl ? Number(wEl.dataset.s) : -1;
  const sentence = ctx.sentences[si] || "";
  const ptEl = el.closest(".pt");
  const pat = ptEl ? ctx.pats[ptEl.dataset.p] || null : null;
  document.querySelectorAll(".w.picked").forEach(x => x.classList.remove("picked"));
  if (wEl && !kwEl) wEl.classList.add("picked");
  if (kwEl && kwEl.dataset.k !== "" && ctx.words[Number(kwEl.dataset.k)]){
    const info = ctx.words[Number(kwEl.dataset.k)];
    openSheet({state:"ready", sentence, pat, data:Object.assign({word:info.en, lemma:info.en}, info)});
  } else {
    const word = (wEl ? wEl.textContent : el.textContent).replace(/’/g, "'");
    openSheet({state:"loading", sentence, pat, data:{word, lemma:""}});
  }
}
