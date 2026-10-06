const state={summary:null,raw:null,peopleSummary:null,metric:"impresiones",postMetric:"interacciones",personMetric:"interacciones"};
const $=s=>document.querySelector(s);
const $$=s=>[...document.querySelectorAll(s)];
const nf=new Intl.NumberFormat("es-ES");
const compact=new Intl.NumberFormat("es-ES",{notation:"compact",maximumFractionDigits:1});
const pct=n=>`${Number(n||0).toFixed(2).replace(".",",")}%`;
const n=v=>Number(v||0);
const fmt=(v,metric)=>metric==="engagement_sobre_impresiones"?pct(v):compact.format(n(v));
const long=v=>nf.format(Math.round(n(v)));
const palette=["#7c9cff","#e86e86","#72d6a6","#efb263","#a98cf7","#5ac3e8","#e77dd4","#9ac86e"];

function profileMap(){
  return new Map((state.raw||[]).map((c,i)=>[c.usuario.username.toLowerCase(),{
    image:(c.usuario.profile_image_url||"").replace("_normal","_200x200"),
    name:c.usuario.name,desc:c.usuario.description,color:palette[i%palette.length]
  }]));
}
function esc(s=""){return String(s).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]))}
function labelMetric(m){return({impresiones:"Impresiones",interacciones:"Interacciones",engagement_sobre_impresiones:"Engagement",seguidores:"Seguidores"})[m]||m}

