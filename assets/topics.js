const topicState={
  data:null,
  metric:"interacciones",
  scope:"total",
  selected:null
};

const topic$=s=>document.querySelector(s);
const topic$$=s=>[...document.querySelectorAll(s)];
const topicN=v=>Number(v||0);
const topicCompact=new Intl.NumberFormat("es-ES",{notation:"compact",maximumFractionDigits:1});
const topicLong=new Intl.NumberFormat("es-ES");
const topicPct=n=>`${Number(n||0).toFixed(2).replace(".",",")}%`;
const topicPalette=["#4fa7ff","#ef615b","#f0ae35","#5bc0a5","#8f7de8","#db73b3","#6f91c9","#e98a4e","#80b04c","#4ebac1","#b97adf","#d75d5d","#58a275","#d59b55","#708cd5","#9c78c7"];

function topicEsc(s=""){
  return String(s).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
}

function topicBucket(topic){
  return topic?.[topicState.scope] || topic?.total || {};
}

function topicValue(topic){
  return topicN(topicBucket(topic)[topicState.metric]);
}

function formatTopicValue(value){
  if(topicState.metric==="engagement") return topicPct(value);
  if(topicState.metric==="interacciones_por_tweet"){
    return Number(value||0).toLocaleString("es-ES",{maximumFractionDigits:1});
  }
  return topicCompact.format(topicN(value));
}

function topicSetActive(groupSelector,target){
  topic$$(groupSelector+" button").forEach(b=>b.classList.remove("active"));
  target.classList.add("active");
}

function renderTopicDetail(topic){
  const detail=topic$("#topic-detail");
  if(!detail) return;

  if(!topic){
    detail.classList.remove("visible");
    detail.innerHTML="";
    return;
  }

  const bucket=topicBucket(topic);
  const autores=(topic.autores||[])
    .filter(a=>topicState.scope==="total" || a.tipo===topicState.scope)
    .sort((a,b)=>b.interacciones-a.interacciones)
    .slice(0,6);

  const ejemplos=(topic.ejemplos||[])
    .filter(e=>topicState.scope==="total" || e.tipo===topicState.scope)
    .sort((a,b)=>b.interacciones-a.interacciones)
    .slice(0,4);

  const autoresHtml=autores.length?autores.map(a=>`
    <div class="topic-author">
      <div>
        <strong>${topicEsc(a.nombre)}</strong>
        <small>@${topicEsc(a.username)} · ${topicLong.format(topicN(a.tweets))} posts</small>
      </div>
      <strong>${topicCompact.format(topicN(a.interacciones))}</strong>
    </div>`).join(""):`<div class="empty">Sin autores en este ámbito.</div>`;

  const ejemplosHtml=ejemplos.length?ejemplos.map(e=>`
    <article class="topic-example">
      <strong>${topicEsc(e.autor)} · @${topicEsc(e.username)}</strong>
      <p>${topicEsc((e.texto||"").replace(/https:\/\/t\.co\/\S+/g,"").trim())}</p>
      <a href="https://x.com/${encodeURIComponent(e.username)}/status/${encodeURIComponent(e.id)}" target="_blank" rel="noopener">Ver publicación · ${topicCompact.format(topicN(e.interacciones))} interacciones ↗</a>
    </article>`).join(""):`<div class="empty">Sin ejemplos en este ámbito.</div>`;

  detail.innerHTML=`
    <div class="topic-detail-head">
      <div>
        <h3>${topicEsc(topic.nombre)}</h3>
        <p>${topic.tipo==="emergente"?"Tema emergente detectado automáticamente":"Tema estable del clasificador"} · ${topicLong.format(topicN(bucket.tweets))} posts · ${topicCompact.format(topicN(bucket.impresiones))} impresiones</p>
      </div>
      <span class="method-chip">${topicPct(bucket.engagement)} engagement</span>
    </div>
    <div class="topic-detail-grid">
      <div>
        <p class="eyebrow">QUIÉN EMPUJA EL TEMA</p>
        <div class="topic-authors">${autoresHtml}</div>
      </div>
      <div>
        <p class="eyebrow">PUBLICACIONES DESTACADAS</p>
        <div class="topic-examples">${ejemplosHtml}</div>
      </div>
    </div>`;

  detail.classList.add("visible");
}

