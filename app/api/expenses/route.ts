import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const month = req.nextUrl.searchParams.get("month");
  const expenses = await prisma.expense.findMany({
    where: month ? { date: { startsWith: month } } : {},
    orderBy: { date: "desc" },
  });
  return NextResponse.json(expenses);
}

export async function POST(req: NextRequest) {
  const data = await req.json();
  const expense = await prisma.expense.create({ data });
  return NextResponse.json(expense, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json();
  await prisma.expense.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
