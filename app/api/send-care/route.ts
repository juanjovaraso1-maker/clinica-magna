import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendEmail, buildCareEmailHtml } from "@/lib/email";

export async function POST(req: NextRequest) {
  const { patientName, patientEmail, professionalName, templateName, text } = await req.json();

  if (!patientEmail) return NextResponse.json({ error: "El paciente no tiene email registrado" }, { status: 400 });
  if (!text?.trim()) return NextResponse.json({ error: "No hay instrucciones para enviar" }, { status: 400 });

  const cfgRows = await prisma.clinicConfig.findMany();
  const cfg = Object.fromEntries(cfgRows.map(r => [r.key, r.value]));

  const date = new Date().toLocaleDateString("es-CL", { day: "numeric", month: "long", year: "numeric" });
  const html = buildCareEmailHtml(cfg, { patientName, professionalName, templateName: templateName ?? "Instrucciones", text, date });

  const result = await sendEmail(patientEmail, `Instrucciones de cuidados - ${cfg.clinic_name ?? "Clínica Magna"}`, html);
  return NextResponse.json(result);
}
