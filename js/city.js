/* =========================================================
   我的城市 — a small island town paid for with coins earned by practising.
   Buildings bring residents; feed them and they ask for help in English;
   good answers give random gifts (outfit parts, decorations, double-coin cards).
   ========================================================= */
/* every building levels up for ever; each 3 levels is one 階 (tier). Going up a tier is a renovation and can't pass the city center's tier.
   tier = which 階 a building's tier unlocks it at */
const CITY_BUILDINGS = {
  hall:{name:"市中心", price:0, residents:0, desc:"整座城的中心", fixed:true, tier:1},
  house:{name:"住家", price:80, residents:2, desc:"住 2 位居民・每升一級多 1 位", grow:true, tier:1},
  road:{name:"道路", price:10, residents:0, desc:"要貼著建築或道路，把建築接上市中心", tier:1},
  farm:{name:"農田", price:100, residents:1, desc:"農夫 1 位・每天產 2 份糧食", food:true, tier:1},
  park:{name:"小公園", price:60, residents:0, desc:"讓島上更漂亮・升級後居民請求變多", fun:true, tier:1},
  cafe:{name:"商店", price:120, residents:1, desc:"老闆 1 位・每天賺金幣（不算學習上限）", coins:true, tier:2},
  books:{name:"書店", price:150, residents:1, desc:"老闆 1 位・有學習的那天產知識", know:true, tier:2},
  clinic:{name:"診所", price:180, residents:1, desc:"醫生 1 位・全城產量提高", boost:true, tier:3},
  landmark:{name:"地標", price:2000, residents:0, desc:"每座城一棟・全城產量 +20%・跟著時代變樣子", boost:true, one:true, tier:6}
};
/* the town walks through human history: the city center sets the era (階), and every building has three looks in each era */
const HALL_TIERS = ["部落中心", "城邦", "城堡", "市政廳", "工業都市", "都市中心", "宇宙文明中心"];
const ERA_NAMES = ["部落時代", "古典時代", "中世紀", "文藝復興", "工業時代", "現代", "未來"];
const HALL_MAX = HALL_TIERS.length * 3;
const CITY_LOOKS = {
  house:[["茅草屋", "泥土屋", "石屋"], ["木石屋", "磚瓦屋", "庭院宅邸"], ["木筋屋", "石造民宅", "莊園宅邸"], ["聯排屋", "商人宅邸", "宮殿宅邸"], ["工人排屋", "紅磚公寓", "鐵窗公寓"], ["住宅大樓", "摩天公寓", "綠能大樓"], ["未來住宅", "浮空住宅", "太空居住艙"]],
  farm:[["採集地", "麥田", "灌溉田"], ["橄欖園", "葡萄園", "莊園農地"], ["三圃田", "水車磨坊", "修道院農園"], ["圍欄農場", "風車農場", "莊園溫室"], ["蒸汽農場", "曳引機農場", "大穀倉"], ["溫室", "室內農場", "垂直農場"], ["科技農場", "水耕穹頂", "太空農場"]],
  park:[["營火空地", "聚會圈", "石陣"], ["集會廣場", "雕像廣場", "露天劇場"], ["修道院花園", "市集廣場", "城堡庭園"], ["噴泉廣場", "幾何花園", "宮廷花園"], ["公共公園", "玻璃溫室", "遊樂園"], ["中央公園", "空中花園", "運動公園"], ["生態穹頂", "全像公園", "星空花園"]],
  cafe:[["以物易物攤", "交易小屋", "貿易營地"], ["小酒館", "市集攤", "商行"], ["酒館", "旅店", "行會會館"], ["咖啡館", "商會", "交易所"], ["百貨公司", "銀行", "證券交易所"], ["購物中心", "商業大樓", "金融中心"], ["星際商站", "貿易港", "銀河交易所"]],
  books:[["故事圈", "壁畫洞穴", "石刻碑"], ["卷軸館", "學園", "大圖書館"], ["抄寫室", "修道院圖書館", "大學"], ["印刷坊", "書店", "皇家圖書館"], ["公共圖書館", "報社", "科學院"], ["大學", "研究中心", "資料中心"], ["知識塔", "AI 中心", "銀河資料庫"]],
  clinic:[["草藥小屋", "巫醫屋", "療癒營地"], ["公共浴場", "醫神廟", "醫學院"], ["藥草房", "修道院醫院", "救濟院"], ["藥房", "醫院", "解剖學院"], ["診所", "醫院", "疫苗研究所"], ["醫學中心", "急救中心", "生技中心"], ["再生醫學中心", "奈米醫療艙", "星際醫療站"]]
};
const LANDMARK_LOOKS = ["巨石陣", "神殿", "大教堂", "圓頂大教堂", "鐵塔", "摩天塔", "太空電梯"];
function lookName(key, lv){
  if (key === "landmark") return LANDMARK_LOOKS[hallTier(city()) - 1];
  const L = CITY_LOOKS[key]; if (!L) return CITY_BUILDINGS[key].name;
  const t = Math.min(tierOf(lv), L.length); return L[t - 1][(lv - 1) % 3];
}
/* what each evolution needs (index = the tier being reached) */
const EVOLVE = [null, null,
  {know:300, people:6, allLinked:true},
  {know:800, people:14, renovated:3, food:10},
  {know:1500, people:24, clinic:true, renovated:6},
  {know:2500, people:40},
  {know:4000, people:60},
  {know:6000, people:80, landmark:true}];
const CITY_DECOS = {statue:"公園雕像", fountain:"噴水池", sakura:"櫻花樹", lighthouse:"燈塔"};
const CITY_PARTS = {
  hat:{label:"帽子", items:{none:"不戴", cap:"棒球帽", beanie:"毛帽", straw:"草帽", crown:"皇冠"}},
  glasses:{label:"眼鏡", items:{none:"不戴", round:"圓框眼鏡", sun:"墨鏡", star:"星星眼鏡"}},
  outfit:{label:"服裝", items:{tee:"T 恤", hoodie:"帽 T", raincoat:"雨衣", suit:"西裝", astro:"太空裝"}}
};
const CITY_PART_PRICE = {cap:60, beanie:60, round:60, hoodie:80, raincoat:80};   /* the rest only come as gifts */
const CITY_RARE = new Set(["crown", "star", "astro", "lighthouse"]);
const CITY_FOOD = {n:10, price:20};
const CITY_NAMES = ["Amy","Ben","Coco","Dan","Ella","Finn","Gina","Hugo","Ivy","Jack","Kiki","Leo","Mia","Noah","Olive","Pete","Rosa","Sam","Tina","Yuki","Zoe","Max","Lily","Owen"];
const CITY_COLORS = ["#E57373","#64B5F6","#81C784","#FFB74D","#BA68C8","#4DB6AC","#F06292","#A1887F"];

