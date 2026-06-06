import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

// ── Period parsing ──────────────────────────────────────────────────────────
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
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  const ms = String(m).padStart(2, "0");
  return {
    start: `${y}-${ms}-01`,
    end: `${y}-${ms}-${new Date(y, m, 0).getDate()}`,
    label: now.toLocaleDateString("es-CL", { month: "long", year: "numeric" }),
  };
}

// ── Styling constants ───────────────────────────────────────────────────────
const CORP = "FF1A1D2E";
const BLUE = "FF0057FF";
const ALT = "FFF0F4FF";

function colLetter(n: number): string {
  let s = "";
  while (n > 0) {
    s = String.fromCharCode(64 + ((n % 26) || 26)) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function addTitle(ws: ExcelJS.Worksheet, title: string, subtitle: string, ncols: number) {
  const r1 = ws.addRow([title]);
  ws.mergeCells(`A1:${colLetter(ncols)}1`);
  r1.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: CORP } };
  r1.getCell(1).font = { bold: true, color: { argb: "FFFFFFFF" }, size: 14, name: "Calibri" };
  r1.getCell(1).alignment = { horizontal: "center", vertical: "middle" };
  r1.height = 32;
  const r2 = ws.addRow([subtitle]);
  ws.mergeCells(`A2:${colLetter(ncols)}2`);
  r2.getCell(1).font = { italic: true, color: { argb: "FF6B7280" }, size: 10 };
  r2.getCell(1).alignment = { horizontal: "center" };
  ws.addRow([]); // spacer
}

function setHeaders(ws: ExcelJS.Worksheet, headers: string[]): ExcelJS.Row {
  const row = ws.addRow(headers);
  row.eachCell({ includeEmpty: true }, (cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BLUE } };
    cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10, name: "Calibri" };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: false };
    cell.border = { bottom: { style: "medium", color: { argb: CORP } } };
  });
  row.height = 20;
  return row;
}

function addDataRow(ws: ExcelJS.Worksheet, values: (string | number | null)[], alt: boolean): ExcelJS.Row {
  const row = ws.addRow(values);
  row.eachCell({ includeEmpty: true }, (cell) => {
    if (alt) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: ALT } };
    cell.alignment = { vertical: "middle" };
    cell.border = { bottom: { style: "hair", color: { argb: "FFE3E8F0" } } };
  });
  row.height = 17;
  return row;
}

function addTotalRow(ws: ExcelJS.Worksheet, values: (string | number | null)[]): ExcelJS.Row {
  const row = ws.addRow(values);
  row.eachCell({ includeEmpty: true }, (cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE8F4FF" } };
    cell.font = { bold: true, size: 10 };
    cell.border = {
      top: { style: "medium", color: { argb: CORP } },
      bottom: { style: "medium", color: { argb: CORP } },
    };
  });
  row.height = 20;
  return row;
}

function pct(n: number, total: number) {
  return total ? `${((n / total) * 100).toFixed(1)}%` : "0%";
}

function clp(n: number) {
  return `$${Math.round(n).toLocaleString("es-CL")}`;
}

function setColWidths(ws: ExcelJS.Worksheet, widths: number[]) {
  widths.forEach((w, i) => {
    ws.getColumn(i + 1).width = w;
  });
}

// ── Report builders ─────────────────────────────────────────────────────────

