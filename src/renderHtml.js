// ===========================================================================
// renderHtml.js
// Construye la pagina HTML del boletin con un diseno ejecutivo moderno:
// tipografias Sora (titulos) + Inter (cuerpo), paleta sobria y semaforo.
// Maneja ediciones semanales y mensuales, e historial agrupado por mes.
// ===========================================================================

import { EJES, SEMAFORO, fechaCorta, escHtml, agruparPorMes } from "./util.js";

// CSS comun a todas las paginas (autocontenido).
const ESTILOS = `
:root{
  --ink:#22303d;          /* azul-gris oscuro para el texto */
  --paper:#f3e7d6;        /* crema (banda 3) */
  --paper-2:#d6cbb8;      /* tan (banda 4) para chips/tarjetas */
  --azul:#7da5cc;         /* azul medio (banda 1) */
  --azul-claro:#a7cfe0;   /* azul claro (banda 2) */
  --accent:#3a6ea5;       /* azul profundo para enlaces/acentos */
  --accent-2:#2c5278;     /* azul mas oscuro */
  --rule:#cfc6b4; --muted:#6f6a5f;
  --verde:#1f8a4c; --amarillo:#d99500; --rojo:#c0392b;
}
*{box-sizing:border-box;}
body{
  margin:0; background:var(--paper); color:var(--ink);
  font-family:"Inter",system-ui,-apple-system,sans-serif; line-height:1.55;
  -webkit-font-smoothing:antialiased;
}
.wrap{max-width:880px; margin:0 auto; padding:28px 20px 60px;}
a{color:var(--accent); text-decoration:none;}
a:hover{text-decoration:underline;}

/* Encabezado / masthead: panel azul con degradado */
.masthead{background:linear-gradient(135deg,var(--azul) 0%,var(--azul-claro) 100%);
  color:#fff; border-radius:14px; padding:30px 28px; margin-bottom:24px;
  box-shadow:0 8px 22px rgba(34,48,61,.14);}
.kicker{font-size:.72rem; letter-spacing:.24em; text-transform:uppercase; color:rgba(255,255,255,.88); margin:0 0 8px; font-weight:600;}
.titulo{font-family:"Sora",sans-serif; font-weight:800; letter-spacing:-.02em; font-size:clamp(2.3rem,6vw,3.5rem); line-height:1.02; margin:0; color:#fff;}
.subtitulo{color:rgba(255,255,255,.94); margin:10px 0 0; font-size:1.02rem; font-weight:500;}
.meta{display:flex; flex-wrap:wrap; gap:10px 18px; align-items:center; justify-content:space-between;
  border-top:1px solid rgba(255,255,255,.4);
  padding:12px 0 0; margin:16px 0 0; font-size:.85rem; color:rgba(255,255,255,.92);}
.meta strong{color:#fff; font-weight:700;}

/* Leyenda del semaforo */
.leyenda{display:flex; flex-wrap:wrap; gap:16px; margin:18px 0 8px; font-size:.82rem; color:var(--muted);}
.leyenda span{display:inline-flex; align-items:center; gap:7px;}
.punto{width:13px; height:13px; border-radius:50%; display:inline-block; flex:0 0 auto;}
.punto.verde{background:var(--verde);} .punto.amarillo{background:var(--amarillo);} .punto.rojo{background:var(--rojo);}

/* Secciones por eje */
.eje{margin-top:34px;}
.eje h2{font-family:"Sora",sans-serif; font-size:1.4rem; font-weight:700; letter-spacing:-.01em; margin:0 0 4px;
  padding-bottom:8px; border-bottom:2px solid var(--azul); display:flex; gap:12px; align-items:baseline; color:var(--accent-2);}
.eje h2 .num{color:var(--accent); font-size:1rem; font-weight:700;}
.vacio{color:var(--muted); font-style:italic; padding:10px 0; font-size:.9rem;}

/* Tarjeta de nota */
.nota{display:grid; grid-template-columns:auto 1fr; gap:14px; padding:16px 0; border-bottom:1px solid var(--rule);}
.col-izq{display:flex; flex-direction:column; align-items:center; gap:6px; padding-top:4px;}
.col-izq .punto{width:16px; height:16px;}
.col-izq .fecha{font-size:.72rem; color:var(--verde); font-weight:600; text-align:center; white-space:nowrap;}
.nota h3{font-family:"Sora",sans-serif; font-weight:600; font-size:1.08rem; letter-spacing:-.01em; margin:0 0 5px; line-height:1.3;}
.nota p{margin:0 0 8px; color:#39322a;}
.fuente-linea{font-size:.8rem; color:var(--muted); display:flex; flex-wrap:wrap; gap:10px; align-items:center;}
.chip{background:var(--paper-2); border:1px solid var(--rule); border-radius:999px; padding:2px 10px; font-size:.74rem; color:var(--ink);}

/* Ediciones anteriores / historial por mes */
.ediciones{margin-top:44px; border-top:3px double var(--accent); padding-top:18px;}
.ediciones h2{font-family:"Sora",sans-serif; font-size:1.3rem; font-weight:700; margin:0 0 14px;}
.mes-bloque{margin-bottom:22px;}
.mes-titulo{font-family:"Sora",sans-serif; font-size:1.02rem; font-weight:700; color:var(--accent-2);
  text-transform:capitalize; margin:0 0 8px; padding-bottom:5px; border-bottom:1px solid var(--rule);}
.ediciones ul{list-style:none; padding:0; margin:0;}
.ediciones li{padding:8px 0; display:flex; flex-wrap:wrap; gap:6px 14px; align-items:baseline;}
.ediciones li.mensual{background:var(--paper-2); border-radius:8px; padding:8px 12px; margin-bottom:4px;}
.ediciones .et{font-weight:600;}
.ediciones .small{font-size:.8rem; color:var(--muted);}

footer{margin-top:46px; border-top:3px double var(--accent); padding-top:16px; text-align:center; color:var(--muted); font-size:.82rem;}

@media (max-width:560px){
  .nota{grid-template-columns:1fr;}
  .col-izq{flex-direction:row; justify-content:flex-start;}
}
`;

