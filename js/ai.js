/* =========================================================
   AI services. Default: the server's Gemini (no key needed, needs the login).
   Others: your own API key, called straight from this page.
   ========================================================= */
const GEMINI_MODELS = [{id:"gemini-3.5-flash-lite"}, {id:"gemini-3.6-flash"}, {id:"gemini-3.8-flash"}, {id:"gemini-4-argon", paid:true}];
const PROVIDERS = {
  server:{name:"伺服器（免金鑰）", kind:"gemini", base:"", fast:"gemini-3.5-flash-lite", keyUrl:"", server:true,
    defaults:{write:"gemini-3.5-flash-lite"}, models:GEMINI_MODELS.filter(m => !m.paid)},
  openai:{name:"OpenAI", kind:"openai-responses", base:"https://api.openai.com/v1", fast:"gpt-5.6-luna",
    keyUrl:"https://platform.openai.com/api-keys", defaults:{write:"gpt-5.6-terra"},
    models:[{id:"gpt-5.6-luna", paid:true}, {id:"gpt-5.6-terra", paid:true}, {id:"gpt-5.6-sol", paid:true}]},
  anthropic:{name:"Anthropic", kind:"anthropic", base:"https://api.anthropic.com/v1", fast:"claude-haiku-5-5",
    keyUrl:"https://console.anthropic.com/settings/keys", defaults:{write:"claude-sonnet-5-5"},
    models:[{id:"claude-haiku-5-5", paid:true}, {id:"claude-sonnet-5-5", paid:true}, {id:"claude-opus-5-5", paid:true}]},
  gemini:{name:"Google Gemini", kind:"gemini", base:"https://generativelanguage.googleapis.com/v1beta", fast:"gemini-3.5-flash-lite",
    keyUrl:"https://aistudio.google.com/apikey", defaults:{write:"gemini-3.5-flash-lite"},
    models:GEMINI_MODELS},
  custom:{name:"自訂 OpenAI 相容 API", kind:"openai", base:"", fast:"", keyUrl:"", defaults:{write:""}, models:[]}
};
const PROVIDER_ORDER = ["server","gemini","openai","anthropic","custom"];
const KEYS_ID = LS + "keys";
let KEYS = (() => { try { return JSON.parse(localStorage.getItem(KEYS_ID) || "{}") || {}; } catch (e) { return {}; } })();
function saveKeys(){ try { localStorage.setItem(KEYS_ID, JSON.stringify(KEYS)); Cloud.mark("keys"); } catch (e) { toast("這個瀏覽器不能儲存 API Key。"); } }
/* for the server, the "key" is this phone's login and the address is our API */
function provKey(p){ if (p === "server") return (Cloud.cfg && Cloud.cfg.token) || ""; return String((KEYS[p] || {}).key || "").trim(); }
function provBase(p){ if (p === "server") return Cloud.url() + "/ai"; return (String((KEYS[p] || {}).base || "").trim() || PROVIDERS[p].base).replace(/\/+$/, ""); }
function provReady(p){ if (p === "server") return Cloud.on(); return !!PROVIDERS[p] && !!provBase(p) && (!!provKey(p) || p === "custom"); }
const MODEL_LISTS = (() => { try { return JSON.parse(localStorage.getItem(LS + "models") || "{}") || {}; } catch (e) { return {}; } })();