async function buildFinanciero(wb: ExcelJS.Workbook, start: string, end: string, label: string, profesional: string) {
  const profFilter = profesional !== "all" ? { userId: profesional } : {};

  const [payments, expenses, budgets, evolutions] = await Promise.all([
    prisma.payment.findMany({
      where: { date: { gte: start, lte: end } },
      include: { patient: { select: { firstName: true, lastName: true, rut: true } }, budget: { select: { number: true } } },
    }),
    prisma.expense.findMany({ where: { date: { gte: start, lte: end } } }),
    prisma.budget.findMany({
      where: { date: { gte: start, lte: end } },
      include: {
        patient: { select: { firstName: true, lastName: true, rut: true } },
        user: { select: { name: true } },
        items: true,
        payments: { select: { amount: true } },
      },
    }),
    prisma.evolution.findMany({
      where: { date: { gte: start, lte: end }, ...profFilter },
      include: { user: { select: { id: true, name: true } } },
    }),
  ]);

  // All budgets for saldo por cobrar
  const allBudgets = await prisma.budget.findMany({
    where: { status: { not: "rejected" } },
    include: { payments: { select: { amount: true } } },
  });

  const totalIncome = payments.reduce((s, p) => s + p.amount, 0);
  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);
  const totalDiscount = budgets.reduce((s, b) => s + b.discount, 0);
  const saldoCobrar = allBudgets.reduce((s, b) => {
    const paid = b.payments.reduce((ps, p) => ps + p.amount, 0);
    const bal = b.total - paid;
    return s + (bal > 0 ? bal : 0);
  }, 0);

  const paid_budgets = budgets.filter(b => b.status === "paid" || b.payments.reduce((s, p) => s + p.amount, 0) >= b.total);
  const pending_budgets = budgets.filter(b => {
    const paid = b.payments.reduce((s, p) => s + p.amount, 0);
    return paid < b.total && b.status !== "rejected";
  });

  // ── Sheet 1: Resumen ──
  {
    const ws = wb.addWorksheet("Resumen");
    addTitle(ws, "Reporte Financiero — Clínica Magna", label, 2);
    setColWidths(ws, [35, 20]);

    const kpis = [
      ["Total Ingresos", clp(totalIncome)],
      ["Total Gastos", clp(totalExpenses)],
      ["Resultado Neto", clp(totalIncome - totalExpenses)],
      ["N° Presupuestos emitidos", budgets.length],
      ["Presupuestos pagados", paid_budgets.length],
      ["Presupuestos pendientes", pending_budgets.length],
      ["Total descuentos otorgados", clp(totalDiscount)],
      ["Saldo total por cobrar", clp(saldoCobrar)],
    ];

    const hRow = ws.addRow(["Indicador", "Valor"]);
    hRow.eachCell((cell) => {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: CORP } };
      cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
      cell.alignment = { horizontal: "center", vertical: "middle" };
    });
    hRow.height = 22;

    kpis.forEach(([k, v], i) => {
      const row = ws.addRow([k, v]);
      if (i % 2 === 1) row.getCell(1).fill = row.getCell(2).fill = { type: "pattern", pattern: "solid", fgColor: { argb: ALT } };
      row.height = 18;
    });
  }

  // ── Sheet 2: Ingresos ──
  {
    const ws = wb.addWorksheet("Ingresos");
    const ncols = 7;
    addTitle(ws, "Ingresos del Período", label, ncols);
    setColWidths(ws, [12, 25, 14, 16, 14, 30, 14]);
    const hRow = setHeaders(ws, ["Fecha", "Paciente", "RUT", "Método", "N° Presupuesto", "Notas", "Monto"]);
    const hRowNum = hRow.number;

    let total = 0;
    payments.forEach((p, i) => {
      const patName = p.patient ? `${p.patient.firstName} ${p.patient.lastName}` : "—";
      addDataRow(ws, [
        p.date,
        patName,
        p.patient?.rut ?? "—",
        p.method,
        p.budget ? `#${String(p.budget.number).padStart(4, "0")}` : "—",
        p.notes ?? "",
        p.amount,
      ], i % 2 === 1);
      total += p.amount;
    });

    addTotalRow(ws, ["", "", "", "", "", "TOTAL", total]);
    ws.autoFilter = { from: { row: hRowNum, column: 1 }, to: { row: hRowNum, column: ncols } };
    ws.views = [{ state: "frozen", ySplit: hRowNum }];
  }

  // ── Sheet 3: Por Profesional ──
  {
    const ws = wb.addWorksheet("Por Profesional");
    const ncols = 4;
    addTitle(ws, "Ingresos por Profesional", label, ncols);
    setColWidths(ws, [30, 18, 16, 12]);
    const hRow = setHeaders(ws, ["Profesional", "N° Atenciones", "Monto Total", "% del Total"]);

    // Group evolutions by user
    const byUser: Record<string, { name: string; count: number; total: number }> = {};
    evolutions.forEach(e => {
      if (!byUser[e.userId]) byUser[e.userId] = { name: e.user?.name ?? "Desconocido", count: 0, total: 0 };
      byUser[e.userId].count++;
      byUser[e.userId].total += e.cost;
    });

    const rows = Object.values(byUser).sort((a, b) => b.total - a.total);
    const grandTotal = rows.reduce((s, r) => s + r.total, 0);

    rows.forEach((r, i) => {
      addDataRow(ws, [r.name, r.count, clp(r.total), pct(r.total, grandTotal)], i % 2 === 1);
    });
    addTotalRow(ws, ["TOTAL", rows.reduce((s, r) => s + r.count, 0), clp(grandTotal), "100%"]);
    ws.views = [{ state: "frozen", ySplit: hRow.number }];
  }

  // ── Sheet 4: Por Tratamiento ──
  {
    const ws = wb.addWorksheet("Por Tratamiento");
    const ncols = 4;
    addTitle(ws, "Ingresos por Tratamiento", label, ncols);
    setColWidths(ws, [35, 14, 16, 12]);
    const hRow = setHeaders(ws, ["Tratamiento", "Cantidad", "Monto Total", "% del Total"]);

    const byTreat: Record<string, { count: number; total: number }> = {};
    evolutions.forEach(e => {
      if (!byTreat[e.treatment]) byTreat[e.treatment] = { count: 0, total: 0 };
      byTreat[e.treatment].count++;
      byTreat[e.treatment].total += e.cost;
    });

    const rows = Object.entries(byTreat).sort((a, b) => b[1].total - a[1].total);
    const grandTotal = rows.reduce((s, [, r]) => s + r.total, 0);

    rows.forEach(([name, r], i) => {
      addDataRow(ws, [name, r.count, clp(r.total), pct(r.total, grandTotal)], i % 2 === 1);
    });
    addTotalRow(ws, ["TOTAL", rows.reduce((s, [, r]) => s + r.count, 0), clp(grandTotal), "100%"]);
    ws.views = [{ state: "frozen", ySplit: hRow.number }];
  }

  // ── Sheet 5: Presupuestos ──
  {
    const ws = wb.addWorksheet("Presupuestos");
    const ncols = 8;
    addTitle(ws, "Presupuestos del Período", label, ncols);
    setColWidths(ws, [8, 12, 25, 14, 14, 14, 14, 14]);
    const hRow = setHeaders(ws, ["N°", "Fecha", "Paciente", "Total", "Pagado", "Pendiente", "Estado", "Descuento"]);
    const STATUS_MAP: Record<string, string> = { pending: "Pendiente", approved: "Aprobado", paid: "Pagado", rejected: "Rechazado", in_progress: "En curso" };

    budgets.forEach((b, i) => {
      const paid = b.payments.reduce((s, p) => s + p.amount, 0);
      addDataRow(ws, [
        `#${String(b.number).padStart(4, "0")}`,
        b.date,
        `${b.patient.firstName} ${b.patient.lastName}`,
        clp(b.total),
        clp(paid),
        clp(Math.max(0, b.total - paid)),
        STATUS_MAP[b.status] ?? b.status,
        clp(b.discount),
      ], i % 2 === 1);
    });
    ws.views = [{ state: "frozen", ySplit: hRow.number }];
    ws.autoFilter = { from: { row: hRow.number, column: 1 }, to: { row: hRow.number, column: ncols } };
  }
}

