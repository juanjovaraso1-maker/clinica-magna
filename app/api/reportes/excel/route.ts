import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { prisma } from "@/lib/prisma";
import ExcelJS from "exceljs";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

/* ── Colors ───────────────────────────────────────────────────────────── */
const CORP  = "FF1A1D2E";
const BLUE  = "FF0057FF";
const ALT   = "FFF0F4FF";
const WHITE = "FFFFFFFF";

/* ── Helpers ──────────────────────────────────────────────────────────── */
function colLetter(n: number): string {
  let s = "";
  while (n > 0) { s = String.fromCharCode(64 + (n % 26 || 26)) + s; n = Math.floor((n - 1) / 26); }
  return s;
}
function clp(n: number) { return `$${Math.round(n).toLocaleString("es-CL")}`; }
function pct(n: number, t: number) { return t ? `${((n / t) * 100).toFixed(1)}%` : "0%"; }
function fmtDate(s: string) {
  if (!s) return "";
  try { return new Date(s + "T12:00:00").toLocaleDateString("es-CL"); } catch { return s; }
}

function addTitle(ws: ExcelJS.Worksheet, title: string, subtitle: string, ncols: number) {
  const r1 = ws.addRow([title]);
  ws.mergeCells(`A1:${colLetter(ncols)}1`);
  const c1 = r1.getCell(1);
  c1.fill = { type: "pattern", pattern: "solid", fgColor: { argb: CORP } };
  c1.font = { bold: true, color: { argb: WHITE }, size: 14, name: "Calibri" };
  c1.alignment = { horizontal: "center", vertical: "middle" };
  r1.height = 32;
  const r2 = ws.addRow([subtitle]);
  ws.mergeCells(`A2:${colLetter(ncols)}2`);
  const c2 = r2.getCell(1);
  c2.font = { italic: true, color: { argb: "FF6B7280" }, size: 10 };
  c2.alignment = { horizontal: "center" };
  ws.addRow([]);
}

function setHeaders(ws: ExcelJS.Worksheet, headers: string[]) {
  const row = ws.addRow(headers);
  row.eachCell({ includeEmpty: true }, (cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BLUE } };
    cell.font = { bold: true, color: { argb: WHITE }, size: 10, name: "Calibri" };
    cell.alignment = { vertical: "middle", horizontal: "center" };
    cell.border = { bottom: { style: "medium", color: { argb: CORP } } };
  });
  row.height = 20;
  ws.autoFilter = { from: { row: row.number, column: 1 }, to: { row: row.number, column: headers.length } };
  ws.views = [{ state: "frozen", ySplit: row.number }];
  return row.number;
}

function addDataRow(ws: ExcelJS.Worksheet, values: (string | number | null)[], alt: boolean) {
  const row = ws.addRow(values.map(v => v ?? ""));
  row.eachCell({ includeEmpty: true }, (cell) => {
    if (alt) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: ALT } };
    cell.alignment = { vertical: "middle" };
    cell.border = { bottom: { style: "hair", color: { argb: "FFE3E8F0" } } };
  });
  row.height = 17;
  return row;
}

function addTotalRow(ws: ExcelJS.Worksheet, values: (string | number | null)[]) {
  const row = ws.addRow(values.map(v => v ?? ""));
  row.eachCell({ includeEmpty: true }, (cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE8F4FF" } };
    cell.font = { bold: true, size: 10 };
    cell.border = { top: { style: "medium", color: { argb: CORP } }, bottom: { style: "medium", color: { argb: CORP } } };
  });
  row.height = 20;
}

function addKpiRow(ws: ExcelJS.Worksheet, label: string, value: string | number) {
  const row = ws.addRow([label, value]);
  row.getCell(1).font = { color: { argb: "FF6B7280" }, size: 10 };
  row.getCell(2).font = { bold: true, size: 11 };
  row.getCell(2).alignment = { horizontal: "right" };
  row.height = 18;
}

/* ── Period parsing ───────────────────────────────────────────────────── */
function parsePeriod(period: string, value: string): { start: string; end: string; label: string } {
  if (period === "month" && value) {
    const [y, m] = value.split("-").map(Number);
    const lastDay = new Date(y, m, 0).getDate();
    return {
      start: `${value}-01`,
      end: `${value}-${String(lastDay).padStart(2, "0")}`,
      label: new Date(y, m - 1, 1).toLocaleDateString("es-CL", { month: "long", year: "numeric" }),
    };
  }
  if (period === "quarter" && value) {
    const [y, q] = value.split("-Q").map(Number);
    const sm = (q - 1) * 3 + 1, em = q * 3;
    const lastDay = new Date(y, em, 0).getDate();
    return {
      start: `${y}-${String(sm).padStart(2, "0")}-01`,
      end: `${y}-${String(em).padStart(2, "0")}-${lastDay}`,
      label: `Trimestre ${q} — ${y}`,
    };
  }
  if (period === "year" && value) {
    return { start: `${value}-01-01`, end: `${value}-12-31`, label: `Año ${value}` };
  }
  const n = new Date(); const y = n.getFullYear(); const m = n.getMonth() + 1; const ms = String(m).padStart(2, "0");
  return { start: `${y}-${ms}-01`, end: `${y}-${ms}-${new Date(y, m, 0).getDate()}`, label: n.toLocaleDateString("es-CL", { month: "long", year: "numeric" }) };
}