/* the town's resident requests (發放) need a careful JSON writer: Flash Lite often breaks the format there */
const TASK_MODELS = {city:"gemini-3.6-flash"};
function taskCfg(task){
  const a = aiState(), p = PROVIDERS[a.provider] ? a.provider : "gemini", P = PROVIDERS[p];
  let model = a.model || P.defaults.write || "";
  /* some jobs need a stronger model than the everyday one */
  if (P.kind === "gemini" && TASK_MODELS[task]) model = TASK_MODELS[task];
  /* daily articles: Flash Lite tends to loop and repeat itself, so use Flash unless a stronger model was picked */
  if (P.kind === "gemini" && task === "article" && /lite/i.test(model)) model = "gemini-3.6-flash";
  return {provider:p, model};
}
function toTurns(input){
  const arr = typeof input === "string" ? [{role:"user", content:input}] : input;
  const out = [];
  arr.forEach(t => {
    const role = t.role === "assistant" ? "assistant" : "user";
    if (out.length && out[out.length - 1].role === role) out[out.length - 1].content += "\n\n" + t.content;
    else out.push({role, content:String(t.content)});
  });
  if (out.length && out[0].role !== "user") out.unshift({role:"user", content:"(start)"});
  return out;
}
async function readSSE(res, onData){
  const reader = res.body.getReader(), dec = new TextDecoder();
  let buf = "";
  for (;;){
    const r = await reader.read();
    if (r.done) break;
    buf += dec.decode(r.value, {stream:true});
    let i;
    while ((i = buf.indexOf("\n")) >= 0){
      const line = buf.slice(0, i).replace(/\r$/, ""); buf = buf.slice(i + 1);
      if (!line.startsWith("data:")) continue;
      const data = line.slice(5).trim();
      if (!data || data === "[DONE]") continue;
      let obj; try { obj = JSON.parse(data); } catch (e) { continue; }
      onData(obj);
    }
  }
}
async function httpErr(res){
  let msg = "";
  try {
    const j = await res.json();
    const e = Array.isArray(j) ? j[0] && j[0].error : j.error;
    msg = (e && (e.message || e)) || j.message || "";
    if (typeof msg !== "string") msg = JSON.stringify(msg);
  } catch (e) {}
  return {code:"http", status:res.status, message:msg};
}
const GEMINI_FREE = ["gemini-3.8-flash","gemini-3.6-flash","gemini-3.5-flash-lite"];
function busyErr(e){
  return !!e && e.code === "http" && ([429, 500, 502, 503, 504, 529].includes(e.status) || /overload|high demand|unavailable|exhausted/i.test(e.message || ""));
}
function modelName(p, id){ return id; }
/* Other Gemini models to try when the chosen one is busy: the free Flash models this key can
   really use (from the model list, fetched once if missing), newest first, Pro models left out. */
async function geminiBackups(p, first){
  if (!MODEL_LISTS[p] || !MODEL_LISTS[p].length){ try { await fetchModels(p); } catch (e) {} }
  const have = MODEL_LISTS[p] || [];
  const ok = id => /flash/i.test(id) && !/(pro|thinking|exp|tts|image|live|audio)/i.test(id);
  const ver = id => { const m = id.match(/(\d+(?:\.\d+)?)/); return m ? parseFloat(m[1]) : 0; };
  let list = have.length ? GEMINI_FREE.filter(m => have.includes(m)).concat(have.filter(ok).sort((a, b) => ver(b) - ver(a) || (/lite/.test(a) ? 1 : 0) - (/lite/.test(b) ? 1 : 0)))
    : GEMINI_FREE.slice();
  list = [...new Set(list)].filter(m => m !== first);
  return list.slice(0, 4);
}
/* Ask the chosen model. When it is busy, wait 1.5 seconds and try once more;
   on Gemini, then move on to the other free models one by one, saying which one is used. */