// ───────────────────────────────────────────────────────────────────────────

async function buildTratamientos(wb: ExcelJS.Workbook, start: string, end: string, label: string, profesional: string) {
  const profFilter = profesional !== "all" ? { userId: profesional } : {};

  const [evolutions, budgetItems] = await Promise.all([
    prisma.evolution.findMany({
      where: { date: { gte: start, lte: end }, ...profFilter },
      include: {
        patient: { select: { firstName: true, lastName: true, rut: true } },
        user: { select: { name: true } },
      },
      orderBy: { date: "desc" },
    }),
    prisma.budgetItem.findMany({
      where: { status: { in: ["pending", "in_progress"] } },
      include: {
        budget: {
          include: { patient: { select: { firstName: true, lastName: true, rut: true } } },
        },
      },
    }),
  ]);

  // ── Sheet 1: Evoluciones ──
  {
    const ws = wb.addWorksheet("Evoluciones");
    const ncols = 8;
    addTitle(ws, "Evoluciones del Período", label, ncols);
    setColWidths(ws, [12, 25, 14, 30, 10, 20, 12, 35]);
    const hRow = setHeaders(ws, ["Fecha", "Paciente", "RUT", "Tratamiento", "Diente", "Profesional", "Monto", "Observaciones"]);

    let total = 0;
    evolutions.forEach((e, i) => {
      addDataRow(ws, [
        e.date,
        `${e.patient.firstName} ${e.patient.lastName}`,
        e.patient.rut,
        e.treatment,
        e.tooth ?? "",
        e.user?.name ?? "—",
        e.cost,
        e.observations ?? "",
      ], i % 2 === 1);
      total += e.cost;
    });
    addTotalRow(ws, ["", "", "", "", "", "TOTAL", clp(total), ""]);
    ws.autoFilter = { from: { row: hRow.number, column: 1 }, to: { row: hRow.number, column: ncols } };
    ws.views = [{ state: "frozen", ySplit: hRow.number }];
  }

  // ── Sheet 2: Ranking ──
  {
    const ws = wb.addWorksheet("Ranking Tratamientos");
    const ncols = 4;
    addTitle(ws, "Ranking de Tratamientos", label, ncols);
    setColWidths(ws, [35, 14, 16, 12]);
    const hRow = setHeaders(ws, ["Tratamiento", "Cantidad", "Monto Total", "% del Total"]);

    const byTreat: Record<string, { count: number; total: number }> = {};
    evolutions.forEach(e => {
      if (!byTreat[e.treatment]) byTreat[e.treatment] = { count: 0, total: 0 };
      byTreat[e.treatment].count++;
      byTreat[e.treatment].total += e.cost;
    });

    const rows = Object.entries(byTreat).sort((a, b) => b[1].total - a[1].total);
    const grandTotal = rows.reduce((s, [, r]) => s + r.total, 0);

    rows.forEach(([name, r], i) => {
      addDataRow(ws, [name, r.count, clp(r.total), pct(r.total, grandTotal)], i % 2 === 1);
    });
    addTotalRow(ws, ["TOTAL", rows.reduce((s, [, r]) => s + r.count, 0), clp(grandTotal), "100%"]);
    ws.views = [{ state: "frozen", ySplit: hRow.number }];
  }

  // ── Sheet 3: Pendientes ──
  {
    const ws = wb.addWorksheet("Tratamientos Pendientes");
    const ncols = 6;
    addTitle(ws, "Tratamientos Pendientes / En Curso", label, ncols);
    setColWidths(ws, [25, 14, 35, 10, 14, 14]);
    const hRow = setHeaders(ws, ["Paciente", "RUT", "Tratamiento", "Diente", "Valor", "Estado"]);
    const STATUS_MAP: Record<string, string> = { pending: "Pendiente", in_progress: "En curso" };

    budgetItems.forEach((item, i) => {
      addDataRow(ws, [
        `${item.budget.patient.firstName} ${item.budget.patient.lastName}`,
        item.budget.patient.rut,
        item.description,
        item.tooth ?? "",
        clp(item.total),
        STATUS_MAP[item.status] ?? item.status,
      ], i % 2 === 1);
    });
    ws.autoFilter = { from: { row: hRow.number, column: 1 }, to: { row: hRow.number, column: ncols } };
    ws.views = [{ state: "frozen", ySplit: hRow.number }];
  }
}

