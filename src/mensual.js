// ===========================================================================
// mensual.js
// Guarda las notas clasificadas de cada semana y construye el consolidado
// mensual juntando todas las semanas del mismo mes (sin duplicar por URL).
// ===========================================================================

import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { EJES } from "./util.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const RAIZ = join(__dirname, "..");
const DIR_NOTAS = join(RAIZ, "data", "notas");

// Guarda las notas de una edicion semanal en data/notas/<slug>.json.
export async function guardarNotasSemana(info, porEje) {
  await mkdir(DIR_NOTAS, { recursive: true });
  const registro = { slug: info.slug, mesClave: info.mesClave, porEje };
  await writeFile(join(DIR_NOTAS, `${info.slug}.json`), JSON.stringify(registro, null, 2) + "\n", "utf-8");
}

// Construye el consolidado mensual: junta todas las semanas guardadas cuyo
// mesClave coincida con el mes pedido, deduplicando notas por URL.
export async function construirMensual(mesClave) {
  const porEje = {};
  for (const e of EJES) porEje[e.id] = [];

  let archivos = [];
  try {
    archivos = (await readdir(DIR_NOTAS)).filter((f) => f.startsWith("semana-") && f.endsWith(".json"));
  } catch {
    return porEje; // aun no hay notas guardadas
  }

  const urlsVistas = new Set();
  for (const archivo of archivos) {
    let registro;
    try {
      registro = JSON.parse(await readFile(join(DIR_NOTAS, archivo), "utf-8"));
    } catch {
      continue;
    }
    if (registro.mesClave !== mesClave) continue;

    for (const e of EJES) {
      for (const nota of registro.porEje?.[e.id] || []) {
        if (nota.url && urlsVistas.has(nota.url)) continue;
        if (nota.url) urlsVistas.add(nota.url);
        porEje[e.id].push(nota);
      }
    }
  }

  return porEje;
}