async function callAI(task, input, opts){
  opts = opts || {};
  const cfg = taskCfg(task), p = cfg.provider;
  if (!provKey(p) && p !== "custom") throw {code:"no_key", provider:p};
  if (!provBase(p)) throw {code:"no_base", provider:p};
  const first = String(cfg.model || "").trim();
  if (!first) throw {code:"no_model", provider:p};
  let chain = [first], firstErr = null, lastBusy = true;
  for (let i = 0; i < chain.length; i++){
    const tries = i === 0 ? 2 : 1;
    for (let t = 0; t < tries; t++){
      let streamed = false;
      const o2 = Object.assign({}, opts, {onText: x => { streamed = true; if (opts.onText) opts.onText(x); }});
      try {
        const r = await callModel(p, chain[i], input, o2);
        if (i > 0) toast(modelName(p, first) + " 太忙了，這次改用 " + modelName(p, chain[i]));
        return r;
      } catch (e) {
        if (streamed || (opts.signal && opts.signal.aborted)) throw e;
        if (i === 0 && !busyErr(e)) throw e;
        if (!firstErr) firstErr = e;
        lastBusy = busyErr(e);
        /* a backup model that is missing or not allowed for this key: just try the next one */
        if (i > 0 && !busyErr(e)) break;
        if (t + 1 < tries){ toast(modelName(p, chain[i]) + " 忙碌中，1.5 秒後重試…"); await sleep(1500); }
      }
    }
    if (PROVIDERS[p].kind !== "gemini") break;
    if (i === 0) chain = chain.concat(await geminiBackups(p, first));
    if (i + 1 < chain.length) toast(modelName(p, chain[i]) + (lastBusy ? " 還是很忙" : " 這把金鑰不能用") + "，改用 " + modelName(p, chain[i + 1]) + "…");
  }
  throw firstErr;
}
async function callModel(p, model, input, opts){
  const P = PROVIDERS[p];
  const turns = toTurns(input), key = provKey(p), base = provBase(p);
  let text = "";
  const push = t => { if (!t) return; text += t; if (opts.onText) opts.onText({text, delta:t}); };
  try {
    let res;
    if (P.kind === "gemini"){
      const body = {contents:turns.map(t => ({role:t.role === "assistant" ? "model" : "user", parts:[{text:t.content}]}))};
      if (opts.json) body.generationConfig = {responseMimeType:"application/json"};
      res = await fetch(base + "/models/" + encodeURIComponent(model) + ":streamGenerateContent?alt=sse&key=" + encodeURIComponent(key),
        {method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(body), signal:opts.signal});
      if (!res.ok) throw await httpErr(res);
      await readSSE(res, o => {
        if (o.error) throw {code:"http", status:o.error.code || 500, message:o.error.message};
        const c = (o.candidates || [])[0] || {};
        ((c.content || {}).parts || []).forEach(pt => { if (pt.text && !pt.thought) push(pt.text); });
        if (!text && /SAFETY|PROHIBITED|BLOCKLIST/.test(c.finishReason || "")) throw {code:"refused"};
      });
    } else if (P.kind === "anthropic"){
      res = await fetch(base + "/messages", {method:"POST", signal:opts.signal,
        headers:{"Content-Type":"application/json", "x-api-key":key, "anthropic-version":"2023-06-01", "anthropic-dangerous-direct-browser-access":"true"},
        body:JSON.stringify({model, max_tokens:4096, stream:true, messages:turns})});
      if (!res.ok) throw await httpErr(res);
      await readSSE(res, o => {
        if (o.type === "error") throw {code:"http", status:529, message:(o.error || {}).message};
        if (o.type === "content_block_delta" && o.delta && o.delta.type === "text_delta") push(o.delta.text);
      });
    } else if (P.kind === "openai-responses"){
      res = await fetch(base + "/responses", {method:"POST", signal:opts.signal,
        headers:{"Content-Type":"application/json", Authorization:"Bearer " + key},
        body:JSON.stringify({model, stream:true, input:turns.map(t => ({role:t.role, content:t.content}))})});
      if (!res.ok) throw await httpErr(res);
      await readSSE(res, o => {
        if (o.type === "error" || o.type === "response.failed") throw {code:"http", status:500, message:(o.error || (o.response || {}).error || {}).message || o.message};
        if (o.type === "response.output_text.delta" && typeof o.delta === "string") push(o.delta);
      });
    } else {
      const headers = {"Content-Type":"application/json"};
      if (key) headers.Authorization = "Bearer " + key;
      res = await fetch(base + "/chat/completions", {method:"POST", headers, signal:opts.signal, body:JSON.stringify({model, stream:true, messages:turns})});
      if (!res.ok) throw await httpErr(res);
      await readSSE(res, o => {
        if (o.error) throw {code:"http", status:o.error.code || 500, message:o.error.message};
        const d = ((o.choices || [])[0] || {}).delta || {};
        if (typeof d.content === "string") push(d.content);
      });
    }
  } catch (e) {
    if (e && e.name === "AbortError") throw {code:"cancelled", text};
    if (e && e.code) throw e;
    throw {code:"network", provider:p};
  }
  if (!text.trim()) throw {code:"empty"};
  return {text, truncated:false};
}
function parseLoose(t){
  try { return JSON.parse(t); } catch (e) {}
  const f = t.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (f){ try { return JSON.parse(f[1]); } catch (e) {} }
  const starts = ["{","["].map(c => t.indexOf(c)).filter(i => i >= 0);
  const a = starts.length ? Math.min.apply(null, starts) : -1, b = Math.max(t.lastIndexOf("}"), t.lastIndexOf("]"));
  if (a >= 0 && b > a){ try { return JSON.parse(t.slice(a, b + 1)); } catch (e) {} }
  throw {code:"invalid_json"};
}
function ai(task, input, extra){ return callAI(task, input, extra); }
function aiJson(task, input, extra){ return callAI(task, input, Object.assign({}, extra || {}, {json:true})).then(r => parseLoose(r.text)); }
async function fetchModels(p){
  const P = PROVIDERS[p], key = provKey(p), base = provBase(p);
  if (!base) throw {code:"no_base", provider:p};
  if (!key && p !== "custom") throw {code:"no_key", provider:p};
  let ids = [];
  try {
    let res;
    if (P.kind === "gemini"){
      res = await fetch(base + "/models?pageSize=1000&key=" + encodeURIComponent(key));
      if (!res.ok) throw await httpErr(res);
      ids = ((await res.json()).models || [])
        .filter(m => (m.supportedGenerationMethods || []).includes("generateContent"))
        .map(m => String(m.name).replace(/^models\//, ""))
        .filter(id => /gemini|gemma/i.test(id) && !/(tts|image|audio|live|embedding|robotics|veo|lyria|computer|translate)/i.test(id));
    } else if (P.kind === "anthropic"){
      res = await fetch(base + "/models?limit=100", {headers:{"x-api-key":key, "anthropic-version":"2023-06-01", "anthropic-dangerous-direct-browser-access":"true"}});
      if (!res.ok) throw await httpErr(res);
      ids = ((await res.json()).data || []).map(m => m.id);
    } else {
      const headers = {};
      if (key) headers.Authorization = "Bearer " + key;
      res = await fetch(base + "/models", {headers});
      if (!res.ok) throw await httpErr(res);
      ids = ((await res.json()).data || []).map(m => m.id).filter(Boolean);
      if (p === "openai") ids = ids.filter(id => /^(gpt|o\d|chatgpt)/i.test(id) && !/(audio|realtime|tts|transcribe|image|search|embedding|moderation|dall|whisper)/i.test(id));
    }
  } catch (e) { if (e && e.code) throw e; throw {code:"network", provider:p}; }
  ids = [...new Set(ids.map(String))].sort();
  MODEL_LISTS[p] = ids;
  try { localStorage.setItem(LS + "models", JSON.stringify(MODEL_LISTS)); } catch (e) {}
  return ids;
}
function aiErr(e){
  const c = e && e.code, pn = e && e.provider && PROVIDERS[e.provider] ? PROVIDERS[e.provider].name : "";
  if (c === "no_key") return "還沒設定「" + pn + "」的 API Key。到「設定 → AI 服務」貼上金鑰。";
  if (c === "no_base") return "「" + pn + "」還沒填 API 網址。到「設定 → AI 服務」填寫。";
  if (c === "no_model") return "還沒選模型。到「設定 → 每項工作用哪個模型」填一個模型名稱。";
  if (c === "network" && previewMode()) return "這個預覽畫面不能連網路，所以 AI 連不上。請把檔案放到網址上（例如 GitHub Pages），再用 Chrome 打開。";
  if (c === "network") return "連不上" + (pn ? "「" + pn + "」" : "AI 服務") + "。請確認網路；如果是「其他」服務，可能它不允許從瀏覽器直接連線。";
  if (c === "http"){
    const s = e.status, m = e.message ? "（" + String(e.message).slice(0, 140) + "）" : "";
    if (s === 401 || s === 403) return "API Key 不正確或沒有權限。" + m;
    if (s === 404) return "找不到這個模型，到設定換一個模型名稱。" + m;
    if (s === 429) return "太頻繁或免費額度用完了，等一分鐘再試。Gemini 免費版每分鐘的次數有限，也可以到「設定」換一個模型。" + m;
    if (s === 400) return "服務拒絕了這次請求，可能是模型名稱不對。" + m;
    if (s >= 500) return "模型現在太忙了（已經自動重試過）。稍後再按一次，或到「設定」換一個模型。" + m;
    return "發生錯誤（" + s + "）。" + m;
  }
  if (c === "refused") return "這次內容產生不出來，換個主題或再試一次。";
  if (c === "cancelled") return "已停止。";
  if (c === "invalid_json") return "AI 回覆的格式不對。再試一次，或到設定換一個比較強的模型。";
  if (c === "empty") return "AI 沒有回覆內容，再試一次。";
  return "產生失敗，請再試一次。";
}
function aiMissing(){
  const need = [...new Set(TASKS.map(t => taskCfg(t.key).provider))];
  /* the server's AI only needs the login, which the login screen already asks for */
  return need.filter(p => p !== "server" && !provReady(p));
}
