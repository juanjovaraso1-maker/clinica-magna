import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get("nextNumber") === "true") {
    const last = await prisma.budget.findFirst({ orderBy: { number: "desc" }, select: { number: true } });
    return NextResponse.json({ nextNumber: (last?.number ?? 0) + 1 });
  }
  const status = req.nextUrl.searchParams.get("status");
  const budgets = await prisma.budget.findMany({
    where: status ? { status } : {},
    include: { patient: true, user: true, items: true, payments: true },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(budgets);
}

export async function POST(req: NextRequest) {
  const { items, ...data } = await req.json();
  const last = await prisma.budget.findFirst({ orderBy: { number: "desc" } });
  const number = (last?.number ?? 0) + 1;
  const budget = await prisma.budget.create({
    data: { ...data, number, items: { create: items.map((i: any) => ({ ...i, directCost: i.directCost ?? 0 })) } },
    include: { patient: true, user: true, items: true },
  });
  return NextResponse.json(budget, { status: 201 });
}
