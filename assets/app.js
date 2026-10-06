const state={
  summary:null,
  raw:null,
  peopleSummary:null,
  metric:"interacciones",
  personMetric:"interacciones",
  postMetric:"interacciones",
  rankingView:"total",
  personView:"total"
};

const $=s=>document.querySelector(s);
const $$=s=>[...document.querySelectorAll(s)];
const nf=new Intl.NumberFormat("es-ES");
const compact=new Intl.NumberFormat("es-ES",{notation:"compact",maximumFractionDigits:1});
const pct=n=>`${Number(n||0).toFixed(2).replace(".",",")}%`;
const n=v=>Number(v||0);
const long=v=>nf.format(Math.round(n(v)));
const palette=["#7c9cff","#e86e86","#72d6a6","#efb263","#a98cf7","#5ac3e8","#e77dd4","#9ac86e"];

const metricLabels={
  interacciones:"Interacciones",
  impresiones:"Impresiones",
  likes:"Likes",
  reposts:"Reposts",
  respuestas:"Respuestas",
  citas:"Citas",
  engagement_sobre_impresiones:"Engagement",
  total_publicaciones:"Posts",
  seguidores:"Seguidores"
};

function esc(s=""){
  return String(s).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
}

function profileMap(){
  return new Map((state.raw||[]).map((c,i)=>[
    c.usuario.username.toLowerCase(),
    {
      image:(c.usuario.profile_image_url||"").replace("_normal","_200x200"),
      name:c.usuario.name,
      desc:c.usuario.description,
      color:palette[i%palette.length]
    }
  ]));
}

function labelMetric(metric){
  return metricLabels[metric]||metric;
}

function perPostValue(item,metric){
  const posts=Math.max(n(item.total_publicaciones),1);
  if(metric==="interacciones") return n(item.interacciones_por_publicacion);
  if(metric==="impresiones") return n(item.impresiones_por_publicacion);
  if(["likes","reposts","respuestas","citas"].includes(metric)) return n(item[metric])/posts;
  return n(item[metric]);
}

function metricValue(item,metric,view){
  if(view==="per_post" && !["engagement_sobre_impresiones","seguidores","total_publicaciones"].includes(metric)){
    return perPostValue(item,metric);
  }
  return n(item[metric]);
}

function formatMetric(value,metric,view){
  if(metric==="engagement_sobre_impresiones") return pct(value);
  if(view==="per_post" && !["seguidores","total_publicaciones"].includes(metric)){
    return Number(value||0).toLocaleString("es-ES",{maximumFractionDigits:1});
  }
  return compact.format(n(value));
}

function metricTitle(metric,view){
  const base=labelMetric(metric);
  if(view==="per_post" && !["engagement_sobre_impresiones","seguidores","total_publicaciones"].includes(metric)){
    return `${base} por post`;
  }
  return base;
}

function renderKpis(){
  const orgs=state.summary.organizaciones||[];
  const people=(state.peopleSummary?.personas||[]).filter(p=>n(p.total_publicaciones)>0);

  const orgTotals=orgs.reduce((a,o)=>{
    a.posts+=n(o.total_publicaciones);
    a.imp+=n(o.impresiones);
    a.int+=n(o.interacciones);
    return a;
  },{posts:0,imp:0,int:0});

  const peopleTotals=people.reduce((a,o)=>{
    a.posts+=n(o.total_publicaciones);
    a.imp+=n(o.impresiones);
    a.int+=n(o.interacciones);
    return a;
  },{posts:0,imp:0,int:0});

  const totals={
    posts:orgTotals.posts+peopleTotals.posts,
    imp:orgTotals.imp+peopleTotals.imp,
    int:orgTotals.int+peopleTotals.int
  };

  $("#hero-total").textContent=compact.format(totals.int);

  const items=[
    ["Organizaciones",orgs.length,"monitorizadas"],
    ["Personas",people.length,"líderes con actividad"],
    ["Publicaciones",totals.posts,"analizadas desde el 05/10"],
    ["Impresiones",totals.imp,"analizadas"],
    ["Interacciones",totals.int,"analizadas"]
  ];

  $("#kpis").innerHTML=items.map(([l,v,s])=>
    `<article class="kpi"><span>${l}</span><strong>${compact.format(n(v))}</strong><em>${s}</em></article>`
  ).join("");
}

function sortedOrganizations(){
  return [...(state.summary.organizaciones||[])].sort(
    (a,b)=>metricValue(b,state.metric,state.rankingView)-metricValue(a,state.metric,state.rankingView)
  );
}

