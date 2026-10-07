const fs = require("fs");

const organizaciones = JSON.parse(fs.readFileSync("data/datos.json", "utf8"));
const personas = JSON.parse(fs.readFileSync("data/personas_datos.json", "utf8"));
const configuracion = JSON.parse(fs.readFileSync("temas_config.json", "utf8"));

function numero(valor) {
  return Number(valor || 0);
}

function normalizar(texto = "") {
  return String(texto)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[^a-z0-9ñç#@_\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function contiene(textoNormalizado, termino) {
  const limpio = normalizar(termino);
  if (!limpio) return false;
  return (" " + textoNormalizado + " ").includes(" " + limpio + " ");
}

function contieneAlguno(post, terminos = []) {
  return terminos.some(termino => contiene(post.normalizado, termino));
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

function metricasTweet(tweet) {
  const m = tweet.public_metrics || {};
  return {
    impresiones: numero(m.impression_count),
    interacciones: interacciones(tweet),
    likes: numero(m.like_count),
    reposts: numero(m.retweet_count),
    respuestas: numero(m.reply_count),
    citas: numero(m.quote_count),
    bookmarks: numero(m.bookmark_count)
  };
}

function publicacionesPropias(cuenta, tipo) {
  return (cuenta.tweets || [])
    .filter(tweet => !(tweet.text || "").startsWith("RT @"))
    .map(tweet => ({
      tipo,
      autor: tipo === "organizaciones"
        ? cuenta.nombre_organizacion
        : cuenta.nombre_persona,
      username: cuenta.usuario?.username || "",
      avatar: cuenta.usuario?.profile_image_url || "",
      id: tweet.id,
      fecha: tweet.created_at,
      texto: tweet.text || "",
      normalizado: normalizar(tweet.text || ""),
      metricas: metricasTweet(tweet)
    }));
}

const posts = [
  ...organizaciones.flatMap(cuenta => publicacionesPropias(cuenta, "organizaciones")),
  ...personas.flatMap(cuenta => publicacionesPropias(cuenta, "personas"))
];

const temasBase = (configuracion.temas || []).map(tema => ({
  ...tema,
  tipo: "estable"
}));

const entidades = (configuracion.entidades || []).map(tema => ({
  ...tema,
  tipo: "estable",
  familia: "entidad"
}));

function coincideTema(post, tema) {
  const porKeyword = (tema.keywords || []).some(keyword =>
    contiene(post.normalizado, keyword)
  );

  if (porKeyword) return true;

  return (tema.substrings || []).some(fragmento => {
    const limpio = normalizar(fragmento);
    return limpio && post.normalizado.includes(limpio);
  });
}

const bloques = Object.fromEntries(
  Object.entries(configuracion.bloques || {}).map(([nombre, usuarios]) => [
    nombre,
    new Set((usuarios || []).map(usuario => String(usuario).toLowerCase()))
  ])
);

function pertenece(post, bloque) {
  return bloques[bloque]?.has(String(post.username || "").toLowerCase()) || false;
}

const catalanNeutral = [
  "independencia","independentisme","independentismo","independentista","independentistas","sobiranisme","soberanismo",
  "paisos catalans","països catalans","proces","procés","secesion","secesión",
  "puigdemont","amnistia","amnistía","exilio","exili"
];

const catalanFavor = [
  "independencia","independentisme","independentista","independentistas","sobiranisme","paisos catalans","països catalans",
  "catalans lliures","catalunya lliure","retorn president","retorno president",
  "causa de la catalanitat","causa de la catalanidad"
];

const catalanContra = [
  "separatismo","separatista","separatistas","golpista","golpistas",
  "puigdemont es un delincuente","puigdemont delincuente",
  "traicion de puigdemont","traición de puigdemont",
  "amnistiar a puigdemont","fugado","profugo","prófugo"
];

function nacionalismoCatalanContra(post) {
  if (contieneAlguno(post, catalanContra)) return true;

  return (
    pertenece(post, "derecha") &&
    contieneAlguno(post, catalanNeutral) &&
    contieneAlguno(post, [
      "traicion","traición","delincuente","prision","prisión","ilegal",
      "romper españa","romper espana","antiespañol","antiespanol"
    ])
  );
}

function nacionalismoCatalanFavor(post) {
  if (nacionalismoCatalanContra(post)) return false;
  if (contieneAlguno(post, catalanFavor)) return true;

  return (
    pertenece(post, "catalanista") &&
    contieneAlguno(post, catalanNeutral)
  );
}

const espanolFavor = [
  "viva espana","viva españa","espana o","españa o","por espana","por españa",
  "defender espana","defender españa","defender nuestra soberania",
  "defender nuestra soberanía","reconstruccion nacional","reconstrucción nacional",
  "patria","antiespanol","antiespañol","traicion a espana","traición a españa",
  "espana es y sera","españa es y será"
];

const espanolContraDirecto = [
  "regimen del 78","régimen del 78","trencar amb l estat espanyol",
  "trencar amb el estat espanyol","romper con el estado espanol",
  "romper con el estado español","estado espanol irreformable",
  "estado español irreformable","estat irreformable"
];

function nacionalismoEspanolFavor(post) {
  if (contieneAlguno(post, espanolFavor)) return true;
  if ((post.texto || "").includes("🇪🇸")) return true;

  return (
    pertenece(post, "derecha") &&
    contieneAlguno(post, ["espana","españa"]) &&
    contieneAlguno(post, [
      "defender","soberania","soberanía","patria","nacion","nación",
      "traicion","traición","reconstruccion","reconstrucción"
    ])
  );
}

function nacionalismoEspanolContra(post) {
  if (contieneAlguno(post, espanolContraDirecto)) return true;

  return (
    pertenece(post, "catalanista") &&
    contieneAlguno(post, ["estat espanyol","estado espanol","estado español"]) &&
    contieneAlguno(post, ["trencar","romper","irreformable","regimen","régimen"])
  );
}

const reglas = configuracion.reglas || {};

function agitacionDirecta(post) {
  return contieneAlguno(post, reglas.agitacion || []);
}

function agitacionFallback(post, temasSustantivos) {
  const texto = (post.texto || "").trim();

  if (temasSustantivos > 0) return false;
  if (!texto || texto.startsWith("@")) return false;
  if (normalizar(texto).length < 8) return false;

  return contieneAlguno(post, reglas.agitacion_fallback || []);
}

const especiales = [
  { id: "agitacion_izquierda", nombre: "Agitación de Izquierda", tipo: "estable" },
  { id: "agitacion_derecha", nombre: "Agitación de Derecha", tipo: "estable" },
  { id: "nac_cat_favor", nombre: "Nacionalismo catalán (favorable)", tipo: "estable" },
  { id: "nac_cat_contra", nombre: "Nacionalismo catalán (en contra)", tipo: "estable" },
  { id: "nac_esp_favor", nombre: "Nacionalismo Español (favorable)", tipo: "estable" },
  { id: "nac_esp_contra", nombre: "Nacionalismo Español (en contra)", tipo: "estable" }
];

function hashtagsDe(post) {
  return [...(post.texto || "").matchAll(/#([A-Za-zÀ-ÿ0-9_]+)/g)]
    .map(match => normalizar(match[1].replace(/_/g, " ")))
    .filter(Boolean);
}

function candidatosEmergentes() {
  const mapa = new Map();
  const ignorados = new Set(
    (reglas.hashtags_ignorados || []).map(normalizar)
  );

  for (const post of posts) {
    for (const hashtag of new Set(hashtagsDe(post))) {
      if (hashtag.length < 5) continue;
      if (ignorados.has(hashtag)) continue;
      if (/^\d+$/.test(hashtag)) continue;

      let item = mapa.get(hashtag);

      if (!item) {
        item = {
          clave: hashtag,
          posts: new Set(),
          autores: new Set(),
          interacciones: 0
        };
        mapa.set(hashtag, item);
      }

      item.posts.add(post.username.toLowerCase() + ":" + post.id);
      item.autores.add(post.username.toLowerCase());
      item.interacciones += post.metricas.interacciones;
    }
  }

  const lexiconBase = new Set();

  for (const tema of [...temasBase, ...entidades]) {
    for (const keyword of tema.keywords || []) {
      lexiconBase.add(normalizar(keyword));
    }
  }

  return [...mapa.values()]
    .filter(item =>
      item.posts.size >= 2 &&
      item.autores.size >= 2 &&
      !lexiconBase.has(item.clave)
    )
    .map(item => ({
      ...item,
      score:
        item.posts.size * 5 +
        item.autores.size * 4 +
        Math.log10(item.interacciones + 10)
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 6)
    .map((item, indice) => ({
      id: "emergente_" + (indice + 1),
      nombre: item.clave
        .split(" ")
        .map(p => p.charAt(0).toUpperCase() + p.slice(1))
        .join(" "),
      clave: item.clave,
      tipo: "emergente"
    }));
}

const emergentes = candidatosEmergentes();
const temas = [...especiales, ...temasBase, ...entidades, ...emergentes];
const clasificaciones = new Map();

function clavePost(post) {
  return post.tipo + ":" + post.username + ":" + post.id;
}

for (const post of posts) {
  const ids = new Set();
  let temasSustantivos = 0;

  for (const tema of temasBase) {
    if (coincideTema(post, tema)) {
      ids.add(tema.id);
      temasSustantivos += 1;
    }
  }

  for (const entidad of entidades) {
    if (coincideTema(post, entidad)) {
      ids.add(entidad.id);
    }
  }

  if (
    ids.has("fondos_buitre") ||
    ids.has("desahucios") ||
    ids.has("okupacion") ||
    ids.has("maricarmen")
  ) {
    ids.add("vivienda");
  }

  if (ids.has("apagon")) {
    ids.add("energia_clima");
  }

  if (nacionalismoCatalanFavor(post)) ids.add("nac_cat_favor");
  if (nacionalismoCatalanContra(post)) ids.add("nac_cat_contra");
  if (nacionalismoEspanolFavor(post)) ids.add("nac_esp_favor");
  if (nacionalismoEspanolContra(post)) ids.add("nac_esp_contra");

  const hayAgitacion =
    agitacionDirecta(post) ||
    agitacionFallback(post, temasSustantivos);

  if (hayAgitacion && pertenece(post, "izquierda")) {
    ids.add("agitacion_izquierda");
  }

  if (hayAgitacion && pertenece(post, "derecha")) {
    ids.add("agitacion_derecha");
  }

  const hashtags = new Set(hashtagsDe(post));

  for (const emergente of emergentes) {
    if (hashtags.has(emergente.clave)) {
      ids.add(emergente.id);
    }
  }

  clasificaciones.set(clavePost(post), ids);
}

function crearAcumulador() {
  return {
    tweets: 0,
    impresiones: 0,
    interacciones: 0,
    likes: 0,
    reposts: 0,
    respuestas: 0,
    citas: 0,
    bookmarks: 0,
    autores: new Set()
  };
}

function sumarPost(acumulador, post) {
  acumulador.tweets += 1;
  acumulador.impresiones += post.metricas.impresiones;
  acumulador.interacciones += post.metricas.interacciones;
  acumulador.likes += post.metricas.likes;
  acumulador.reposts += post.metricas.reposts;
  acumulador.respuestas += post.metricas.respuestas;
  acumulador.citas += post.metricas.citas;
  acumulador.bookmarks += post.metricas.bookmarks;
  acumulador.autores.add(post.username.toLowerCase());
}

function serializarAcumulador(acumulador) {
  return {
    tweets: acumulador.tweets,
    impresiones: acumulador.impresiones,
    interacciones: acumulador.interacciones,
    likes: acumulador.likes,
    reposts: acumulador.reposts,
    respuestas: acumulador.respuestas,
    citas: acumulador.citas,
    bookmarks: acumulador.bookmarks,
    autores: acumulador.autores.size,
    interacciones_por_tweet:
      acumulador.tweets > 0
        ? acumulador.interacciones / acumulador.tweets
        : 0,
    impresiones_por_tweet:
      acumulador.tweets > 0
        ? acumulador.impresiones / acumulador.tweets
        : 0,
    engagement:
      acumulador.impresiones > 0
        ? (acumulador.interacciones / acumulador.impresiones) * 100
        : 0
  };
}

function procesarTema(tema) {
  const total = crearAcumulador();
  const organizacionesAcc = crearAcumulador();
  const personasAcc = crearAcumulador();
  const autores = new Map();
  const ejemplos = [];

  for (const post of posts) {
    if (!clasificaciones.get(clavePost(post))?.has(tema.id)) continue;

    sumarPost(total, post);
    sumarPost(
      post.tipo === "organizaciones" ? organizacionesAcc : personasAcc,
      post
    );

    const claveAutor = post.tipo + ":" + post.username.toLowerCase();

    if (!autores.has(claveAutor)) {
      autores.set(claveAutor, {
        nombre: post.autor,
        username: post.username,
        tipo: post.tipo,
        tweets: 0,
        interacciones: 0,
        impresiones: 0
      });
    }

    const autor = autores.get(claveAutor);
    autor.tweets += 1;
    autor.interacciones += post.metricas.interacciones;
    autor.impresiones += post.metricas.impresiones;

    ejemplos.push({
      id: post.id,
      autor: post.autor,
      username: post.username,
      tipo: post.tipo,
      fecha: post.fecha,
      texto: post.texto,
      interacciones: post.metricas.interacciones,
      impresiones: post.metricas.impresiones
    });
  }

  return {
    id: tema.id,
    nombre: tema.nombre,
    tipo: tema.tipo,
    total: serializarAcumulador(total),
    organizaciones: serializarAcumulador(organizacionesAcc),
    personas: serializarAcumulador(personasAcc),
    autores: [...autores.values()]
      .sort((a, b) =>
        b.interacciones - a.interacciones ||
        b.impresiones - a.impresiones
      ),
    ejemplos: ejemplos
      .sort((a, b) =>
        b.interacciones - a.interacciones ||
        b.impresiones - a.impresiones
      )
      .slice(0, 6)
  };
}

const temasProcesados = temas
  .map(procesarTema)
  .filter(tema => tema.total.tweets > 0)
  .sort((a, b) =>
    b.total.interacciones - a.total.interacciones ||
    b.total.impresiones - a.total.impresiones
  );

const publicacionesClasificadas = posts.filter(post =>
  (clasificaciones.get(clavePost(post))?.size || 0) > 0
).length;

const emergentesActivos = temasProcesados.filter(
  tema => tema.tipo === "emergente"
).length;

const salida = {
  generado_en: new Date().toISOString(),
  version_clasificador: 2,
  metodologia: "Reglas temáticas estables + entidades + orientación explícita + agitación por fuente + hashtags emergentes validados.",
  resumen: {
    publicaciones_analizadas: posts.length,
    publicaciones_clasificadas: publicacionesClasificadas,
    cobertura:
      posts.length > 0
        ? (publicacionesClasificadas / posts.length) * 100
        : 0,
    temas_activos: temasProcesados.length,
    temas_emergentes: emergentesActivos
  },
  temas: temasProcesados
};

fs.writeFileSync(
  "data/temas.json",
  JSON.stringify(salida, null, 2),
  "utf8"
);

console.log("");
console.log("==============================");
console.log("ANÁLISIS TEMÁTICO V2");
console.log("==============================");
console.log("Posts analizados: " + salida.resumen.publicaciones_analizadas);
console.log("Posts clasificados: " + salida.resumen.publicaciones_clasificadas);
console.log("Cobertura: " + salida.resumen.cobertura.toFixed(2) + "%");
console.log("Temas activos: " + salida.resumen.temas_activos);
console.log("Emergentes: " + salida.resumen.temas_emergentes);
console.log("Resultado guardado en data/temas.json");
