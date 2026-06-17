// ===========================================================================
// renderDocx.js
// Genera la version .docx de la edicion con la libreria "docx".
// Mismo contenido y estilo equivalente al HTML (titulos Georgia, cuerpo Arial,
// colores del semaforo, secciones numeradas, fechas en verde, enlaces).
// ===========================================================================

import { writeFile } from "node:fs/promises";
import {
  Document, Packer, Paragraph, TextRun, ExternalHyperlink,
  AlignmentType, BorderStyle, HeadingLevel
} from "docx";
import { EJES, SEMAFORO, fechaCorta } from "./util.js";

// Colores sin "#": la libreria docx los pide en hex plano.
const COL = {
  ink: "22303D", accent: "3A6EA5", accent2: "2C5278", muted: "6F6A5F",
  verde: "1F8A4C", amarillo: "D99500", rojo: "C0392B"
};
const hexSemaforo = (s) => SEMAFORO[s]?.hex.replace("#", "") || COL.amarillo;

// Cuadrito de color (un caracter cuadrado pintado del color del semaforo).
function cuadritoColor(semaforo) {
  return new TextRun({ text: "■ ", color: hexSemaforo(semaforo), font: "Calibri" });
}

function lineaSemaforoLeyenda() {
  const hijos = [];
  for (const [clave, val] of Object.entries(SEMAFORO)) {
    hijos.push(new TextRun({ text: "■ ", color: val.hex.replace("#", ""), font: "Calibri" }));
    hijos.push(new TextRun({
      text: `${clave[0].toUpperCase()}${clave.slice(1)} — ${val.etiqueta}    `,
      font: "Calibri", size: 16, color: COL.muted
    }));
  }
  return new Paragraph({ spacing: { after: 200 }, children: hijos });
}

function parrafoNota(nota) {
  const parrafos = [];

  // Linea 1: cuadrito de color + fecha (verde) + titulo como hipervinculo.
  parrafos.push(new Paragraph({
    spacing: { before: 160, after: 20 },
    children: [
      cuadritoColor(nota.semaforo),
      new TextRun({ text: `${fechaCorta(nota.fecha)}  `, color: COL.verde, bold: true, font: "Calibri", size: 16 }),
      new ExternalHyperlink({
        link: nota.url || "#",
        children: [new TextRun({ text: nota.titulo || "", font: "Calibri", bold: true, size: 24, color: COL.accent, underline: {} })]
      })
    ]
  }));

  // Linea 2: resumen ejecutivo.
  if (nota.resumen) {
    parrafos.push(new Paragraph({
      spacing: { after: 20 },
      children: [new TextRun({ text: nota.resumen, font: "Calibri", size: 20, color: "39322A" })]
    }));
  }

  // Linea 3: fuente + enlace "Abrir noticia".
  parrafos.push(new Paragraph({
    spacing: { after: 60 },
    children: [
      new TextRun({ text: `${nota.fuente || "Fuente"}  ·  `, font: "Calibri", size: 16, color: COL.muted }),
      new ExternalHyperlink({
        link: nota.url || "#",
        children: [new TextRun({ text: "Abrir noticia →", font: "Calibri", size: 16, color: COL.accent, underline: {} })]
      })
    ]
  }));

  return parrafos;
}

function tituloSeccion(numero, texto) {
  return new Paragraph({
    spacing: { before: 320, after: 60 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: COL.ink } },
    children: [
      new TextRun({ text: `${numero}. `, font: "Calibri", bold: true, size: 26, color: COL.accent }),
      new TextRun({ text: texto, font: "Calibri", bold: true, size: 26, color: COL.ink })
    ]
  });
}

export async function renderDocx(info, porEje, rutaSalida) {
  const total = EJES.reduce((s, e) => s + (porEje[e.id]?.length || 0), 0);
  const cuerpo = [];

  // Encabezado.
  cuerpo.push(new Paragraph({
    spacing: { after: 20 },
    children: [new TextRun({ text: `BOLETIN ${info.tipo === "mensual" ? "MENSUAL" : "SEMANAL"} · MONITOREO DE NOTICIAS`, font: "Calibri", size: 14, color: COL.muted, characterSpacing: 40 })]
  }));
  cuerpo.push(new Paragraph({
    children: [new TextRun({ text: "Avance Institucional", font: "Calibri", bold: true, size: 56, color: COL.ink })]
  }));
  cuerpo.push(new Paragraph({
    spacing: { after: 60 },
    children: [new TextRun({ text: "Resumen de noticias relevantes para direccion — Mexicali y Baja California", font: "Calibri", italics: true, size: 22, color: COL.accent2 })]
  }));
  cuerpo.push(new Paragraph({
    spacing: { after: 120 },
    border: { top: { style: BorderStyle.SINGLE, size: 6, color: COL.muted }, bottom: { style: BorderStyle.SINGLE, size: 6, color: COL.muted } },
    children: [new TextRun({ text: `${info.metaIzq} · ${info.metaDetalle}    |    ${total} ${total === 1 ? "nota" : "notas"}`, font: "Calibri", size: 18, color: COL.muted })]
  }));

  // Leyenda del semaforo.
  cuerpo.push(lineaSemaforoLeyenda());

  // Secciones por eje.
  EJES.forEach((eje, i) => {
    cuerpo.push(tituloSeccion(i + 1, eje.titulo));
    const notas = porEje[eje.id] || [];
    if (notas.length) {
      for (const nota of notas) cuerpo.push(...parrafoNota(nota));
    } else {
      cuerpo.push(new Paragraph({
        spacing: { before: 60, after: 60 },
        children: [new TextRun({ text: info.tipo === "mensual" ? "Sin notas este mes." : "Sin notas esta semana.", italics: true, font: "Calibri", size: 18, color: COL.muted })]
      }));
    }
  });

  // Pie.
  cuerpo.push(new Paragraph({
    spacing: { before: 360 },
    alignment: AlignmentType.CENTER,
    border: { top: { style: BorderStyle.DOUBLE, size: 6, color: COL.ink } },
    children: [new TextRun({ text: "Avance Institucional — documento interno de monitoreo.", font: "Calibri", size: 16, color: COL.muted })]
  }));

  const doc = new Document({
    sections: [{
      properties: {
        page: {
          size: { width: 12240, height: 15840 }, // Carta
          margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } // 1 pulgada
        }
      },
      children: cuerpo
    }]
  });

  const buffer = await Packer.toBuffer(doc);
  await writeFile(rutaSalida, buffer);
  return rutaSalida;
}
