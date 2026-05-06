import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendEmail, buildReminderHtml, buildWhatsappUrl } from "@/lib/email";
import { randomUUID } from "crypto";

export async function POST(req: NextRequest) {
  const { appointmentId, channel } = await req.json();

  const appt = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: { patient: true, user: true },
  });
  if (!appt) return NextResponse.json({ error: "Cita no encontrada" }, { status: 404 });

  const cfg = await prisma.clinicConfig.findMany();
  const config = Object.fromEntries(cfg.map((r) => [r.key, r.value]));

  let token = appt.confirmationToken;
  if (!token) {
    token = randomUUID();
    await prisma.appointment.update({ where: { id: appointmentId }, data: { confirmationToken: token } });
  }

  const patientName = `${appt.patient.firstName} ${appt.patient.lastName}`;
  const baseUrl = config.base_url ?? "http://localhost:3000";

  if (channel === "email") {
    if (!appt.patient.email) return NextResponse.json({ error: "El paciente no tiene email registrado" }, { status: 400 });
    const html = buildReminderHtml(config, {
      patientName, date: appt.date, startTime: appt.startTime, type: appt.type, confirmToken: token, baseUrl,
    });
    const result = await sendEmail(appt.patient.email, `Recordatorio de cita - ${config.clinic_name ?? "Clínica Magna"}`, html);
    return NextResponse.json(result);
  }

  if (channel === "whatsapp") {
    if (!appt.patient.phone) return NextResponse.json({ error: "El paciente no tiene teléfono registrado" }, { status: 400 });
    const confirmUrl = `${baseUrl}/confirmar/${token}`;
    const message = `Hola ${appt.patient.firstName}! 👋 Le recordamos su cita en ${config.clinic_name ?? "Clínica Magna"} el *${appt.date}* a las *${appt.startTime}* para *${appt.type}*.

📍 ${config.clinic_address ?? ""}
📞 ${config.clinic_phone ?? ""}

Por favor confirme su asistencia en este link:
${confirmUrl}

¡Le esperamos! 😊`;
    const url = buildWhatsappUrl(appt.patient.phone, message);
    return NextResponse.json({ ok: true, url });
  }

  return NextResponse.json({ error: "Canal inválido" }, { status: 400 });
}
