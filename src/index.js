// ===========================================================================
// index.js
// Orquesta todo el flujo del boletin:
//   fetchNews() -> classify() -> [guardar notas] -> renderHtml/Docx semanal
//   -> construir consolidado MENSUAL -> renderHtml/Docx mensual -> historial
// Genera la edicion de la semana, el resumen del mes, index.html e historial.
// ===========================================================================

import "dotenv/config";
import { writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { fetchNews } from "./fetchNews.js";
import { classify } from "./classify.js";
import { renderHtml } from "./renderHtml.js";
import { renderDocx } from "./renderDocx.js";
import { registrarEdicion, regenerarHistorial } from "./archive.js";
import { guardarNotasSemana, construirMensual } from "./mensual.js";
import { infoSemana, infoMes, EJES } from "./util.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const RAIZ = join(__dirname, "..");
const DOCS = join(RAIZ, "docs");
const EDICIONES = join(DOCS, "ediciones");

const totalDe = (porEje) => EJES.reduce((s, e) => s + (porEje[e.id]?.length || 0), 0);

async function main() {
  console.log("=== Avance Institucional: generando boletin ===");
  const hoy = new Date();
  const semana = infoSemana(hoy);
  const mes = infoMes(hoy);
  console.log(`Edicion semanal: ${semana.etiqueta}`);
  console.log(`Consolidado mensual: ${mes.etiqueta}\n`);

  await mkdir(EDICIONES, { recursive: true });

  // 1) Buscar noticias.
  console.log("[1/6] Buscando noticias (API + RSS)...");
  const notas = await fetchNews();

  // 2) Clasificar, asignar semaforo y resumir con IA.
  console.log("\n[2/6] Clasificando con IA (eje + semaforo + resumen)...");
  const porEjeSemana = await classify(notas);
  const totalSemana = totalDe(porEjeSemana);

  // 3) Guardar las notas de la semana (para poder armar el consolidado mensual).
  console.log("\n[3/6] Guardando notas de la semana...");
  await guardarNotasSemana(semana, porEjeSemana);

  // 4) Construir el consolidado del mes (todas las semanas de este mes).
  console.log("[4/6] Construyendo consolidado mensual...");
  const porEjeMes = await construirMensual(mes.mesClave);
  const totalMes = totalDe(porEjeMes);

  // 5) Registrar ambas ediciones en el manifiesto del historial.
  console.log("[5/6] Actualizando historial (semanal + mensual)...");
  await registrarEdicion(semana, totalSemana);
  const ediciones = await registrarEdicion(mes, totalMes);

  // 6) Renderizar HTML y DOCX de ambas ediciones + index + historial.
  console.log("[6/6] Generando HTML, DOCX e historial...\n");

  // -- Edicion semanal (archivo + index.html como mas reciente) --
  await writeFile(
    join(EDICIONES, `${semana.slug}.html`),
    renderHtml(semana, porEjeSemana, ediciones, { prefijoEdiciones: "", rutaHistorial: "../historial.html" }),
    "utf-8"
  );
  await renderDocx(semana, porEjeSemana, join(EDICIONES, `${semana.slug}.docx`));
  await writeFile(
    join(DOCS, "index.html"),
    renderHtml(semana, porEjeSemana, ediciones, { prefijoEdiciones: "ediciones/", rutaHistorial: "historial.html" }),
    "utf-8"
  );

  // -- Consolidado mensual (se regenera/actualiza cada semana del mes) --
  await writeFile(
    join(EDICIONES, `${mes.slug}.html`),
    renderHtml(mes, porEjeMes, ediciones, { prefijoEdiciones: "", rutaHistorial: "../historial.html" }),
    "utf-8"
  );
  await renderDocx(mes, porEjeMes, join(EDICIONES, `${mes.slug}.docx`));

  // -- Historial agrupado por mes --
  await regenerarHistorial(ediciones);

  // Resumen en consola.
  const conteoColor = { verde: 0, amarillo: 0, rojo: 0 };
  for (const e of EJES) for (const n of porEjeSemana[e.id]) conteoColor[n.semaforo]++;
  console.log("--- Resumen ---");
  for (const e of EJES) console.log(`  ${e.titulo}: ${porEjeSemana[e.id].length}`);
  console.log(`  Semaforo (semana) -> verde:${conteoColor.verde}  amarillo:${conteoColor.amarillo}  rojo:${conteoColor.rojo}`);
  console.log(`  TOTAL semana: ${totalSemana} · TOTAL mes (${mes.mesNombre}): ${totalMes}`);
  console.log("\nListo. Abre docs/index.html para ver el boletin.");
}

main().catch((err) => {
  console.error("\nError fatal:", err);
  process.exit(1);
});