function cabecera(tituloPagina) {
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="robots" content="noindex">
<title>${escHtml(tituloPagina)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700;800&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>${ESTILOS}</style>
</head>
<body><div class="wrap">`;
}

function leyendaSemaforo() {
  return `<div class="leyenda" aria-label="Leyenda del semaforo">
  <span><i class="punto verde"></i> Verde — ${SEMAFORO.verde.etiqueta}</span>
  <span><i class="punto amarillo"></i> Amarillo — ${SEMAFORO.amarillo.etiqueta}</span>
  <span><i class="punto rojo"></i> Rojo — ${SEMAFORO.rojo.etiqueta}</span>
</div>`;
}

function tarjetaNota(nota) {
  const color = nota.semaforo || "amarillo";
  const etiqueta = SEMAFORO[color]?.etiqueta || "";
  return `<article class="nota">
  <div class="col-izq">
    <span class="punto ${color}" role="img" aria-label="Semaforo ${color}: ${escHtml(etiqueta)}"></span>
    <span class="fecha">${escHtml(fechaCorta(nota.fecha))}</span>
  </div>
  <div class="col-der">
    <h3><a href="${escHtml(nota.url)}" target="_blank" rel="noopener">${escHtml(nota.titulo)}</a></h3>
    <p>${escHtml(nota.resumen || "")}</p>
    <div class="fuente-linea">
      <span class="chip">${escHtml(nota.fuente || "Fuente")}</span>
      <a href="${escHtml(nota.url)}" target="_blank" rel="noopener">Abrir noticia →</a>
    </div>
  </div>
</article>`;
}

function seccionesEjes(porEje) {
  return EJES.map((eje, i) => {
    const notas = porEje[eje.id] || [];
    const cuerpo = notas.length
      ? notas.map(tarjetaNota).join("\n")
      : `<p class="vacio">Sin notas esta semana.</p>`;
    return `<section class="eje">
  <h2><span class="num">${i + 1}</span> ${escHtml(eje.titulo)}</h2>
  ${cuerpo}
</section>`;
  }).join("\n");
}

// Bloque "Ediciones anteriores" agrupado por mes. `prefijo` ajusta rutas.
function bloqueHistorial(ediciones, prefijo, rutaHistorial, omitirSlug = null) {
  const grupos = agruparPorMes(ediciones.filter((e) => e.slug !== omitirSlug));
  if (!grupos.length) return "";

  const html = grupos.map((g) => {
    const filaMensual = g.mensual ? `<li class="mensual">
      <span class="et">📅 <a href="${prefijo}${escHtml(g.mensual.slug)}.html">Resumen mensual — ${escHtml(g.mesNombre)} ${g.anio}</a></span>
      <span class="small">${g.mensual.notas} notas</span>
      <span class="small"><a href="${prefijo}${escHtml(g.mensual.slug)}.docx">.docx</a></span>
    </li>` : "";
    const filasSemanas = g.semanas.map((e) => `<li>
      <span class="et"><a href="${prefijo}${escHtml(e.slug)}.html">Semana ${e.numero}</a></span>
      <span class="small">${escHtml(e.rango || "")} · ${e.notas} notas</span>
      <span class="small"><a href="${prefijo}${escHtml(e.slug)}.docx">.docx</a></span>
    </li>`).join("\n");
    return `<div class="mes-bloque">
  <h3 class="mes-titulo">${escHtml(g.mesNombre)} ${g.anio}</h3>
  <ul>
${filaMensual}
${filasSemanas}
  </ul>
</div>`;
  }).join("\n");

  return `<section class="ediciones">
  <h2>Ediciones anteriores</h2>
  ${html}
  <p class="small" style="margin-top:6px"><a href="${rutaHistorial}">Ver historial completo →</a></p>
</section>`;
}

/**
 * Construye una pagina de edicion (semanal o mensual).
 * info: objeto de infoSemana() o infoMes().
 * opciones.prefijoEdiciones, opciones.rutaHistorial: rutas relativas.
 */
export function renderHtml(info, porEje, ediciones, opciones = {}) {
  const prefijo = opciones.prefijoEdiciones ?? "ediciones/";
  const rutaHistorial = opciones.rutaHistorial ?? "historial.html";
  const totalNotas = EJES.reduce((s, e) => s + (porEje[e.id]?.length || 0), 0);

  return `${cabecera(`Avance Institucional · ${info.tituloEdicion}`)}
<header class="masthead">
  <p class="kicker">Boletin ${info.tipo === "mensual" ? "mensual" : "semanal"} · Monitoreo de noticias</p>
  <h1 class="titulo">Avance Institucional</h1>
  <p class="subtitulo">Resumen de noticias relevantes para direccion — Mexicali y Baja California</p>
  <div class="meta">
    <span><strong>${escHtml(info.metaIzq)}</strong> · ${escHtml(info.metaDetalle)}</span>
    <span>${totalNotas} ${totalNotas === 1 ? "nota" : "notas"} esta edicion</span>
  </div>
</header>

${leyendaSemaforo()}

${seccionesEjes(porEje)}

${bloqueHistorial(ediciones, prefijo, rutaHistorial, info.slug)}

<footer>
  <p>Avance Institucional — documento interno de monitoreo. Generado automaticamente.</p>
</footer>
</div></body></html>`;
}

/** Pagina de historial completo (docs/historial.html), agrupada por mes. */
export function renderHistorial(ediciones) {
  const grupos = agruparPorMes(ediciones);
  const cuerpo = grupos.length
    ? grupos.map((g) => {
        const filaMensual = g.mensual ? `<li class="mensual">
      <span class="et">📅 <a href="ediciones/${escHtml(g.mensual.slug)}.html">Resumen mensual — ${escHtml(g.mesNombre)} ${g.anio}</a></span>
      <span class="small">${g.mensual.notas} notas</span>
      <span class="small"><a href="ediciones/${escHtml(g.mensual.slug)}.docx">.docx</a></span>
    </li>` : "";
        const filasSemanas = g.semanas.map((e) => `<li>
      <span class="et"><a href="ediciones/${escHtml(e.slug)}.html">Semana ${e.numero}</a></span>
      <span class="small">${escHtml(e.rango || "")} · ${e.notas} notas</span>
      <span class="small"><a href="ediciones/${escHtml(e.slug)}.docx">.docx</a></span>
    </li>`).join("\n");
        return `<div class="mes-bloque">
  <h3 class="mes-titulo">${escHtml(g.mesNombre)} ${g.anio}</h3>
  <ul>
${filaMensual}
${filasSemanas}
  </ul>
</div>`;
      }).join("\n")
    : `<p class="small">Aun no hay ediciones registradas.</p>`;

  return `${cabecera("Avance Institucional · Historial")}
<header class="masthead">
  <p class="kicker">Boletin · Monitoreo de noticias</p>
  <h1 class="titulo">Historial</h1>
  <p class="subtitulo">Todas las ediciones, organizadas por mes</p>
</header>
<section class="ediciones" style="border-top:none; padding-top:8px;">
  ${cuerpo}
  <p class="small" style="margin-top:16px"><a href="index.html">← Volver a la edicion actual</a></p>
</section>
<footer>
  <p>Avance Institucional — documento interno de monitoreo.</p>
</footer>
</div></body></html>`;
}