function renderRanking(){
  const profiles=profileMap();
  const list=sortedOrganizations();
  const values=list.map(o=>metricValue(o,state.metric,state.rankingView));
  const max=Math.max(...values,1);
  const title=metricTitle(state.metric,state.rankingView);

  $("#ranking-list").innerHTML=list.map((o,i)=>{
    const p=profiles.get(o.username.toLowerCase())||{};
    const value=metricValue(o,state.metric,state.rankingView);
    return `
      <div class="rank-row">
        <span class="rank-num">${String(i+1).padStart(2,"0")}</span>
        <div class="rank-org">
          <img class="avatar" src="${esc(p.image||"")}" alt="">
          <div><strong>${esc(o.nombre)}</strong><small>@${esc(o.username)}</small></div>
        </div>
        <span class="rank-value">${formatMetric(value,state.metric,state.rankingView)}</span>
      </div>`;
  }).join("");

  $("#chart-title").textContent=title;
  $("#chart-subtitle").textContent=state.rankingView==="per_post" ? "Rendimiento medio por publicación" : "Total acumulado desde el 05/10";

  $("#bars").innerHTML=list.map(o=>{
    const value=metricValue(o,state.metric,state.rankingView);
    return `
      <div class="bar-row">
        <span class="bar-label">${esc(o.nombre)}</span>
        <div class="bar-track"><div class="bar-fill" style="width:${Math.max(2,value/max*100)}%"></div></div>
        <span class="bar-value">${formatMetric(value,state.metric,state.rankingView)}</span>
      </div>`;
  }).join("");
}

function renderOrgs(filter=""){
  const profiles=profileMap();
  const orgs=(state.summary.organizaciones||[]).filter(
    o=>(o.nombre+" "+o.username).toLowerCase().includes(filter.toLowerCase())
  );

  $("#org-grid").innerHTML=orgs.length?orgs.map((o,i)=>{
    const p=profiles.get(o.username.toLowerCase())||{};
    return `
      <article class="org-card" style="--org-color:${p.color||palette[i%palette.length]}">
        <div class="org-head">
          <img class="avatar" src="${esc(p.image||"")}" alt="">
          <div class="org-title"><strong>${esc(o.nombre)}</strong><small>@${esc(o.username)}</small></div>
          <div class="org-followers"><strong>${compact.format(n(o.seguidores))}</strong><small>seguidores</small></div>
        </div>
        <div class="metric-strip">
          <div class="mini"><span>Posts</span><strong>${long(o.total_publicaciones)}</strong></div>
          <div class="mini"><span>Impresiones</span><strong>${compact.format(n(o.impresiones))}</strong></div>
          <div class="mini"><span>Interacciones</span><strong>${compact.format(n(o.interacciones))}</strong></div>
          <div class="mini"><span>Inter./post</span><strong>${Number(n(o.interacciones_por_publicacion)).toLocaleString("es-ES",{maximumFractionDigits:1})}</strong></div>
        </div>
        <div class="org-foot">
          <span>${long(o.publicaciones_propias)} propias · ${long(o.retweets)} RT</span>
          <strong>${pct(o.engagement_sobre_impresiones)} engagement</strong>
        </div>
      </article>`;
  }).join(""):`<div class="empty">No hay organizaciones que coincidan con la búsqueda.</div>`;
}

function visiblePeople(){
  return (state.peopleSummary?.personas||[]).filter(p=>n(p.total_publicaciones)>0);
}

function renderPeople(){
  const data=visiblePeople();

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

  const ranked=[...data].sort(
    (a,b)=>metricValue(b,state.personMetric,state.personView)-metricValue(a,state.personMetric,state.personView)
  );

  $("#person-ranking-title").textContent=metricTitle(state.personMetric,state.personView);

  $("#person-ranking-list").innerHTML=ranked.slice(0,12).map((p,i)=>{
    const value=metricValue(p,state.personMetric,state.personView);
    return `
      <div class="person-rank-row">
        <span class="rank-num">${String(i+1).padStart(2,"0")}</span>
        <div class="rank-org">
          <img class="avatar" src="${esc((p.avatar||"").replace("_normal","_200x200"))}" alt="">
          <div><strong>${esc(p.nombre)}</strong><small>@${esc(p.username)}</small></div>
        </div>
        <span class="rank-value">${formatMetric(value,state.personMetric,state.personView)}</span>
      </div>`;
  }).join("");

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
  const candidates=[];

  for(const c of state.raw||[]){
    for(const t of c.tweets||[]){
      if((t.text||"").startsWith("RT @")) continue;
      const m=t.public_metrics||{};
      candidates.push({
        username:c.usuario.username,
        name:c.nombre_organizacion,
        image:(c.usuario.profile_image_url||"").replace("_normal","_200x200"),
        ...t,
        interacciones:n(m.like_count)+n(m.retweet_count)+n(m.reply_count)+n(m.quote_count),
        impresiones:n(m.impression_count),
        likes:n(m.like_count),
        reposts:n(m.retweet_count),
        respuestas:n(m.reply_count),
        citas:n(m.quote_count)
      });
    }
  }

  return candidates.sort((a,b)=>n(b[state.postMetric])-n(a[state.postMetric])).slice(0,6);
}

