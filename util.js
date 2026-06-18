// ===========================================================================
// util.js
// Funciones y datos compartidos: numero de semana, info de mes, nombres de
// ejes, colores del semaforo y agrupado del historial por mes.
// ===========================================================================

// Orden y titulos de los 7 ejes (se usa en HTML y DOCX).
export const EJES = [
  { id: "filantropia", titulo: "Filantropia y responsabilidad social" },
  { id: "empresas", titulo: "Empresas y lideres establecidos" },
  { id: "inversion", titulo: "Inversion entrante / expansiones" },
  { id: "gobierno", titulo: "Gobierno" },
  { id: "hacienda", titulo: "Hacienda" },
  { id: "agropecuario", titulo: "Agropecuario" },
  { id: "camaras", titulo: "Camaras empresariales" }
];

// Colores y etiquetas del semaforo (deben coincidir con el CSS).
export const SEMAFORO = {
  verde: { hex: "#1f8a4c", etiqueta: "Oportunidad / positivo" },
  amarillo: { hex: "#d99500", etiqueta: "Seguimiento / neutral" },
  rojo: { hex: "#c0392b", etiqueta: "Alerta / riesgo" }
};

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"
];

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// Numero de semana ISO-8601 (la semana 1 es la que contiene el primer jueves).
export function numeroSemanaISO(fecha) {
  const d = new Date(Date.UTC(fecha.getFullYear(), fecha.getMonth(), fecha.getDate()));
  const dia = d.getUTCDay() || 7; // domingo = 7
  d.setUTCDate(d.getUTCDate() + 4 - dia); // jueves de esta semana
  const inicioAnio = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return {
    anio: d.getUTCFullYear(),
    numero: Math.ceil(((d - inicioAnio) / 86400000 + 1) / 7)
  };
}

// Info de la EDICION SEMANAL para una fecha dada.
export function infoSemana(fecha = new Date()) {
  const { anio, numero } = numeroSemanaISO(fecha);

  // Rango lunes-domingo de la semana.
  const dia = fecha.getUTCDay() || 7;
  const lunes = new Date(fecha);
  lunes.setUTCDate(fecha.getUTCDate() - (dia - 1));
  const domingo = new Date(lunes);
  domingo.setUTCDate(lunes.getUTCDate() + 6);

  const mes = MESES[fecha.getUTCMonth()];
  const nn = String(numero).padStart(2, "0");
  const mm = String(fecha.getUTCMonth() + 1).padStart(2, "0");

  const rango = lunes.getUTCMonth() === domingo.getUTCMonth()
    ? `${lunes.getUTCDate()}-${domingo.getUTCDate()} ${MESES[domingo.getUTCMonth()].slice(0, 3)} ${anio}`
    : `${lunes.getUTCDate()} ${MESES[lunes.getUTCMonth()].slice(0, 3)} - ${domingo.getUTCDate()} ${MESES[domingo.getUTCMonth()].slice(0, 3)} ${anio}`;

  return {
    tipo: "semanal",
    anio,
    numero,
    mes,
    rango,
    mesClave: `${fecha.getUTCFullYear()}-${mm}`,
    mesNombre: cap(mes),
    slug: `semana-${anio}-${nn}`,
    etiqueta: `Semana ${numero} · ${mes} · ${rango}`,
    metaIzq: `Semana ${numero}`,
    metaDetalle: `${mes} · ${rango}`,
    tituloEdicion: `Semana ${numero}`
  };
}

// Info de la EDICION MENSUAL (consolidado del mes de una fecha dada).
export function infoMes(fecha = new Date()) {
  const anio = fecha.getUTCFullYear();
  const mm = String(fecha.getUTCMonth() + 1).padStart(2, "0");
  const mesNombre = cap(MESES[fecha.getUTCMonth()]);
  return {
    tipo: "mensual",
    anio,
    mes: MESES[fecha.getUTCMonth()],
    mesClave: `${anio}-${mm}`,
    mesNombre,
    slug: `mes-${anio}-${mm}`,
    etiqueta: `Resumen mensual · ${mesNombre} ${anio}`,
    metaIzq: "Resumen mensual",
    metaDetalle: `${mesNombre} ${anio}`,
    tituloEdicion: `${mesNombre} ${anio}`
  };
}

// Agrupa las ediciones del historial por mes (mas nuevo primero).
// Devuelve: [{ mesClave, mesNombre, anio, mensual, semanas: [...] }]
export function agruparPorMes(ediciones) {
  const mapa = new Map();
  for (const e of ediciones) {
    const clave = e.mesClave || (e.slug || "").slice(-7);
    if (!mapa.has(clave)) {
      mapa.set(clave, { mesClave: clave, mesNombre: e.mesNombre || "", anio: e.anio || "", mensual: null, semanas: [] });
    }
    const grupo = mapa.get(clave);
    if (e.tipo === "mensual") grupo.mensual = e;
    else grupo.semanas.push(e);
    if (e.mesNombre) grupo.mesNombre = e.mesNombre;
    if (e.anio) grupo.anio = e.anio;
  }
  for (const g of mapa.values()) g.semanas.sort((a, b) => b.slug.localeCompare(a.slug));
  return [...mapa.values()].sort((a, b) => b.mesClave.localeCompare(a.mesClave));
}

// Formatea una fecha ISO a algo corto y legible (ej. "12 jun").
export function fechaCorta(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d)) return "";
  return `${d.getUTCDate()} ${MESES[d.getUTCMonth()].slice(0, 3)}`;
}

// Escapa texto para insertarlo de forma segura en HTML.
export function escHtml(s = "") {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
