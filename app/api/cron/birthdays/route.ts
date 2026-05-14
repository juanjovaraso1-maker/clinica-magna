import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendEmail, buildBirthdayHtml } from "@/lib/email";

export const dynamic = "force-dynamic";

export async function GET() {
  const today = new Date();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day   = String(today.getDate()).padStart(2, "0");

  const [patients, cfgRows] = await Promise.all([
    prisma.patient.findMany({
      where: { active: true, email: { not: null }, birthDate: { not: null } },
      select: { id:true, firstName:true, lastName:true, email:true, birthDate:true },
    }),
    prisma.clinicConfig.findMany(),
  ]);

  const cfg = Object.fromEntries(cfgRows.map(r => [r.key, r.value]));

  const birthdays = patients.filter(p => {
    if (!p.birthDate || !p.email) return false;
    const bd = new Date(p.birthDate);
    return String(bd.getMonth()+1).padStart(2,"0") === month && String(bd.getDate()).padStart(2,"0") === day;
  });

  const results = await Promise.allSettled(
    birthdays.map(p =>
      sendEmail(
        p.email!,
        `¡Feliz Cumpleaños ${p.firstName}! 🎂 - ${cfg.clinic_name ?? "Clínica Magna"}`,
        buildBirthdayHtml(cfg, `${p.firstName} ${p.lastName}`)
      )
    )
  );

  const sent    = results.filter(r => r.status === "fulfilled" && (r.value as any).ok).length;
  const failed  = results.length - sent;

  return NextResponse.json({ ok: true, checked: patients.length, birthdays: birthdays.length, sent, failed });
}
