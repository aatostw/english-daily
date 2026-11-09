/* Developer test clock: when a time offset is saved, the whole app runs as if it were that time */
(() => {
  let off = 0; try { off = Number(localStorage.getItem("eel-time-offset")) || 0; } catch (e) {}
  if (!off) return;
  const RD = Date;
  class TestDate extends RD { constructor(...a){ a.length ? super(...a) : super(RD.now() + off); } static now(){ return RD.now() + off; } }
  window.Date = TestDate; window.__timeOffset = off;
})();
