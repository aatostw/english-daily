/* =========================================================
   Prompts
   ========================================================= */
function wordsPrompt(theme, pids){
  const A = PATTERNS[pids[0]], B = PATTERNS[pids[1]];
  return [
    "Plan the vocabulary for one week of English practice. Learner: an adult in Taiwan, level " + levelText() + ".",
    "Theme: " + theme.en + " (" + theme.zh + ")",
    "Sentence patterns this week: A: " + A.en + " (" + A.zh + "); B: " + B.en + " (" + B.zh + ")",
    "Pick 6 words or short phrases that fit the theme, are used often in real everyday English, suit the level, and combine naturally with the patterns. Mix verbs, nouns and adjectives, and include at least one phrasal verb or common collocation. Skip words that are too basic (good, go, happy) or rare.",
    "Reply with only JSON in this shape:",
    '{"theme_en":"...","theme_zh":"...","words":[{"en":"settle in","pos":"片語動詞","ipa":"/ˌset.əl ˈɪn/","zh":"安頓下來；適應新環境","note_zh":"一句話說明怎麼用、常跟什麼搭配","example_en":"It took me a month to settle in.","example_zh":"我花了一個月才適應。"}]}',
    "All Chinese in Traditional Chinese as used in Taiwan. pos in Chinese (名詞, 動詞, 形容詞, 副詞, 片語動詞, 片語). ipa: American English, with slashes."
  ].join("\n");
}
const GENRE_SPEC = {
  story:"Story or reflection: a tiny story or a reflective mini-essay about feelings, people, growth or everyday moments. Concrete details, a gentle turn at the end.",
  dialog:"Everyday dialogue: a short, natural conversation between two people (name them, one line each, like a script) in a real-life situation linked to the theme. Keep it warm and believable.",
  humor:"Light humor: a short funny piece about an everyday situation, with a gentle twist or punchline at the end. Kind humor, no sarcasm about groups of people.",
  diary:"Diary or letter: a first-person diary entry or a short letter to someone, honest and personal, about something that happened today.",
  tips:"Practical tips: a short, friendly how-to with 3 to 5 simple tips the reader can try today, linked to the theme. Only common-sense, widely accepted advice.",
  know:"Knowledge: explain one interesting, well-established idea or fact (psychology, health, science, language, history, or how something works) linked to the theme, with simple everyday examples. Only widely accepted facts; no invented numbers or studies."
};
function pickSaved(){
  const all = Object.values(S.bank).filter(x => x && x.en);
  for (let i = all.length - 1; i > 0; i--){ const j = Math.floor(Math.random() * (i + 1)); [all[i], all[j]] = [all[j], all[i]]; }
  return all.slice(0, 5).map(x => ({en:x.en, pos:x.pos || "", ipa:x.ipa || "", zh:x.zh || "", note_zh:x.note_zh || "", example_en:x.example_en || "", example_zh:x.example_zh || "", saved:true}));
}
function articlePrompt(w, d, k, genre, extra, topic){
  const plan = DAY_PLAN[d], L = LENGTHS[set().length] || LENGTHS.mid;
  const P = weekPats(w);
  const strong = plan.use.length === 1 ? "at least 4 times" : "at least 3 times";
  const lines = [];
  plan.use.forEach(u => {
    if (u === "R") (w.review || []).forEach((pid, i) => lines.push("R" + (i + 1) + ": " + PATTERNS[pid].en + " (" + PATTERNS[pid].zh + ") - review, use once or twice"));
    else lines.push(u + ": " + P[u].en + " (" + P[u].zh + ") - use " + (plan.focus === u ? strong : "once or twice"));
  });
  const words = plan.words.map(i => i + ": " + w.words[i].en + " (" + w.words[i].zh + ")").join("\n");
  const earlier = artsOf(w.n).filter(a => !(a.day === d && a.k === k)).map(a => a.title).filter(Boolean);
  const fp = P[plan.focus];
  return [
    'You write daily reading pieces for an adult in Taiwan who is learning English. Copy the style of the TikTok account "English Everyday": short, simple sentences; repetition and rhythm (for example: "They wait. They wait for a friend. They wait for the perfect moment."); talk to the reader as "you" when it fits; warm, honest, one clear idea. No cliches like "in today\'s fast-paced world".',
    "",
    "Learner level: " + levelText(),
    "Genre: " + (genre === "custom" ? "Written to the learner's own request: \"" + String(topic || "").slice(0, 80) + "\". Write that kind of piece (still linked to the week theme where it fits), and follow every rule below." : GENRE_SPEC[genre] || GENRE_SPEC.story),
    "Week theme: " + w.theme_en + " (" + w.theme_zh + ")",
    "Length: about " + L.words + " words (about " + L.min + " minutes to read aloud).",
    "",
    "Sentence patterns:",
    lines.join("\n"),
    "",
    'Target words (use each one at least twice; inflected forms are fine, e.g. "settle in" -> "settled in"):',
    words,
    (extra && extra.length ? "\nSaved words the learner is reviewing (use each one at least once, same markup with these numbers):\n" + extra.map((x, i) => (6 + i) + ": " + x.en + " (" + x.zh + ")").join("\n") : ""),
    "",
    "Markup rules (the app reads them):",
    "- Every use of a target word: {{the words as they appear|number}}  e.g. {{settled in|4}}",
    "- Every use of a pattern: wrap only its fixed words: ((I'm used to|A)) waking up early. Use the labels exactly as given above.",
    "- Use exactly {{ }} and (( )). Never use ** or [[ ]]. Never put markup inside markup. No other formatting: no #, no lists.",
    earlier.length ? "Earlier pieces this week (choose a different angle and story): " + earlier.join("; ") : "",
    "",
    "Output exactly this, nothing before or after:",
    "TITLE: <English title, at most 7 words>",
    "TITLE_ZH: <the title in Traditional Chinese (Taiwan)>",
    "BODY:",
    "<the piece; paragraphs of 1-4 sentences separated by one blank line>",
    "PRACTICE: <one short task in Traditional Chinese (Taiwan) asking the reader to write ONE English sentence about their own life using pattern " + plan.focus + ": " + fp.en + ">"
  ].join("\n");
}
function lookupPrompt(word, sentence){
  return [
    "An English learner in Taiwan tapped a word while reading.",
    'Word: "' + word + '"',
    'Sentence: "' + sentence + '"',
    "Reply with only JSON. All Chinese in Traditional Chinese (Taiwan).",
    '{"word":"<as tapped>","lemma":"<dictionary form; for a phrasal verb in the sentence, the whole phrase>","ipa":"<American IPA of the lemma, with slashes>","pos":"<名詞/動詞/形容詞/副詞/介系詞/片語動詞…>","zh":"<common meanings, short>","in_context_zh":"<what it means in THIS sentence, one short line>","example_en":"<a new, simple example sentence>","example_zh":"<its translation>","sentence_zh":"<natural translation of the whole sentence>"}'
  ].join("\n");
}
function practicePrompt(task, pat, answer){
  return [
    "You are a kind English tutor for an adult learner in Taiwan.",
    'The task was: "' + task + '" (pattern: ' + pat.en + ").",
    'The learner wrote: "' + answer + '"',
    "Check grammar, word choice and whether the pattern is used correctly. Be encouraging and brief. All Chinese in Traditional Chinese (Taiwan).",
    "Reply with only JSON:",
    '{"ok": true, "corrected": "<corrected sentence with the same meaning; identical if already correct>", "notes_zh": ["<short point>"], "natural": "<one more natural way a native speaker might say it>"}',
    "notes_zh: at most 3 items; empty if there is nothing to fix."
  ].join("\n");
}
function wordList(w, rev){ return w.words.map((x, i) => [i, x]).filter(([i]) => !rev || rev.words.includes(i)).map(([i, x]) => i + ": " + x.en).join(", "); }
function patList(w, rev){ const P = weekPats(w); return Object.keys(P).filter(k => !rev || rev.pats.includes(k)).map(k => k + ": " + P[k].en).join("; "); }
function dailyChatPrompt(w, d, rev){
  return [
    "You are Lisa, a warm, friendly native English speaker and the learner's friend. You chat with an adult in Taiwan (level " + levelText() + ") every day to practise English.",
    "This week's theme: " + w.theme_en + " (" + w.theme_zh + "). Today is day " + (d + 1) + " of the week.",
    "Patterns they have learned so far: " + patList(w, rev),
    "Words they have learned so far: " + wordList(w, rev),
    "Start today's casual chat: pick a small, personal everyday topic linked to the theme where these words and patterns come up naturally.",
    "Reply with only JSON. Chinese in Traditional Chinese (Taiwan).",
    '{"topic_zh":"<short topic, at most 12 characters>","opening":"<your first line in English: 1-2 short sentences ending with a question>"}'
  ].join("\n");
}
function scenarioPrompt(w){
  return [
    "Create a role-play for a weekly speaking practice. Learner: an adult in Taiwan, level " + levelText() + ".",
    "Week theme: " + w.theme_en + " (" + w.theme_zh + ")",
    "Patterns: " + patList(w),
    "Words: " + wordList(w),
    "Invent an everyday situation where the learner can naturally use these patterns and words. You will play the other person, whose name is Lisa.",
    "Reply with only JSON. Chinese in Traditional Chinese (Taiwan).",
    '{"title_zh":"<short title>","situation_zh":"<2 sentences: where we are and what is happening>","learner_role_zh":"<who the learner is>","partner_role_zh":"<who you play>","partner_name":"<a first name>","opening":"<your first line in English: 1-2 short sentences ending with a question>"}'
  ].join("\n");
}
function talkRules(w, sc, rev){
  return [
    "Role-play rules. You are " + sc.partner_name + " (" + sc.partner_role_zh + "). Situation: " + sc.situation_zh + " The learner is " + sc.learner_role_zh + ".",
    "The learner, an adult in Taiwan at level " + levelText() + ", is practising this week's English. Patterns: " + patList(w, rev) + ". Words: " + w.words.filter((_, i) => !rev || rev.words.includes(i)).map(x => x.en).join(", ") + ".",
    "- Stay in character. Reply in 1-3 short, simple sentences, then ask something that invites the learner to use the patterns or words.",
    "- Do not correct mistakes during the chat; feedback comes at the end. If you cannot understand, ask them to say it another way.",
    "- If the learner writes Chinese, answer in simple English and gently encourage English.",
    "- Plain text only, no stage directions."
  ].join("\n");
}
function feedbackPrompt(w, conv, rev){
  const tr = conv.turns.map(t => (t.role === "assistant" ? conv.scenario.partner_name : "Learner") + ": " + t.content).join("\n");
  return [
    "Review this English role-play by an adult learner in Taiwan (level " + levelText() + ").",
    "Patterns to practise: " + patList(w, rev),
    "Words to practise: " + wordList(w, rev),
    "Transcript:",
    tr,
    "",
    "Reply with only JSON. All Chinese in Traditional Chinese (Taiwan).",
    '{"score":4,"summary_zh":"<2-3 warm, specific sentences>","words_used":[0,2],"patterns_used":["A"],"patterns_weak":["B"],"corrections":[{"original":"<learner sentence>","better":"<improved>","why_zh":"<short reason>"}],"try_next_zh":"<one concrete suggestion>"}',
    "score 1-5. words_used: numbers of target words the learner used. patterns_weak: labels of patterns the learner did not use or used wrongly. corrections: at most 5, the most useful ones."
  ].join("\n");
}
