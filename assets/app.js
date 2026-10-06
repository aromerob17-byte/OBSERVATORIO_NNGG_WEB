const state={summary:null,raw:null,metric:"impresiones",postMetric:"interacciones"};
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
 const orgs=state.summary.organizaciones;
 const totals=orgs.reduce((a,o)=>{a.posts+=n(o.total_publicaciones);a.imp+=n(o.impresiones);a.int+=n(o.interacciones);a.likes+=n(o.likes);a.follow+=n(o.seguidores);return a},{posts:0,imp:0,int:0,likes:0,follow:0});
 $("#hero-total").textContent=compact.format(totals.int);
 const items=[["Organizaciones",orgs.length,"monitorizadas"],["Publicaciones",totals.posts,"desde el 05/10"],["Impresiones",totals.imp,"acumuladas"],["Interacciones",totals.int,"públicas"],["Seguidores",totals.follow,"audiencia total"]];
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
   const [summary,raw]=await Promise.all([fetch("data/resumen.json",{cache:"no-store"}).then(r=>r.json()),fetch("data/datos.json",{cache:"no-store"}).then(r=>r.json())]);
   state.summary=summary;state.raw=raw;
   const updated=new Date(summary.generado_en);
   $("#updated").textContent=`Actualizado ${updated.toLocaleDateString("es-ES",{day:"2-digit",month:"2-digit",year:"numeric"})} · ${updated.toLocaleTimeString("es-ES",{hour:"2-digit",minute:"2-digit"})}`;
   renderKpis();renderRanking();renderOrgs();renderPosts();renderTable();
 }catch(e){document.querySelector("main").innerHTML=`<div class="empty" style="margin-top:60px">No se han podido cargar los datos. ${esc(e.message)}</div>`}
}
$("#ranking-tabs").addEventListener("click",e=>{if(e.target.matches("button")){$$("#ranking-tabs button").forEach(b=>b.classList.remove("active"));e.target.classList.add("active");state.metric=e.target.dataset.metric;renderRanking()}});
$("#post-tabs").addEventListener("click",e=>{if(e.target.matches("button")){$$("#post-tabs button").forEach(b=>b.classList.remove("active"));e.target.classList.add("active");state.postMetric=e.target.dataset.postmetric;renderPosts()}});
$("#search").addEventListener("input",e=>renderOrgs(e.target.value));
init();
