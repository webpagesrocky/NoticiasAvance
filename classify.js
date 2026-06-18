// ===========================================================================
// classify.js
// Manda las noticias a la API de Anthropic (Claude) EN LOTES (varias por
// mensaje) y recibe un JSON con: eje, semaforo (verde/amarillo/rojo),
// relevante y un resumen ejecutivo de cada una.
// Descarta lo que no sea de Mexicali/Tijuana/Baja California o no sea relevante.
// ===========================================================================

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const RAIZ = join(__dirname, "..");

// --- Modelo de IA (constante editable) -------------------------------------
// claude-sonnet-4-6  -> equilibrio calidad/precio (recomendado)
// claude-haiku-4-5-20251001 -> opcion mas barata (ver README)
export const MODELO = "claude-sonnet-4-6";

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const EJES_VALIDOS = [
  "filantropia", "empresas", "inversion",
  "gobierno", "hacienda", "agropecuario", "camaras"
];

// Cuantas noticias se mandan por mensaje a la IA (un solo lote suele bastar).
const TAMANO_LOTE = 25;

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

// Construye el prompt de sistema con los criterios del semaforo.
function construirSystem(semaforo) {
  const n = semaforo.niveles;
  return `Eres un analista de monitoreo de medios para la direccion de una institucion en Mexicali, Baja California, Mexico.
Clasificas noticias sobre inversion, empresas y economia de Mexicali, Tijuana y Baja California.

EJES (elige exactamente uno por noticia):
- filantropia: donativos, fundaciones, responsabilidad social, apoyos a universidades o comunidad.
- empresas: empresas ya instaladas, expansiones, empleo, cierres, perfiles de empresarios/lideres.
- inversion: empresas nuevas, nuevas plantas, inversion extranjera directa, nearshoring, anuncios de inversion.
- gobierno: anuncios de gobierno estatal/municipal, politicas publicas, infraestructura, programas economicos.
- hacienda: finanzas publicas, presupuesto, impuestos, recaudacion, indicadores economicos.
- agropecuario: agricultura, ganaderia y agroindustria del Valle de Mexicali y la region.
- camaras: Coparmex, Canacintra, CCE, index, CANACO y demas organismos del sector privado.

SEMAFORO (elige exactamente uno por noticia):
- verde: ${n.verde.criterio}
- amarillo: ${n.amarillo.criterio}
- rojo: ${n.rojo.criterio}

REGLAS:
- Si la noticia NO es de Mexicali, Tijuana o Baja California, marca "relevante": false.
- El resumen debe ser de 1 a 2 frases en espanol neutro, tono ejecutivo y sobrio (sin sensacionalismo).
- Nunca inventes informacion que no este en el titulo o la descripcion.
- Responde UNICAMENTE con un arreglo JSON valido, sin texto extra y sin bloques de codigo markdown.`;
}

// Quita ```json ... ``` y recorta para parsear de forma segura.
function parsearJSONSeguro(texto) {
  let t = (texto || "").trim();
  if (t.startsWith("```")) {
    t = t.replace(/^```(json)?/i, "").replace(/```$/, "").trim();
  }
  const ini = t.indexOf("[");
  const fin = t.lastIndexOf("]");
  if (ini !== -1 && fin !== -1) t = t.slice(ini, fin + 1);
  return JSON.parse(t);
}

// Hace una llamada a la API con timeout (para no quedarse colgado).
async function fetchConTimeout(url, opciones, ms = 60000) {
  const controlador = new AbortController();
  const id = setTimeout(() => controlador.abort(), ms);
  try {
    return await fetch(url, { ...opciones, signal: controlador.signal });
  } finally {
    clearTimeout(id);
  }
}

// Clasifica un LOTE de noticias con una sola llamada a la API, con reintentos.
async function clasificarLote(lote, system, apiKey, reintentos = 3) {
  // Numeramos las noticias para poder mapear la respuesta de vuelta.
  const listado = lote.map((nota, i) =>
    `#${i}\nTITULO: ${nota.titulo}\nDESCRIPCION: ${nota.descripcion || "(sin descripcion)"}\nFUENTE: ${nota.fuente}`
  ).join("\n\n");

  const userPrompt = `Clasifica estas ${lote.length} noticias. Devuelve SOLO un arreglo JSON, un objeto por noticia, usando el mismo "indice" que te doy:

[{"indice":0,"eje":"filantropia|empresas|inversion|gobierno|hacienda|agropecuario|camaras","semaforo":"verde|amarillo|rojo","relevante":true,"resumen":"1-2 frases ejecutivas"}]

Noticias:
${listado}`;

  for (let intento = 1; intento <= reintentos; intento++) {
    try {
      const res = await fetchConTimeout(ANTHROPIC_URL, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01"
        },
        body: JSON.stringify({
          model: MODELO,
          max_tokens: 4000,
          system,
          messages: [{ role: "user", content: userPrompt }]
        })
      });

      if (res.status === 429 || res.status >= 500) {
        throw new Error(`HTTP ${res.status} (reintentable)`);
      }
      if (!res.ok) {
        const cuerpo = await res.text();
        throw new Error(`HTTP ${res.status}: ${cuerpo.slice(0, 200)}`);
      }

      const data = await res.json();
      const texto = data.content?.[0]?.text || "";
      const arreglo = parsearJSONSeguro(texto);
      if (!Array.isArray(arreglo)) return [];

      const resultados = [];
      for (const obj of arreglo) {
        const idx = Number(obj.indice);
        const nota = lote[idx];
        if (!nota) continue;
        if (!EJES_VALIDOS.includes(obj.eje)) continue;
        if (obj.relevante === false) continue;
        const semaforo = ["verde", "amarillo", "rojo"].includes(obj.semaforo) ? obj.semaforo : "amarillo";
        resultados.push({
          ...nota,
          eje: obj.eje,
          semaforo,
          resumen: (obj.resumen || nota.descripcion || "").trim()
        });
      }
      return resultados;
    } catch (e) {
      console.warn(`  ! Lote fallo (intento ${intento}/${reintentos}): ${e.message}`);
      if (intento < reintentos) await dormir(1500 * intento);
    }
  }
  return []; // si no se pudo clasificar el lote tras los reintentos, se descarta
}

// Clasifica TODAS las notas (en lotes) y las agrupa por eje.
export async function classify(notas) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("Falta ANTHROPIC_API_KEY en el entorno.");

  const semaforo = JSON.parse(await readFile(join(RAIZ, "data", "semaforo.json"), "utf-8"));
  const system = construirSystem(semaforo);

  const porEje = {
    filantropia: [], empresas: [], inversion: [],
    gobierno: [], hacienda: [], agropecuario: [], camaras: []
  };

  // Partimos las noticias en lotes y clasificamos lote por lote.
  for (let inicio = 0; inicio < notas.length; inicio += TAMANO_LOTE) {
    const lote = notas.slice(inicio, inicio + TAMANO_LOTE);
    console.log(`  Clasificando lote ${inicio / TAMANO_LOTE + 1} (${lote.length} noticias)...`);
    const clasificadas = await clasificarLote(lote, system, apiKey);
    for (const nota of clasificadas) {
      porEje[nota.eje].push(nota);
      console.log(`    ${nota.eje} · ${nota.semaforo} · ${nota.titulo.slice(0, 55)}`);
    }
    await dormir(500);
  }

  return porEje;
}
