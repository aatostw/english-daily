/* =========================================================
   關於我 — age range, gender and interests.
   Asked during onboarding (each step can be skipped), editable in 設定 → 關於我,
   saved in profile.about and used to fit topics, examples and talk to the learner.
   ========================================================= */
const AGE_RANGES = [["u18", "18 歲以下", "under 18"], ["18", "18–24", "18-24"], ["25", "25–34", "25-34"], ["35", "35–44", "35-44"],
  ["45", "45–54", "45-54"], ["55", "55–64", "55-64"], ["65", "65 以上", "65 or older"]];
const GENDERS = [["m", "男"], ["f", "女"], ["x", "其他"], ["n", "不想說"]];
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
/* the 其他 gender text box saves whenever we move on */
function aboutGText(){ const i = $("#about-gtext"); if (i){ aboutOf().genderText = i.value.trim().slice(0, 30); aboutSave(); } }
function hasAbout(a){ a = a || (S.profile && S.profile.about); return !!(a && (a.age || a.gender || (a.interests || []).length)); }

/* one part of the form: "age", "gender" or "interests" */
function aboutPartHTML(part){
  const a = aboutOf();
  const chip = (act, v, label, on) => '<button class="chip-btn" data-act="' + act + '" data-v="' + v + '" aria-pressed="' + !!on + '">' + label + "</button>";
  if (part === "age") return '<div class="chip-grid">' + AGE_RANGES.map(([k, l]) => chip("about-age", k, l, a.age === k)).join("") + "</div>";
  if (part === "gender") return '<div class="chip-grid g2">' + GENDERS.map(([k, l]) => chip("about-gender", k, l, a.gender === k)).join("") + "</div>" +
    (a.gender === "x" ? '<div class="field" style="margin-top:10px"><label for="about-gtext">想怎麼描述自己？（選填）</label><input class="input" id="about-gtext" maxlength="30" data-act-change="about-gtext" value="' + esc(a.genderText || "") + '"></div>' : "");
  const on = new Set(a.interests || []);
  return '<div class="chip-grid">' + INTERESTS.map(([k, l]) => chip("about-int", k, l, on.has(k))).join("") + "</div>" +
    '<p class="small muted" style="margin:8px 0 0">可以多選；每週挑主題時會優先推薦。</p>';
}
const ABOUT_STEPS = {
  age:["你的年齡", "讓文章和例句更貼近你的生活。"],
  gender:["你的性別", "對話練習時，AI 會用對的方式稱呼你。"],
  interests:["你的興趣", "每週的主題會優先從這裡挑。"]
};
/* the 關於我 page in settings */
function aboutCardHTML(){
  return '<section class="card pref-card"><h2 style="font-size:20px;margin:0">關於我</h2>' +
    '<p class="small muted" style="margin:0">用來讓文章、例句和對話更適合你。都可以不填。</p>' +
    ["age", "gender", "interests"].map(p => '<div class="pref-group"><div class="pref-h">' + ABOUT_STEPS[p][0].replace("你的", "") + "</div>" + aboutPartHTML(p) + "</div>").join("") + "</section>";
}
/* the one-time card on the home page for people who joined before these questions existed */
function aboutBannerHTML(){
  const p = S.profile; if (!p || hasAbout() || p.aboutAsked) return "";
  return '<div class="banner about-banner"><button class="ab-go" data-act="pref-open" data-p="about"><span class="banner-ic" aria-hidden="true">' + ICON.user + '</span><span><b>補填「關於我」</b><small>年齡、興趣，讓內容更適合你</small></span></button>' +
    '<button class="ab-x" data-act="about-dismiss" aria-label="不用了">×</button></div>';
}
/* the learner, in words for the AI (empty when nothing was filled in) */
function aboutPrompt(withGender){
  const a = S.profile && S.profile.about; if (!hasAbout(a)) return "";
  const parts = [];
  const age = AGE_RANGES.find(x => x[0] === a.age); if (age) parts.push("age " + age[2]);
  if (withGender){
    if (a.gender === "m") parts.push("male (he/him)");
    else if (a.gender === "f") parts.push("female (she/her)");
    else if (a.gender === "x") parts.push(a.genderText ? "describes their gender as \"" + String(a.genderText).slice(0, 30) + "\" (use they/them unless it says otherwise)" : "non-binary (they/them)");
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
  if (a.age === "55" || a.age === "65") st.rate = Math.min(st.rate || .9, .8);
  if (a.age === "65") st.font = "l";
}
function aboutSummary(){
  const a = S.profile.about || {}, out = [];
  const age = AGE_RANGES.find(x => x[0] === a.age); if (age) out.push(age[1]);
  const g = GENDERS.find(x => x[0] === a.gender); if (g) out.push(a.gender === "x" && a.genderText ? a.genderText : g[1]);
  if ((a.interests || []).length) out.push((a.interests || []).length + " 個興趣");
  return out.join("・");
}
/* "an adult in Taiwan", or a younger learner when they said they are under 18 */
function learnerNoun(learner){ const kid = S.profile && S.profile.about && S.profile.about.age === "u18"; return (kid ? "a teenager" : "an adult") + (learner ? " learner" : "") + " in Taiwan"; }