/* ══════════════════════════════════════════════════════════════════════ */
/* REPORTE 1 — FINANCIERO                                                  */
/* ══════════════════════════════════════════════════════════════════════ */
async function buildFinanciero(wb: ExcelJS.Workbook, start: string, end: string, label: string, profId: string) {
  const [payments, budgets, evolutions] = await Promise.all([
    prisma.payment.findMany({
      where: { date: { gte: start, lte: end } },
      include: { patient: { select: { firstName: true, lastName: true, rut: true } }, budget: { select: { number: true } } },
      orderBy: { date: "asc" },
    }),
    prisma.budget.findMany({
      where: { date: { gte: start, lte: end }, status: { not: "rejected" } },
      include: { patient: { select: { firstName: true, lastName: true, rut: true } }, payments: { select: { amount: true } } },
    }),
    prisma.evolution.findMany({
      where: { date: { gte: start, lte: end }, ...(profId !== "all" ? { userId: profId } : {}) },
      include: { user: { select: { name: true } } },
    }),
  ]);

  const allBudgets = await prisma.budget.findMany({ where: { status: { not: "rejected" } }, include: { payments: { select: { amount: true } } } });
  const saldoPorCobrar = allBudgets.reduce((s, b) => s + Math.max(0, b.total - b.payments.reduce((x, p) => x + p.amount, 0)), 0);
  const totalIngresos  = payments.reduce((s, p) => s + p.amount, 0);
  const totalDescuentos = budgets.reduce((s, b) => s + (b.discount ?? 0), 0);

  /* Sheet 1: Resumen */
  const ws1 = wb.addWorksheet("Resumen");
  ws1.columns = [{ width: 38 }, { width: 22 }];
  addTitle(ws1, "Resumen Financiero", label, 2);
  ws1.addRow([]);
  const kpis: [string, string | number][] = [
    ["Total Ingresos del período", clp(totalIngresos)],
    ["Presupuestos emitidos", budgets.length],
    ["Presupuestos pagados", budgets.filter(b => b.status === "paid").length],
    ["Presupuestos pendientes", budgets.filter(b => b.status !== "paid").length],
    ["Total descuentos otorgados", clp(totalDescuentos)],
    ["Saldo total por cobrar (histórico)", clp(saldoPorCobrar)],
  ];
  kpis.forEach(([l, v]) => addKpiRow(ws1, l, v));

  /* Sheet 2: Ingresos */
  const ws2 = wb.addWorksheet("Ingresos");
  ws2.columns = [{ width: 12 }, { width: 28 }, { width: 14 }, { width: 16 }, { width: 14 }, { width: 24 }, { width: 14 }];
  addTitle(ws2, "Detalle de Ingresos", label, 7);
  setHeaders(ws2, ["Fecha", "Paciente", "RUT", "Método", "N° Presupuesto", "Notas", "Monto"]);
  let totalPay = 0;
  payments.forEach((p, i) => {
    addDataRow(ws2, [fmtDate(p.date), `${p.patient.firstName} ${p.patient.lastName}`, p.patient.rut, p.method, p.budget ? String(p.budget.number) : "—", p.notes ?? "—", clp(p.amount)], i % 2 === 1);
    totalPay += p.amount;
  });
  addTotalRow(ws2, ["TOTAL", "", "", "", "", "", clp(totalPay)]);

  /* Sheet 3: Por Profesional */
  const ws3 = wb.addWorksheet("Por Profesional");
  ws3.columns = [{ width: 28 }, { width: 16 }, { width: 18 }, { width: 14 }];
  addTitle(ws3, "Ingresos por Profesional", label, 4);
  setHeaders(ws3, ["Profesional", "N° Atenciones", "Monto Total", "% del Total"]);
  const byProf: Record<string, { name: string; count: number; total: number }> = {};
  evolutions.forEach(e => {
    if (!byProf[e.userId]) byProf[e.userId] = { name: e.user?.name ?? "Sin asignar", count: 0, total: 0 };
    byProf[e.userId].count++;
    byProf[e.userId].total += e.cost ?? 0;
  });
  const profRows = Object.values(byProf).sort((a, b) => b.total - a.total);
  const totalProf = profRows.reduce((s, r) => s + r.total, 0);
  profRows.forEach((r, i) => addDataRow(ws3, [r.name, r.count, clp(r.total), pct(r.total, totalProf)], i % 2 === 1));
  addTotalRow(ws3, ["TOTAL", profRows.reduce((s, r) => s + r.count, 0), clp(totalProf), "100%"]);

  /* Sheet 4: Por Tratamiento */
  const ws4 = wb.addWorksheet("Por Tratamiento");
  ws4.columns = [{ width: 36 }, { width: 12 }, { width: 18 }, { width: 14 }];
  addTitle(ws4, "Ingresos por Tratamiento", label, 4);
  setHeaders(ws4, ["Tratamiento", "Cantidad", "Monto Total", "% del Total"]);
  const byTreat: Record<string, { count: number; total: number }> = {};
  evolutions.forEach(e => {
    const k = e.treatment ?? "Sin especificar";
    if (!byTreat[k]) byTreat[k] = { count: 0, total: 0 };
    byTreat[k].count++;
    byTreat[k].total += e.cost ?? 0;
  });
  const treatRows = Object.entries(byTreat).sort((a, b) => b[1].total - a[1].total);
  const totalTreat = treatRows.reduce((s, [, r]) => s + r.total, 0);
  treatRows.forEach(([name, r], i) => addDataRow(ws4, [name, r.count, clp(r.total), pct(r.total, totalTreat)], i % 2 === 1));
  addTotalRow(ws4, ["TOTAL", treatRows.reduce((s, [, r]) => s + r.count, 0), clp(totalTreat), "100%"]);

  /* Sheet 5: Presupuestos */
  const ws5 = wb.addWorksheet("Presupuestos");
  ws5.columns = [{ width: 8 }, { width: 12 }, { width: 28 }, { width: 14 }, { width: 14 }, { width: 14 }, { width: 14 }];
  addTitle(ws5, "Presupuestos del Período", label, 7);
  setHeaders(ws5, ["N°", "Fecha", "Paciente", "Subtotal", "Descuento", "Total", "Saldo"]);
  let totTotal = 0, totSaldo = 0;
  budgets.forEach((b, i) => {
    const pagado = b.payments.reduce((s, p) => s + p.amount, 0);
    const saldo = Math.max(0, b.total - pagado);
    totTotal += b.total; totSaldo += saldo;
    addDataRow(ws5, [b.number, fmtDate(b.date), `${b.patient.firstName} ${b.patient.lastName}`, clp(b.subtotal), clp(b.discount), clp(b.total), clp(saldo)], i % 2 === 1);
  });
  addTotalRow(ws5, ["", "", "TOTAL", "", "", clp(totTotal), clp(totSaldo)]);
}

