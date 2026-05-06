import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const patient = await prisma.patient.findUnique({
    where: { id: params.id },
    include: {
      clinicalRecord: true,
      evolutions: { include: { user: true }, orderBy: { date: "desc" } },
      budgets: { include: { items: true, user: true, payments: true }, orderBy: { createdAt: "desc" } },
      payments: { include: { budget: true }, orderBy: { date: "desc" } },
      appointments: { include: { user: true }, orderBy: { date: "desc" } },
      documents: { orderBy: { createdAt: "desc" } },
      odontogram: true,
      facialRecord: true,
    },
  });
  if (!patient) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(patient);
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const data = await req.json();
  const { clinicalRecord, evolutions, budgets, payments, appointments, documents, odontogram, facialRecord, _count, ...rest } = data;
  const patient = await prisma.patient.update({ where: { id: params.id }, data: rest });
  return NextResponse.json(patient);
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  await prisma.patient.update({ where: { id: params.id }, data: { active: false } });
  return NextResponse.json({ ok: true });
}
