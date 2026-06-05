import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { prisma } from "@/lib/prisma";

async function createBackupData() {
  const [
    users, patients, appointments, evolutions, budgets, budgetItems, payments,
    expenses, treatments, clinicalRecords, odontogramRecords, facialRecords,
    prescriptions, reminders, patientDocuments, blockedSlots, emailTemplates,
    emailCampaigns, convenios, clinicConfig,
  ] = await Promise.all([
    prisma.user.findMany(),
    prisma.patient.findMany(),
    prisma.appointment.findMany(),
    prisma.evolution.findMany(),
    prisma.budget.findMany(),
    prisma.budgetItem.findMany(),
    prisma.payment.findMany(),
    prisma.expense.findMany(),
    prisma.treatment.findMany(),
    prisma.clinicalRecord.findMany(),
    prisma.odontogramRecord.findMany(),
    prisma.facialRecord.findMany(),
    prisma.prescriptionRecord.findMany(),
    prisma.reminder.findMany(),
    prisma.patientDocument.findMany(),
    prisma.blockedSlot.findMany(),
    prisma.emailTemplate.findMany(),
    prisma.emailCampaign.findMany(),
    prisma.convenio.findMany(),
    prisma.clinicConfig.findMany(),
  ]);

  const summary = {
    patients: patients.length,
    users: users.length,
    appointments: appointments.length,
    evolutions: evolutions.length,
    budgets: budgets.length,
    treatments: treatments.length,
  };

  return {
    backup: {
      version: "1.0",
      timestamp: new Date().toISOString(),
      app: "clinica-magna",
      summary,
      data: {
        users, patients, appointments, evolutions, budgets, budgetItems, payments,
        expenses, treatments, clinicalRecords, odontogramRecords, facialRecords,
        prescriptions, reminders, patientDocuments, blockedSlots, emailTemplates,
        emailCampaigns, convenios, clinicConfig,
      },
    },
    summary,
  };
}

async function storeBackup(json: string, summary: object, source: string) {
  const size = Buffer.byteLength(json, "utf8");
  await prisma.backupRecord.create({
    data: { source, size, summary: JSON.stringify(summary), data: json },
  });
  // Keep only last 7
  const all = await prisma.backupRecord.findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  if (all.length > 7) {
    await prisma.backupRecord.deleteMany({
      where: { id: { in: all.slice(7).map((r) => r.id) } },
    });
  }
}

// GET — list stored backups (and trigger auto-backup if > 23h since last one)
export async function GET(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token || (token as any).role !== "ADMIN") {
    return NextResponse.json({ error: "Acceso denegado — se requiere rol administrador" }, { status: 403 });
  }
  const records = await prisma.backupRecord.findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true, source: true, size: true, summary: true, createdAt: true },
  });

  // Auto-backup if none exists or last one is > 23h old
  const lastAuto = await prisma.backupRecord.findFirst({
    where: { source: "auto" },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  const needsAuto =
    !lastAuto ||
    Date.now() - new Date(lastAuto.createdAt).getTime() > 23 * 60 * 60 * 1000;

  if (needsAuto) {
    // Fire and forget — don't await so the list returns fast
    createBackupData().then(({ backup, summary }) => {
      const json = JSON.stringify(backup);
      return storeBackup(json, summary, "auto");
    }).catch(() => {});
  }

  return NextResponse.json(records);
}

// POST — create manual backup and return as downloadable file
export async function POST(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token || (token as any).role !== "ADMIN") {
    return NextResponse.json({ error: "Acceso denegado — se requiere rol administrador" }, { status: 403 });
  }
  const { backup, summary } = await createBackupData();
  const json = JSON.stringify(backup, null, 2);
  await storeBackup(json, summary, "manual");

  const date = new Date().toISOString().slice(0, 10);
  return new NextResponse(json, {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="clinica-magna-backup-${date}.json"`,
    },
  });
}
