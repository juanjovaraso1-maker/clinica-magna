import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const today = new Date().toISOString().split("T")[0];
  const now = new Date();

  const thisMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const lastMonthKey = `${now.getFullYear()}-${String(now.getMonth()).padStart(2, "0")}`;
  const in7Days = new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0];

  // Last 6 months for chart
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    return {
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      label: d.toLocaleDateString("es-CL", { month: "short" }),
    };
  });

  // This week days
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now);
    const day = d.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + diff + i);
    return d.toISOString().split("T")[0];
  });

  const [
    totalPatients,
    newPatientsMonth,
    todayAppointments,
    weekAppointments,
    monthPayments,
    lastMonthPayments,
    pendingBudgets,
    recentPatients,
    monthlyPayments,
    monthExpenses,
    nextAppointments,
    debtorBudgets,
    recentPayments,
  ] = await Promise.all([
    prisma.patient.count({ where: { active: true } }),
    prisma.patient.count({ where: { createdAt: { gte: new Date(now.getFullYear(), now.getMonth(), 1) } } }),
    prisma.appointment.findMany({
      where: { date: today },
      include: { patient: true, user: true },
      orderBy: { startTime: "asc" },
    }),
    prisma.appointment.findMany({
      where: { date: { gte: weekDays[0], lte: weekDays[6] } },
      select: { date: true, status: true },
    }),
    prisma.payment.aggregate({
      where: { date: { startsWith: thisMonthKey } },
      _sum: { amount: true },
    }),
    prisma.payment.aggregate({
      where: { date: { startsWith: lastMonthKey } },
      _sum: { amount: true },
    }),
    prisma.budget.count({ where: { status: "pending" } }),
    prisma.patient.findMany({
      orderBy: { createdAt: "desc" }, take: 5,
      select: { id: true, firstName: true, lastName: true, rut: true, createdAt: true },
    }),
    prisma.payment.findMany({
      where: { date: { gte: months[0].key + "-01" } },
      select: { date: true, amount: true },
    }),
    prisma.expense.aggregate({
      where: { date: { startsWith: thisMonthKey } },
      _sum: { amount: true },
    }),
    prisma.appointment.findMany({
      where: {
        date: { gt: today, lte: in7Days },
        status: { notIn: ["cancelled", "no-show"] },
      },
      include: {
        patient: { select: { id: true, firstName: true, lastName: true } },
        user: { select: { name: true } },
      },
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
      take: 8,
    }),
    prisma.budget.findMany({
      where: { status: { not: "rejected" } },
      include: {
        patient: { select: { id: true, firstName: true, lastName: true } },
        payments: { select: { amount: true } },
      },
    }),
    prisma.payment.findMany({
      orderBy: { createdAt: "desc" }, take: 6,
      select: {
        id: true, date: true, amount: true, method: true, createdAt: true,
        patient: { select: { firstName: true, lastName: true } },
      },
    }),
  ]);

  // Monthly income chart
  const monthlyChart = months.map(({ key, label }) => ({
    label,
    income: monthlyPayments.filter(p => p.date.startsWith(key)).reduce((s, p) => s + p.amount, 0),
  }));

  // Weekly chart
  const weeklyChart = weekDays.map(date => ({
    label: new Date(date + "T12:00:00").toLocaleDateString("es-CL", { weekday: "short" }).slice(0, 3),
    citas: weekAppointments.filter(a => a.date === date).length,
    completadas: weekAppointments.filter(a => a.date === date && a.status === "completed").length,
  }));

  // Status breakdown for today
  const statusCount = {
    scheduled: todayAppointments.filter(a => a.status === "scheduled").length,
    confirmed: todayAppointments.filter(a => a.status === "confirmed").length,
    completed: todayAppointments.filter(a => a.status === "completed").length,
    cancelled: todayAppointments.filter(a => a.status === "cancelled").length,
  };

  // Debtors: group by patient, sum outstanding balance
  const debtorMap: Record<string, { patientId: string; name: string; balance: number }> = {};
  debtorBudgets.forEach(b => {
    const paid = b.payments.reduce((s, p) => s + p.amount, 0);
    const balance = b.total - paid;
    if (balance <= 0) return;
    if (debtorMap[b.patient.id]) {
      debtorMap[b.patient.id].balance += balance;
    } else {
      debtorMap[b.patient.id] = {
        patientId: b.patient.id,
        name: `${b.patient.firstName} ${b.patient.lastName}`,
        balance,
      };
    }
  });
  const debtors = Object.values(debtorMap)
    .filter(d => d.balance > 500)
    .sort((a, b) => b.balance - a.balance)
    .slice(0, 5);

  const totalDebt = Object.values(debtorMap).reduce((s, d) => s + d.balance, 0);

  return NextResponse.json({
    totalPatients,
    newPatientsMonth,
    todayAppointments,
    monthIncome: monthPayments._sum.amount ?? 0,
    lastMonthIncome: lastMonthPayments._sum.amount ?? 0,
    monthExpenses: monthExpenses._sum.amount ?? 0,
    pendingBudgets,
    recentPatients,
    monthlyChart,
    weeklyChart,
    statusCount,
    nextAppointments,
    debtors,
    totalDebt,
    debtorCount: Object.keys(debtorMap).filter(k => debtorMap[k].balance > 500).length,
    recentPayments,
  });
}