/* 知識: only goes up, earned by actually learning; the city center needs it to evolve */
function knowledge(){ return (S.city && S.city.knowledge) || 0; }
function gainKnow(n, reason){
  if (!S.profile || !(n > 0)) return;
  const c = city(), before = c.knowledge || 0;
  c.knowledge = before + n; saveCity();
  const goal = evolveGoal(c);
  if (goal && goal.know > before && goal.know <= c.knowledge) setTimeout(() => toast("知識 " + c.knowledge + "，夠讓市中心進化成「" + goal.name + "」了！"), 1600);
}
function newCity(){
  return {kind:"city", level:1, food:10, tiles:{}, residents:[], avatar:{hat:"none", glasses:"none", outfit:"tee"},
    owned:{hat:["none"], glasses:["none"], outfit:["tee"], deco:[]}, boosts:{double:0, active:0},
    day:{date:"", fed:false, requests:[]}, giftsGot:0};
}
function city(){
  if (!S.city) S.city = newCity();
  const c = S.city, t = todayStr();
  if (c.day.date !== t) c.day = {date:t, fed:false, requests:[]};
  /* every town has a city center in the middle; an older town's building there moves aside */
  if (!c.tiles["0,0"] || c.tiles["0,0"].b !== "hall"){
    const old = c.tiles["0,0"]; c.tiles["0,0"] = {b:"hall", lv:1};
    if (old){
      const spot = cityNear("0,0").concat(cityTiles(c).map(([q, r]) => q + "," + r)).find(k => !c.tiles[k]);
      if (spot){ c.tiles[spot] = old; c.residents.forEach(p => { if (p.home === "0,0") p.home = spot; }); }
      else if (old.d) c.owned.deco.push(old.d);
    }
  }
  /* every building takes one plot (older towns had big buildings spread over 2-3); each one has a front door */
  Object.keys(c.tiles).forEach(k => { const it = c.tiles[k]; if (it.part) delete c.tiles[k]; else if (it.cells) delete it.cells; });
  const hall = c.tiles["0,0"]; if (!(hall.face >= 0 && hall.face < 6)) hall.face = autoFace(c, "0,0");
  /* plots are bought one by one; in an older town every plot already in use counts as bought */
  if (!Array.isArray(c.land)) c.land = Object.keys(c.tiles);
  Object.keys(c.tiles).forEach(k => { const it = c.tiles[k]; if (hasDoor(it) && !(it.face >= 0 && it.face < 6)) it.face = autoFace(c, k); });
  /* v2: bakeries and markets became farms; the island never shrinks from what an older town had */
  if (!c.v2){
    c.v2 = 1; c.minR = hallLv(c) + 1;
    Object.values(c.tiles).forEach(it => { if (it.b === "bakery" || it.b === "market") it.b = "farm"; });
  }
  /* bought land with nothing on it is 沙地 */
  (c.land || []).forEach(k => { if (!c.tiles[k] && k !== "0,0") c.tiles[k] = {g:"sand"}; });
  /* farms, cafés and the center make things once a day; it waits (up to 2 days' worth) until you harvest */
  if (!c.prod) c.prod = {date:t, store:0};
  if (c.prod.date !== t){
    const days = Math.max(0, Math.min(2, diffDays(c.prod.date, t))), d = cityDaily(c), p = c.prod;
    c.prod = {date:t, store:Math.min(d.food * 2, (p.store || 0) + d.food * days), coins:Math.min(d.coins * 2, (p.coins || 0) + d.coins * days), know:p.know || 0, studied:p.studied || ""};
  }
  return c;
}
/* ---------- levels, roads and food from shops ---------- */
const CITY_DIRS = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];
/* the ground under a building */
const CITY_GROUNDS = {sand:["沙地", 0xF2E6CE, "#efe2c6"], grass:["草地", 0xA8CF7C, "#a8d88a"], stone:["石板", 0xCFCAC2, "#cfcac2"], wood:["木棧板", 0xC99A6B, "#c99a6b"], brick:["紅磚", 0xC9826A, "#c9826a"], white:["白石", 0xF4F5F2, "#f4f5f2"]};
function tileLv(it){ return (it && it.lv) || 1; }
function cityNear(k){ const [q, r] = k.split(",").map(Number); return CITY_DIRS.map(([a, b]) => (q + a) + "," + (r + b)); }
function tierOf(lv){ return Math.ceil((lv || 1) / 3); }
function hallLv(c){ const h = c.tiles["0,0"]; return h && h.b === "hall" ? tileLv(h) : 1; }
function hallTier(c){ return tierOf(hallLv(c)); }
function hallName(lv){ return HALL_TIERS[tierOf(lv) - 1]; }
function anchorOf(c, k){ return k; }
function hasDoor(it){ return !!(it && it.b && it.b !== "road"); }
function hexDist(k){ const [q, r] = k.split(",").map(Number); return (Math.abs(q) + Math.abs(r) + Math.abs(q + r)) / 2; }
function doorKey(c, k){ const it = c.tiles[k]; return cityNear(k)[(it && it.face >= 0) ? it.face : 5]; }
/* the road network that starts at the city center (roads may join it on any side) */
function cityRoads(c){
  const roads = new Set(), stack = [];
  cityNear("0,0").forEach(n => { if (c.tiles[n] && c.tiles[n].b === "road"){ roads.add(n); stack.push(n); } });
  while (stack.length){ const k = stack.pop(); cityNear(k).forEach(n => { const t = c.tiles[n]; if (t && t.b === "road" && !roads.has(n)){ roads.add(n); stack.push(n); } }); }
  return roads;
}
/* which way a new building's door should face: a road that reaches the center, then the center, then any road, then toward the middle */
function autoFace(c, k){
  const near = cityNear(k), roads = cityRoads(c);
  if (k === "0,0"){ const r = near.findIndex(n => c.tiles[n] && c.tiles[n].b === "road"); return c.tiles["0,1"] && c.tiles["0,1"].b === "road" ? 5 : r >= 0 ? r : 5; }
  let i = near.findIndex(n => roads.has(n)); if (i >= 0) return i;
  i = near.indexOf("0,0"); if (i >= 0) return i;
  i = near.findIndex(n => c.tiles[n] && c.tiles[n].b === "road"); if (i >= 0) return i;
  let best = 5, bd = 1e9; near.forEach((n, j) => { const d = hexDist(n); if (d < bd){ bd = d; best = j; } });
  return best;
}
/* a building reaches the city center only through its front door: the plot in front of it is the center, or a road that leads back to it */
function cityLinked(c){
  const roads = cityRoads(c), linked = new Set(["0,0"]);
  const hallDoor = doorKey(c, "0,0");
  Object.keys(c.tiles).forEach(k => { if (k === "0,0" || !hasDoor(c.tiles[k])) return; const d = doorKey(c, k); if (d === "0,0" || roads.has(d)) linked.add(k); });
  return linked;
}
function isLinked(c, k, L){ return (L || cityLinked(c)).has(anchorOf(c, k)); }
function activeResidents(c){ const L = cityLinked(c); return c.residents.map((p, i) => L.has(p.home) ? i : -1).filter(i => i >= 0); }
/* what one building gives per level (lv counts on for ever; t = its tier, i = 0..2 inside the tier) */
function bStat(key, lv){
  const t = tierOf(lv), i = (lv - 1) % 3;
  if (key === "hall") return {food:2 * lv, reqs:Math.min(8, 2 + lv)};
  if (key === "house") return {people:lv + 1};
  /* from the 2nd tier on, each tier ends 1.6× (cafés 1.5×) above the last one, so a renovation is always a step up */
  if (key === "farm") return {food:t === 1 ? [2, 4, 7][i] : Math.round(7 * Math.pow(1.6, t - 2) * [1.15, 1.35, 1.6][i])};
  if (key === "cafe") return {coins:t === 1 ? [5, 10, 15][i] : Math.round(15 * Math.pow(1.5, t - 2) * [1.1, 1.3, 1.5][i])};
  if (key === "books") return {know:lv};
  if (key === "park") return {fun:lv <= 3 ? lv - 1 : t + 1};
  if (key === "clinic") return {pct:5 * lv};
  if (key === "landmark") return {pct:20};
  return {};
}
/* renovated = brought up to the city center's tier (from the 2nd tier on): makes 20% more */
function renovated(c, it){ const b = it && it.b && CITY_BUILDINGS[it.b]; return !!(b && !b.fixed && it.b !== "road" && tierOf(tileLv(it)) >= 2 && tierOf(tileLv(it)) >= hallTier(c)); }
function renovatedCount(c){ return Object.values(c.tiles).filter(it => it.b && it.b !== "hall" && it.b !== "road" && tierOf(tileLv(it)) >= 2).length; }
/* clinics and the landmark lift everything the town makes */
function cityBoost(c, L){
  L = L || cityLinked(c);
  return Object.keys(c.tiles).reduce((n, k) => { const it = c.tiles[k], b = it.b && CITY_BUILDINGS[it.b]; return n + (b && b.boost && L.has(k) ? bStat(it.b, tileLv(it)).pct : 0); }, 0);
}
/* what one building makes a day: {food, coins, know}, only once it reaches the center */
function shopMake(c, k, L, boost){
  const it = c.tiles[k], b = it && it.b && CITY_BUILDINGS[it.b], out = {food:0, coins:0, know:0};
  if (!b || !isLinked(c, k, L)) return out;
  const st = bStat(it.b, tileLv(it));
  if (b.fixed){ out.food = st.food; return out; }
  const m = (1 + (boost == null ? cityBoost(c, L) : boost) / 100) * (renovated(c, it) ? 1.2 : 1);
  ["food", "coins", "know"].forEach(f => { if (st[f]) out[f] = Math.round(st[f] * m); });
  return out;
}
function cityDaily(c){
  const L = cityLinked(c), boost = cityBoost(c, L), out = {food:0, coins:0, know:0};
  Object.keys(c.tiles).forEach(k => { const m = shopMake(c, k, L, boost); out.food += m.food; out.coins += m.coins; out.know += m.know; });
  return out;
}
/* bookshops give their knowledge on each day you study */
function cityStudied(){
  if (!S.city || !S.profile) return;
  const c = city(), t = todayStr(); if (c.prod.studied === t) return;
  c.prod.studied = t; const n = cityDaily(c).know;
  if (n){ c.prod.know = Math.min(n * 2, (c.prod.know || 0) + n); saveCity(); }
}
/* removing a building or road gives back half of everything paid for it (building + upgrades) */
function cityRefund(it){
  const b = it && it.b && CITY_BUILDINGS[it.b]; if (!b || b.fixed) return 0;
  if (it.paid) return Math.floor(it.paid / 2);
  let paid = b.price;
  for (let l = 1; l < tileLv(it); l++) paid += upgradeCost(Object.assign({}, it, {lv:l}));
  return Math.floor(paid / 2);
}
const GROUND_PRICE = {sand:0, grass:0};
function groundPrice(g){ return g in GROUND_PRICE ? GROUND_PRICE[g] : 2; }
/* the next level: inside a tier just coins; the 3rd → 4th level is a renovation (needs the center's tier, and for the center its evolution tasks) */
function upgradeCost(it){
  const b = CITY_BUILDINGS[it.b], lv = tileLv(it); if (!b || it.b === "road") return 0;
  const t = tierOf(lv), evolve = lv % 3 === 0;
  if (it.b === "hall") return lv >= HALL_MAX ? 0 : evolve ? 300 * t : 100 * t * (lv - (t - 1) * 3);
  if (it.b === "landmark") return 0;
  return b.price;   /* every upgrade and renovation costs the same as buying the building */
}
/* why a building can't go up a level yet ("" = it can) */
function upgradeLock(c, it){
  const lv = tileLv(it); if (!upgradeCost(it)) return "max";
  if (lv % 3 !== 0) return "";
  if (it.b === "hall") return evolveReady(c) ? "" : "tasks";
  return tierOf(lv) + 1 > hallTier(c) ? "市中心進化成「" + HALL_TIERS[tierOf(lv)] + "」後才能翻新成「" + lookName(it.b, lv + 1) + "」" : "";
}
function cityName(it){
  const b = it.b && CITY_BUILDINGS[it.b]; if (!b) return CITY_DECOS[it.d];
  if (it.b === "hall") return hallName(tileLv(it)) + " Lv" + tileLv(it);
  return lookName(it.b, tileLv(it)) + (it.b === "road" || it.b === "landmark" ? "" : " Lv" + tileLv(it));
}
/* one line about what a building does now, and what the next level brings */
function cityStatText(key, lv, made, linked){
  const st = bStat(key, lv), off = linked ? "" : "（還沒接上市中心，不會產出）";
  if (key === "house") return "可以住 <b>" + st.people + "</b> 位居民";
  if (key === "farm") return "每天產 <b>" + made.food + "</b> 份糧食" + off;
  if (key === "cafe") return "每天賺 <b>" + made.coins + "</b> 金幣" + off;
  if (key === "books") return "有學習的那天產 <b>" + made.know + "</b> 知識" + off;
  if (key === "park") return "每天多 <b>" + (linked ? st.fun : 0) + "</b> 個居民請求" + (st.fun ? "" : "（升級後才有）");
  if (key === "clinic" || key === "landmark") return "全城產量 <b>+" + st.pct + "%</b>" + off;
  return CITY_BUILDINGS[key] ? CITY_BUILDINGS[key].desc : "";
}
function cityNextText(c, it, k){
  const lv = tileLv(it), a = bStat(it.b, lv), n = bStat(it.b, lv + 1), parts = [];
  /* what it would really make after the upgrade (clinics, the landmark and renovation included) */
  if (k && c.tiles[k] === it && isLinked(c, k)){ it.lv = lv + 1; const m = shopMake(c, k); it.lv = lv; ["food", "coins", "know"].forEach(f => { if (n[f]) n[f] = m[f]; }); const m0 = shopMake(c, k); ["food", "coins", "know"].forEach(f => { if (a[f]) a[f] = m0[f]; }); }
  if (it.b === "hall"){ if (n.reqs > a.reqs) parts.push("每天 " + n.reqs + " 個請求"); parts.push("產 " + n.food + " 份糧食"); }
  if (n.people > (a.people || 0)) parts.push("多 " + (n.people - a.people) + " 位居民搬進來");
  if (n.food > (a.food || 0) && it.b !== "hall") parts.push("每天產 " + n.food + " 份糧食");
  if (n.coins > (a.coins || 0)) parts.push("每天賺 " + n.coins + " 金幣");
  if (n.know > (a.know || 0)) parts.push("產 " + n.know + " 知識");
  if (n.fun > (a.fun || 0)) parts.push("每天多 " + n.fun + " 個請求");
  if (n.pct > (a.pct || 0)) parts.push("全城產量 +" + n.pct + "%");
  if (lv % 3 === 0 && (CITY_BUILDINGS[it.b].food || CITY_BUILDINGS[it.b].coins || CITY_BUILDINGS[it.b].know)) parts.push("翻新加成 +20%");
  return parts.join("・");
}
function parkFun(c, L){ L = L || cityLinked(c); return Object.keys(c.tiles).reduce((n, k) => { const it = c.tiles[k]; return n + (it.b === "park" && L.has(k) ? bStat("park", tileLv(it)).fun : 0); }, 0); }
function reqCap(c){ return bStat("hall", hallLv(c)).reqs + parkFun(c); }
/* ---------- evolving the city center ---------- */
function evolveGoal(c){
  const lv = hallLv(c), t = tierOf(lv) + 1; if (t > HALL_TIERS.length) return null;
  return Object.assign({tier:t, name:HALL_TIERS[t - 1]}, EVOLVE[t]);
}
/* the checklist for the next evolution: [{label, ok, now}] */
function evolveTasks(c){
  const g = evolveGoal(c); if (!g) return [];
  const L = cityLinked(c), people = activeResidents(c).length, out = [];
  const has = key => Object.keys(c.tiles).some(k => c.tiles[k].b === key && L.has(k));
  out.push({label:"知識 " + g.know, ok:knowledge() >= g.know, now:knowledge()});
  out.push({label:"居民 " + g.people + " 位", ok:people >= g.people, now:people});
  if (g.allLinked){ const off = Object.keys(c.tiles).filter(k => hasDoor(c.tiles[k]) && !L.has(k)).length; out.push({label:"所有建築都接上市中心", ok:!off, now:off ? off + " 棟沒接上" : "都接上了"}); }
  if (g.renovated){ const n = renovatedCount(c); out.push({label:"翻新 " + g.renovated + " 棟建築", ok:n >= g.renovated, now:n}); }
  if (g.food){ const n = cityDaily(c).food; out.push({label:"每天產糧食 " + g.food + " 份以上", ok:n >= g.food, now:n}); }
  if (g.clinic) out.push({label:"有一間接上的診所", ok:has("clinic"), now:has("clinic") ? "有" : "還沒有"});
  if (g.landmark) out.push({label:"蓋好地標", ok:has("landmark"), now:has("landmark") ? "有" : "還沒有"});
  return out;
}
function evolveReady(c){ const t = evolveTasks(c); return hallLv(c) % 3 === 0 && !!t.length && t.every(x => x.ok); }
function roadOk(c, k){ return cityNear(k).some(n => c.tiles[n] && c.tiles[n].b); }
/* nothing built here (a tile may still have a ground laid on it) */
function tileEmpty(it){ return !it || (!it.b && !it.d); }
const LAND_PRICE = 10;
function landOwned(c, k){ return k === "0,0" || (c.land || []).includes(k); }
function cityBuyLand(c, k){
  if (landOwned(c, k)) return "";
  if (!spend(LAND_PRICE, "城市：買土地")) return "金幣不夠。";
  c.land.push(k);
  if (!c.tiles[k]) c.tiles[k] = {g:"sand"};   /* new land starts as 沙地 */
  saveCity(); return "";
}
function saveCity(){ Store.set("city", S.city).catch(() => {}); if (typeof renderCoins === "function") renderCoins(); }
function cityRadius(c){ return Math.max(hallTier(c) + 1, c.minR || 0); }
function cityTiles(c){
  const R = cityRadius(c), out = [];
  for (let q = -R; q <= R; q++) for (let r = -R; r <= R; r++) if (Math.abs(-q - r) <= R) out.push([q, r]);
  return out;
}