/* ══════════════════════════════════════════════════════════════════════ */
/* REPORTE 2 — TRATAMIENTOS                                                */
/* ══════════════════════════════════════════════════════════════════════ */
async function buildTratamientos(wb: ExcelJS.Workbook, start: string, end: string, label: string, profId: string) {
  const [evolutions, budgetItems] = await Promise.all([
    prisma.evolution.findMany({
      where: { date: { gte: start, lte: end }, ...(profId !== "all" ? { userId: profId } : {}) },
      include: { patient: { select: { firstName: true, lastName: true, rut: true } }, user: { select: { name: true } } },
      orderBy: { date: "asc" },
    }),
    prisma.budgetItem.findMany({
      where: { status: { in: ["pending", "in_progress"] } },
      include: { budget: { include: { patient: { select: { firstName: true, lastName: true, rut: true } }, user: { select: { name: true } } } } },
    }),
  ]);

  /* Sheet 1: Evoluciones */
  const ws1 = wb.addWorksheet("Evoluciones");
  ws1.columns = [{ width: 12 }, { width: 26 }, { width: 14 }, { width: 30 }, { width: 10 }, { width: 20 }, { width: 14 }, { width: 28 }];
  addTitle(ws1, "Tratamientos Realizados", label, 8);
  setHeaders(ws1, ["Fecha", "Paciente", "RUT", "Tratamiento", "Diente", "Profesional", "Monto", "Observaciones"]);
  let total = 0;
  evolutions.forEach((e, i) => {
    addDataRow(ws1, [fmtDate(e.date), `${e.patient.firstName} ${e.patient.lastName}`, e.patient.rut, e.treatment ?? "—", e.tooth ?? "—", e.user?.name ?? "—", clp(e.cost ?? 0), e.observations ?? "—"], i % 2 === 1);
    total += e.cost ?? 0;
  });
  addTotalRow(ws1, ["TOTAL", "", "", "", "", "", clp(total), ""]);

  /* Sheet 2: Ranking */
  const ws2 = wb.addWorksheet("Ranking");
  ws2.columns = [{ width: 36 }, { width: 12 }, { width: 18 }, { width: 14 }];
  addTitle(ws2, "Ranking de Tratamientos", label, 4);
  setHeaders(ws2, ["Tratamiento", "Cantidad", "Monto Total", "% del Total"]);
  const rank: Record<string, { count: number; total: number }> = {};
  evolutions.forEach(e => {
    const k = e.treatment ?? "Sin especificar";
    if (!rank[k]) rank[k] = { count: 0, total: 0 };
    rank[k].count++;
    rank[k].total += e.cost ?? 0;
  });
  const rankRows = Object.entries(rank).sort((a, b) => b[1].count - a[1].count);
  const rankTotal = rankRows.reduce((s, [, r]) => s + r.count, 0);
  rankRows.forEach(([name, r], i) => addDataRow(ws2, [name, r.count, clp(r.total), pct(r.count, rankTotal)], i % 2 === 1));
  addTotalRow(ws2, ["TOTAL", rankTotal, clp(rankRows.reduce((s, [, r]) => s + r.total, 0)), "100%"]);

  /* Sheet 3: Pendientes */
  const ws3 = wb.addWorksheet("Pendientes");
  ws3.columns = [{ width: 26 }, { width: 14 }, { width: 30 }, { width: 10 }, { width: 14 }, { width: 16 }, { width: 20 }];
  addTitle(ws3, "Tratamientos Pendientes y En Curso", "Todos los períodos", 7);
  setHeaders(ws3, ["Paciente", "RUT", "Tratamiento", "Diente", "Valor", "Estado", "Profesional"]);
  budgetItems.forEach((item, i) => {
    const p = item.budget.patient;
    addDataRow(ws3, [`${p.firstName} ${p.lastName}`, p.rut, item.description, item.tooth ?? "—", clp(item.unitPrice), item.status === "in_progress" ? "En curso" : "Pendiente", item.budget.user?.name ?? "—"], i % 2 === 1);
  });
}

