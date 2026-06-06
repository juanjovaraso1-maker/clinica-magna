import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { prisma } from "@/lib/prisma";
import JSZip from "jszip";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token || (token as any).role !== "ADMIN") {
    return NextResponse.json({ error: "Acceso denegado — se requiere rol administrador" }, { status: 403 });
  }

  let backup: any;
  const ct = req.headers.get("content-type") ?? "";

  if (ct.includes("multipart/form-data")) {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "No se recibió archivo" }, { status: 400 });

    if (file.name.endsWith(".zip") || file.type.includes("zip")) {
      const zip = await JSZip.loadAsync(await file.arrayBuffer());
      const entry = Object.values(zip.files).find(f => f.name.endsWith(".json") && !f.dir);
      if (!entry) return NextResponse.json({ error: "El ZIP no contiene archivo JSON de respaldo" }, { status: 400 });
      backup = JSON.parse(await entry.async("string"));
    } else {
      backup = JSON.parse(await file.text());
    }
  } else {
    try { backup = await req.json(); } catch {
      return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
    }
  }

  if (backup?.app !== "clinica-magna" || !backup?.data) {
    return NextResponse.json({ error: "Archivo de respaldo no válido para esta aplicación" }, { status: 400 });
  }

  const d = backup.data;

  // ── Borrar en orden FK-safe ──────────────────────────────────────────
  await prisma.prescriptionRecord.deleteMany();
  await prisma.reminder.deleteMany();
  await prisma.patientDocument.deleteMany();
  await prisma.odontogramRecord.deleteMany();
  await prisma.facialRecord.deleteMany();
  await prisma.clinicalRecord.deleteMany();
  await prisma.evolution.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.budgetItem.deleteMany();
  await prisma.budget.deleteMany();
  await prisma.appointment.deleteMany();
  await prisma.emailCampaign.deleteMany();
  await prisma.emailTemplate.deleteMany();
  await prisma.blockedSlot.deleteMany();
  await prisma.expense.deleteMany();
  await prisma.convenio.deleteMany();
  await prisma.treatment.deleteMany();
  await prisma.clinicConfig.deleteMany();
  await prisma.patient.deleteMany();
  await prisma.user.deleteMany();

  // ── Insertar en orden FK-safe ────────────────────────────────────────
  const ins = async (create: (data: any) => Promise<any>, items: any[]) => {
    if (!items?.length) return;
    for (const item of items) {
      try { await create(item); } catch {}
    }
  };

  await ins((d) => prisma.clinicConfig.create({ data: d }),      d.clinicConfig);
  await ins((d) => prisma.user.create({ data: d }),              d.users);
  await ins((d) => prisma.patient.create({ data: d }),           d.patients);
  await ins((d) => prisma.treatment.create({ data: d }),         d.treatments);
  await ins((d) => prisma.expense.create({ data: d }),           d.expenses);
  await ins((d) => prisma.blockedSlot.create({ data: d }),       d.blockedSlots);
  await ins((d) => prisma.emailTemplate.create({ data: d }),     d.emailTemplates);
  await ins((d) => prisma.emailCampaign.create({ data: d }),     d.emailCampaigns);
  await ins((d) => prisma.convenio.create({ data: d }),          d.convenios);
  await ins((d) => prisma.appointment.create({ data: d }),       d.appointments);
  await ins((d) => prisma.clinicalRecord.create({ data: d }),    d.clinicalRecords);
  await ins((d) => prisma.patientDocument.create({ data: d }),   d.patientDocuments);
  await ins((d) => prisma.budget.create({ data: d }),            d.budgets);
  await ins((d) => prisma.budgetItem.create({ data: d }),        d.budgetItems);
  await ins((d) => prisma.payment.create({ data: d }),           d.payments);
  await ins((d) => prisma.evolution.create({ data: d }),         d.evolutions);
  await ins((d) => prisma.odontogramRecord.create({ data: d }),  d.odontogramRecords);
  await ins((d) => prisma.facialRecord.create({ data: d }),      d.facialRecords);
  await ins((d) => prisma.prescriptionRecord.create({ data: d }), d.prescriptions);
  await ins((d) => prisma.reminder.create({ data: d }),          d.reminders);

  return NextResponse.json({
    ok: true,
    timestamp: backup.timestamp,
    summary: backup.summary ?? {},
  });
}