/* ---------- drawing ---------- */
function avatarSVG(av, size){
  const outfit = {tee:"#64B5F6", hoodie:"#9575CD", raincoat:"#FFD54F", suit:"#37474F", astro:"#ECEFF1"}[av.outfit] || "#64B5F6";
  let body = '<rect x="30" y="58" width="40" height="34" rx="12" fill="' + outfit + '" stroke="#5b4a3a" stroke-width="2"/>';
  if (av.outfit === "suit") body += '<path d="M50 58 L44 70 L50 76 L56 70Z" fill="#fff"/><path d="M50 62 l-3 4 l3 12 l3-12z" fill="#E57373"/>';
  if (av.outfit === "hoodie") body += '<path d="M38 60 q12 10 24 0" fill="none" stroke="#5b4a3a" stroke-width="2"/>';
  if (av.outfit === "raincoat") body += '<circle cx="50" cy="70" r="2" fill="#5b4a3a"/><circle cx="50" cy="80" r="2" fill="#5b4a3a"/>';
  if (av.outfit === "astro") body += '<rect x="42" y="66" width="16" height="10" rx="2" fill="#64B5F6"/>';
  let head = '<circle cx="50" cy="38" r="22" fill="#f6d2b4" stroke="#5b4a3a" stroke-width="2"/><path d="M28 36 q4 -22 22 -22 q18 0 22 22 q-10 -10 -22 -10 q-12 0 -22 10z" fill="#5b4a3a"/>' +
    '<circle cx="42" cy="40" r="2.5" fill="#333"/><circle cx="58" cy="40" r="2.5" fill="#333"/><path d="M45 48 q5 4 10 0" fill="none" stroke="#333" stroke-width="2" stroke-linecap="round"/>' +
    '<circle cx="37" cy="46" r="3" fill="#f4a6a6" opacity=".6"/><circle cx="63" cy="46" r="3" fill="#f4a6a6" opacity=".6"/>';
  if (av.outfit === "astro") head = '<circle cx="50" cy="38" r="27" fill="#e3f2fd" stroke="#90a4ae" stroke-width="2" opacity=".9"/>' + head;
  let g = "";
  if (av.glasses === "round") g = '<circle cx="42" cy="40" r="6" fill="none" stroke="#333" stroke-width="2"/><circle cx="58" cy="40" r="6" fill="none" stroke="#333" stroke-width="2"/><path d="M48 40h4" stroke="#333" stroke-width="2"/>';
  if (av.glasses === "sun") g = '<rect x="35" y="35" width="13" height="9" rx="3" fill="#222"/><rect x="52" y="35" width="13" height="9" rx="3" fill="#222"/><path d="M48 39h4" stroke="#222" stroke-width="2"/>';
  if (av.glasses === "star") g = '<path d="M42 33l2 5 5 .4-4 3 1.5 5-4.5-3-4.5 3 1.5-5-4-3 5-.4z" fill="#F3CC58" stroke="#c99a17"/><path d="M58 33l2 5 5 .4-4 3 1.5 5-4.5-3-4.5 3 1.5-5-4-3 5-.4z" fill="#F3CC58" stroke="#c99a17"/>';
  let h = "";
  if (av.hat === "cap") h = '<path d="M28 30 q22 -26 44 0z" fill="#E57373" stroke="#5b4a3a" stroke-width="2"/><path d="M60 29 h20 q2 4 -4 4 h-16z" fill="#E57373" stroke="#5b4a3a" stroke-width="2"/>';
  if (av.hat === "beanie") h = '<path d="M28 32 q22 -32 44 0z" fill="#4DB6AC" stroke="#5b4a3a" stroke-width="2"/><rect x="27" y="28" width="46" height="7" rx="3" fill="#80CBC4" stroke="#5b4a3a" stroke-width="2"/><circle cx="50" cy="8" r="5" fill="#80CBC4"/>';
  if (av.hat === "straw") h = '<ellipse cx="50" cy="26" rx="34" ry="7" fill="#F3CC58" stroke="#c99a17" stroke-width="2"/><path d="M34 26 q16 -24 32 0z" fill="#F3CC58" stroke="#c99a17" stroke-width="2"/><rect x="34" y="21" width="32" height="4" fill="#E57373"/>';
  if (av.hat === "crown") h = '<path d="M32 26 L36 8 L44 18 L50 4 L56 18 L64 8 L68 26Z" fill="#F3CC58" stroke="#c99a17" stroke-width="2"/><circle cx="50" cy="20" r="2.5" fill="#E57373"/>';
  return '<svg viewBox="0 0 100 96" width="' + size + '" height="' + (size * .96) + '" aria-hidden="true">' + body + head + g + h + "</svg>";
}

