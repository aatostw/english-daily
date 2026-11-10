/*
 * 每日英文練習｜雲端帳號與同步（Cloudflare Worker + D1）
 *
 * 需要的設定（Cloudflare 後台 → 這個 Worker → Settings）：
 *   - Bindings：D1 database，變數名稱 DB
 *   - Variables and Secrets：Secret 名稱 ADMIN_KEY（帳號管理用的密碼，自己訂）
 *
 * 沒有公開註冊：帳號由管理者在 App 的「帳號管理」建立。
 * 資料表第一次被呼叫時會自動建立。
 */

const ORIGINS = ["https://english.natursai.com", "https://aatostw.github.io"];
const SESSION_DAYS = 180;
const PBKDF2_ITER = 100000;
const MAX_ITEM = 1900000;          // D1 一格最多約 2 MB
const MAX_BATCH = 200;

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT UNIQUE NOT NULL, name TEXT NOT NULL DEFAULT '',
     pw_hash TEXT NOT NULL, pw_salt TEXT NOT NULL, created_at INTEGER NOT NULL, fails INTEGER NOT NULL DEFAULT 0, locked_until INTEGER NOT NULL DEFAULT 0)`,
  `CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, user_id INTEGER NOT NULL, created_at INTEGER NOT NULL, last_seen INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS items (user_id INTEGER NOT NULL, id TEXT NOT NULL, json TEXT, at INTEGER NOT NULL, del INTEGER NOT NULL DEFAULT 0,
     PRIMARY KEY (user_id, id))`,
  `CREATE INDEX IF NOT EXISTS items_at ON items (user_id, at)`,
  `CREATE TABLE IF NOT EXISTS config (k TEXT PRIMARY KEY, v TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS ai_usage (user_id INTEGER NOT NULL, day TEXT NOT NULL, n INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (user_id, day))`,
  `CREATE TABLE IF NOT EXISTS news (date TEXT PRIMARY KEY, status TEXT NOT NULL, json TEXT, err TEXT, created_at INTEGER NOT NULL)`
];
const VOICE_URL = "https://voice.natursai.com";
let ready = false;
async function ensure(db){
  if (ready) return;
  await db.batch(SCHEMA.map(s => db.prepare(s)));
  /* added later: when someone pressed "forgot password" (0 = no request) */
  try { await db.prepare("ALTER TABLE users ADD COLUMN reset_req INTEGER NOT NULL DEFAULT 0").run(); } catch (e) {}
  /* added later: may this person use the computer voice (GPT-SoVITS + Whisper)? */
  try { await db.prepare("ALTER TABLE users ADD COLUMN voice INTEGER NOT NULL DEFAULT 0").run(); } catch (e) {}
  ready = true;
}

/* ---------- helpers ---------- */
const enc = new TextEncoder();
const hex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
const randHex = n => hex(crypto.getRandomValues(new Uint8Array(n)));
async function hashPw(pw, saltHex){
  const key = await crypto.subtle.importKey("raw", enc.encode(pw), "PBKDF2", false, ["deriveBits"]);
  const salt = new Uint8Array(saltHex.match(/../g).map(h => parseInt(h, 16)));
  return hex(await crypto.subtle.deriveBits({name:"PBKDF2", hash:"SHA-256", salt, iterations:PBKDF2_ITER}, key, 256));
}
function same(a, b){                 /* constant-time compare */
  a = String(a); b = String(b);
  let d = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) d |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return d === 0;
}
const cleanEmail = e => String(e || "").trim().toLowerCase();
const okEmail = e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) && e.length <= 200;

function cors(req){
  const o = req.headers.get("Origin") || "";
  const allow = ORIGINS.includes(o) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(o) || o === "null" ? o : ORIGINS[0];
  return {"Access-Control-Allow-Origin":allow, "Access-Control-Allow-Methods":"GET, POST, OPTIONS",
          "Access-Control-Allow-Headers":"Content-Type, Authorization, X-Admin-Key, X-Admin-User", "Access-Control-Max-Age":"86400", "Vary":"Origin"};
}
function json(req, status, obj){
  return new Response(JSON.stringify(obj), {status, headers:Object.assign({"Content-Type":"application/json; charset=utf-8", "Cache-Control":"no-store"}, cors(req))});
}
async function body(req){ try { return await req.json(); } catch (e) { return {}; } }

async function auth(req, env, fromQuery){
  let m = (req.headers.get("Authorization") || "").match(/^Bearer ([a-f0-9]{64})$/);
  if (!m && fromQuery) m = (new URL(req.url).searchParams.get("k") || "").match(/^([a-f0-9]{64})$/);
  if (!m) return null;
  const now = Date.now();
  const row = await env.DB.prepare("SELECT s.user_id, s.last_seen, u.email, u.name, u.voice FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ?").bind(m[1]).first();
  if (!row) return null;
  if (now - row.last_seen > SESSION_DAYS * 86400000){ await env.DB.prepare("DELETE FROM sessions WHERE token = ?").bind(m[1]).run(); return null; }
  if (now - row.last_seen > 3600000) await env.DB.prepare("UPDATE sessions SET last_seen = ? WHERE token = ?").bind(now, m[1]).run();
  return {id:row.user_id, email:row.email, name:row.name, voice:!!row.voice, token:m[1]};
}
/* the admin = ADMIN_USER (an account name, set in Cloudflare) + ADMIN_KEY (its password, a secret) */
function admin(req, env){
  const k = req.headers.get("X-Admin-Key") || "";
  const u = (req.headers.get("X-Admin-User") || "").trim().toLowerCase();
  const userOk = !env.ADMIN_USER || same(u, String(env.ADMIN_USER).trim().toLowerCase());
  return !!env.ADMIN_KEY && k.length > 0 && same(k, env.ADMIN_KEY) && userOk;
}

/* ---------- routes ---------- */
async function login(req, env){
  const b = await body(req), email = cleanEmail(b.email), pw = String(b.password || "");
  if (!email || !pw) return json(req, 400, {ok:false, error:"請輸入 Email 和密碼"});
  const u = await env.DB.prepare("SELECT * FROM users WHERE email = ?").bind(email).first();
  const now = Date.now();
  if (u && u.locked_until > now) return json(req, 429, {ok:false, error:"密碼錯太多次，請 10 分鐘後再試"});
  /* the same work whether or not the account exists, so timing doesn't reveal it */
  const h = await hashPw(pw, u ? u.pw_salt : "00".repeat(16));
  if (!u || !same(h, u.pw_hash)){
    if (u){
      const fails = u.fails + 1;
      await env.DB.prepare("UPDATE users SET fails = ?, locked_until = ? WHERE id = ?").bind(fails >= 10 ? 0 : fails, fails >= 10 ? now + 600000 : 0, u.id).run();
    }
    return json(req, 401, {ok:false, error:"Email 或密碼不對"});
  }
  const token = randHex(32);
  await env.DB.batch([
    env.DB.prepare("UPDATE users SET fails = 0, locked_until = 0 WHERE id = ?").bind(u.id),
    env.DB.prepare("INSERT INTO sessions (token, user_id, created_at, last_seen) VALUES (?, ?, ?, ?)").bind(token, u.id, now, now)
  ]);
  return json(req, 200, {ok:true, token, user:{email:u.email, name:u.name, voice:!!u.voice}});
}

/* "Forgot password": there's no email sending, so this asks the admin, who sets a new password.
   The answer is the same whether or not the account exists. */
async function forgot(req, env){
  const email = cleanEmail((await body(req)).email);
  if (!okEmail(email)) return json(req, 400, {ok:false, error:"Email 格式不對"});
  await env.DB.prepare("UPDATE users SET reset_req = ? WHERE email = ?").bind(Date.now(), email).run();
  return json(req, 200, {ok:true});
}

async function pull(req, env, me){
  const url = new URL(req.url), since = Number(url.searchParams.get("since")) || 0;
  const r = await env.DB.prepare("SELECT id, json, at, del FROM items WHERE user_id = ? AND at > ? ORDER BY at LIMIT 500").bind(me.id, since).all();
  const items = (r.results || []).map(x => ({id:x.id, at:x.at, del:!!x.del, data:x.del ? null : JSON.parse(x.json)}));
  return json(req, 200, {ok:true, items, more:items.length === 500, now:Date.now()});
}

async function push(req, env, me){
  const b = await body(req), list = Array.isArray(b.items) ? b.items.slice(0, MAX_BATCH) : [];
  const now = Date.now(), stmts = [];
  let skipped = 0;
  for (const it of list){
    const id = String(it.id || "").slice(0, 200);
    if (!id) continue;
    /* the server's clock orders every change, so a phone with a wrong clock can't hide its edits */
    const at = now;
    const txt = it.del ? null : JSON.stringify(it.data === undefined ? null : it.data);
    if (txt && txt.length > MAX_ITEM){ skipped++; continue; }
    stmts.push(env.DB.prepare(
      "INSERT INTO items (user_id, id, json, at, del) VALUES (?, ?, ?, ?, ?) " +
      "ON CONFLICT(user_id, id) DO UPDATE SET json = excluded.json, at = excluded.at, del = excluded.del"
    ).bind(me.id, id, txt, at, it.del ? 1 : 0));
  }
  if (stmts.length) await env.DB.batch(stmts);
  return json(req, 200, {ok:true, saved:stmts.length, skipped, now});
}

async function changePw(req, env, me){
  const b = await body(req), old = String(b.old || ""), nw = String(b.password || "");
  if (nw.length < 6) return json(req, 400, {ok:false, error:"新密碼至少 6 個字"});
  const u = await env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(me.id).first();
  if (!same(await hashPw(old, u.pw_salt), u.pw_hash)) return json(req, 401, {ok:false, error:"舊密碼不對"});
  const salt = randHex(16);
  await env.DB.batch([
    env.DB.prepare("UPDATE users SET pw_hash = ?, pw_salt = ? WHERE id = ?").bind(await hashPw(nw, salt), salt, me.id),
    env.DB.prepare("DELETE FROM sessions WHERE user_id = ? AND token != ?").bind(me.id, me.token)
  ]);
  return json(req, 200, {ok:true});
}

/* ---------- the computer voice, passed through for people the admin allowed ----------
   The phone never learns the computer's address or password: it shows its login instead (?k=). */
async function getConfig(env, k){ const r = await env.DB.prepare("SELECT v FROM config WHERE k = ?").bind(k).first(); return r ? r.v : ""; }
async function voice(req, env, path){
  const me = await auth(req, env, true);
  if (!me) return json(req, 401, {ok:false, error:"請重新登入", relogin:true});
  if (!me.voice) return json(req, 403, {ok:false, error:"管理員還沒幫你開通電腦語音", noVoice:true});
  /* the computer's password lives in Cloudflare (secret VOICE_KEY), so nobody types it in the app */
  const key = env.VOICE_KEY || await getConfig(env, "voiceKey");
  if (!key) return json(req, 503, {ok:false, error:"管理員還沒設定電腦語音的密碼", noKey:true});
  const base = (await getConfig(env, "voiceUrl")) || VOICE_URL;
  const inUrl = new URL(req.url), q = new URLSearchParams(inUrl.search);
  q.set("k", key);
  const sub = path.slice("/voice".length) || "/ping";
  if (!["/ping", "/tts", "/asr"].includes(sub)) return json(req, 404, {ok:false, error:"沒有這個功能"});
  let r;
  try {
    r = await fetch(base + sub + "?" + q.toString(), {method:req.method === "POST" ? "POST" : "GET",
      headers:req.method === "POST" ? {"Content-Type":req.headers.get("Content-Type") || "application/octet-stream"} : {},
      body:req.method === "POST" ? await req.arrayBuffer() : undefined});
  } catch (e) { return json(req, 502, {ok:false, error:"連不到電腦", offline:true}); }
  if (r.status >= 520) return json(req, 502, {ok:false, error:"連不到電腦", offline:true});
  const h = new Headers(cors(req));
  ["Content-Type", "Content-Length"].forEach(n => { const v = r.headers.get(n); if (v) h.set(n, v); });
  h.set("Cross-Origin-Resource-Policy", "cross-origin");
  h.set("Cache-Control", sub === "/tts" ? "private, max-age=86400" : "no-store");
  return new Response(r.body, {status:r.status, headers:h});
}


/* ======================================================================
   Daily news: one international tech story a day, the same for everyone,
   written by AI at six difficulty levels and stored, so it's made only once.
   Runs every morning (Cron); if that failed, the first reader starts it.
   Needs the secret GEMINI_KEY (optional variable NEWS_MODEL).
   ====================================================================== */
const NEWS_FEEDS = [
  {site:"BBC", url:"https://feeds.bbci.co.uk/news/technology/rss.xml"},
  {site:"Ars Technica", url:"https://feeds.arstechnica.com/arstechnica/technology-lab"},
  {site:"The Verge", url:"https://www.theverge.com/rss/tech/index.xml"},
  {site:"TechCrunch", url:"https://techcrunch.com/feed/"}
];
const NEWS_LEVELS = [
  {name:"菜鳥", words:120, level:"CEFR A1 (complete beginner): sentences of 5-8 words, only the ~500 most common words, present tense"},
  {name:"學員", words:160, level:"CEFR A2 (elementary): sentences of 8-12 words, the ~1,500 most common words, simple past and future"},
  {name:"新秀", words:220, level:"CEFR B1 (intermediate): sentences of 12-15 words, ~3,000 common words, everyday phrasal verbs"},
  {name:"高手", words:280, level:"CEFR B2 (upper intermediate): sentences of 15-20 words, ~5,000 words, phrasal verbs and conditionals"},
  {name:"專家", words:330, level:"CEFR C1 (advanced): varied sentence lengths, 8,000+ words, idioms and nuance"},
  {name:"巔峰", words:380, level:"CEFR C2 (proficient): natural news style, rich vocabulary"}
];
const taipeiDate = (t) => new Date((t || Date.now()) + 8 * 3600000).toISOString().slice(0, 10);

function decodeXml(t){
  return String(t || "").replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/<[^>]+>/g, " ")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&#(\d+);/g, (m, n) => String.fromCharCode(n)).replace(/&amp;/g, "&")
    .replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}
function tag(block, name){ const m = block.match(new RegExp("<" + name + "(?:\\s[^>]*)?>([\\s\\S]*?)</" + name + ">", "i")); return m ? m[1] : ""; }
async function readFeed(f){
  try {
    const r = await fetch(f.url, {headers:{"User-Agent":"everyday-english-news/1.0"}, cf:{cacheTtl:600}});
    if (!r.ok) return [];
    const x = await r.text(), out = [];
    const blocks = x.match(/<item[\s>][\s\S]*?<\/item>/gi) || x.match(/<entry[\s>][\s\S]*?<\/entry>/gi) || [];
    for (const b of blocks.slice(0, 25)){
      let link = decodeXml(tag(b, "link"));
      if (!link){ const m = b.match(/<link[^>]*href="([^"]+)"/i); link = m ? m[1] : ""; }
      const when = Date.parse(decodeXml(tag(b, "pubDate") || tag(b, "published") || tag(b, "updated"))) || 0;
      const title = decodeXml(tag(b, "title")), summary = decodeXml(tag(b, "description") || tag(b, "summary") || tag(b, "content")).slice(0, 600);
      if (title && link) out.push({site:f.site, title, summary, link, when});
    }
    return out;
  } catch (e) { return []; }
}
/* Busy (429/5xx): wait 1.5 s and try again, then the backup models in order. */
async function gemini(env, prompt, json){
  const models = [env.NEWS_MODEL || "gemini-3.5-flash-lite"].concat(String(env.NEWS_BACKUPS || "gemini-3.6-flash,gemini-3.8-flash").split(",").map(x => x.trim()).filter(Boolean));
  let lastErr;
  for (let i = 0; i < models.length; i++){
    for (let t = 0; t < (i ? 1 : 2); t++){
      const r = await fetch("https://generativelanguage.googleapis.com/v1beta/models/" + models[i] + ":generateContent", {
        method:"POST", headers:{"Content-Type":"application/json", "x-goog-api-key":String(env.GEMINI_KEY).trim()},
        body:JSON.stringify({contents:[{role:"user", parts:[{text:prompt}]}], generationConfig:Object.assign({temperature:0.7}, json ? {responseMimeType:"application/json"} : {})})
      });
      const j = await r.json().catch(() => ({}));
      if (r.ok){
        const txt = ((((j.candidates || [])[0] || {}).content || {}).parts || []).map(p => p.text || "").join("");
        if (!txt) throw new Error("Gemini 沒有回覆內容");
        return json ? JSON.parse(txt.replace(/^```(?:json)?\s*|\s*```$/g, "")) : txt;
      }
      lastErr = new Error("Gemini " + r.status + "（" + models[i] + "）: " + ((j.error && j.error.message) || "").slice(0, 160));
      const busy = r.status === 429 || r.status >= 500;
      if (!busy && i === 0) throw lastErr;
      if (!busy) break;
      if (t === 0 && i === 0) await new Promise(x => setTimeout(x, 1500));
    }
  }
  throw lastErr;
}
function levelPrompt(story, L){
  return [
    "You write a short daily news article for adult English learners in Taiwan, based on one real international technology news story.",
    "Story (" + story.site + "): " + story.title,
    "Summary: " + story.summary,
    "",
    "Rules:",
    "- Only state facts that are in the story above. Do not invent names, numbers, dates or quotes. You may explain general background (what a technology is, why it matters) in simple words.",
    "- Write it fresh in your own words; do not copy sentences from the summary.",
    "- Learner level: " + L.level,
    "- Length: about " + L.words + " words, in short paragraphs of 1-4 sentences separated by a blank line.",
    "- Choose 5 useful words or phrases from your article for the learner. Mark every use of them in the body as {{the words as they appear|n}} where n is 0-4, e.g. {{launched|2}}. No other markup: no **, no #, no lists.",
    "- All Chinese in Traditional Chinese (Taiwan).",
    "",
    'Reply with only JSON: {"title":"<English headline, at most 9 words>","title_zh":"<headline in Chinese>","summary_zh":"<one sentence in Chinese: what happened>","body":"<the article>","words":[{"en":"<word or phrase, dictionary form>","zh":"<short Chinese meaning>"}]}'
  ].join("\n");
}
async function makeNews(env, date){
  const lock = await env.DB.prepare("SELECT status, created_at FROM news WHERE date = ?").bind(date).first();
  if (lock && (lock.status === "ready" || (lock.status === "pending" && Date.now() - lock.created_at < 180000))) return;
  /* (an error row is retried: by the next reader after 10 minutes, or by the admin) */
  await env.DB.prepare("INSERT INTO news (date, status, created_at) VALUES (?, 'pending', ?) ON CONFLICT(date) DO UPDATE SET status = 'pending', err = NULL, created_at = excluded.created_at").bind(date, Date.now()).run();
  try {
    if (!env.GEMINI_KEY) throw new Error("伺服器還沒設定 GEMINI_KEY");
    const recent = await env.DB.prepare("SELECT json FROM news WHERE status = 'ready' ORDER BY date DESC LIMIT 14").all();
    const used = new Set((recent.results || []).map(r => { try { return JSON.parse(r.json).source.link; } catch (e) { return ""; } }));
    const lists = await Promise.all(NEWS_FEEDS.map(readFeed));
    const since = Date.now() - 3 * 86400000;
    let items = lists.flat().filter(x => !used.has(x.link) && (!x.when || x.when > since));
    if (!items.length) items = lists.flat().filter(x => !used.has(x.link));
    if (!items.length) throw new Error("今天抓不到科技新聞");
    items = items.sort((a, b) => b.when - a.when).slice(0, 24);
    const pick = await gemini(env, [
      "Pick the ONE story that is best for adult English learners in Taiwan: international, important or interesting to ordinary people, understandable without expert knowledge, not a deal/discount, not a product review, not a rumor, not violent.",
      "Reply with only JSON: {\"i\": <index>}",
      "",
      items.map((x, i) => i + ". [" + x.site + "] " + x.title + " — " + x.summary.slice(0, 200)).join("\n")
    ].join("\n"), true);
    const story = items[Math.max(0, Math.min(items.length - 1, Number(pick.i) || 0))];
    const tiers = await Promise.all(NEWS_LEVELS.map(async L => {
      for (let tries = 0; tries < 2; tries++){
        try {
          const a = await gemini(env, levelPrompt(story, L), true);
          if (a && a.title && a.body) return {title:String(a.title), title_zh:String(a.title_zh || ""), summary_zh:String(a.summary_zh || ""), body:String(a.body),
            words:(Array.isArray(a.words) ? a.words : []).slice(0, 5).map(w => ({en:String(w.en || ""), zh:String(w.zh || "")}))};
        } catch (e) { if (tries) throw e; }
      }
      throw new Error("文章格式不對");
    }));
    const data = {date, source:{site:story.site, title:story.title, link:story.link}, tiers};
    await env.DB.prepare("UPDATE news SET status = 'ready', json = ?, err = NULL WHERE date = ?").bind(JSON.stringify(data), date).run();
  } catch (e) {
    await env.DB.prepare("UPDATE news SET status = 'error', err = ? WHERE date = ?").bind(String(e && e.message || e).slice(0, 300), date).run();
  }
}
function newsFor(row, tier){
  const d = JSON.parse(row.json), t = Math.max(0, Math.min(5, Number(tier) || 0));
  return Object.assign({date:d.date, tier:t, level:NEWS_LEVELS[t].name, source:d.source}, d.tiers[t]);
}
async function newsRoute(req, env, ctx, path){
  const url = new URL(req.url), tier = url.searchParams.get("tier");
  if (path === "/news/list"){
    const r = await env.DB.prepare("SELECT date, json FROM news WHERE status = 'ready' ORDER BY date DESC LIMIT 30").all();
    return json(req, 200, {ok:true, items:(r.results || []).map(x => { const n = newsFor(x, tier); return {date:n.date, title:n.title, title_zh:n.title_zh, site:n.source.site}; })});
  }
  const today = taipeiDate(), date = /^\d{4}-\d{2}-\d{2}$/.test(url.searchParams.get("date") || "") ? url.searchParams.get("date") : today;
  const row = await env.DB.prepare("SELECT * FROM news WHERE date = ?").bind(date).first();
  if (row && row.status === "ready") return json(req, 200, {ok:true, news:newsFor(row, tier)});
  if (date !== today) return json(req, 404, {ok:false, error:"那天沒有新聞"});
  /* don't start again while it's being made, or for 10 minutes after it failed */
  const busy = row && ((row.status === "pending" && Date.now() - row.created_at < 180000) || (row.status === "error" && Date.now() - row.created_at < 600000));
  if (!busy) ctx.waitUntil(makeNews(env, date));
  return json(req, 202, {ok:false, pending:true, error:row && row.status === "error" ? row.err : "今天的新聞正在準備中"});
}


/* ======================================================================
   AI for everyone who is logged in, paid by the server's GEMINI_KEY.
   The paths copy Gemini's own (/ai/models, /ai/models/<model>:streamGenerateContent),
   so the app talks to it exactly like Gemini; ?key= carries the login instead of an API key.
   Each person may make AI_DAILY requests a day (default 300).
   ====================================================================== */
async function aiRoute(req, env, path){
  const u = new URL(req.url), tok = (u.searchParams.get("key") || "").match(/^[a-f0-9]{64}$/);
  const me = tok ? await auth(new Request(req.url, {headers:{Authorization:"Bearer " + tok[0]}}), env) : await auth(req, env);
  if (!me) return json(req, 401, {ok:false, error:{code:401, message:"請重新登入"}, relogin:true});
  if (!env.GEMINI_KEY) return json(req, 503, {ok:false, error:{code:503, message:"伺服器還沒設定 GEMINI_KEY"}});
  const base = "https://generativelanguage.googleapis.com/v1beta";
  const fwd = new URLSearchParams(u.search); fwd.delete("key");
  const hdr = {"x-goog-api-key":String(env.GEMINI_KEY).trim()};
  if (path === "/ai/models" && req.method === "GET"){
    const r = await fetch(base + "/models?" + fwd.toString(), {headers:hdr});
    return new Response(r.body, {status:r.status, headers:Object.assign({"Content-Type":"application/json"}, cors(req))});
  }
  const m = path.match(/^\/ai\/models\/([A-Za-z0-9._-]+):(streamGenerateContent|generateContent)$/);
  if (!m || req.method !== "POST") return json(req, 404, {ok:false, error:{code:404, message:"沒有這個功能"}});
  if (!/^(gemini|gemma)/i.test(m[1])) return json(req, 400, {ok:false, error:{code:400, message:"只能用 Gemini 模型"}});
  const day = taipeiDate(), limit = Number(env.AI_DAILY) || 300;
  const used = await env.DB.prepare("SELECT n FROM ai_usage WHERE user_id = ? AND day = ?").bind(me.id, day).first();
  if (used && used.n >= limit) return json(req, 429, {ok:false, error:{code:429, message:"今天的 AI 次數用完了（每天 " + limit + " 次），明天再來"}});
  await env.DB.prepare("INSERT INTO ai_usage (user_id, day, n) VALUES (?, ?, 1) ON CONFLICT(user_id, day) DO UPDATE SET n = n + 1").bind(me.id, day).run();
  const r = await fetch(base + "/models/" + m[1] + ":" + m[2] + "?" + fwd.toString(), {method:"POST", headers:Object.assign({"Content-Type":"application/json"}, hdr), body:await req.text()});
  return new Response(r.body, {status:r.status, headers:Object.assign({"Content-Type":r.headers.get("Content-Type") || "application/json", "Cache-Control":"no-store"}, cors(req))});
}

/* ---------- account management (X-Admin-Key) ---------- */
async function adminRoute(req, env, path){
  if (!env.ADMIN_KEY) return json(req, 503, {ok:false, error:"Worker 還沒設定 ADMIN_KEY"});
  if (!admin(req, env)){
    await new Promise(r => setTimeout(r, 400));   /* slows down guessing */
    return json(req, 401, {ok:false, error:"管理員帳號或密碼不對"});
  }
  if (path === "/admin/check") return json(req, 200, {ok:true});
  if (path === "/admin/news/regen"){
    const date = taipeiDate();
    await env.DB.prepare("DELETE FROM news WHERE date = ?").bind(date).run();
    await makeNews(env, date);
    const row = await env.DB.prepare("SELECT status, err FROM news WHERE date = ?").bind(date).first();
    return json(req, 200, {ok:row && row.status === "ready", status:row && row.status, error:row && row.err});
  }
  const b = req.method === "POST" ? await body(req) : {};
  if (path === "/admin/users" && req.method === "GET"){
    const r = await env.DB.prepare(
      "SELECT u.email, u.name, u.created_at, u.reset_req, u.voice, (SELECT COUNT(*) FROM items i WHERE i.user_id = u.id AND i.del = 0) AS items, " +
      "(SELECT MAX(last_seen) FROM sessions s WHERE s.user_id = u.id) AS last_seen, " +
      "(SELECT n FROM ai_usage a WHERE a.user_id = u.id AND a.day = ?) AS ai_today FROM users u ORDER BY u.created_at").bind(taipeiDate()).all();
    return json(req, 200, {ok:true, users:r.results || []});
  }
  if (path === "/admin/config"){
    if (req.method === "POST"){
      if (typeof b.voiceKey === "string" && b.voiceKey.trim()) await env.DB.prepare("INSERT INTO config (k, v) VALUES ('voiceKey', ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v").bind(b.voiceKey.trim()).run();
      if (typeof b.voiceUrl === "string") await env.DB.prepare("INSERT INTO config (k, v) VALUES ('voiceUrl', ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v").bind(b.voiceUrl.trim().replace(/\/+$/, "")).run();
    }
    return json(req, 200, {ok:true, voiceKeySet:!!(env.VOICE_KEY || await getConfig(env, "voiceKey")), voiceUrl:(await getConfig(env, "voiceUrl")) || VOICE_URL});
  }
  const email = cleanEmail(b.email);
  if (!okEmail(email)) return json(req, 400, {ok:false, error:"Email 格式不對"});
  if (path === "/admin/users" && req.method === "POST"){
    const pw = String(b.password || "");
    if (pw.length < 6) return json(req, 400, {ok:false, error:"密碼至少 6 個字"});
    const salt = randHex(16);
    try {
      await env.DB.prepare("INSERT INTO users (email, name, pw_hash, pw_salt, created_at, voice) VALUES (?, ?, ?, ?, ?, ?)")
        .bind(email, String(b.name || "").slice(0, 40), await hashPw(pw, salt), salt, Date.now(), b.voice ? 1 : 0).run();
    } catch (e) { return json(req, 409, {ok:false, error:"這個 Email 已經有帳號了"}); }
    return json(req, 200, {ok:true});
  }
  const u = await env.DB.prepare("SELECT id FROM users WHERE email = ?").bind(email).first();
  if (!u) return json(req, 404, {ok:false, error:"找不到這個帳號"});
  if (path === "/admin/users/reset"){
    const pw = String(b.password || "");
    if (pw.length < 6) return json(req, 400, {ok:false, error:"密碼至少 6 個字"});
    const salt = randHex(16);
    await env.DB.batch([
      env.DB.prepare("UPDATE users SET pw_hash = ?, pw_salt = ?, fails = 0, locked_until = 0, reset_req = 0 WHERE id = ?").bind(await hashPw(pw, salt), salt, u.id),
      env.DB.prepare("DELETE FROM sessions WHERE user_id = ?").bind(u.id)
    ]);
    return json(req, 200, {ok:true});
  }
  if (path === "/admin/users/detail"){
    /* one person's 關於我 and a short picture of their progress, read from their synced data */
    const user = await env.DB.prepare("SELECT email, name, created_at, voice, (SELECT MAX(last_seen) FROM sessions s WHERE s.user_id = users.id) AS last_seen FROM users WHERE id = ?").bind(u.id).first();
    const r = await env.DB.prepare("SELECT id, json FROM items WHERE user_id = ? AND del = 0 AND id IN ('profile', 'wallet', 'city', 'log')").bind(u.id).all();
    const d = {}; for (const x of r.results || []){ try { d[x.id] = JSON.parse(x.json); } catch (e) {} }
    const ai = await env.DB.prepare("SELECT day, n FROM ai_usage WHERE user_id = ? ORDER BY day DESC LIMIT 7").bind(u.id).all();
    const p = d.profile || {}, w = d.wallet || {}, c = d.city || {}, lg = d.log || {}, days = Object.keys(lg.days || {}).sort();
    const tiles = Object.values(c.tiles || {}), hall = tiles.find(t => t && t.b === "hall");
    return json(req, 200, {ok:true, user, about:p.about || null, tier:p.tier, currentWeek:p.currentWeek, createdAt:p.createdAt,
      coins:{balance:w.balance || 0, earned:w.earned || 0},
      city:{hallLv:(hall && hall.lv) || 1, knowledge:c.knowledge || 0, residents:(c.residents || []).length, buildings:tiles.filter(t => t && t.b && t.b !== "road" && t.b !== "hall").length},
      study:{days:days.length, last:days[days.length - 1] || ""}, ai:ai.results || []});
  }
  if (path === "/admin/users/voice"){
    await env.DB.prepare("UPDATE users SET voice = ? WHERE id = ?").bind(b.on ? 1 : 0, u.id).run();
    return json(req, 200, {ok:true});
  }
  if (path === "/admin/users/delete"){
    await env.DB.batch([
      env.DB.prepare("DELETE FROM items WHERE user_id = ?").bind(u.id),
      env.DB.prepare("DELETE FROM sessions WHERE user_id = ?").bind(u.id),
      env.DB.prepare("DELETE FROM users WHERE id = ?").bind(u.id)
    ]);
    return json(req, 200, {ok:true});
  }
  return json(req, 404, {ok:false, error:"沒有這個功能"});
}

export default {
  async scheduled(event, env, ctx){
    await ensure(env.DB);
    ctx.waitUntil(makeNews(env, taipeiDate(event.scheduledTime + 3600000)));
  },
  async fetch(req, env, ctx){
    if (req.method === "OPTIONS") return new Response(null, {status:204, headers:cors(req)});
    if (!env.DB) return json(req, 503, {ok:false, error:"Worker 還沒綁定 D1 資料庫（變數名稱 DB）"});
    try {
      await ensure(env.DB);
      const path = new URL(req.url).pathname.replace(/\/+$/, "") || "/";
      if (path === "/" || path === "/ping") return json(req, 200, {ok:true, app:"everyday-english-api", version:1, admin:!!env.ADMIN_KEY});
      if (path.startsWith("/admin/")) return adminRoute(req, env, path);
      if (path.startsWith("/ai/")) return aiRoute(req, env, path);
      if (path === "/voice" || path.startsWith("/voice/")) return voice(req, env, path);
      if (path === "/login" && req.method === "POST") return login(req, env);
      if (path === "/forgot" && req.method === "POST") return forgot(req, env);
      const me = await auth(req, env);
      if (!me) return json(req, 401, {ok:false, error:"請重新登入", relogin:true});
      if (path === "/me") return json(req, 200, {ok:true, user:{email:me.email, name:me.name, voice:me.voice}});
      if (path === "/logout" && req.method === "POST"){ await env.DB.prepare("DELETE FROM sessions WHERE token = ?").bind(me.token).run(); return json(req, 200, {ok:true}); }
      if (path === "/password" && req.method === "POST") return changePw(req, env, me);
      if (path === "/news" || path === "/news/list") return newsRoute(req, env, ctx, path);
      if (path === "/sync" && req.method === "GET") return pull(req, env, me);
      if (path === "/sync" && req.method === "POST") return push(req, env, me);
      return json(req, 404, {ok:false, error:"沒有這個功能"});
    } catch (e) {
      return json(req, 500, {ok:false, error:"伺服器錯誤：" + String(e && e.message || e).slice(0, 200)});
    }
  }
};
