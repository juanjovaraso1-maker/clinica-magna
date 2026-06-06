import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { prisma } from "@/lib/prisma";
import ExcelJS from "exceljs";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

const CORP = "FF1A1D2E";
const BLUE = "FF0057FF";
const ALT  = "FFF0F4FF";
const GREEN = "FF00A86B";

function hdr(ws: ExcelJS.Worksheet, cols: { header: string; key: string; width: number }[]) {
  ws.columns = cols.map(c => ({ header: c.header, key: c.key, width: c.width }));
  const row = ws.getRow(1);
  row.eachCell(cell => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: CORP } };
    cell.font = { color: { argb: "FFFFFFFF" }, bold: true, size: 10 };
    cell.alignment = { vertical: "middle", horizontal: "center" };
    cell.border = { bottom: { style: "thin", color: { argb: BLUE } } };
  });
  row.height = 22;
  ws.autoFilter = { from: "A1", to: `${String.fromCharCode(64 + cols.length)}1` };
  ws.views = [{ state: "frozen", ySplit: 1 }];
}

function dataRow(ws: ExcelJS.Worksheet, rowIdx: number, values: any[]) {
  const row = ws.addRow(values);
  if (rowIdx % 2 === 0) {
    row.eachCell(cell => {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: ALT } };
    });
  }
  row.eachCell(cell => {
    cell.alignment = { vertical: "middle" };
    cell.font = { size: 10 };
  });
}

function totalRow(ws: ExcelJS.Worksheet, label: string, value: number, col: number) {
  const row = ws.addRow([]);
  row.getCell(col - 1).value = label;
  row.getCell(col - 1).font = { bold: true, size: 10 };
  row.getCell(col).value = value;
  row.getCell(col).font = { bold: true, color: { argb: BLUE }, size: 10 };
  row.getCell(col).numFmt = '"$"#,##0';
}

const clp = (n: number) => Math.round(n);
const fmtDate = (s: string) => s?.slice(0, 10) ?? "";

