import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendEmail, buildReminderHtml, buildWhatsappUrl } from "@/lib/email";
import { randomUUID } from "crypto";

export async function GET(req: NextRequest) {
  const date = req.nextUrl.searchParams.get("date");
  const weekStart = req.nextUrl.searchParams.get("weekStart");
  const weekEnd = req.nextUrl.searchParams.get("weekEnd");
  let where = {};
  if (weekStart && weekEnd) {
    where = { date: { gte: weekStart, lte: weekEnd } };
  } else if (date) {
    where = { date };
  }
  const appointments = await prisma.appointment.findMany({
    where,
    include: { patient: true, user: true },
    orderBy: [{ date: "asc" }, { startTime: "asc" }],
  });
  return NextResponse.json(appointments);
}

export async function POST(req: NextRequest) {
  const data = await req.json();
  const token = randomUUID();
  const appointment = await prisma.appointment.create({
    data: { ...data, confirmationToken: token },
    include: { patient: true, user: true },
  });

  // Auto-send confirmation (fire and forget — don't block response)
  try {
    const cfgRows = await prisma.clinicConfig.findMany();
    const cfg = Object.fromEntries(cfgRows.map(r => [r.key, r.value]));
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? cfg.base_url ?? "https://clinica-magna.vercel.app";
    const patientName = `${appointment.patient.firstName} ${appointment.patient.lastName}`;

    if (appointment.patient.email) {
      const html = buildReminderHtml(cfg, {
        patientName, date: appointment.date, startTime: appointment.startTime,
        type: appointment.type, confirmToken: token, baseUrl,
      });
      sendEmail(appointment.patient.email, `Confirmación de cita - ${cfg.clinic_name ?? "Clínica Magna"}`, html);
    }
  } catch (_) {}

  return NextResponse.json(appointment, { status: 201 });
}