// ───────────────────────────────────────────────────────────────────────────

async function buildPacientes(wb: ExcelJS.Workbook, start: string, end: string, label: string) {
  const [allPatients, newPatients] = await Promise.all([
    prisma.patient.findMany({
      where: { active: true },
      include: {
        evolutions: { select: { date: true }, orderBy: { date: "desc" }, take: 1 },
        appointments: { select: { date: true }, orderBy: { date: "desc" }, take: 1 },
        budgets: { where: { status: { in: ["approved", "in_progress"] } }, include: { payments: { select: { amount: true } } } },
      },
    }),
    prisma.patient.findMany({
      where: { createdAt: { gte: new Date(start), lte: new Date(end + "T23:59:59") } },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const total = allPatients.length;
  const genderMap: Record<string, number> = {};
  const ageGroups = { "0-12": 0, "13-17": 0, "18-30": 0, "31-45": 0, "46-60": 0, "60+": 0 };
  const now = new Date();

  allPatients.forEach(p => {
    const g = p.gender ?? "Sin datos";
    genderMap[g] = (genderMap[g] ?? 0) + 1;
    if (p.birthDate) {
      const age = Math.floor((now.getTime() - new Date(p.birthDate).getTime()) / (1000 * 60 * 60 * 24 * 365.25));
      if (age <= 12) ageGroups["0-12"]++;
      else if (age <= 17) ageGroups["13-17"]++;
      else if (age <= 30) ageGroups["18-30"]++;
      else if (age <= 45) ageGroups["31-45"]++;
      else if (age <= 60) ageGroups["46-60"]++;
      else ageGroups["60+"]++;
    }
  });

  // ── Sheet 1: Resumen ──
  {
    const ws = wb.addWorksheet("Resumen");
    addTitle(ws, "Reporte de Pacientes — Clínica Magna", label, 2);
    setColWidths(ws, [35, 20]);

    const hRow = ws.addRow(["Indicador", "Valor"]);
    hRow.eachCell(cell => {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: CORP } };
      cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
      cell.alignment = { horizontal: "center" };
    });
    hRow.height = 22;

    const kpis: [string, string | number][] = [
      ["Total activos", total],
      ["Nuevos en el período", newPatients.length],
      ...Object.entries(genderMap).map(([g, v]): [string, number] => [`Género — ${g}`, v]),
      ...Object.entries(ageGroups).map(([g, v]): [string, number] => [`Edad — ${g}`, v]),
    ];

    kpis.forEach(([k, v], i) => {
      const row = ws.addRow([k, v]);
      if (i % 2 === 1) row.getCell(1).fill = row.getCell(2).fill = { type: "pattern", pattern: "solid", fgColor: { argb: ALT } };
      row.height = 18;
    });
  }

  // ── Sheet 2: Nuevos ──
  {
    const ws = wb.addWorksheet("Nuevos Pacientes");
    const ncols = 8;
    addTitle(ws, "Nuevos Pacientes en el Período", label, ncols);
    setColWidths(ws, [16, 25, 14, 14, 25, 14, 12, 20]);
    const hRow = setHeaders(ws, ["Fecha Ingreso", "Nombre", "RUT", "Teléfono", "Email", "Ciudad", "Género", "Previsión"]);

    newPatients.forEach((p, i) => {
      addDataRow(ws, [
        p.createdAt.toISOString().slice(0, 10),
        `${p.firstName} ${p.lastName}`,
        p.rut,
        p.phone ?? "",
        p.email ?? "",
        p.city ?? "",
        p.gender ?? "",
        p.healthInsurance ?? "",
      ], i % 2 === 1);
    });
    ws.autoFilter = { from: { row: hRow.number, column: 1 }, to: { row: hRow.number, column: ncols } };
    ws.views = [{ state: "frozen", ySplit: hRow.number }];
  }

  // ── Sheet 3: Sin Cita +6 meses ──
  {
    const ws = wb.addWorksheet("Inactivos 6 Meses");
    const ncols = 6;
    addTitle(ws, "Pacientes Sin Actividad +6 Meses", label, ncols);
    setColWidths(ws, [25, 14, 14, 25, 18, 16]);
    const hRow = setHeaders(ws, ["Nombre", "RUT", "Teléfono", "Email", "Última Actividad", "Días Sin Actividad"]);

    const inactivePatients = allPatients
      .map(p => {
        const lastAppt = p.appointments[0]?.date ?? null;
        const lastEvol = p.evolutions[0]?.date ?? null;
        const lastStr = lastAppt && lastEvol
          ? (lastAppt > lastEvol ? lastAppt : lastEvol)
          : lastAppt ?? lastEvol;
        const lastDate = lastStr ? new Date(lastStr + "T12:00:00") : null;
        const days = lastDate ? Math.floor((now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24)) : null;
        return { p, lastStr, days };
      })
      .filter(({ days, lastStr }) => !lastStr || (days !== null && days > 180))
      .sort((a, b) => (b.days ?? 9999) - (a.days ?? 9999));

    inactivePatients.forEach(({ p, lastStr, days }, i) => {
      addDataRow(ws, [
        `${p.firstName} ${p.lastName}`,
        p.rut,
        p.phone ?? "",
        p.email ?? "",
        lastStr ?? "Sin actividad",
        days ?? "Nunca",
      ], i % 2 === 1);
    });
    ws.views = [{ state: "frozen", ySplit: hRow.number }];
  }

  // ── Sheet 4: Presupuesto Sin Iniciar ──
  {
    const ws = wb.addWorksheet("Presupuesto Sin Iniciar");
    const ncols = 6;
    addTitle(ws, "Presupuestos Aprobados Sin Atenciones", label, ncols);
    setColWidths(ws, [25, 14, 14, 16, 14, 14]);
    const hRow = setHeaders(ws, ["Nombre", "RUT", "N° Presupuesto", "Fecha", "Total", "Estado"]);
    const STATUS_MAP: Record<string, string> = { approved: "Aprobado", in_progress: "En curso" };

    const withBudgetNoEvo = allPatients.filter(p => p.budgets.length > 0 && p.evolutions.length === 0);
    withBudgetNoEvo.forEach((p, i) => {
      p.budgets.forEach((b) => {
        addDataRow(ws, [
          `${p.firstName} ${p.lastName}`,
          p.rut,
          `#${String((b as { number?: number }).number ?? 0).padStart(4, "0")}`,
          b.date,
          clp(b.total),
          STATUS_MAP[b.status] ?? b.status,
        ], i % 2 === 1);
      });
    });
    ws.views = [{ state: "frozen", ySplit: hRow.number }];
  }
}

// ───────────────────────────────────────────────────────────────────────────

async function buildMarketing(wb: ExcelJS.Workbook, start: string, end: string, label: string) {
  const patients = await prisma.patient.findMany({
    where: { createdAt: { gte: new Date(start), lte: new Date(end + "T23:59:59") } },
    select: { firstName: true, lastName: true, rut: true, createdAt: true, referralSource: true },
    orderBy: { createdAt: "desc" },
  });

  const SOURCES = ["Referido", "Instagram", "Facebook", "Google", "TikTok", "Otro"];

  const bySource: Record<string, number> = {};
  patients.forEach(p => {
    const src = p.referralSource ?? "Sin datos";
    bySource[src] = (bySource[src] ?? 0) + 1;
  });

  // ── Sheet 1: Resumen Canal ──
  {
    const ws = wb.addWorksheet("Resumen Canal");
    const ncols = 3;
    addTitle(ws, "Marketing — Canales de Captación", label, ncols);
    setColWidths(ws, [20, 18, 14]);
    const hRow = setHeaders(ws, ["Canal", "Pacientes Nuevos", "% del Total"]);
    const total = patients.length;

    const allSources = [...SOURCES, "Sin datos"];
    allSources.forEach((src, i) => {
      const count = bySource[src] ?? 0;
      addDataRow(ws, [src, count, pct(count, total)], i % 2 === 1);
    });
    addTotalRow(ws, ["TOTAL", total, "100%"]);

    const topSource = Object.entries(bySource).sort((a, b) => b[1] - a[1])[0];
    ws.addRow([]);
    const infoRow = ws.addRow([`Canal con mayor conversión: ${topSource ? topSource[0] : "Sin datos"}`]);
    infoRow.getCell(1).font = { bold: true, color: { argb: "FF0057FF" } };
    ws.views = [{ state: "frozen", ySplit: hRow.number }];
  }

  // ── Sheet 2: Evolución Mensual ──
  {
    const ws = wb.addWorksheet("Evolución Mensual");
    const allSources = [...SOURCES, "Sin datos"];
    const ncols = allSources.length + 2;
    addTitle(ws, "Evolución Mensual por Canal", label, ncols);
    setColWidths(ws, [14, ...allSources.map(() => 12), 10]);
    setHeaders(ws, ["Mes", ...allSources, "Total"]);

    // Generate months in period
    const startDate = new Date(start + "T12:00:00");
    const endDate = new Date(end + "T12:00:00");
    const months: string[] = [];
    const d = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
    while (d <= endDate) {
      months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
      d.setMonth(d.getMonth() + 1);
    }

    months.forEach((month, i) => {
      const monthPatients = patients.filter(p => p.createdAt.toISOString().slice(0, 7) === month);
      const counts = allSources.map(src => monthPatients.filter(p => (p.referralSource ?? "Sin datos") === src).length);
      const total = monthPatients.length;
      addDataRow(ws, [month, ...counts, total], i % 2 === 1);
    });
  }

  // ── Sheet 3: Detalle Pacientes ──
  {
    const ws = wb.addWorksheet("Detalle Pacientes");
    const ncols = 4;
    addTitle(ws, "Detalle de Pacientes por Canal", label, ncols);
    setColWidths(ws, [25, 14, 16, 16]);
    const hRow = setHeaders(ws, ["Nombre", "RUT", "Fecha Ingreso", "Canal"]);

    patients.forEach((p, i) => {
      addDataRow(ws, [
        `${p.firstName} ${p.lastName}`,
        p.rut,
        p.createdAt.toISOString().slice(0, 10),
        p.referralSource ?? "Sin datos",
      ], i % 2 === 1);
    });
    ws.autoFilter = { from: { row: hRow.number, column: 1 }, to: { row: hRow.number, column: ncols } };
    ws.views = [{ state: "frozen", ySplit: hRow.number }];
  }
}

// ───────────────────────────────────────────────────────────────────────────

async function buildAgenda(wb: ExcelJS.Workbook, start: string, end: string, label: string, profesional: string) {
  const profFilter = profesional !== "all" ? { userId: profesional } : {};

  const appointments = await prisma.appointment.findMany({
    where: { date: { gte: start, lte: end }, ...profFilter },
    include: {
      patient: { select: { firstName: true, lastName: true, rut: true } },
      user: { select: { name: true } },
    },
    orderBy: [{ date: "asc" }, { startTime: "asc" }],
  });

  const total = appointments.length;
  const completed = appointments.filter(a => a.status === "completed").length;
  const cancelled = appointments.filter(a => a.status === "cancelled").length;
  const noShow = appointments.filter(a => a.status === "no-show").length;
  const ausentismo = total > 0 ? `${((noShow / total) * 100).toFixed(1)}%` : "0%";
  const cumplimiento = total > 0 ? `${((completed / total) * 100).toFixed(1)}%` : "0%";

  const STATUS_MAP: Record<string, string> = { scheduled: "Agendada", confirmed: "Confirmada", completed: "Completada", cancelled: "Cancelada", "no-show": "Sin asistencia" };

  // ── Sheet 1: Resumen ──
  {
    const ws = wb.addWorksheet("Resumen");
    addTitle(ws, "Reporte de Agenda — Clínica Magna", label, 2);
    setColWidths(ws, [30, 16]);

    const hRow = ws.addRow(["Indicador", "Valor"]);
    hRow.eachCell(cell => {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: CORP } };
      cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
      cell.alignment = { horizontal: "center" };
    });
    hRow.height = 22;

    const kpis: [string, string | number][] = [
      ["Total agendadas", total],
      ["Completadas", completed],
      ["Canceladas", cancelled],
      ["Sin asistencia", noShow],
      ["% Ausentismo", ausentismo],
      ["Tasa de cumplimiento", cumplimiento],
    ];
    kpis.forEach(([k, v], i) => {
      const row = ws.addRow([k, v]);
      if (i % 2 === 1) row.getCell(1).fill = row.getCell(2).fill = { type: "pattern", pattern: "solid", fgColor: { argb: ALT } };
      row.height = 18;
    });
  }

  // ── Sheet 2: Detalle ──
  {
    const ws = wb.addWorksheet("Detalle");
    const ncols = 8;
    addTitle(ws, "Detalle de Citas", label, ncols);
    setColWidths(ws, [12, 10, 25, 14, 20, 20, 14, 8]);
    const hRow = setHeaders(ws, ["Fecha", "Hora", "Paciente", "RUT", "Tipo", "Profesional", "Estado", "Box"]);

    appointments.forEach((a, i) => {
      addDataRow(ws, [
        a.date,
        a.startTime,
        `${a.patient.firstName} ${a.patient.lastName}`,
        a.patient.rut,
        a.type,
        a.user?.name ?? "—",
        STATUS_MAP[a.status] ?? a.status,
        a.box,
      ], i % 2 === 1);
    });
    ws.autoFilter = { from: { row: hRow.number, column: 1 }, to: { row: hRow.number, column: ncols } };
    ws.views = [{ state: "frozen", ySplit: hRow.number }];
  }

  // ── Sheet 3: Por Profesional ──
  {
    const ws = wb.addWorksheet("Por Profesional");
    const ncols = 6;
    addTitle(ws, "Citas por Profesional", label, ncols);
    setColWidths(ws, [30, 10, 14, 14, 16, 14]);
    const hRow = setHeaders(ws, ["Profesional", "Total", "Completadas", "Canceladas", "Sin Asistencia", "% Asistencia"]);

    const byProf: Record<string, { name: string; total: number; completed: number; cancelled: number; noShow: number }> = {};
    appointments.forEach(a => {
      if (!byProf[a.userId]) byProf[a.userId] = { name: a.user?.name ?? "—", total: 0, completed: 0, cancelled: 0, noShow: 0 };
      byProf[a.userId].total++;
      if (a.status === "completed") byProf[a.userId].completed++;
      else if (a.status === "cancelled") byProf[a.userId].cancelled++;
      else if (a.status === "no-show") byProf[a.userId].noShow++;
    });

    Object.values(byProf).sort((a, b) => b.total - a.total).forEach((r, i) => {
      addDataRow(ws, [r.name, r.total, r.completed, r.cancelled, r.noShow, pct(r.completed, r.total)], i % 2 === 1);
    });
    ws.views = [{ state: "frozen", ySplit: hRow.number }];
  }

  // ── Sheet 4: Por Día de Semana ──
  {
    const ws = wb.addWorksheet("Por Día de Semana");
    const DAYS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
    addTitle(ws, "Citas por Día de Semana", label, 3);
    setColWidths(ws, [16, 10, 14]);
    setHeaders(ws, ["Día", "Total", "% del Total"]);

    const dayCounts = new Array(7).fill(0);
    appointments.forEach(a => {
      const day = new Date(a.date + "T12:00:00").getDay();
      dayCounts[day]++;
    });

    // Display Mon-Sun order
    [1, 2, 3, 4, 5, 6, 0].forEach((dayIdx, i) => {
      addDataRow(ws, [DAYS[dayIdx], dayCounts[dayIdx], pct(dayCounts[dayIdx], total)], i % 2 === 1);
    });
  }

  // ── Sheet 5: Por Hora ──
  {
    const ws = wb.addWorksheet("Por Hora");
    addTitle(ws, "Citas por Franja Horaria", label, 3);
    setColWidths(ws, [16, 10, 14]);
    setHeaders(ws, ["Franja", "Total", "% del Total"]);

    const hourCounts: Record<number, number> = {};
    appointments.forEach(a => {
      const h = parseInt(a.startTime.split(":")[0], 10);
      hourCounts[h] = (hourCounts[h] ?? 0) + 1;
    });

    for (let h = 8; h <= 19; h++) {
      const count = hourCounts[h] ?? 0;
      addDataRow(ws, [`${String(h).padStart(2, "0")}:00-${String(h + 1).padStart(2, "0")}:00`, count, pct(count, total)], h % 2 === 0);
    }
  }
}

