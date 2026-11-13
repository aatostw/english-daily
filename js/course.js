/* =========================================================
   Making weeks and articles (AI)
   ========================================================= */
async function createWeek(n, monday, pair, review, theme, prof){
  prof = prof || S.profile;
  const pids = [(pair % PAIRS) * 2, (pair % PAIRS) * 2 + 1];
  const r = await aiJson("write", wordsPrompt(theme, pids), {cache:false});
  const words = (r && Array.isArray(r.words) ? r.words : []).filter(x => x && x.en).slice(0, 6).map(x => ({
    en:String(x.en), pos:String(x.pos || ""), ipa:String(x.ipa || ""), zh:String(x.zh || ""), note_zh:String(x.note_zh || ""),
    example_en:String(x.example_en || ""), example_zh:String(x.example_zh || "")
  }));
  if (words.length < 6) throw {code:"invalid_json"};
  const week = {kind:"week", n, monday, pair:pair % PAIRS, patterns:pids, review:review || [], theme_zh:String(r.theme_zh || theme.zh), theme_en:String(r.theme_en || theme.en), words, status:"active", createdAt:Date.now()};
  await Store.set("week-" + n, week);
  S.weeks[n] = week;
  prof.currentWeek = n;
  prof.usedThemes = (prof.usedThemes || []).concat(theme.zh).slice(-30);
  await Store.set("profile", prof);
  return week;
}
function finishOnboarding(){
  const prof = {kind:"profile", startPair:TIERS[S.onb.tier || 0].pair, tier:S.onb.tier || 0, currentWeek:0, usedThemes:[], settings:defaultSettings(), createdAt:Date.now()};
  prof.settings.ai = clone(S.onb.ai || defaultAi());
  prof.about = Object.assign({age:0, gender:"", interests:[]}, S.onb.about || {});
  if (hasAbout(prof.about)) prof.aboutAsked = true;
  aboutDefaults(prof.settings, prof.about);
  S.profile = prof;
  Store.set("profile", prof).catch(() => {});
  go("home");
}
async function startWeek(){
  const need = themeNeed();
  if (!need){ closeSheet(); return; }
  const theme = pickedTheme();
  if (!theme){ toast("先選一個主題，或自己輸入一個。"); return; }
  if (S.busy.week) return;
  S.busy.week = true; S.err.week = ""; drawSheet();
  try {
    const today = todayStr(), w = curWeek();
    let monday;
    if (need.first) monday = mondayOf(today);
    else {
      monday = addDays(w.monday, 7);
      const cm = mondayOf(today);
      if (parseYmd(monday) < parseYmd(cm)) monday = cm;
    }
    if (diffDays(monday, today) >= 6) monday = addDays(monday, 7); // picked on a Sunday: the week starts tomorrow
    if (need.first) await createWeek(1, monday, S.profile.startPair, [], theme);
    else {
      const conv = S.convs[w.n];
      /* next week's review: what the Sunday chat found weak, then what the 月考 got wrong */
      const extra = (S.log && S.log.reviewNext) || [];
      const review = [...new Set(((conv && conv.done && conv.weakPids) || []).concat(extra))].slice(0, 2);
      if (extra.length){ S.log.reviewNext = []; Store.set("log", S.log).catch(() => {}); }
      await createWeek(w.n + 1, monday, S.profile.startPair + w.n, review, theme);
      w.status = "done"; Store.set("week-" + w.n, w).catch(() => {});
    }
    S.pick = null; S.busy.week = false;
    closeSheet(); toast("第 " + need.n + " 週準備好了"); go("home");
  } catch (e) {
    S.busy.week = false; S.err.week = aiErr(e);
    if (S.sheet && S.sheet.kind === "theme") drawSheet(); else toast(S.err.week);
  }
}
async function generateArticle(n, d, k, pick, topic){
  const w = S.weeks[n]; if (!w) return;
  const key = "gen-" + n + "-" + d;
  if (S.busy[key]) return;
  const genre = pick === "random" ? GENRE_PICK[Math.floor(Math.random() * GENRE_PICK.length)] : GENRE[pick] ? pick : genreFor(d, k);
  topic = genre === "custom" ? String(topic || "").trim().slice(0, 80) : "";
  const ctl = new AbortController();
  S.busy[key] = true; S.err[key] = "";
  const extra = pickSaved();
  openReader({week:n, day:d, k, genre, topic, state:"stream", raw:"", ctl, extra});
  render();
  let pending = false;
  try {
    const res = await ai("article", articlePrompt(w, d, k, genre, extra, topic), {
      cache:false, signal:ctl.signal,
      onText: ({text}) => {
        if (!S.reader || S.reader.ctl !== ctl) return;
        S.reader.raw = text;
        if (!pending){ pending = true; requestAnimationFrame(() => { pending = false; if (S.reader && S.reader.ctl === ctl) drawReader(false); }); }
      }
    });
    const p = parseRaw(res.text);
    if (!p.body) throw {code:"invalid_json"};
    const plan = DAY_PLAN[d];
    const art = {kind:"art", week:n, day:d, k, genre, topic, title:p.title || "Today", title_zh:p.title_zh || "", body:p.body, practice_zh:p.practice, practice_pattern:plan.focus, extraWords:extra, read:false, answer:"", feedback:null, createdAt:Date.now()};
    S.arts[artId(art)] = art;
    S.busy[key] = false;
    Store.set(artId(art), art).catch(() => {});
    if (S.reader && S.reader.ctl === ctl){ S.reader.state = "ready"; S.reader.art = art; S.reader.ctl = null; drawReader(true); prepareArticleVoice(true); }
    render();
  } catch (e) {
    S.busy[key] = false;
    if (S.reader && S.reader.ctl === ctl){
      if (e && e.code === "cancelled"){ closeReader(); return; }
      S.reader.state = "error"; S.reader.err = aiErr(e); S.reader.ctl = null; drawReader(true);
    } else if (!(e && e.code === "cancelled")) S.err[key] = aiErr(e);
    render();
  }
}
