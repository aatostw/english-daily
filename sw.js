/* 每日英文練習 — offline cache.
   The app itself: network first (so updates arrive), cached copy when offline.
   Fonts, the Pocket TTS library, its runtime and voice models: cache first —
   downloaded once while online, then served from the phone. */
const SHELL = "eel-shell-v100";
const ASSETS = "eel-assets-v1";
const SHELL_FILES = [
  "./",
  "./index.html",
  "./css/app.css",
  "./js/clock.js",
  "./js/data.js",
  "./js/core.js",
  "./js/store.js",
  "./js/cloud.js",
  "./js/ai.js",
  "./js/tts.js",
  "./js/prompts.js",
  "./js/article.js",
  "./js/render.js",
  "./js/city.js",
  "./js/city3d.js",
  "./js/city3d-tiers.js",
  "./js/pages.js",
  "./js/settings.js",
  "./js/about.js",
  "./js/reader.js",
  "./js/course.js",
  "./js/news.js",
  "./js/rewards.js",
  "./js/apps.js",
  "./js/progress.js",
  "./js/actions.js",
  "./js/boot.js",
  "./pts-worker.js",
  "./voice-ref.wav",
  "./lisa.jpg",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon.svg",
  "./icons/apple-touch-icon.png"
];
const ASSET_HOSTS = /(^|\.)(jsdelivr\.net|huggingface\.co|hf\.co|googleapis\.com|gstatic\.com)$/;

self.addEventListener("install", e => {
  e.waitUntil(caches.open(SHELL).then(c => c.addAll(SHELL_FILES)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(
    keys.filter(k => k.startsWith("eel-") && k !== SHELL && k !== ASSETS).map(k => caches.delete(k))
  )).then(() => self.clients.claim()));
});

/* Cross-origin isolation lets the voice model use several CPU cores (SharedArrayBuffer).
   GitHub Pages can't send these headers, so the service worker adds them. */
function isolate(res){
  if (!res || res.type === "opaque" || res.status === 0) return res;
  const h = new Headers(res.headers);
  h.set("Cross-Origin-Opener-Policy", "same-origin");
  h.set("Cross-Origin-Embedder-Policy", "credentialless");
  return new Response(res.body, {status:res.status, statusText:res.statusText, headers:h});
}

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  if (url.origin === self.location.origin){
    if (url.pathname.endsWith("/sw.js")) return;
    e.respondWith(
      fetch(req.url, {cache:"no-cache", credentials:"same-origin"}).then(res => {
        if (res.ok) { const copy = res.clone(); caches.open(SHELL).then(c => c.put(req, copy)); }
        return isolate(res);
      }).catch(() => caches.match(req, {ignoreSearch:true}).then(r => r || caches.match("./index.html")).then(isolate))
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
