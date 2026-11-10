/* =========================================================
   關於我 — age range, gender and interests.
   Asked during onboarding (each step can be skipped), editable in 設定 → 關於我,
   saved in profile.about and used to fit topics, examples and talk to the learner.
   ========================================================= */
const AGE_MIN = 6, AGE_MAX = 90, AGE_DEFAULT = 30;
const OLD_AGES = {u18:16, "18":21, "25":30, "35":40, "45":50, "55":60, "65":68};   /* the first version asked for a range */
const GENDERS = [["f", "女"], ["m", "男"], ["n", "不想回答"]];
/* the age as a number (0 when not given) */
function ageNum(a){
  a = a || (S.profile && S.profile.about) || {};
  const v = a.age; if (!v) return 0;
  if (typeof v === "string" && OLD_AGES[v]) return OLD_AGES[v];
  const n = parseInt(v, 10); return n >= AGE_MIN && n <= AGE_MAX ? n : 0;
}
/* a wheel to scroll: the middle row is the choice. Saved when it stops (see wheelSettle) */
function wheelHTML(name, items, cur){
  const rows = items.map(([v, l]) => '<div class="wheel-i" role="option" data-v="' + v + '" aria-selected="' + (String(v) === String(cur)) + '">' + l + "</div>").join("");
  return '<div class="wheel" data-wheel="' + name + '"><div class="wheel-hl" aria-hidden="true"></div><div class="wheel-list" role="listbox" tabindex="0">' +
    '<div class="wheel-pad"></div><div class="wheel-pad"></div>' + rows + '<div class="wheel-pad"></div><div class="wheel-pad"></div></div></div>';
}
function wheelIndex(list){ return Math.max(0, Math.round(list.scrollTop / list.firstElementChild.offsetHeight)); }
function wheelMark(list){
  const items = list.querySelectorAll(".wheel-i"), i = Math.min(items.length - 1, wheelIndex(list));
  items.forEach((x, k) => x.setAttribute("aria-selected", k === i));
  return items[i];
}
/* put every wheel on screen at its value (call after each render) */
function wheelInit(){
  const place = () => document.querySelectorAll(".wheel-list").forEach(list => {
    const items = list.querySelectorAll(".wheel-i"); if (!items.length) return;
    const on = list.querySelector('.wheel-i[aria-selected="true"]') || items[Number(list.dataset.def) || 0];
    list.style.scrollSnapType = "none";
    list.scrollTop = on.offsetTop - items[0].offsetTop;
    list.style.scrollSnapType = ""; wheelMark(list);
  });
  place(); requestAnimationFrame(place);   /* again once the layout has settled */
}
function wheelSettle(list){
  const it = wheelMark(list), w = list.parentElement.dataset.wheel, a = aboutOf(), v = it.dataset.v;
  if (w === "age") a.age = Number(v); else a.gender = v;
  aboutSave();
  if (!S.profile) render();   /* the dock button turns from 略過 to 繼續 */
}
(function(){
  let t = 0;
  document.addEventListener("scroll", e => {
    const list = e.target; if (!list.classList || !list.classList.contains("wheel-list")) return;
    wheelMark(list); clearTimeout(t); t = setTimeout(() => { if (list.isConnected && list.dataset.touched) wheelSettle(list); }, 140);
  }, true);
  const touch = e => { const l = e.target.closest && e.target.closest(".wheel-list"); if (l) l.dataset.touched = "1"; };
  document.addEventListener("pointerdown", touch, true); document.addEventListener("wheel", touch, true); document.addEventListener("keydown", touch, true);
  document.addEventListener("click", e => {
    const i = e.target.closest && e.target.closest(".wheel-i"); if (!i) return;
    const list = i.parentElement; list.dataset.touched = "1";
    const first = list.querySelector(".wheel-i");
    if (i.getAttribute("aria-selected") === "true") wheelSettle(list);
    else list.scrollTo({top: i.offsetTop - first.offsetTop, behavior: "smooth"});
  });
})();
/* each interest also offers a weekly theme */
const INTERESTS = [
  ["cook", "料理", "cooking", "在家做料理", "Cooking at home"], ["food", "美食", "food and restaurants", "找好吃的餐廳", "Eating out"],
  ["travel", "旅行", "travel", "出國旅行", "Travelling abroad"], ["sport", "運動", "sports and exercise", "運動健身", "Staying active"],
  ["health", "健康", "health", "照顧身體健康", "Looking after your health"], ["tech", "科技", "technology", "新科技與 App", "New tech and apps"],
  ["music", "音樂", "music", "聊音樂", "Talking about music"], ["movie", "電影影集", "movies and TV series", "看電影追劇", "Movies and series"],
  ["read", "閱讀", "books and reading", "聊一本好書", "Talking about books"], ["game", "遊戲", "games", "玩遊戲", "Playing games"],
  ["pet", "寵物", "pets", "養寵物", "Living with pets"], ["family", "家庭親子", "family and kids", "家庭和孩子", "Family life"],
  ["money", "投資理財", "money and investing", "理財與存錢", "Money and saving"], ["work", "職場", "work and career", "職場溝通", "Talking at work"],
  ["art", "藝術設計", "art and design", "逛展覽", "Art and design"], ["nature", "大自然", "nature and the outdoors", "登山露營", "Into the outdoors"],
  ["fashion", "穿搭", "fashion", "逛街穿搭", "Shopping for clothes"], ["garden", "園藝", "gardening", "種花種菜", "Gardening"]
];
function aboutOf(){ return S.profile ? (S.profile.about || (S.profile.about = {})) : (S.onb.about || (S.onb.about = {})); }
function aboutSave(){ if (S.profile) saveProfile(); }
function hasAbout(a){ a = a || (S.profile && S.profile.about); return !!(a && (ageNum(a) || a.gender || (a.interests || []).length)); }

