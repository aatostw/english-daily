/* ---------- onboarding ---------- */
function themeChoices(){
  if (!S.pick){
    const used = new Set((S.profile && S.profile.usedThemes) || []);
    const pool = THEMES.filter(t => !used.has(t.zh));
    const src = pool.length >= 3 ? pool : THEMES;
    const picks = [];
    const copy = src.slice();
    /* one pick comes from the learner's interests, when they told us */
    const mine = interestThemes().filter(t => !used.has(t.zh));
    if (mine.length) picks.push(mine[Math.floor(Math.random() * mine.length)]);
    while (picks.length < 3 && copy.length) picks.push(copy.splice(Math.floor(Math.random() * copy.length), 1)[0]);
    S.pick = {themes:picks, sel:-1, custom:""};
  }
  return S.pick;
}
function themePickerHTML(){
  const pk = themeChoices();
  return '<div class="stack">' + pk.themes.map((t, i) =>
    '<button class="theme-btn" data-act="pick-theme" data-i="' + i + '" aria-pressed="' + (pk.sel === i) + '"><b>' + esc(t.zh) + '</b><span>' + esc(t.en) + "</span></button>").join("") +
    '<div class="row"><button class="btn ghost sm" data-act="shuffle-themes">換一組</button></div>' +
    '<div class="field"><label for="theme-custom">或自己輸入主題</label><input class="input" id="theme-custom" maxlength="40" placeholder="例如：準備去日本玩、跟主管談加薪" value="' + esc(pk.custom) + '"></div></div>';
}
function pickedTheme(){
  const pk = S.pick; if (!pk) return null;
  const c = ($("#theme-custom") && $("#theme-custom").value.trim()) || pk.custom.trim();
  if (c) return {zh:c, en:c};
  return pk.sel >= 0 ? pk.themes[pk.sel] : null;
}
const ONB_ABOUT = ["age", "gender", "interests"], ONB_LAST = 4;
function renderOnboarding(){
  const o = S.onb;
  const steps = '<div class="steps" aria-hidden="true">' + [0, 1, 2, 3, 4].map(i => '<i class="' + (o.step >= i ? "on" : "") + '"></i>').join("") + "</div>";
  if (o.step === 0){
    return steps +
      '<section class="card onb"><h1>每天幾分鐘，讀一篇、唸一遍</h1>' +
      "</section>" +
      '<section class="card"><div class="label">先試試看：點任何一個字</div>' +
        '<div class="legend small"><span><i style="background:var(--yellow)"></i>本週單字</span><span><i style="background:var(--green)"></i>本週句型</span></div>' +
        '<div style="background:var(--paper);color:var(--paper-ink);border:1px solid var(--line);border-radius:14px;padding:16px">' +
          '<div class="reader-title" style="font-size:22px">' + esc(SAMPLE.title) + '</div><div class="muted small" style="margin:2px 0 12px">' + esc(SAMPLE.title_zh) + "</div>" +
          renderBody(SAMPLE.body, "sample", {words:SAMPLE.words, pats:SAMPLE.pats}) +
        "</div></section>";
  }
  if (o.step === 1){
    return steps +
      '<section class="card onb"><h1>選擇你的排位</h1><p class="muted" style="margin:0">之後可以在「設定」隨時調整難度。</p></section>' +
      '<div class="stack">' + TIERS.map((t, i) => {
        const open = (S.onb.tierOpen == null ? (S.onb.tier || 0) : S.onb.tierOpen) === i;
        return '<button class="stage' + (open ? " open" : "") + '" data-act="pick-tier" data-i="' + i + '" aria-pressed="' + ((S.onb.tier || 0) === i) + '" aria-expanded="' + open + '">' +
          '<b>' + t.name + '</b><div class="small">' + t.desc + '</div>' +
          (open ? '<div class="ex">' + esc(t.ex) + '</div><div class="exzh">' + esc(t.exZh) + "</div>" : "") +
        "</button>";
      }).join("") + "</div>";
  }
  /* 關於我: age, gender, interests (each can be skipped) */
  const part = ONB_ABOUT[o.step - 2], h = ABOUT_STEPS[part][0];
  return steps +
    '<section class="card onb"><h1>' + h + "</h1></section>" +
    '<section class="card">' + aboutPartHTML(part) + "</section>";
}

