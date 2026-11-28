/* ALI AI COMPANY — Motion Controller v1 */
(() => {
  "use strict";
  const reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const root = document.documentElement;
  const progress = document.createElement("div");
  progress.id = "motionProgress";
  progress.setAttribute("aria-hidden","true");
  document.body.append(progress);

  const topButton = document.createElement("button");
  topButton.id = "motionTop";
  topButton.type = "button";
  topButton.setAttribute("aria-label","العودة إلى أعلى الصفحة");
  topButton.setAttribute("title","العودة إلى الأعلى");
  topButton.textContent = "↑";
  document.body.append(topButton);
  topButton.addEventListener("click", () => window.scrollTo({top:0,behavior:reduced?"auto":"smooth"}));

  const nativeScrollTimeline = CSS.supports("animation-timeline: scroll()") &&
    CSS.supports("animation-range: entry 0% entry 35%");
  if (nativeScrollTimeline) {
    const style = document.createElement("style");
    style.textContent = "@keyframes motion-progress{from{transform:scaleX(0)}to{transform:scaleX(1)}}#motionProgress{animation:motion-progress linear both;animation-timeline:scroll(root block)}";
    document.head.append(style);
  }

  const revealSelector = [
    "main > .intro","main > .tabs",".tabview.active > .panel",
    ".tabview.active > .layout",".tabview.active > .directory-grid",
    ".tabview.active .stat",".tabview.active .info-card",
    ".tabview.active .task-card",".tabview.active .employee",
    ".conversation-library-intro",".conversation-library-list .conversation-item",
    ".side > .panel"
  ].join(",");
  const seen = new WeakSet();
  let observer = null;
  if (!nativeScrollTimeline && !reduced && "IntersectionObserver" in window) {
    observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add("motion-visible");
          observer.unobserve(entry.target);
        }
      });
    },{rootMargin:"0px 0px -7% 0px",threshold:.08});
  }
  function prepare(scope=document){
    if (reduced) return;
    scope.querySelectorAll(revealSelector).forEach((element,index) => {
      if (seen.has(element)) return;
      seen.add(element);
      element.classList.add("motion-reveal");
      element.style.setProperty("--motion-order",String(index%8));
      if (observer) observer.observe(element);
      else if (!nativeScrollTimeline) element.classList.add("motion-visible");
    });
  }
  prepare();
  document.querySelectorAll("[data-tab]").forEach(tab => tab.addEventListener("click",() => {
    requestAnimationFrame(() => prepare(document.getElementById(tab.dataset.tab) || document));
  }));
  const mutation = new MutationObserver(records => {
    for (const record of records) for (const node of record.addedNodes) {
      if (node.nodeType===1) {
        if (node.matches?.(revealSelector)) prepare(node.parentElement || document);
        else if (node.querySelector) prepare(node);
      }
    }
  });
  mutation.observe(document.querySelector("main") || document.body,{childList:true,subtree:true});

  let ticking=false;
  function updateScroll(){
    ticking=false;
    const max=root.scrollHeight-window.innerHeight;
    if (!nativeScrollTimeline) progress.style.transform="scaleX("+(max>0?Math.min(1,Math.max(0,window.scrollY/max)):0)+")";
    topButton.classList.toggle("is-visible",window.scrollY>420);
  }
  window.addEventListener("scroll",() => {
    if (!ticking) {ticking=true;requestAnimationFrame(updateScroll);}
  },{passive:true});
  window.addEventListener("resize",updateScroll,{passive:true});
  updateScroll();
})();