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
    const st = S.onb.step, last = st === ONB_LAST, a = S.onb.about || {};
    const answered = st < 2 || (st === 2 ? !!ageNum(a) : st === 3 ? !!a.gender : (a.interests || []).length > 0);
    dock.className = "dock onb-nav" + (S.onb.step === 0 ? " solo" : ""); dock.hidden = false;
    dock.innerHTML = (st > 0 ? '<button class="back-btn" data-act="onb-back" aria-label="上一步">' + GATE_ICON.back + "</button>" : "") +
      '<button class="btn next" data-act="' + (last ? "onb-finish" : "onb-next") + '">' + (last ? (answered ? "開始使用" : "略過，開始使用") : answered ? "繼續" : "略過") + ' <span aria-hidden="true">→</span></button>';
    wheelInit(); return;
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
  wheelInit();
  if (S.view === "city") City3D.mount();
  if (S.view === "talk" && S.talk.scrollDown){ S.talk.scrollDown = false; main.scrollTop = main.scrollHeight; }
}
function go(view){
  S.view = view;
  if (location.hash !== "#" + view){ try { history.replaceState(null, "", "#" + view); } catch (e) { location.hash = view; } }
  render.lastView = null;
  render();
}