/* ---------- screen ---------- */
function renderCity(){
  const c = city();
  /* the 3D town draws into #city3d; until it's loaded (or if this device can't show 3D) a short note shows */
  const stage = '<div id="city3d" class="city3d' + (c.showNames ? " names" : "") + '"><div class="city-wait">' + (City3D.failed ? "這台裝置不能顯示 3D 城市。" : '<span class="spinner"></span>正在載入城市…') + "</div></div>";
  if (S.cityChat && curWeek()) return '<div class="city-stage chat">' + stage + cityChatHTML() + "</div>";
  return '<div class="city-stage' + (S.cityEdit ? " editing" : "") + '">' + stage + '<div class="city-hud">' + cityTopHTML(c) +
    '<div class="hud-row">' + cityEditBtnHTML() + (S.cityEdit ? cityEditHTML(c) : citySideHTML(c)) + "</div>" + "</div>" +
    '<button class="name-toggle" data-act="city-names" role="switch" aria-checked="' + !!c.showNames + '"><span>名稱與等級</span><i class="nt-sw"><b></b></i></button></div>';
}
/* the floating card at the top, and under it the evolution tasks once the center is ready for them */
function cityTopHTML(c){
  const g = evolveGoal(c);
  if (!g || hallLv(c) % 3) return cityTopCard(c);
  const tasks = evolveTasks(c), done = tasks.filter(x => x.ok).length, ready = done === tasks.length;
  return cityTopCard(c) + '<button class="city-evo' + (ready ? " ready" : "") + '" data-act="city-sheet" data-s="evo"><span class="ce-ic">' + CITY_ICONS.upgrade + "</span><span>" +
    (ready ? "可以進化成「" + g.name + "」了！" : "進化任務 " + done + "/" + tasks.length + "・" + g.name) + "</span><b>›</b></button>";
}
/* today's resident requests */
function cityTopCard(c){
  const n = activeResidents(c).length, away = c.residents.length - n, food = c.food;
  const done = c.day.requests.filter(q => q.status !== "open").length, total = c.day.requests.length;
  const card = (inner, btn) => '<div class="city-top"><div class="ct-body">' + inner + "</div>" + (btn || "") + (S.err.city ? '<div class="err ct-err">' + esc(S.err.city) + "</div>" : "") + "</div>";
  const go = (act, label, extra) => '<button class="ct-go" data-act="' + act + '"' + (extra || "") + ">" + label + "</button>";
  if (!n) return card('<div class="ct-l1">' + (away ? "居民還出不了門" : "還沒有居民") + '</div><div class="ct-sub">' + (away ? "房子的門口要對著接上市中心的道路" : "點一塊地買下來，再按「編輯」蓋小屋，就會有人搬進來") + "</div>");
  if (!c.day.fed)
    return card('<div class="ct-l1">居民肚子餓了，需要「<em>糧食</em>」</div><div class="ct-l2">發放 <big>' + n + "</big> 份</div>",
      S.busy.city ? '<button class="ct-go pressing" disabled aria-busy="true">發放</button>' : food >= n ? go("city-feed", "發放") : go("city-sheet", "買糧食", ' data-s="shop"'));
  if (!total || done >= total) return card('<div class="ct-l1 ct-none">居民目前無請求</div>');
  const pct = Math.round(done / total * 100);
  return card('<div class="ct-l1">今天的「<em>居民請求</em>」進度</div><div class="ct-l2">已經完成 <big>' + pct + '%</big></div><div class="ct-bar"><span style="width:' + Math.max(6, pct) + '%"></span></div>',
    go("city-sheet", "前往", ' data-s="reqs"'));
}
/* the floating buttons down the right side */
function citySideHTML(c){
  const p = c.prod, st = (p.store || 0) + (p.coins || 0) + (p.know || 0), item = (act, s, ic, label, badge) => '<button class="cs-btn" data-act="' + act + '"' + (s ? ' data-s="' + s + '"' : "") + '><span class="cs-ic">' + ic + (badge ? '<i class="cs-badge">' + badge + "</i>" : "") + "</span><span>" + label + "</span></button>";
  return '<div class="city-side">' + item("city-sheet", "shop", CITY_ICONS.shop, "商店") + item("city-sheet", "avatar", CITY_ICONS.outfit, "裝扮") + item("city-sheet", "bag", CITY_ICONS.bag, "背包") +
    (st ? item("city-harvest", "", CITY_ICONS.harvest, "收成", st) : "") + "</div>";
}
/* chatting with Lisa right in town: the island shrinks to the top, focused on her, and the chat opens below */
function cityChatHTML(){
  const {w, d} = curChat();
  return '<div class="city-chat"><div class="cc-head"><span class="lisa-av">' + LISA_SVG + '</span><div class="cc-who"><div><b>Lisa</b><span class="cc-on">Online</span></div><div class="small muted">' +
    (w ? "第 " + w.n + " 週 · " + (d >= 6 ? "週日總複習" : DAY_NAMES[d]) : "") + '</div></div><button class="cc-x" data-act="city-chat-close" aria-label="結束聊天，回到城市">' +
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg></button></div>' +
    '<div class="cc-body" id="cc-body">' + talkBodyHTML(true) + "</div></div>";
}
const CITY_ICONS = {
  req:'<svg viewBox="0 0 32 32"><rect x="3" y="5" width="26" height="19" rx="7" fill="#FFD873"/><path d="M10 24l-2 5 7-5z" fill="#FFD873"/><rect x="14.4" y="9" width="3.2" height="8.5" rx="1.6" fill="#8A5A00"/><circle cx="16" cy="20.6" r="1.8" fill="#8A5A00"/></svg>',
  shop:'<svg viewBox="0 0 32 32"><rect x="5" y="14" width="22" height="14" rx="2" fill="#F6EAD3"/><path d="M3 8h26l-1.5 7H4.5z" fill="#E66B44"/><path d="M8.2 8l-1 7M13.4 8l-.5 7M18.6 8l.5 7M23.8 8l1 7" stroke="#fff" stroke-width="2.2"/><rect x="13" y="19" width="6" height="9" rx="1" fill="#4C8BE0"/><rect x="7.5" y="18" width="4" height="4" rx="1" fill="#9DD3F0"/><rect x="20.5" y="18" width="4" height="4" rx="1" fill="#9DD3F0"/><rect x="4" y="4" width="24" height="4" rx="2" fill="#B9502F"/></svg>',
  outfit:'<svg viewBox="0 0 32 32"><path d="M11 4l-8 5 3 6 3-1.5V28h14V13.5l3 1.5 3-6-8-5c-.6 2.4-2.6 4-5 4s-4.4-1.6-5-4z" fill="#4C8BE0"/><path d="M11 4c.6 2.4 2.6 4 5 4s4.4-1.6 5-4" fill="none" stroke="#2F6AB8" stroke-width="1.5"/><circle cx="16" cy="18" r="3" fill="#FFD873"/></svg>',
  bag:'<svg viewBox="0 0 32 32"><path d="M11 9V7a5 5 0 0 1 10 0v2" fill="none" stroke="#8A5A3A" stroke-width="2.4"/><rect x="5" y="9" width="22" height="19" rx="6" fill="#C98A55"/><rect x="9" y="17" width="14" height="8" rx="3" fill="#A86E3E"/><rect x="14" y="15" width="4" height="4" rx="1" fill="#FFD873"/></svg>',
  edit:'<svg viewBox="0 0 32 32"><path d="M6 26l1.6-6.4L21.5 5.7a2.4 2.4 0 0 1 3.4 0l1.4 1.4a2.4 2.4 0 0 1 0 3.4L12.4 24.4z" fill="#F5C64F"/><path d="M21.5 5.7l4.8 4.8" stroke="#E57373" stroke-width="4" stroke-linecap="round"/><path d="M7.6 19.6l4.8 4.8L6 26z" fill="#F6EAD3"/><path d="M6 26l1.2-1.2" stroke="#4A4A4A" stroke-width="2" stroke-linecap="round"/><path d="M9.5 18l9.6-9.6" stroke="#E0A92E" stroke-width="1.6" stroke-linecap="round"/></svg>',
  upgrade:'<svg viewBox="0 0 32 32"><circle cx="16" cy="16" r="14" fill="#4DB892"/><circle cx="16" cy="16" r="14" fill="none" stroke="#3A9877" stroke-width="2"/><path d="M16 23V10M10 15.5l6-6 6 6" fill="none" stroke="#fff" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  done:'<svg viewBox="0 0 32 32"><circle cx="16" cy="16" r="13" fill="#E57373"/><path d="M11 11l10 10M21 11 11 21" stroke="#fff" stroke-width="3.4" stroke-linecap="round"/></svg>',
  move:'<svg viewBox="0 0 32 32"><path d="M16 3l4.5 5h-3v6.5H24v-3l5 4.5-5 4.5v-3h-6.5V24h3L16 29l-4.5-5h3v-6.5H8v3L3 16l5-4.5v3h6.5V8h-3z" fill="#4DB892"/></svg>',
  turn:'<svg viewBox="0 0 32 32"><path d="M24.5 12A9.5 9.5 0 1 0 25.5 19" fill="none" stroke="#4C8BE0" stroke-width="3.4" stroke-linecap="round"/><path d="M26.5 5.5v8h-8" fill="none" stroke="#4C8BE0" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  remove:'<svg viewBox="0 0 32 32"><path d="M8 10h16l-1.4 16a2 2 0 0 1-2 1.8h-9.2a2 2 0 0 1-2-1.8z" fill="#E57373"/><rect x="5" y="6.5" width="22" height="3.6" rx="1.8" fill="#C94F4F"/><rect x="12.5" y="3.5" width="7" height="3.5" rx="1.5" fill="#C94F4F"/><path d="M13 14v9M19 14v9" stroke="#fff" stroke-width="2" stroke-linecap="round"/></svg>',
  tools:'<svg viewBox="0 0 32 32"><path d="M21.5 4a6.5 6.5 0 0 0-6.2 8.5L5.2 22.6a2.6 2.6 0 0 0 3.7 3.7L19 16.2A6.5 6.5 0 0 0 27.5 9l-3.6 3.6-3.4-.9-.9-3.4L23 4.7A6.5 6.5 0 0 0 21.5 4z" fill="#8E99A6"/><circle cx="7.6" cy="24.4" r="1.3" fill="#fff"/></svg>',
  lib_road:'<svg viewBox="0 0 32 32"><path d="M11 4h10l5 24H6z" fill="#8E99A6"/><path d="M16 7v4M16 15v4M16 23v3" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/></svg>',
  lib_build:'<svg viewBox="0 0 32 32"><path d="M4 15L16 5l12 10" fill="#E66B44"/><path d="M4 15L16 5l12 10" fill="none" stroke="#C4502D" stroke-width="2" stroke-linejoin="round"/><rect x="7" y="14" width="18" height="13" rx="1.5" fill="#F6EAD3"/><rect x="13.5" y="18.5" width="5" height="8.5" rx="1" fill="#8A5A3A"/><rect x="8.5" y="17" width="3.5" height="3.5" rx=".8" fill="#7FB3E8"/><rect x="20" y="17" width="3.5" height="3.5" rx=".8" fill="#7FB3E8"/></svg>',
  lib_ground:'<svg viewBox="0 0 32 32"><path d="M10 4.5h8l4 7-4 7h-8l-4-7z" fill="#A8CF7C"/><path d="M19 13.5h8l4 7-4 7h-8l-4-7z" transform="translate(-3 -1)" fill="#E8D9B5"/><path d="M5 15.5h8l4 7-4 7H5l-4-7z" transform="translate(2 -1)" fill="#B9C1CB"/></svg>',
  lib_deco:'<svg viewBox="0 0 32 32"><path d="M16 4c-5 0-8 4-8 8 0 3 2 5 4 6h8c2-1 4-3 4-6 0-4-3-8-8-8z" fill="#5FB06A"/><rect x="14.5" y="17" width="3" height="10" rx="1.2" fill="#8A5A3A"/><circle cx="25" cy="7" r="2.2" fill="#F5C64F"/><circle cx="7" cy="23" r="1.8" fill="#F5C64F"/><ellipse cx="16" cy="27.5" rx="8" ry="2" fill="#000" opacity=".12"/></svg>',
  harvest:'<svg viewBox="0 0 32 32"><path d="M5 15h22l-2.5 11a3 3 0 0 1-3 2.3h-11a3 3 0 0 1-3-2.3z" fill="#C98A55"/><path d="M5 15h22" stroke="#A86E3E" stroke-width="2.4" stroke-linecap="round"/><circle cx="11" cy="11" r="4" fill="#F5B72E"/><circle cx="17" cy="9" r="4.5" fill="#E66B44"/><circle cx="22" cy="12" r="3.5" fill="#4DB892"/></svg>'
};

