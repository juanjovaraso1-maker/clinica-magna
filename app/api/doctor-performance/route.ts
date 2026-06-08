import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId");
  const month  = req.nextUrl.searchParams.get("month"); // "2026-06"

  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

  // Only items this user marked as completed
  const items = await prisma.budgetItem.findMany({
    where: {
      completedByUserId: userId,
      status: "completed",
    },
    include: {
      budget: {
        include: {
          patient: { select: { id: true, firstName: true, lastName: true } },
          items:    { select: { total: true } },
          payments: { select: { amount: true, tuuCommission: true } },
          user:     { select: { commissionRate: true } },
        },
      },
    },
    orderBy: { completedAt: "desc" },
  });

  // Filter by completedAt (when treatment was actually finalized).
  // Fall back to budget.date for legacy items that predate the completedAt field.
  const filtered = month
    ? items.filter(item => {
        const dateToFilter = item.completedAt ?? item.budget.date;
        return dateToFilter.startsWith(month);
      })
    : items;

  return NextResponse.json(filtered);
}