function renderKpis(){
 const orgs=state.summary.organizaciones||[];
 const people=(state.peopleSummary?.personas||[]).filter(p=>n(p.total_publicaciones)>0);

 const orgTotals=orgs.reduce((a,o)=>{
   a.posts+=n(o.total_publicaciones);a.imp+=n(o.impresiones);a.int+=n(o.interacciones);return a
 },{posts:0,imp:0,int:0});

 const peopleTotals=people.reduce((a,o)=>{
   a.posts+=n(o.total_publicaciones);a.imp+=n(o.impresiones);a.int+=n(o.interacciones);return a
 },{posts:0,imp:0,int:0});

 const totals={
   posts:orgTotals.posts+peopleTotals.posts,
   imp:orgTotals.imp+peopleTotals.imp,
   int:orgTotals.int+peopleTotals.int
 };

 $("#hero-total").textContent=compact.format(totals.int);

 const items=[
   ["Organizaciones",orgs.length,"monitorizadas"],
   ["Personas",people.length,"líderes seguidos"],
   ["Publicaciones",totals.posts,"analizadas desde el 05/10"],
   ["Impresiones",totals.imp,"analizadas"],
   ["Interacciones",totals.int,"analizadas"]
 ];

 $("#kpis").innerHTML=items.map(([l,v,s])=>`<article class="kpi"><span>${l}</span><strong>${typeof v==="number"?compact.format(v):v}</strong><em>${s}</em></article>`).join("");
}
function sorted(){
 return [...state.summary.organizaciones].sort((a,b)=>n(b[state.metric])-n(a[state.metric]));
}
function renderRanking(){
 const profiles=profileMap(),list=sorted(),max=Math.max(...list.map(o=>n(o[state.metric])),1);
 $("#ranking-list").innerHTML=list.map((o,i)=>{const p=profiles.get(o.username.toLowerCase())||{};return `
 <div class="rank-row"><span class="rank-num">${String(i+1).padStart(2,"0")}</span><div class="rank-org"><img class="avatar" src="${esc(p.image||"")}" alt=""><div><strong>${esc(o.nombre)}</strong><small>@${esc(o.username)}</small></div></div><span class="rank-value">${fmt(o[state.metric],state.metric)}</span></div>`}).join("");
 $("#chart-title").textContent=`Cuota de ${labelMetric(state.metric).toLowerCase()}`;
 $("#bars").innerHTML=list.map(o=>`<div class="bar-row"><span class="bar-label">${esc(o.nombre)}</span><div class="bar-track"><div class="bar-fill" style="width:${Math.max(2,n(o[state.metric])/max*100)}%"></div></div><span class="bar-value">${fmt(o[state.metric],state.metric)}</span></div>`).join("");
}
function renderOrgs(filter=""){
 const profiles=profileMap();
 const orgs=state.summary.organizaciones.filter(o=>(o.nombre+" "+o.username).toLowerCase().includes(filter.toLowerCase()));
 $("#org-grid").innerHTML=orgs.length?orgs.map((o,i)=>{const p=profiles.get(o.username.toLowerCase())||{};return `
 <article class="org-card" style="--org-color:${p.color||palette[i%palette.length]}">
   <div class="org-head"><img class="avatar" src="${esc(p.image||"")}" alt=""><div class="org-title"><strong>${esc(o.nombre)}</strong><small>@${esc(o.username)}</small></div><div class="org-followers"><strong>${compact.format(n(o.seguidores))}</strong><small>seguidores</small></div></div>
   <div class="metric-strip">
     <div class="mini"><span>Posts</span><strong>${long(o.total_publicaciones)}</strong></div>
     <div class="mini"><span>Impresiones</span><strong>${compact.format(n(o.impresiones))}</strong></div>
     <div class="mini"><span>Interacciones</span><strong>${compact.format(n(o.interacciones))}</strong></div>
     <div class="mini"><span>Inter./post</span><strong>${compact.format(n(o.interacciones_por_publicacion))}</strong></div>
   </div>
   <div class="org-foot"><span>${long(o.publicaciones_propias)} propias · ${long(o.retweets)} RT</span><strong>${pct(o.engagement_sobre_impresiones)} engagement</strong></div>
 </article>`}).join(""):`<div class="empty">No hay organizaciones que coincidan con la búsqueda.</div>`;
}
function personMetricLabel(m){
 return ({interacciones:"Interacciones",impresiones:"Impresiones",engagement_sobre_impresiones:"Engagement",seguidores:"Seguidores"})[m]||m;
}
function renderPeople(){
 const data=(state.peopleSummary?.personas||[]).filter(p=>n(p.total_publicaciones)>0);
 if(!data.length){
   $("#person-leader").innerHTML='<div class="empty">Todavía no hay datos personales disponibles.</div>';
   $("#person-ranking-list").innerHTML="";
   $("#people-grid").innerHTML="";
   return;
 }

 const leader=[...data].sort((a,b)=>n(b.interacciones)-n(a.interacciones))[0];
 const avatar=(leader.avatar||"").replace("_normal","_200x200");
 $("#person-leader").innerHTML=`
   <div class="leader-kicker">Líder joven de la conversación</div>
   <div class="leader-main">
     <img class="avatar" src="${esc(avatar)}" alt="">
     <div><h3>${esc(leader.nombre)}</h3><small>@${esc(leader.username)}</small></div>
   </div>
   <div class="leader-score">${long(leader.interacciones)} <span>interacciones</span></div>
   <div class="leader-meta">
     <div><span>Impresiones</span><strong>${compact.format(n(leader.impresiones))}</strong></div>
     <div><span>Posts</span><strong>${long(leader.total_publicaciones)}</strong></div>
     <div><span>Engagement</span><strong>${pct(leader.engagement_sobre_impresiones)}</strong></div>
   </div>`;

 const ranked=[...data].sort((a,b)=>n(b[state.personMetric])-n(a[state.personMetric]));
 $("#person-ranking-title").textContent=`Ranking por ${personMetricLabel(state.personMetric).toLowerCase()}`;
 $("#person-ranking-list").innerHTML=ranked.slice(0,12).map((p,i)=>`
   <div class="person-rank-row">
     <span class="rank-num">${String(i+1).padStart(2,"0")}</span>
     <div class="rank-org">
       <img class="avatar" src="${esc((p.avatar||"").replace("_normal","_200x200"))}" alt="">
       <div><strong>${esc(p.nombre)}</strong><small>@${esc(p.username)}</small></div>
     </div>
     <span class="rank-value">${fmt(p[state.personMetric],state.personMetric)}</span>
   </div>`).join("");

 const cards=[...data].sort((a,b)=>n(b.interacciones)-n(a.interacciones));
 $("#people-grid").innerHTML=cards.map(p=>`
   <article class="person-card">
     <div class="person-card-head">
       <img class="avatar" src="${esc((p.avatar||"").replace("_normal","_200x200"))}" alt="">
       <div class="person-card-title"><strong>${esc(p.nombre)}</strong><small>@${esc(p.username)}</small></div>
     </div>
     <div class="person-card-metrics">
       <div><span>Interacciones</span><strong>${compact.format(n(p.interacciones))}</strong></div>
       <div><span>Impresiones</span><strong>${compact.format(n(p.impresiones))}</strong></div>
       <div><span>Engagement</span><strong>${pct(p.engagement_sobre_impresiones)}</strong></div>
     </div>
   </article>`).join("");
}

