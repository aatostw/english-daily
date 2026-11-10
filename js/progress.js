/* =========================================================
   學習歷程: is the learner actually getting better?
   Weekly timeline, three trend lines, how well patterns/words are kept,
   and an estimate of when the stage (and the next town goal) is reached.
   Data: S.log.days[date].{pr, sh, tk} = [sum, count], S.log.m.{p, w} (see rewards.js),
   plus the weeks, articles and chats that were always saved.
   ========================================================= */

/* the dates (Mon..Sun) of a week */
function weekDates(w){ return [0, 1, 2, 3, 4, 5, 6].map(i => addDays(w.monday, i)); }
function sumDays(w, field){
  const days = (S.log && S.log.days) || {};
  return weekDates(w).reduce((t, d) => { const v = days[d] && days[d][field]; return v ? [t[0] + v[0], t[1] + v[1]] : t; }, [0, 0]);
}
/* one week's numbers; older weeks fall back to what the articles and chats saved */
function weekStats(w){
  const arts = artsOf(w.n), practiced = arts.filter(a => a.practicedAt);
  let pr = sumDays(w, "pr");
  if (!pr[1] && practiced.length) pr = [practiced.filter(a => a.feedback && a.feedback.ok).length, practiced.length];
  let tk = sumDays(w, "tk");
  if (!tk[1]){
    const scores = [0, 1, 2, 3, 4, 5, 6].map(d => convFor(w, d)).filter(c => c && c.feedback).map(c => Number(c.feedback.score) || 0).filter(Boolean);
    if (scores.length) tk = [scores.reduce((a, b) => a + b, 0), scores.length];
  }
  const sh = sumDays(w, "sh"), sun = S.convs[w.n];
  return {
    read:arts.filter(a => a.read).length,
    practiced:practiced.length, right:practiced.filter(a => a.feedback && a.feedback.ok).length,
    pr:pr[1] ? Math.round(pr[0] / pr[1] * 100) : null,          /* % right */
    sh:sh[1] ? Math.round(sh[0] / sh[1]) : null,                 /* 0-100 */
    tk:tk[1] ? Math.round(tk[0] / tk[1] * 20) : null,            /* 1-5 → 20-100 */
    sunday:sun && sun.feedback ? Number(sun.feedback.score) || null : null,
    weak:sun && sun.weakPids ? sun.weakPids : []
  };
}
/* how well a pattern / word is kept: "ok" green, "mid" yellow, "new" grey */
function mastery(kind, id){
  const x = S.log && S.log.m && S.log.m[kind] && S.log.m[kind][String(id).toLowerCase()];
  if (!x || !x.n) return "new";
  return x.n >= 2 && x.ok / x.n >= 0.67 ? "ok" : "mid";
}
const MASTERY = {ok:"熟練", mid:"還在練", new:"很少用到"};

/* a small line chart: one point per week, 0-100 */
function sparkSVG(vals){
  const pts = vals.map((v, i) => v == null ? null : [i, v]).filter(Boolean);
  if (pts.length < 2) return "";
  const W = 220, H = 56, n = vals.length - 1 || 1, x = i => 6 + i / n * (W - 12), y = v => H - 6 - v / 100 * (H - 12);
  const d = pts.map((p, i) => (i ? "L" : "M") + x(p[0]).toFixed(1) + " " + y(p[1]).toFixed(1)).join(" ");
  const last = pts[pts.length - 1];
  return '<svg class="spark" viewBox="0 0 ' + W + " " + H + '" preserveAspectRatio="none" aria-hidden="true"><path d="M6 ' + (H - 6) + "H" + (W - 6) + '" stroke="var(--line)" stroke-width="1"/>' +
    '<path d="' + d + '" fill="none" stroke="var(--primary)" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<circle cx="' + x(last[0]).toFixed(1) + '" cy="' + y(last[1]).toFixed(1) + '" r="4" fill="var(--primary)"/></svg>';
}
function trendLine(label, vals, unit){
  const have = vals.filter(v => v != null);
  const now = have.length ? have[have.length - 1] : null;
  let note = "再學一週就能看到趨勢";
  if (have.length >= 2){
    const back = have[Math.max(0, have.length - 5)], diff = now - back, weeksBack = Math.min(4, have.length - 1);
    note = diff > 2 ? "比 " + weeksBack + " 週前高 " + diff + unit : diff < -2 ? "比 " + weeksBack + " 週前低 " + (-diff) + unit + "，多練習幾次" : "和 " + weeksBack + " 週前差不多";
  }
  return '<div class="trend"><div class="trend-h"><b>' + label + '</b><span class="trend-v">' + (now == null ? "—" : now + unit) + "</span></div>" + sparkSVG(vals) +
    '<div class="small muted">' + note + "</div></div>";
}

