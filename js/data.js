/* =========================================================
   Course data
   ========================================================= */
const PATTERNS = [
  // 第一階段：表達需求和狀態
  {en:"I want to ___", zh:"我想要…", ex:"I want to speak English with confidence.", exZh:"我想要有自信地說英文。", re:"\\bwant(s|ed)? to\\b"},
  {en:"I need to ___", zh:"我需要…", ex:"I need to sleep earlier.", exZh:"我需要早點睡。", re:"\\bneed(s|ed)? to\\b"},
  {en:"I have to ___", zh:"我必須…（不得不）", ex:"I have to finish this report today.", exZh:"我今天必須做完這份報告。", re:"\\b(have|has|had) to\\b"},
  {en:"I'm going to ___", zh:"我打算／將要…", zhKey:"要", ex:"I'm going to call my mom tonight.", exZh:"我今晚要打給我媽。", re:"\\bgoing to\\b|\\bgonna\\b"},
  {en:"I'm about to ___", zh:"我正要…", ex:"I'm about to leave.", exZh:"我正要出門。", re:"\\babout to\\b"},
  {en:"I'm trying to ___", zh:"我正在努力…", ex:"I'm trying to drink more water.", exZh:"我正在努力多喝水。", re:"\\b(try|tries|trying|tried) to\\b"},
  {en:"I'm used to ___ing", zh:"我習慣…", ex:"I'm used to waking up early.", exZh:"我習慣早起。", re:"\\b(am|'m|is|'s|are|'re|was|were|be|been)\\s+used to\\b"},
  {en:"I'm getting used to ___ing", zh:"我漸漸習慣…", ex:"I'm getting used to living alone.", exZh:"我漸漸習慣一個人住。", re:"\\b(get|gets|getting|got) used to\\b"},
  {en:"I don't know how to ___", zh:"我不知道怎麼…", ex:"I don't know how to say no.", exZh:"我不知道怎麼拒絕。", re:"\\bknow how to\\b"},
  {en:"I'm looking forward to ___ing", zh:"我很期待…", ex:"I'm looking forward to seeing you.", exZh:"我很期待見到你。", re:"\\blook(ing)? forward to\\b"},
  // 第二階段：描述感受
  {en:"It makes me feel ___", zh:"這讓我覺得…", ex:"Rain makes me feel calm.", exZh:"下雨讓我覺得平靜。", re:"\\b(make|makes|made) (me|you|him|her|us|them|people) feel\\b"},
  {en:"I feel like ___ing", zh:"我想要…（口語）", ex:"I feel like eating something sweet.", exZh:"我想吃點甜的。", re:"\\b(feel|feels|felt) like\\b"},
  {en:"It's hard to ___", zh:"…很難", ex:"It's hard to stay calm.", exZh:"要保持冷靜很難。", re:"\\b(it'?s|it is|it was) (so |really |very )?(hard|difficult) to\\b"},
  {en:"It takes time to ___", zh:"…需要時間", ex:"It takes time to make real friends.", exZh:"交到真正的朋友需要時間。", re:"\\b(take|takes|took) (some |a lot of )?time to\\b"},
  {en:"I can't stop ___ing", zh:"我忍不住一直…", ex:"I can't stop thinking about it.", exZh:"我一直忍不住去想這件事。", re:"\\b(can'?t|cannot|couldn'?t) stop\\b"},
  {en:"I'm afraid of ___ing", zh:"我害怕…", ex:"I'm afraid of making mistakes.", exZh:"我害怕犯錯。", re:"\\bafraid (of|to|that)\\b"},
  {en:"I'm tired of ___ing", zh:"我厭倦了…", ex:"I'm tired of waiting.", exZh:"我厭倦了等待。", re:"\\btired of\\b"},
  {en:"The more ___, the more ___", zh:"越…就越…", ex:"The more you practice, the easier it gets.", exZh:"你練得越多，就越容易。", re:"\\bthe more\\b"},
  {en:"It's not that ___. It's just that ___", zh:"不是…只是…", ex:"It's not that I don't care. It's just that I'm tired.", exZh:"不是我不在乎，只是我很累。", re:"\\bnot that\\b|\\bjust that\\b"},
  {en:"All I want is ___", zh:"我只想要…", ex:"All I want is a quiet weekend.", exZh:"我只想要一個安靜的週末。", re:"\\ball (i|you|we|they|he|she) (want|need)(ed)?\\b"},
  // 第三階段：給意見和建議
  {en:"You should ___", zh:"你應該…", ex:"You should take a break.", exZh:"你應該休息一下。", re:"\\bshould\\b(?! have)"},
  {en:"Why don't you ___?", zh:"你何不…？", ex:"Why don't you ask her?", exZh:"你何不問問她？", re:"\\bwhy don'?t (you|we|i)\\b"},
  {en:"How about ___ing?", zh:"…如何？", ex:"How about going for a walk?", exZh:"去散個步如何？", re:"\\b(how|what) about\\b"},
  {en:"If I were you, I would ___", zh:"如果我是你，我會…", ex:"If I were you, I would tell him.", exZh:"如果我是你，我會告訴他。", re:"\\bif i were you\\b"},
  {en:"It's worth ___ing", zh:"值得…", ex:"It's worth trying.", exZh:"值得一試。", re:"\\bworth\\b"},
  {en:"You don't have to ___", zh:"你不必…", ex:"You don't have to be perfect.", exZh:"你不必完美。", re:"\\b(don'?t|doesn'?t|didn'?t|do not|does not) have to\\b"},
  {en:"Instead of ___ing, ___", zh:"與其…不如…", ex:"Instead of scrolling, read one page.", exZh:"與其滑手機，不如讀一頁書。", re:"\\binstead of\\b"},
  {en:"The best way to ___ is to ___", zh:"…最好的方法是…", ex:"The best way to learn is to practice every day.", exZh:"學習最好的方法就是每天練習。", re:"\\bthe best way to\\b"},
  {en:"Make sure you ___", zh:"務必要…", zhKey:"一定要", ex:"Make sure you drink enough water.", exZh:"一定要喝夠水。", re:"\\bmake sure\\b"},
  {en:"What if ___?", zh:"要是…怎麼辦？", ex:"What if it doesn't work?", exZh:"要是沒用怎麼辦？", re:"\\bwhat if\\b"},
  // 第四階段：過去、後悔和假設
  {en:"I used to ___", zh:"我以前常…", ex:"I used to hate mornings.", exZh:"我以前很討厭早上。", re:"\\b(i|you|we|they|he|she|it|people)\\s+(never\\s+)?used to\\b|\\bdidn'?t use to\\b"},
  {en:"I never thought I would ___", zh:"我從沒想過我會…", ex:"I never thought I would live abroad.", exZh:"我從沒想過我會住在國外。", re:"\\bnever thought\\b"},
  {en:"I should have ___", zh:"我當初應該…", ex:"I should have listened.", exZh:"我當初應該聽的。", re:"\\bshould have\\b|\\bshould'?ve\\b"},
  {en:"I shouldn't have ___", zh:"我當初不該…", ex:"I shouldn't have said that.", exZh:"我當初不該那樣說。", re:"\\b(shouldn'?t|should not) have\\b"},
  {en:"I wish I had ___", zh:"我真希望當初有…", ex:"I wish I had started earlier.", exZh:"真希望我早點開始。", re:"\\bwish (i|you|we|they|he|she) had\\b|\\bwish (i|you|we|they|he|she)'d\\b"},
  {en:"I wish I could ___", zh:"我真希望我能…", ex:"I wish I could stay longer.", exZh:"真希望我能待久一點。", re:"\\bwish (i|you|we|they|he|she) could\\b"},
  {en:"If I had known ___, I would have ___", zh:"如果我早知道…，我就會…", ex:"If I had known, I would have helped.", exZh:"如果我早知道，我就會幫忙。", re:"\\bif (i|you|we|they|he|she) had\\b|\\bwould have\\b|\\bwould'?ve\\b"},
  {en:"It was the first time I had ever ___", zh:"那是我第一次…", ex:"It was the first time I had ever flown alone.", exZh:"那是我第一次一個人搭飛機。", re:"\\bthe first time\\b"},
  {en:"Looking back, ___", zh:"回頭看…", ex:"Looking back, it was a good decision.", exZh:"回頭看，那是個好決定。", re:"\\blooking back\\b"},
  {en:"By the time ___, ___", zh:"等到…的時候，已經…", ex:"By the time I got there, the shop had closed.", exZh:"等我到的時候，店已經關了。", re:"\\bby the time\\b"}
];
const STAGES = [
  {name:"第一階段", title:"表達需求和狀態", level:"elementary (CEFR A2): very short sentences, very common words, mostly present tense"},
  {name:"第二階段", title:"描述感受", level:"elementary to intermediate (CEFR A2-B1): short sentences, everyday words"},
  {name:"第三階段", title:"給意見和建議", level:"intermediate (CEFR B1): simple, natural sentences, a few phrasal verbs"},
  {name:"第四階段", title:"過去、後悔和假設", level:"intermediate (CEFR B1-B2): natural sentences with past and conditional forms, still clear"}
];
const TIERS = [
  {name:"菜鳥", desc:"看得懂很基本的句子", ex:"I want to sleep.", exZh:"我想睡覺。", pair:0,
   level:"CEFR A1 (complete beginner): sentences of 5-8 words, only the ~500 most common words, present tense"},
  {name:"學員", desc:"能讀簡單的生活短文", ex:"I need to buy some milk after work.", exZh:"我下班後要買牛奶。", pair:2,
   level:"CEFR A2 (elementary): sentences of 8-12 words, the ~1,500 most common words, simple past and future"},
  {name:"新秀", desc:"看得懂一般話題", ex:"It's hard to stay calm when everyone is in a hurry.", exZh:"大家都在趕的時候，很難保持冷靜。", pair:5,
   level:"CEFR B1 (intermediate): sentences of 12-15 words, ~3,000 common words, everyday phrasal verbs"},
  {name:"高手", desc:"能讀新聞、表達意見", ex:"If I were you, I'd ask for feedback before the deadline.", exZh:"如果我是你，我會在截止前先問意見。", pair:10,
   level:"CEFR B2 (upper intermediate): sentences of 15-20 words, ~5,000 words, phrasal verbs and conditionals"},
  {name:"專家", desc:"接近流利", ex:"Looking back, I should have trusted my instincts sooner.", exZh:"回頭看，我早該相信自己的直覺。", pair:15,
   level:"CEFR C1 (advanced): varied sentence lengths, 8,000+ words, idioms and nuance"},
  {name:"巔峰", desc:"母語程度", ex:"Had I known how it would unfold, I might have bowed out gracefully.", exZh:"早知道事情會這樣發展，我或許會體面地退場。", pair:17,
   level:"CEFR C2 (proficient): natural native-speaker style, rich and literary vocabulary"}
];
function tierIdx(){ const t = S.profile ? S.profile.tier : S.onb.tier; return Number.isInteger(t) ? t : (S.profile ? Math.min(5, Math.round(S.profile.startPair / 5) + 1) : 0); }
function levelText(){ return TIERS[tierIdx()].level; }
const PAIRS = 20; // two patterns a week, five weeks per stage
const THEMES = [
  {zh:"搬到新城市", en:"Moving to a new city"},{zh:"工作壓力", en:"Stress at work"},{zh:"早晨習慣", en:"Morning routines"},
  {zh:"交朋友", en:"Making friends"},{zh:"好好吃飯", en:"Eating well"},{zh:"運動與身體", en:"Exercise and your body"},
  {zh:"錢與存錢", en:"Money and saving"},{zh:"計畫一趟旅行", en:"Planning a trip"},{zh:"工作面試", en:"Job interviews"},
  {zh:"家人", en:"Family"},{zh:"睡眠", en:"Sleep"},{zh:"手機與社群媒體", en:"Phones and social media"},
  {zh:"失敗後再試一次", en:"Failing and trying again"},{zh:"學一項新技能", en:"Learning a new skill"},{zh:"一個人的時間", en:"Time alone"},
  {zh:"感情與約會", en:"Love and dating"},{zh:"跟同事溝通", en:"Talking with coworkers"},{zh:"買東西", en:"Shopping"},
  {zh:"天氣與季節", en:"Weather and seasons"},{zh:"自信", en:"Confidence"},{zh:"時間管理", en:"Managing your time"},
  {zh:"寵物", en:"Pets"},{zh:"咖啡與生活小事", en:"Coffee and small pleasures"},{zh:"學會說不", en:"Learning to say no"}
];
const DAY_NAMES = ["週一","週二","週三","週四","週五","週六","週日"];
const ALL6 = [0,1,2,3,4,5];
const DAY_PLAN = [
  {words:[0,1,2], use:["A"], focus:"A", label:"認識 A 句型和前 3 個單字"},
  {words:[3,4,5], use:["B"], focus:"B", label:"認識 B 句型和後 3 個單字"},
  {words:ALL6, use:["A","B"], focus:"A", label:"A 句型換個情境"},
  {words:ALL6, use:["A","B"], focus:"B", label:"B 句型換個情境"},
  {words:ALL6, use:["A","B","R"], focus:"A", label:"全部混在一起"},
  {words:ALL6, use:["A","B","R"], focus:"B", label:"週日前總複習"}
];
const LENGTHS = {short:{words:250,min:2,label:"短"}, mid:{words:380,min:3,label:"中"}, long:{words:600,min:5,label:"長"}};
const FONT = {s:"18px", m:"20px", l:"23px"};
const TASKS = [
  {key:"write", label:"寫文章和單字表", hint:"每天的短文、每週挑選單字", def:"default"},
  {key:"lookup", label:"查單字", hint:"點單字時跳出的解釋，快一點比較好用", def:"quick"},
  {key:"talk", label:"週日對話", hint:"對話裡對方回話的速度", def:"quick"},
  {key:"review", label:"批改和回饋", hint:"造句批改、對話結束後的回饋", def:"default"}
];
const defaultSettings = () => ({
  models:{
    write:{provider:"gemini", model:"gemini-3.5-flash-lite"}, lookup:{provider:"gemini", model:"gemini-3.5-flash-lite"},
    talk:{provider:"gemini", model:"gemini-3.5-flash-lite"}, review:{provider:"gemini", model:"gemini-3.5-flash-lite"}
  },
  ai:{provider:"gemini", model:"gemini-3.5-flash-lite", fastLookup:true},
  voice:"", rate:0.9, font:"m", length:"mid", genre:"alt",
  voiceSource:"builtin"
});

