import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const month = req.nextUrl.searchParams.get("month");
  const payments = await prisma.payment.findMany({
    where: month ? { date: { startsWith: month } } : {},
    include: { patient: true, budget: true },
    orderBy: { date: "desc" },
  });
  return NextResponse.json(payments);
}

export async function POST(req: NextRequest) {
  const data = await req.json();
  const payment = await prisma.payment.create({
    data,
    include: { patient: true, budget: true },
  });
  return NextResponse.json(payment, { status: 201 });
}
