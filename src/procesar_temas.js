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
      autor: tipo === "organizaciones" ? cuenta.nombre_organizacion : cuenta.nombre_persona,
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

function contiene(texto, termino) {
  const limpio = normalizar(termino);
  if (!limpio) return false;
  return (" " + texto + " ").includes(" " + limpio + " ");
}

function coincideTema(post, tema) {
  return (tema.keywords || []).some(keyword => contiene(post.normalizado, keyword));
}

const actoresPoliticos = [
  "sanchez","pedro sanchez","psoe","feijoo","nunez feijoo",
  "vox","abascal","sumar","podemos","yolanda diaz","erc","junts",
  "illa","ayuso","puente","montero","gobierno","govern"
];

const lenguajeChoque = [
  "mentira","mentiroso","mentirosa","corrupto","corrupta","corrupcion",
  "ruina","desastre","verguenza","fracaso","incompetente","dimision",
  "sanchismo","traicion","destruir","hundir","escandalo","mafia",
  "chantaje","radical","comunismo","fascista","facha","ultra","inutil"
];

function esChoquePolitico(post) {
  const hayActor = actoresPoliticos.some(x => contiene(post.normalizado, x));
  const hayAtaque = lenguajeChoque.some(x => contiene(post.normalizado, x));
  return hayActor && hayAtaque;
}

const stopwords = new Set([
  "para","pero","porque","como","desde","hasta","entre","sobre","tras","ante",
  "este","esta","estos","estas","esto","ese","esa","esos","esas","aquel","aquella",
  "aqui","alli","ahi","cada","todo","toda","todos","todas","mucho","mucha",
  "muy","mas","menos","tambien","solo","hoy","ayer","manana","ahora","mismo",
  "hemos","han","hay","ser","son","somos","sera","estan","estamos",
  "con","sin","por","del","las","los","una","uno","unos","unas","que","quien",
  "cual","cuando","donde","como","y","o","e","u","a","de","la","el","en","un",
  "al","se","su","sus","ya","nos","os","me","mi","tu","te","es","ha","he",
  "lo","le","les","si","no","ni","pues","aixo","amb","per","els","les",
  "una","uns","unes","del","dels","pel","pels","que","qui","quan","on","com",
  "avui","ahir","dema","ara","molt","mes","menys","tambe","sense",
  "govern","gobierno","politica","politico","partido","partits",
  "espana","catalunya","campana","elecciones","eleccions",
  "joven","jovenes","jove","joves","joventut","twitter","video","foto"
]);