/* one part of the form: "age", "gender" or "interests" */
function aboutPartHTML(part){
  const a = aboutOf();
  const chip = (act, v, label, on) => '<button class="chip-btn" data-act="' + act + '" data-v="' + v + '" aria-pressed="' + !!on + '">' + label + "</button>";
  if (part === "age"){
    const ages = []; for (let n = AGE_MIN; n <= AGE_MAX; n++) ages.push([n, n + " 歲"]);
    const n = ageNum(a);
    return wheelHTML("age", ages, n || "").replace('class="wheel-list"', 'class="wheel-list" data-def="' + (AGE_DEFAULT - AGE_MIN) + '"');
  }
  if (part === "gender") return wheelHTML("gender", GENDERS, a.gender);
  const on = new Set(a.interests || []);
  return '<div class="chip-grid">' + INTERESTS.map(([k, l]) => chip("about-int", k, l, on.has(k))).join("") + "</div>";
}
const ABOUT_STEPS = {
  age:["你的年齡"], gender:["你的性別"], interests:["你的興趣"]
};
/* the 關於我 page in settings */
function aboutCardHTML(){
  return '<section class="card pref-card"><h2 style="font-size:20px;margin:0">關於我</h2>' +
    ["age", "gender", "interests"].map(p => '<div class="pref-group"><div class="pref-h">' + ABOUT_STEPS[p][0].replace("你的", "") + "</div>" + aboutPartHTML(p) + "</div>").join("") + "</section>";
}
/* the one-time card on the home page for people who joined before these questions existed */
function aboutBannerHTML(){
  const p = S.profile; if (!p || hasAbout() || p.aboutAsked) return "";
  return '<div class="banner about-banner"><button class="ab-go" data-act="pref-open" data-p="about"><span class="banner-ic" aria-hidden="true">' + ICON.user + '</span><span><b>補填「關於我」</b></span></button>' +
    '<button class="ab-x" data-act="about-dismiss" aria-label="不用了">×</button></div>';
}
/* the learner, in words for the AI (empty when nothing was filled in) */
function aboutPrompt(withGender){
  const a = S.profile && S.profile.about; if (!hasAbout(a)) return "";
  const parts = [];
  const age = ageNum(a); if (age) parts.push("age " + age);
  if (withGender){
    if (a.gender === "m") parts.push("male (he/him)");
    else if (a.gender === "f") parts.push("female (she/her)");
  }
  const ints = (a.interests || []).map(k => (INTERESTS.find(x => x[0] === k) || [])[2]).filter(Boolean);
  if (ints.length) parts.push("interested in " + ints.join(", "));
  if (!parts.length) return "";
  return "About the learner: " + parts.join("; ") + ". Choose situations and examples that fit their life, without stereotypes.";
}
/* weekly themes from the learner's interests */
function interestThemes(){
  const a = S.profile && S.profile.about;
  return ((a && a.interests) || []).map(k => INTERESTS.find(x => x[0] === k)).filter(Boolean).map(x => ({zh:x[3], en:x[4]}));
}
/* settings that fit an age: a slower voice from 55, bigger text from 65 */
function aboutDefaults(st, a){
  if (!a) return;
  const n = ageNum(a);
  if (n >= 55) st.rate = Math.min(st.rate || .9, .8);
  if (n >= 65) st.font = "l";
}
function aboutSummary(){
  const a = S.profile.about || {}, out = [];
  if (ageNum(a)) out.push(ageNum(a) + " 歲");
  const g = GENDERS.find(x => x[0] === a.gender); if (g) out.push(g[1]);
  if ((a.interests || []).length) out.push((a.interests || []).length + " 個興趣");
  return out.join("・");
}
/* "an adult in Taiwan", or a younger learner when they said they are under 18 */
function learnerNoun(learner){ const n = ageNum(), kid = n > 0 && n < 18; return (kid ? "a teenager" : "an adult") + (learner ? " learner" : "") + " in Taiwan"; }