/* ---------- today ---------- */

function heroHTML(w){
  const di = dayIdx(w), P = weekPats(w), st = STAGES[stageOf(w.patterns[0])];
  const dots = DAY_NAMES.map((n, d) => {
    const arts = artsOf(w.n, d);
    let cls = "dot";
    if (d === 6){ cls += " sun"; if (S.convs[w.n] && S.convs[w.n].done) cls += " read"; }
    else if (arts.some(a => a.read)) cls += " read";
    else if (arts.length) cls += " started";
    if (d === di) cls += " today";
    return '<div class="' + cls + '"><i>' + (cls.includes("read") ? "✓" : "") + "</i>" + n.slice(1) + "</div>";
  }).join("");
  return '<section class="card hero"><div class="label">第 ' + w.n + " 週 · " + st.name + " · " + md(w.monday) + "–" + md(addDays(w.monday, 6)) + "</div>" +
    "<h1>" + esc(w.theme_zh) + '</h1><div class="theme-en">' + esc(w.theme_en) + "</div>" +
    '<div class="dots">' + dots + "</div></section>";
}
function articleCardHTML(w, d){
  const arts = artsOf(w.n, d);
  const plan = DAY_PLAN[d];
  const busy = S.busy["gen-" + w.n + "-" + d];
  const plus = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>';
  let html = '<section class="card art-card"><div class="label">' + DAY_NAMES[d] + "的文章 · " + plan.label + "</div>";
  if (!arts.length){
    const g = genreFor(d, 0);
    html += '<div class="art-row"><div class="art-t"><span class="chip">' + GENRE[g] + "</span></div>" +
      '<button class="btn art-go" data-act="gen" data-n="' + w.n + '" data-d="' + d + '" data-k="0"' + (busy ? " disabled" : "") + ">" + (busy ? '<span class="spinner"></span>正在寫' : "產生文章") + "</button></div>";
  } else {
    arts.forEach((a, i) => {
      if (i > 0) html += '<div class="divider"></div>';
      html += '<div class="row wrap"><span class="chip">' + genreLabel(a) + "</span>" + (a.read ? '<span class="chip done">讀完了</span>' : "") + "</div>" +
        '<div class="art-row"><div class="art-t"><h2>' + esc(a.title) + '</h2><div class="zh">' + esc(a.title_zh) + "</div></div>" +
        '<button class="btn art-go' + (a.read ? " soft" : "") + '" data-act="open-art" data-id="' + artId(a) + '">' + (a.read ? "再讀一次" : "開始閱讀") + "</button></div>";
    });
    const k = arts.length;
    html += '<button class="art-more" data-act="gen-pick" data-n="' + w.n + '" data-d="' + d + '" data-k="' + k + '"' + (busy ? " disabled" : "") + ">" + (busy ? '<span class="spinner"></span>正在寫…' : plus + "再讀一篇") + "</button>";
  }
  if (S.err["gen-" + w.n + "-" + d]) html += '<div class="err">' + esc(S.err["gen-" + w.n + "-" + d]) + "</div>";
  return html + "</section>";
}
/* 再讀一篇: pick a kind of article, let chance pick, or ask for anything */
function genPickHTML(o){
  return '<div class="grab" aria-hidden="true"></div><div class="sh-head"><div class="sh-word phrase" style="flex:1;min-width:0">想讀哪一種？</div><button class="icon-btn" data-act="close-sheet" aria-label="關閉">×</button></div>' +
    '<div class="genre-grid">' + GENRE_PICK.map(g => '<button class="genre-btn" data-act="gen-go" data-g="' + g + '">' + GENRE[g] + "</button>").join("") +
    '<button class="genre-btn rand" data-act="gen-go" data-g="random">隨機</button></div>' +
    '<div class="field"><label for="gen-topic">自訂</label><div class="row"><input class="input" id="gen-topic" maxlength="80" placeholder="例如：關於貓咪的冒險、面試前的緊張"><button class="btn" data-act="gen-go" data-g="custom">寫這篇</button></div></div>';
}
function aiBannerHTML(){
  const miss = aiMissing();
  if (!miss.length) return "";
  return '<button class="banner alt" data-act="pref-open" data-p="ai"><span class="banner-ic" aria-hidden="true">' + ICON.key + '</span><span><b>還沒連接 AI</b><small>到設定貼上「' + miss.map(p => PROVIDERS[p].name).join("、") + '」的 API Key，才能產生文章。</small></span><span class="chev" aria-hidden="true">›</span></button>';
}
function themeNeed(){
  if (!S.profile) return null;
  const w = curWeek();
  if (!w) return {n:1, pair:S.profile.startPair % PAIRS, first:true};
  const conv = S.convs[w.n], di = dayIdx(w);
  const done = !!(conv && conv.done);
  if (done || di >= 6) return {n:w.n + 1, pair:(S.profile.startPair + w.n) % PAIRS, first:false, skip:!done, sunday:di === 6};
  return null;
}
function bannerHTML(need){
  if (!need) return "";
  const sub = need.first ? "選好後，App 會挑出這週的 6 個單字，開始每天的文章。"
    : need.sunday && need.skip ? "週日對話還沒做也可以先選。新的一週從明天開始，今天就能先讀第一篇。"
    : need.sunday ? "新的一週從明天開始，選好今天就能先讀第一篇。"
    : need.skip ? "上週的對話還沒做也可以先選，選了就開始新的一週。"
    : "這週完成了！選好主題，下一週就準備好了。";
  return '<button class="banner" data-act="open-theme"><span class="banner-ic" aria-hidden="true">' + ICON.flag + '</span><span><b>選第 ' + need.n + " 週的主題</b><small>" + sub + '</small></span><span class="chev" aria-hidden="true">›</span></button>';
}
function previewHTML(need){
  const A = PATTERNS[need.pair * 2], B = PATTERNS[need.pair * 2 + 1], st = STAGES[stageOf(need.pair * 2)];
  return '<section class="card"><div class="label">第 ' + need.n + " 週 · " + st.name + "｜" + st.title + "</div><h2>這週要學的句型</h2>" +
    patternCardHTML("A", A) + patternCardHTML("B", B) +
    '<p class="muted small" style="margin:0">選好主題後，週一到週六每天一篇短文，週日用這兩個句型和 6 個單字跟 AI 對話。</p></section>';
}
function dailyHistoryHTML(){
  const today = todayStr(), cw = curWeek(), rows = [];
  Object.values(S.weeks).forEach(w => {
    for (let d = 0; d < 6; d++){
      const date = addDays(w.monday, d);
      if (date >= today) continue;
      const arts = artsOf(w.n, d);
      if (arts.length) arts.forEach(a => rows.push({date, w, d, a}));
      else if (cw && w.n === cw.n) rows.push({date, w, d, a:null});
    }
  });
  if (!rows.length) return "";
  rows.sort((x, y) => x.date < y.date ? 1 : x.date > y.date ? -1 : ((x.a ? x.a.k : 0) - (y.a ? y.a.k : 0)));
  return '<section class="card"><div class="label">之前的文章</div><div class="stack">' + rows.map(r => {
    const a = r.a, sub = "第 " + r.w.n + " 週 · " + esc(r.w.theme_zh || "") + " · " + DAY_PLAN[r.d].label;
    return a
      ? '<button class="day-row" data-act="open-art" data-id="' + artId(a) + '"><span class="d"><b>' + DAY_NAMES[r.d] + "</b><span>" + md(r.date) + '</span></span><span class="t"><div class="en">' + esc(a.title) + '</div><div class="sub">' + sub + '</div></span><span class="status' + (a.read ? " read" : "") + '">' + (a.read ? "讀完了" : "未讀完") + "</span></button>"
      : '<button class="day-row" data-act="gen" data-n="' + r.w.n + '" data-d="' + r.d + '" data-k="0"><span class="d"><b>' + DAY_NAMES[r.d] + "</b><span>" + md(r.date) + '</span></span><span class="t"><div class="en">' + GENRE[genreFor(r.d, 0)] + '</div><div class="sub">' + sub + '</div></span><span class="status">' + (S.busy["gen-" + r.w.n + "-" + r.d] ? "產生中" : "點一下產生") + "</span></button>";
  }).join("") + "</div></section>";
}
function secTitle(t){ return '<h2 class="sec-title">' + t + "</h2>"; }
/* 首頁: tracker, Lisa, my city */
function renderHome(){
  if (Cloud.on() && NEWS.status === "idle") setTimeout(() => loadNews(), 0);
  const need = themeNeed(), w = curWeek();
  let html = aiBannerHTML() + aboutBannerHTML() + bannerHTML(need);
  if (!w) html += previewHTML(need);
  else {
    html += heroHTML(w);
    const di = dayIdx(w);
    html += secTitle("每日的文章");
    html += articleCardHTML(w, Math.max(0, Math.min(5, di)));   /* on Sunday, Saturday's set stays open for more reading */
  }
  html += quizCardHTML();
  if (Cloud.on()) html += secTitle("每日新聞") + newsCardHTML();
  return html + lisaCardHTML(w);
}
function chatChecklistHTML(w, conv, d){
  const rev = revealedFor(w, d), P = weekPats(w);
  const mine = conv ? conv.turns.filter(t => t.role === "user").map(t => t.content).join("\n").replace(/’/g, "'") : "";
  const hidW = w.words.length - rev.words.length, hidP = Object.keys(P).length - rev.pats.length;
  return '<div class="stack"><div class="row wrap">' + rev.pats.map(k => {
    let used = false; try { used = !!mine && new RegExp(P[k].re, "i").test(mine); } catch (e) {}
    return '<span class="chip pat' + (used ? " done" : "") + '">' + k + " · " + esc(P[k].en) + "</span>";
  }).join("") + '</div><div class="row wrap">' + rev.words.map(i => {
    const used = !!mine && wordUsed(mine, w.words[i].en);
    return '<button class="chip word' + (used ? " done" : "") + '" data-act="week-word" data-n="' + w.n + '" data-i="' + i + '">' + esc(w.words[i].en) + "</button>";
  }).join("") + (hidW + hidP ? '<span class="chip locked">還有 ' + (hidW ? hidW + " 個單字" : "") + (hidW && hidP ? "、" : "") + (hidP ? hidP + " 個句型" : "") + "之後揭開</span>" : "") + "</div></div>";
}
/* Lisa's portrait (lisa.jpg, a 256px crop of her illustration) */
const LISA_SVG = '<img src="lisa.jpg" alt="" width="96" height="96" decoding="async">';
function lisaHead(sub){
  if (talkBodyHTML.compact) return "";
  return '<div class="lisa-head"><span class="lisa-av" aria-hidden="true">' + LISA_SVG + '</span><div><b>與 Lisa 對話</b><div class="small muted">' + sub + "</div></div></div>";
}
function lisaCardHTML(w){
  if (!w) return '<section class="card">' + lisaHead("你的英文朋友") + '<p class="muted" style="margin:0">選好主題、開始第 1 週後，就能每天跟 Lisa 用英文聊天。</p></section>';
  const d = chatDayFor(w), conv = convFor(w, d), late = dayIdx(w) > 6;
  const sub = d >= 6 ? (late ? "第 " + w.n + " 週的總複習還沒做" : "今天是週日總複習") : DAY_NAMES[d] + "的聊天";
  const intro = d >= 6 ? "這週的單字和句型全部揭開了，聊完會有回饋和金幣。" : "用到今天為止揭開的單字和句型，跟 Lisa 聊聊。每天會再揭開新的，週日全部用上。";
  return '<section class="card">' + lisaHead(sub) + '<p class="muted" style="margin:0">' + intro + "</p>" +
    '<button class="btn green block" data-act="open-chat">' + (conv && conv.done ? "看回饋" : conv ? "繼續聊" : "開始聊天") + "</button></section>";
}
/* 學習進度: course progress, daily articles, what this week teaches */
function renderLearn(){
  const w = curWeek();
  if (!w){ const need = themeNeed(); return bannerHTML(need) + (need ? previewHTML(need) : ""); }
  const di = dayIdx(w), P = weekPats(w), ps = progressStats();
  const pos = Math.min((w.n - 1) + S.profile.startPair + 1, PAIRS);
  let html = secTitle("課程進度");
  html += '<section class="card"><div class="label">句型課程</div><div class="prog-row"><div class="progress"><span style="width:' + Math.round(pos / PAIRS * 100) + '%"></span></div><span class="prog-n"><b>' + pos + "</b> / " + PAIRS + "</span></div>" + '<div class="small muted">' + STAGES.map((st, i) => (i === stageOf(w.patterns[0]) ? "<b>" + st.name + "</b>" : st.name)).join(" → ") + "</div>" +
    '<div class="stats"><div><b>' + ps.streak + '</b><span>連續天數</span></div><div><b>' + ps.weeksDone + '</b><span>完成週數</span></div><div><b>' + ps.articlesRead + '</b><span>讀完篇數</span></div><div><b>' + ps.savedWords + '</b><span>收藏單字</span></div></div></section>';
  html += dailyHistoryHTML();
  html += secTitle("本週習得");
  html += '<section class="card"><div class="label">單字</div><div>' + w.words.map((x, i) =>
    '<button class="word-row" data-act="week-word" data-n="' + w.n + '" data-i="' + i + '"><span class="w-main"><span class="w-en">' + esc(x.en) + '</span><span class="w-ipa">' + esc(x.ipa) + '</span><div class="w-zh">' + esc(x.zh) + '</div></span><span class="icon-btn" data-act="say" data-text="' + esc(x.en) + '" role="button" aria-label="朗讀 ' + esc(x.en) + '">' + ICON.speaker + "</span></button>").join("") + "</div></section>";
  html += '<section class="card"><div class="label">句型</div>' + patternCardHTML("A", P.A) + patternCardHTML("B", P.B) +
    (w.review && w.review.length ? '<div class="label" style="margin-top:4px">複習句型（上週總複習沒用好的）</div>' + w.review.map((pid, i) => patternCardHTML("R" + (i + 1), PATTERNS[pid])).join("") : "") + "</section>";
  html += historyHTML();
  return html;
}

