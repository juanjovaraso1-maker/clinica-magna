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
  try {
    const data = await req.json();
    const { clinicalRecord, evolutions, budgets, payments, appointments, documents, odontogram, facialRecord, _count, ...rest } = data;
    if (rest.birthDate) rest.birthDate = new Date(rest.birthDate);
    const patient = await prisma.patient.update({ where: { id: params.id }, data: rest });
    return NextResponse.json(patient);
  } catch (e) {
    console.error("PUT /api/patients error:", e);
    return NextResponse.json({ error: "Error al actualizar paciente" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const { searchParams } = new URL(req.url);
  if (searchParams.get("hard") === "true") {
    await prisma.payment.deleteMany({ where: { patientId: params.id } });
    await prisma.evolution.deleteMany({ where: { patientId: params.id } });
    await prisma.budget.deleteMany({ where: { patientId: params.id } });
    await prisma.appointment.deleteMany({ where: { patientId: params.id } });
    await prisma.patientDocument.deleteMany({ where: { patientId: params.id } });
    await prisma.odontogramRecord.deleteMany({ where: { patientId: params.id } });
    await prisma.facialRecord.deleteMany({ where: { patientId: params.id } });
    await prisma.clinicalRecord.deleteMany({ where: { patientId: params.id } });
    await prisma.patient.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  }
  await prisma.patient.update({ where: { id: params.id }, data: { active: false } });
  return NextResponse.json({ ok: true });
}
