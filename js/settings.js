/* ---------- settings ---------- */
function previewMode(){
  let framed = false;
  try { framed = window.self !== window.top; } catch (e) { framed = true; }
  return framed || /^(about|blob|data):$/.test(location.protocol);
}
function defaultAi(){ return {provider:"server", model:"gemini-3.5-flash-lite", fastLookup:true}; }
function aiState(){
  if (S.profile){
    const st = set();
    if (!st.ai || !PROVIDERS[st.ai.provider]) st.ai = defaultAi();
    /* once: everybody moves to the server's AI (they can switch back in settings) */
    if (!st.serverAi){ st.serverAi = true; st.ai = Object.assign(defaultAi(), {model:st.ai.provider === "gemini" ? st.ai.model : "gemini-3.5-flash-lite"}); }
    return st.ai;
  }
  if (!S.onb.ai) S.onb.ai = defaultAi();
  return S.onb.ai;
}
function saveAi(){ if (S.profile) saveProfile(); }
function aiCardHTML(){
  const a = aiState(), p = a.provider, P = PROVIDERS[p], k = KEYS[p] || {}, tr = S.provTest[p];
  const coin = '<span class="paid-badge" title="需付費" aria-label="需付費">$</span>';
  const opt = (dd, val, label, sel, extra) => '<button class="dd-opt" role="option" aria-selected="' + sel + '" data-act="dd-pick" data-dd="' + dd + '" data-val="' + esc(val) + '"><span>' + label + "</span>" + (extra || "") + (sel ? '<span class="check">' + ICON.check + "</span>" : "") + "</button>";
  const prov = '<div class="dd"><button class="dd-btn" id="ai-prov" data-act="dd-toggle" data-dd="prov" aria-haspopup="listbox" aria-expanded="' + (S.dd === "prov") + '"><span>' + esc(P.name) + "</span>" + ICON.chev + "</button>" +
    (S.dd === "prov" ? '<div class="dd-list" role="listbox" aria-label="AI 服務">' + PROVIDER_ORDER.map(q => opt("prov", q, esc(PROVIDERS[q].name), q === p)).join("") + "</div>" : "") + "</div>";
  let model;
  if (P.models.length){
    const cur = P.models.find(m => m.id === a.model) || P.models.find(m => m.id === P.defaults.write) || P.models[0];
    model = '<div class="dd"><button class="dd-btn en" id="ai-model" data-act="dd-toggle" data-dd="model" aria-haspopup="listbox" aria-expanded="' + (S.dd === "model") + '"><span class="row" style="gap:8px">' + esc(cur.id) + (cur.paid ? coin : "") + "</span>" + ICON.chev + "</button>" +
      (S.dd === "model" ? '<div class="dd-list en" role="listbox" aria-label="模型">' + P.models.map(m => opt("model", m.id, esc(m.id), m.id === cur.id, m.paid ? coin : "")).join("") + "</div>" : "") + "</div>";
  } else {
    model = '<input class="input en" id="ai-model" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="輸入模型名稱" value="' + esc(a.model || "") + '" data-act-change="ai-model-text">';
  }
  const curModel = taskCfg("write").model;
  return '<section class="card ai-card"><h2 style="font-size:20px">AI 模型</h2>' +

    '<div class="field"><label for="ai-prov">AI 服務</label>' + prov + "</div>" +
    '<div class="field"><label for="ai-model">模型</label>' + model + "</div>" +
    
    (P.server ? '<p class="muted small" style="margin:0">用伺服器上的 Gemini，登入就能用，不需要自己的 API Key。</p>' : '<div class="field"><div class="row between"><label for="ai-key">API Key</label>' + (P.keyUrl ? '<a class="small" href="' + P.keyUrl + '" target="_blank" rel="noopener">取得 API Key ↗</a>' : "") + "</div>" +
      '<div class="row"><input class="input" id="ai-key" type="password" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="輸入 API Key" value="' + esc(k.key || "") + '" data-act-change="ai-key"><button class="icon-btn" data-act="key-eye" data-for="ai-key" aria-label="顯示或隱藏金鑰">' + ICON.eye + "</button></div></div>" +
    '<div class="field"><label for="ai-base">API Endpoint <span class="muted" style="font-weight:400">（' + (p === "custom" ? "必填" : "選填") + '）</span></label><input class="input en" id="ai-base" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="' + (p === "custom" ? "https://你的服務網址/v1" : "留空即使用官方網址") + '" value="' + esc(k.base || "") + '" data-act-change="ai-base"></div>') +
    (P.models.some(m => m.paid) ? '<p class="muted small" style="margin:0">標示 ' + coin + ' 的模型需付費。</p>' : "") +
    (tr ? '<div class="' + (tr.ok ? "note ok" : "err") + '">' + esc(tr.msg) + "</div>" : "") +
    '<div class="row" style="justify-content:flex-end"><button class="btn green" data-act="ai-test"' + (S.busy.provTest ? " disabled" : "") + ">" + (S.busy.provTest ? '<span class="spinner"></span>測試中' : "測試連線") + "</button></div></section>";
}
function fillAudioUsage(){
  AudioDB.usage().then(u => { const el = $("#audio-usage"); if (el) el.textContent = "已存的聲音：" + u.count + " 個・" + (u.bytes / 1048576).toFixed(1) + " MB（上限 " + Math.round(AUDIO_LIMIT / 1048576) + " MB）"; });
}
const GATE_ICON = {
  mail:'<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="m4 7 8 6 8-6"/></svg>',
  lock:'<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 10V8a5 5 0 0 1 10 0v2h.5A1.5 1.5 0 0 1 19 11.5v8a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 19.5v-8A1.5 1.5 0 0 1 6.5 10H7zm2 0h6V8a3 3 0 0 0-6 0v2z"/></svg>',
  eye:'<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>',
  eyeOff:'<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 3l18 18"/><path d="M10.6 5.1A10.7 10.7 0 0 1 12 5c6.4 0 10 7 10 7a17.6 17.6 0 0 1-3.2 4.1M6.6 6.6A17.4 17.4 0 0 0 2 12s3.6 7 10 7a10 10 0 0 0 5.4-1.6"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>',
  back:'<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 12H5M11 6l-6 6 6 6"/></svg>',
  check:'<svg width="40" height="40" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="currentColor"/><path d="m7.5 12.2 3 3 6-6.2" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>'
};
/* Logging in is required: until then this screen covers the app. Once logged in, the phone stays logged in. */
function drawGate(){
  const el = $("#gate");
  if (Cloud.on()){ if (!el.hidden){ el.hidden = true; el.innerHTML = ""; } return; }
  if (!S.canStore){
    el.innerHTML = '<div class="g-in"><div class="g-brand">english daily</div><p class="g-p">這個瀏覽器不能儲存資料（可能開了無痕模式），所以沒辦法登入。請換一個瀏覽器或關掉無痕模式。</p></div>';
    el.hidden = false; return;
  }
  const G = S.gate || (S.gate = {page:location.hash === "#admin" ? "admin" : "login"});
  const keep = {}; el.querySelectorAll("input[id]").forEach(i => keep[i.id] = i.value);
  const focus = document.activeElement && el.contains(document.activeElement) ? document.activeElement.id : "";
  const deco = '<i class="g-deco g-blob1"></i><i class="g-deco g-dots"></i><i class="g-deco g-blob4"></i><i class="g-deco g-blob2"></i><i class="g-deco g-blob3"></i>';
  const email = keep["g-email"] != null ? keep["g-email"] : ((Cloud.cfg && Cloud.cfg.email) || (() => { try { return localStorage.getItem("eel-last-email") || ""; } catch (e) { return ""; } })());
  let html;
  if (G.page === "admin"){
    html = deco + '<button class="g-back" data-act="gate-page" data-p="login" aria-label="回到登入">' + GATE_ICON.back + "</button>" +
      '<div class="g-in" style="padding-top:80px"><section class="card">' + (admCreds() ? adminHTML()
        : '<h2 style="font-size:20px">管理員登入</h2>' + admLoginHTML("ga") +
          (G.err ? '<div class="err">' + esc(G.err) + "</div>" : "") +
          '<button class="btn block" data-act="gate-admin"' + (G.busy ? " disabled" : "") + ">" + (G.busy ? '<span class="spinner"></span>確認中' : "確認") + "</button>") + "</section></div>";
  } else if (G.page === "forgot"){
    html = deco + '<button class="g-back" data-act="gate-page" data-p="login" aria-label="回到登入">' + GATE_ICON.back + "</button>" +
      '<div class="g-in" style="padding-top:max(190px,24vh)"><h1 class="g-h">忘記密碼了嗎？</h1>' +
      '<p class="g-p">別擔心，探險家！輸入你的帳號 Email，<br>我們會通知管理者幫你重設密碼。</p>' +
      '<label class="g-field box">' + GATE_ICON.mail + '<input id="g-femail" type="email" autocomplete="username" autocapitalize="off" spellcheck="false" placeholder="輸入你的 Email" aria-label="Email" value="' + esc(keep["g-femail"] != null ? keep["g-femail"] : email) + '"></label>' +
      (G.err ? '<div class="g-err">' + esc(G.err) + "</div>" : "") +
      '<button class="g-btn box" data-act="gate-forgot"' + (G.busy ? " disabled" : "") + ">" + (G.busy ? '<span class="spinner"></span>' : "") + "送出重設要求</button>" +
      '<button class="g-link" data-act="gate-page" data-p="login">回到登入</button></div>' +
      (G.sent ? '<div class="g-modal"><div class="g-card" role="alertdialog" aria-modal="true"><div class="g-ok">' + GATE_ICON.check + '</div><h2 class="g-h">送出成功！</h2>' +
        '<p class="g-p" style="margin:0">已通知管理者，他會幫你設定新密碼，再告訴你。拿到新密碼後就能繼續你的旅程。</p>' +
        '<button class="g-btn" data-act="gate-page" data-p="login">我知道了</button></div></div>' : "");
  } else {
    const show = !!G.showPw;
    html = deco + '<div class="g-in"><div class="g-brand" data-act="gate-brand">english daily</div><h1 class="g-title">冒險登入</h1>' +
      '<label class="g-field">' + GATE_ICON.mail + '<input id="g-email" type="email" autocomplete="username" autocapitalize="off" spellcheck="false" placeholder="Email" aria-label="Email" value="' + esc(email) + '"></label>' +
      '<div class="g-field"><label for="g-pw" style="display:contents">' + GATE_ICON.lock + '</label><input id="g-pw" type="' + (show ? "text" : "password") + '" autocomplete="current-password" placeholder="密碼" aria-label="密碼" value="' + esc(keep["g-pw"] || "") + '">' +
        '<button class="g-eye" data-act="gate-eye" aria-label="' + (show ? "隱藏密碼" : "顯示密碼") + '">' + (show ? GATE_ICON.eye : GATE_ICON.eyeOff) + "</button></div>" +
      '<button class="g-forgot" data-act="gate-page" data-p="forgot">Forgot Password?</button>' +
      (Cloud.err ? '<div class="g-err">' + esc(Cloud.err) + "</div>" : "") +
      '<button class="g-btn" data-act="gate-login"' + (Cloud.busy ? " disabled" : "") + ">" + (Cloud.busy ? '<span class="spinner"></span>登入中' : "登入") + "</button>" +
      '<div class="g-note">註冊帳號（暫不開放）</div></div>';
  }
  el.innerHTML = html; el.hidden = false;
  if (focus && document.getElementById(focus)) document.getElementById(focus).focus();
}
function cloudAgo(t){
  if (!t) return "還沒同步";
  const sec = Math.max(0, Math.round((Cloud.now() - t) / 1000)), m = Math.floor(sec / 60);
  return sec < 10 ? "剛剛同步" : sec < 60 ? Math.floor(sec / 10) * 10 + " 秒前同步" : m < 60 ? m + " 分鐘前同步" : m < 1440 ? Math.floor(m / 60) + " 小時前同步" : Math.floor(m / 1440) + " 天前同步";
}
function syncLabel(){ return Cloud.err ? "同步失敗" : Cloud.pushing || Cloud.pulling || Cloud.pending() ? "同步中…" : cloudAgo(Cloud.cfg && Cloud.cfg.lastSync); }
/* keep "N 秒前同步" ticking while it's on screen */
setInterval(() => { const el = document.getElementById("sync-ago"); if (el && Cloud.cfg) el.textContent = syncLabel(); }, 5000);
function accountCardHTML(){
  if (!Cloud.on()) return "";
  const c = Cloud.cfg, n = Cloud.pending();
  return '<section class="card"><h2 style="font-size:20px">帳號</h2>' +
    '<div class="row between" style="align-items:center"><div><b>' + esc(c.name || c.email) + '</b><div class="small muted en">' + esc(c.email) + "</div></div>" +
      '<span class="pill' + (Cloud.err ? " bad" : "") + '" id="sync-ago">' + syncLabel() + "</span></div>" +
    (Cloud.err ? '<div class="err">' + esc(Cloud.err) + "</div>" : "") +
    '<div class="row"><button class="btn soft" style="flex:1" data-act="cloud-sync"' + (Cloud.busy ? " disabled" : "") + ">" + (Cloud.busy ? '<span class="spinner"></span>同步中' : "立即同步") + "</button></div>" +
    '<details class="ledger"><summary>修改密碼</summary><div class="stack" style="margin-top:10px">' +
      '<input class="input" id="cl-old" type="password" autocomplete="current-password" placeholder="目前的密碼" aria-label="目前的密碼">' +
      '<input class="input" id="cl-new" type="password" autocomplete="new-password" placeholder="新密碼（至少 6 個字）" aria-label="新密碼">' +
      (S.cloudPwMsg ? '<div class="' + (S.cloudPwMsg.ok ? "note ok" : "err") + '">' + esc(S.cloudPwMsg.text) + "</div>" : "") +
      '<button class="btn" data-act="cloud-pw">更新密碼</button></div></details></section>';
}
function adminHTML(){
  const a = S.adm || (S.adm = {}), users = a.users;
  if (!users && !a.busy && !a.tried && admKey()){ a.tried = true; setTimeout(() => ACT["adm-load"](null, true), 0); }
  let list = "";
  if (users) list = users.length ? '<div class="stack">' + users.map(u =>
      '<div class="adm-u"><div class="row between" style="align-items:center"><div style="min-width:0"><b>' + esc(u.name || "（沒有名字）") + '</b><div class="small muted en" style="overflow-wrap:anywhere">' + esc(u.email) + "</div>" + (u.reset_req ? '<div><span class="pill bad" style="margin-top:4px">要求重設密碼</span></div>' : "") + '<div class="small muted">' + u.items + " 項進度・" + (u.last_seen ? "最近登入 " + new Date(u.last_seen).toLocaleDateString() : "還沒登入過") + "</div></div>" +
        '<div class="row" style="gap:6px;flex:none;flex-wrap:wrap;justify-content:flex-end"><button class="btn soft sm" data-act="adm-detail" data-email="' + esc(u.email) + '">詳細資訊</button><button class="btn soft sm" data-act="adm-reset" data-email="' + esc(u.email) + '">重設密碼</button><button class="btn danger sm" data-act="adm-del" data-email="' + esc(u.email) + '">刪除</button></div></div>' +
        '<div class="row between" style="align-items:center;margin-top:8px"><span class="small"><b>電腦語音</b><span class="muted">（GPT-SoVITS、跟讀評分）</span></span><button class="switch" role="switch" aria-checked="' + !!u.voice + '" data-act="adm-voice" data-email="' + esc(u.email) + '" data-on="' + (u.voice ? 0 : 1) + '" aria-label="電腦語音"><span></span></button></div>' +
        (a.reset === u.email ? '<div class="row" style="margin-top:8px"><input class="input" id="adm-rp" type="text" autocomplete="off" placeholder="新密碼（至少 6 個字）" aria-label="新密碼"><button class="btn sm" data-act="adm-reset-go" data-email="' + esc(u.email) + '">確定</button></div>' : "") +
      "</div>").join("") + "</div>" : '<p class="muted small" style="margin:0">還沒有帳號。</p>';
  return '<div class="divider"></div><div><b>帳號管理</b></div>' +
    '<div class="row between" style="align-items:center"><span class="small muted">管理員：<b class="en">' + esc(admUser()) + '</b></span><button class="btn soft sm" data-act="adm-load"' + (a.busy ? " disabled" : "") + ">" + (a.busy ? '<span class="spinner"></span>' : "") + "重新整理</button></div>" +
    (a.err ? '<div class="err">' + esc(a.err) + "</div>" : "") + (a.ok ? '<div class="note ok">' + esc(a.ok) + "</div>" : "") + list +
    (users ? '<details class="ledger"' + (a.addOpen ? " open" : "") + '><summary>新增帳號</summary><div class="stack" style="margin-top:10px">' +
      '<input class="input" id="adm-name" autocomplete="off" placeholder="名字（例如：媽媽）" aria-label="名字">' +
      '<input class="input en" id="adm-email" type="email" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Email" aria-label="Email">' +
      '<input class="input" id="adm-pw" type="text" autocomplete="off" placeholder="密碼（至少 6 個字）" aria-label="密碼">' +
      '<label class="row" style="align-items:center;gap:8px;font-size:14px"><input type="checkbox" id="adm-voice" checked> 開通電腦語音（GPT-SoVITS、跟讀評分）</label>' +
      '<button class="btn" data-act="adm-add">建立帳號</button></div></details>' +
    "" : "");
}
/* the admin's name and password (Cloudflare: ADMIN_USER / ADMIN_KEY), kept only on this device after they were checked */
function admCreds(){ try { const c = JSON.parse(localStorage.getItem("eel-admin") || "null"); return c && c.key ? c : null; } catch (e) { return null; } }
function admKey(){ return (admCreds() || {}).key || ""; }
function admUser(){ return (admCreds() || {}).user || ""; }
function admForget(){ try { localStorage.removeItem("eel-admin"); sessionStorage.removeItem("eel-admin"); } catch (e) {} S.adm = null; }
function devOn(){ return !!set().devMode && !!admCreds(); }
async function admCheck(user, key){
  await Cloud.api("/admin/check", {admin:key, adminUser:user, body:{}});
  try { localStorage.setItem("eel-admin", JSON.stringify({user, key})); } catch (e) {}
}
function admLoginHTML(prefix){
  return '<div class="field"><label for="' + prefix + '-au">管理員帳號</label><input class="input en" id="' + prefix + '-au" autocomplete="username" autocapitalize="off" spellcheck="false" value="' + esc(admUser() || (S.admLast || "")) + '"></div>' +
    '<div class="field"><label for="' + prefix + '-ak">管理密碼</label><input class="input" id="' + prefix + '-ak" type="password" autocomplete="current-password"></div>';
}
/* turning on developer mode asks for the admin; the answer is checked by the server */
function admLoginBox(){
  return new Promise(resolve => {
    const d = $("#dialog");
    const draw = (err, busy) => {
      const au = ($("#dl-au") || {}).value, ak = ($("#dl-ak") || {}).value;
      d.innerHTML = '<div class="card" role="alertdialog" aria-modal="true"><h3>開發人員模式</h3>' + admLoginHTML("dl") + (err ? '<div class="err">' + esc(err) + "</div>" : "") +
        '<div class="row" style="justify-content:flex-end"><button class="btn soft" id="dlg-no">取消</button><button class="btn" id="dlg-ok"' + (busy ? " disabled" : "") + ">" + (busy ? '<span class="spinner"></span>確認中' : "確認") + "</button></div></div>";
      if (au != null) $("#dl-au").value = au;
      if (ak != null) $("#dl-ak").value = ak;
      $("#dlg-no").onclick = () => { d.hidden = true; d.innerHTML = ""; resolve(false); };
      $("#dlg-ok").onclick = go;
      d.querySelectorAll("input").forEach(i => i.onkeydown = e => { if (e.key === "Enter") go(); });
    };
    const go = async () => {
      const user = ($("#dl-au").value || "").trim(), key = $("#dl-ak").value || "";
      if (!user || !key){ draw("請輸入管理員帳號和管理密碼。"); return; }
      S.admLast = user; draw("", true);
      try { await admCheck(user, key); d.hidden = true; d.innerHTML = ""; resolve(true); }
      catch (e) { draw(e.message); }
    };
    d.hidden = false; draw("");
    setTimeout(() => { const i = $("#dl-au"); if (i) (i.value ? $("#dl-ak") : i).focus(); }, 30);
  });
}
function renderPrefs(){
  const items = [
    ["about", "關於我", hasAbout() ? aboutSummary() : "年齡、性別、興趣（選填）"],
    ["account", "帳號", Cloud.on() ? (Cloud.cfg.name || Cloud.cfg.email) + "・" + (Cloud.err ? "同步失敗" : cloudAgo(Cloud.cfg.lastSync)) : "登入後可以在其他裝置接著學"],
    ["ai", "AI 模型", PROVIDERS[aiState().provider].name + " · " + (aiState().model || "未選模型")],
    ["voice", "朗讀", set().voiceSource === "system" ? "系統聲音" : set().voiceSource === "pc" && Cloud.voiceOk() ? "GPT-SoVITS" : "Pocket TTS" + ((set().pocketVoice || {}).wavName ? "・你上傳的聲音" : "")],
    ["read", "閱讀", (LENGTHS[set().length] || LENGTHS.mid).label + "篇幅・" + TIERS[tierIdx()].name],
    ["data", "資料", "學習統計和金幣紀錄"]
  ];
  if (!S.prefPage) return '<section class="card"><h2 style="font-size:20px">設定</h2><div class="stack">' + items.map(([k, t, sub]) =>
    '<button class="menu-row" data-act="pref-open" data-p="' + k + '"><span><b>' + t + '</b><span class="small muted">' + esc(sub) + '</span></span><span class="chev" aria-hidden="true">›</span></button>').join("") + "</div></section>" +
    (Cloud.on() ? '<button class="prefs-logout" data-act="cloud-logout">登出</button>' : "");
  const parts = prefsParts();
  return '<div class="back-row"><button class="back-btn" data-act="pref-back" aria-label="回到設定">' + GATE_ICON.back + "</button></div>" + (parts[S.prefPage] || "");
}
function prefsParts(){
  setTimeout(fillAudioUsage, 0);
  const st = set();
  const parts = {ai:aiCardHTML(), account:accountCardHTML(), about:aboutCardHTML()};
  let html = "";
  const voices = TTS.voices;
  const pv = st.pcVoice || {}, pc = st.voiceSource === "pc";
  const pkv = st.pocketVoice || {};
  const spk = ICON.speaker.replace("<svg", '<svg width="18" height="18"');
  const vOk = Cloud.voiceOk();
  const src = st.voiceSource === "system" ? "system" : pc && vOk ? "pc" : "builtin";
  const srcBtn = (v, label) => '<button data-act="setting" data-key="voiceSource" data-val="' + v + '" aria-pressed="' + (src === v) + '"' + (v === "pc" && !vOk ? " disabled" : "") + ">" + label + "</button>";
  const sysVoices = '<select class="input" id="voice" data-act-change="voice" aria-label="系統聲音"><option value="">自動（美式英文）</option>' +
    voices.map(v => '<option value="' + esc(v.voiceURI) + '"' + (st.voice === v.voiceURI ? " selected" : "") + ">" + esc(v.name) + "（" + esc(v.lang) + "）</option>").join("") + "</select>" +
    (TTS.ok ? "" : '<div class="err">這個瀏覽器不支援系統聲音。</div>');
  /* the Pocket TTS voice: default, or one the user uploaded; also used for words when sentences go to the computer */
  const pocketBox = '<div class="pref-group"><div class="pref-h">Pocket TTS 的聲音</div>' +
      '<div class="voice-tile">' + ICON.speaker.replace("<svg", '<svg width="20" height="20"') +
        '<span class="vt-name">' + (pkv.wavName ? '<b>你上傳的聲音</b><span class="small muted en">' + esc(pkv.wavName) + "</span>" : "<b>預設聲音</b>") + "</span>" +
        (pkv.wavName ? '<button class="btn soft sm" data-act="pocket-wav-clear">改回預設</button>' : '<label class="btn soft sm" for="pocket-wav" style="margin:0">換成自己的</label>') + "</div>" +
      '<input type="file" id="pocket-wav" accept="audio/*" hidden data-act-change="pocket-wav"></div>' +
    '<div class="row between" style="align-items:center"><span class="small muted" id="audio-usage">已存的聲音：計算中…</span><button class="btn ghost sm" style="flex:none;white-space:nowrap" data-act="audio-clear">清除</button></div>';
  const SRC_ICON = {
    system:'<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="2.5" width="12" height="19" rx="2.5"/><path d="M10.5 18.5h3"/></svg>',
    builtin:'<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 10v4M8 7v10M12 4v16M16 8v8M20 11v2"/></svg>',
    pc:'<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="4" width="19" height="12.5" rx="2"/><path d="M8.5 20.5h7M12 16.5v4"/></svg>'
  };
  const srcCard = (v, label) => '<button class="src-card" data-act="setting" data-key="voiceSource" data-val="' + v + '" aria-pressed="' + (src === v) + '"' + (v === "pc" && !vOk ? " disabled" : "") + ">" + SRC_ICON[v] + "<span>" + label + "</span>" + (v === "pc" && !vOk ? '<i class="src-lock">未開通</i>' : "") + "</button>";
  parts.voice = '<section class="card pref-card"><div class="row between" style="align-items:center"><h2 style="font-size:20px;margin:0">朗讀</h2>' +
      '<button class="tip-btn" data-act="voice-tip" aria-expanded="' + !!S.voiceTip + '" aria-label="說明">?</button></div>' +
    (S.voiceTip ? '<div class="note">唸不出來時會自動換下一個：GPT-SoVITS → Pocket TTS → 系統聲音。' + (vOk ? "" : "GPT-SoVITS 要管理員幫你的帳號開通才能用。") + "</div>" : "") +
    '<div class="pref-group"><div class="pref-h">朗讀聲音</div><div class="src-cards">' + srcCard("system", "系統聲音") + srcCard("builtin", "Pocket TTS") + srcCard("pc", "GPT-SoVITS") + "</div></div>" +
    (src === "system" ? '<div class="pref-group"><div class="pref-h">系統聲音</div>' + sysVoices + "</div>" : "") +
    (src === "builtin" ? pocketBox : "") +
    '<div class="pref-group"><div class="pref-h">試聽</div><div class="row" style="gap:8px"><button class="btn soft" style="flex:1" data-act="say" data-text="magic">' + spk + '單字</button>' +
      '<button class="btn soft" style="flex:1" data-act="say" data-text="Small steps. Every day. That is how you get better.">' + spk + "句子</button></div></div>" +
    '<div class="pref-group"><div class="row between" style="align-items:center"><label class="pref-h" for="rate">速度</label><span class="val-pill" id="rate-v">' + st.rate.toFixed(1) + "×</span></div>" +
      '<input type="range" id="rate" min="0.5" max="1.2" step="0.1" value="' + st.rate + '" data-act-change="rate"><div class="row between small muted"><span>慢</span><span>快</span></div></div>' +
    (!vOk ? "" : '<div class="pref-row"><span><b>跟讀評分</b>' + (S.asrPing && S.asrPing !== "checking" ? '<span class="small" style="margin-left:8px;color:' + (/^ok:/.test(S.asrPing) ? "#3E9C7A" : "#C97A00") + '">' + esc(S.asrPing.replace(/^ok:/, "")) + "</span>" : "") + "</span>" +
      '<button class="btn soft sm" data-act="asr-ping"' + (S.asrPing === "checking" ? " disabled" : "") + ">" + (S.asrPing === "checking" ? '<span class="spinner"></span>測試中' : "測試連線") + "</button></div>") +
    (src !== "system" ? '<details class="ledger"><summary>備用的系統聲音</summary><div class="stack" style="margin-top:10px">' + sysVoices + "</div></details>" : "") + "</section>";

  const seg = (key, opts) => '<div class="seg" role="group">' + opts.map(o => '<button data-act="setting" data-key="' + key + '" data-val="' + o[0] + '" aria-pressed="' + (st[key] === o[0]) + '">' + o[1] + "</button>").join("") + "</div>";
  const opt = (key, v, inner) => '<button data-act="setting" data-key="' + key + '" data-val="' + v + '" aria-pressed="' + (st[key] === v) + '">' + inner + "</button>";
  parts.read = '<section class="card pref-card"><h2 style="font-size:20px;margin:0">閱讀</h2>' +
    '<div class="read-preview" aria-hidden="true"><span class="small muted">預覽</span><p>Small steps, every day. That is how you get better.</p></div>' +
    '<div class="pref-group"><div class="pref-h">字體大小</div><div class="seg big">' +
      opt("font", "s", '<span style="font-size:14px">A</span>') + opt("font", "m", '<span style="font-size:18px">A</span>') + opt("font", "l", '<span style="font-size:23px">A</span>') + "</div></div>" +
    '<div class="pref-group"><div class="pref-h">文章長度</div><div class="seg big">' +
      ["short","mid","long"].map(k => opt("length", k, "<b>" + LENGTHS[k].label + '</b><small>' + LENGTHS[k].min + " 分鐘</small>")).join("") + "</div></div>" +
    '<div class="pref-group"><div class="pref-h">文章類型</div><div class="seg big">' +
      opt("genre", "alt", "<b>輪流</b><small>情感＋知識</small>") + opt("genre", "story", "<b>情感</b><small>小故事</small>") + opt("genre", "know", "<b>知識</b><small>長知識</small>") + "</div></div>" +
    '<div class="pref-group"><div class="pref-h">難度</div><div class="tier-grid">' +
      TIERS.map((t, i) => '<button data-act="set-tier" data-i="' + i + '" aria-pressed="' + (tierIdx() === i) + '"><span class="tier-n">' + (i + 1) + "</span>" + t.name + "</button>").join("") +
      '</div><div class="tier-desc">' + esc(TIERS[tierIdx()].desc) + "</div></div></section>";

  const w = curWeek(), ps = progressStats();
  parts.data = '<section class="card"><h2 style="font-size:20px">資料</h2>' +
    '<div class="stats"><div><b>' + (w ? w.n : 0) + '</b><span>目前週數</span></div><div><b>' + ps.weeksDone + '</b><span>完成週數</span></div><div><b>' + ps.articlesRead + '</b><span>讀完篇數</span></div><div><b>' + ps.streak + '</b><span>連續天數</span></div></div>' +
    ledgerHTML() +
    '<div class="divider"></div><div class="row between" style="align-items:center"><div><b>開發人員</b></div>' +
      '<button class="switch" role="switch" aria-checked="' + devOn() + '" data-act="dev-toggle" aria-label="開發人員模式"><span></span></button></div>' +
    (devOn() ? '<div class="dev-grid">' +
      '<div class="field"><label for="dev-coins">金幣</label><input class="input en" id="dev-coins" type="number" inputmode="numeric" min="0" step="1" value="' + wallet().balance + '"></div>' +
      '<div class="field"><label for="dev-food">糧食</label><input class="input en" id="dev-food" type="number" inputmode="numeric" min="0" step="1" value="' + city().food + '"></div>' +
      '<div class="field"><label for="dev-know">知識</label><input class="input en" id="dev-know" type="number" inputmode="numeric" min="0" step="1" value="' + knowledge() + '"></div>' +
      '<div class="field dev-time"><label for="dev-time">現在時間（測試用）</label><input class="input en" id="dev-time" type="datetime-local" step="60" value="' + localDT(new Date()) + '" data-init="' + localDT(new Date()) + '"></div></div>' +
      (window.__timeOffset ? '<div class="row between" style="align-items:center"><span class="small" style="color:#C93636">正在用測試時間</span><button class="btn soft sm" data-act="dev-time-reset">回到現在時間</button></div>' : "") +
      '<button class="btn block" data-act="dev-apply">套用</button>'+ adminHTML() : "") +
    '<div class="divider"></div><div class="row"><button class="btn danger" data-act="reset">全部重來</button></div></section>';
  return parts;
}
/* 詳細資訊: one person's 關於我 and progress, for the admin */
function admDetailHTML(o){
  const head = '<div class="grab" aria-hidden="true"></div><div class="sh-head"><div class="sh-word phrase" style="flex:1;min-width:0">' + esc(o.name || o.email) + '</div><button class="icon-btn" data-act="close-sheet" aria-label="關閉">×</button></div>';
  if (o.err) return head + '<div class="err">' + esc(o.err) + "</div>";
  const d = o.data; if (!d) return head + '<p class="muted"><span class="spinner"></span> 讀取中…</p>';
  const a = d.about || {}, row = (k, v) => '<div class="ad-row"><span>' + k + "</span><b>" + (v === "" || v == null ? '<span class="muted">—</span>' : esc(String(v))) + "</b></div>";
  const age = ageNum(a) ? ageNum(a) + " 歲" : "", g = (GENDERS.find(x => x[0] === a.gender) || [])[1];
  const ints = (a.interests || []).map(k => (INTERESTS.find(x => x[0] === k) || [])[1]).filter(Boolean).join("、");
  const day = t => t ? new Date(t).toLocaleDateString("zh-TW") : "";
  return head + '<div class="small muted en" style="margin:-6px 0 6px;overflow-wrap:anywhere">' + esc(o.email) + "</div>" +
    '<div class="ad-sec">關於我</div>' + row("年齡", age) + row("性別", g) + row("興趣", ints) +
    '<div class="ad-sec">學習</div>' + row("排位", Number.isInteger(d.tier) && TIERS[d.tier] ? TIERS[d.tier].name : "") + row("目前週數", d.currentWeek != null ? "第 " + (d.currentWeek + 1) + " 週" : "") +
      row("學習天數", d.study.days + " 天") + row("最後學習", d.study.last) + row("開始使用", day(d.createdAt || (d.user || {}).created_at)) + row("最後上線", day((d.user || {}).last_seen)) +
    '<div class="ad-sec">金幣與城市</div>' + row("金幣", d.coins.balance + "（共賺 " + d.coins.earned + "）") + row("市中心", (HALL_TIERS[Math.ceil(d.city.hallLv / 3) - 1] || "") + " Lv" + d.city.hallLv) +
      row("知識", d.city.knowledge) + row("居民 / 建築", d.city.residents + " 位 / " + d.city.buildings + " 棟") +
    '<div class="ad-sec">AI 用量（最近 7 天）</div>' + (d.ai.length ? d.ai.map(x => row(x.day, x.n + " 次")).join("") : row("—", ""));
}