/* ══════════════════════════════════════════════════════════════════════ */
/* REPORTE 3 — PACIENTES                                                   */
/* ══════════════════════════════════════════════════════════════════════ */
async function buildPacientes(wb: ExcelJS.Workbook, start: string, end: string, label: string) {
  const now = new Date();
  const cutoff180 = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  const [patients, appointments, evolutions, budgets] = await Promise.all([
    prisma.patient.findMany({ where: { active: true }, orderBy: { createdAt: "asc" } }),
    prisma.appointment.findMany({ select: { patientId: true, date: true } }),
    prisma.evolution.findMany({ select: { patientId: true, date: true } }),
    prisma.budget.findMany({ where: { status: { in: ["pending", "approved"] } }, include: { patient: { select: { firstName: true, lastName: true, rut: true } } } }),
  ]);

  const lastActivity: Record<string, string> = {};
  [...appointments, ...evolutions].forEach(a => {
    if (!lastActivity[a.patientId] || a.date > lastActivity[a.patientId]) lastActivity[a.patientId] = a.date;
  });

  const newInPeriod = patients.filter(p => { const d = p.createdAt.toISOString().split("T")[0]; return d >= start && d <= end; });
  const ageGroups: Record<string, number> = { "0-12": 0, "13-17": 0, "18-30": 0, "31-45": 0, "46-60": 0, "60+": 0, "Sin datos": 0 };
  const genderGroups: Record<string, number> = { "Masculino": 0, "Femenino": 0, "No especificado": 0 };
  patients.forEach(p => {
    if (!p.birthDate) ageGroups["Sin datos"]++;
    else {
      const age = Math.floor((now.getTime() - new Date(p.birthDate).getTime()) / (1000 * 60 * 60 * 24 * 365.25));
      if (age <= 12) ageGroups["0-12"]++;
      else if (age <= 17) ageGroups["13-17"]++;
      else if (age <= 30) ageGroups["18-30"]++;
      else if (age <= 45) ageGroups["31-45"]++;
      else if (age <= 60) ageGroups["46-60"]++;
      else ageGroups["60+"]++;
    }
    if (p.gender === "M") genderGroups["Masculino"]++;
    else if (p.gender === "F") genderGroups["Femenino"]++;
    else genderGroups["No especificado"]++;
  });

  /* Sheet 1: Resumen */
  const ws1 = wb.addWorksheet("Resumen");
  ws1.columns = [{ width: 32 }, { width: 14 }];
  addTitle(ws1, "Resumen de Pacientes", label, 2);
  ws1.addRow([]);
  addKpiRow(ws1, "Total pacientes activos", patients.length);
  addKpiRow(ws1, `Nuevos en ${label}`, newInPeriod.length);
  ws1.addRow([]);
  ws1.addRow(["Género"]).getCell(1).font = { bold: true };
  Object.entries(genderGroups).forEach(([k, v]) => v > 0 && addKpiRow(ws1, `  ${k}`, v));
  ws1.addRow([]);
  ws1.addRow(["Distribución etaria"]).getCell(1).font = { bold: true };
  Object.entries(ageGroups).forEach(([k, v]) => v > 0 && addKpiRow(ws1, `  ${k} años`, v));

  /* Sheet 2: Nuevos */
  const ws2 = wb.addWorksheet("Nuevos Pacientes");
  ws2.columns = [{ width: 14 }, { width: 26 }, { width: 14 }, { width: 16 }, { width: 26 }, { width: 10 }, { width: 20 }];
  addTitle(ws2, "Nuevos Pacientes", label, 7);
  setHeaders(ws2, ["Fecha Ingreso", "Nombre", "RUT", "Teléfono", "Email", "Género", "Ciudad"]);
  newInPeriod.forEach((p, i) => addDataRow(ws2, [fmtDate(p.createdAt.toISOString().split("T")[0]), `${p.firstName} ${p.lastName}`, p.rut, p.phone ?? "—", p.email ?? "—", p.gender === "M" ? "Masculino" : p.gender === "F" ? "Femenino" : "—", p.city ?? "—"], i % 2 === 1));

  /* Sheet 3: Sin actividad 6 meses */
  const ws3 = wb.addWorksheet("Sin Actividad 6 Meses");
  ws3.columns = [{ width: 26 }, { width: 14 }, { width: 16 }, { width: 26 }, { width: 20 }, { width: 18 }];
  addTitle(ws3, "Pacientes Sin Actividad +6 Meses", "Para reactivación", 6);
  setHeaders(ws3, ["Nombre", "RUT", "Teléfono", "Email", "Última Actividad", "Días Sin Actividad"]);
  const inactivos = patients.filter(p => { const la = lastActivity[p.id]; return !la || la < cutoff180; })
    .sort((a, b) => (lastActivity[a.id] ?? "0000").localeCompare(lastActivity[b.id] ?? "0000"));
  inactivos.forEach((p, i) => {
    const la = lastActivity[p.id];
    const days = la ? Math.floor((now.getTime() - new Date(la + "T12:00:00").getTime()) / (1000 * 60 * 60 * 24)) : null;
    addDataRow(ws3, [`${p.firstName} ${p.lastName}`, p.rut, p.phone ?? "—", p.email ?? "—", la ? fmtDate(la) : "Sin actividad", days ?? "Sin registros"], i % 2 === 1);
  });

  /* Sheet 4: Presupuesto sin iniciar */
  const ws4 = wb.addWorksheet("Presupuesto Sin Iniciar");
  ws4.columns = [{ width: 26 }, { width: 14 }, { width: 14 }, { width: 14 }, { width: 14 }, { width: 14 }];
  addTitle(ws4, "Pacientes con Presupuesto Sin Iniciar", "", 6);
  setHeaders(ws4, ["Paciente", "RUT", "N° Presupuesto", "Fecha", "Total", "Estado"]);
  const evolPatients = new Set(evolutions.map(e => e.patientId));
  budgets.filter(b => !evolPatients.has(b.patientId)).forEach((b, i) => {
    addDataRow(ws4, [`${b.patient.firstName} ${b.patient.lastName}`, b.patient.rut, b.number, fmtDate(b.date), clp(b.total), b.status === "approved" ? "Aprobado" : "Pendiente"], i % 2 === 1);
  });
}

