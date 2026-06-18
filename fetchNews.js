// ===========================================================================
// fetchNews.js
// Busca noticias de los 7 ejes usando NewsAPI o GNews (configurable) y, ademas,
// lee feeds RSS de medios locales. Devuelve una lista limpia y sin duplicados.
// ===========================================================================

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import Parser from "rss-parser";

const __dirname = dirname(fileURLToPath(import.meta.url));
const RAIZ = join(__dirname, "..");

// --- Feeds RSS de medios locales (editables) -------------------------------
// Si alguno deja de funcionar, el codigo lo salta sin romperse.
const FEEDS_RSS = [
  { fuente: "Zeta Tijuana", url: "https://zetatijuana.com/feed/" },
  { fuente: "AFN Tijuana", url: "https://afntijuana.info/feed/" },
  { fuente: "El Imparcial", url: "https://www.elimparcial.com/rss/feed.xml" },
  { fuente: "Industrial News BC", url: "https://industrialnews.com.mx/feed/" }
];

// Palabras que deben aparecer (en titulo o descripcion) para que una nota de
// RSS se considere de la region. Reduce ruido y costo de IA.
const PALABRAS_REGION = [
  "mexicali", "tijuana", "baja california", "ensenada", "tecate",
  "valle de mexicali", "rosarito", "nearshoring", "maquiladora"
];

const HACE_7_DIAS = () => {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return d;
};

// --- Utilidades -------------------------------------------------------------

// Normaliza un titulo para comparar similitud (minusculas, sin acentos/signos).
function normalizarTitulo(texto = "") {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Indica si dos titulos son demasiado parecidos (comparten muchas palabras).
function tituloSimilar(a, b) {
  const pa = new Set(normalizarTitulo(a).split(" ").filter((w) => w.length > 3));
  const pb = new Set(normalizarTitulo(b).split(" ").filter((w) => w.length > 3));
  if (pa.size === 0 || pb.size === 0) return false;
  let comunes = 0;
  for (const w of pa) if (pb.has(w)) comunes++;
  const menor = Math.min(pa.size, pb.size);
  return comunes / menor >= 0.7; // 70% de palabras en comun = duplicado
}

// Espera (para reintentos suaves entre llamadas a las APIs).
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

// --- Proveedores de noticias (API) -----------------------------------------

async function buscarEnNewsAPI(termino, apiKey) {
  const desde = HACE_7_DIAS().toISOString().slice(0, 10);
  const url = new URL("https://newsapi.org/v2/everything");
  url.searchParams.set("q", termino);
  url.searchParams.set("language", "es");
  url.searchParams.set("from", desde);
  url.searchParams.set("sortBy", "publishedAt");
  url.searchParams.set("pageSize", "10");
  url.searchParams.set("apiKey", apiKey);

  const res = await fetch(url, { headers: { "User-Agent": "AvanceInstitucional/1.0" } });
  if (!res.ok) throw new Error(`NewsAPI ${res.status}`);
  const data = await res.json();
  return (data.articles || []).map((a) => ({
    titulo: a.title || "",
    url: a.url || "",
    fuente: a.source?.name || "NewsAPI",
    fecha: a.publishedAt || "",
    descripcion: a.description || ""
  }));
}

async function buscarEnGNews(termino, apiKey) {
  const desde = HACE_7_DIAS().toISOString();
  const url = new URL("https://gnews.io/api/v4/search");
  url.searchParams.set("q", termino);
  url.searchParams.set("lang", "es");
  url.searchParams.set("country", "mx");
  url.searchParams.set("from", desde);
  url.searchParams.set("max", "10");
  url.searchParams.set("apikey", apiKey);

  const res = await fetch(url);
  if (!res.ok) throw new Error(`GNews ${res.status}`);
  const data = await res.json();
  return (data.articles || []).map((a) => ({
    titulo: a.title || "",
    url: a.url || "",
    fuente: a.source?.name || "GNews",
    fecha: a.publishedAt || "",
    descripcion: a.description || ""
  }));
}

// Elige el proveedor segun NEWS_PROVIDER, con respaldo automatico.
async function buscarTermino(termino) {
  const provider = (process.env.NEWS_PROVIDER || "newsapi").toLowerCase();
  const newsKey = process.env.NEWS_API_KEY;
  const gnewsKey = process.env.GNEWS_API_KEY;

  const intentos = provider === "gnews"
    ? [["gnews", gnewsKey], ["newsapi", newsKey]]
    : [["newsapi", newsKey], ["gnews", gnewsKey]];

  for (const [nombre, key] of intentos) {
    if (!key) continue;
    try {
      return nombre === "gnews"
        ? await buscarEnGNews(termino, key)
        : await buscarEnNewsAPI(termino, key);
    } catch (e) {
      console.warn(`  ! ${nombre} fallo para "${termino}": ${e.message}`);
    }
  }
  return [];
}

// --- Lectura de RSS ---------------------------------------------------------

async function leerRSS() {
  const parser = new Parser({ timeout: 15000 });
  const limite = HACE_7_DIAS();
  const resultados = [];

  for (const feed of FEEDS_RSS) {
    try {
      const data = await parser.parseURL(feed.url);
      for (const item of data.items || []) {
        const fecha = item.isoDate || item.pubDate || "";
        if (fecha && new Date(fecha) < limite) continue; // solo ultimos 7 dias

        const texto = `${item.title || ""} ${item.contentSnippet || item.content || ""}`.toLowerCase();
        const esRegion = PALABRAS_REGION.some((p) => texto.includes(p));
        if (!esRegion) continue; // descarta lo que no es de la region

        resultados.push({
          titulo: item.title || "",
          url: item.link || "",
          fuente: feed.fuente,
          fecha,
          descripcion: (item.contentSnippet || "").slice(0, 300)
        });
      }
      console.log(`  RSS ${feed.fuente}: ${data.items?.length || 0} items leidos`);
    } catch (e) {
      console.warn(`  ! RSS ${feed.fuente} no disponible: ${e.message}`);
    }
  }
  return resultados;
}

// --- Funcion principal ------------------------------------------------------

export async function fetchNews() {
  const queries = JSON.parse(await readFile(join(RAIZ, "data", "queries.json"), "utf-8"));

  let crudas = [];

  // 1) Busqueda por API en cada termino de cada eje.
  for (const [eje, terminos] of Object.entries(queries)) {
    for (const termino of terminos) {
      const notas = await buscarTermino(termino);
      console.log(`  [${eje}] "${termino}" -> ${notas.length} notas`);
      crudas.push(...notas);
      await dormir(300); // respeta los limites de las APIs
    }
  }

  // 2) Lectura de RSS de medios locales.
  console.log("  Leyendo feeds RSS locales...");
  crudas.push(...(await leerRSS()));

  // 3) Filtro: en espanol, ultimos 7 dias, con url y titulo.
  const limite = HACE_7_DIAS();
  crudas = crudas.filter((n) => {
    if (!n.url || !n.titulo) return false;
    if (n.fecha && new Date(n.fecha) < limite) return false;
    return true;
  });

  // 4) Deduplicado por URL y por titulo similar.
  const unicas = [];
  const urlsVistas = new Set();
  for (const nota of crudas) {
    if (urlsVistas.has(nota.url)) continue;
    if (unicas.some((u) => tituloSimilar(u.titulo, nota.titulo))) continue;
    urlsVistas.add(nota.url);
    unicas.push(nota);
  }

  console.log(`  Total notas unicas: ${unicas.length}`);
  return unicas;
}
