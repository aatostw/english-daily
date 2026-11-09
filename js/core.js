/* =========================================================
   State and small helpers
   ========================================================= */
const S = {
  canStore:false, sample:null,
  profile:null, weeks:{}, arts:{}, convs:{}, bank:{}, news:{},
  ctx:{}, view:"home", onb:{step:0, stage:0}, pick:null, chats:{}, chatDay:null, prefPage:null,
  busy:{}, err:{}, reader:null, sheet:null, talk:{}, wordFilter:"all", test:{}, provTest:{}, provEdit:"gemini", customTask:{}
};
const $ = (sel, root = document) => root.querySelector(sel);
const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const clone = o => JSON.parse(JSON.stringify(o));
const pad = n => String(n).padStart(2, "0");
const escRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const set = () => (S.profile && S.profile.settings) || defaultSettings();
const sleep = ms => new Promise(r => setTimeout(r, ms));
function slug(s){ return String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80) || "w"; }

function ymd(d){ return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
function todayStr(){ return ymd(new Date()); }
function localDT(d){ const p = n => String(n).padStart(2, "0"); return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()) + "T" + p(d.getHours()) + ":" + p(d.getMinutes()); }
function parseYmd(s){ const [y, m, d] = s.split("-").map(Number); return Date.UTC(y, m - 1, d); }
function addDays(s, n){ const d = new Date(parseYmd(s) + n * 864e5); return d.getUTCFullYear() + "-" + pad(d.getUTCMonth() + 1) + "-" + pad(d.getUTCDate()); }
function diffDays(a, b){ return Math.round((parseYmd(b) - parseYmd(a)) / 864e5); }
function mondayOf(s){ const dow = (new Date(parseYmd(s)).getUTCDay() + 6) % 7; return addDays(s, -dow); }
function md(s){ const [, m, d] = s.split("-").map(Number); return m + "/" + d; }

function curWeek(){ return S.profile ? S.weeks[S.profile.currentWeek] : null; }
function dayIdx(w){ return diffDays(w.monday, todayStr()); }
function stageOf(pid){ return Math.floor(pid / 10); }
function weekPats(w){
  const m = {A:PATTERNS[w.patterns[0]], B:PATTERNS[w.patterns[1]]};
  (w.review || []).forEach((pid, i) => { m["R" + (i + 1)] = PATTERNS[pid]; });
  return m;
}
/* What you may use in the chat with Lisa on day d (0 = Monday): everything taught up to that day.
   On Sunday (6) everything is revealed. */
function revealedFor(w, d){
  const P = weekPats(w);
  if (d >= 6) return {words:ALL6.filter(i => w.words[i]), pats:Object.keys(P)};
  const ws = new Set(), ps = new Set();
  for (let i = 0; i <= Math.max(0, Math.min(5, d)); i++){
    DAY_PLAN[i].words.forEach(x => ws.add(x));
    DAY_PLAN[i].use.forEach(u => { if (u === "R") (w.review || []).forEach((_, j) => ps.add("R" + (j + 1))); else ps.add(u); });
  }
  return {words:[...ws].sort((a, b) => a - b).filter(i => w.words[i]), pats:Object.keys(P).filter(k => ps.has(k))};
}
function chatDayFor(w){ const di = dayIdx(w); return di < 0 ? 0 : Math.min(di, 6); }
function convFor(w, d){ return d >= 6 ? S.convs[w.n] : S.chats[w.n + "-" + d]; }
function convKey(w, d){ return d >= 6 ? "conv-" + w.n : "chat-" + w.n + "-" + d; }
function curChat(){ const w = curWeek(); if (!w) return {}; const d = S.chatDay == null ? chatDayFor(w) : S.chatDay; return {w, d, conv:convFor(w, d), rev:revealedFor(w, d)}; }
function artsOf(n, d){
  return Object.values(S.arts).filter(a => a.week === n && (d == null || a.day === d)).sort((a, b) => (a.day - b.day) || (a.k - b.k));
}
function genreFor(d, k){
  const g = set().genre;
  let base = g === "story" ? "story" : g === "know" ? "know" : (d % 2 === 0 ? "story" : "know");
  if (g === "alt" && k % 2 === 1) base = base === "story" ? "know" : "story";
  return base;
}
const GENRE = {story:"情感短文", know:"知識短文", dialog:"生活對話", humor:"幽默小品", diary:"日記書信", tips:"實用技巧", custom:"自訂"};
const GENRE_PICK = ["story", "know", "dialog", "humor", "diary", "tips"];
function genreLabel(a){ return a.genre === "custom" ? (a.topic ? "自訂：" + a.topic : "自訂") : (GENRE[a.genre] || "短文"); }

function toast(msg){
  const t = $("#toast"); t.textContent = msg; t.hidden = false;
  clearTimeout(toast._t); toast._t = setTimeout(() => { t.hidden = true; }, 2800);
}
function confirmBox(title, body, okLabel, danger){
  return new Promise(resolve => {
    const d = $("#dialog");
    d.innerHTML = '<div class="card" role="alertdialog" aria-modal="true"><h3>' + esc(title) + '</h3><p class="muted" style="margin:0">' + esc(body) + '</p><div class="row" style="justify-content:flex-end"><button class="btn soft" id="dlg-no">取消</button><button class="btn ' + (danger ? "danger" : "") + '" id="dlg-ok">' + esc(okLabel) + '</button></div></div>';
    d.hidden = false;
    const done = v => { d.hidden = true; d.innerHTML = ""; resolve(v); };
    $("#dlg-no").onclick = () => done(false);
    $("#dlg-ok").onclick = () => done(true);
    $("#dlg-ok").focus();
  });
}
