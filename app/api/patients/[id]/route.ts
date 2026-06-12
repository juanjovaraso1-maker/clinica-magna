import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { prisma } from "@/lib/prisma";
import { logAudit, getIp } from "@/lib/audit";

async function getActor(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  return token ? { id: (token as any).id as string, name: token.name ?? "" } : null;
}

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const patient = await prisma.patient.findUnique({
    where: { id: params.id },
    include: {
      clinicalRecord: true,
      evolutions: { where: { deletedAt: null }, include: { user: true }, orderBy: [{ date: "desc" }, { createdAt: "desc" }] },
      budgets: { include: { items: true, user: true, payments: true }, orderBy: { createdAt: "desc" } },
      payments: { where: { deletedAt: null }, include: { budget: true }, orderBy: { date: "desc" } },
      appointments: { include: { user: true }, orderBy: { date: "desc" } },
      documents: { orderBy: { createdAt: "desc" } },
      odontograms: { orderBy: { date: "desc" } },
      facialRecord: true,
    },
  });
  if (!patient) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(patient);
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const actor = await getActor(req);
    const data = await req.json();
    const { clinicalRecord, evolutions, budgets, payments, appointments, documents, odontogram, odontograms, facialRecord, _count, ...rest } = data;
    if (rest.birthDate) rest.birthDate = new Date(rest.birthDate);
    const patient = await prisma.patient.update({ where: { id: params.id }, data: rest });
    await logAudit({ userId: actor?.id, userName: actor?.name, action: "UPDATE", entity: "Patient", entityId: params.id, ip: getIp(req) });
    return NextResponse.json(patient);
  } catch (e) {
    console.error("PUT /api/patients error:", e);
    return NextResponse.json({ error: "Error al actualizar paciente" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const actor = await getActor(req);
  const { searchParams } = new URL(req.url);

  if (searchParams.get("hard") === "true") {
    // Hard delete: only allowed for admins
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    if ((token as any)?.role !== "ADMIN") {
      return NextResponse.json({ error: "Solo administradores pueden eliminar permanentemente" }, { status: 403 });
    }
    const patient = await prisma.patient.findUnique({ where: { id: params.id }, select: { firstName: true, lastName: true } });
    await prisma.prescriptionRecord.deleteMany({ where: { patientId: params.id } });
    await prisma.reminder.deleteMany({ where: { patientId: params.id } });
    await prisma.payment.deleteMany({ where: { patientId: params.id } });
    await prisma.evolution.deleteMany({ where: { patientId: params.id } });
    await prisma.budget.deleteMany({ where: { patientId: params.id } });
    await prisma.appointment.deleteMany({ where: { patientId: params.id } });
    await prisma.patientDocument.deleteMany({ where: { patientId: params.id } });
    await prisma.odontogramRecord.deleteMany({ where: { patientId: params.id } });
    await prisma.facialRecord.deleteMany({ where: { patientId: params.id } });
    await prisma.clinicalRecord.deleteMany({ where: { patientId: params.id } });
    await prisma.patient.delete({ where: { id: params.id } });
    await logAudit({ userId: actor?.id, userName: actor?.name, action: "DELETE", entity: "Patient", entityId: params.id, details: { name: `${patient?.firstName} ${patient?.lastName}`, permanent: true }, ip: getIp(req) });
    return NextResponse.json({ ok: true });
  }

  // Soft delete (default)
  await prisma.patient.update({ where: { id: params.id }, data: { active: false } });
  await logAudit({ userId: actor?.id, userName: actor?.name, action: "DELETE", entity: "Patient", entityId: params.id, details: { softDelete: true }, ip: getIp(req) });
  return NextResponse.json({ ok: true });
}