function renderPosts(){
  const posts=bestPosts();

  $("#post-grid").innerHTML=posts.length?posts.map(p=>`
    <article class="post-card">
      <div class="post-top">
        <img class="avatar" src="${esc(p.image)}" alt="">
        <div><strong>${esc(p.name)}</strong><small>@${esc(p.username)} · ${new Date(p.created_at).toLocaleDateString("es-ES",{day:"2-digit",month:"short"})}</small></div>
      </div>
      <div class="post-text">${esc((p.text||"").replace(/https:\/\/t\.co\/\S+/g,"").trim())}</div>
      <div class="post-metrics post-metrics-rich">
        <span>Imp. <b>${compact.format(p.impresiones)}</b></span>
        <span>Int. <b>${compact.format(p.interacciones)}</b></span>
        <span>♥ <b>${compact.format(p.likes)}</b></span>
        <span>RT <b>${compact.format(p.reposts)}</b></span>
        <a class="post-link" target="_blank" rel="noopener" href="https://x.com/${encodeURIComponent(p.username)}/status/${encodeURIComponent(p.id)}">Ver en X ↗</a>
      </div>
    </article>`).join(""):`<div class="empty">Todavía no hay publicaciones en el periodo.</div>`;
}

function renderTable(){
  const rows=[...(state.summary.organizaciones||[])].sort((a,b)=>b.impresiones-a.impresiones);
  $("#data-table").innerHTML=rows.map(o=>`
    <tr>
      <td>${esc(o.nombre)}<br><span style="color:#6f7e96;font-weight:500">@${esc(o.username)}</span></td>
      <td>${long(o.seguidores)}</td>
      <td>${long(o.total_publicaciones)}</td>
      <td>${long(o.impresiones)}</td>
      <td>${long(o.interacciones)}</td>
      <td>${long(o.interacciones_por_publicacion)}</td>
      <td>${pct(o.engagement_sobre_impresiones)}</td>
    </tr>`).join("");
}

function setActive(groupSelector,target){
  $$(groupSelector+" button").forEach(b=>b.classList.remove("active"));
  target.classList.add("active");
}

async function init(){
  try{
    const [summary,raw,peopleSummary]=await Promise.all([
      fetch("data/resumen.json",{cache:"no-store"}).then(r=>r.json()),
      fetch("data/datos.json",{cache:"no-store"}).then(r=>r.json()),
      fetch("data/personas_resumen.json",{cache:"no-store"}).then(r=>r.ok?r.json():({personas:[]})).catch(()=>({personas:[]}))
    ]);

    state.summary=summary;
    state.raw=raw;
    state.peopleSummary=peopleSummary;

    const fechas=[summary.generado_en,peopleSummary.generado_en]
      .filter(Boolean)
      .map(v=>new Date(v).getTime())
      .filter(Number.isFinite);

    const updated=new Date(fechas.length?Math.max(...fechas):Date.now());
    $("#updated").textContent=`Actualizado ${updated.toLocaleDateString("es-ES",{day:"2-digit",month:"2-digit",year:"numeric"})} · ${updated.toLocaleTimeString("es-ES",{hour:"2-digit",minute:"2-digit"})}`;

    renderKpis();
    renderRanking();
    renderOrgs();
    renderPeople();
    renderPosts();
    renderTable();
  }catch(e){
    document.querySelector("main").innerHTML=`<div class="empty" style="margin-top:60px">No se han podido cargar los datos. ${esc(e.message)}</div>`;
  }
}

$("#ranking-tabs")?.addEventListener("click",e=>{
  if(!e.target.matches("button")) return;
  setActive("#ranking-tabs",e.target);
  state.metric=e.target.dataset.metric;
  renderRanking();
});

$("#ranking-view")?.addEventListener("click",e=>{
  if(!e.target.matches("button")) return;
  setActive("#ranking-view",e.target);
  state.rankingView=e.target.dataset.view;
  renderRanking();
});

$("#person-tabs")?.addEventListener("click",e=>{
  if(!e.target.matches("button")) return;
  setActive("#person-tabs",e.target);
  state.personMetric=e.target.dataset.personmetric;
  renderPeople();
});

$("#person-view")?.addEventListener("click",e=>{
  if(!e.target.matches("button")) return;
  setActive("#person-view",e.target);
  state.personView=e.target.dataset.view;
  renderPeople();
});

$("#post-tabs")?.addEventListener("click",e=>{
  if(!e.target.matches("button")) return;
  setActive("#post-tabs",e.target);
  state.postMetric=e.target.dataset.postmetric;
  renderPosts();
});

$("#search")?.addEventListener("input",e=>renderOrgs(e.target.value));

init();
