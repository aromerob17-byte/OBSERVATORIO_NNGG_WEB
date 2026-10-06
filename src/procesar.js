const fs = require("fs");

const datos = JSON.parse(
  fs.readFileSync("data/datos.json", "utf8")
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

function procesarCuenta(cuenta) {
  const tweets = cuenta.tweets || [];

  const publicacionesPropias = tweets.filter(
    tweet => !tweet.text.startsWith("RT @")
  );

  const retweets = tweets.filter(
    tweet => tweet.text.startsWith("RT @")
  );

  const metricas = sumarMetricas(tweets);

  const totalInteracciones =
    metricas.likes +
    metricas.reposts +
    metricas.respuestas +
    metricas.citas;

  const mejorInteracciones =
    tweets.length > 0
      ? [...tweets].sort(
          (a, b) => interacciones(b) - interacciones(a)
        )[0]
      : null;

  const mejorImpresiones =
    tweets.length > 0
      ? [...tweets].sort(
          (a, b) =>
            numero(b.public_metrics?.impression_count) -
            numero(a.public_metrics?.impression_count)
        )[0]
      : null;

  const totalPublicaciones = tweets.length;

  return {
    nombre: cuenta.nombre_organizacion,

    username: cuenta.usuario.username,

    seguidores:
      cuenta.usuario.metrics?.followers_count || 0,

    siguiendo:
      cuenta.usuario.metrics?.following_count || 0,

    total_publicaciones: totalPublicaciones,

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
      totalPublicaciones > 0
        ? totalInteracciones / totalPublicaciones
        : 0,

    impresiones_por_publicacion:
      totalPublicaciones > 0
        ? metricas.impresiones / totalPublicaciones
        : 0,

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
            impresiones:
              mejorImpresiones.public_metrics?.impression_count || 0,
            metricas: mejorImpresiones.public_metrics
          }
        : null
  };
}

const resumen = datos.map(procesarCuenta);

const rankings = {
  por_impresiones: [...resumen].sort(
    (a, b) => b.impresiones - a.impresiones
  ),

  por_interacciones: [...resumen].sort(
    (a, b) => b.interacciones - a.interacciones
  ),

  por_seguidores: [...resumen].sort(
    (a, b) => b.seguidores - a.seguidores
  ),

  por_engagement: [...resumen].sort(
    (a, b) =>
      b.engagement_sobre_impresiones -
      a.engagement_sobre_impresiones
  ),

  por_actividad: [...resumen].sort(
    (a, b) =>
      b.total_publicaciones -
      a.total_publicaciones
  )
};

const salida = {
  generado_en: new Date().toISOString(),
  organizaciones: resumen,
  rankings
};

fs.writeFileSync(
  "data/resumen.json",
  JSON.stringify(salida, null, 2),
  "utf8"
);

console.log("\n==============================");
console.log("DATOS PROCESADOS");
console.log("==============================\n");

for (const cuenta of resumen) {
  console.log(`@${cuenta.username}`);
  console.log(`  Publicaciones: ${cuenta.total_publicaciones}`);
  console.log(`  Impresiones: ${cuenta.impresiones.toLocaleString("es-ES")}`);
  console.log(`  Interacciones: ${cuenta.interacciones.toLocaleString("es-ES")}`);
  console.log(
    `  Engagement: ${cuenta.engagement_sobre_impresiones.toFixed(2)}%`
  );
  console.log("");
}

console.log("Resultado guardado en data\\resumen.json");