/* Lisa lives in town: tap her on the island or here, any time */

/* ---------- changing the town (used by the tile sheet and by 編輯) — each returns "" or what went wrong ---------- */
function cityBuildAt(c, k, key){
  const b = CITY_BUILDINGS[key];
  if (!b || b.fixed || !tileEmpty(c.tiles[k])) return "這格不能蓋";
  const lock = buildLock(c, key); if (lock) return lock;
  if (key === "road" && !roadOk(c, k)) return "道路要貼著建築或其他道路。";
  const lv0 = buildLv(c, key), cost = buildCost(c, key), nm = lookName(key, lv0);
  if (!spend(cost, "城市：蓋" + nm)) return "金幣不夠，多練習幾篇再來。";
  const g0 = c.tiles[k] && c.tiles[k].g;
  c.tiles[k] = {b:key, paid:cost};
  if (lv0 > 1) c.tiles[k].lv = lv0;
  if (g0) c.tiles[k].g = g0;
  if (hasDoor(c.tiles[k])) c.tiles[k].face = autoFace(c, k);
  if (key === "road"){
    /* buildings next to a new road that had no way in turn their door toward it */
    const L1 = cityLinked(c);
    cityNear(k).forEach((n, i) => { const t = c.tiles[n]; if (hasDoor(t) && n !== "0,0" && !L1.has(n)) t.face = (i + 3) % 6; });
  }
  if (b.food || b.coins){ const m = shopMake(c, k); c.prod.store += m.food; c.prod.coins = (c.prod.coins || 0) + m.coins; }   /* the first day's batch is ready right away */
  const used = new Set(c.residents.map(p => p.name));
  const people = b.grow ? bStat(key, lv0).people : b.residents;
  for (let i = 0; i < people; i++){
    const free = CITY_NAMES.filter(n => !used.has(n)), name = free.length ? free[Math.floor(Math.random() * free.length)] : "Kai" + c.residents.length;
    used.add(name); c.residents.push({name, color:CITY_COLORS[c.residents.length % CITY_COLORS.length], home:k});
  }
  const far = key !== "road" && !isLinked(c, k);
  saveCity();
  if (key !== "road") toast(nm + "蓋好了" + (far ? "。記得用道路接上市中心！" : people ? "，" + people + " 位居民搬進來！" : "！"));
  return "";
}
/* a new building starts at the first level of the town's current era, always at its fixed price */
function buildLv(c, key){ return key === "road" || key === "landmark" ? 1 : (hallTier(c) - 1) * 3 + 1; }
function buildCost(c, key){ return CITY_BUILDINGS[key].price; }
/* why this kind of building can't be built yet ("" = it can) */
function buildLock(c, key){
  const b = CITY_BUILDINGS[key];
  if (b.tier > hallTier(c)) return "市中心進化成「" + HALL_TIERS[b.tier - 1] + "」後解鎖";
  if (b.one && Object.values(c.tiles).some(it => it.b === key)) return "每座城只能有一棟" + b.name;
  return "";
}
function cityDecoAt(c, k, d){
  const i = c.owned.deco.indexOf(d);
  if (i < 0 || !tileEmpty(c.tiles[k])) return "這格不能放";
  const g0 = c.tiles[k] && c.tiles[k].g;
  c.owned.deco.splice(i, 1); c.tiles[k] = g0 ? {d, g:g0} : {d}; saveCity(); return "";
}
function cityGroundAt(c, k, g){
  if (!CITY_GROUNDS[g]) return "這格不能換地面";
  const it = c.tiles[k] || {};
  if ((it.g || (it.b === "park" ? "grass" : "sand")) === g) return "";
  const price = groundPrice(g);
  if (price && !spend(price, "城市：鋪" + CITY_GROUNDS[g][0])) return "金幣不夠。";
  it.g = g; c.tiles[k] = it; saveCity(); return "";
}
function cityRemoveAt(c, k){
  const it = c.tiles[k]; if (!it || it.b === "hall") return;
  /* a building or decoration goes, its ground stays; a bare ground is taken up */
  const keepG = (it.b || it.d) && it.g;
  if (it.d) c.owned.deco.push(it.d);
  else if (it.b){
    refund(cityRefund(it), "城市：移除" + CITY_BUILDINGS[it.b].name + "（退 50%）");
    /* residents who lived here move out; requests pointing at them are dropped */
    const gone = c.residents.map((p, i) => p.home === k ? i : -1).filter(i => i >= 0);
    c.day.requests = c.day.requests.filter(q => !gone.includes(q.who)).map(q => Object.assign(q, {who:q.who - gone.filter(g => g < q.who).length}));
    c.residents = c.residents.filter(p => p.home !== k);
  }
  if (keepG) c.tiles[k] = {g:it.g}; else if (landOwned(c, k) && it.b) c.tiles[k] = {g:"sand"}; else delete c.tiles[k];
  saveCity();
}

/* ---------- 編輯：choose from a library on the left, then tap (or drag onto) a tile ---------- */
const CITY_TOOLS = {turn:"轉方向", remove:"移除"};
/* left: 編輯, which turns into 取消編輯 while editing */
function cityEditBtnHTML(){
  const E = S.cityEdit, on = !!E;
  let html = '<div class="city-left"><button class="cs-btn" data-act="' + (on ? "city-edit-done" : "city-edit") + '"><span class="cs-ic">' + (on ? CITY_ICONS.done : CITY_ICONS.edit) + "</span><span>" + (on ? "取消編輯" : "編輯") + "</span></button>";
  return html + "</div>";
}
/* right, while editing: the three libraries; tapping one shows its items in the same column,
   and the back button returns to the three libraries */
