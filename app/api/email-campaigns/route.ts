import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";

function buildHtml(cfg: Record<string,string>, subject: string, body: string, patientName: string) {
  const lines = body
    .replace(/\{nombre\}/gi, patientName)
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

export async function GET() {
  const campaigns = await prisma.emailCampaign.findMany({
    orderBy: { sentAt: "desc" },
    take: 50,
  });
  return NextResponse.json(campaigns);
}

export async function POST(req: Request) {
  const { subject, body, recipientFilter } = await req.json();
  if (!subject || !body) {
    return NextResponse.json({ error: "Asunto y mensaje son requeridos." }, { status: 400 });
  }

  const [patients, cfgRows] = await Promise.all([
    prisma.patient.findMany({
      where: {
        active: true,
        email: { not: null },
        ...(recipientFilter && recipientFilter !== "all"
          ? { healthInsurance: recipientFilter }
          : {}),
      },
      select: { id: true, firstName: true, lastName: true, email: true },
    }),
    prisma.clinicConfig.findMany(),
  ]);

  const cfg = Object.fromEntries(cfgRows.map(r => [r.key, r.value]));
  const targets = patients.filter(p => p.email);

  const results = await Promise.allSettled(
    targets.map(p =>
      sendEmail(
        p.email!,
        subject,
        buildHtml(cfg, subject, body, `${p.firstName} ${p.lastName}`)
      )
    )
  );

  const sent = results.filter(r => r.status === "fulfilled").length;

  const campaign = await prisma.emailCampaign.create({
    data: { subject, body, recipientFilter: recipientFilter || "all", sentCount: sent },
  });

  return NextResponse.json({ ok: true, sent, total: targets.length, campaign });
}
