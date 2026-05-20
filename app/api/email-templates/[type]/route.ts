import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const DEFAULTS: Record<string, { subject: string; body: string }> = {
  birthday: {
    subject: "¡Feliz Cumpleaños {nombre}! 🎂",
    body: "Estimado/a {nombre},\n\nEn este día especial, todo el equipo de Clínica Magna te desea un muy feliz cumpleaños. 🎉\n\nEsperamos que este nuevo año esté lleno de salud, felicidad y muchas sonrisas. 😊\n\n¿Tienes algún control o tratamiento pendiente? No dudes en contactarnos.\n\nSaludos cordiales,\nClínica Magna",
  },
  reminder: {
    subject: "Recordatorio de control - {meses} meses",
    body: "Estimado/a {nombre},\n\nTe recordamos que ya han pasado {meses} meses desde tu última atención en Clínica Magna.\n\nEs el momento indicado para tu control de rutina. Contáctanos para agendar tu cita.\n\nSaludos cordiales,\nClínica Magna",
  },
};

export async function GET(_: Request, { params }: { params: { type: string } }) {
  const { type } = params;
  let tpl = await prisma.emailTemplate.findUnique({ where: { type } });
  if (!tpl) {
    const def = DEFAULTS[type];
    if (!def) return NextResponse.json({ error: "Tipo inválido." }, { status: 404 });
    tpl = await prisma.emailTemplate.create({
      data: { type, subject: def.subject, body: def.body, active: false },
    });
  }
  return NextResponse.json(tpl);
}

export async function PUT(req: Request, { params }: { params: { type: string } }) {
  const { type } = params;
  const { subject, body, active } = await req.json();
  const tpl = await prisma.emailTemplate.upsert({
    where: { type },
    update: { subject, body, active: active ?? false },
    create: { type, subject: subject ?? "", body: body ?? "", active: active ?? false },
  });
  return NextResponse.json(tpl);
}
