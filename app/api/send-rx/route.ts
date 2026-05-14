import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendEmail, buildRxEmailHtml } from "@/lib/email";

export async function POST(req: NextRequest) {
  const { patientName, patientRut, patientEmail, professionalName, medications, notes } = await req.json();

  if (!patientEmail) return NextResponse.json({ error: "El paciente no tiene email registrado" }, { status: 400 });
  if (!medications?.length) return NextResponse.json({ error: "No hay medicamentos en la receta" }, { status: 400 });

  const cfgRows = await prisma.clinicConfig.findMany();
  const cfg = Object.fromEntries(cfgRows.map(r => [r.key, r.value]));

  const date = new Date().toLocaleDateString("es-CL", { day: "numeric", month: "long", year: "numeric" });
  const html = buildRxEmailHtml(cfg, { patientName, patientRut, professionalName, medications, notes: notes ?? "", date });

  const result = await sendEmail(patientEmail, `Receta Médica - ${cfg.clinic_name ?? "Clínica Magna"}`, html);
  return NextResponse.json(result);
}
