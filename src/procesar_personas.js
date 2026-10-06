const fs = require("fs");

const datos = JSON.parse(
  fs.readFileSync("data/personas_datos.json", "utf8")
);

function numero(valor) {
  return Number(valor || 0);
}

function sumarMetricas(tweets) {
  const totales = {
    impresiones: 0,
    likes: 0,
    reposts: 0,
    respuestas: 0,
    citas: 0,
    bookmarks: 0
  };

  for (const tweet of tweets) {
    const m = tweet.public_metrics || {};
    totales.impresiones += numero(m.impression_count);
    totales.likes += numero(m.like_count);
    totales.reposts += numero(m.retweet_count);
    totales.respuestas += numero(m.reply_count);
    totales.citas += numero(m.quote_count);
    totales.bookmarks += numero(m.bookmark_count);
  }

  return totales;
}

function interacciones(tweet) {
  const m = tweet.public_metrics || {};
  return (
    numero(m.like_count) +
    numero(m.retweet_count) +
    numero(m.reply_count) +
    numero(m.quote_count)
  );
}

function procesarPersona(persona) {
  const tweets = persona.tweets || [];
  const publicacionesPropias = tweets.filter(
    tweet => !tweet.text.startsWith("RT @")
  );
  const retweets = tweets.filter(
    tweet => tweet.text.startsWith("RT @")
  );

  // El rendimiento se atribuye solo a publicaciones propias.\n  // Los RT se conservan como actividad, pero sus métricas pertenecen al tuit original.\n  const metricas = sumarMetricas(publicacionesPropias);
  const totalInteracciones =
    metricas.likes +
    metricas.reposts +
    metricas.respuestas +
    metricas.citas;

  const mejorInteracciones =
    publicacionesPropias.length > 0
      ? [...publicacionesPropias].sort((a, b) => interacciones(b) - interacciones(a))[0]
      : null;

  const mejorImpresiones =
    publicacionesPropias.length > 0
      ? [...publicacionesPropias].sort(
          (a, b) =>
            numero(b.public_metrics?.impression_count) -
            numero(a.public_metrics?.impression_count)
        )[0]
      : null;

  const totalPublicaciones = publicacionesPropias.length;

  return {
    nombre: persona.nombre_persona,
    username: persona.usuario.username,
    avatar: persona.usuario.profile_image_url || "",
    seguidores: persona.usuario.metrics?.followers_count || 0,
    siguiendo: persona.usuario.metrics?.following_count || 0,
    total_publicaciones: totalPublicaciones,\n    actividad_total: tweets.length,
    publicaciones_propias: publicacionesPropias.length,
    retweets: retweets.length,
    impresiones: metricas.impresiones,
    likes: metricas.likes,
    reposts: metricas.reposts,
    respuestas: metricas.respuestas,
    citas: metricas.citas,
    bookmarks: metricas.bookmarks,
    interacciones: totalInteracciones,
    interacciones_por_publicacion:
      totalPublicaciones > 0 ? totalInteracciones / totalPublicaciones : 0,
    impresiones_por_publicacion:
      totalPublicaciones > 0 ? metricas.impresiones / totalPublicaciones : 0,
    engagement_sobre_impresiones:
      metricas.impresiones > 0
        ? (totalInteracciones / metricas.impresiones) * 100
        : 0,
    mejor_publicacion_interacciones:
      mejorInteracciones
        ? {
            id: mejorInteracciones.id,
            fecha: mejorInteracciones.created_at,
            texto: mejorInteracciones.text,
            interacciones: interacciones(mejorInteracciones),
            metricas: mejorInteracciones.public_metrics
          }
        : null,
    mejor_publicacion_impresiones:
      mejorImpresiones
        ? {
            id: mejorImpresiones.id,
            fecha: mejorImpresiones.created_at,
            texto: mejorImpresiones.text,
            impresiones: mejorImpresiones.public_metrics?.impression_count || 0,
            metricas: mejorImpresiones.public_metrics
          }
        : null
  };
}

const personas = datos.map(procesarPersona);

const rankings = {
  por_interacciones: [...personas].sort((a, b) => b.interacciones - a.interacciones),
  por_impresiones: [...personas].sort((a, b) => b.impresiones - a.impresiones),
  por_seguidores: [...personas].sort((a, b) => b.seguidores - a.seguidores),
  por_engagement: [...personas].sort(
    (a, b) => b.engagement_sobre_impresiones - a.engagement_sobre_impresiones
  ),
  por_actividad: [...personas].sort(
    (a, b) => b.total_publicaciones - a.total_publicaciones
  )
};

const salida = {
  generado_en: new Date().toISOString(),
  lider_joven_conversacion: rankings.por_interacciones[0] || null,
  personas,
  rankings
};

fs.writeFileSync(
  "data/personas_resumen.json",
  JSON.stringify(salida, null, 2),
  "utf8"
);

console.log("\n==============================");
console.log("PERSONAS: DATOS PROCESADOS");
console.log("==============================\n");

for (const persona of rankings.por_interacciones) {
  console.log(
    `@${persona.username} — ${persona.interacciones.toLocaleString("es-ES")} interacciones`
  );
}

if (salida.lider_joven_conversacion) {
  console.log(
    `\nLÍDER JOVEN: ${salida.lider_joven_conversacion.nombre} (@${salida.lider_joven_conversacion.username})`
  );
}