function cityEditHTML(c){
  const E = S.cityEdit, bal = wallet().balance;
  if (!E.tab){
    const cat = (k, ic, label) => '<button class="cs-btn" data-act="city-edit-tab" data-v="' + k + '"><span class="cs-ic">' + ic + "</span><span>" + label + "</span></button>";
    return '<div class="city-side">' + cat("tools", CITY_ICONS.tools, "工具") + cat("build", CITY_ICONS.lib_build, "建築") + cat("ground", CITY_ICONS.lib_ground, "土地") + cat("deco", CITY_ICONS.lib_deco, "裝飾") + "</div>";
  }
  const item = (key, name, sub, pic, ok) => '<button class="ce-item' + (E.sel === key ? " on" : "") + '" data-act="city-edit-pick" data-v="' + key + '"' + (ok === false ? " disabled" : "") + ">" +
    pic + "<b>" + name + "</b>" + (sub ? "<small>" + sub + "</small>" : "") + "</button>";
  const price = n => '<span class="ce-price"><img class="coin-icon" src="' + COIN_IMG + '" alt="">' + n + "</span>";
  let rows = "";
  if (E.tab === "build"){
    rows = Object.entries(CITY_BUILDINGS).filter(([k, b]) => !b.fixed).map(([k, b]) => {
        const lock = b.tier > hallTier(c) ? HALL_TIERS[b.tier - 1] : buildLock(c, k) ? "已經有了" : "";
        const cost = buildCost(c, k);
        return item("b:" + k, lock ? b.name : lookName(k, buildLv(c, k)), lock ? (lock === "已經有了" ? lock : lock + "解鎖") : price(cost), '<span class="ce-pic">' + (k === "road" ? CITY_ICONS.lib_road : k === "park" ? CITY_ICONS.lib_deco : CITY_ICONS.lib_build) + "</span>", !lock && bal >= cost);
      }).join("");
  } else if (E.tab === "ground"){
    rows = Object.entries(CITY_GROUNDS).map(([k, v]) => item("g:" + k, v[0], groundPrice(k) ? price(groundPrice(k)) : '<span class="ce-free">免費</span>', '<span class="ce-swatch" style="background:' + v[2] + '"></span>', bal >= groundPrice(k))).join("");
  } else if (E.tab === "tools"){
    rows = item("t:move", "移動", "", '<span class="ce-pic">' + CITY_ICONS.move + "</span>") + item("t:turn", "轉方向", "", '<span class="ce-pic">' + CITY_ICONS.turn + "</span>") + item("t:remove", "移除", "", '<span class="ce-pic">' + CITY_ICONS.remove + "</span>");
  } else {
    const decos = c.owned.deco.reduce((m, d) => (m[d] = (m[d] || 0) + 1, m), {});
    rows = Object.keys(decos).length ? Object.entries(decos).map(([d, n]) => item("d:" + d, CITY_DECOS[d], "× " + n, '<span class="ce-pic">' + CITY_ICONS.lib_deco + "</span>")).join("")
      : '<p class="ce-empty">背包裡還沒有裝飾。答對居民請求有機會拿到。</p>';
  }
  return '<div class="ce-col"><button class="back-btn" data-act="city-edit-back" aria-label="回到建築、土地、其他">' + GATE_ICON.back + "</button>" +
    '<div class="ce-list">' + rows + "</div></div>";
}
/* 移動: the building (or decoration) keeps its level and residents; each tile keeps its own ground */
function cityMoveAt(c, from, to){
  const it = c.tiles[from], dst = c.tiles[to];
  if (!it || it.b === "hall" || tileEmpty(it)) return "這格沒有可以搬的東西";
  if (!tileEmpty(dst)) return "要搬到空地";
  if (it.b === "road"){
    const saved = c.tiles[from]; delete c.tiles[from];
    const ok = roadOk(c, to); c.tiles[from] = saved;
    if (!ok) return "道路要貼著建築或其他道路。";
  }
  const moved = Object.assign({}, it); delete moved.g;
  if (dst && dst.g) moved.g = dst.g;
  if (it.g) c.tiles[from] = {g:it.g}; else delete c.tiles[from];
  c.tiles[to] = moved;
  if (hasDoor(moved) && moved.b !== "hall") moved.face = autoFace(c, to);
  c.residents.forEach(p => { if (p.home === from) p.home = to; });
  saveCity(); return "";
}

/* do the chosen thing on tile k; returns a message when it can't */
function cityEditApply(k){
  const E = S.cityEdit, c = city(); if (!E || !E.sel || !k) return;
  const [t, v] = E.sel.split(":"), it = c.tiles[k];
  let err = "";
  const needLand = t === "b" || t === "d" || t === "g" || (t === "t" && v === "move" && E.moveFrom);
  if (needLand && !landOwned(c, k)){ toast("這塊地還沒買，先結束編輯、點它買下來（" + LAND_PRICE + " 金幣）。"); return; }
  if (t === "b") err = !tileEmpty(it) ? "這格已經有東西了" : cityBuildAt(c, k, v);
  else if (t === "d") err = !tileEmpty(it) ? "這格已經有東西了" : cityDecoAt(c, k, v);
  else if (t === "g") err = cityGroundAt(c, k, v);
  else if (t === "t" && v === "move"){
    if (!E.moveFrom){
      if (!it || it.b === "hall" || tileEmpty(it)) err = it && it.b === "hall" ? "市中心不能搬" : "點一棟建築或一個裝飾";
      else E.moveFrom = k;
    } else if (k === E.moveFrom) E.moveFrom = null;
    else { err = cityMoveAt(c, E.moveFrom, k); if (!err) E.moveFrom = null; }
  }
  else if (t === "t" && v === "turn") err = !hasDoor(it) || it.b === "hall" ? "這格沒有可以轉的門" : (it.face = ((it.face >= 0 ? it.face : 5) + 1) % 6, saveCity(), "");
  else if (t === "t" && v === "remove"){
    if (!it || it.b === "hall") err = it ? "市中心不能移除" : "這格是空的";
    else if (!it.b && !it.d){ cityRemoveAt(c, k); }
    else if (it.b && it.b !== "road" && it.b){
      confirmBox("拆掉" + CITY_BUILDINGS[it.b].name + "？", "退回 " + cityRefund(it) + " 金幣（一半），住在裡面的居民會搬走。", "拆掉", true).then(ok => { if (ok){ cityRemoveAt(c, k); render(); } });
      return;
    } else cityRemoveAt(c, k);
  }
  if (err) toast(err);
  if (E.sel && E.sel.startsWith("d:") && !c.owned.deco.includes(E.sel.slice(2))) E.sel = null;
  render();
}