/* Example shown on the first screen, so the reader works before any AI call. */
const SAMPLE = {
  title:"Five Minutes Is Enough", title_zh:"五分鐘就夠了",
  body:'Many people think, "I need a lot of time to learn English." So they wait. They wait for the weekend. They wait for a holiday. They wait until life is less {{hectic|0}}.\n\nBut life is always {{hectic|0}}.\n\n((You don\'t need|A)) a lot of time. ((You need|B)) a little time, every day. Five minutes in the morning. Five minutes on the bus. Five minutes before bed.\n\nFive minutes feels small. It feels {{pointless|1}}. But small steps {{add up|2}}. One day becomes one week. One week becomes one month.\n\nSo stop waiting. Read one short story. Say it out loud. Then do it again tomorrow.',
  words:[
    {en:"hectic", pos:"形容詞", ipa:"/ˈhek.tɪk/", zh:"忙亂的；非常忙碌的", note_zh:"形容行程或生活忙到很亂，常說 a hectic day、a hectic week。", example_en:"It was a hectic week at work.", example_zh:"這週工作超忙亂。"},
    {en:"pointless", pos:"形容詞", ipa:"/ˈpɔɪnt.ləs/", zh:"沒有意義的；白費力氣的", note_zh:"覺得做了也沒用的時候，可以說 It feels pointless.", example_en:"Don't say it's pointless. Just try.", example_zh:"別說沒用，試試看就對了。"},
    {en:"add up", pos:"片語動詞", ipa:"/æd ˈʌp/", zh:"累積起來；積少成多", note_zh:"小東西慢慢累積成大的：Small things add up.", example_en:"Small savings add up.", example_zh:"小額存款會慢慢累積。"}
  ],
  pats:{A:{en:"You don't need ___", zh:"你不需要…"}, B:{en:"You need ___", zh:"你需要…"}}
};
