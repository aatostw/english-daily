/* Same-origin wrapper for the Pocket TTS worker, so the offline cache (sw.js)
   can serve everything it loads. Usage: new Worker("pts-worker.js?src=<module url>") */
const __src = new URL(location.href).searchParams.get("src");
const __q = [], __h = e => __q.push(e.data);
self.addEventListener("message", __h);
import(__src).then(() => {
  self.removeEventListener("message", __h);
  for (const d of __q) self.dispatchEvent(new MessageEvent("message", {data:d}));
}, e => { setTimeout(() => { throw e; }); });
