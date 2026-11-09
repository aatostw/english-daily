const ACT = {
  "tab": el => {
    if (S.cityChat && el.dataset.v !== "city"){ S.cityChat = false; City3D.focusLisa(false); }
    /* a small buzz and a pop on the icon, so the tap clearly lands */
    try { if (navigator.vibrate) navigator.vibrate(8); } catch (e) {}
    const v = el.dataset.v;
    setTimeout(() => { const t = document.querySelector('#tabs .tab[data-v="' + v + '"]'); if (t){ t.classList.remove("pop"); void t.offsetWidth; t.classList.add("pop"); } }, 0);
    if (S.reader) closeReader(); closeSheet(); if (el.dataset.v === "prefs") S.prefPage = null; go(el.dataset.v); },
  "shadow": el => openShadow(el.dataset.text),
  "shadow-start": () => shadowStart(),
  "shadow-para": el => {
    const ctxEl = el.closest("[data-ctx]"), ctx = ctxEl && S.ctx[ctxEl.dataset.ctx];
    const text = ctx && ctx.paras[Number(el.dataset.pi)];
    if (text) openShadow(text);
  },
  "shadow-next": () => { const o = S.sheet; if (o && o.kind === "shadow" && o.state !== "rec" && o.state !== "up") shadowGo(o, 1); },
  "shadow-prev": () => { const o = S.sheet; if (o && o.kind === "shadow" && o.state !== "rec" && o.state !== "up") shadowGo(o, -1); },
  "shadow-jump": el => { const o = S.sheet; if (!o || o.kind !== "shadow") return; o.i = Number(el.dataset.i) - 1; shadowGo(o, 1); },
  "shadow-stop": () => shadowStop(),
  "shadow-mine": () => { if (REC.url){ TTS.stop && TTS.stop(); const a = new Audio(REC.url); a.play().catch(() => {}); } },
  "asr-ping": async () => {
    const base = asrBase(); if (!base){ toast("管理員還沒幫你開通電腦語音"); return; }
    S.asrPing = "checking"; render();
    try {
      const r = await fetch(base + "/ping?k=" + asrKey(), {cache:"no-store"}); const j = await r.json();
      S.asrPing = j.ok && !voiceProblem(j) ? "ok:連線成功" : "連線失敗";
    } catch (e) { S.asrPing = "連線失敗"; }
    render();
  },
  "city-chat-close": () => { S.cityChat = false; City3D.focusLisa(false); render(); },
  "open-chat": () => { const w = curWeek(); if (!w) return;
    if (S.view === "city"){ S.chatDay = chatDayFor(w); S.cityChat = true; S.talk.scrollDown = true; closeSheet && S.sheet && closeSheet(); City3D.focusLisa(true); render(); return; }
    S.talkFrom = S.view === "city" ? "city" : "home"; S.chatDay = chatDayFor(w); S.talk.scrollDown = true; go("talk"); },
  "pref-open": el => { S.prefPage = el.dataset.p; go("prefs"); $("#main").scrollTop = 0; },
  "pref-back": () => { S.prefPage = null; render(); $("#main").scrollTop = 0; },
  "onb-next": () => { S.onb.step = Math.min(2, S.onb.step + 1); S.err.week = ""; render(); $("#main").scrollTop = 0; },
  "onb-back": () => { S.onb.step = Math.max(0, S.onb.step - 1); render(); $("#main").scrollTop = 0; },
  "pick-tier": el => { const i = Number(el.dataset.i); S.onb.tier = i; S.onb.tierOpen = i; render(); },
  "set-tier": el => { S.profile.tier = Number(el.dataset.i); saveProfile(); render(); toast("之後的文章會用「" + TIERS[S.profile.tier].name + "」的難度"); },
  "pick-theme": el => { const pk = themeChoices(); pk.sel = Number(el.dataset.i); pk.custom = ""; drawSheet(); },
  "shuffle-themes": () => { S.pick = null; drawSheet(); },
  "prep-skip": () => { const el = $("#prep-ov"); if (el) el.remove(); },
  "audio-clear": async () => {
    try { await AudioDB.clear(); } catch (e) {}
    TTS.pocketClips.clear(); toast("已清除存在手機裡的聲音，之後用到會再重新產生。"); render();
  },
  "voice-tip": () => { S.voiceTip = !S.voiceTip; render(); },
  "pocket-wav-clear": () => {
    const st = set();
    st.pocketVoice = Object.assign({}, st.pocketVoice, {wavData:"", wavName:"", wavSize:0});
    TTS.pocketReset(); saveProfile(); render(); toast("已移除自己的音檔，改回預設聲音。");
  },
  "onb-finish": () => finishOnboarding(),
  "open-theme": () => { S.err.week = ""; openSheet({kind:"theme"}); },
  "start-week": () => startWeek(),
  "gen-pick": el => { S.sheet = {kind:"genpick", n:Number(el.dataset.n), d:Number(el.dataset.d), k:Number(el.dataset.k)}; $("#sheet").hidden = false; drawSheet(); },
  "gen-go": el => {
    const o = S.sheet; if (!o || o.kind !== "genpick") return;
    const g = el.dataset.g, topic = g === "custom" ? (($("#gen-topic") || {}).value || "").trim() : "";
    if (g === "custom" && !topic){ toast("先寫下你想讀什麼"); const i = $("#gen-topic"); if (i) i.focus(); return; }
    closeSheet(); generateArticle(o.n, o.d, o.k, g, topic);
  },
  "gen": el => generateArticle(Number(el.dataset.n), Number(el.dataset.d), Number(el.dataset.k)),
  "open-art": el => { if (el.dataset.id && S.arts[el.dataset.id]) openArticle(el.dataset.id); else if (el.dataset.d) generateArticle(Number(el.dataset.n), Number(el.dataset.d), 0); },
  "close-reader": () => closeReader(),
  "stop-gen": () => { if (S.reader && S.reader.ctl) S.reader.ctl.abort(); },
  "retry-gen": () => { const r = S.reader; closeReader(); generateArticle(r.week, r.day, r.k); },
  "open-news": el => openNews(el.dataset.id),
  "news-retry": () => { NEWS.status = "idle"; NEWS.tries = 0; loadNews(true); },
  "mark-read": () => { const a = S.reader && S.reader.art; if (!a) return;
    if (a.kind === "news"){
      if (!a.read){ a.read = true; a.readAt = Date.now(); Store.set("news-" + a.date, a).catch(() => {}); logActivity("read"); earn(10, "讀完新聞《" + a.title + "》"); gainKnow(3, "讀完新聞"); checkStreakBonus(); }
      closeReader(); return;
    } const pi = $("#pr-input"); if (pi && !a.feedback) a.answer = pi.value; const firstRead = !a.read; a.read = true; a.readAt = Date.now(); Store.set(artId(a), a).catch(() => {}); if (firstRead){
    logActivity("read");
    earn(10, "讀完《" + (a.title || "文章") + "》");
    gainKnow(3, "讀完文章");
    const saved = (a.extraWords || []).filter(x => S.bank[slug(x.en)]).length;
    if (saved) earn(saved, "又讀到 " + saved + " 個收藏單字");
    checkStreakBonus(); checkWeekBonus(S.weeks[a.week]);
  } closeReader(); },
  "practice": () => checkPractice(),
  "read-all": () => readAll(),
  "font-cycle": () => { const order = ["s","m","l"]; const st = set(); st.font = order[(order.indexOf(st.font) + 1) % 3]; document.documentElement.style.setProperty("--read-size", FONT[st.font]); saveProfile(); },
  "say-para": el => sayPara(el),
  "say": el => { TTS.speak(el.dataset.text || "", el.dataset.slow ? 0.6 : set().rate); },
  "say-turn": el => { const c = curChat().conv; if (c) TTS.speak(c.turns[Number(el.dataset.i)].content, set().rate); },
  "week-word": el => { const w = S.weeks[Number(el.dataset.n)]; const info = w && w.words[Number(el.dataset.i)]; if (info) openSheet({state:"ready", sentence:"", pat:null, data:Object.assign({word:info.en, lemma:info.en}, info)}); },
  "bank-word": el => { const x = S.bank[el.dataset.id]; if (x) openSheet({state:"ready", sentence:x.sentence || "", pat:null, data:Object.assign({word:x.en, lemma:x.en}, x)}); },
  "close-sheet": el => { if (el && el.classList && el.classList.contains("sheet-bg") && performance.now() - (S.sheetAt || 0) < 500) return; closeSheet(); },
  "me": () => { if (S.reader) closeReader(); go("city"); cityOpen({s:"avatar"}); },
  "dev-apply": () => {
    const num = id => { const v = Math.floor(Number(($("#" + id) || {}).value)); return isFinite(v) && v >= 0 ? v : null; };
    const coins = num("dev-coins"), food = num("dev-food"), know = num("dev-know");
    if (coins == null || food == null || know == null){ toast("請輸入 0 以上的數字"); return; }
    const W = wallet(), c = city(), done = [];
    if (coins !== W.balance){ W.ledger.push({at:Date.now(), amount:coins - W.balance, reason:"開發人員調整"}); W.balance = coins; Store.set("wallet", W).catch(() => {}); done.push("金幣"); }
    if (food !== c.food || know !== knowledge()){ if (food !== c.food) done.push("糧食"); if (know !== knowledge()) done.push("知識"); c.food = food; c.knowledge = know; saveCity(); }
    const te = $("#dev-time");
    if (te && te.value && te.value !== te.dataset.init){
      const t = new Date(te.value).getTime(), real = Date.now() - (window.__timeOffset || 0);
      if (!isFinite(t)){ toast("時間格式不對"); return; }
      try { localStorage.setItem("eel-time-offset", String(t - real)); } catch (e) {}
      setTimeout(() => location.reload(), 300); return;
    }
    renderCoins(); renderPill(); render(); toast(done.length ? "已套用：" + done.join("、") : "沒有改動");
  },
  "dev-know": () => {
    const v = Math.max(0, Math.floor(Number(($("#dev-know") || {}).value)));
    if (!isFinite(v)){ toast("請輸入數字"); return; }
    city().knowledge = v; saveCity(); render(); toast("知識改成 " + v);
  },
  "dev-toggle": async () => {
    const st = set();
    if (devOn()){ st.devMode = false; admForget(); saveProfile(); render(); return; }
    if (!(await admLoginBox())) return;
    st.devMode = true; saveProfile(); render();
    ACT["adm-load"](null, true);
  },
  "dev-coins": () => {
    const v = Math.max(0, Math.floor(Number(($("#dev-coins") || {}).value)));
    if (!isFinite(v)){ toast("請輸入數字"); return; }
    const W = wallet(), diff = v - W.balance;
    W.balance = v; W.ledger.push({at:Date.now(), amount:diff, reason:"開發人員調整"});
    Store.set("wallet", W).catch(() => {}); renderCoins(); render(); toast("金幣改成 " + v.toLocaleString());
  },
  "city-tile": el => {
    const c = city(), k = anchorOf(c, el.dataset.k), it = c.tiles[k];
    if (tileEmpty(it)){ cityOpen({s:"build", k}); return; }
    /* roads and decorations have nothing to upgrade: change them in 編輯 */
    const b = it.b && CITY_BUILDINGS[it.b];
    if (!b || !(b.make || b.grow || b.fun || b.fixed)){ toast("要移動、轉向或移除，請按左上的「編輯」"); return; }
    cityOpen({s:"tile", k});
  },
  "city-sheet": el => cityOpen({s:el.dataset.s}),
  "city-req": el => cityOpen({s:"req", id:el.dataset.id}),
  "city-feed": () => cityFeed(),
  "city-harvest": () => { const c = city(), n = c.prod.store; if (!n) return; c.food += n; c.prod.store = 0; saveCity(); render(); toast("收成 " + n + " 份糧食！"); },
  "city-upgrade": el => {
    const c = city(), k = el.dataset.k, it = c.tiles[k]; if (!it || !it.b) return;
    const cost = upgradeCost(it), b = CITY_BUILDINGS[it.b]; if (!cost) return;
    if (b.fixed && !knowUnlocked(HALL.know[tileLv(it)])) return;
    if (!spend(cost, "城市：升級" + b.name)){ toast("金幣不夠。"); return; }
    it.lv = tileLv(it) + 1;
    let moved = "";
    if (b.grow){
      const used = new Set(c.residents.map(p => p.name)), add = b.grow[it.lv - 1] - b.grow[it.lv - 2];
      for (let i = 0; i < add; i++){
        const free = CITY_NAMES.filter(n => !used.has(n)), name = free.length ? free[Math.floor(Math.random() * free.length)] : "Kai" + c.residents.length;
        used.add(name); c.residents.push({name, color:CITY_COLORS[c.residents.length % CITY_COLORS.length], home:k}); moved = name;
      }
    }
    saveCity(); drawSheet(); render(); toast(b.name + "升到 Lv" + it.lv + (b.fixed ? "，小島變大了！" : moved ? "，" + moved + " 搬進來了！" : "！"));
  },
  "city-answer": el => cityAnswer(el),
  "city-build": el => {
    const o = S.sheet; if (!o) return;
    const err = cityBuildAt(city(), o.k, el.dataset.b);
    if (err){ toast(err); return; }
    closeSheet(); render();
  },
  "talk-warn-x": () => { S.talk.warn = ""; render(); },
  "city-style": el => { const c = city(); c.style = el.dataset.v === "cn" ? "cn" : "west"; saveCity(); if (S.sheet) drawSheet(); if (S.cityEdit) render(); },
  "city-ground": el => { const err = cityGroundAt(city(), el.dataset.k, el.dataset.g); if (err) toast(err); drawSheet(); render(); },
  "dev-time": () => {
    const v = ($("#dev-time") || {}).value; if (!v){ toast("請選一個時間"); return; }
    const t = new Date(v).getTime(), real = Date.now() - (window.__timeOffset || 0);
    if (!isFinite(t)){ toast("時間格式不對"); return; }
    try { localStorage.setItem("eel-time-offset", String(t - real)); } catch (e) {}
    location.reload();
  },
  "dev-time-reset": () => { try { localStorage.removeItem("eel-time-offset"); } catch (e) {} location.reload(); },
  "dev-food": () => {
    const v = Math.max(0, Math.floor(Number(($("#dev-food") || {}).value)));
    if (!isFinite(v)){ toast("請輸入數字"); return; }
    const c = city(); c.food = v; saveCity(); renderPill(); render(); toast("糧食改成 " + v);
  },
  "city-turn": el => {
    const c = city(), it = c.tiles[el.dataset.k]; if (!hasDoor(it)) return;
    it.face = ((it.face >= 0 ? it.face : 5) + 1) % 6; saveCity(); drawSheet(); render();
  },
  "city-deco": el => { const o = S.sheet; if (!o) return; const err = cityDecoAt(city(), o.k, el.dataset.d); if (err){ toast(err); return; } closeSheet(); render(); },
  "city-move": el => { cityRemoveAt(city(), el.dataset.k); closeSheet(); render(); },
  "city-edit": () => { S.cityEdit = {tab:null, sel:null}; render(); },
  "city-edit-done": () => { S.cityEdit = null; render(); },
  "city-edit-back": () => { S.cityEdit.tab = null; S.cityEdit.sel = null; render(); },
  "city-edit-tab": el => { const E = S.cityEdit; E.tab = el.dataset.v; E.sel = null; render(); },
  "city-edit-pick": el => { const E = S.cityEdit; E.sel = E.sel === el.dataset.v ? null : el.dataset.v; render(); },
  "city-food": () => { const c = city(); if (!spend(CITY_FOOD.price, "城市：買糧食")){ toast("金幣不夠。"); return; } c.food += CITY_FOOD.n; saveCity(); drawSheet(); render(); toast("買了 " + CITY_FOOD.n + " 份糧食"); },
  "city-wear": el => { const c = city(); c.avatar[el.dataset.slot] = el.dataset.k; saveCity(); drawSheet(); render(); },
  "city-buypart": el => {
    const c = city(), slot = el.dataset.slot, k = el.dataset.k, price = CITY_PART_PRICE[k];
    if (!price || c.owned[slot].includes(k)) return;
    if (!spend(price, "城市：買" + CITY_PARTS[slot].items[k])){ toast("金幣不夠。"); return; }
    c.owned[slot].push(k); c.avatar[slot] = k; saveCity(); drawSheet(); render();
  },
  "city-useboost": () => { const c = city(); if (!c.boosts.double) return; c.boosts.double--; c.boosts.active = (c.boosts.active || 0) + 3; saveCity(); drawSheet(); toast("雙倍卡啟用！接下來 3 次練習的金幣加倍。"); },
  "lookup-retry": () => { const o = S.sheet; if (o){ o.state = "loading"; drawSheet(); lookupWord(o); } },
  "star": () => toggleStar(),
  "tr-sent": () => translateSentence(),
  "talk-start": () => startTalk(),
  "talk-send": () => sendTalk(),
  "talk-end": () => endTalk(),
  "word-filter": el => { S.wordFilter = el.dataset.f; render(); },
  "setting": el => { const st = set(); st[el.dataset.key] = el.dataset.val; saveProfile(); render(); },
  "key-eye": el => { const i = document.getElementById(el.dataset.for); if (i) i.type = i.type === "password" ? "text" : "password"; },
  "dd-toggle": el => { S.dd = S.dd === el.dataset.dd ? null : el.dataset.dd; render(); },
  "dd-pick": el => {
    const a = aiState();
    if (el.dataset.dd === "prov"){ a.provider = el.dataset.val; a.model = PROVIDERS[a.provider].defaults.write || ""; }
    else a.model = el.dataset.val;
    S.dd = null; saveAi(); render();
  },
  "ai-test": () => {
    const a = aiState(), p = a.provider, ki = $("#ai-key"), bi = $("#ai-base"), mi = $("input#ai-model");
    if (!PROVIDERS[p].server){ KEYS[p] = Object.assign({}, KEYS[p], {key:ki ? ki.value.trim() : provKey(p), base:bi ? bi.value.trim() : ""}); saveKeys(); }
    if (mi) a.model = mi.value.trim();
    saveAi(); testProvider(p);
  },
  /* hidden way in for the admin before anyone has an account: tap the name 5 times, or open the app with #admin */
  "gate-brand": () => { const G = S.gate; G.taps = (G.taps || 0) + 1; clearTimeout(G.tapT); G.tapT = setTimeout(() => G.taps = 0, 1500); if (G.taps >= 5){ S.gate = {page:"admin"}; drawGate(); } },
  "gate-admin": async () => {
    const G = S.gate, user = (($("#ga-au") || {}).value || "").trim(), key = ($("#ga-ak") || {}).value || "";
    if (!user || !key){ G.err = "請輸入管理員帳號和管理密碼。"; drawGate(); return; }
    G.busy = true; G.err = ""; S.admLast = user; drawGate();
    try { await admCheck(user, key); S.adm = null; } catch (e) { G.err = e.message; }
    G.busy = false; drawGate();
  },
  "gate-page": el => { S.gate = {page:el.dataset.p}; Cloud.err = ""; drawGate(); },
  "gate-eye": () => { S.gate.showPw = !S.gate.showPw; drawGate(); const i = $("#g-pw"); if (i) i.focus(); },
  "gate-login": async () => {
    const email = (($("#g-email") || {}).value || "").trim(), pw = ($("#g-pw") || {}).value || "";
    if (!email || !pw){ Cloud.err = "請輸入 Email 和密碼。"; drawGate(); return; }
    Cloud.busy = true; Cloud.err = ""; drawGate();
    try { if (await Cloud.login(email, pw)){ S.gate = {page:"login"}; S.view = "home"; toast("歡迎回來！"); } }
    catch (e) { Cloud.err = e.message; }
    Cloud.busy = false; render();
  },
  "gate-forgot": async () => {
    const G = S.gate, email = (($("#g-femail") || {}).value || "").trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){ G.err = "請輸入正確的 Email。"; drawGate(); return; }
    G.busy = true; G.err = ""; drawGate();
    try { await Cloud.api("/forgot", {body:{email}}); G.sent = true; }
    catch (e) { G.err = e.message; }
    G.busy = false; drawGate();
  },
  "cloud-sync": async () => {
    Cloud.busy = true; render();
    await Cloud.push();
    const changed = await Cloud.pull();
    Cloud.busy = false;
    if (changed) await reloadFromStore(); else render();
    if (!Cloud.err) toast("已同步。");
  },
  "cloud-logout": async () => {
    const c = await choiceBox("登出", "登出後，這支手機上的進度要怎麼處理？雲端上的進度不會刪除。", ["保留在這支手機", "清掉這支手機的進度"]);
    if (c < 0) return;
    await Cloud.logout(c === 1);
    S.gate = {page:"login"}; S.prefPage = null; render();
  },
  "cloud-pw": async () => {
    const old = ($("#cl-old") || {}).value || "", nw = ($("#cl-new") || {}).value || "";
    if (nw.length < 6){ S.cloudPwMsg = {ok:false, text:"新密碼至少 6 個字。"}; render(); return; }
    try { await Cloud.api("/password", {body:{old, password:nw}}); S.cloudPwMsg = {ok:true, text:"密碼已更新，其他裝置要重新登入。"}; }
    catch (e) { S.cloudPwMsg = {ok:false, text:e.message}; }
    render();
  },
  "adm-load": async (el, keep) => {
    const k = admKey();
    if (!k) return;
    S.adm = Object.assign(S.adm || {}, {busy:true}, keep ? {} : {err:"", ok:""}); render();
    try { const j = await Cloud.api("/admin/users", {admin:k}); S.adm.users = j.users; const c = await Cloud.api("/admin/config", {admin:k}); S.adm.voiceKeySet = c.voiceKeySet; S.adm.voiceUrl = String(c.voiceUrl || "").replace(/^https?:\/\//, ""); }
    catch (e) { S.adm.err = e.message; S.adm.users = null; if (/管理員帳號或密碼不對/.test(e.message)){ admForget(); set().devMode = false; saveProfile(); toast("管理員帳號或密碼已經改了，請重新開啟開發人員模式。"); } }
    S.adm.busy = false; render();
  },
  "adm-add": async () => {
    const body = {name:(($("#adm-name") || {}).value || "").trim(), email:(($("#adm-email") || {}).value || "").trim(), password:($("#adm-pw") || {}).value || "", voice:!!($("#adm-voice") || {}).checked};
    S.adm.err = ""; S.adm.ok = "";
    try { await Cloud.api("/admin/users", {admin:admKey(), body}); S.adm.ok = "已建立 " + body.email + "。把 Email 和密碼告訴對方，請他打開 App 登入。"; S.adm.addOpen = false; }
    catch (e) { S.adm.err = e.message; S.adm.addOpen = true; render(); return; }
    ACT["adm-load"](null, true);
  },
  "adm-voice": async el => {
    const email = el.dataset.email, on = el.dataset.on === "1";
    try { await Cloud.api("/admin/users/voice", {admin:admKey(), body:{email, on}}); S.adm.ok = (on ? "已開通 " : "已關閉 ") + email + " 的電腦語音。"; S.adm.err = ""; }
    catch (e) { S.adm.err = e.message; render(); return; }
    ACT["adm-load"](null, true);
    if (Cloud.cfg && Cloud.cfg.email === email) Cloud.refreshMe();
  },
  "adm-reset": el => { S.adm.reset = S.adm.reset === el.dataset.email ? "" : el.dataset.email; S.adm.err = ""; S.adm.ok = ""; render(); },
  "adm-reset-go": async el => {
    const pw = ($("#adm-rp") || {}).value || "";
    try { await Cloud.api("/admin/users/reset", {admin:admKey(), body:{email:el.dataset.email, password:pw}}); S.adm.ok = "已重設 " + el.dataset.email + " 的密碼，他的裝置要用新密碼重新登入。"; S.adm.reset = ""; S.adm.err = ""; }
    catch (e) { S.adm.err = e.message; }
    render();
  },
  "adm-del": async el => {
    const email = el.dataset.email;
    if (!(await confirmBox("刪除帳號？", email + " 的帳號和雲端上的所有進度都會刪除，無法復原。他手機上的進度會留著。", "刪除", true))) return;
    try { await Cloud.api("/admin/users/delete", {admin:admKey(), body:{email}}); S.adm.ok = "已刪除 " + email + "。"; S.adm.err = ""; }
    catch (e) { S.adm.err = e.message; render(); return; }
    ACT["adm-load"](null, true);
  },
  "reset": () => resetAll()
};
document.addEventListener("click", e => {
  if (S.dd && !e.target.closest(".dd")){ S.dd = null; render(); if (!e.target.closest("[data-act]")) return; }
  const actEl = e.target.closest("[data-act]");
  if (!actEl){
    const wEl = e.target.closest(".kw, .w");
    if (wEl && wEl.closest("[data-ctx]")) onWordTap(wEl);
    return;
  }
  if (actEl.hasAttribute("disabled")) return;
  const fn = ACT[actEl.dataset.act];
  if (fn){ e.preventDefault(); e.stopPropagation(); fn(actEl, e); }
});
document.addEventListener("keydown", e => {
  if (e.key !== "Enter" || !e.target.closest || !e.target.closest("#gate")) return;
  const b = $("#gate [data-act=gate-login], #gate [data-act=gate-forgot], #gate [data-act=gate-admin]");
  if (b){ e.preventDefault(); b.click(); }
});
document.addEventListener("change", e => {
  const el = e.target;
  const act = el.dataset && el.dataset.actChange; if (!act) return;
  if (act === "pocket-wav"){
    const f = el.files && el.files[0]; el.value = "";
    if (!f || !S.profile) return;
    if (f.size > 8 * 1024 * 1024){ toast("音檔太大了（超過 8 MB），請剪短一點，10-30 秒就夠。"); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const st = set();
      st.pocketVoice = Object.assign({}, st.pocketVoice, {wavData:reader.result, wavName:f.name, wavSize:f.size});
      TTS.pocketReset(); saveProfile(); render();
    };
    reader.onerror = () => toast("讀取音檔失敗，換一個檔案試試。");
    reader.readAsDataURL(f);
    return;
  }
  const a = aiState(), p = a.provider;
  if (act === "ai-key"){ KEYS[p] = Object.assign({}, KEYS[p], {key:el.value.trim()}); saveKeys(); delete S.provTest[p]; return; }
  if (act === "ai-base"){ KEYS[p] = Object.assign({}, KEYS[p], {base:el.value.trim()}); saveKeys(); delete S.provTest[p]; return; }
  if (act === "ai-model-text"){ a.model = el.value.trim(); saveAi(); return; }
  if (!S.profile) return;
  const st = set();
  if (act === "voice"){ st.voice = el.value; saveProfile(); }
  if (act === "rate"){ st.rate = Number(el.value); saveProfile(); }
});
document.addEventListener("input", e => {
  if (e.target.id === "rate"){ const v = $("#rate-v"); if (v) v.textContent = Number(e.target.value).toFixed(1) + "×"; }
  if (e.target.id === "theme-custom" && S.pick){ S.pick.custom = e.target.value; if (e.target.value.trim() && S.pick.sel >= 0){ S.pick.sel = -1; document.querySelectorAll('.theme-btn[aria-pressed="true"]').forEach(b => b.setAttribute("aria-pressed", "false")); } }
  if (e.target.id === "talk-input"){ e.target.style.height = "auto"; e.target.style.height = Math.min(140, e.target.scrollHeight) + "px"; }
});
document.addEventListener("keydown", e => {
  if (e.key === "Escape" && S.dd){ S.dd = null; render(); return; }
  if (e.key === "Escape"){ if (!$("#dialog").hidden) return; if (S.sheet) closeSheet(); else if (S.reader) closeReader(); }
  if (e.key === "Enter" && !e.shiftKey && e.target.id === "talk-input" && !e.isComposing){ e.preventDefault(); sendTalk(); }
});
window.addEventListener("hashchange", () => {
  const v = location.hash.slice(1);
  if (S.profile && ["learn","home","city","talk","words","prefs"].includes(v) && v !== S.view){ if (S.reader) closeReader(); S.view = v; render(); }
});