/* ══════════════════════════════════════════════════════════════════════ */
/* REPORTE 4 — MARKETING                                                   */
/* ══════════════════════════════════════════════════════════════════════ */
async function buildMarketing(wb: ExcelJS.Workbook, start: string, end: string, label: string) {
  const patients = await prisma.patient.findMany({
    where: { createdAt: { gte: new Date(start), lte: new Date(end + "T23:59:59") } },
    select: { id: true, firstName: true, lastName: true, rut: true, createdAt: true, referralSource: true },
    orderBy: { createdAt: "asc" },
  });

  const SOURCES = ["Referido", "Instagram", "Facebook", "Google", "TikTok", "Otro"];
  const src = (p: { referralSource: string | null }) => p.referralSource || "Sin datos";
  const total = patients.length;

  /* Sheet 1: Resumen canal */
  const ws1 = wb.addWorksheet("Resumen Canal");
  ws1.columns = [{ width: 20 }, { width: 18 }, { width: 14 }];
  addTitle(ws1, "Captación por Canal", label, 3);
  setHeaders(ws1, ["Canal", "Pacientes Nuevos", "% del Total"]);
  const canalCount: Record<string, number> = {};
  patients.forEach(p => { const s = src(p); canalCount[s] = (canalCount[s] ?? 0) + 1; });
  [...SOURCES, "Sin datos"].forEach((s, i) => {
    const c = canalCount[s] ?? 0;
    if (c > 0) addDataRow(ws1, [s, c, pct(c, total)], i % 2 === 1);
  });
  addTotalRow(ws1, ["TOTAL", total, "100%"]);
  const topCanal = Object.entries(canalCount).sort((a, b) => b[1] - a[1])[0];
  ws1.addRow([]);
  const r = ws1.addRow([`Canal con mayor conversión: ${topCanal?.[0] ?? "—"} (${topCanal?.[1] ?? 0} pacientes)`]);
  r.getCell(1).font = { bold: true, color: { argb: BLUE } };

  /* Sheet 2: Evolución mensual */
  const headers2 = ["Mes", ...SOURCES, "Sin datos", "Total"];
  const ws2 = wb.addWorksheet("Evolución Mensual");
  ws2.columns = headers2.map(h => ({ width: h === "Mes" ? 16 : 13 }));
  addTitle(ws2, "Evolución Mensual por Canal", label, headers2.length);
  setHeaders(ws2, headers2);
  const startD = new Date(start); const endD = new Date(end + "T23:59:59");
  const months: string[] = [];
  let cur = new Date(startD.getFullYear(), startD.getMonth(), 1);
  while (cur <= endD) {
    months.push(`${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, "0")}`);
    cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
  }
  months.forEach((m, mi) => {
    const monthLabel = new Date(m + "-01T12:00:00").toLocaleDateString("es-CL", { month: "short", year: "2-digit" });
    const mPats = patients.filter(p => p.createdAt.toISOString().startsWith(m));
    const row: (string | number)[] = [monthLabel];
    let rowTotal = 0;
    [...SOURCES, "Sin datos"].forEach(s => { const c = mPats.filter(p => src(p) === s).length; row.push(c); rowTotal += c; });
    row.push(rowTotal);
    addDataRow(ws2, row, mi % 2 === 1);
  });

  /* Sheet 3: Detalle */
  const ws3 = wb.addWorksheet("Detalle Pacientes");
  ws3.columns = [{ width: 26 }, { width: 14 }, { width: 14 }, { width: 16 }];
  addTitle(ws3, "Detalle de Nuevos Pacientes", label, 4);
  setHeaders(ws3, ["Nombre", "RUT", "Fecha Ingreso", "Canal"]);
  patients.forEach((p, i) => addDataRow(ws3, [`${p.firstName} ${p.lastName}`, p.rut, fmtDate(p.createdAt.toISOString().split("T")[0]), src(p)], i % 2 === 1));
}