/* when will the current stage be finished, and the next town goal reached? */
function progressEstimate(){
  const weeks = Object.values(S.weeks).sort((a, b) => a.n - b.n);
  if (weeks.length < 2) return null;
  const first = weeks[0].monday, daysIn = Math.max(7, diffDays(first, todayStr()) + 1);
  const done = Object.values(S.convs).filter(c => c.done).length;
  const pace = done / (daysIn / 7);                       /* weeks finished per calendar week */
  const pos = Math.min((curWeek() ? curWeek().n - 1 : 0) + S.profile.startPair + 1, PAIRS);
  const stage = Math.min(STAGES.length - 1, Math.floor((pos - 1) / 5)), left = (stage + 1) * 5 - pos + 1;
  const out = {};
  if (pace >= 0.3) out.stage = {name:STAGES[stage].name + "：" + STAGES[stage].title, date:addDays(todayStr(), Math.round(left / pace * 7)), left};
  else out.tip = "每週完成一次週日總複習，就能看到預估的完成日期。";
  /* knowledge per day, over the time the town has existed */
  const k = knowledge(), goal = nextKnowGoal();
  if (goal && k > 0){
    const perDay = k / daysIn;
    if (perDay > 0) out.know = {name:goal.name, at:goal.at, date:addDays(todayStr(), Math.ceil((goal.at - k) / perDay))};
  }
  return out;
}
/* the next knowledge goal: what the city center needs for its next evolution */
function nextKnowGoal(){
  const c = city(), k = knowledge();
  for (let t = hallTier(c) + 1; t <= HALL_TIERS.length; t++) if (EVOLVE[t].know > k) return {at:EVOLVE[t].know, name:"市中心進化成「" + HALL_TIERS[t - 1] + "」"};
  return null;
}

function historyHTML(){
  const weeks = Object.values(S.weeks).sort((a, b) => b.n - a.n);
  if (!weeks.length) return "";
  let html = secTitle("學習歷程");

  /* 1. timeline */
  html += '<section class="card"><div class="label">每週紀錄</div><div class="tl">' + weeks.map(w => {
    const s = weekStats(w), P = [PATTERNS[w.patterns[0]], PATTERNS[w.patterns[1]]];
    const stars = s.sunday ? "★".repeat(s.sunday) + "☆".repeat(5 - s.sunday) : "";
    return '<details class="tl-row"><summary><span class="tl-n">' + w.n + '</span><span class="tl-main"><b>' + esc(w.theme_zh) + '</b><span class="small muted">' + esc(P.map(p => p.en).join("・")) + "</span></span>" +
      (stars ? '<span class="tl-star" aria-label="週日 ' + s.sunday + ' 分">' + stars + "</span>" : '<span class="small muted">' + (w === curWeek() ? "進行中" : "") + "</span>") + "</summary>" +
      '<div class="tl-body"><div class="tl-words">' + w.words.map(x => esc(x.en)).join("、") + "</div>" +
      '<div class="tl-stats"><span>讀完 <b>' + s.read + "</b> 篇</span><span>造句對 <b>" + s.right + "/" + s.practiced + "</b></span>" + (s.sh != null ? "<span>跟讀 <b>" + s.sh + "</b> 分</span>" : "") + "</div>" +
      (s.weak.length ? '<div class="small muted">下週複習：' + s.weak.map(pid => esc(PATTERNS[pid].en)).join("、") + "</div>" : "") + "</div></details>";
  }).join("") + "</div></section>";

  /* 2. trends (oldest → newest, last 8 weeks) */
  const recent = weeks.slice(0, 8).reverse().map(weekStats);
  html += '<section class="card"><div class="label">趨勢</div><div class="trends">' +
    trendLine("造句正確率", recent.map(s => s.pr), "%") + trendLine("跟讀分數", recent.map(s => s.sh), " 分") + trendLine("對話分數", recent.map(s => s.tk), " 分") + "</div></section>";

  /* 3. mastery */
  const pids = [...new Set(weeks.flatMap(w => w.patterns.concat(w.review || [])))];
  const words = [...new Set(weeks.flatMap(w => w.words.map(x => String(x.en).toLowerCase())))];
  const usedWords = words.filter(x => { const m = S.log && S.log.m && S.log.m.w && S.log.m.w[x]; return m && m.ok > 0; }).length;
  const counts = {ok:0, mid:0, new:0}; pids.forEach(p => counts[mastery("p", p)]++);
  html += '<section class="card"><div class="label">記住了多少</div>' +
    '<div class="m-legend">' + ["ok", "mid", "new"].map(k => '<span><i class="m-dot ' + k + '"></i>' + MASTERY[k] + " " + counts[k] + "</span>").join("") + "</div>" +
    '<div class="m-pats">' + pids.map(p => '<span class="m-pat ' + mastery("p", p) + '" title="' + MASTERY[mastery("p", p)] + '">' + esc(PATTERNS[p].en) + "</span>").join("") + "</div>" +
    '<div class="m-words"><div class="row between"><span>對話裡自己用出來的單字</span><b>' + usedWords + " / " + words.length + '</b></div><div class="progress"><span style="width:' + (words.length ? Math.round(usedWords / words.length * 100) : 0) + '%"></span></div></div>' +
    "</section>";

  /* 5. 月考 results */
  const qz = quizzes();
  if (qz.length) html += '<section class="card"><div class="label">月考</div><div class="tl-stats">' + qz.map((q, i) => "<span>第 " + (i + 1) + " 次（" + md(q.date) + "）<b>" + q.score + "/" + q.total + "</b></span>").join("") + "</div></section>";

  /* 4. estimate */
  const est = progressEstimate();
  if (est){
    html += '<section class="card"><div class="label">預估進度</div>' +
      (est.stage ? '<div class="est"><span>照目前的速度，約 <b>' + md(est.stage.date) + "</b> 完成「" + esc(est.stage.name) + "」（還有 " + est.stage.left + " 週）</span></div>" : '<p class="small muted" style="margin:0">' + est.tip + "</p>") +
      (est.know ? '<div class="est"><span>知識約 <b>' + md(est.know.date) + "</b> 到 " + est.know.at + "：" + esc(est.know.name) + "</span></div>" : "") +
      "</section>";
  }
  return html;
}

