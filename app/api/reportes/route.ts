import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const period = req.nextUrl.searchParams.get("period") ?? "6m";
  const now = new Date();

  const monthCount = period === "3m" ? 3 : period === "12m" ? 12 : 6;

  const months = Array.from({ length: monthCount }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (monthCount - 1 - i), 1);
    return {
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      label: d.toLocaleDateString("es-CL", { month: "short", year: "2-digit" }),
    };
  });

  const startDate = months[0].key + "-01";

  const [payments, expenses, patients, appointments, budgets] = await Promise.all([
    prisma.payment.findMany({
      where: { date: { gte: startDate } },
      select: { date: true, amount: true },
    }),
    prisma.expense.findMany({
      where: { date: { gte: startDate } },
      select: { date: true, amount: true },
    }),
    prisma.patient.findMany({
      where: { createdAt: { gte: new Date(startDate) } },
      select: { createdAt: true, healthInsurance: true },
    }),
    prisma.appointment.findMany({
      where: { date: { gte: startDate } },
      select: { date: true, status: true, type: true },
    }),
    prisma.budget.findMany({
      where: { status: { not: "rejected" } },
      include: {
        patient: { select: { id: true, firstName: true, lastName: true, rut: true } },
        payments: { select: { amount: true } },
      },
    }),
  ]);

  // Monthly income vs expenses
  const monthlyFinance = months.map(({ key, label }) => ({
    label,
    ingresos: payments.filter(p => p.date.startsWith(key)).reduce((s, p) => s + p.amount, 0),
    gastos: expenses.filter(e => e.date.startsWith(key)).reduce((s, e) => s + e.amount, 0),
  }));

  // New patients per month
  const monthlyPatients = months.map(({ key, label }) => ({
    label,
    nuevos: patients.filter(p => p.createdAt.toISOString().startsWith(key)).length,
  }));

  // Appointments by status
  const statusCount = ["scheduled", "confirmed", "completed", "cancelled", "no-show"].map(s => ({
    name: s,
    value: appointments.filter(a => a.status === s).length,
  })).filter(s => s.value > 0);

  // Appointments per month
  const monthlyAppointments = months.map(({ key, label }) => ({
    label,
    citas: appointments.filter(a => a.date.startsWith(key)).length,
    completadas: appointments.filter(a => a.date.startsWith(key) && a.status === "completed").length,
  }));

  // Top treatments
  const treatmentMap: Record<string, number> = {};
  appointments.forEach(a => {
    treatmentMap[a.type] = (treatmentMap[a.type] ?? 0) + 1;
  });
  const topTreatments = Object.entries(treatmentMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name, count]) => ({ name: name.split(" ")[0], count }));

  // Insurance distribution
  const insuranceMap: Record<string, number> = {};
  patients.forEach(p => {
    const ins = p.healthInsurance?.split(" ")[0] ?? "Sin previsión";
    insuranceMap[ins] = (insuranceMap[ins] ?? 0) + 1;
  });
  const insuranceData = Object.entries(insuranceMap).map(([name, value]) => ({ name, value }));

  // Debtors (patients with outstanding balance)
  const debtors = budgets
    .map(b => {
      const paid = b.payments.reduce((s, p) => s + p.amount, 0);
      const balance = b.total - paid;
      return { ...b, paid, balance };
    })
    .filter(b => b.balance > 500)
    .sort((a, b) => b.balance - a.balance)
    .slice(0, 10)
    .map(b => ({
      patientId: b.patient.id,
      name: `${b.patient.firstName} ${b.patient.lastName}`,
      rut: b.patient.rut,
      budgetNumber: b.number,
      total: b.total,
      paid: b.paid,
      balance: b.balance,
    }));

  // Summary KPIs
  const totalIncome = payments.reduce((s, p) => s + p.amount, 0);
  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);
  const totalPatients = await prisma.patient.count({ where: { active: true } });
  const completionRate = appointments.length > 0
    ? Math.round((appointments.filter(a => a.status === "completed").length / appointments.length) * 100)
    : 0;

  return NextResponse.json({
    monthlyFinance,
    monthlyPatients,
    monthlyAppointments,
    statusCount,
    topTreatments,
    insuranceData,
    debtors,
    kpis: {
      totalIncome,
      totalExpenses,
      net: totalIncome - totalExpenses,
      totalPatients,
      newPatients: patients.length,
      totalAppointments: appointments.length,
      completionRate,
    },
  });
}