/* ══════════════════════════════════════════════════════════════════════ */
/* REPORTE 5 — AGENDA                                                      */
/* ══════════════════════════════════════════════════════════════════════ */
async function buildAgenda(wb: ExcelJS.Workbook, start: string, end: string, label: string, profId: string) {
  const appointments = await prisma.appointment.findMany({
    where: { date: { gte: start, lte: end }, ...(profId !== "all" ? { userId: profId } : {}) },
    include: { patient: { select: { firstName: true, lastName: true, rut: true } }, user: { select: { name: true } } },
    orderBy: [{ date: "asc" }, { startTime: "asc" }],
  });

  const STATUS_ES: Record<string, string> = { scheduled: "Agendada", confirmed: "Confirmada", completed: "Completada", cancelled: "Cancelada", "no-show": "No asistió" };
  const completadas = appointments.filter(a => a.status === "completed").length;
  const canceladas  = appointments.filter(a => a.status === "cancelled").length;
  const noShow      = appointments.filter(a => a.status === "no-show").length;
  const total       = appointments.length;

  /* Sheet 1: Resumen */
  const ws1 = wb.addWorksheet("Resumen");
  ws1.columns = [{ width: 32 }, { width: 16 }];
  addTitle(ws1, "Resumen de Agenda", label, 2);
  ws1.addRow([]);
  [["Total citas", total], ["Completadas", completadas], ["Canceladas", canceladas], ["Sin asistencia", noShow], ["Tasa de asistencia", pct(completadas, total)], ["Tasa de ausentismo", pct(noShow, total)]].forEach(([l, v]) => addKpiRow(ws1, String(l), String(v)));

  /* Sheet 2: Detalle */
  const ws2 = wb.addWorksheet("Detalle");
  ws2.columns = [{ width: 12 }, { width: 8 }, { width: 26 }, { width: 14 }, { width: 20 }, { width: 20 }, { width: 16 }, { width: 6 }];
  addTitle(ws2, "Detalle de Citas", label, 8);
  setHeaders(ws2, ["Fecha", "Hora", "Paciente", "RUT", "Tipo", "Profesional", "Estado", "Box"]);
  appointments.forEach((a, i) => addDataRow(ws2, [fmtDate(a.date), a.startTime, `${a.patient.firstName} ${a.patient.lastName}`, a.patient.rut, a.type, a.user?.name ?? "—", STATUS_ES[a.status] ?? a.status, a.box], i % 2 === 1));

  /* Sheet 3: Por Profesional */
  const ws3 = wb.addWorksheet("Por Profesional");
  ws3.columns = [{ width: 28 }, { width: 10 }, { width: 14 }, { width: 14 }, { width: 18 }, { width: 16 }];
  addTitle(ws3, "Citas por Profesional", label, 6);
  setHeaders(ws3, ["Profesional", "Total", "Completadas", "Canceladas", "Sin Asistencia", "% Asistencia"]);
  const byProf: Record<string, { name: string; total: number; comp: number; canc: number; ns: number }> = {};
  appointments.forEach(a => {
    if (!byProf[a.userId]) byProf[a.userId] = { name: a.user?.name ?? "Sin asignar", total: 0, comp: 0, canc: 0, ns: 0 };
    byProf[a.userId].total++;
    if (a.status === "completed") byProf[a.userId].comp++;
    if (a.status === "cancelled") byProf[a.userId].canc++;
    if (a.status === "no-show") byProf[a.userId].ns++;
  });
  Object.values(byProf).sort((a, b) => b.total - a.total).forEach((r, i) => addDataRow(ws3, [r.name, r.total, r.comp, r.canc, r.ns, pct(r.comp, r.total)], i % 2 === 1));

  /* Sheet 4: Por Día de Semana */
  const ws4 = wb.addWorksheet("Por Día de Semana");
  ws4.columns = [{ width: 16 }, { width: 10 }, { width: 14 }, { width: 14 }, { width: 16 }];
  addTitle(ws4, "Citas por Día de Semana", label, 5);
  setHeaders(ws4, ["Día", "Total", "Completadas", "Canceladas", "% Asistencia"]);
  const DAYS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
  const byDay: Record<number, { total: number; comp: number; canc: number }> = {};
  for (let i = 0; i < 7; i++) byDay[i] = { total: 0, comp: 0, canc: 0 };
  appointments.forEach(a => {
    const d = new Date(a.date + "T12:00:00").getDay();
    byDay[d].total++;
    if (a.status === "completed") byDay[d].comp++;
    if (a.status === "cancelled") byDay[d].canc++;
  });
  [1, 2, 3, 4, 5, 6, 0].forEach((d, i) => { const r = byDay[d]; if (r.total > 0) addDataRow(ws4, [DAYS[d], r.total, r.comp, r.canc, pct(r.comp, r.total)], i % 2 === 1); });

  /* Sheet 5: Por Hora */
  const ws5 = wb.addWorksheet("Por Hora");
  ws5.columns = [{ width: 14 }, { width: 12 }];
  addTitle(ws5, "Citas por Horario", label, 2);
  setHeaders(ws5, ["Hora", "N° Citas"]);
  const byHour: Record<string, number> = {};
  appointments.forEach(a => { const h = (a.startTime ?? "00:00").slice(0, 2) + ":00"; byHour[h] = (byHour[h] ?? 0) + 1; });
  Object.entries(byHour).sort().forEach(([h, c], i) => addDataRow(ws5, [h, c], i % 2 === 1));
}

