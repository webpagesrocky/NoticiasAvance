// ===========================================================================
// classify.js
// Por cada noticia llama a la API de Anthropic (Claude) y pide un JSON con:
//   eje, semaforo (verde/amarillo/rojo), relevante y un resumen ejecutivo.
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

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

// Construye el prompt de sistema con los criterios del semaforo.
function construirSystem(semaforo) {
  const n = semaforo.niveles;
  return `Eres un analista de monitoreo de medios para la direccion de una institucion en Mexicali, Baja California, Mexico.
Clasificas noticias sobre inversion, empresas y economia de Mexicali, Tijuana y Baja California.

EJES (elige exactamente uno):
- filantropia: donativos, fundaciones, responsabilidad social, apoyos a universidades o comunidad.
- empresas: empresas ya instaladas, expansiones, empleo, cierres, perfiles de empresarios/lideres.
- inversion: empresas nuevas, nuevas plantas, inversion extranjera directa, nearshoring, anuncios de inversion.
- gobierno: anuncios de gobierno estatal/municipal, politicas publicas, infraestructura, programas economicos.
- hacienda: finanzas publicas, presupuesto, impuestos, recaudacion, indicadores economicos.
- agropecuario: agricultura, ganaderia y agroindustria del Valle de Mexicali y la region.
- camaras: Coparmex, Canacintra, CCE, index, CANACO y demas organismos del sector privado.

SEMAFORO (elige exactamente uno):
- verde: ${n.verde.criterio}
- amarillo: ${n.amarillo.criterio}
- rojo: ${n.rojo.criterio}

REGLAS:
- Si la noticia NO es de Mexicali, Tijuana o Baja California, marca "relevante": false.
- El resumen debe ser de 1 a 2 frases en espanol neutro, tono ejecutivo y sobrio (sin sensacionalismo).
- Nunca inventes informacion que no este en el titulo o la descripcion.
- Responde UNICAMENTE con un objeto JSON valido, sin texto extra y sin bloques de codigo markdown.`;
}

// Quita ```json ... ``` y recorta para parsear de forma segura.
function parsearJSONSeguro(texto) {
  let t = (texto || "").trim();
  if (t.startsWith("```")) {
    t = t.replace(/^```(json)?/i, "").replace(/```$/, "").trim();
  }
  const ini = t.indexOf("{");
  const fin = t.lastIndexOf("}");
  if (ini !== -1 && fin !== -1) t = t.slice(ini, fin + 1);
  return JSON.parse(t);
}

// Llama a la API de Anthropic para UNA nota, con reintentos.
async function clasificarUna(nota, system, apiKey, reintentos = 3) {
  const userPrompt = `Clasifica esta noticia:
TITULO: ${nota.titulo}
DESCRIPCION: ${nota.descripcion || "(sin descripcion)"}
FUENTE: ${nota.fuente}

Devuelve SOLO este JSON:
{"eje":"filantropia|empresas|inversion|gobierno|hacienda|agropecuario|camaras","semaforo":"verde|amarillo|rojo","relevante":true,"resumen":"1-2 frases ejecutivas"}`;

  for (let intento = 1; intento <= reintentos; intento++) {
    try {
      const res = await fetch(ANTHROPIC_URL, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01"
        },
        body: JSON.stringify({
          model: MODELO,
          max_tokens: 400,
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
      const obj = parsearJSONSeguro(texto);

      // Validacion minima del resultado.
      if (!EJES_VALIDOS.includes(obj.eje)) return null;
      if (!["verde", "amarillo", "rojo"].includes(obj.semaforo)) obj.semaforo = "amarillo";
      if (obj.relevante === false) return null;

      return {
        ...nota,
        eje: obj.eje,
        semaforo: obj.semaforo,
        resumen: (obj.resumen || nota.descripcion || "").trim()
      };
    } catch (e) {
      console.warn(`  ! Clasificacion fallo (intento ${intento}/${reintentos}): ${e.message}`);
      if (intento < reintentos) await dormir(1000 * intento);
    }
  }
  return null; // si no se pudo clasificar tras los reintentos, se descarta
}

// Clasifica TODAS las notas y las agrupa por eje.
export async function classify(notas) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("Falta ANTHROPIC_API_KEY en el entorno.");

  const semaforo = JSON.parse(await readFile(join(RAIZ, "data", "semaforo.json"), "utf-8"));
  const system = construirSystem(semaforo);

  const porEje = {
    filantropia: [], empresas: [], inversion: [],
    gobierno: [], hacienda: [], agropecuario: [], camaras: []
  };

  let i = 0;
  for (const nota of notas) {
    i++;
    const clasificada = await clasificarUna(nota, system, apiKey);
    if (clasificada) {
      porEje[clasificada.eje].push(clasificada);
      console.log(`  (${i}/${notas.length}) ${clasificada.eje} · ${clasificada.semaforo} · ${clasificada.titulo.slice(0, 60)}`);
    } else {
      console.log(`  (${i}/${notas.length}) descartada`);
    }
    await dormir(250); // ritmo amable con la API
  }

  return porEje;
}