/* ---------- week ---------- */
/* Mark the fixed words of a pattern inside its example, e.g. "I want to" in "I want to speak English…". */
function markPattern(text, pattern, cls, isZh){
  const clean = t => t.replace(/[（(][^）)]*[）)]/g, "").replace(/^[\s.,!?，。！？、]+|[\s.,!?，。！？、]+$/g, "").trim();
  let parts = String(pattern).split(isZh ? /…|⋯|\.\.\.|___|，|,/ : /_+(?:ing)?/).map(clean).filter(t => t && t.toLowerCase() !== "ing");
  if (isZh) parts = parts.flatMap(t => t.split(/[／/]/)).map(clean).filter(Boolean);
  const low = text.toLowerCase(), ranges = [];
  parts.forEach(part => {
    let cand = part;
    for (;;){
      const c = cand.toLowerCase();
      let at = low.indexOf(c), hit = false;
      while (at >= 0){ ranges.push([at, at + c.length]); hit = true; at = low.indexOf(c, at + c.length); }
      if (hit) break;
      if (isZh){
        /* the example may word it a little differently: use the longest shared piece (2+ characters) */
        let best = "";
        for (let x = 0; x < part.length; x++) for (let y = part.length; y - x >= 2 && y - x > best.length; y--)
          if (low.indexOf(part.slice(x, y).toLowerCase()) >= 0){ best = part.slice(x, y); break; }
        if (best && best !== cand){ cand = best; continue; }
        break;
      }
      const words = cand.split(" ");          /* "It makes me feel" → "makes me feel" */
      if (words.length <= 2) break;
      cand = words.slice(1).join(" ");
    }
  });
  ranges.sort((a, b) => a[0] - b[0]);
  let out = "", pos = 0;
  ranges.forEach(([a, b]) => { if (a < pos) a = pos; if (b <= a) return; out += esc(text.slice(pos, a)) + '<b class="' + cls + '">' + esc(text.slice(a, b)) + "</b>"; pos = b; });
  return out + esc(text.slice(pos));
}
function patternCardHTML(tag, p){
  const cls = tag === "A" ? "tag-a" : tag === "B" ? "tag-b" : "tag-r";
  const hl = tag === "A" ? "hl-a" : tag === "B" ? "hl-b" : "hl-r";
  return '<div class="pattern-card"><span class="' + cls + '">' + tag + '</span><div class="stack" style="gap:4px"><div class="en">' + markPattern(p.ex, p.en, hl, false) + '</div><div class="zh-line">' + markPattern(p.exZh, p.zhKey || p.zh, hl, true) + "</div></div></div>";
}

