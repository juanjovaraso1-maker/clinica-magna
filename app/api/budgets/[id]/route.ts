import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const { items, patient, user, payments, ...data } = await req.json();

  if (items) {
    await prisma.budgetItem.deleteMany({ where: { budgetId: params.id } });
    if (items.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await prisma.budgetItem.createMany({ data: items.map((i: any) => ({ budgetId: params.id, description: i.description, tooth: i.tooth||null, area: i.area||null, quantity: i.quantity, unitPrice: i.unitPrice, discount: i.discount, total: i.total })) });
    }
  }

  const budget = await prisma.budget.update({
    where: { id: params.id },
    data,
    include: { patient: true, user: true, items: true, payments: true },
  });
  return NextResponse.json(budget);
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  await prisma.budget.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