/* ══════════════════════════════════════════════════════════════════════ */
/* REPORTE 6 — PRESUPUESTOS                                                */
/* ══════════════════════════════════════════════════════════════════════ */
async function buildPresupuestos(wb: ExcelJS.Workbook, start: string, end: string, label: string) {
  const cutoff30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  const budgets = await prisma.budget.findMany({
    where: { date: { gte: start, lte: end } },
    include: {
      patient: { select: { firstName: true, lastName: true, rut: true } },
      user: { select: { name: true } },
      payments: { select: { amount: true, date: true } },
    },
    orderBy: { number: "asc" },
  });

  const STATUS_ES: Record<string, string> = { pending: "Pendiente", approved: "Aprobado", paid: "Pagado", rejected: "Rechazado" };

  /* Sheet 1: Listado */
  const ws1 = wb.addWorksheet("Listado");
  ws1.columns = [{ width: 8 }, { width: 12 }, { width: 26 }, { width: 20 }, { width: 14 }, { width: 14 }, { width: 12 }, { width: 14 }, { width: 14 }];
  addTitle(ws1, "Listado de Presupuestos", label, 9);
  setHeaders(ws1, ["N°", "Fecha", "Paciente", "Profesional", "Estado", "Subtotal", "Descuento", "Total", "Saldo"]);
  let tTotal = 0, tSaldo = 0;
  budgets.forEach((b, i) => {
    const pagado = b.payments.reduce((s, p) => s + p.amount, 0);
    const saldo = Math.max(0, b.total - pagado);
    tTotal += b.total; tSaldo += saldo;
    addDataRow(ws1, [b.number, fmtDate(b.date), `${b.patient.firstName} ${b.patient.lastName}`, b.user?.name ?? "—", STATUS_ES[b.status] ?? b.status, clp(b.subtotal), clp(b.discount), clp(b.total), clp(saldo)], i % 2 === 1);
  });
  addTotalRow(ws1, ["", "", "TOTAL", "", "", "", "", clp(tTotal), clp(tSaldo)]);

  /* Sheet 2: Vencidos */
  const ws2 = wb.addWorksheet("Vencidos");
  ws2.columns = [{ width: 8 }, { width: 12 }, { width: 26 }, { width: 14 }, { width: 14 }, { width: 14 }, { width: 16 }];
  addTitle(ws2, "Presupuestos Vencidos (+30 días sin pago)", "", 7);
  setHeaders(ws2, ["N°", "Fecha", "Paciente", "Total", "Pagado", "Saldo", "Días Vencido"]);
  const vencidos = budgets.filter(b => b.status !== "paid" && b.status !== "rejected" && b.date < cutoff30);
  vencidos.forEach((b, i) => {
    const pagado = b.payments.reduce((s, p) => s + p.amount, 0);
    const saldo = Math.max(0, b.total - pagado);
    const dias = Math.floor((Date.now() - new Date(b.date + "T12:00:00").getTime()) / (1000 * 60 * 60 * 24));
    addDataRow(ws2, [b.number, fmtDate(b.date), `${b.patient.firstName} ${b.patient.lastName}`, clp(b.total), clp(pagado), clp(saldo), dias], i % 2 === 1);
  });
  if (vencidos.length === 0) ws2.addRow(["Sin presupuestos vencidos en el período"]);

  /* Sheet 3: Tiempo de pago */
  const ws3 = wb.addWorksheet("Tiempo de Pago");
  ws3.columns = [{ width: 8 }, { width: 26 }, { width: 14 }, { width: 20 }, { width: 16 }];
  addTitle(ws3, "Tiempo Entre Emisión y Pago", "Solo presupuestos pagados", 5);
  setHeaders(ws3, ["N°", "Paciente", "Fecha Emisión", "Fecha Último Pago", "Días Hasta Pago"]);
  const pagados = budgets.filter(b => b.status === "paid" && b.payments.length > 0);
  let totalDias = 0;
  pagados.forEach((b, i) => {
    const lastPay = b.payments.map(p => p.date).sort().pop()!;
    const dias = Math.max(0, Math.floor((new Date(lastPay + "T12:00:00").getTime() - new Date(b.date + "T12:00:00").getTime()) / (1000 * 60 * 60 * 24)));
    totalDias += dias;
    addDataRow(ws3, [b.number, `${b.patient.firstName} ${b.patient.lastName}`, fmtDate(b.date), fmtDate(lastPay), dias], i % 2 === 1);
  });
  if (pagados.length > 0) addTotalRow(ws3, ["", "PROMEDIO", "", "", Math.round(totalDias / pagados.length)]);
  else ws3.addRow(["Sin presupuestos pagados en el período"]);
}

