import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

function substitute(text: string, vars: Record<string, string>) {
  return Object.entries(vars).reduce(
    (t, [k, v]) => t.replace(new RegExp(`\\{${k}\\}`, "gi"), v),
    text
  );
}

function buildHtml(cfg: Record<string, string>, body: string) {
  const lines = body
    .split("\n")
    .map(l => l.trim() ? `<p style="margin:6px 0;color:#374151;font-size:14px;line-height:1.6">${l}</p>` : "<br/>")
    .join("");
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/></head>
<body style="margin:0;padding:20px;background:#f8fafc;font-family:Arial,sans-serif">
<div style="max-width:560px;margin:0 auto;background:white;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08)">
  <div style="background:#3a5a40;padding:24px 32px">
    <h1 style="color:white;margin:0;font-size:20px">${cfg.clinic_name ?? "Clínica Magna"}</h1>
    <p style="color:#a3c4a8;margin:4px 0 0;font-size:12px">${cfg.clinic_address ?? ""}</p>
  </div>
  <div style="padding:28px 32px">${lines}</div>
  <div style="background:#f1f5f9;padding:14px 32px;text-align:center;color:#64748b;font-size:11px;border-top:1px solid #e2e8f0">
    ${cfg.clinic_name ?? "Clínica Magna"} · ${cfg.clinic_phone ?? ""} · ${cfg.clinic_email ?? ""}
  </div>
</div></body></html>`;
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];
  const month = today.getMonth() + 1;
  const day   = today.getDate();

  const [cfgRows, birthdayTpl, reminderTpl] = await Promise.all([
    prisma.clinicConfig.findMany(),
    prisma.emailTemplate.findUnique({ where: { type: "birthday" } }),
    prisma.emailTemplate.findUnique({ where: { type: "reminder" } }),
  ]);

  const cfg = Object.fromEntries(cfgRows.map(r => [r.key, r.value]));

  const results = { birthday: { sent: 0, failed: 0 }, reminder: { sent: 0, failed: 0 } };

  /* ── BIRTHDAY ── */
  if (birthdayTpl?.active) {
    const allPatients = await prisma.patient.findMany({
      where: { active: true, email: { not: null }, birthDate: { not: null } },
      select: { id: true, firstName: true, lastName: true, email: true, birthDate: true },
    });

    const targets = allPatients.filter(p => {
      if (!p.birthDate || !p.email) return false;
      const bd = new Date(p.birthDate);
      return bd.getMonth() + 1 === month && bd.getDate() === day;
    });

    for (const p of targets) {
      const vars = { nombre: `${p.firstName} ${p.lastName}`, fecha: todayStr };
      const subject = substitute(birthdayTpl.subject, vars);
      const body    = substitute(birthdayTpl.body, vars);
      const res = await sendEmail(p.email!, subject, buildHtml(cfg, body));
      const status = res.ok ? "sent" : "failed";
      if (res.ok) results.birthday.sent++; else results.birthday.failed++;
      await prisma.emailLog.create({
        data: { type: "birthday", toEmail: p.email!, patientName: `${p.firstName} ${p.lastName}`, subject, status },
      });
    }
  }

  /* ── REMINDERS ── */
  if (reminderTpl?.active) {
    const due = await prisma.reminder.findMany({
      where: { sendDate: todayStr, sent: false, cancelled: false },
      include: { patient: { select: { firstName: true, lastName: true, email: true } } },
    });

    for (const r of due) {
      const p = r.patient;
      if (!p.email) continue;
      const vars = {
        nombre: `${p.firstName} ${p.lastName}`,
        meses: String(r.months),
        fecha: todayStr,
      };
      const subject = substitute(reminderTpl.subject, vars);
      const body    = substitute(reminderTpl.body, vars);
      const res = await sendEmail(p.email, subject, buildHtml(cfg, body));
      const status = res.ok ? "sent" : "failed";
      if (res.ok) results.reminder.sent++; else results.reminder.failed++;
      await Promise.all([
        prisma.reminder.update({ where: { id: r.id }, data: { sent: true, sentAt: new Date() } }),
        prisma.emailLog.create({
          data: { type: "reminder", toEmail: p.email, patientName: `${p.firstName} ${p.lastName}`, subject, status, refId: r.id },
        }),
      ]);
    }
  }

  return NextResponse.json({ ok: true, date: todayStr, results });
}