/* =========================================================
   月考: every 4 finished weeks, 10 quick questions on what was learned.
   Made from the saved weeks (no AI needed): 4 pattern questions (pick the English for a Chinese
   sentence), 3 word meanings, 3 listening. Wrong answers count against mastery and the wrong
   patterns go into next week's review.
   ========================================================= */
function quizzes(){ return (S.log && S.log.quiz) || []; }
function quizDue(){
  const done = Object.values(S.convs).filter(c => c.done).length;
  return Math.floor(done / 4) > quizzes().length;
}
function shuffle(a){ a = a.slice(); for (let i = a.length - 1; i > 0; i--){ const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function makeQuiz(){
  const weeks = Object.values(S.weeks);
  const pids = [...new Set(weeks.flatMap(w => w.patterns.concat(w.review || [])))];
  const words = [], seen = new Set();
  weeks.forEach(w => w.words.forEach(x => { const k = String(x.en).toLowerCase(); if (x.en && x.zh && !seen.has(k)){ seen.add(k); words.push(x); } }));
  /* weaker items first, so the quiz checks what matters */
  const rank = (kind, id) => ({new:0, mid:1, ok:2})[mastery(kind, id)] + Math.random();
  const qs = [];
  shuffle(pids).sort((a, b) => rank("p", a) - rank("p", b)).slice(0, 4).forEach(p => {
    const others = shuffle(PATTERNS.map((x, i) => i).filter(i => i !== p)).slice(0, 3);
    const opts = shuffle([p].concat(others));
    qs.push({type:"pat", id:p, prompt:PATTERNS[p].exZh, ask:"哪一句是這個意思？", opts:opts.map(i => PATTERNS[i].ex), right:opts.indexOf(p)});
  });
  const ws = shuffle(words).sort((a, b) => rank("w", a.en) - rank("w", b.en)).slice(0, 6);
  const pool = words.length >= 4 ? words : words.concat(WORD_FILL);
  ws.forEach((x, i) => {
    const others = shuffle(pool.filter(y => y.en.toLowerCase() !== x.en.toLowerCase())).slice(0, 3), opts = shuffle([x].concat(others));
    if (i < 3) qs.push({type:"mean", id:x.en, zh:x.zh, prompt:x.en, ask:"這個字是什麼意思？", opts:opts.map(y => y.zh), right:opts.indexOf(x)});
    else qs.push({type:"listen", id:x.en, zh:x.zh, prompt:x.en, ask:"聽聽看，是哪一個字？", opts:opts.map(y => y.en), right:opts.indexOf(x)});
  });
  return {qs:shuffle(qs).slice(0, 10), i:0, picks:[], done:false};
}
/* used only when fewer than 4 words have been learned */
const WORD_FILL = [{en:"happy", zh:"快樂的"}, {en:"water", zh:"水"}, {en:"friend", zh:"朋友"}, {en:"morning", zh:"早上"}];

function quizCardHTML(){
  if (!quizDue()) return "";
  const n = quizzes().length + 1;
  return '<section class="card quiz-card"><div class="row between" style="align-items:center"><div><div class="label">第 ' + n + " 次月考</div><b>5 分鐘、10 題，看看記住了多少</b></div>" +
    '<span class="quiz-ic" aria-hidden="true">📝</span></div><button class="btn block" data-act="quiz-start">開始</button></section>';
}
function quizSheetHTML(){
  const Q = S.quiz; if (!Q) return "";
  if (Q.done){
    const right = Q.picks.filter((p, i) => p === Q.qs[i].right).length, prev = quizzes()[quizzes().length - 2];
    const wrong = Q.qs.filter((q, i) => Q.picks[i] !== q.right);
    return '<div class="quiz-result"><div class="quiz-score"><b>' + right + "</b><span>/ " + Q.qs.length + "</span></div>" +
      '<p style="margin:0">' + (right >= 9 ? "太厲害了，幾乎全對！" : right >= 7 ? "很不錯，大部分都記住了。" : right >= 5 ? "有一半以上記住了，答錯的會排進複習。" : "沒關係，答錯的會排進下週複習。") +
      (prev ? "（上次 " + prev.score + " / " + prev.total + "）" : "") + "</p>" +
      (wrong.length ? '<div class="label">要再複習</div><div class="quiz-wrong">' + wrong.map(q => "<div><b>" + esc(q.type === "pat" ? PATTERNS[q.id].en : q.id) + "</b>" + "<span>" + esc(q.type === "pat" ? PATTERNS[q.id].ex : q.zh) + "</span>" + "</div>").join("") + "</div>" : "") +
      '<button class="btn block" data-act="quiz-close">完成</button></div>';
  }
  const q = Q.qs[Q.i], picked = Q.picks[Q.i];
  return '<div class="quiz-top"><span class="small muted">第 ' + (Q.i + 1) + " / " + Q.qs.length + ' 題</span><div class="progress"><span style="width:' + Math.round(Q.i / Q.qs.length * 100) + '%"></span></div></div>' +
    '<div class="quiz-q"><div class="small muted">' + q.ask + "</div>" +
    (q.type === "listen" ? '<button class="btn soft" data-act="say" data-text="' + esc(q.prompt) + '">' + ICON.speaker.replace("<svg", '<svg width="18" height="18"') + "再聽一次</button>"
      : '<div class="quiz-prompt' + (q.type === "mean" ? " en" : "") + '">' + esc(q.prompt) + "</div>") + "</div>" +
    '<div class="quiz-opts">' + q.opts.map((o, i) => '<button class="quiz-opt' + (picked == null ? "" : i === q.right ? " right" : i === picked ? " wrong" : "") + (q.type !== "mean" ? " en" : "") + '" data-act="quiz-pick" data-i="' + i + '"' + (picked != null ? " disabled" : "") + ">" + esc(o) + "</button>").join("") + "</div>" +
    (picked != null ? '<button class="btn block" data-act="quiz-next">' + (Q.i + 1 < Q.qs.length ? "下一題" : "看結果") + "</button>" : "");
}
function finishQuiz(){
  const Q = S.quiz; Q.done = true;
  const right = Q.picks.filter((p, i) => p === Q.qs[i].right).length, wrongP = [];
  Q.qs.forEach((q, i) => {
    const ok = Q.picks[i] === q.right;
    logResult(q.type === "pat" ? "p" : "w", q.id, ok);
    if (!ok && q.type === "pat") wrongP.push(q.id);
  });
  if (!S.log.quiz) S.log.quiz = [];
  S.log.quiz.push({at:Date.now(), date:todayStr(), score:right, total:Q.qs.length});
  /* wrong patterns join next week's review (at most 2, together with the Sunday ones) */
  S.log.reviewNext = [...new Set((S.log.reviewNext || []).concat(wrongP))].slice(0, 2);
  Store.set("log", S.log).catch(() => {});
  earn(right * 3, "月考答對 " + right + " 題"); gainKnow(right * 2, "月考");
}