/* ══════════════════════════════════════════════════════════════════════ */
/* MAIN HANDLER                                                            */
/* ══════════════════════════════════════════════════════════════════════ */
export async function GET(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const sp          = req.nextUrl.searchParams;
  const type        = sp.get("type") ?? "financiero";
  const period      = sp.get("period") ?? "month";
  const value       = sp.get("value") ?? "";
  const profesional = sp.get("profesional") ?? "all";

  const { start, end, label } = parsePeriod(period, value);

  const wb = new ExcelJS.Workbook();
  wb.creator = "Clínica Magna";
  wb.created = new Date();

  switch (type) {
    case "financiero":    await buildFinanciero(wb, start, end, label, profesional); break;
    case "tratamientos":  await buildTratamientos(wb, start, end, label, profesional); break;
    case "pacientes":     await buildPacientes(wb, start, end, label); break;
    case "marketing":     await buildMarketing(wb, start, end, label); break;
    case "agenda":        await buildAgenda(wb, start, end, label, profesional); break;
    case "presupuestos":  await buildPresupuestos(wb, start, end, label); break;
    default:              await buildFinanciero(wb, start, end, label, profesional);
  }

  const buffer   = await wb.xlsx.writeBuffer();
  const date     = new Date().toISOString().slice(0, 10);
  const filename = `reporte-${type}-clinica-magna-${date}.xlsx`;

  return new NextResponse(buffer as any, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
