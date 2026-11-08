/* 每日英文練習 — offline cache.
   The app itself: network first (so updates arrive), cached copy when offline.
   Fonts, the Pocket TTS library, its runtime and voice models: cache first —
   downloaded once while online, then served from the phone. */
const SHELL = "eel-shell-v1";
const ASSETS = "eel-assets-v1";
const SHELL_FILES = ["./", "./index.html", "./pts-worker.js"];
const ASSET_HOSTS = /(^|\.)(jsdelivr\.net|huggingface\.co|hf\.co|googleapis\.com|gstatic\.com)$/;

self.addEventListener("install", e => {
  e.waitUntil(caches.open(SHELL).then(c => c.addAll(SHELL_FILES)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(
    keys.filter(k => k.startsWith("eel-") && k !== SHELL && k !== ASSETS).map(k => caches.delete(k))
  )).then(() => self.clients.claim()));
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  if (url.origin === self.location.origin){
    if (url.pathname.endsWith("/sw.js")) return;
    e.respondWith(
      fetch(req).then(res => {
        if (res.ok) { const copy = res.clone(); caches.open(SHELL).then(c => c.put(req, copy)); }
        return res;
      }).catch(() => caches.match(req, {ignoreSearch:true}).then(r => r || caches.match("./index.html")))
    );
    return;
  }

  if (ASSET_HOSTS.test(url.hostname) && !/generativelanguage/.test(url.hostname)){
    e.respondWith(
      caches.open(ASSETS).then(c => c.match(req).then(hit => hit || fetch(req).then(res => {
        if (res.ok || res.type === "opaque") c.put(req, res.clone()).catch(() => {});
        return res;
      })))
    );
  }
});
