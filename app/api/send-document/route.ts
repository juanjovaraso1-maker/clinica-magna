import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import nodemailer from "nodemailer";
import fs from "fs";
import path from "path";
import {
  buildRecetaHTML,
  buildPresupuestoHTML,
  buildIndicacionesHTML,
  type RecetaData,
  type PresupuestoData,
  type IndicacionesData,
} from "@/lib/pdf-templates";

function readLogoBase64(): string | undefined {
  try {
    const logoPath = path.join(process.cwd(), "public", "LOGO.jpeg");
    if (fs.existsSync(logoPath)) {
      return `data:image/jpeg;base64,${fs.readFileSync(logoPath).toString("base64")}`;
    }
  } catch { /* continue without logo */ }
  return undefined;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { type, data, to, subject, filename, patientName, bodyText } = body;

    if (!to || !subject) {
      return NextResponse.json({ ok: false, error: "Faltan campos requeridos." }, { status: 400 });
    }

    // Build HTML using the appropriate template
    const logoBase64 = readLogoBase64();
    let html: string;

    if (type === "receta") {
      html = buildRecetaHTML(data as RecetaData, logoBase64);
    } else if (type === "presupuesto") {
      html = buildPresupuestoHTML(data as PresupuestoData, logoBase64);
    } else if (type === "indicaciones") {
      html = buildIndicacionesHTML(data as IndicacionesData, logoBase64);
    } else if (body.html) {
      // Legacy fallback: raw HTML provided
      html = body.html;
      if (logoBase64) {
        html = html.replace(/src="[^"]*LOGO\.jpeg[^"]*"/gi, `src="${logoBase64}"`);
      }
    } else {
      return NextResponse.json({ ok: false, error: "Se requiere 'type' o 'html'." }, { status: 400 });
    }

    // Generate PDF with Puppeteer
    let pdfBuffer: Buffer;
    try {
      const puppeteer = await import("puppeteer");
      const browser = await puppeteer.default.launch({
        args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu"],
        headless: true,
      });
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: "domcontentloaded" });
      const pdf = await page.pdf({ format: "A4", printBackground: true });
      await browser.close();
      pdfBuffer = Buffer.from(pdf);
    } catch (e) {
      return NextResponse.json({ ok: false, error: `Error generando PDF: ${String(e)}` }, { status: 500 });
    }

    // Get SMTP config
    const rows = await prisma.clinicConfig.findMany();
    const cfg = Object.fromEntries(rows.map((r) => [r.key, r.value]));
    const host   = process.env.SMTP_HOST   || cfg.smtp_host;
    const port   = parseInt(process.env.SMTP_PORT   || cfg.smtp_port   || "465");
    const secure = (process.env.SMTP_SECURE || cfg.smtp_secure || "true") === "true";
    const user   = process.env.SMTP_USER   || cfg.smtp_user;
    const pass   = process.env.SMTP_PASS   || cfg.smtp_pass;
    const name   = cfg.clinic_name ?? "Clínica Magna";

    if (!host || !user || !pass) {
      return NextResponse.json({ ok: false, error: "Email no configurado. Configure SMTP en Ajustes." }, { status: 500 });
    }

    const safeFilename = (filename || "documento").replace(/[^a-z0-9_\-]/gi, "_");
    const emailText = bodyText || `Estimado/a ${patientName || "paciente"}, adjuntamos su documento. Saludos, ${name}.`;

    try {
      const transporter = nodemailer.createTransport({ host, port, secure, auth: { user, pass } });
      await transporter.sendMail({
        from: `"${name}" <${user}>`,
        to,
        subject,
        text: emailText,
        attachments: [
          {
            filename: `${safeFilename}.pdf`,
            content: pdfBuffer,
            contentType: "application/pdf",
          },
        ],
      });
      return NextResponse.json({ ok: true });
    } catch (e) {
      return NextResponse.json({ ok: false, error: `Error enviando email: ${String(e)}` }, { status: 500 });
    }
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
