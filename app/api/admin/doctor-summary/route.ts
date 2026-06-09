import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const today = new Date();
  const month = req.nextUrl.searchParams.get("month")
    ?? `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;

  const [allUsers, allItems, allPayments] = await Promise.all([
    prisma.user.findMany({
      where: { active: true },
      select: { id: true, name: true, title: true, commissionRate: true, role: true },
      orderBy: { name: "asc" },
    }),
    prisma.budgetItem.findMany({
      where: { status: "completed", completedAt: { startsWith: month } },
      include: {
        budget: {
          include: {
            patient: { select: { id: true, firstName: true, lastName: true } },
            payments: { select: { amount: true, tuuCommission: true } },
            items:    { select: { total: true } },
          },
        },
      },
    }),
    prisma.doctorPayment.findMany({ where: { month } }),
  ]);

  const summary = allUsers
    .filter(u => u.role === "DENTIST" || u.role === "ADMIN")
    .map(user => {
      const userItems    = allItems.filter(i => i.completedByUserId === user.id);
      const userPayments = allPayments.filter(p => p.userId === user.id);
      const totalValue   = userItems.reduce((s, i) => s + i.total, 0);
      const totalSalary  = Math.round(totalValue * user.commissionRate / 100);
      const totalPaid    = userPayments.reduce((s, p) => s + p.amount, 0);
      return {
        user,
        items: userItems.map(i => ({
          id:          i.id,
          description: i.description,
          total:       i.total,
          directCost:  i.directCost,
          completedAt: i.completedAt,
          patient:     i.budget.patient,
          budgetNumber: i.budget.number,
        })),
        totalValue,
        totalSalary,
        payments:      userPayments,
        totalPaid,
        pendingAmount: Math.max(0, totalSalary - totalPaid),
      };
    })
    .filter(s => s.totalValue > 0 || s.payments.length > 0);

  return NextResponse.json(summary);
}
