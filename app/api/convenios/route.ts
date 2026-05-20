import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const convenios = await prisma.convenio.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
  });
  return NextResponse.json(convenios);
}

export async function POST(req: Request) {
  const { name, discount, discountType } = await req.json();
  if (!name || discount == null) {
    return NextResponse.json({ error: "Nombre y descuento requeridos." }, { status: 400 });
  }
  const convenio = await prisma.convenio.create({
    data: { name, discount: parseFloat(discount), discountType: discountType || "pct" },
  });
  return NextResponse.json(convenio);
}
