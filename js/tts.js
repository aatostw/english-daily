/* =========================================================
   Speech (the phone's built-in voices)
   ========================================================= */
const DEFAULT_VOICE_URL = "voice-ref.wav";
/* Audio made on the phone is kept in a local database (IndexedDB, only on this phone),
   so a word or sentence is made once and then plays instantly, even offline.
   Up to AUDIO_LIMIT bytes; the least recently played clips are removed first. */
const AUDIO_LIMIT = 100 * 1024 * 1024;
const AudioDB = {
  p:null, ok:typeof indexedDB !== "undefined",
  open(){
    if (!this.ok) return Promise.reject(new Error("no indexedDB"));
    if (!this.p) this.p = new Promise((res, rej) => {
      const r = indexedDB.open("eel-audio", 1);
      r.onupgradeneeded = () => { const db = r.result; db.createObjectStore("clips", {keyPath:"k"}); db.createObjectStore("meta", {keyPath:"k"}).createIndex("at", "at"); };
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    }).catch(e => { this.p = null; throw e; });
    return this.p;
  },
  req(r){ return new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); },
  async get(k){
    try {
      const db = await this.open();
      const rec = await this.req(db.transaction("clips").objectStore("clips").get(k));
      if (!rec) return null;
      const tx = db.transaction("meta", "readwrite"); tx.objectStore("meta").put({k, bytes:rec.pcm.byteLength, at:Date.now()});
      const i16 = new Int16Array(rec.pcm), f = new Float32Array(i16.length);
      for (let i = 0; i < i16.length; i++) f[i] = i16[i] / 32767;
      return [f];
    } catch (e) { return null; }
  },
  async put(k, chunks){
    try {
      const n = chunks.reduce((a, c) => a + c.length, 0), i16 = new Int16Array(n);
      let o = 0;
      for (const c of chunks) for (let i = 0; i < c.length; i++, o++){ const v = Math.max(-1, Math.min(1, c[i])); i16[o] = v * 32767; }
      const db = await this.open();
      const tx = db.transaction(["clips", "meta"], "readwrite");
      tx.objectStore("clips").put({k, pcm:i16.buffer});
      tx.objectStore("meta").put({k, bytes:i16.byteLength, at:Date.now()});
      await new Promise((res, rej) => { tx.oncomplete = res; tx.onerror = () => rej(tx.error); });
      if (!this.asked && navigator.storage && navigator.storage.persist){ this.asked = true; navigator.storage.persist().catch(() => {}); }
      this.trim();
    } catch (e) {}
  },
  async usage(){
    try {
      const db = await this.open();
      const all = await this.req(db.transaction("meta").objectStore("meta").getAll());
      return {count:all.length, bytes:all.reduce((a, m) => a + (m.bytes || 0), 0)};
    } catch (e) { return {count:0, bytes:0}; }
  },
  async trim(){
    const u = await this.usage(); if (u.bytes <= AUDIO_LIMIT) return;
    const db = await this.open();
    const all = (await this.req(db.transaction("meta").objectStore("meta").getAll())).sort((a, b) => a.at - b.at);
    let total = u.bytes;
    const tx = db.transaction(["clips", "meta"], "readwrite");
    for (const m of all){ if (total <= AUDIO_LIMIT * 0.9) break; tx.objectStore("clips").delete(m.k); tx.objectStore("meta").delete(m.k); total -= m.bytes || 0; }
  },
  async clear(){
    const db = await this.open();
    const tx = db.transaction(["clips", "meta"], "readwrite");
    tx.objectStore("clips").clear(); tx.objectStore("meta").clear();
    await new Promise(res => { tx.oncomplete = res; tx.onerror = res; });
  }
};
/* Very common words: not prepared ahead (rarely tapped); made on the spot if you do tap one. */
const COMMON_WORDS = new Set(("a about above after again against all almost also always am an and another any are around as ask at away back be because been before being below best better between big both but by call came can can't could day did didn't do does doesn't doing don't done down each even ever every few find first for from get gets getting give go goes going gone good got great had has hasn't have haven't having he he's her here hers him his home how i i'd i'll i'm i've if in into is isn't it it's its just keep know last let let's like little long look lot made make many may maybe me might more most much must my myself need never new next no not now of off often oh ok okay old on once one only or other our out over own people put really right said same saw say says see she should so some something sometimes still such sure take tell than thank thanks that that's the their them then there there's these they they're thing things think this those though through time to today too took try two up us use used very want wanted wants was wasn't way we we're well went were what when where which while who why will with without won't would yes yet you you'd you'll you're your yours yourself").split(" "));
/* Split a paragraph into sentences the same way the reader does (a full stop, ! or ? then a space). */
function splitSentences(text){
  return String(text || "").replace(/\s+/g, " ").trim().split(/(?<=[.!?…]["”’)\]]*)\s+/).map(x => x.trim()).filter(Boolean);
}
const TTS = {
  ok: typeof window.speechSynthesis !== "undefined",
  voices: [], seq: 0,
  load(){ try { this.voices = speechSynthesis.getVoices().filter(v => /^en([-_]|$)/i.test(v.lang)); } catch (e) { this.voices = []; } },
  pick(){
    const want = set().voice;
    return this.voices.find(v => v.voiceURI === want) || this.voices.find(v => /en[-_]US/i.test(v.lang)) || this.voices[0] || null;
  },
  /* Your own voice: GPT-SoVITS on your computer, reached through the tunnel URL. */
  /* only for accounts the admin allowed; the address and password stay on the server */
  pcOn(){ return set().voiceSource === "pc" && Cloud.voiceOk(); },
  pcUrl(text){
    const q = new URLSearchParams({text, text_lang:"en", media_type:"wav", k:Cloud.cfg.token});
    return voiceBase() + "/tts?" + q.toString();
  },
  cache:new Map(), audio:null,
  pcAudio(text){
    let a = this.cache.get(text);
    if (!a){
      a = new Audio(); a.preload = "auto"; a.src = this.pcUrl(text);
      this.cache.set(text, a);
      if (this.cache.size > 150) this.cache.delete(this.cache.keys().next().value);
    }
    return a;
  },
  prefetch(text){ if (this.pcOn() && text) this.pcAudio(text); },
  /* Ask the computer for every paragraph, one at a time, so reading never waits. */
  batch:0, ready:0, total:0,
  prefetchAll(texts){
    if (!texts || !texts.length) return;
    if (!this.pcOn()) return;
    const id = ++this.batch; this.total = texts.length; this.ready = 0; this.showPrep();
    const next = i => {
      if (id !== this.batch || i >= texts.length) return;
      const a = this.pcAudio(texts[i]);
      let fired = false;
      const go = ok => { if (fired) return; fired = true; clearTimeout(t); if (id === this.batch){ if (ok) this.ready++; this.showPrep(); } next(i + 1); };
      const t = setTimeout(() => go(false), 90000);
      if (a.readyState >= 4) go(true);
      else { a.addEventListener("canplaythrough", () => go(true), {once:true}); a.addEventListener("error", () => go(false), {once:true}); try { a.load(); } catch (e) {} }
    };
    next(0);
  },
  showPrep(){
    const el = document.getElementById("rd-voice"); if (!el) return;
    el.hidden = false;
    el.textContent = this.ready >= this.total ? "語音準備好了" : "準備語音 " + this.ready + "/" + this.total;
  },
  speakPc(text, rate, onEnd){
    const seq = ++this.seq;
    if (this.audio){ try { this.audio.pause(); } catch (e) {} }
    try { speechSynthesis.cancel(); } catch (e) {}
    const a = this.pcAudio(text);
    this.audio = a;
    const done = () => { if (seq === this.seq && onEnd) onEnd(); };
    a.onended = done;
    a.onerror = () => {
      this.cache.delete(text);
      if (seq !== this.seq) return;
      toast("連不上電腦的語音，這次改用手機語音。");
      this.speakPocket(text, rate, onEnd);
    };
    try { a.currentTime = 0; } catch (e) {}
    a.playbackRate = (rate || set().rate || 0.9) / 0.9;
    const pr = a.play();
    if (pr && pr.catch) pr.catch(() => {});
    return true;
  },
  /* Plain single words: Pocket TTS, running on the phone itself (WASM, no server, no computer). */
  isWord(text){ return /^[A-Za-z]+([''’-][A-Za-z]+)*$/.test(String(text || "").trim()); },
  pocketOn(){ return set().voiceSource !== "system"; },   /* "system" = the device's own voice for everything */
  pocketLib:null, pocketInst:null, pocketPlayer:null, pocketLoading:null,
  pocketVoiceId:null, pocketVoiceKey:"",
  /* Browsers refuse to start a Worker straight from another site (the CDN).
     Wrap such workers in a same-origin blob that imports the real script. */
  pocketPatchWorker(){
    if (window.__eelWorkerPatched) return;
    window.__eelWorkerPatched = true;
    const Native = window.Worker;
    const Patched = function(url, opts){
      try {
        const u = new URL(String(url), location.href);
        if (/^https?:$/.test(u.protocol) && u.origin !== location.origin){
          if (opts && opts.type === "module" && /^https?:$/.test(location.protocol)){
            /* Hosted (e.g. GitHub Pages): use the same-origin wrapper file so the offline cache covers it. */
            const o = Object.assign({}, opts); delete o.type;
            return new Native("pts-worker.js?src=" + encodeURIComponent(u.href), o);
          }
          if (opts && opts.type === "module"){
            /* A classic blob worker that import()s the module works even when the page
               has no real origin (opened from a file manager: content:// or file://).
               Messages that arrive before the module is ready are held and replayed. */
            const src = "const __q=[],__h=e=>__q.push(e.data);self.addEventListener('message',__h);" +
              "import(" + JSON.stringify(u.href) + ").then(()=>{self.removeEventListener('message',__h);" +
              "for(const d of __q)self.dispatchEvent(new MessageEvent('message',{data:d}));}," +
              "e=>{setTimeout(()=>{throw e;});});";
            const o = Object.assign({}, opts); delete o.type;
            return new Native(URL.createObjectURL(new Blob([src], {type:"text/javascript"})), o);
          }
          return new Native(URL.createObjectURL(new Blob(["importScripts(" + JSON.stringify(u.href) + ");"], {type:"text/javascript"})), opts);
        }
      } catch (e) {}
      return new Native(url, opts);
    };
    Patched.prototype = Native.prototype;
    window.Worker = Patched;
  },
  pocketLoadLib(){
    if (!this.pocketLib){
      this.pocketPatchWorker();
      this.pocketLib = import("https://cdn.jsdelivr.net/npm/pocket-tts-js@0.1.0/src/index.js");
      this.pocketLib.catch(() => { this.pocketLib = null; });
    }
    return this.pocketLib;
  },
  pocketEngine(quiet){
    if (this.pocketInst) return Promise.resolve({tts:this.pocketInst, player:this.pocketPlayer});
    if (!this.pocketLoading){
      if (!quiet) toast("正在準備手機語音（第一次要下載模型，之後會存在手機裡）…");
      this.pocketLoading = (async () => {
        const {PocketTTS, StreamingPlayer} = await this.pocketLoadLib();
        const tts = new PocketTTS({language:"english_2026-04", quantized:true, voiceCloning:true});
        await tts.load();
        const player = new StreamingPlayer({sampleRate:tts.sampleRate});
        this.pocketInst = tts; this.pocketPlayer = player;
        return {tts, player};
      })();
      this.pocketLoading.catch(() => { this.pocketLoading = null; });
    }
    return this.pocketLoading;
  },
  async pocketDecodeRef(dataUrl){
    const resp = await fetch(dataUrl);
    if (!resp.ok) throw new Error("找不到聲音檔（" + resp.status + "）");
    const buf = await resp.arrayBuffer();
    const Ctx = window.AudioContext || window.webkitAudioContext;
    const ctx = new Ctx();
    const audioBuf = await new Promise((res, rej) => { try { const p = ctx.decodeAudioData(buf, res, rej); if (p && p.then) p.then(res, rej); } catch (e) { rej(e); } });
    let mono;
    if (audioBuf.numberOfChannels > 1){
      mono = new Float32Array(audioBuf.length);
      for (let ch = 0; ch < audioBuf.numberOfChannels; ch++){ const d = audioBuf.getChannelData(ch); for (let i = 0; i < d.length; i++) mono[i] += d[i] / audioBuf.numberOfChannels; }
    } else mono = audioBuf.getChannelData(0);
    const rate = audioBuf.sampleRate;
    try { ctx.close(); } catch (e) {}
    return {mono, rate};
  },
  async pocketVoice(tts){
    const v = set().pocketVoice || {};
    const key = (v.wavData || "") || "default";
    if (this.pocketVoiceId && this.pocketVoiceKey === key) return this.pocketVoiceId;
    let id;
    if ((v.wavData || "").trim()){
      const {mono, rate} = await this.pocketDecodeRef(v.wavData);
      id = await tts.cloneVoice(mono, {inputSampleRate:rate, name:v.wavName || "my-voice"});
    } else {
      /* Default voice: the reference clip that ships with the app (voice-ref.wav).
         If it can't be loaded, this throws and the caller falls back to the phone's own voice. */
      const {mono, rate} = await this.pocketDecodeRef(DEFAULT_VOICE_URL);
      id = await tts.cloneVoice(mono, {inputSampleRate:rate, name:"default-voice"});
    }
    this.pocketVoiceId = id; this.pocketVoiceKey = key;
    return id;
  },
  /* ---- Pre-made audio: prepare in the background, play instantly ----
     Only one generation can run in the voice engine at a time, so jobs go through a lock.
     Background jobs (pocketPrefetch) are stopped when you press play on something not ready yet. */
  pocketClips:new Map(), pfQueue:[], pfRunning:null, pocketLock:Promise.resolve(), pocketSpeaking:0,
  pocketTag(){ const w = (set().pocketVoice || {}).wavData || ""; return w ? w.length + ":" + w.slice(-24) : "default"; },
  pocketNorm(text){ const t = String(text || "").replace(/’/g, "'").replace(/\s+/g, " ").trim(); return this.isWord(t) ? t.toLowerCase() : t; },
  pocketKey(text){ return this.pocketTag() + "\u0001" + this.pocketNorm(text); },
  async pocketLoad(text){
    const key = this.pocketKey(text);
    let c = this.pocketClips.get(key);
    if (c) return c;
    c = await AudioDB.get(key);
    if (c) this.pocketRemember(key, c);
    return c;
  },
  pocketRemember(key, chunks){
    this.pocketClips.delete(key); this.pocketClips.set(key, chunks);
    while (this.pocketClips.size > 80) this.pocketClips.delete(this.pocketClips.keys().next().value);
  },
  pocketWithLock(fn){
    const run = this.pocketLock.then(fn, fn);
    this.pocketLock = run.catch(() => {});
    return run;
  },
  async pocketGenerate(text, onChunk, quiet){
    const {tts} = await this.pocketEngine(quiet);
    const voice = await this.pocketVoice(tts);
    const key = this.pocketKey(text), chunks = [];
    const m = await tts.generate(this.pocketNorm(text), {voice, onChunk:(a, meta) => { chunks.push(a); if (onChunk) onChunk(a, meta); }});
    if (m && m.rtfx > 0 && m.audioDuration > 1) this.pocketLearn(m.rtfx);
    if (!chunks.length || (m && m.stopped)) return null;
    this.pocketRemember(key, chunks);
    AudioDB.put(key, chunks);
    return chunks;
  },
  pocketPrefetch(texts, first){
    if (!this.pocketOn()) return;
    const list = [...new Set((texts || []).map(t => this.pocketNorm(t)).filter(t => t && !this.pcOn()))];
    const add = list.filter(t => !this.pocketClips.has(this.pocketKey(t)) && !(this.pfRunning && this.pfRunning.text === t));
    this.pfQueue = this.pfQueue.filter(t => !add.includes(t));
    this.pfQueue = first ? add.concat(this.pfQueue) : this.pfQueue.concat(add);
    if (first) this.pfResting = false;   /* something you just tapped: don't wait out the rest */
    this.pocketPump();
  },
  async pocketPump(){
    if (this.pfRunning || this.pocketSpeaking || this.pfResting || document.hidden) return;
    const text = this.pfQueue.shift(); if (!text) return;
    let made = 0;
    const promise = (async () => {
      const saved = await this.pocketLoad(text);
      if (saved) return saved;
      const t0 = Date.now();
      const got = await this.pocketWithLock(() => this.pocketGenerate(text, null, true));
      made = Date.now() - t0;
      return got;
    })();
    this.pfRunning = {text, promise};
    let got = null; try { got = await promise; } catch (e) {}
    this.pfRunning = null;
    if (got) this.batchDone(text);
    else if (this.pocketSpeaking || document.hidden) this.pfQueue.unshift(text);
    /* Single words are background work: rest as long as the work took, so on average
       only about half the CPU is used and the phone stays cool. Sentences go full speed. */
    if (made && this.isWord(text)){
      this.pfResting = true;
      setTimeout(() => { this.pfResting = false; this.pocketPump(); }, Math.min(3000, Math.max(150, made)));
      return;
    }
    this.pocketPump();
  },
  pfResting:false,
  /* Progress of preparing one article: sentences first, then its words. */
  batchInfo:null,
  batchStart(sents, words){
    const norm = a => [...new Set(a.map(t => this.pocketNorm(t)).filter(Boolean))];
    const S1 = norm(sents), W1 = norm(words).filter(t => !S1.includes(t));
    this.batchInfo = {sents:new Set(S1), words:new Set(W1), doneS:new Set(), doneW:new Set()};
    S1.forEach(t => { if (this.pocketClips.has(this.pocketKey(t))) this.batchInfo.doneS.add(t); });
    W1.forEach(t => { if (this.pocketClips.has(this.pocketKey(t))) this.batchInfo.doneW.add(t); });
    this.batchShow();
    this.pocketPrefetch(S1.concat(W1), true);
  },
  batchDone(text){
    const b = this.batchInfo; if (!b) return;
    const t = this.pocketNorm(text);
    if (b.sents.has(t)) b.doneS.add(t); else if (b.words.has(t)) b.doneW.add(t); else return;
    this.batchShow();
  },
  batchShow(){
    const b = this.batchInfo; if (!b) return;
    const total = b.sents.size + b.words.size, done = b.doneS.size + b.doneW.size;
    const chip = document.getElementById("rd-voice");
    if (chip){ chip.hidden = !total; chip.textContent = done >= total ? "語音準備好了" : "準備語音 " + done + "/" + total; }
    const ov = document.getElementById("prep-ov");
    if (ov){
      ov.querySelector(".bar > span").style.width = (total ? Math.round(done / total * 100) : 100) + "%";
      ov.querySelector(".prep-s").textContent = "句子 " + b.doneS.size + " / " + b.sents.size;
      ov.querySelector(".prep-w").textContent = "單字 " + b.doneW.size + " / " + b.words.size;
    }
  },
  pocketAfter(player, seq, onEnd){
    if (!onEnd) return;
    /* audio is scheduled ahead: wait until it has actually played */
    const ctx = player.audioContext, left = ctx ? Math.max(0, (player._nextStartTime || 0) - ctx.currentTime) : 0;
    setTimeout(() => { if (seq === this.seq) onEnd(); }, left * 1000 + 120);
  },
  async speakPocket(text, rate, onEnd){
    const seq = ++this.seq;
    this.pocketSpeaking++;
    try {
      try { speechSynthesis.cancel(); } catch (e) {}
      if (this.audio){ try { this.audio.pause(); } catch (e) {} }
      if (this.pocketPlayer){ try { this.pocketPlayer.reset(); } catch (e) {} }
      const {tts, player} = await this.pocketEngine();
      if (seq !== this.seq) return;
      try { await player.resume(); } catch (e) {}
      try { player.reset(); } catch (e) {}
      /* A paragraph is spoken sentence by sentence: each one comes from the saved clips if it was
         prepared, otherwise it is made now (playing while it's made). Gapless either way. */
      const parts = this.isWord(text) ? [text] : splitSentences(text);
      let first = true;
      for (const part of parts){
        if (seq !== this.seq) return;
        let chunks = await this.pocketLoad(part);
        if (!chunks && this.pfRunning && this.pfRunning.text === this.pocketNorm(part)) chunks = await this.pfRunning.promise.catch(() => null);
        if (seq !== this.seq) return;
        if (chunks){
          if (first) player._primeSeconds = 0;
          chunks.forEach(c => player.play(c, {}));
          player.flush();
        } else {
          if (this.pfRunning){ try { await tts.stop(); } catch (e) {} }
          await this.pocketWithLock(async () => {
            if (seq !== this.seq) return;
            if (first){
              const est = Math.max(0.5, String(part).length / 14), sp = this.pocketSpeed();
              player._primeSeconds = sp >= 1.5 ? 0.4 : Math.min(est + 1, 0.4 + est * Math.max(0.1, 1.15 - sp * 0.75));
            }
            const got = await this.pocketGenerate(part, (a, meta) => { if (seq === this.seq) player.play(a, {}); });
            if (seq !== this.seq) return;
            if (!got) throw new Error("沒有產生聲音");
            player.flush();
          });
          this.batchDone(part);
        }
        first = false;
      }
      if (seq !== this.seq) return;
      this.pocketAfter(player, seq, onEnd);
    } catch (e) {
      try { console.error("Pocket TTS", e); } catch (x) {}
      if (seq !== this.seq) return;
      const msg = String((e && (e.message || e.name)) || e || "").slice(0, 120);
      toast("手機本地語音失敗，這次改用手機內建語音。" + (msg ? "（" + msg + "）" : ""));
      this.speakBuiltin(text, rate, onEnd);
    } finally {
      this.pocketSpeaking--;
      this.pocketPump();
    }
  },
  pocketReset(){ this.pocketVoiceId = null; this.pocketVoiceKey = ""; this.pfQueue = []; },
  /* Warm up on app start so the first word doesn't wait: download (first time) and load the model,
     clone the voice and run one tiny silent generation. */
  async pocketWarm(){
    if (!this.pocketOn()) return;
    try {
      await this.pocketEngine(true);
      if (this.seq === this.warmSeq && !this.pfRunning) this.pocketPrefetch(["Hi."], false);
    } catch (e) {}
  },
  warmSeq:0,
  pocketSpeed(){ try { return Number(localStorage.getItem(LS + "pocketSpeed")) || 0.8; } catch (e) { return 0.8; } },
  pocketLearn(r){
    const v = Math.round((this.pocketSpeed() * 0.6 + Math.min(r, 4) * 0.4) * 100) / 100;
    try { localStorage.setItem(LS + "pocketSpeed", String(v)); } catch (e) {}
  },
  speak(text, rate, onEnd){
    /* GPT-SoVITS on: words and sentences both go to the computer. Otherwise the phone's Pocket TTS voice. */
    if (!this.pocketOn()) return this.speakBuiltin(text, rate, onEnd);
    if (this.pcOn()) return this.speakPc(text, rate, onEnd);
    this.speakPocket(text, rate, onEnd); return true;
  },
  speakBuiltin(text, rate, onEnd){
    if (!this.ok){ toast("這個瀏覽器不支援朗讀，可以點「Google 翻譯」聽發音。"); return false; }
    try {
      speechSynthesis.cancel();
      if (!this.voices.length) this.load();
      const u = new SpeechSynthesisUtterance(text);
      const v = this.pick();
      if (v){ u.voice = v; u.lang = v.lang; } else u.lang = "en-US";
      u.rate = rate || set().rate || 0.9;
      const seq = ++this.seq;
      u.onend = u.onerror = () => { if (seq === this.seq && onEnd) onEnd(); };
      speechSynthesis.speak(u);
      return true;
    } catch (e) { toast("朗讀失敗，可以點「Google 翻譯」聽發音。"); return false; }
  },
  stop(){ this.seq++; try { speechSynthesis.cancel(); } catch (e) {} if (this.audio){ try { this.audio.pause(); } catch (e) {} } if (this.pocketPlayer){ try { this.pocketPlayer.stop(); } catch (e) {} } }
};
if (TTS.ok){ TTS.load(); try { speechSynthesis.onvoiceschanged = () => { TTS.load(); if (S.view === "prefs" && S.profile) render(); }; } catch (e) {} }
