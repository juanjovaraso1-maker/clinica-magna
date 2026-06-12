import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import nodemailer from "nodemailer";
import JSZip from "jszip";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET() {
  try {
    const [
      users, patients, appointments, evolutions, budgets, budgetItems, payments,
      expenses, treatments, clinicalRecords, odontogramRecords, facialRecords,
      prescriptions, reminders, patientDocuments, blockedSlots, emailTemplates,
      emailCampaigns, convenios, clinicConfig, labWorks, financeTasks, debts,
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
      prisma.labWork.findMany(),
      prisma.financeTask.findMany(),
      prisma.debt.findMany(),
    ]);

    const summary = {
      patients: patients.length,
      users: users.length,
      appointments: appointments.length,
      evolutions: evolutions.length,
      budgets: budgets.length,
      treatments: treatments.length,
    };

    const backup = {
      version: "1.0",
      timestamp: new Date().toISOString(),
      app: "clinica-magna",
      summary,
      data: {
        users, patients, appointments, evolutions, budgets, budgetItems, payments,
        expenses, treatments, clinicalRecords, odontogramRecords, facialRecords,
        prescriptions, reminders, patientDocuments, blockedSlots, emailTemplates,
        emailCampaigns, convenios, clinicConfig, labWorks, financeTasks, debts,
      },
    };

    const json = JSON.stringify(backup, null, 2);
    const dateStr = new Date().toISOString().slice(0, 10);

    // Build ZIP
    const zip = new JSZip();
    zip.file(`respaldo-clinica-magna-${dateStr}.json`, json);
    const zipBuffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE", compressionOptions: { level: 6 } });

    // ── Integrity check: verify JSON is parseable and has key tables ─────────
    const integrityErrors: string[] = [];
    try { JSON.parse(json); } catch (e) { integrityErrors.push(`JSON inválido: ${e}`); }
    if (!patients.length) integrityErrors.push("Tabla patients está vacía");
    if (!users.length)    integrityErrors.push("Tabla users está vacía");
    const integrityOk = integrityErrors.length === 0;

    // Store in DB (keep last 7)
    const size = Buffer.byteLength(json, "utf8");
    await prisma.backupRecord.create({
      data: { source: "cron", size, summary: JSON.stringify({ ...summary, integrityOk }), data: json },
    });
    const all = await prisma.backupRecord.findMany({ orderBy: { createdAt: "desc" }, select: { id: true } });
    if (all.length > 7) {
      await prisma.backupRecord.deleteMany({ where: { id: { in: all.slice(7).map(r => r.id) } } });
    }

    // Determine recipient — prefer BACKUP_EMAIL env var, fallback to clinic config email
    const cfg = Object.fromEntries(clinicConfig.map(r => [r.key, r.value]));
    const recipient = process.env.BACKUP_EMAIL || cfg.clinic_email || cfg.smtp_user;
    const host   = process.env.SMTP_HOST  || cfg.smtp_host;
    const port   = parseInt(process.env.SMTP_PORT  || cfg.smtp_port  || "465");
    const secure = (process.env.SMTP_SECURE || cfg.smtp_secure || "true") === "true";
    const user   = process.env.SMTP_USER  || cfg.smtp_user;
    const pass   = process.env.SMTP_PASS  || cfg.smtp_pass;
    const name   = cfg.clinic_name ?? "Clínica Magna";
    const date   = new Date().toLocaleDateString("es-CL");

    if (host && user && pass && recipient) {
      const transporter = nodemailer.createTransport({ host, port, secure, auth: { user, pass } });
      await transporter.sendMail({
        from: `"${name}" <${user}>`,
        to: recipient,
        subject: `Respaldo automático ${name} — ${date}`,
        html: `
          <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto">
            <div style="background:#1e3a5f;padding:20px;border-radius:8px 8px 0 0">
              <h2 style="color:white;margin:0">📦 Respaldo automático</h2>
              <p style="color:#93c5fd;margin:4px 0 0">${name}</p>
            </div>
            <div style="padding:24px;background:#f8fafc;border-radius:0 0 8px 8px">
              <p>Se adjunta el respaldo automático generado el <strong>${date}</strong>.</p>
              <table style="width:100%;border-collapse:collapse;margin:16px 0">
                <tr><td style="padding:6px;color:#6b7280">Pacientes</td><td style="padding:6px;font-weight:600">${summary.patients}</td></tr>
                <tr><td style="padding:6px;color:#6b7280">Citas</td><td style="padding:6px;font-weight:600">${summary.appointments}</td></tr>
                <tr><td style="padding:6px;color:#6b7280">Evoluciones</td><td style="padding:6px;font-weight:600">${summary.evolutions}</td></tr>
                <tr><td style="padding:6px;color:#6b7280">Presupuestos</td><td style="padding:6px;font-weight:600">${summary.budgets}</td></tr>
                <tr><td style="padding:6px;color:#6b7280">Tamaño (JSON)</td><td style="padding:6px;font-weight:600">${(size/1024).toFixed(1)} KB</td></tr>
                <tr><td style="padding:6px;color:#6b7280">Tamaño (ZIP)</td><td style="padding:6px;font-weight:600">${(zipBuffer.length/1024).toFixed(1)} KB</td></tr>
              </table>
              <p style="color:#6b7280;font-size:13px">Este respaldo fue generado automáticamente a las 09:00 hora Chile. Guárdalo en un lugar seguro.</p>
            </div>
          </div>
        `,
        attachments: [{
          filename: `respaldo-clinica-magna-${dateStr}.zip`,
          content: zipBuffer,
          contentType: "application/zip",
        }],
      });
    }

    return NextResponse.json({ ok: true, summary });
  } catch (e) {
    console.error("Backup cron error:", e);
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
