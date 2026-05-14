import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const { date, amount, method, notes } = await req.json();
  const payment = await prisma.payment.update({
    where: { id: params.id },
    data: { date, amount: parseFloat(String(amount)), method, notes },
    include: { patient: true, budget: true },
  });
  return NextResponse.json(payment);
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  await prisma.payment.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
