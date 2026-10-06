require("dotenv").config();

const fs = require("fs");

const TOKEN = process.env.X_BEARER_TOKEN;
const personas = JSON.parse(fs.readFileSync("personas.json", "utf8"));

const FECHA_INICIO = new Date("2026-10-04T22:00:00Z");
const HORAS_REFRESCO = 48;

async function pedir(url) {
  const respuesta = await fetch(url, {
    headers: { Authorization: `Bearer ${TOKEN}` }
  });

  if (!respuesta.ok) {
    const error = await respuesta.text();
    throw new Error(`${respuesta.status}: ${error}`);
  }

  return respuesta.json();
}

async function obtenerUsuario(username) {
  const url =
    `https://api.x.com/2/users/by/username/${username}` +
    `?user.fields=created_at,description,location,profile_image_url,public_metrics,verified`;

  return pedir(url);
}

async function obtenerTweets(id, desde) {
  let todos = [];
  let nextToken = null;

  while (true) {
    let url =
      `https://api.x.com/2/users/${id}/tweets` +
      `?max_results=100` +
      `&start_time=${desde.toISOString()}` +
      `&tweet.fields=created_at,public_metrics`;

    if (nextToken) url += `&pagination_token=${nextToken}`;

    const respuesta = await pedir(url);
    if (respuesta.data) todos.push(...respuesta.data);

    nextToken = respuesta.meta?.next_token;
    if (!nextToken) break;
  }

  return todos;
}

function cargarDatosAnteriores() {
  if (!fs.existsSync("data/personas_datos.json")) return [];

  try {
    return JSON.parse(fs.readFileSync("data/personas_datos.json", "utf8"));
  } catch {
    return [];
  }
}

function calcularFechaConsulta(anterior) {
  if (!anterior?.tweets?.length) return FECHA_INICIO;

  const fechas = anterior.tweets
    .map(tweet => new Date(tweet.created_at))
    .filter(fecha => !isNaN(fecha));

  if (!fechas.length) return FECHA_INICIO;

  const ultimaFecha = new Date(
    Math.max(...fechas.map(fecha => fecha.getTime()))
  );

  const refresco = new Date(
    ultimaFecha.getTime() - HORAS_REFRESCO * 60 * 60 * 1000
  );

  return refresco < FECHA_INICIO ? FECHA_INICIO : refresco;
}

function combinarTweets(anteriores, nuevos) {
  const mapa = new Map();

  for (const tweet of anteriores || []) mapa.set(tweet.id, tweet);
  for (const tweet of nuevos || []) mapa.set(tweet.id, tweet);

  return Array.from(mapa.values()).sort(
    (a, b) => new Date(b.created_at) - new Date(a.created_at)
  );
}

async function main() {
  if (!TOKEN) throw new Error("No se ha encontrado X_BEARER_TOKEN");

  const datosAnteriores = cargarDatosAnteriores();
  const resultados = [];
  const errores = [];

  for (const persona of personas) {
    console.log(`\nConsultando @${persona.username}...`);

    try {
      const anterior = datosAnteriores.find(
        p => p.usuario &&
          p.usuario.username.toLowerCase() === persona.username.toLowerCase()
      );

      const respuestaUsuario = await obtenerUsuario(persona.username);

      if (!respuestaUsuario.data) {
        throw new Error("Cuenta no encontrada");
      }

      const usuario = respuestaUsuario.data;
      const desde = calcularFechaConsulta(anterior);
      const tweetsNuevos = await obtenerTweets(usuario.id, desde);
      const tweets = combinarTweets(anterior?.tweets || [], tweetsNuevos);

      console.log(
        `✓ ${persona.nombre} — ${usuario.public_metrics?.followers_count ?? "?"} seguidores — ${tweets.length} publicaciones acumuladas`
      );

      resultados.push({
        nombre_persona: persona.nombre,
        usuario: {
          id: usuario.id,
          name: usuario.name,
          username: usuario.username,
          description: usuario.description || "",
          location: usuario.location || "",
          profile_image_url: usuario.profile_image_url || "",
          verified: usuario.verified || false,
          metrics: usuario.public_metrics || {}
        },
        periodo: {
          desde: FECHA_INICIO.toISOString(),
          recopilado_en: new Date().toISOString()
        },
        total_tweets: tweets.length,
        tweets
      });
    } catch (error) {
      console.log(`✗ Error con @${persona.username}: ${error.message}`);

      errores.push({
        nombre: persona.nombre,
        username: persona.username,
        error: error.message
      });

      const anterior = datosAnteriores.find(
        p => p.usuario &&
          p.usuario.username.toLowerCase() === persona.username.toLowerCase()
      );

      if (anterior) resultados.push(anterior);
    }
  }

  fs.writeFileSync(
    "data/personas_datos.json",
    JSON.stringify(resultados, null, 2),
    "utf8"
  );

  fs.writeFileSync(
    "data/personas_errores.json",
    JSON.stringify(errores, null, 2),
    "utf8"
  );

  console.log("\n==============================");
  console.log("PERSONAS: RECOPILACIÓN TERMINADA");
  console.log("==============================");
  console.log(`Personas: ${resultados.length}`);
  console.log(`Errores: ${errores.length}`);
}

main().catch(error => {
  console.error("\nERROR GENERAL:");
  console.error(error.message);
  process.exitCode = 1;
});
