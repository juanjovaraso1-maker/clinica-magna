import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId");
  const month  = req.nextUrl.searchParams.get("month"); // "2026-06"

  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

  const budgets = await prisma.budget.findMany({
    where: {
      userId,
      ...(month ? { date: { startsWith: month } } : {}),
    },
    include: {
      patient: { select: { id: true, firstName: true, lastName: true } },
      user:    { select: { name: true, commissionRate: true } },
      items:   true,
      payments: true,
    },
    orderBy: { date: "desc" },
  });

  return NextResponse.json(budgets);
}
