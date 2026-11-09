/* =========================================================
   Rendering
   ========================================================= */
function renderPill(){
  renderCoins();
  const on = !!S.profile;
  $("#brand").hidden = on; $("#me").hidden = !on;
  if (on){
    const k = knowledge();
    $("#me-lv").textContent = "Lv." + (1 + Math.floor(k / 50));
  }
}
function render(){
  drawGate();
  renderPill();
  const main = $("#main"), tabs = $("#tabs");
  document.documentElement.style.setProperty("--read-size", FONT[set().font] || FONT.m);
  const dock = $("#dock"), draftEl = $("#talk-input");
  if (draftEl) S.talk.draft = draftEl.value;
  if (!S.profile){
    tabs.hidden = true; main.innerHTML = renderOnboarding();
    const st = S.onb.step, last = st === 2;
    dock.className = "dock onb-nav" + (S.onb.step === 0 ? " solo" : ""); dock.hidden = false;
    dock.innerHTML = (st > 0 ? '<button class="back-btn" data-act="onb-back" aria-label="上一步">' + GATE_ICON.back + "</button>" : "") +
      '<button class="btn next" data-act="' + (last ? "onb-finish" : "onb-next") + '">' + (last ? (provReady(aiState().provider) ? "開始使用" : "先跳過") : "繼續") + ' <span aria-hidden="true">→</span></button>';
    return;
  }
  dock.className = "dock";
  tabs.hidden = false;
  const tabView = S.view === "talk" ? (S.talkFrom || "home") : S.view;
  tabs.querySelectorAll(".tab").forEach(t => t.setAttribute("aria-current", t.dataset.v === tabView ? "page" : "false"));
  const fn = {learn:renderLearn, home:renderHome, city:renderCity, talk:renderTalk, words:renderWords, prefs:renderPrefs}[S.view] || renderHome;
  const keepScroll = render.lastView === S.view ? main.scrollTop : 0;
  const cc = $("#cc-body"), ccKeep = cc ? cc.scrollTop : 0;
  main.classList.toggle("flush", S.view === "city");
  document.body.classList.toggle("city-chat-on", S.view === "city" && !!S.cityChat);
  main.innerHTML = fn();
  main.scrollTop = keepScroll;
  const cc2 = $("#cc-body");
  if (cc2){
    cc2.scrollTop = S.talk.scrollDown ? cc2.scrollHeight : ccKeep;
    if (S.talk.scrollDown){ S.talk.scrollDown = false; setTimeout(() => { cc2.scrollTop = cc2.scrollHeight; }, 150); }   /* again once avatars have loaded */
  }
  render.lastView = S.view;
  const dh = dockHTML(); dock.innerHTML = dh; dock.hidden = !dh;
  if (S.view === "city") City3D.mount();
  if (S.view === "talk" && S.talk.scrollDown){ S.talk.scrollDown = false; main.scrollTop = main.scrollHeight; }
}
function go(view){
  S.view = view;
  if (location.hash !== "#" + view){ try { history.replaceState(null, "", "#" + view); } catch (e) { location.hash = view; } }
  render.lastView = null;
  render();
}