function renderTopics(){
  const root=topic$("#topics-list");
  if(!root) return;

  const temas=topicState.data?.temas||[];

  if(!temas.length){
    topic$("#topics-summary").textContent="Todavía no hay análisis temático disponible.";
    root.innerHTML='<div class="empty">La clasificación temática se generará en la próxima actualización.</div>';
    renderTopicDetail(null);
    return;
  }

  const resumen=topicState.data.resumen||{};
  topic$("#topics-summary").innerHTML=`
    <span class="topic-summary-chip"><strong>${topicLong.format(topicN(resumen.temas_activos))}</strong> temas activos</span>
    <span class="topic-summary-chip"><strong>${topicLong.format(topicN(resumen.publicaciones_clasificadas))}</strong> de ${topicLong.format(topicN(resumen.publicaciones_analizadas))} posts clasificados</span>
    <span class="topic-summary-chip"><strong>${topicPct(resumen.cobertura)}</strong> cobertura</span>
    ${topicN(resumen.temas_emergentes)>0?`<span class="topic-summary-chip"><strong>${topicLong.format(topicN(resumen.temas_emergentes))}</strong> emergentes detectados</span>`:""}
    <span>Un post puede pertenecer a varios temas.</span>`;

  const sorted=[...temas]
    .filter(t=>topicN(topicBucket(t).tweets)>0)
    .sort((a,b)=>topicValue(b)-topicValue(a));

  const max=Math.max(...sorted.map(topicValue),1);

  if(topicState.selected && !sorted.some(t=>t.id===topicState.selected)){
    topicState.selected=null;
  }

  root.innerHTML=sorted.slice(0,30).map((topic,i)=>{
    const value=topicValue(topic);
    const color=topicPalette[i%topicPalette.length];
    const active=topicState.selected===topic.id?" active":"";

    return `
      <button class="topic-row${active}" data-topicid="${topicEsc(topic.id)}" style="--topic-color:${color}">
        <span class="topic-rank">${String(i+1).padStart(2,"0")}</span>
        <span class="topic-dot"></span>
        <span class="topic-label">
          <strong>${topicEsc(topic.nombre)}</strong>
          ${topic.tipo==="emergente"?'<span class="topic-badge">emergente</span>':""}
        </span>
        <span class="topic-track"><span class="topic-fill" style="width:${Math.max(2,value/max*100)}%"></span></span>
        <span class="topic-value">${formatTopicValue(value)}</span>
      </button>`;
  }).join("");

  renderTopicDetail(temas.find(t=>t.id===topicState.selected)||null);
}

async function initTopics(){
  const summary=topic$("#topics-summary");
  if(!summary) return;

  try{
    const response=await fetch("data/temas.json",{cache:"no-store"});

    if(!response.ok){
      throw new Error("Todavía no existe data/temas.json");
    }

    topicState.data=await response.json();
    renderTopics();
  }catch(error){
    summary.textContent="El análisis temático todavía no está disponible.";
    topic$("#topics-list").innerHTML='<div class="empty">Se activará automáticamente tras la próxima actualización de datos.</div>';
  }
}

topic$("#topic-tabs")?.addEventListener("click",e=>{
  if(!e.target.matches("button")) return;
  topicSetActive("#topic-tabs",e.target);
  topicState.metric=e.target.dataset.topicmetric;
  renderTopics();
});

topic$("#topic-scope")?.addEventListener("click",e=>{
  if(!e.target.matches("button")) return;
  topicSetActive("#topic-scope",e.target);
  topicState.scope=e.target.dataset.scope;
  renderTopics();
});

topic$("#topics-list")?.addEventListener("click",e=>{
  const row=e.target.closest(".topic-row");
  if(!row) return;
  topicState.selected=topicState.selected===row.dataset.topicid?null:row.dataset.topicid;
  renderTopics();
});

initTopics();
