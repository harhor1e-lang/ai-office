/* ALI AI COMPANY — scroll scenes and section transitions */
(() => {
 const reduce=matchMedia("(prefers-reduced-motion: reduce)").matches;
 const hero=document.getElementById("companyIntro");
 const enter=document.getElementById("enterCompany");
 if(enter) enter.addEventListener("click",()=>{
   hero?.classList.add("is-hidden");
   document.querySelector("header")?.scrollIntoView({behavior:reduce?"auto":"smooth",block:"start"});
 });
 const sections=[...document.querySelectorAll("main > .tabview")];
 const nav=[...document.querySelectorAll(".tabs [data-tab]")];
 if("IntersectionObserver" in window){
  const io=new IntersectionObserver(entries=>{
   const visible=entries.filter(e=>e.isIntersecting).sort((a,b)=>b.intersectionRatio-a.intersectionRatio)[0];
   if(!visible)return;
   const id=visible.target.id;
   nav.forEach(b=>b.classList.toggle("active",b.dataset.tab===id));
  },{threshold:[.18,.38,.62],rootMargin:"-18% 0px -35% 0px"});
  sections.forEach(s=>io.observe(s));
 }
 let raf=0;
 function parallax(){
  raf=0;if(reduce)return;
  const y=window.scrollY;
  if(hero&&y<window.innerHeight*1.25){
   hero.style.setProperty("--hero-scroll",Math.min(1,y/(window.innerHeight*1.2)));
   const core=hero.querySelector(".intro-core");
   if(core && !CSS.supports("animation-timeline:scroll()")){
    core.style.transform="translate3d(0,"+(-y*.12)+"px,0)";
    core.style.opacity=String(Math.max(.25,1-y/(window.innerHeight*1.3)));
   }
  }
 }
 window.addEventListener("scroll",()=>{if(!raf)raf=requestAnimationFrame(parallax)},{passive:true});
 parallax();
 nav.forEach(b=>b.addEventListener("click",()=>{
  const target=document.getElementById(b.dataset.tab);
  if(target&&!reduce) target.animate([{opacity:.72,transform:"translateY(18px)"},{opacity:1,transform:"translateY(0)"}],{duration:420,easing:"cubic-bezier(.2,.75,.25,1)"});
 }));
})();