/* the evolution moment: a burst of light over the town with the new name */
function cityEvolveShow(name){
  const el = document.createElement("div"); el.className = "evo-burst"; el.setAttribute("role", "status");
  el.innerHTML = '<div class="eb-rays"></div><div class="eb-card"><small>進入' + esc(ERA_NAMES[HALL_TIERS.indexOf(name)] || "新時代") + '</small><b>' + esc(name) + "</b><span>小島變大了，建築可以翻新成新時代的樣子！</span></div>";
  document.body.appendChild(el);
  try { navigator.vibrate && navigator.vibrate([20, 60, 30]); } catch (e) {}
  const bye = () => { el.classList.add("out"); setTimeout(() => el.remove(), 400); };
  el.addEventListener("click", bye); setTimeout(bye, 3200);
}
/* ---------- sheets ---------- */
function cityOpen(o){ S.sheet = Object.assign({kind:"city"}, o); S.sheetAt = performance.now(); $("#sheet").hidden = false; drawSheet(); if (typeof City3D !== "undefined") City3D.draw(); }
function citySheetHTML(o){
  const c = city(), bal = wallet().balance;
  const head = t => '<div class="sh-head"><div class="sh-word phrase" style="flex:1;min-width:0">' + t + '</div><button class="icon-btn" data-act="close-sheet" aria-label="關閉">×</button></div>';
  if (o.s === "land"){
    const own = landOwned(c, o.k), who = (Cloud.cfg && (Cloud.cfg.name || Cloud.cfg.email)) || "你";
    return head(own ? "我的土地（沙地）" : "未註冊的土地") + '<div class="land-card"><span class="land-ic">' + CITY_ICONS.lib_ground + '</span><div><div class="small muted">土地所有人</div><b>' + (own ? esc(who) : "還沒有人") + "</b></div>" +
      '<span class="pill' + (own ? " ok" : "") + '">' + (own ? "已購買" : "未擁有") + "</span></div>" +
      (own ? '<p class="small muted" style="margin:0">按左上的「編輯」就能在這裡蓋東西或鋪地面。</p>'
        : '<button class="btn block" data-act="city-buy-land" data-k="' + o.k + '"' + (bal < LAND_PRICE ? " disabled" : "") + '>買下這塊地 <img class="coin-icon" src="' + COIN_IMG + '" alt="">' + LAND_PRICE + "</button>");
  }
  if (o.s === "reqs"){
    const open = c.day.requests.filter(q => q.status === "open").length;
    return head("今天的居民請求") + (c.day.requests.length ? '<div class="stack">' + c.day.requests.map(q => {
      const p = c.residents[q.who] || {name:"居民", color:"#999"};
      return '<button class="day-row" data-act="city-req" data-id="' + q.id + '"><span class="d"><b>' + esc(p.name) + '</b><span>' + (q.type === "choice" ? "選擇題" : "回答") + '</span></span><span class="t"><div class="en">' + esc(q.say) + '</div></span><span class="state ' + (q.status === "open" ? "" : "done") + '">' + (q.status === "open" ? "待回答" : q.status === "right" ? "答對" : "完成") + "</span></button>";
    }).join("") + "</div>" : '<p class="muted" style="margin:0">今天沒有請求了。</p>') +
      '<p class="small muted" style="margin:0">' + (open ? "還有 " + open + " 個請求。答對會拿到隨機禮物！" : "今天的請求都處理完了，明天再來。") + "</p>";
  }
  if (o.s === "tile"){
    const it = c.tiles[o.k] || {}, b = it.b && CITY_BUILDINGS[it.b], lv = tileLv(it), L = cityLinked(c), linked = isLinked(c, o.k, L);
    const who = c.residents.filter(p => p.home === o.k).map(p => p.name).join("、");
    const cost = it.b ? upgradeCost(it) : 0, lock = it.b ? upgradeLock(c, it) : "max", evolve = lv % 3 === 0;
    let info = "";
    if (it.b === "hall") info = "小島半徑 " + cityRadius(c) + "・每天最多 " + bStat("hall", lv).reqs + " 個居民請求" + (parkFun(c, L) ? "（公園再 +" + parkFun(c, L) + "）" : "") + "・每天產 " + bStat("hall", lv).food + " 份糧食";
    else if (b) info = (who ? (b.grow ? "住在這裡：" : "老闆：") + esc(who) + "<br>" : "") + cityStatText(it.b, lv, shopMake(c, o.k, L), linked);
    const tag = renovated(c, it) ? '<span class="pill ok">已翻新・產量 +20%</span>' : "";
    const nextTxt = it.b ? cityNextText(c, it, o.k) : "";
    const icon = '<span class="up-ic">' + CITY_ICONS.upgrade + "</span>";
    const title = it.b === "hall" && evolve ? "進化成「" + HALL_TIERS[tierOf(lv)] + "」" : evolve ? "翻新成「" + lookName(it.b, lv + 1) + "」・Lv" + (lv + 1) : it.b === "hall" ? "升到 Lv" + (lv + 1) : "升級成「" + lookName(it.b, lv + 1) + "」・Lv" + (lv + 1);
    let up;
    if (lock === "max") up = '<div class="up-row max">' + icon + '<span class="up-txt"><b>已經是最高等級</b></span></div>';
    else if (lock === "tasks" || (it.b === "hall" && evolve)) up = '<button class="up-row" data-act="city-sheet" data-s="evo">' + icon + '<span class="up-txt"><b>' + title + '</b><span class="small muted">' + (evolveReady(c) ? "進化任務都完成了！" : "先完成進化任務") + '</span></span><span class="price">任務 ›</span></button>';
    else if (lock) up = '<div class="up-row max">' + icon + '<span class="up-txt"><b>' + title + '</b><span class="small muted">' + nextTxt + '</span><span class="small" style="color:#C97A00">' + lock + "</span></span></div>";
    else up = '<button class="up-row" data-act="city-upgrade" data-k="' + o.k + '"' + (bal < cost ? " disabled" : "") + ">" + icon + '<span class="up-txt"><b>' + title + '</b><span class="small muted">' + nextTxt +
      '</span></span><span class="price"><img class="coin-icon" src="' + COIN_IMG + '" alt="">' + cost + "</span></button>";
    /* only upgrading here: turning, grounds and removing live in 編輯 */
    return head(cityName(it)) + (info || tag ? '<p class="small" style="margin:0">' + info + (tag ? " " + tag : "") + "</p>" : "") + up;
  }
  if (o.s === "evo"){
    const g = evolveGoal(c); if (!g) return head("市中心") + '<p class="muted" style="margin:0">已經是宇宙文明中心了！</p>';
    const lv = hallLv(c), tasks = evolveTasks(c), ready = evolveReady(c), cost = 300 * tierOf(lv);
    const atLv = lv % 3 === 0;
    return head("進化成「" + g.name + "」") +
      '<p class="small muted" style="margin:0">' + hallName(lv) + " → " + g.name + "：整座城進入「" + ERA_NAMES[g.tier - 1] + "」，小島變大，建築可以翻新成新時代的樣子，新蓋的建築也會是新時代的。</p>" +
      '<div class="evo-list">' + (atLv ? "" : '<div class="evo-row"><i class="evo-dot"></i><span>市中心先升到 Lv' + ((g.tier - 1) * 3) + '</span><small>現在 Lv' + lv + "</small></div>") +
      tasks.map(x => '<div class="evo-row' + (x.ok ? " ok" : "") + '"><i class="evo-dot">' + (x.ok ? "✓" : "") + "</i><span>" + x.label + "</span><small>" + (x.ok ? "完成" : "現在 " + x.now) + "</small></div>").join("") + "</div>" +
      '<button class="btn block green" data-act="city-evolve"' + (!ready || bal < cost ? " disabled" : "") + '>進化 <img class="coin-icon" src="' + COIN_IMG + '" alt="">' + cost + "</button>";
  }
  if (o.s === "shop"){
    return head("商店") + '<div class="stack">' +
      '<div class="label">糧食</div><button class="menu-row" data-act="city-food"' + (bal < CITY_FOOD.price ? " disabled" : "") + '><span><b>一箱糧食 × ' + CITY_FOOD.n + '</b><span class="small muted">現在有 ' + c.food + ' 份・每位居民一天吃 1 份</span></span><span class="price"><img class="coin-icon" src="' + COIN_IMG + '" alt="">' + CITY_FOOD.price + "</span></button>" +
      '<div class="label">建築</div><p class="small muted" style="margin:0">點島上的空地就能選建築來蓋。</p>' +
      '<p class="small muted" style="margin:0">想讓小島變大？點島中央的市中心升級。</p>' +
      "</div>";
  }
  if (o.s === "avatar"){
    let html = head("裝扮") + '<div class="avatar-big">' + avatarSVG(c.avatar, 120) + "</div>";
    Object.entries(CITY_PARTS).forEach(([slot, def]) => {
      html += '<div class="label">' + def.label + '</div><div class="row wrap">' + Object.entries(def.items).map(([k, name]) => {
        const own = c.owned[slot].includes(k), on = c.avatar[slot] === k, price = CITY_PART_PRICE[k];
        if (own) return '<button class="chip pick' + (on ? " on" : "") + '" data-act="city-wear" data-slot="' + slot + '" data-k="' + k + '">' + name + "</button>";
        if (price) return '<button class="chip buy" data-act="city-buypart" data-slot="' + slot + '" data-k="' + k + '"' + (bal < price ? " disabled" : "") + ">" + name + ' <img class="coin-icon" src="' + COIN_IMG + '" alt="">' + price + "</button>";
        return '<span class="chip locked">' + name + (CITY_RARE.has(k) ? "・稀有" : "") + "・禮物限定</span>";
      }).join("") + "</div>";
    });
    return html;
  }
  if (o.s === "bag"){
    const decos = c.owned.deco.reduce((m, d) => (m[d] = (m[d] || 0) + 1, m), {});
    return head("背包") + '<div class="stack">' +
      '<div class="label">學習雙倍卡</div><div class="menu-row"><span><b>' + c.boosts.double + ' 張</b><span class="small muted">' + (c.boosts.active ? "使用中：接下來 " + c.boosts.active + " 次練習的金幣加倍" : "用了之後，接下來 3 次練習（讀文章、造句、聊天）拿到的金幣加倍") + "</span></span>" +
        '<button class="btn sm" data-act="city-useboost"' + (!c.boosts.double ? " disabled" : "") + ">使用</button></div>" +
      '<div class="label">裝飾</div>' + (Object.keys(decos).length ? Object.entries(decos).map(([d, n]) => '<div class="menu-row"><span><b>' + CITY_DECOS[d] + (CITY_RARE.has(d) ? "（稀有）" : "") + "</b><span class=\"small muted\">" + n + " 個・點島上的空地放上去</span></span></div>").join("") : '<p class="small muted" style="margin:0">幫居民解決請求，有機會拿到裝飾。</p>') +
      "</div>";
  }
  if (o.s === "req"){
    const q = c.day.requests.find(x => x.id === o.id); if (!q) return head("請求") + '<p class="muted">這個請求不見了。</p>';
    const p = c.residents[q.who] || {name:"居民", color:"#999"};
    let html = head(esc(p.name) + " 想請你幫忙") + '<div class="ex-box"><span class="en" data-ctx="creq-' + q.id + '">' + tapText(q.say, "creq-" + q.id) + ' <button class="btn ghost sm" style="padding:2px 6px;min-height:0;vertical-align:middle" data-act="say" data-text="' + esc(q.say) + '" aria-label="朗讀">' + ICON.speaker.replace("<svg", '<svg width="16" height="16"') + "</button></span>" + (q.question_zh ? '<span class="zh">' + esc(q.question_zh) + "</span>" : "") + "</div>";
    if (q.status === "open"){
      if (q.type === "choice") html += '<div class="stack">' + q.options.map((t, i) => '<button class="menu-row" data-act="city-answer" data-id="' + q.id + '" data-i="' + i + '"><span class="en">' + esc(t) + "</span></button>").join("") + "</div>";
      else html += '<textarea class="input" id="city-ans" rows="2" placeholder="用英文回答（一個單字或一句話都可以）">' + esc(o.draft || "") + '</textarea>' +
        (S.busy.cityAns ? '<button class="btn block" disabled><span class="spinner"></span>檢查中…</button>' : '<button class="btn green block" data-act="city-answer" data-id="' + q.id + '">送出</button>');
      if (o.msg) html += '<div class="note warn">' + esc(o.msg) + "</div>";
    } else {
      html += '<div class="note ' + (q.status === "done" ? "ok" : "warn") + '">' + (q.status === "done" ? "答對了！" : "這次沒答對。") + (q.better ? " 參考答案：<b>" + esc(q.better) + "</b>" : "") + "</div>" +
        (q.explain_zh ? '<p class="small" style="margin:0">' + esc(q.explain_zh) + "</p>" : "") +
        (q.gift ? '<div class="gift">拿到禮物：<b>' + esc(q.gift) + "</b></div>" : "");
    }
    return html;
  }
  return head("我的城市");
}

