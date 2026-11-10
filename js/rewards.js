/* ---------- coins (shared with the in-app mini game later) ---------- */
const DAILY_COIN_CAP = 1000;
function newWallet(){ return {kind:"wallet", balance:0, earned:0, spent:0, ledger:[], items:[], daily:{}, milestones:{}}; }
function wallet(){ if (!S.wallet) S.wallet = newWallet(); return S.wallet; }
/* Adds coins (within today's cap), records why, saves, and shows a "+N" pop. Returns what was given. */
function earn(amount, reason){
  if (S.city && S.city.boosts && S.city.boosts.active > 0 && !/^城市/.test(reason) && amount > 0){
    amount *= 2; reason += "（雙倍卡）"; S.city.boosts.active--; Store.set("city", S.city).catch(() => {});
  }
  const W = wallet(), d = todayStr(), got = W.daily[d] || 0;
  const give = Math.max(0, Math.min(amount, DAILY_COIN_CAP - got));
  if (!give){ if (amount > 0) toast("今天的金幣已經拿滿 " + DAILY_COIN_CAP + " 了，明天再來！"); return 0; }
  W.balance += give; W.earned += give; W.daily[d] = got + give;
  W.ledger.push({at:Date.now(), amount:give, reason});
  if (W.ledger.length > 500) W.ledger = W.ledger.slice(-500);
  Object.keys(W.daily).forEach(k => { if (diffDays(k, d) > 14) delete W.daily[k]; });
  Store.set("wallet", W).catch(() => {});
  coinPop(give); renderCoins();
  if (S.reader || S.view === "talk" || S.cityChat) toast("+" + give + " 金幣・" + reason);
  return give;
}
/* Money back (e.g. tearing a building down): not a reward, so the daily cap doesn't apply. */
function refund(amount, reason){
  amount = Math.floor(amount); if (amount <= 0) return 0;
  const W = wallet(); W.balance += amount; W.spent = Math.max(0, W.spent - amount);
  W.ledger.push({at:Date.now(), amount, reason}); if (W.ledger.length > 500) W.ledger = W.ledger.slice(-500);
  Store.set("wallet", W).catch(() => {}); coinPop(amount); renderCoins(); return amount;
}
/* For the mini game: spends coins if there are enough. */
function spend(amount, reason, item){
  const W = wallet();
  if (amount <= 0 || W.balance < amount) return false;
  W.balance -= amount; W.spent += amount;
  W.ledger.push({at:Date.now(), amount:-amount, reason});
  if (item) W.items.push(Object.assign({boughtAt:Date.now()}, item));
  Store.set("wallet", W).catch(() => {}); renderCoins();
  return true;
}
function checkStreakBonus(){
  const n = streakDays(), W = wallet();
  const bonus = {3:20, 7:50, 30:200}[n];
  if (!bonus) return;
  const key = n + "@" + addDays(todayStr(), -(n - 1));
  if (W.milestones[key]) return;
  W.milestones[key] = Date.now();
  earn(bonus, "連續學習 " + n + " 天");
}
function checkWeekBonus(w){
  const W = wallet(), key = "week-" + w.n;
  if (W.milestones[key]) return;
  const allRead = [0,1,2,3,4,5].every(d => artsOf(w.n, d).some(a => a.read));
  const conv = S.convs[w.n];
  if (!allRead || !(conv && conv.done)) return;
  W.milestones[key] = Date.now();
  earn(50, "完成第 " + w.n + " 週");
}
function renderCoins(){
  const c = $("#coins"); if (!c) return;
  const on = !!S.profile;
  c.hidden = !on;
  c.querySelector("b").textContent = wallet().balance.toLocaleString();
  const f = $("#stat-food"), k = $("#stat-know");
  f.hidden = k.hidden = !on;
  if (on){ f.querySelector("b").textContent = city().food.toLocaleString(); k.querySelector("b").textContent = knowledge().toLocaleString(); }
}
function coinPop(n){
  const c = $("#coins"); if (!c) return;
  const p = document.createElement("span");
  p.className = "coin-pop"; p.textContent = "+" + n;
  c.appendChild(p); setTimeout(() => p.remove(), 1300);
}
function ledgerHTML(){
  const W = wallet(), rows = W.ledger.slice(-30).reverse();
  return '<details class="ledger"><summary>金幣紀錄（總共賺 ' + W.earned.toLocaleString() + "・花掉 " + W.spent.toLocaleString() + "）</summary>" +
    (rows.length ? rows.map(r => { const d = new Date(r.at); return '<div class="row between small"><span>' + (d.getMonth() + 1) + "/" + d.getDate() + "　" + esc(r.reason) + '</span><b class="' + (r.amount < 0 ? "neg" : "pos") + '">' + (r.amount > 0 ? "+" : "") + r.amount + "</b></div>"; }).join("") : '<p class="muted small" style="margin:0">還沒有紀錄。讀完一篇文章就能拿到第一筆金幣。</p>') +
    "</details>";
}
function logActivity(type){
  if (!S.log) S.log = {kind:"log", days:{}};
  const d = todayStr(), day = S.log.days[d] || (S.log.days[d] = {read:0, practice:0, talk:0});
  day[type] = (day[type] || 0) + 1;
  Store.set("log", S.log).catch(() => {});
}
/* 學習歷程: how well each pattern and word is being used, and daily scores, kept from now on.
   m.p[pid] / m.w[word] = {n: times tried, ok: times right, last: date}; day.pr = [right, tried], day.sh = [sum, count], day.tk = [sum, count] */
function logResult(kind, id, ok){
  if (!S.log) S.log = {kind:"log", days:{}};
  const m = S.log.m || (S.log.m = {p:{}, w:{}}), box = m[kind] || (m[kind] = {}), key = String(id).toLowerCase();
  const x = box[key] || (box[key] = {n:0, ok:0, last:""});
  x.n++; if (ok) x.ok++; x.last = todayStr();
  Store.set("log", S.log).catch(() => {});
}
function logScore(field, value){
  if (!S.log) S.log = {kind:"log", days:{}};
  const d = todayStr(), day = S.log.days[d] || (S.log.days[d] = {read:0, practice:0, talk:0}), v = day[field] || (day[field] = [0, 0]);
  v[0] += value; v[1] += 1;
  Store.set("log", S.log).catch(() => {});
}
function streakDays(){
  const days = (S.log && S.log.days) || {};
  const active = d => { const x = days[d]; return !!x && (x.read || x.practice || x.talk); };
  let d = todayStr();
  if (!active(d)) d = addDays(d, -1);
  let n = 0;
  while (active(d)){ n++; d = addDays(d, -1); }
  return n;
}
function progressStats(){
  const arts = Object.values(S.arts);
  return {
    currentWeek:S.profile ? S.profile.currentWeek : 0,
    weeksDone:Object.values(S.convs).filter(c => c.done).length,
    articles:arts.length,
    articlesRead:arts.filter(a => a.read).length,
    savedWords:Object.keys(S.bank).length,
    streak:streakDays()
  };
}