function bestPosts(){
 const profiles=profileMap();
 const candidates=[];
 for(const c of state.raw||[]) for(const t of c.tweets||[]){
   const m=t.public_metrics||{},inter=n(m.like_count)+n(m.retweet_count)+n(m.reply_count)+n(m.quote_count);
   candidates.push({username:c.usuario.username,name:c.nombre_organizacion,image:(c.usuario.profile_image_url||"").replace("_normal","_200x200"),...t,interacciones:inter,impresiones:n(m.impression_count)});
 }
 return candidates.sort((a,b)=>n(b[state.postMetric])-n(a[state.postMetric])).slice(0,6);
}
function renderPosts(){
 const posts=bestPosts();
 $("#post-grid").innerHTML=posts.length?posts.map(p=>`<article class="post-card">
   <div class="post-top"><img class="avatar" src="${esc(p.image)}" alt=""><div><strong>${esc(p.name)}</strong><small>@${esc(p.username)} · ${new Date(p.created_at).toLocaleDateString("es-ES",{day:"2-digit",month:"short"})}</small></div></div>
   <div class="post-text">${esc(p.text.replace(/https:\/\/t\.co\/\S+/g,"").trim())}</div>
   <div class="post-metrics"><span>◉ <b>${compact.format(p.impresiones)}</b></span><span>↗ <b>${compact.format(p.interacciones)}</b></span><a class="post-link" target="_blank" rel="noopener" href="https://x.com/${encodeURIComponent(p.username)}/status/${encodeURIComponent(p.id)}">Ver en X ↗</a></div>
 </article>`).join(""):`<div class="empty">Todavía no hay publicaciones en el periodo.</div>`;
}
function renderTable(){
 const rows=[...state.summary.organizaciones].sort((a,b)=>b.impresiones-a.impresiones);
 $("#data-table").innerHTML=rows.map(o=>`<tr><td>${esc(o.nombre)}<br><span style="color:#6f7e96;font-weight:500">@${esc(o.username)}</span></td><td>${long(o.seguidores)}</td><td>${long(o.total_publicaciones)}</td><td>${long(o.impresiones)}</td><td>${long(o.interacciones)}</td><td>${long(o.interacciones_por_publicacion)}</td><td>${pct(o.engagement_sobre_impresiones)}</td></tr>`).join("");
}
async function init(){
 try{
   const [summary,raw,peopleSummary]=await Promise.all([
     fetch("data/resumen.json",{cache:"no-store"}).then(r=>r.json()),
     fetch("data/datos.json",{cache:"no-store"}).then(r=>r.json()),
     fetch("data/personas_resumen.json",{cache:"no-store"}).then(r=>r.ok?r.json():({personas:[]})).catch(()=>({personas:[]}))
   ]);
   state.summary=summary;state.raw=raw;state.peopleSummary=peopleSummary;
   const fechas=[summary.generado_en,peopleSummary.generado_en].filter(Boolean).map(v=>new Date(v).getTime()).filter(Number.isFinite);
   const updated=new Date(fechas.length?Math.max(...fechas):Date.now());
   $("#updated").textContent=`Actualizado ${updated.toLocaleDateString("es-ES",{day:"2-digit",month:"2-digit",year:"numeric"})} · ${updated.toLocaleTimeString("es-ES",{hour:"2-digit",minute:"2-digit"})}`;
   renderKpis();renderRanking();renderOrgs();renderPeople();renderPosts();renderTable();
 }catch(e){document.querySelector("main").innerHTML=`<div class="empty" style="margin-top:60px">No se han podido cargar los datos. ${esc(e.message)}</div>`}
}
$("#ranking-tabs").addEventListener("click",e=>{if(e.target.matches("button")){$$("#ranking-tabs button").forEach(b=>b.classList.remove("active"));e.target.classList.add("active");state.metric=e.target.dataset.metric;renderRanking()}});
$("#post-tabs").addEventListener("click",e=>{if(e.target.matches("button")){$("#post-tabs button").forEach(b=>b.classList.remove("active"));e.target.classList.add("active");state.postMetric=e.target.dataset.postmetric;renderPosts()}});
$("#person-tabs")?.addEventListener("click",e=>{if(e.target.matches("button")){$("#person-tabs button").forEach(b=>b.classList.remove("active"));e.target.classList.add("active");state.personMetric=e.target.dataset.personmetric;renderPeople()}});
$("#search").addEventListener("input",e=>renderOrgs(e.target.value));
init();
