(function(){
  "use strict";
  var root=document.documentElement;
  var reduceMotion=window.matchMedia("(prefers-reduced-motion: reduce)");
  var motion=()=>!reduceMotion.matches;

  var viewTabs=[...document.querySelectorAll("[data-view]")];
  var panels=[...document.querySelectorAll("[data-view-panel]")];
  function showView(name, updateHash){
    viewTabs.forEach(function(tab){
      var active=tab.dataset.view===name;
      tab.setAttribute("aria-selected",String(active));
    });
    panels.forEach(function(panel){
      var active=panel.dataset.viewPanel===name;
      panel.hidden=!active;
      panel.classList.toggle("is-active",active);
    });
    if(updateHash && history.replaceState) history.replaceState(null,"","#"+name);
    var activePanel=document.querySelector('[data-view-panel="'+name+'"]');
    if(activePanel) activePanel.focus({preventScroll:true});
    window.scrollTo({top:0,behavior:motion()?"smooth":"auto"});
  }
  viewTabs.forEach(function(tab){
    tab.addEventListener("click",function(){showView(tab.dataset.view,true)});
    tab.addEventListener("keydown",function(event){
      if(!["ArrowRight","ArrowLeft","Home","End"].includes(event.key))return;
      event.preventDefault();
      var index=viewTabs.indexOf(tab),next=index;
      if(event.key==="ArrowRight")next=(index+1)%viewTabs.length;
      if(event.key==="ArrowLeft")next=(index-1+viewTabs.length)%viewTabs.length;
      if(event.key==="Home")next=0;
      if(event.key==="End")next=viewTabs.length-1;
      viewTabs[next].focus();
    });
  });

  document.querySelectorAll('a[href^="#"]').forEach(function(link){
    var target=link.getAttribute("href").slice(1);
    if(!["overview","routes","results"].includes(target))return;
    link.addEventListener("click",function(event){event.preventDefault();showView(target,true)});
  });

  var initialHash=location.hash.slice(1);
  if(["overview","routes","results"].includes(initialHash))showView(initialHash,false);

  var menuToggle=document.querySelector(".menu-toggle");
  var mobileMenu=document.querySelector("#mobile-menu");
  function closeMenu(){if(!menuToggle||!mobileMenu)return;menuToggle.setAttribute("aria-expanded","false");mobileMenu.hidden=true}
  if(menuToggle){
    menuToggle.addEventListener("click",function(){
      var open=menuToggle.getAttribute("aria-expanded")==="true";
      menuToggle.setAttribute("aria-expanded",String(!open));
      mobileMenu.hidden=open;
    });
    document.addEventListener("keydown",function(event){if(event.key==="Escape")closeMenu()});
    mobileMenu.querySelectorAll("a").forEach(function(link){link.addEventListener("click",closeMenu)});
  }

  var moduleDetail=document.querySelector("#module-detail");
  var moduleCopy={
    foundation:"适合刚开始接触 AI，先把大模型、提示词、上下文、知识库和 Agent 的关系理清楚。",
    tools:"适合已经在使用几个工具，但还不知道怎样按任务选择模型、工具和资料入口。",
    agent:"适合有重复任务，希望 AI 能读文件、调用工具，并按步骤协作完成工作的人。",
    coze:"适合想把一个明确流程做成可运行智能体，先从简单工作流开始验证。",
    aigc:"适合做内容、图像、视频或图文故事，希望把创意推进到一个可展示片段的人。"
  };
  document.querySelectorAll("[data-module]").forEach(function(card){
    card.addEventListener("click",function(){
      document.querySelectorAll("[data-module]").forEach(function(item){item.setAttribute("aria-pressed",String(item===card))});
      moduleDetail.textContent=moduleCopy[card.dataset.module]||"先从一个具体任务开始，再选择需要的模块。";
    });
  });

  var routes=[
    {t:"AI 小白入门",d:"先理解大模型、Token、上下文、提示词和 Agent 的基础关系，不再被新名词牵着走。",m:"Part 1 · AI 地基与底层逻辑",r:"完成一份可重复使用的个人提示词模板",f:[["?","说清一个工作需求"],["地","AI 地基 + 提示词"],["✓","个人提示词模板"]]},
    {t:"从会问到会做",d:"从向 AI 提一个问题，升级为拆解任务、提供材料、迭代结果并完成交付。",m:"Part 1 + Part 2 · 基础与工具",r:"和 AI 协作完成一份工作交付",f:[["料","整理一份原始材料"],["拆","拆任务 + 选工具"],["交","完整工作交付"]]},
    {t:"搭建 AI Agent",d:"让 AI 从聊天对象变成能读文件、使用工具并稳定执行任务的个人助手。",m:"Part 3 + Part 4 · Agent 与智能体",r:"做出一个能重复执行任务的个人助手",f:[["↺","找出一项重复任务"],["AI","文件 + Skills + 工具"],["助","个人任务助手"]]},
    {t:"内容创作",d:"建立选题、素材包、大纲、初稿、审校与分发的连续内容生产流程。",m:"Part 2 + Part 5 · 工具与创作",r:"完成一篇有素材依据的内容成稿",f:[["题","确定一个要写的选题"],["稿","素材 + 大纲 + 审校"],["发","可发布内容成稿"]]},
    {t:"职场提效",d:"把 AI 用到总结、方案、资料整理、表格、会议纪要和流程自动化中。",m:"Part 2 · AI 大模型与工具",r:"完成一份下次还能直接套用的职场任务模板",f:[["会","处理会议或杂乱资料"],["表","总结 + 表格 + 自动化"],["省","职场任务模板"]]},
    {t:"AI 编程",d:"理解 API、项目目录、配置、Claude Code、Codex、MCP 与 Skills 等基础。",m:"Part 3 · AI 编程与个人 Agent",r:"在 AI 协助下完成一个可运行的小项目",f:[["需","提出一个小功能需求"],["码","项目 + 代码 + 调试"],["跑","可运行小项目"]]},
    {t:"AIGC 创作",d:"把 AI 用于剧本、角色、分镜、图像、视频片段或图文故事的完整制作。",m:"Part 5 · AIGC 研习系统",r:"完成一个可展示的 AIGC 作品片段",f:[["✦","定下一个创意概念"],["镜","剧本 + 分镜 + 生成"],["▶","可展示作品片段"]]}
  ];
  var routeButtons=[...document.querySelectorAll("[data-route]")];
  function renderRoute(index){
    var route=routes[index];
    routeButtons.forEach(function(button,pos){button.setAttribute("aria-selected",String(pos===index))});
    document.querySelector("#route-code").textContent="路径 "+String(index+1).padStart(2,"0");
    document.querySelector("#route-title").textContent=route.t;
    document.querySelector("#route-desc").textContent=route.d;
    document.querySelector("#route-module").textContent=route.m;
    document.querySelector("#route-result").textContent=route.r;
    ["task","action","output"].forEach(function(key,pos){document.querySelector("#route-"+key+"-icon").textContent=route.f[pos][0];document.querySelector("#route-"+key).textContent=route.f[pos][1]});
  }
  routeButtons.forEach(function(button,index){button.addEventListener("click",function(){renderRoute(index)})});
  renderRoute(0);

  var bookmark=document.querySelector("[data-bookmark]");
  var bookmarkKey="daxiang-course-preview-bookmarked";
  var bookmarked=false;
  try{bookmarked=localStorage.getItem(bookmarkKey)==="1"}catch(_){ }
  function renderBookmark(){bookmark.setAttribute("aria-pressed",String(bookmarked));bookmark.textContent=bookmarked?"★ 已收藏预览":"☆ 收藏预览"}
  bookmark.addEventListener("click",function(){bookmarked=!bookmarked;try{localStorage.setItem(bookmarkKey,bookmarked?"1":"0")}catch(_){ }renderBookmark()});
  renderBookmark();

  var hero=document.querySelector(".preview-hero");
  var heroLayers=hero?Array.prototype.slice.call(hero.querySelectorAll("[data-depth]")):[];
  var heroPointer={x:0,y:0,tx:0,ty:0,frame:0};
  function renderHeroPointer(){
    heroPointer.frame=0;
    if(!hero||reduceMotion.matches){heroPointer.x=heroPointer.y=heroPointer.tx=heroPointer.ty=0;heroLayers.forEach(function(el){el.style.setProperty("--hero-x","0px");el.style.setProperty("--hero-y","0px")});return}
    var dx=heroPointer.tx-heroPointer.x,dy=heroPointer.ty-heroPointer.y;
    heroPointer.x+=dx*.14;heroPointer.y+=dy*.14;
    heroLayers.forEach(function(el){var depth=Number(el.dataset.depth)||0;el.style.setProperty("--hero-x",(heroPointer.x*depth*34).toFixed(2)+"px");el.style.setProperty("--hero-y",(heroPointer.y*depth*26).toFixed(2)+"px")});
    if(Math.abs(dx)>.001||Math.abs(dy)>.001)heroPointer.frame=requestAnimationFrame(renderHeroPointer);
  }
  function queueHeroPointer(){if(!heroPointer.frame&&!reduceMotion.matches)heroPointer.frame=requestAnimationFrame(renderHeroPointer)}
  function resetHeroPointer(){heroPointer.tx=0;heroPointer.ty=0;queueHeroPointer()}
  if(hero){hero.addEventListener("pointermove",function(event){if(reduceMotion.matches)return;var rect=hero.getBoundingClientRect();heroPointer.tx=Math.max(-1,Math.min(1,(event.clientX-rect.left)/rect.width*2-1));heroPointer.ty=Math.max(-1,Math.min(1,(event.clientY-rect.top)/rect.height*2-1));queueHeroPointer()},{passive:true});hero.addEventListener("pointerleave",resetHeroPointer,{passive:true});hero.addEventListener("pointercancel",resetHeroPointer,{passive:true})}
  function updateHeroScroll(){if(!hero||reduceMotion.matches)return;var rect=hero.getBoundingClientRect(),vh=Math.max(innerHeight,1),progress=Math.max(-1,Math.min(1,(rect.top+rect.height/2-vh/2)/vh));hero.style.setProperty("--scroll-y",(-progress*12).toFixed(2)+"px")}

  var scrollFrame=0;
  function updateProgress(){scrollFrame=0;var max=document.documentElement.scrollHeight-innerHeight;var progress=max>0?Math.min(Math.max(scrollY/max,0),1):0;root.style.setProperty("--page-progress",progress);updateHeroScroll()}
  addEventListener("scroll",function(){if(!scrollFrame)scrollFrame=requestAnimationFrame(updateProgress)},{passive:true});
  if(typeof reduceMotion.addEventListener==="function")reduceMotion.addEventListener("change",function(){resetHeroPointer();updateHeroScroll()});
  updateProgress();
})();
