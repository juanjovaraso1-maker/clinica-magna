import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const treatments = await prisma.treatment.findMany({
    where: { active: true },
    orderBy: [{ category: "asc" }, { name: "asc" }],
  });
  return NextResponse.json(treatments);
}

export async function POST(req: NextRequest) {
  const data = await req.json();
  const treatment = await prisma.treatment.create({ data });
  return NextResponse.json(treatment, { status: 201 });
}

export async function PUT(req: NextRequest) {
  const { id, ...data } = await req.json();
  const treatment = await prisma.treatment.update({ where: { id }, data });
  return NextResponse.json(treatment);
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json();
  await prisma.treatment.update({ where: { id }, data: { active: false } });
  return NextResponse.json({ ok: true });
}
