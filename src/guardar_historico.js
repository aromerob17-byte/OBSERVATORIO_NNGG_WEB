const fs = require("fs");

const RESUMEN = "data/resumen.json";
const PERSONAS = "data/personas_resumen.json";
const TEMAS = "data/temas.json";
const HISTORICO = "data/historico.json";
const TZ = "Europe/Madrid";

function leer(path, fallback) {
  try {
    return JSON.parse(fs.readFileSync(path, "utf8"));
  } catch (error) {
    return fallback;
  }
}

function n(valor) {
  return Number(valor || 0);
}

function fechaLocal(date = new Date()) {
  const partes = new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);

  const map = Object.fromEntries(
    partes.filter(p => p.type !== "literal").map(p => [p.type, p.value])
  );

  return map.year + "-" + map.month + "-" + map.day;
}

function snapshotCuenta(cuenta) {
  return {
    nombre: cuenta.nombre,
    username: cuenta.username,
    seguidores: n(cuenta.seguidores),
    siguiendo: n(cuenta.siguiendo),
    publicaciones: n(cuenta.total_publicaciones),
    actividad_total: n(cuenta.actividad_total || cuenta.total_publicaciones),
    retweets: n(cuenta.retweets),
    impresiones: n(cuenta.impresiones),
    interacciones: n(cuenta.interacciones),
    likes: n(cuenta.likes),
    reposts: n(cuenta.reposts),
    respuestas: n(cuenta.respuestas),
    citas: n(cuenta.citas),
    bookmarks: n(cuenta.bookmarks),
    interacciones_por_publicacion: n(cuenta.interacciones_por_publicacion),
    impresiones_por_publicacion: n(cuenta.impresiones_por_publicacion),
    engagement: n(cuenta.engagement_sobre_impresiones)
  };
}

function snapshotTema(tema) {
  function bloque(valor) {
    const b = valor || {};
    return {
      tweets: n(b.tweets),
      impresiones: n(b.impresiones),
      interacciones: n(b.interacciones),
      likes: n(b.likes),
      reposts: n(b.reposts),
      respuestas: n(b.respuestas),
      citas: n(b.citas),
      bookmarks: n(b.bookmarks),
      autores: n(b.autores),
      interacciones_por_tweet: n(b.interacciones_por_tweet),
      impresiones_por_tweet: n(b.impresiones_por_tweet),
      engagement: n(b.engagement)
    };
  }

  return {
    id: tema.id,
    nombre: tema.nombre,
    tipo: tema.tipo,
    total: bloque(tema.total),
    organizaciones: bloque(tema.organizaciones),
    personas: bloque(tema.personas)
  };
}

function sumar(cuentas) {
  return (cuentas || []).reduce(
    (acc, cuenta) => {
      acc.seguidores += n(cuenta.seguidores);
      acc.publicaciones += n(cuenta.total_publicaciones);
      acc.actividad_total += n(cuenta.actividad_total || cuenta.total_publicaciones);
      acc.retweets += n(cuenta.retweets);
      acc.impresiones += n(cuenta.impresiones);
      acc.interacciones += n(cuenta.interacciones);
      acc.likes += n(cuenta.likes);
      acc.reposts += n(cuenta.reposts);
      acc.respuestas += n(cuenta.respuestas);
      acc.citas += n(cuenta.citas);
      acc.bookmarks += n(cuenta.bookmarks);
      return acc;
    },
    {
      seguidores: 0,
      publicaciones: 0,
      actividad_total: 0,
      retweets: 0,
      impresiones: 0,
      interacciones: 0,
      likes: 0,
      reposts: 0,
      respuestas: 0,
      citas: 0,
      bookmarks: 0
    }
  );
}

const resumen = leer(RESUMEN, { organizaciones: [] });
const personasResumen = leer(PERSONAS, { personas: [] });
const temas = leer(TEMAS, { temas: [] });

const fecha = fechaLocal();
const generadoEn = new Date().toISOString();

const orgs = resumen.organizaciones || [];
const personas = personasResumen.personas || [];

const orgTotal = sumar(orgs);
const personasTotal = sumar(personas);
const total = {};

for (const clave of Object.keys(orgTotal)) {
  total[clave] = n(orgTotal[clave]) + n(personasTotal[clave]);
}

total.engagement =
  total.impresiones > 0
    ? (total.interacciones / total.impresiones) * 100
    : 0;

const snapshot = {
  fecha,
  generado_en: generadoEn,
  global: {
    organizaciones_monitorizadas: orgs.length,
    personas_monitorizadas: personas.length,
    personas_activas: personas.filter(p => n(p.total_publicaciones) > 0).length,
    temas_activos: (temas.temas || []).length,
    ...total
  },
  organizaciones: orgs.map(snapshotCuenta),
  personas: personas.map(snapshotCuenta),
  temas: (temas.temas || []).map(snapshotTema)
};

const historico = leer(HISTORICO, {
  schema_version: 1,
  timezone: TZ,
  iniciado_en: fecha,
  actualizado_en: generadoEn,
  snapshots: []
});

historico.schema_version = 1;
historico.timezone = TZ;
historico.iniciado_en = historico.iniciado_en || fecha;
historico.actualizado_en = generadoEn;
historico.snapshots = Array.isArray(historico.snapshots)
  ? historico.snapshots
  : [];

const indice = historico.snapshots.findIndex(s => s.fecha === fecha);

if (indice >= 0) {
  historico.snapshots[indice] = snapshot;
} else {
  historico.snapshots.push(snapshot);
}

historico.snapshots.sort((a, b) => a.fecha.localeCompare(b.fecha));

fs.writeFileSync(
  HISTORICO,
  JSON.stringify(historico, null, 2),
  "utf8"
);

console.log("");
console.log("==============================");
console.log("MEMORIA HISTÓRICA");
console.log("==============================");
console.log("Fecha local: " + fecha);
console.log("Snapshots guardados: " + historico.snapshots.length);
console.log("Organizaciones: " + snapshot.global.organizaciones_monitorizadas);
console.log("Personas: " + snapshot.global.personas_monitorizadas);
console.log("Temas: " + snapshot.global.temas_activos);
console.log("Resultado guardado en " + HISTORICO);
