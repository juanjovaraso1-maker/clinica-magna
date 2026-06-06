import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const month = req.nextUrl.searchParams.get("month");
  const patientId = req.nextUrl.searchParams.get("patientId");
  const where: any = {};
  if (month) where.date = { startsWith: month };
  if (patientId) where.patientId = patientId;
  const payments = await prisma.payment.findMany({
    where,
    include: { patient: true, budget: true },
    orderBy: { date: "desc" },
  });
  return NextResponse.json(payments);
}

function calcTuu(amount: number): number {
  return Math.round(((amount * 0.0079) + 65) * 1.19);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { installments: numInstallments, ...rest } = body;

  const method = (rest.method ?? "").toLowerCase();
  const isCard = ["debito", "credito", "tarjeta"].includes(method);
  const isTuuInstallment = rest.isTuuInstallment ?? false;

  if (isCard && !isTuuInstallment) {
    const comm = calcTuu(rest.amount);
    rest.tuuCommission = comm;
    rest.netAmount = rest.amount - comm;
  } else {
    rest.tuuCommission = 0;
    rest.netAmount = rest.amount;
  }

  // Pagos en cuotas: crear un registro por cuota
  if (numInstallments && numInstallments > 1) {
    const groupId = `grp-${Date.now()}`;
    const perCuota = Math.round(rest.amount / numInstallments);
    const commPerCuota = isCard && !isTuuInstallment ? calcTuu(perCuota) : 0;
    const today = rest.date ?? new Date().toISOString().slice(0, 10);
    const created = [];

    for (let i = 0; i < numInstallments; i++) {
      const d = new Date(today);
      d.setMonth(d.getMonth() + i);
      const dateStr = d.toISOString().slice(0, 10);
      const isOverdue = i > 0 && dateStr < today;
      const installmentStatus = i === 0 ? "PAID" : isOverdue ? "OVERDUE" : "PENDING";

      const p = await prisma.payment.create({
        data: {
          ...rest,
          date: dateStr,
          amount: perCuota,
          tuuCommission: commPerCuota,
          netAmount: perCuota - commPerCuota,
          installments: numInstallments,
          installmentNumber: i + 1,
          installmentGroupId: groupId,
          installmentStatus,
          status: i === 0 ? "completed" : "pending",
          isTuuInstallment,
        },
        include: { patient: true, budget: true },
      });
      created.push(p);
    }

    if (commPerCuota > 0) {
      const fp = created[0];
      await prisma.expense.create({
        data: {
          date: today,
          category: "Comisiones bancarias TUU",
          description: `Comisión TUU cuota 1/${numInstallments} — ${fp.patient?.firstName ?? ""} ${fp.patient?.lastName ?? ""}`,
          amount: commPerCuota,
          notes: `Pago ID: ${fp.id}`,
        },
      });
    }

    return NextResponse.json(created[0], { status: 201 });
  }

  // Pago simple
  const payment = await prisma.payment.create({
    data: { ...rest, isTuuInstallment },
    include: { patient: true, budget: true },
  });

  if (isCard && !isTuuInstallment && (rest.tuuCommission ?? 0) > 0) {
    await prisma.expense.create({
      data: {
        date: rest.date ?? new Date().toISOString().slice(0, 10),
        category: "Comisiones bancarias TUU",
        description: `Comisión TUU — ${payment.patient?.firstName ?? ""} ${payment.patient?.lastName ?? ""}`,
        amount: rest.tuuCommission,
        notes: `Pago ID: ${payment.id}`,
      },
    });
  }

  return NextResponse.json(payment, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json();
  await prisma.payment.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
