import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const { name, discount, discountType } = await req.json();
  const convenio = await prisma.convenio.update({
    where: { id: params.id },
    data: { name, discount: parseFloat(discount), discountType: discountType || "pct" },
  });
  return NextResponse.json(convenio);
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  await prisma.convenio.update({ where: { id: params.id }, data: { active: false } });
  return NextResponse.json({ ok: true });
}