/* ---------- talk ---------- */
function wordUsed(text, en){
  const toks = en.toLowerCase().split(/\s+/).map(t => t.replace(/[^a-z']/g, "")).filter(Boolean);
  if (!toks.length) return false;
  const stems = toks.map(t => t.length > 4 ? t.replace(/(ing|ed|es|e|s|y)$/, "") : t);
  const re = new RegExp("\\b" + stems.map(s => escRe(s) + "[a-z']*").join("\\s+(?:[a-z']+\\s+){0,2}"), "i");
  return re.test(text);
}
function feedbackHTML(w, conv, d){
  const f = conv.feedback; if (!f) return "";
  const rev = revealedFor(w, d == null ? 6 : d);
  const score = Math.max(1, Math.min(5, Number(f.score) || 3));
  const usedW = (f.words_used || []).map(Number).filter(i => w.words[i]);
  const missW = rev.words.filter(i => !usedW.includes(i));
  const P = weekPats(w);
  return '<section class="card"><div class="row between"><div class="label">' + (d != null && d < 6 ? "今天的回饋" : "這週的回饋") + '</div><div class="score" aria-label="' + score + ' 分（滿分 5）">' + [1,2,3,4,5].map(i => '<i class="' + (i <= score ? "on" : "") + '"></i>').join("") + "</div></div>" +
    '<p style="margin:0">' + esc(f.summary_zh) + "</p>" +
    '<div class="stack"><div class="small"><b>用到的單字</b></div><div class="row wrap">' + (usedW.length ? usedW.map(i => '<span class="chip done">' + esc(w.words[i].en) + "</span>").join("") : '<span class="muted small">這次還沒用到</span>') + "</div>" +
    (missW.length ? '<div class="small"><b>下次試著用</b></div><div class="row wrap">' + missW.map(i => '<button class="chip word" data-act="week-word" data-n="' + w.n + '" data-i="' + i + '">' + esc(w.words[i].en) + "</button>").join("") + "</div>" : "") + "</div>" +
    ((f.patterns_weak || []).filter(k => P[k]).length ? '<div class="note warn">下週會在文章裡再複習：' + f.patterns_weak.filter(k => P[k]).map(k => '<span class="en"><b>' + esc(P[k].en) + "</b></span>").join("、") + "</div>" : "") +
    ((f.corrections || []).length ? '<div class="stack"><div class="small"><b>可以說得更好</b></div>' + f.corrections.slice(0, 5).map(c => '<div class="fix"><span class="from">' + esc(c.original) + '</span><span class="to">' + esc(c.better) + '</span><span class="small muted">' + esc(c.why_zh) + "</span></div>").join("") + "</div>" : "") +
    (f.try_next_zh ? '<div class="note">' + esc(f.try_next_zh) + "</div>" : "") + "</section>";
}
function renderTalk(){
  const from = S.talkFrom === "city" ? "city" : "home";
  return '<div class="back-row"><button class="back-btn" data-act="tab" data-v="' + from + '" aria-label="回到' + (from === "city" ? "我的城市" : "首頁") + '">' + GATE_ICON.back + "</button></div>" + talkBodyHTML(false);
}
function talkBodyHTML(compact){
  talkBodyHTML.compact = compact;
  try { return talkBodyInner(); } finally { talkBodyHTML.compact = false; }
}
function talkBodyInner(){
  const back = "";
  const {w, d, conv} = curChat();
  if (!w) return back + lisaCardHTML(null);
  let html = back;
  if (!conv){
    html += '<section class="card">' + lisaHead(d >= 6 ? "第 " + w.n + " 週 · 週日總複習" : "第 " + w.n + " 週 · " + DAY_NAMES[d]) +
      '<p class="muted" style="margin:0">' + (d >= 6
        ? "Lisa 會依照主題「" + esc(w.theme_zh) + "」設計一個情境。這週的單字和句型全部揭開了，盡量都用上。結束後一次給你回饋。"
        : "Lisa 會找一個跟「" + esc(w.theme_zh) + "」有關的小話題跟你聊。試著用上下面已經揭開的單字和句型，聊完會有回饋。") +
      "打字或用手機鍵盤的麥克風說英文都可以。</p>" + chatChecklistHTML(w, null, d) +
      (S.err.talk ? '<div class="err">' + esc(S.err.talk) + "</div>" : "") +
      '<button class="btn green block" data-act="talk-start"' + (S.busy.talk ? " disabled" : "") + ">" + (S.busy.talk ? '<span class="spinner"></span>Lisa 在想話題…' : "開始聊天") + "</button></section>";
    return html;
  }
  const sc = conv.scenario;
  html += '<section class="card">' + lisaHead((d >= 6 ? "週日總複習 · " : DAY_NAMES[d] + " · ") + esc(sc.title_zh)) +
    (d >= 6 ? '<p style="margin:0">' + esc(sc.situation_zh) + '</p><div class="small muted">你是：' + esc(sc.learner_role_zh) + "　Lisa：" + esc(sc.partner_role_zh) + "</div>" : "") +
    chatChecklistHTML(w, conv, d) + "</section>";
  html += '<div class="chat">' + conv.turns.map((t, i) => t.role === "assistant"
    ? '<div class="bubble them"><div class="who"><span><span class="lisa-mini">' + LISA_SVG + '</span>Lisa</span><button data-act="say-turn" data-i="' + i + '" aria-label="朗讀">' + ICON.speaker + "</button></div>" + tapText(t.content, "chat" + i) + "</div>"
    : '<div class="bubble me">' + tapText(t.content, "chat" + i) + "</div>").join("") +
    (S.busy.reply ? '<div class="bubble them" id="live-bubble"><div class="who"><span><span class="lisa-mini">' + LISA_SVG + '</span>Lisa</span></div>' + '<span id="live-text">' + (S.talk.live ? esc(S.talk.live) : "…") + "</span></div>" : "") + "</div>";
  if (S.err.talk) html += '<div class="err">' + esc(S.err.talk) + "</div>";
  if (conv.done){
    html += feedbackHTML(w, conv, d);
    if (d >= 6){
      if (S.profile.currentWeek === w.n) html += '<button class="btn block" data-act="open-theme">選第 ' + (w.n + 1) + " 週的主題</button>";
    }
  }
  return html;
}

function dockHTML(){
  if (!S.profile || !(S.view === "talk" || (S.view === "city" && S.cityChat))) return "";
  const conv = curChat().conv;
  if (!conv || conv.done) return "";
  const mineCount = conv.turns.filter(t => t.role === "user").length;
  const send = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.4 20.4 21 12 3.4 3.6l.1 6.5L15 12 3.5 13.9z" fill="currentColor"/></svg>';
  return (S.talk.warn ? '<div class="warn-box" role="alert"><span>' + esc(S.talk.warn) + '</span><button class="warn-x" data-act="talk-warn-x" aria-label="關閉提醒">×</button></div>' : "") +
    '<div class="row talk-row"><textarea class="input" id="talk-input" rows="1" placeholder="用英文回答…" aria-label="你的回答">' + esc(S.talk.draft || "") + '</textarea>' +
    '<button class="send-btn" data-act="talk-send" aria-label="送出"' + (S.busy.reply || S.busy.fb ? " disabled" : "") + ">" + send + "</button>" +
    '<button class="btn ghost sm settle-btn" data-act="talk-end"' + (S.busy.fb || S.busy.reply ? " disabled" : "") + ">" + (S.busy.fb ? '<span class="spinner"></span>結算中' : "結算") + "</button></div>";
}

/* ---------- words ---------- */
function renderWords(){
  const f = S.wordFilter;
  const starred = Object.values(S.bank).sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0));
  const weeks = Object.values(S.weeks).sort((a, b) => b.n - a.n);
  const total = weeks.reduce((s, w) => s + w.words.length, 0);
  let html = '<section class="card"><div class="row between"><div><div class="label">單字庫</div><b>' + total + " 個本週單字 · " + starred.length + ' 個收藏</b></div></div>' +
    '<div class="seg" role="group" aria-label="篩選"><button data-act="word-filter" data-f="all" aria-pressed="' + (f === "all") + '">每週單字</button><button data-act="word-filter" data-f="star" aria-pressed="' + (f === "star") + '">我的收藏</button></div></section>';
  const row = (x, data) => '<button class="word-row" ' + data + '><span class="w-main"><span class="w-en">' + (data.includes("week-word") ? '<i class="m-dot ' + mastery("w", x.en) + '" title="' + MASTERY[mastery("w", x.en)] + '"></i>' : "") + esc(x.en || x.lemma || x.word) + '</span><span class="w-ipa">' + esc(x.ipa || "") + '</span><div class="w-zh">' + esc(x.zh || "") + "</div></span>" + (S.bank[slug(x.en || x.lemma || x.word)] ? '<span class="star" aria-label="已收藏">' + ICON.starOn.replace("<svg", '<svg width="18" height="18"') + "</span>" : "") + '<span class="icon-btn" data-act="say" data-text="' + esc(x.en || x.lemma || x.word) + '" role="button" aria-label="朗讀">' + ICON.speaker + "</span></button>";
  if (f === "star"){
    html += '<section class="card">' + (starred.length ? "<div>" + starred.map(x => row(x, 'data-act="bank-word" data-id="' + esc(slug(x.en)) + '"')).join("") + "</div>" : '<p class="muted" style="margin:0">讀文章時點單字，再按星號，就會收進這裡。</p>') + "</section>";
    return html;
  }
  weeks.forEach(w => {
    html += '<section class="card"><div class="row between"><div class="label">第 ' + w.n + " 週 · " + esc(w.theme_zh) + '</div><span class="small muted">' + md(w.monday) + "</span></div><div>" + w.words.map((x, i) => row(x, 'data-act="week-word" data-n="' + w.n + '" data-i="' + i + '"')).join("") + "</div></section>";
  });
  return html;
}