function tokensSignificativos(texto) {
  return normalizar(texto)
    .replace(/[#@_]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .filter(token => token.length >= 4)
    .filter(token => !stopwords.has(token))
    .filter(token => !/^\d+$/.test(token));
}

function capitalizarFrase(frase) {
  const acronimos = new Map([
    ["psoe","PSOE"],["vox","VOX"],["erc","ERC"],["otan","OTAN"],
    ["nngg","NNGG"],["jse","JSE"],["jnc","JNC"]
  ]);

  return frase
    .split(" ")
    .map(palabra =>
      acronimos.get(palabra) ||
      palabra.charAt(0).toUpperCase() + palabra.slice(1)
    )
    .join(" ");
}

function candidatosEmergentes() {
  const mapa = new Map();

  function registrar(clave, post, bonus = 0) {
    if (!clave || clave.length < 7) return;

    let item = mapa.get(clave);

    if (!item) {
      item = {
        clave,
        posts: new Set(),
        autores: new Set(),
        interacciones: 0,
        bonus: 0
      };
      mapa.set(clave, item);
    }

    item.posts.add(post.username + ":" + post.id);
    item.autores.add(post.username.toLowerCase());
    item.interacciones += post.metricas.interacciones;
    item.bonus += bonus;
  }

  for (const post of posts) {
    const hashtags = [
      ...(post.texto.matchAll(/#([A-Za-zÀ-ÿ0-9_]+)/g))
    ].map(match => normalizar(match[1].replace(/_/g, " ")));

    for (const hashtag of hashtags) {
      if (hashtag.length >= 5) registrar(hashtag, post, 3);
    }

    const tokens = tokensSignificativos(post.texto);

    for (let longitud = 2; longitud <= 3; longitud++) {
      for (let i = 0; i <= tokens.length - longitud; i++) {
        const frase = tokens.slice(i, i + longitud).join(" ");

        if (frase.split(" ").every(token => token.length < 5)) continue;

        registrar(frase, post, 0);
      }
    }
  }

  const lexiconBase = new Set();

  for (const tema of configuracion.temas || []) {
    for (const keyword of tema.keywords || []) {
      for (const token of tokensSignificativos(keyword)) {
        lexiconBase.add(token);
      }
    }
  }

  const candidatos = [...mapa.values()]
    .filter(item => {
      const apariciones = item.posts.size;
      const autores = item.autores.size;

      if (!(apariciones >= 3 || (apariciones >= 2 && autores >= 2))) {
        return false;
      }

      const partes = item.clave.split(" ");

      if (partes.every(token => lexiconBase.has(token))) {
        return false;
      }

      return true;
    })
    .map(item => ({
      ...item,
      score:
        item.posts.size * 4 +
        item.autores.size * 3 +
        Math.log10(item.interacciones + 10) +
        item.bonus
    }))
    .sort((a, b) => b.score - a.score);

  const elegidos = [];

  for (const candidato of candidatos) {
    const tokens = new Set(candidato.clave.split(" "));

    const duplicado = elegidos.some(otro => {
      const otrosTokens = new Set(otro.clave.split(" "));
      const interseccion = [...tokens].filter(t => otrosTokens.has(t)).length;
      const union = new Set([...tokens, ...otrosTokens]).size;
      const similitud = union ? interseccion / union : 0;

      return (
        similitud >= 0.6 ||
        candidato.clave.includes(otro.clave) ||
        otro.clave.includes(candidato.clave)
      );
    });

    if (!duplicado) elegidos.push(candidato);
    if (elegidos.length >= 8) break;
  }

  return elegidos.map((item, indice) => ({
    id: "emergente_" + (indice + 1),
    nombre: capitalizarFrase(item.clave),
    clave: item.clave,
    tipo: "emergente"
  }));
}

const temasBase = (configuracion.temas || []).map(tema => ({
  ...tema,
  tipo: "estable"
}));

const temaChoque = {
  id: "choque_politico",
  nombre: "Choque político y ataques",
  tipo: "estable",
  especial: true
};

const emergentes = candidatosEmergentes();
const temas = [temaChoque, ...temasBase, ...emergentes];

function temaDePost(post, tema) {
  if (tema.id === "choque_politico") {
    return esChoquePolitico(post);
  }

  if (tema.tipo === "emergente") {
    const secuencia = tokensSignificativos(post.texto).join(" ");
    return secuencia.includes(tema.clave);
  }

  return coincideTema(post, tema);
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

const resultadoTemas = [];
const postsClasificados = new Set();

for (const tema of temas) {
  const total = crearAcumulador();
  const org = crearAcumulador();
  const personasAcum = crearAcumulador();
  const autores = new Map();
  const ejemplos = [];

  for (const post of posts) {
    if (!temaDePost(post, tema)) continue;

    postsClasificados.add(post.tipo + ":" + post.username + ":" + post.id);
    sumarPost(total, post);

    if (post.tipo === "organizaciones") {
      sumarPost(org, post);
    } else {
      sumarPost(personasAcum, post);
    }

    const key = post.username.toLowerCase();
    const autor = autores.get(key) || {
      nombre: post.autor,
      username: post.username,
      tipo: post.tipo,
      tweets: 0,
      interacciones: 0,
      impresiones: 0
    };

    autor.tweets += 1;
    autor.interacciones += post.metricas.interacciones;
    autor.impresiones += post.metricas.impresiones;
    autores.set(key, autor);

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

  if (total.tweets === 0) continue;

  resultadoTemas.push({
    id: tema.id,
    nombre: tema.nombre,
    tipo: tema.tipo,
    total: serializarAcumulador(total),
    organizaciones: serializarAcumulador(org),
    personas: serializarAcumulador(personasAcum),
    autores: [...autores.values()]
      .sort((a, b) => b.interacciones - a.interacciones)
      .slice(0, 8),
    ejemplos: ejemplos
      .sort((a, b) => b.interacciones - a.interacciones)
      .slice(0, 4)
  });
}

resultadoTemas.sort(
  (a, b) => b.total.interacciones - a.total.interacciones
);

const salida = {
  generado_en: new Date().toISOString(),
  metodologia: {
    coste: "0",
    modelo_externo: false,
    multietiqueta: true,
    descripcion:
      "Clasificación local basada en vocabularios temáticos, reglas y detección automática de expresiones repetidas. Los retuits se excluyen del análisis temático."
  },
  resumen: {
    publicaciones_analizadas: posts.length,
    publicaciones_clasificadas: postsClasificados.size,
    cobertura:
      posts.length > 0
        ? (postsClasificados.size / posts.length) * 100
        : 0,
    temas_activos: resultadoTemas.length,
    temas_emergentes: resultadoTemas.filter(
      tema => tema.tipo === "emergente"
    ).length
  },
  temas: resultadoTemas
};

fs.writeFileSync(
  "data/temas.json",
  JSON.stringify(salida, null, 2),
  "utf8"
);

console.log("\n==============================");
console.log("ANÁLISIS TEMÁTICO");
console.log("==============================");
console.log("Publicaciones: " + posts.length);
console.log("Clasificadas: " + postsClasificados.size);
console.log("Cobertura: " + salida.resumen.cobertura.toFixed(1) + "%");
console.log("Temas activos: " + resultadoTemas.length);
console.log("Emergentes: " + salida.resumen.temas_emergentes);

for (const tema of resultadoTemas.slice(0, 12)) {
  console.log(
    "  " + tema.nombre + ": " + tema.total.tweets +
    " posts · " + tema.total.interacciones + " interacciones"
  );
}