export async function GET(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token || (token as any).role !== "ADMIN") {
    return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });
  }

  const sp = req.nextUrl.searchParams;
  const month = sp.get("month") ?? new Date().toISOString().slice(0, 7);

  const [payments, expenses, debts] = await Promise.all([
    prisma.payment.findMany({
      where: { date: { startsWith: month } },
      include: { patient: true, budget: true },
      orderBy: { date: "asc" },
    }),
    prisma.expense.findMany({
      where: { date: { startsWith: month } },
      orderBy: { date: "asc" },
    }),
    prisma.debt.findMany({ orderBy: { createdAt: "asc" } }),
  ]);

  const totalBruto = payments.reduce((s, p) => s + p.amount, 0);
  const totalComm  = payments.reduce((s, p) => s + (p.tuuCommission ?? 0), 0);
  const totalNeto  = payments.reduce((s, p) => s + (p.netAmount ?? p.amount), 0);
  const totalGasto = expenses.reduce((s, e) => s + e.amount, 0);
  const resultado  = totalNeto - totalGasto;
  const totalDeuda = debts.reduce((s, d) => s + (d.totalAmount - d.paidAmount), 0);

  // Flujo mensual: últimos 12 meses
  const now = new Date();
  const meses: { mes: string; ingresos: number; gastos: number; comisiones: number; neto: number }[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const m = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const [ps, es] = await Promise.all([
      prisma.payment.findMany({ where: { date: { startsWith: m } } }),
      prisma.expense.findMany({ where: { date: { startsWith: m } } }),
    ]);
    const ing  = ps.reduce((s, p) => s + (p.netAmount ?? p.amount), 0);
    const gas  = es.reduce((s, e) => s + e.amount, 0);
    const comm = ps.reduce((s, p) => s + (p.tuuCommission ?? 0), 0);
    meses.push({ mes: m, ingresos: ing, gastos: gas, comisiones: comm, neto: ing - gas });
  }

  const wb = new ExcelJS.Workbook();
  wb.creator = "Clínica Magna";
  wb.created = new Date();

  // ── Hoja 1: Resumen ────────────────────────────────────────────────────
  const ws1 = wb.addWorksheet("Resumen");
  ws1.mergeCells("A1:B1");
  const title = ws1.getCell("A1");
  title.value = `Contabilidad Clínica Magna — ${month}`;
  title.font = { bold: true, size: 14, color: { argb: CORP } };
  title.alignment = { horizontal: "center" };
  ws1.getRow(1).height = 28;

  const kpis = [
    ["Ingresos Brutos", clp(totalBruto)],
    ["Comisiones TUU", clp(totalComm)],
    ["Ingresos Netos", clp(totalNeto)],
    ["Gastos Totales", clp(totalGasto)],
    ["Resultado Neto", clp(resultado)],
    ["Deuda Pendiente", clp(totalDeuda)],
  ];
  kpis.forEach(([label, value], i) => {
    const r = ws1.getRow(i + 3);
    r.getCell(1).value = label;
    r.getCell(1).font = { bold: true, size: 11 };
    r.getCell(2).value = value;
    r.getCell(2).numFmt = '"$"#,##0';
    r.getCell(2).font = { size: 11, color: { argb: i === 4 && resultado < 0 ? "FFDC2626" : BLUE } };
  });
  ws1.getColumn(1).width = 25;
  ws1.getColumn(2).width = 18;

  // ── Hoja 2: Ingresos ───────────────────────────────────────────────────
  const ws2 = wb.addWorksheet("Ingresos");
  hdr(ws2, [
    { header: "Fecha", key: "date", width: 12 },
    { header: "Paciente", key: "patient", width: 26 },
    { header: "Presupuesto", key: "budget", width: 14 },
    { header: "Medio", key: "method", width: 14 },
    { header: "Monto Bruto", key: "bruto", width: 16 },
    { header: "Comisión TUU", key: "comm", width: 16 },
    { header: "Monto Neto", key: "neto", width: 16 },
    { header: "Notas", key: "notes", width: 24 },
  ]);
  payments.forEach((p, i) => {
    dataRow(ws2, i, [
      fmtDate(p.date),
      `${p.patient.firstName} ${p.patient.lastName}`,
      p.budget?.number ?? "",
      p.method,
      clp(p.amount),
      clp(p.tuuCommission ?? 0),
      clp(p.netAmount ?? p.amount),
      p.notes ?? "",
    ]);
  });
  [5, 6, 7].forEach(col => {
    ws2.getColumn(col).numFmt = '"$"#,##0';
  });
  totalRow(ws2, "TOTAL NETO", clp(totalNeto), 7);

  // ── Hoja 3: Gastos ────────────────────────────────────────────────────
  const ws3 = wb.addWorksheet("Gastos");
  hdr(ws3, [
    { header: "Fecha", key: "date", width: 12 },
    { header: "Categoría", key: "cat", width: 26 },
    { header: "Descripción", key: "desc", width: 34 },
    { header: "Monto", key: "amount", width: 16 },
    { header: "Notas", key: "notes", width: 24 },
  ]);
  expenses.forEach((e, i) => {
    dataRow(ws3, i, [fmtDate(e.date), e.category, e.description, clp(e.amount), e.notes ?? ""]);
  });
  ws3.getColumn(4).numFmt = '"$"#,##0';
  totalRow(ws3, "TOTAL GASTOS", clp(totalGasto), 4);

  // ── Hoja 4: Deudas ────────────────────────────────────────────────────
  const ws4 = wb.addWorksheet("Deudas");
  hdr(ws4, [
    { header: "Acreedor", key: "cred", width: 22 },
    { header: "Descripción", key: "desc", width: 30 },
    { header: "Total", key: "total", width: 14 },
    { header: "Pagado", key: "paid", width: 14 },
    { header: "Saldo", key: "saldo", width: 14 },
    { header: "Vencimiento", key: "due", width: 14 },
    { header: "Estado", key: "status", width: 12 },
  ]);
  debts.forEach((d, i) => {
    dataRow(ws4, i, [
      d.creditor,
      d.description,
      clp(d.totalAmount),
      clp(d.paidAmount),
      clp(d.totalAmount - d.paidAmount),
      d.dueDate ?? "",
      d.status,
    ]);
  });
  [3, 4, 5].forEach(col => ws4.getColumn(col).numFmt = '"$"#,##0');
  totalRow(ws4, "TOTAL PENDIENTE", clp(totalDeuda), 5);

  // ── Hoja 5: Flujo Mensual ────────────────────────────────────────────
  const ws5 = wb.addWorksheet("Flujo Mensual");
  hdr(ws5, [
    { header: "Mes", key: "mes", width: 12 },
    { header: "Ingresos Netos", key: "ing", width: 18 },
    { header: "Gastos", key: "gas", width: 16 },
    { header: "Comisiones TUU", key: "comm", width: 18 },
    { header: "Resultado Neto", key: "neto", width: 18 },
  ]);
  meses.forEach((m, i) => {
    dataRow(ws5, i, [m.mes, clp(m.ingresos), clp(m.gastos), clp(m.comisiones), clp(m.neto)]);
  });
  [2, 3, 4, 5].forEach(col => ws5.getColumn(col).numFmt = '"$"#,##0');

  const buf = await wb.xlsx.writeBuffer();
  return new NextResponse(buf, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="contabilidad-clinica-magna-${month}.xlsx"`,
    },
  });
}
