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
  `CREATE TABLE IF NOT EXISTS config (k TEXT PRIMARY KEY, v TEXT NOT NULL)`
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
  const key = await getConfig(env, "voiceKey");
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

/* ---------- account management (X-Admin-Key) ---------- */
async function adminRoute(req, env, path){
  if (!env.ADMIN_KEY) return json(req, 503, {ok:false, error:"Worker 還沒設定 ADMIN_KEY"});
  if (!admin(req, env)){
    await new Promise(r => setTimeout(r, 400));   /* slows down guessing */
    return json(req, 401, {ok:false, error:"管理員帳號或密碼不對"});
  }
  if (path === "/admin/check") return json(req, 200, {ok:true});
  const b = req.method === "POST" ? await body(req) : {};
  if (path === "/admin/users" && req.method === "GET"){
    const r = await env.DB.prepare(
      "SELECT u.email, u.name, u.created_at, u.reset_req, u.voice, (SELECT COUNT(*) FROM items i WHERE i.user_id = u.id AND i.del = 0) AS items, " +
      "(SELECT MAX(last_seen) FROM sessions s WHERE s.user_id = u.id) AS last_seen FROM users u ORDER BY u.created_at").all();
    return json(req, 200, {ok:true, users:r.results || []});
  }
  if (path === "/admin/config"){
    if (req.method === "POST"){
      if (typeof b.voiceKey === "string" && b.voiceKey.trim()) await env.DB.prepare("INSERT INTO config (k, v) VALUES ('voiceKey', ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v").bind(b.voiceKey.trim()).run();
      if (typeof b.voiceUrl === "string") await env.DB.prepare("INSERT INTO config (k, v) VALUES ('voiceUrl', ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v").bind(b.voiceUrl.trim().replace(/\/+$/, "")).run();
    }
    return json(req, 200, {ok:true, voiceKeySet:!!(await getConfig(env, "voiceKey")), voiceUrl:(await getConfig(env, "voiceUrl")) || VOICE_URL});
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
  async fetch(req, env){
    if (req.method === "OPTIONS") return new Response(null, {status:204, headers:cors(req)});
    if (!env.DB) return json(req, 503, {ok:false, error:"Worker 還沒綁定 D1 資料庫（變數名稱 DB）"});
    try {
      await ensure(env.DB);
      const path = new URL(req.url).pathname.replace(/\/+$/, "") || "/";
      if (path === "/" || path === "/ping") return json(req, 200, {ok:true, app:"everyday-english-api", version:1, admin:!!env.ADMIN_KEY});
      if (path.startsWith("/admin/")) return adminRoute(req, env, path);
      if (path === "/voice" || path.startsWith("/voice/")) return voice(req, env, path);
      if (path === "/login" && req.method === "POST") return login(req, env);
      if (path === "/forgot" && req.method === "POST") return forgot(req, env);
      const me = await auth(req, env);
      if (!me) return json(req, 401, {ok:false, error:"請重新登入", relogin:true});
      if (path === "/me") return json(req, 200, {ok:true, user:{email:me.email, name:me.name, voice:me.voice}});
      if (path === "/logout" && req.method === "POST"){ await env.DB.prepare("DELETE FROM sessions WHERE token = ?").bind(me.token).run(); return json(req, 200, {ok:true}); }
      if (path === "/password" && req.method === "POST") return changePw(req, env, me);
      if (path === "/sync" && req.method === "GET") return pull(req, env, me);
      if (path === "/sync" && req.method === "POST") return push(req, env, me);
      return json(req, 404, {ok:false, error:"沒有這個功能"});
    } catch (e) {
      return json(req, 500, {ok:false, error:"伺服器錯誤：" + String(e && e.message || e).slice(0, 200)});
    }
  }
};