/* ---------- requests ---------- */
function cityReqPrompt(n){
  const w = curWeek(), words = w ? w.words.map(x => x.en).join(", ") : "";
  return [
    "You write tiny English tasks for a cozy island town game. Residents ask the player for help in English.",
    "The player is an adult learner in Taiwan at level " + levelText() + ". Match that level.",
    words ? "When it fits naturally, use some of these words the player is studying: " + words + "." : "",
    "Write " + n + " requests, mixing two kinds:",
    '- "choice": the resident says one everyday line; the player picks the one grammatically correct sentence out of 3 (the other two have one typical learner mistake each, e.g. "I standardly need a cup of coffee." vs "I usually need a cup of coffee.").',
    '- "free": the resident asks for something or asks a question (e.g. "I\'m looking for a tool to fix my bike."); the player answers with an English word or a short sentence.',
    "Reply with only JSON. Chinese in Traditional Chinese (Taiwan). Keep every English line under 15 words.",
    '{"requests":[{"type":"choice","say":"<what the resident says>","question_zh":"<the task in Chinese, e.g. 哪一句文法正確？>","options":["...","...","..."],"answer":1,"explain_zh":"<why, one short sentence>"},' +
    '{"type":"free","say":"<the resident\'s request or question>","question_zh":"<what to answer, in Chinese>","answers":["<short correct answers, e.g. wrench>","<a full sentence, e.g. Here is a wrench.>"],"explain_zh":"<one short sentence>"}]}'
  ].filter(Boolean).join("\n");
}
function cityJudgePrompt(q, answer){
  return [
    "A resident in an English-learning game said: \"" + q.say + "\" Task: " + (q.question_zh || "respond") + ".",
    "Good answers include: " + (q.answers || []).join(" / "),
    "The player (level " + levelText() + ") answered: \"" + answer + "\"",
    "Accept any answer that fits and is understandable, even with small mistakes.",
    'Reply with only JSON, Chinese in Traditional Chinese (Taiwan): {"ok":true,"better":"<a natural way to say it>","explain_zh":"<one short sentence>"}'
  ].join("\n");
}
/* turn whatever shape the AI replied in into clean requests (drops the ones that can't be played) */
function cityReqList(r){
  let arr = Array.isArray(r) ? r : r && typeof r === "object" ? (r.requests || r.tasks || r.items || Object.values(r).find(Array.isArray) || []) : [];
  if (arr.length === 1 && arr[0] && Array.isArray(arr[0].requests)) arr = arr[0].requests;
  const str = v => v == null ? "" : typeof v === "object" ? String(v.text || v.en || v.sentence || Object.values(v)[0] || "") : String(v);
  return arr.map(q => {
    if (!q || typeof q !== "object") return null;
    const say = str(q.say || q.line || q.text || q.resident_says).trim();
    const options = Array.isArray(q.options) ? q.options.map(str).map(x => x.replace(/^\s*[A-Ca-c1-3][.)、]\s*/, "").trim()).filter(Boolean) : [];
    const type = q.type === "free" ? "free" : options.length >= 2 ? "choice" : "free";
    let answer = q.answer;
    if (type === "choice"){
      if (typeof answer === "string"){
        const a = answer.trim(), L = "ABC".indexOf(a.toUpperCase());
        answer = /^\d+$/.test(a) ? Number(a) : a.length === 1 && L >= 0 ? L : options.findIndex(o => o.toLowerCase() === a.toLowerCase());
      }
      answer = Number(answer);
      if (answer === options.length) answer = options.length - 1;   /* counted from 1 */
      if (!(answer >= 0 && answer < options.length)) return null;
    }
    let answers = Array.isArray(q.answers) ? q.answers.map(str).filter(Boolean) : [];
    if (type === "free" && !answers.length && q.answer != null) answers = [str(q.answer)];
    if (!say || (type === "free" && !answers.length)) return null;
    return {type, say, question_zh:str(q.question_zh || q.task_zh), options:type === "choice" ? options : [], answer:type === "choice" ? answer : 0, answers, explain_zh:str(q.explain_zh || q.explain)};
  }).filter(Boolean);
}
async function cityFeed(){
  const c = city(), act = activeResidents(c), n = act.length;
  if (!n || c.day.fed || S.busy.city) return;
  if (c.food < n){ cityOpen({s:"shop"}); toast("糧食不夠了，先買一箱吧。"); return; }
  S.busy.city = true; S.err.city = ""; render();
  try {
    const want = Math.min(n, reqCap(c));
    /* ask once more if the reply can't be used; keep the last bad reply so it can be looked at (localStorage "eel-aifail") */
    let list = [];
    for (let t = 0; t < 2 && !list.length; t++){
      const res = await callAI("city", cityReqPrompt(want), {cache:false, json:true});
      try { list = cityReqList(parseLoose(res.text)).slice(0, want); } catch (e) {}
      if (!list.length) try { localStorage.setItem(LS + "aifail", JSON.stringify({at:new Date().toISOString(), task:"city", model:taskCfg("city").model, text:String(res.text).slice(0, 4000)})); } catch (e) {}
    }
    if (!list.length) throw {code:"invalid_json"};
    const order = act.slice().sort(() => Math.random() - .5);
    c.food -= n; c.day.fed = true;
    c.day.requests = list.map((q, i) => ({id:Date.now().toString(36) + i, who:order[i % order.length], type:q.type === "choice" ? "choice" : "free",
      say:q.say, question_zh:q.question_zh, options:q.options, answer:q.answer,
      answers:q.answers, explain_zh:q.explain_zh, status:"open", tries:0}));
    saveCity();
  } catch (e) { S.err.city = aiErr(e); }
  S.busy.city = false; render();
}
function cityGift(){
  const c = city(), roll = Math.random();
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const rareChance = hallTier(c) >= 3 ? .3 : hallTier(c) >= 2 ? .15 : 0;
  const rarePick = (keys) => { const common = keys.filter(k => !CITY_RARE.has(k)), rare = keys.filter(k => CITY_RARE.has(k)); return rare.length && Math.random() < rareChance ? pick(rare) : pick(common); };
  c.giftsGot = (c.giftsGot || 0) + 1;
  if (roll < .4){
    const slot = pick(Object.keys(CITY_PARTS));
    const k = rarePick(Object.keys(CITY_PARTS[slot].items).filter(x => x !== "none" && x !== "tee"));
    const name = CITY_PARTS[slot].items[k];
    if (c.owned[slot].includes(k)){ earn(20, "城市禮物（重複的" + name + "換成金幣）"); return name + "（已經有了，換成 20 金幣）"; }
    c.owned[slot].push(k); return (CITY_RARE.has(k) ? "稀有裝扮：" : "裝扮：") + name;
  }
  if (roll < .7){ const d = rarePick(Object.keys(CITY_DECOS)); c.owned.deco.push(d); return (CITY_RARE.has(d) ? "稀有建築裝飾：" : "建築裝飾：") + CITY_DECOS[d]; }
  c.boosts.double += 1; return "學習雙倍卡 × 1";
}
async function cityAnswer(el){
  const c = city(), q = c.day.requests.find(x => x.id === el.dataset.id);
  if (!q || q.status !== "open") return;
  let ok = false;
  if (q.type === "choice"){
    ok = Number(el.dataset.i) === q.answer;
    q.better = q.options[q.answer];
  } else {
    const box = $("#city-ans"), ans = (box ? box.value : "").trim();
    if (!ans){ toast("先用英文寫一點再送出。"); return; }
    const norm = t => t.toLowerCase().replace(/[^a-z' ]/g, " ").replace(/\s+/g, " ").trim();
    if ((q.answers || []).some(a => norm(a) && (" " + norm(ans) + " ").includes(" " + norm(a) + " "))){ ok = true; q.better = q.answers[q.answers.length - 1] || ""; }
    else {
      S.busy.cityAns = true; S.sheet.draft = ans; drawSheet();
      try {
        const r = await aiJson("review", cityJudgePrompt(q, ans), {cache:false});
        ok = !!(r && r.ok); q.better = String((r && r.better) || q.answers[0] || ""); if (r && r.explain_zh) q.explain_zh = String(r.explain_zh);
      } catch (e) { S.busy.cityAns = false; S.sheet.msg = aiErr(e); drawSheet(); return; }
      S.busy.cityAns = false;
    }
    q.tries = (q.tries || 0) + 1;
    if (!ok && q.tries < 2){ S.sheet.msg = "差一點！再試一次。"; S.sheet.draft = ans; saveCity(); drawSheet(); return; }
  }
  q.status = ok ? "done" : "failed";
  if (ok){ q.gift = cityGift(); logActivity("practice"); gainKnow(4, "幫居民解決請求"); }
  saveCity(); S.sheet.msg = ""; drawSheet(); render();
  if (ok) toast("拿到禮物：" + q.gift);
}

/* 編輯: drag an item from the library onto the island.
   Mouse: just drag. Touch: hold the item a moment, then drag (a quick swipe still scrolls the list). */
(() => {
  let drag = null;
  const lift = () => { if (!drag) return; drag.ready = true; if (drag.el) drag.el.classList.add("lift"); try { navigator.vibrate && navigator.vibrate(12); } catch (e) {} };
  document.addEventListener("pointerdown", e => {
    const it = e.target.closest && e.target.closest(".ce-item");
    if (!it || it.disabled || !S.cityEdit) return;
    drag = {key:it.dataset.v, el:it, x:e.clientX, y:e.clientY, ghost:null, ready:e.pointerType === "mouse", label:it.querySelector("b") ? it.querySelector("b").textContent : ""};
    if (!drag.ready) drag.timer = setTimeout(lift, 280);
  });
  document.addEventListener("pointermove", e => {
    if (!drag) return;
    const far = Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 8;
    if (!drag.ready){ if (far){ clearTimeout(drag.timer); drag = null; } return; }
    if (!drag.ghost){
      if (!far) return;
      drag.ghost = document.createElement("div"); drag.ghost.className = "ce-ghost"; drag.ghost.textContent = drag.label;
      document.body.appendChild(drag.ghost);
    }
    drag.ghost.style.transform = "translate(" + e.clientX + "px," + e.clientY + "px) translate(-50%,-130%)";
    drag.ghost.classList.toggle("ok", !!City3D.keyAt(e.clientX, e.clientY));
  });
  /* while an item is lifted, the finger moves it instead of scrolling the page */
  document.addEventListener("touchmove", e => { if (drag && drag.ready && e.cancelable) e.preventDefault(); }, {passive:false});
  const end = e => {
    if (!drag) return;
    const d = drag; drag = null; clearTimeout(d.timer);
    if (d.el) d.el.classList.remove("lift");
    if (!d.ghost) return;
    d.ghost.remove();
    /* the click that follows a drag shouldn't also toggle the item */
    const stop = ev => { ev.stopPropagation(); ev.preventDefault(); };
    document.addEventListener("click", stop, {capture:true, once:true}); setTimeout(() => document.removeEventListener("click", stop, {capture:true}), 300);
    const k = e.type === "pointerup" ? City3D.keyAt(e.clientX, e.clientY) : "";
    if (k && S.cityEdit){ S.cityEdit.sel = d.key; cityEditApply(k); }
  };
  document.addEventListener("pointerup", end);
  document.addEventListener("pointercancel", end);
})();
