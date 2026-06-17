// ===========================================================================
// archive.js
// Mantiene el manifiesto data/ediciones.json (historial acumulado) y
// regenera docs/historial.html con el listado completo de ediciones.
// ===========================================================================

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { renderHistorial } from "./renderHtml.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const RAIZ = join(__dirname, "..");
const RUTA_MANIFIESTO = join(RAIZ, "data", "ediciones.json");
const RUTA_HISTORIAL = join(RAIZ, "docs", "historial.html");

// Registra (o actualiza, si ya existe) una edicion (semanal o mensual).
export async function registrarEdicion(info, totalNotas) {
  let manifiesto = { ediciones: [] };
  try {
    manifiesto = JSON.parse(await readFile(RUTA_MANIFIESTO, "utf-8"));
  } catch {
    // si no existe o esta corrupto, arrancamos de cero
  }
  if (!Array.isArray(manifiesto.ediciones)) manifiesto.ediciones = [];

  const entrada = {
    slug: info.slug,
    tipo: info.tipo,
    numero: info.numero ?? null,
    anio: info.anio,
    mes: info.mes,
    mesClave: info.mesClave,
    mesNombre: info.mesNombre,
    rango: info.rango ?? "",
    notas: totalNotas,
    html: `ediciones/${info.slug}.html`,
    docx: `ediciones/${info.slug}.docx`,
    generado: new Date().toISOString()
  };

  // Si ya existe la misma semana, la reemplazamos (re-corridas del mismo lunes).
  const idx = manifiesto.ediciones.findIndex((e) => e.slug === info.slug);
  if (idx >= 0) manifiesto.ediciones[idx] = entrada;
  else manifiesto.ediciones.push(entrada);

  // Orden: mas nueva primero.
  manifiesto.ediciones.sort((a, b) => b.slug.localeCompare(a.slug));

  await writeFile(RUTA_MANIFIESTO, JSON.stringify(manifiesto, null, 2) + "\n", "utf-8");
  return manifiesto.ediciones;
}

// Regenera docs/historial.html con todas las ediciones.
export async function regenerarHistorial(ediciones) {
  await writeFile(RUTA_HISTORIAL, renderHistorial(ediciones), "utf-8");
}
