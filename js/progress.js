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
function nextKnowGoal(){ const k = knowledge(); return KNOW_UNLOCKS.find(u => u.at > k) || null; }

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