// ───────────────────────────────────────────────────────────────────────────

async function buildPresupuestos(wb: ExcelJS.Workbook, start: string, end: string, label: string) {
  const budgets = await prisma.budget.findMany({
    where: { date: { gte: start, lte: end } },
    include: {
      patient: { select: { firstName: true, lastName: true, rut: true } },
      user: { select: { name: true } },
      items: true,
      payments: { select: { amount: true, date: true } },
    },
    orderBy: { number: "asc" },
  });

  const STATUS_MAP: Record<string, string> = { pending: "Pendiente", approved: "Aprobado", paid: "Pagado", rejected: "Rechazado", in_progress: "En curso" };

  // ── Sheet 1: Listado ──
  {
    const ws = wb.addWorksheet("Listado");
    const ncols = 12;
    addTitle(ws, "Listado de Presupuestos", label, ncols);
    setColWidths(ws, [8, 12, 14, 25, 14, 20, 12, 12, 12, 12, 12, 14]);
    const hRow = setHeaders(ws, ["N°", "Fecha", "Válido Hasta", "Paciente", "RUT", "Profesional", "Subtotal", "Descuento", "Total", "Pagado", "Saldo", "Estado"]);

    let totalSubtotal = 0, totalDiscount = 0, totalTotal = 0, totalPaid = 0, totalSaldo = 0;

    budgets.forEach((b, i) => {
      const paid = b.payments.reduce((s, p) => s + p.amount, 0);
      const saldo = Math.max(0, b.total - paid);
      totalSubtotal += b.subtotal;
      totalDiscount += b.discount;
      totalTotal += b.total;
      totalPaid += paid;
      totalSaldo += saldo;

      addDataRow(ws, [
        `#${String(b.number).padStart(4, "0")}`,
        b.date,
        b.validUntil ?? "",
        `${b.patient.firstName} ${b.patient.lastName}`,
        b.patient.rut,
        b.user?.name ?? "—",
        clp(b.subtotal),
        clp(b.discount),
        clp(b.total),
        clp(paid),
        clp(saldo),
        STATUS_MAP[b.status] ?? b.status,
      ], i % 2 === 1);
    });

    addTotalRow(ws, ["", "", "", "", "", "TOTAL", clp(totalSubtotal), clp(totalDiscount), clp(totalTotal), clp(totalPaid), clp(totalSaldo), ""]);
    ws.autoFilter = { from: { row: hRow.number, column: 1 }, to: { row: hRow.number, column: ncols } };
    ws.views = [{ state: "frozen", ySplit: hRow.number }];
  }

  // ── Sheet 2: Vencidos ──
  {
    const ws = wb.addWorksheet("Vencidos");
    const ncols = 7;
    addTitle(ws, "Presupuestos Vencidos con Saldo", label, ncols);
    setColWidths(ws, [8, 12, 25, 12, 12, 12, 12]);
    const hRow = setHeaders(ws, ["N°", "Fecha", "Paciente", "Total", "Pagado", "Saldo", "Días Vencido"]);

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const vencidos = budgets.filter(b => {
      const budgetDate = new Date(b.date + "T12:00:00");
      const paid = b.payments.reduce((s, p) => s + p.amount, 0);
      return budgetDate < thirtyDaysAgo && b.status !== "paid" && paid < b.total;
    });

    vencidos.forEach((b, i) => {
      const paid = b.payments.reduce((s, p) => s + p.amount, 0);
      const saldo = b.total - paid;
      const days = Math.floor((now.getTime() - new Date(b.date + "T12:00:00").getTime()) / (1000 * 60 * 60 * 24));

      addDataRow(ws, [
        `#${String(b.number).padStart(4, "0")}`,
        b.date,
        `${b.patient.firstName} ${b.patient.lastName}`,
        clp(b.total),
        clp(paid),
        clp(saldo),
        days,
      ], i % 2 === 1);
    });
    ws.views = [{ state: "frozen", ySplit: hRow.number }];
  }

  // ── Sheet 3: Tiempo Pago ──
  {
    const ws = wb.addWorksheet("Tiempo de Pago");
    const ncols = 4;
    addTitle(ws, "Tiempo Hasta Pago (Presupuestos Pagados)", label, ncols);
    setColWidths(ws, [8, 16, 20, 14]);
    const hRow = setHeaders(ws, ["N°", "Fecha Emisión", "Fecha Último Pago", "Días Hasta Pago"]);

    const paidBudgets = budgets.filter(b => b.payments.length > 0);
    let totalDays = 0;
    let count = 0;

    paidBudgets.forEach((b, i) => {
      const lastPayment = b.payments.sort((a, z) => a.date > z.date ? -1 : 1)[0];
      const emisión = new Date(b.date + "T12:00:00");
      const pago = new Date(lastPayment.date + "T12:00:00");
      const days = Math.max(0, Math.floor((pago.getTime() - emisión.getTime()) / (1000 * 60 * 60 * 24)));
      totalDays += days;
      count++;

      addDataRow(ws, [
        `#${String(b.number).padStart(4, "0")}`,
        b.date,
        lastPayment.date,
        days,
      ], i % 2 === 1);
    });

    if (count > 0) {
      addTotalRow(ws, ["", "", "PROMEDIO", Math.round(totalDays / count)]);
    }
    ws.views = [{ state: "frozen", ySplit: hRow.number }];
  }
}

// ── Main handler ─────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const sp = req.nextUrl.searchParams;
  const type = sp.get("type") ?? "financiero";
  const period = sp.get("period") ?? "month";
  const value = sp.get("value") ?? "";
  const profesional = sp.get("profesional") ?? "all";

  const { start, end, label } = parsePeriod(period, value);

  const wb = new ExcelJS.Workbook();
  wb.creator = "Clínica Magna";
  wb.created = new Date();

  switch (type) {
    case "financiero":   await buildFinanciero(wb, start, end, label, profesional); break;
    case "tratamientos": await buildTratamientos(wb, start, end, label, profesional); break;
    case "pacientes":    await buildPacientes(wb, start, end, label); break;
    case "marketing":    await buildMarketing(wb, start, end, label); break;
    case "agenda":       await buildAgenda(wb, start, end, label, profesional); break;
    case "presupuestos": await buildPresupuestos(wb, start, end, label); break;
    default:             await buildFinanciero(wb, start, end, label, profesional);
  }

  const buffer = await wb.xlsx.writeBuffer();
  const date = new Date().toISOString().slice(0, 10);
  const filename = `reporte-${type}-clinica-magna-${date}.xlsx`;

  return new NextResponse(buffer as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
