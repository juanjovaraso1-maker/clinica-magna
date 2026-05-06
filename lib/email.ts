import nodemailer from "nodemailer";
import { prisma } from "./prisma";

async function getConfig() {
  const rows = await prisma.clinicConfig.findMany();
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

export async function sendEmail(to: string, subject: string, html: string) {
  const cfg = await getConfig();
  if (!cfg.smtp_host || !cfg.smtp_user || !cfg.smtp_pass) {
    return { ok: false, error: "Email no configurado. Configure el SMTP en Configuración." };
  }
  try {
    const transporter = nodemailer.createTransport({
      host: cfg.smtp_host,
      port: parseInt(cfg.smtp_port ?? "587"),
      secure: cfg.smtp_secure === "true",
      auth: { user: cfg.smtp_user, pass: cfg.smtp_pass },
    });
    await transporter.sendMail({
      from: `"${cfg.clinic_name ?? "Clínica Magna"}" <${cfg.smtp_user}>`,
      to,
      subject,
      html,
    });
    return { ok: true };
  } catch (e: unknown) {
    return { ok: false, error: String(e) };
  }
}

export function buildReminderHtml(cfg: Record<string, string>, data: {
  patientName: string; date: string; startTime: string; type: string;
  confirmToken?: string; baseUrl?: string;
}) {
  const confirmUrl = data.confirmToken
    ? `${data.baseUrl ?? "http://localhost:3000"}/confirmar/${data.confirmToken}`
    : null;

  return `
  <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;background:#f8fafc;border-radius:12px;overflow:hidden">
    <div style="background:#2563eb;padding:24px;text-align:center">
      <h1 style="color:white;margin:0;font-size:20px">${cfg.clinic_name ?? "Clínica Magna"}</h1>
      <p style="color:#93c5fd;margin:4px 0 0">${cfg.clinic_address ?? ""}</p>
    </div>
    <div style="padding:32px">
      <p style="color:#374151;font-size:16px">Estimado/a <strong>${data.patientName}</strong>,</p>
      <p style="color:#374151">Le recordamos que tiene una cita agendada:</p>
      <div style="background:white;border-radius:8px;padding:16px;margin:16px 0;border-left:4px solid #2563eb">
        <p style="margin:4px 0;color:#1f2937"><strong>Fecha:</strong> ${data.date}</p>
        <p style="margin:4px 0;color:#1f2937"><strong>Hora:</strong> ${data.startTime}</p>
        <p style="margin:4px 0;color:#1f2937"><strong>Tipo:</strong> ${data.type}</p>
        <p style="margin:4px 0;color:#1f2937"><strong>Dirección:</strong> ${cfg.clinic_address ?? "Consultar"}</p>
        <p style="margin:4px 0;color:#1f2937"><strong>Teléfono:</strong> ${cfg.clinic_phone ?? "Consultar"}</p>
      </div>
      ${confirmUrl ? `
      <p style="color:#374151;margin-top:20px">Por favor confirme su asistencia:</p>
      <div style="text-align:center;margin:16px 0">
        <a href="${confirmUrl}?action=confirm" style="background:#16a34a;color:white;padding:10px 24px;border-radius:8px;text-decoration:none;margin:0 8px;display:inline-block">✓ Confirmar</a>
        <a href="${confirmUrl}?action=reject" style="background:#dc2626;color:white;padding:10px 24px;border-radius:8px;text-decoration:none;margin:0 8px;display:inline-block">✗ Cancelar</a>
      </div>
      ` : ""}
    </div>
    <div style="background:#f1f5f9;padding:16px;text-align:center;color:#64748b;font-size:12px">
      ${cfg.clinic_name ?? "Clínica Magna"} · ${cfg.clinic_phone ?? ""} · ${cfg.clinic_email ?? ""}
    </div>
  </div>`;
}

export function buildWhatsappUrl(phone: string, message: string) {
  const clean = phone.replace(/\D/g, "");
  const formatted = clean.startsWith("56") ? clean : `56${clean}`;
  return `https://wa.me/${formatted}?text=${encodeURIComponent(message)}`;
}
