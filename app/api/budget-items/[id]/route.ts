import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const { status, sessions, directCost, completedByUserId } = await req.json();

  const current = await prisma.budgetItem.findUnique({
    where: { id: params.id },
    include: { budget: true },
  });
  if (!current) return NextResponse.json({ error: "Prestación no encontrada" }, { status: 404 });

  const wasCompleted = current.status === "completed";
  const nowCompleted = status === "completed";
  const patientId = current.budget.patientId;

  // When finalizing: check balance + compute auto-assignment amount
  let autoAmount = 0;
  if (!wasCompleted && nowCompleted) {
    const [realAgg, autoAgg, completedAgg] = await Promise.all([
      prisma.payment.aggregate({ where: { patientId, isAutoAssignment: false }, _sum: { amount: true } }),
      prisma.payment.aggregate({ where: { patientId, isAutoAssignment: true }, _sum: { amount: true } }),
      prisma.budgetItem.aggregate({ where: { budget: { patientId }, status: "completed" }, _sum: { total: true } }),
    ]);
    const paidTotal = realAgg._sum.amount ?? 0;
    const alreadyAutoAssigned = autoAgg._sum.amount ?? 0;
    const completedTotal = completedAgg._sum.total ?? 0;

    // Block if patient would go into debt
    const wouldDebt = (completedTotal + current.total) - paidTotal;
    if (wouldDebt > 0) {
      return NextResponse.json(
        { error: `Saldo insuficiente. El paciente quedaría con una deuda de $${Math.round(wouldDebt).toLocaleString("es-CL")}` },
        { status: 400 }
      );
    }

    const availableCredit = paidTotal - alreadyAutoAssigned;
    autoAmount = Math.min(Math.max(availableCredit, 0), current.total);
  }

  const item = await prisma.budgetItem.update({
    where: { id: params.id },
    data: {
      status,
      sessions: sessions ?? undefined,
      directCost: directCost ?? undefined,
      completedByUserId: nowCompleted ? (completedByUserId ?? null) : null,
      completedAt: nowCompleted ? new Date().toISOString().slice(0, 10) : null,
    },
  });

  // Create auto-assignment payment when completing
  if (!wasCompleted && nowCompleted && autoAmount > 0) {
    await prisma.payment.create({
      data: {
        patientId,
        budgetId: current.budgetId,
        budgetItemId: current.id,
        userId: completedByUserId ?? null,
        date: new Date().toISOString().slice(0, 10),
        amount: autoAmount,
        method: "saldo_a_favor",
        notes: `Completado: ${current.description}`,
        isAutoAssignment: true,
        status: "completed",
        tuuCommission: 0,
        netAmount: autoAmount,
      },
    });
  }

  // Remove auto-assignment when reverting
  if (wasCompleted && !nowCompleted) {
    await prisma.payment.deleteMany({
      where: { budgetItemId: current.id, isAutoAssignment: true },
    });
  }

  return NextResponse.json(item);
}
