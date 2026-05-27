import nodemailer from "nodemailer";
import { prisma } from "./prisma";

async function getConfig() {
  const rows = await prisma.clinicConfig.findMany();
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

export async function sendEmail(to: string, subject: string, html: string) {
  const cfg = await getConfig();
  const host  = process.env.SMTP_HOST  || cfg.smtp_host;
  const port  = parseInt(process.env.SMTP_PORT  || cfg.smtp_port  || "465");
  const secure= (process.env.SMTP_SECURE || cfg.smtp_secure || "true") === "true";
  const user  = process.env.SMTP_USER  || cfg.smtp_user;
  const pass  = process.env.SMTP_PASS  || cfg.smtp_pass;
  const name  = cfg.clinic_name ?? "Clínica Magna";

  if (!host || !user || !pass) {
    return { ok: false, error: "Email no configurado." };
  }
  try {
    const transporter = nodemailer.createTransport({ host, port, secure, auth: { user, pass } });
    await transporter.sendMail({ from: `"${name}" <${user}>`, to, subject, html });
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
        <a href="${confirmUrl}?action=cancel" style="background:#dc2626;color:white;padding:10px 24px;border-radius:8px;text-decoration:none;margin:0 8px;display:inline-block">✗ Cancelar</a>
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

export function buildBudgetHtml(cfg: Record<string,string>, data: {
  patientName: string; patientRut: string; budgetNumber: number; date: string; validUntil: string;
  professionalName: string; notes: string;
  items: Array<{ description:string; tooth:string; area:string; quantity:number; unitPrice:number; discount:number; total:number }>;
  subtotal: number; discount: number; total: number;
}) {
  const fmt = (n:number) => new Intl.NumberFormat("es-CL",{style:"currency",currency:"CLP",maximumFractionDigits:0}).format(n);
  const logo = cfg.clinic_logo ?? "";
  const rows = data.items.map((item,i) => `
    <tr style="border-bottom:1px solid #e2e8f0">
      <td style="padding:8px 10px;color:#374151;font-size:12px;text-align:center">${i+1}</td>
      <td style="padding:8px 10px;color:#374151;font-size:12px">${item.description}</td>
      <td style="padding:8px 10px;color:#374151;font-size:12px;text-align:center">${item.tooth||item.area||"—"}</td>
      <td style="padding:8px 10px;color:#374151;font-size:12px;text-align:center">${item.quantity}</td>
      <td style="padding:8px 10px;color:#1f2937;font-size:12px;text-align:right;font-weight:600">${fmt(item.total)}</td>
    </tr>`).join("");

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/></head><body style="margin:0;padding:20px;background:#f8fafc;font-family:Arial,sans-serif">
  <div style="max-width:640px;margin:0 auto;background:white;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08)">
    <div style="background:#3a5a40;padding:24px 32px;display:flex;align-items:center;justify-content:space-between">
      <div>
        <h1 style="color:white;margin:0;font-size:22px;font-weight:700">${cfg.clinic_name ?? "Clínica Magna"}</h1>
        <p style="color:#a3c4a8;margin:4px 0 0;font-size:13px">${cfg.clinic_slogan ?? "Odontología y Estética Facial"}</p>
      </div>
      <div style="text-align:right;color:#a3c4a8;font-size:11px;line-height:1.7">
        ${cfg.clinic_address ? `<div>${cfg.clinic_address}</div>` : ""}
        ${cfg.clinic_phone ? `<div>${cfg.clinic_phone}</div>` : ""}
        ${cfg.clinic_email ? `<div>${cfg.clinic_email}</div>` : ""}
        ${cfg.clinic_web ? `<div>${cfg.clinic_web}</div>` : ""}
      </div>
    </div>

    <div style="padding:28px 32px">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px">
        <div>
          <h2 style="margin:0;font-size:18px;color:#1f2937;font-weight:700">PRESUPUESTO DENTAL</h2>
          <p style="margin:4px 0 0;font-size:12px;color:#6b7280">N° ${String(data.budgetNumber).padStart(4,"0")} · Válido por 30 días</p>
        </div>
        <div style="text-align:right;font-size:12px;color:#6b7280">
          <div><strong>Fecha:</strong> ${data.date}</div>
          <div><strong>Vence:</strong> ${data.validUntil}</div>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:24px">
        <div style="background:#f0f4f0;border-radius:8px;padding:14px 16px">
          <p style="margin:0 0 4px;font-size:10px;font-weight:700;color:#3a5a40;text-transform:uppercase;letter-spacing:.5px">Profesional</p>
          <p style="margin:0;font-size:13px;font-weight:600;color:#1f2937">${data.professionalName}</p>
        </div>
        <div style="background:#f0f4f0;border-radius:8px;padding:14px 16px">
          <p style="margin:0 0 4px;font-size:10px;font-weight:700;color:#3a5a40;text-transform:uppercase;letter-spacing:.5px">Paciente</p>
          <p style="margin:0;font-size:13px;font-weight:600;color:#1f2937">${data.patientName}</p>
          <p style="margin:2px 0 0;font-size:11px;color:#6b7280">RUT: ${data.patientRut}</p>
        </div>
      </div>

      <table style="width:100%;border-collapse:collapse;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden">
        <thead>
          <tr style="background:#3a5a40">
            <th style="padding:10px;color:white;font-size:11px;text-align:center;width:36px">N°</th>
            <th style="padding:10px;color:white;font-size:11px;text-align:left">Tratamiento</th>
            <th style="padding:10px;color:white;font-size:11px;text-align:center">Diente</th>
            <th style="padding:10px;color:white;font-size:11px;text-align:center">Ses.</th>
            <th style="padding:10px;color:white;font-size:11px;text-align:right">Precio</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
        <tfoot>
          ${data.discount > 0 ? `
          <tr style="background:#f8fafc"><td colspan="4" style="padding:8px 10px;text-align:right;font-size:12px;color:#6b7280">Subtotal</td><td style="padding:8px 10px;text-align:right;font-size:12px;color:#374151">${fmt(data.subtotal)}</td></tr>
          <tr style="background:#f8fafc"><td colspan="4" style="padding:8px 10px;text-align:right;font-size:12px;color:#6b7280">Descuento</td><td style="padding:8px 10px;text-align:right;font-size:12px;color:#dc2626">-${fmt(data.discount)}</td></tr>
          ` : ""}
          <tr style="background:#3a5a40">
            <td colspan="4" style="padding:12px 10px;text-align:right;font-size:13px;font-weight:700;color:white">TOTAL</td>
            <td style="padding:12px 10px;text-align:right;font-size:15px;font-weight:700;color:white">${fmt(data.total)}</td>
          </tr>
        </tfoot>
      </table>

      ${data.notes ? `<div style="margin-top:16px;padding:12px 16px;background:#fffbeb;border-left:4px solid #f59e0b;border-radius:4px;font-size:12px;color:#92400e"><strong>Observaciones:</strong> ${data.notes}</div>` : ""}

      <div style="margin-top:20px;padding:14px 16px;background:#f0f4f0;border-radius:8px;font-size:11px;color:#6b7280;line-height:1.8">
        <strong style="color:#3a5a40">Condiciones del presupuesto:</strong><br/>
        • Este presupuesto tiene una validez de 30 días desde la fecha de emisión.<br/>
        • Algunos tratamientos están sujetos a diagnóstico definitivo, por lo que los costos pueden variar.<br/>
        • Los precios incluyen honorarios profesionales. Insumos especiales no están incluidos salvo indicación.<br/>
        • ${cfg.clinic_disclaimer ?? "Los tratamientos marcados con (*) requieren evaluación adicional antes de iniciar."}
      </div>
    </div>

    <div style="background:#f1f5f9;padding:14px 32px;text-align:center;color:#64748b;font-size:11px;border-top:1px solid #e2e8f0">
      ${cfg.clinic_name ?? "Clínica Magna"} · ${cfg.clinic_phone ?? ""} · ${cfg.clinic_email ?? ""} · ${cfg.clinic_web ?? ""}
    </div>
  </div>
</body></html>`;
}

export function buildRxEmailHtml(cfg: Record<string,string>, data: {
  patientName: string; patientRut: string; professionalName: string;
  medications: Array<{drug:string;dose:string;freq:string;duration:string;route:string;instructions:string}>;
  notes: string; date: string;
}) {
  const rows = data.medications.map((m,i) => `
    <tr style="border-bottom:1px solid #f1f5f9">
      <td style="padding:10px 12px;font-weight:700;color:#1f2937;font-size:13px">${i+1}. ${m.drug}</td>
      <td style="padding:10px 12px;color:#374151;font-size:12px">${m.dose}${m.route?` (${m.route})`:""}</td>
      <td style="padding:10px 12px;color:#374151;font-size:12px">${m.freq}</td>
      <td style="padding:10px 12px;color:#374151;font-size:12px">${m.duration}</td>
    </tr>
    ${m.instructions?`<tr style="border-bottom:1px solid #f1f5f9"><td colspan="4" style="padding:2px 12px 10px;color:#6b7280;font-size:11px;font-style:italic">↳ ${m.instructions}</td></tr>`:""}
  `).join("");
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/></head><body style="margin:0;padding:20px;background:#f8fafc;font-family:Arial,sans-serif">
  <div style="max-width:600px;margin:0 auto;background:white;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08)">
    <div style="background:#3a5a40;padding:20px 28px;display:flex;justify-content:space-between;align-items:center">
      <div>
        <h1 style="color:white;margin:0;font-size:18px;font-weight:700">${cfg.clinic_name ?? "Clínica Magna"}</h1>
        <p style="color:#a3c4a8;margin:3px 0 0;font-size:12px">${cfg.clinic_slogan ?? "Odontología y Estética Facial"}</p>
      </div>
      <div style="text-align:right;color:#a3c4a8;font-size:11px;line-height:1.7">
        ${cfg.clinic_phone ? `<div>${cfg.clinic_phone}</div>` : ""}
        ${cfg.clinic_email ? `<div>${cfg.clinic_email}</div>` : ""}
      </div>
    </div>
    <div style="padding:24px 28px">
      <h2 style="margin:0 0 4px;font-size:20px;color:#1f2937;font-weight:700;text-align:center">℞ RECETA MÉDICA</h2>
      <p style="text-align:center;font-size:12px;color:#6b7280;margin:0 0 20px">${data.date}</p>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px">
        <div style="background:#f0f4f0;border-radius:8px;padding:12px"><p style="margin:0 0 3px;font-size:10px;font-weight:700;color:#3a5a40;text-transform:uppercase">Paciente</p><p style="margin:0;font-weight:600;color:#1f2937">${data.patientName}</p><p style="margin:2px 0 0;font-size:11px;color:#6b7280">${data.patientRut}</p></div>
        <div style="background:#f0f4f0;border-radius:8px;padding:12px"><p style="margin:0 0 3px;font-size:10px;font-weight:700;color:#3a5a40;text-transform:uppercase">Profesional</p><p style="margin:0;font-weight:600;color:#1f2937">${data.professionalName}</p></div>
      </div>
      <table style="width:100%;border-collapse:collapse;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;margin-bottom:16px">
        <thead><tr style="background:#3a5a40"><th style="padding:8px 12px;color:white;font-size:11px;text-align:left">Fármaco</th><th style="padding:8px 12px;color:white;font-size:11px;text-align:left">Dosis/Vía</th><th style="padding:8px 12px;color:white;font-size:11px;text-align:left">Frecuencia</th><th style="padding:8px 12px;color:white;font-size:11px;text-align:left">Duración</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      ${data.notes?`<div style="padding:12px 16px;background:#fffbeb;border-left:4px solid #f59e0b;border-radius:4px;font-size:12px;color:#92400e"><strong>Indicaciones:</strong> ${data.notes}</div>`:""}
    </div>
    <div style="background:#f1f5f9;padding:12px 28px;text-align:center;color:#64748b;font-size:11px;border-top:1px solid #e2e8f0">
      ${cfg.clinic_name ?? "Clínica Magna"} · ${cfg.clinic_phone ?? ""} · ${cfg.clinic_email ?? ""}
    </div>
  </div></body></html>`;
}

export function buildCareEmailHtml(cfg: Record<string,string>, data: {
  patientName: string; professionalName: string; templateName: string; text: string; date: string;
}) {
  const lines = data.text.split("\n").map(l => `<p style="margin:6px 0;color:#374151;font-size:13px">${l}</p>`).join("");
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/></head><body style="margin:0;padding:20px;background:#f8fafc;font-family:Arial,sans-serif">
  <div style="max-width:600px;margin:0 auto;background:white;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08)">
    <div style="background:#3a5a40;padding:20px 28px">
      <h1 style="color:white;margin:0;font-size:18px;font-weight:700">${cfg.clinic_name ?? "Clínica Magna"}</h1>
      <p style="color:#a3c4a8;margin:3px 0 0;font-size:12px">${cfg.clinic_slogan ?? "Odontología y Estética Facial"}</p>
    </div>
    <div style="padding:24px 28px">
      <h2 style="margin:0 0 4px;font-size:18px;color:#1f2937;font-weight:700;text-align:center">INSTRUCCIONES DE CUIDADOS</h2>
      <p style="text-align:center;font-size:13px;font-weight:600;color:#3a5a40;margin:4px 0 16px">${data.templateName}</p>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px">
        <div style="background:#f0f4f0;border-radius:8px;padding:12px"><p style="margin:0 0 3px;font-size:10px;font-weight:700;color:#3a5a40;text-transform:uppercase">Paciente</p><p style="margin:0;font-weight:600;color:#1f2937">${data.patientName}</p></div>
        <div style="background:#f0f4f0;border-radius:8px;padding:12px"><p style="margin:0 0 3px;font-size:10px;font-weight:700;color:#3a5a40;text-transform:uppercase">Profesional</p><p style="margin:0;font-weight:600;color:#1f2937">${data.professionalName}</p><p style="margin:2px 0 0;font-size:11px;color:#6b7280">${data.date}</p></div>
      </div>
      <div style="background:#f0f4f0;border-radius:8px;padding:16px 20px;line-height:1.8">${lines}</div>
    </div>
    <div style="background:#f1f5f9;padding:12px 28px;text-align:center;color:#64748b;font-size:11px;border-top:1px solid #e2e8f0">
      ${cfg.clinic_name ?? "Clínica Magna"} · ${cfg.clinic_phone ?? ""} · ${cfg.clinic_email ?? ""}
    </div>
  </div></body></html>`;
}

export function buildBirthdayHtml(cfg: Record<string,string>, patientName: string) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/></head><body style="margin:0;padding:20px;background:#f8fafc;font-family:Arial,sans-serif">
  <div style="max-width:520px;margin:0 auto;background:white;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08)">
    <div style="background:linear-gradient(135deg,#3a5a40,#588157);padding:40px 32px;text-align:center">
      <div style="font-size:48px;margin-bottom:8px">🎂</div>
      <h1 style="color:white;margin:0;font-size:24px">¡Feliz Cumpleaños!</h1>
    </div>
    <div style="padding:32px;text-align:center">
      <p style="font-size:17px;color:#1f2937;margin:0 0 12px">Estimado/a <strong>${patientName}</strong>,</p>
      <p style="font-size:14px;color:#6b7280;line-height:1.7;margin:0 0 20px">
        En este día especial, todo el equipo de <strong>${cfg.clinic_name ?? "Clínica Magna"}</strong>
        quiere desearle un muy feliz cumpleaños. 🎉<br/><br/>
        Esperamos que este nuevo año esté lleno de salud, felicidad y muchas sonrisas. 😊
      </p>
      <div style="background:#f0f4f0;border-radius:12px;padding:16px;display:inline-block;margin:0 auto">
        <p style="margin:0;font-size:13px;color:#3a5a40;font-weight:600">¿Tienes algún control o tratamiento pendiente?</p>
        <p style="margin:6px 0 0;font-size:12px;color:#6b7280">Contáctanos para agendar tu cita</p>
        ${cfg.clinic_phone ? `<p style="margin:6px 0 0;font-size:13px;color:#3a5a40;font-weight:700">📞 ${cfg.clinic_phone}</p>` : ""}
        ${cfg.clinic_whatsapp ? `<p style="margin:4px 0 0;font-size:13px;color:#25d366;font-weight:700">💬 WhatsApp: ${cfg.clinic_whatsapp}</p>` : ""}
      </div>
    </div>
    <div style="background:#f1f5f9;padding:14px 32px;text-align:center;color:#94a3b8;font-size:11px;border-top:1px solid #e2e8f0">
      ${cfg.clinic_name ?? "Clínica Magna"} · ${cfg.clinic_address ?? ""} · ${cfg.clinic_email ?? ""}
    </div>
  </div>
</body></html>`;
}
