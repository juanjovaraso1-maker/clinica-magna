// Shared clinic constants
const CLINIC = {
  name:      "CLÍNICA MAGNA",
  subtitle:  "Odontología y Estética Facial",
  address:   "Badajoz 100, Of. 918, Las Condes",
  phone:     "+56 9 6279 3952",
  email:     "administracion@clinicamagna.cl",
  web:       "www.clinicamagna.cl",
  instagram: "@clinica.magna",
};

function fmt(n: number): string {
  return new Intl.NumberFormat("es-CL", {
    style: "currency", currency: "CLP", maximumFractionDigits: 0,
  }).format(n);
}

// Full HTML wrapper (used for print window)
export function wrapHtml(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8"/>
  <title>${title}</title>
  <style>
    @page { margin: 14mm; size: A4 portrait }
    * { box-sizing: border-box; margin: 0; padding: 0 }
    body { font-family: Arial, Helvetica, sans-serif; font-size: 11px; color: #1a1a1a; background: #fff }
    b, strong { font-weight: bold }
    table { border-collapse: collapse; width: 100% }
  </style>
</head>
<body>${body}</body>
</html>`;
}

// ── Shared building blocks ────────────────────────────────────

function clinicHeader(logoSrc?: string): string {
  const logo = logoSrc
    ? `<img src="${logoSrc}" style="width:75px;height:65px;object-fit:contain;flex-shrink:0" crossorigin="anonymous"/>`
    : `<div style="width:75px;height:65px;background:#1f4e79;border-radius:6px;color:white;font-size:10px;font-weight:bold;text-align:center;display:flex;align-items:center;justify-content:center;flex-shrink:0">CLÍNICA<br/>MAGNA</div>`;
  return `
<div style="display:flex;align-items:flex-start;gap:14px;padding-bottom:10px;border-bottom:2.5px solid #1e5f74;margin-bottom:16px">
  ${logo}
  <div style="flex:1">
    <div style="font-size:20px;font-weight:bold;color:#000;letter-spacing:0.5px">${CLINIC.name}</div>
    <div style="font-size:11px;font-style:italic;color:#2e75b6;margin-top:2px">${CLINIC.subtitle}</div>
    <div style="font-size:9px;color:#555;margin-top:4px">${CLINIC.address} &nbsp;|&nbsp; ${CLINIC.phone} &nbsp;|&nbsp; ${CLINIC.email}</div>
    <div style="font-size:9px;color:#555">${CLINIC.web} &nbsp;|&nbsp; ${CLINIC.instagram}</div>
  </div>
</div>`;
}

function profPatTable(
  prof: { name: string; rut?: string; showRut?: boolean },
  pat:  { name: string; rut?: string; date?: string; extra?: Array<{ label: string; value: string }> }
): string {
  return `
<table style="width:100%;border-collapse:collapse;margin:14px 0">
  <tr>
    <td style="width:50%;vertical-align:top;padding-right:20px">
      <div style="font-size:11px;font-weight:bold;color:#2e75b6;border-bottom:1.5px solid #2e75b6;margin-bottom:6px;padding-bottom:2px">PROFESIONAL</div>
      <div style="font-size:11px"><b>Nombre:</b> ${prof.name}</div>
      ${prof.showRut !== false && prof.rut ? `<div style="font-size:11px"><b>RUT:</b> ${prof.rut}</div>` : ""}
    </td>
    <td style="width:50%;vertical-align:top">
      <div style="font-size:11px;font-weight:bold;color:#2e75b6;border-bottom:1.5px solid #2e75b6;margin-bottom:6px;padding-bottom:2px">PACIENTE</div>
      <div style="font-size:11px"><b>Nombre:</b> ${pat.name}</div>
      ${pat.rut  ? `<div style="font-size:11px"><b>RUT:</b> ${pat.rut}</div>`   : ""}
      ${pat.date ? `<div style="font-size:11px"><b>Fecha:</b> ${pat.date}</div>` : ""}
      ${(pat.extra ?? []).map(e => `<div style="font-size:11px"><b>${e.label}:</b> ${e.value}</div>`).join("")}
    </td>
  </tr>
</table>`;
}

function docFooter(left: string, right: string): string {
  return `
<table style="width:100%;margin-top:40px">
  <tr>
    <td style="width:45%;text-align:center;border-top:1px solid #555;padding-top:5px;font-size:10px">${left}</td>
    <td style="width:10%"></td>
    <td style="width:45%;text-align:center;border-top:1px solid #555;padding-top:5px;font-size:10px">${right}</td>
  </tr>
</table>`;
}

// ── RECETA MÉDICA ─────────────────────────────────────────────

export interface RecetaMed {
  drug: string; dose?: string; freq?: string; duration?: string; qty?: string; instructions?: string;
}
export interface RecetaData {
  professionalName: string; professionalRut?: string;
  patientName: string; patientRut?: string; patientBirthDate?: string;
  date: string;
  medications: RecetaMed[];
  diagnosis?: string; notes?: string;
}

export function buildRecetaBody(data: RecetaData, logoSrc?: string): string {
  const TH = `padding:6px 7px;border:1px solid #1f4e79;font-size:10px;text-align:center;background:#1f4e79;color:white;font-weight:bold`;
  const medRows = data.medications.map((m, i) => `
    <tr style="background:${i % 2 === 0 ? "#fff" : "#f0f6ff"}">
      <td style="padding:5px 7px;text-align:center;border:1px solid #bcd2e8;font-size:10px;font-weight:bold">${i + 1}</td>
      <td style="padding:5px 7px;border:1px solid #bcd2e8;font-size:10px;font-weight:bold;text-transform:uppercase">${m.drug}</td>
      <td style="padding:5px 7px;text-align:center;border:1px solid #bcd2e8;font-size:10px">${m.dose ?? ""}</td>
      <td style="padding:5px 7px;text-align:center;border:1px solid #bcd2e8;font-size:10px">${m.freq ?? ""}</td>
      <td style="padding:5px 7px;text-align:center;border:1px solid #bcd2e8;font-size:10px">${m.duration ?? ""}</td>
      <td style="padding:5px 7px;text-align:center;border:1px solid #bcd2e8;font-size:10px">${m.qty ?? ""}</td>
    </tr>
    ${m.instructions ? `<tr style="background:#f8f9fa"><td></td><td colspan="5" style="padding:3px 7px 6px;border:1px solid #bcd2e8;font-size:9.5px;font-style:italic;color:#555">Indicación: ${m.instructions}</td></tr>` : ""}
  `).join("");

  return `
    ${clinicHeader(logoSrc)}
    <div style="text-align:center;margin:14px 0 10px">
      <div style="font-size:17px;font-weight:bold;letter-spacing:1px">RECETA MÉDICA ODONTOLÓGICA</div>
    </div>
    ${profPatTable(
      { name: data.professionalName, rut: data.professionalRut },
      { name: data.patientName, rut: data.patientRut, date: data.date,
        extra: data.patientBirthDate ? [{ label: "Fecha nac.", value: data.patientBirthDate }] : [] }
    )}
    <table style="width:100%;border-collapse:collapse;margin:4px 0 14px">
      <thead><tr>
        <th style="${TH};width:5%">N°</th>
        <th style="${TH};text-align:left;width:30%">Medicamento / Principio Activo</th>
        <th style="${TH};width:17%">Dosis / Concentración</th>
        <th style="${TH};width:15%">Posología</th>
        <th style="${TH};width:15%">Duración</th>
        <th style="${TH};width:18%">Cantidad</th>
      </tr></thead>
      <tbody>${medRows}</tbody>
    </table>
    <div style="margin-bottom:12px">
      <div style="font-size:11px;font-weight:bold;color:#2e75b6;margin-bottom:5px">DIAGNÓSTICO / INDICACIÓN:</div>
      <div style="border:1px solid #bcd2e8;min-height:44px;padding:8px;background:#fff;font-size:10.5px">${data.diagnosis ?? ""}</div>
    </div>
    <div style="margin-bottom:12px">
      <div style="font-size:11px;font-weight:bold;color:#2e75b6;margin-bottom:5px">OBSERVACIONES:</div>
      <div style="border:1px solid #bcd2e8;min-height:44px;padding:8px;background:#fff;font-size:10.5px">${data.notes ?? ""}</div>
    </div>
    ${docFooter("Firma y Timbre Profesional", "Clínica Magna")}
    <div style="margin-top:16px;text-align:center;font-size:9px;color:#888;border-top:1px solid #eee;padding-top:8px">
      Clínica Magna &nbsp;|&nbsp; Receta Médica Odontológica &nbsp;|&nbsp; ${CLINIC.address}
    </div>`;
}

export function buildRecetaHTML(data: RecetaData, logoSrc?: string): string {
  return wrapHtml("Receta Médica Odontológica", buildRecetaBody(data, logoSrc));
}

// ── PRESUPUESTO DENTAL ────────────────────────────────────────

export interface PresupuestoItem {
  description: string; area?: string; tooth?: string;
  sessions?: number; quantity?: number; unitPrice: number; total: number; discount?: number;
}
export interface PresupuestoData {
  number: number; professionalName: string;
  patientName: string; patientRut?: string; date: string;
  items: PresupuestoItem[];
  subtotal: number; discount?: number; total: number;
}

export function buildPresupuestoBody(data: PresupuestoData, logoSrc?: string): string {
  const numStr = String(data.number).padStart(4, "0");
  const TH = `padding:6px 7px;border:1px solid #1f4e79;font-size:10px;font-weight:bold;background:#1f4e79;color:white`;
  const TD = `padding:6px 7px;border:1px solid #bcd2e8;font-size:10.5px`;

  const rows = data.items.map((it, i) => `
    <tr style="background:${i % 2 === 0 ? "#fff" : "#dce6f1"}">
      <td style="padding:5px 7px;text-align:center;border:1px solid #bcd2e8;font-size:10px;font-weight:bold">${i + 1}</td>
      <td style="padding:5px 7px;border:1px solid #bcd2e8;font-size:10px">${it.description}</td>
      <td style="padding:5px 7px;text-align:center;border:1px solid #bcd2e8;font-size:10px">${it.area || "—"}</td>
      <td style="padding:5px 7px;text-align:center;border:1px solid #bcd2e8;font-size:10px">${it.tooth || "—"}</td>
      <td style="padding:5px 7px;text-align:center;border:1px solid #bcd2e8;font-size:10px">${it.sessions ?? it.quantity ?? 1}</td>
      <td style="padding:5px 7px;text-align:right;border:1px solid #bcd2e8;font-size:10px">${fmt(it.total)}</td>
    </tr>
  `).join("");

  const emptyRows = Array.from({ length: Math.max(0, 8 - data.items.length) }, (_, i) => `
    <tr style="background:${(data.items.length + i) % 2 === 0 ? "#fff" : "#dce6f1"}">
      <td style="padding:5px 7px;border:1px solid #bcd2e8;height:22px"></td>
      <td style="border:1px solid #bcd2e8"></td><td style="border:1px solid #bcd2e8"></td>
      <td style="border:1px solid #bcd2e8"></td><td style="border:1px solid #bcd2e8"></td>
      <td style="border:1px solid #bcd2e8"></td>
    </tr>
  `).join("");

  return `
    ${clinicHeader(logoSrc)}
    <div style="text-align:center;margin:14px 0 10px">
      <div style="font-size:17px;font-weight:bold;letter-spacing:1px">PRESUPUESTO DENTAL</div>
      <div style="font-size:10px;font-style:italic;color:#555;margin-top:3px">N° ${numStr} &nbsp;·&nbsp; Válido por 30 días &nbsp;·&nbsp; ${CLINIC.address}</div>
    </div>
    ${profPatTable(
      { name: data.professionalName },
      { name: data.patientName, rut: data.patientRut, date: data.date }
    )}
    <table style="width:100%;border-collapse:collapse;margin:4px 0 14px">
      <thead><tr>
        <th style="${TH};text-align:center;width:5%">N°</th>
        <th style="${TH};text-align:left;width:30%">Tratamiento / Descripción</th>
        <th style="${TH};text-align:center;width:18%">Categoría</th>
        <th style="${TH};text-align:center;width:12%">Diente(s)</th>
        <th style="${TH};text-align:center;width:11%">Sesiones</th>
        <th style="${TH};text-align:right;width:24%">Precio ($)</th>
      </tr></thead>
      <tbody>
        ${rows}${emptyRows}
        <tr style="background:#f0f6ff">
          <td colspan="5" style="${TD};text-align:right;font-weight:bold">Subtotal</td>
          <td style="${TD};text-align:right;font-weight:bold">${fmt(data.subtotal)}</td>
        </tr>
        ${data.discount && data.discount > 0 ? `
        <tr style="background:#f0f6ff">
          <td colspan="5" style="${TD};text-align:right;font-weight:bold;color:#c0392b">Descuento</td>
          <td style="${TD};text-align:right;font-weight:bold;color:#c0392b">− ${fmt(data.discount)}</td>
        </tr>` : ""}
        <tr style="background:#1f4e79">
          <td colspan="5" style="${TD};text-align:right;font-weight:bold;color:white;font-size:12px">TOTAL A PAGAR</td>
          <td style="${TD};text-align:right;font-weight:bold;color:white;font-size:12px">${fmt(data.total)}</td>
        </tr>
      </tbody>
    </table>
    <div style="border:1px solid #bcd2e8;padding:10px 13px;background:#f0f6ff;border-radius:3px;font-size:9.5px;line-height:1.7">
      <div style="font-weight:bold;margin-bottom:4px;font-size:10.5px">Condiciones del Presupuesto</div>
      <div>• Este presupuesto tiene una validez de 30 días desde la fecha de emisión.</div>
      <div>• Algunos tratamientos están sujetos a diagnóstico definitivo; los costos pueden variar según hallazgos clínicos y/o radiográficos.</div>
      <div>• Los precios incluyen honorarios profesionales. Insumos especiales, exámenes o derivaciones no están incluidos salvo indicación.</div>
      <div>• Los tratamientos marcados con (*) requieren evaluación adicional antes de iniciar.</div>
    </div>
    ${docFooter("Firma Profesional", "Clínica Magna")}`;
}

export function buildPresupuestoHTML(data: PresupuestoData, logoSrc?: string): string {
  return wrapHtml(`Presupuesto N°${String(data.number).padStart(4, "0")}`, buildPresupuestoBody(data, logoSrc));
}

// ── INDICACIONES POST-PROCEDIMIENTO ──────────────────────────

export interface IndicacionesSections {
  primeras2h: string; primeras24h: string; general: string; alarma: string;
}
export interface IndicacionesData {
  professionalName: string; patientName: string; date: string;
  procedimiento: string; sections: IndicacionesSections; observaciones?: string;
}

export function buildIndicacionesBody(data: IndicacionesData, logoSrc?: string): string {
  function sec(title: string, label: string, text: string, bg: string, border: string): string {
    const lines = text.split("\n").filter(l => l.trim());
    const html  = lines.map(l => `<div style="margin-bottom:4px;font-size:10.5px;line-height:1.5">${l}</div>`).join("");
    return `
<div style="margin-bottom:10px">
  <div style="font-size:10.5px;font-weight:bold;color:#1a1a1a;background:${bg};border-left:3px solid ${border};padding:5px 8px;margin-bottom:5px;text-transform:uppercase;letter-spacing:0.3px">${label} ${title}</div>
  <div style="padding:0 8px">${html}</div>
</div>`;
  }

  return `
    ${clinicHeader(logoSrc)}
    <div style="text-align:center;margin:14px 0 4px">
      <div style="font-size:16px;font-weight:bold;letter-spacing:1px">INDICACIONES POST-PROCEDIMIENTO</div>
      <div style="font-size:10px;font-style:italic;color:#c0392b;margin-top:3px">Léa detenidamente antes de retirarse de la clínica</div>
    </div>
    ${profPatTable(
      { name: data.professionalName, showRut: false },
      { name: data.patientName, date: data.date,
        extra: [{ label: "Procedimiento realizado", value: data.procedimiento }] }
    )}
    <div style="font-size:11px;font-weight:bold;color:#1e6091;margin:10px 0 7px;text-transform:uppercase;letter-spacing:0.3px">
      Indicaciones — ${data.procedimiento}:
    </div>
    ${sec("Primeras 2 horas",   "[1]", data.sections.primeras2h,  "#fef3c7", "#f59e0b")}
    ${sec("Primeras 24 horas",  "[2]", data.sections.primeras24h, "#dbeafe", "#3b82f6")}
    ${sec("Cuidados generales", "[3]", data.sections.general,     "#d1fae5", "#10b981")}
    ${sec("Señales de alarma",  "[!]", data.sections.alarma,      "#fee2e2", "#ef4444")}
    ${data.observaciones ? `
    <div style="margin-top:12px">
      <div style="font-size:11px;font-weight:bold;color:#555;margin-bottom:5px;text-transform:uppercase">Observaciones adicionales:</div>
      <div style="border:1px solid #bcd2e8;padding:8px;background:#f8fafc;font-size:10.5px;line-height:1.7">${data.observaciones}</div>
    </div>` : ""}
    ${docFooter("Firma Profesional", "Clínica Magna")}
    <div style="margin-top:16px;text-align:center;font-size:9px;color:#888;border-top:1px solid #eee;padding-top:8px">
      ${CLINIC.phone} &nbsp;|&nbsp; ${CLINIC.email} &nbsp;|&nbsp; ${CLINIC.instagram}
    </div>`;
}

export function buildIndicacionesHTML(data: IndicacionesData, logoSrc?: string): string {
  return wrapHtml("Indicaciones Post-Procedimiento", buildIndicacionesBody(data, logoSrc));
}

// ── SOLICITUD DE RADIOGRAFÍA / SCANNER ───────────────────────

export interface RxDocItem { type: string; zone: string; }
export interface RadiografiaData {
  professionalName: string; professionalRut?: string;
  patientName: string; patientRut?: string; patientBirthDate?: string;
  date: string;
  items: RxDocItem[];
  indication?: string;
  observations?: string;
}

export function buildRadiografiaBody(data: RadiografiaData, logoSrc?: string): string {
  const TH = `padding:6px 7px;border:1px solid #1f4e79;font-size:10px;text-align:center;background:#1f4e79;color:white;font-weight:bold`;
  const rows = data.items.map((it, i) => `
    <tr style="background:${i % 2 === 0 ? "#fff" : "#f0f6ff"}">
      <td style="padding:5px 7px;text-align:center;border:1px solid #bcd2e8;font-size:10px;font-weight:bold">${i + 1}</td>
      <td style="padding:5px 7px;border:1px solid #bcd2e8;font-size:10.5px;font-weight:bold;text-transform:uppercase">${it.type || ""}</td>
      <td style="padding:5px 7px;border:1px solid #bcd2e8;font-size:10.5px">${it.zone || ""}</td>
    </tr>
  `).join("");

  const emptyRows = Array.from({ length: Math.max(0, 5 - data.items.length) }, (_, i) => `
    <tr style="background:${(data.items.length + i) % 2 === 0 ? "#fff" : "#f0f6ff"}">
      <td style="padding:5px 7px;border:1px solid #bcd2e8;height:22px;text-align:center;font-size:10px;color:#ccc">${data.items.length + i + 1}</td>
      <td style="border:1px solid #bcd2e8"></td>
      <td style="border:1px solid #bcd2e8"></td>
    </tr>
  `).join("");

  return `
    ${clinicHeader(logoSrc)}
    <div style="text-align:center;margin:14px 0 10px">
      <div style="font-size:17px;font-weight:bold;letter-spacing:1px">SOLICITUD DE RADIOGRAFÍA / SCANNER</div>
    </div>
    ${profPatTable(
      { name: data.professionalName, rut: data.professionalRut },
      { name: data.patientName, rut: data.patientRut, date: data.date,
        extra: data.patientBirthDate ? [{ label: "Fecha nac.", value: data.patientBirthDate }] : [] }
    )}
    <table style="width:100%;border-collapse:collapse;margin:4px 0 14px">
      <thead><tr>
        <th style="${TH};width:5%">N°</th>
        <th style="${TH};text-align:left;width:55%">Tipo de Examen Solicitado</th>
        <th style="${TH};text-align:left;width:40%">Zona / Diente</th>
      </tr></thead>
      <tbody>${rows}${emptyRows}</tbody>
    </table>
    <div style="margin-bottom:12px">
      <div style="font-size:11px;font-weight:bold;color:#2e75b6;margin-bottom:5px">INDICACIÓN CLÍNICA:</div>
      <div style="border:1px solid #bcd2e8;min-height:50px;padding:8px;background:#fff;font-size:10.5px">${data.indication ?? ""}</div>
    </div>
    <div style="margin-bottom:12px">
      <div style="font-size:11px;font-weight:bold;color:#2e75b6;margin-bottom:5px">OBSERVACIONES:</div>
      <div style="border:1px solid #bcd2e8;min-height:40px;padding:8px;background:#fff;font-size:10.5px">${data.observations ?? ""}</div>
    </div>
    ${docFooter("Firma y Timbre Profesional", "Clínica Magna")}
    <div style="margin-top:16px;text-align:center;font-size:9px;color:#888;border-top:1px solid #eee;padding-top:8px">
      Clínica Magna &nbsp;|&nbsp; Solicitud de Radiografía/Scanner &nbsp;|&nbsp; ${CLINIC.address}
    </div>`;
}

export function buildRadiografiaHTML(data: RadiografiaData, logoSrc?: string): string {
  return wrapHtml("Solicitud de Radiografía / Scanner", buildRadiografiaBody(data, logoSrc));
}
