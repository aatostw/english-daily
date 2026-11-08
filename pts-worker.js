/* Same-origin wrapper for the Pocket TTS worker, so the offline cache (sw.js)
   can serve everything it loads. Usage: new Worker("pts-worker.js?src=<module url>") */

/* The multi-core runtime starts helper workers from the CDN. Browsers refuse a Worker
   straight from another site, so wrap those in a same-origin blob that imports the module. */
(() => {
  const Native = self.Worker;
  if (!Native) return;
  const Patched = function(url, opts){
    try {
      const u = new URL(String(url), self.location.href);
      if (/^https?:$/.test(u.protocol) && u.origin !== self.location.origin){
        const module = opts && opts.type === "module";
        const src = module
          ? "const __q=[],__h=e=>__q.push(e.data);self.addEventListener('message',__h);" +
            "import(" + JSON.stringify(u.href) + ").then(()=>{self.removeEventListener('message',__h);" +
            "for(const d of __q)self.dispatchEvent(new MessageEvent('message',{data:d}));}," +
            "e=>{setTimeout(()=>{throw e;});});"
          : "importScripts(" + JSON.stringify(u.href) + ");";
        const o = Object.assign({}, opts); delete o.type;
        return new Native(URL.createObjectURL(new Blob([src], {type:"text/javascript"})), o);
      }
    } catch (e) {}
    return new Native(url, opts);
  };
  Patched.prototype = Native.prototype;
  self.Worker = Patched;
})();

const __src = new URL(location.href).searchParams.get("src");
const __q = [], __h = e => __q.push(e.data);
self.addEventListener("message", __h);
import(__src).then(() => {
  self.removeEventListener("message", __h);
  for (const d of __q) self.dispatchEvent(new MessageEvent("message", {data:d}));
}, e => { setTimeout(() => { throw e; }); });
