import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import nodemailer from "nodemailer";
import JSZip from "jszip";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Critical tables that MUST be present and non-empty for a valid backup
const REQUIRED_TABLES = ["users", "patients", "evolutions", "budgets", "payments"] as const;

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
      patients: patients.length, users: users.length,
      appointments: appointments.length, evolutions: evolutions.length,
      budgets: budgets.length, treatments: treatments.length,
      payments: payments.length,
    };

    const backup = {
      version: "1.0", timestamp: new Date().toISOString(),
      app: "clinica-magna", source: "weekly-cron", summary,
      data: {
        users, patients, appointments, evolutions, budgets, budgetItems, payments,
        expenses, treatments, clinicalRecords, odontogramRecords, facialRecords,
        prescriptions, reminders, patientDocuments, blockedSlots, emailTemplates,
        emailCampaigns, convenios, clinicConfig, labWorks, financeTasks, debts,
      },
    };

    const json     = JSON.stringify(backup, null, 2);
    const dateStr  = new Date().toISOString().slice(0, 10);

    // ── Integrity verification ────────────────────────────────────────────────
    const integrityErrors: string[] = [];

    // 1. Can we re-parse the JSON?
    let parsed: typeof backup;
    try { parsed = JSON.parse(json); } catch (e) { integrityErrors.push(`JSON inválido: ${e}`); }

    // 2. Are required tables present and non-empty?
    const data: Record<string, unknown[]> = {
      users, patients, evolutions, budgets, payments,
    };
    for (const table of REQUIRED_TABLES) {
      if (!data[table] || data[table].length === 0) {
        integrityErrors.push(`Tabla "${table}" está vacía — puede indicar pérdida de datos`);
      }
    }

    // 3. Every patient should have at least 1 evolution or appointment
    const evolPatientSet = new Set(evolutions.map((e) => e.patientId));
    const apptPatientSet = new Set(appointments.map((a) => a.patientId));
    const orphaned = patients.filter(
      (p) => !evolPatientSet.has(p.id) && !apptPatientSet.has(p.id)
    ).length;
    // Only flag if > 50% patients are orphaned (normal for new patients)
    if (orphaned > 0 && patients.length > 0 && orphaned / patients.length > 0.5) {
      integrityErrors.push(`${orphaned}/${patients.length} pacientes sin evoluciones ni citas — revisar`);
    }

    const integrityOk = integrityErrors.length === 0;

    // ── Store in DB (keep last 4 weekly backups + all manual) ────────────────
    const size = Buffer.byteLength(json, "utf8");
    await prisma.backupRecord.create({
      data: { source: "weekly", size, summary: JSON.stringify(summary), data: json },
    });
    const weeklies = await prisma.backupRecord.findMany({
      where: { source: "weekly" }, orderBy: { createdAt: "desc" }, select: { id: true },
    });
    if (weeklies.length > 4) {
      await prisma.backupRecord.deleteMany({ where: { id: { in: weeklies.slice(4).map((r) => r.id) } } });
    }

    await logAudit({ action: "BACKUP", entity: "System", details: { source: "weekly", summary, integrityOk } });

    // ── Send email ────────────────────────────────────────────────────────────
    const cfg = Object.fromEntries(clinicConfig.map((r) => [r.key, r.value]));
    const recipient = process.env.BACKUP_EMAIL || cfg.clinic_email || cfg.smtp_user;
    const host   = process.env.SMTP_HOST  || cfg.smtp_host;
    const port   = parseInt(process.env.SMTP_PORT  || cfg.smtp_port  || "465");
    const secure = (process.env.SMTP_SECURE || cfg.smtp_secure || "true") === "true";
    const user   = process.env.SMTP_USER  || cfg.smtp_user;
    const pass   = process.env.SMTP_PASS  || cfg.smtp_pass;
    const name   = cfg.clinic_name ?? "Clínica Magna";
    const date   = new Date().toLocaleDateString("es-CL");

    if (host && user && pass && recipient) {
      const zip = new JSZip();
      zip.file(`respaldo-semanal-clinica-magna-${dateStr}.json`, json);
      const zipBuffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE", compressionOptions: { level: 6 } });

      const integritySection = integrityOk
        ? `<div style="background:#d1fae5;border-left:4px solid #10b981;padding:10px 14px;border-radius:4px;margin:12px 0"><strong style="color:#065f46">✅ Verificación de integridad: CORRECTA</strong></div>`
        : `<div style="background:#fee2e2;border-left:4px solid #ef4444;padding:10px 14px;border-radius:4px;margin:12px 0"><strong style="color:#991b1b">⚠️ Verificación de integridad: ADVERTENCIAS</strong><ul style="margin:8px 0 0 16px;color:#7f1d1d">${integrityErrors.map((e) => `<li>${e}</li>`).join("")}</ul></div>`;

      const transporter = nodemailer.createTransport({ host, port, secure, auth: { user, pass } });
      await transporter.sendMail({
        from: `"${name}" <${user}>`, to: recipient,
        subject: `Respaldo SEMANAL ${name} — ${date}`,
        html: `
          <div style="font-family:Arial,sans-serif;max-width:540px;margin:0 auto">
            <div style="background:#1e3a5f;padding:20px;border-radius:8px 8px 0 0">
              <h2 style="color:white;margin:0">📦 Respaldo Semanal</h2>
              <p style="color:#93c5fd;margin:4px 0 0">${name} — ${date}</p>
            </div>
            <div style="padding:24px;background:#f8fafc;border-radius:0 0 8px 8px">
              <p>Se adjunta el respaldo <strong>semanal</strong> (domingos 22:00). Este respaldo es redundante al diario.</p>
              ${integritySection}
              <table style="width:100%;border-collapse:collapse;margin:16px 0">
                ${Object.entries(summary).map(([k, v]) => `<tr><td style="padding:5px;color:#6b7280">${k}</td><td style="padding:5px;font-weight:600">${v}</td></tr>`).join("")}
                <tr><td style="padding:5px;color:#6b7280">Tamaño (ZIP)</td><td style="padding:5px;font-weight:600">${(zipBuffer.length / 1024).toFixed(1)} KB</td></tr>
              </table>
              <p style="color:#6b7280;font-size:12px">Guarda este archivo en un lugar seguro fuera de la plataforma (Google Drive, pendrive cifrado, etc.).</p>
            </div>
          </div>
        `,
        attachments: [{ filename: `respaldo-semanal-clinica-magna-${dateStr}.zip`, content: zipBuffer, contentType: "application/zip" }],
      });
    }

    return NextResponse.json({ ok: true, summary, integrityOk, integrityErrors });
  } catch (e) {
    console.error("Weekly backup cron error:", e);
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
