import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const today = new Date().toISOString().split("T")[0];
  const month = today.slice(0, 7);

  const [totalPatients, todayAppointments, monthPayments, pendingBudgets, recentPatients] =
    await Promise.all([
      prisma.patient.count({ where: { active: true } }),
      prisma.appointment.findMany({
        where: { date: today },
        include: { patient: true, user: true },
        orderBy: { startTime: "asc" },
      }),
      prisma.payment.aggregate({ where: { date: { startsWith: month } }, _sum: { amount: true } }),
      prisma.budget.count({ where: { status: "pending" } }),
      prisma.patient.findMany({ orderBy: { createdAt: "desc" }, take: 5 }),
    ]);

  const monthExpenses = await prisma.expense.aggregate({
    where: { date: { startsWith: month } },
    _sum: { amount: true },
  });

  return NextResponse.json({
    totalPatients,
    todayAppointments,
    monthIncome: monthPayments._sum.amount ?? 0,
    monthExpenses: monthExpenses._sum.amount ?? 0,
    pendingBudgets,
    recentPatients,
  });
}
