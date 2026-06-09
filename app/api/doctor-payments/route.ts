import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId");
  const month  = req.nextUrl.searchParams.get("month");

  const where: Record<string, unknown> = {};
  if (userId) where.userId = userId;
  if (month)  where.month  = month;

  const payments = await prisma.doctorPayment.findMany({
    where,
    include: { user: { select: { name: true, title: true } } },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(payments);
}

export async function POST(req: NextRequest) {
  const { userId, month, amount, notes } = await req.json();
  if (!userId || !month || !amount) {
    return NextResponse.json({ error: "userId, month y amount son requeridos" }, { status: 400 });
  }
  const payment = await prisma.doctorPayment.create({
    data: { userId, month, amount: parseFloat(amount), notes: notes || null },
    include: { user: { select: { name: true, title: true } } },
  });
  return NextResponse.json(payment);
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 });
  await prisma.doctorPayment.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
