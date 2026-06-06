import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const debts = await prisma.debt.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json(debts);
}

export async function POST(req: NextRequest) {
  const data = await req.json();
  const debt = await prisma.debt.create({ data });
  return NextResponse.json(debt, { status: 201 });
}
