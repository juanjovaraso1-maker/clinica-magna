import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendEmail, buildBudgetHtml } from "@/lib/email";

export async function POST(req: NextRequest) {
  const { budgetId } = await req.json();

  const [budget, cfgRows] = await Promise.all([
    prisma.budget.findUnique({
      where: { id: budgetId },
      include: {
        patient: true,
        user: true,
        items: true,
      },
    }),
    prisma.clinicConfig.findMany(),
  ]);

  if (!budget) return NextResponse.json({ error: "Presupuesto no encontrado" }, { status: 404 });
  if (!budget.patient.email) return NextResponse.json({ error: "El paciente no tiene email registrado" }, { status: 400 });

  const cfg = Object.fromEntries(cfgRows.map(r => [r.key, r.value]));

  const html = buildBudgetHtml(cfg, {
    patientName:     `${budget.patient.firstName} ${budget.patient.lastName}`,
    patientRut:      budget.patient.rut,
    budgetNumber:    budget.number,
    date:            budget.date,
    validUntil:      budget.validUntil ?? budget.date,
    professionalName: budget.user.name,
    notes:           budget.notes ?? "",
    items:           budget.items.map(i => ({ description:i.description, tooth:i.tooth??"", area:i.area??"", quantity:i.quantity, unitPrice:i.unitPrice, discount:i.discount, total:i.total })),
    subtotal:        budget.subtotal,
    discount:        budget.discount,
    total:           budget.total,
  });

  const result = await sendEmail(
    budget.patient.email,
    `Presupuesto Dental N° ${String(budget.number).padStart(4,"0")} - ${cfg.clinic_name ?? "Clínica Magna"}`,
    html
  );

  return NextResponse.json(result);
}
