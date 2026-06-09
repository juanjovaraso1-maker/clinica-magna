import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const STATUS_LABELS: Record<string, string> = {
  pending:     "Pendiente",
  in_progress: "En progreso",
  completed:   "Finalizado",
};

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const { status, sessions, directCost, completedByUserId } = await req.json();

  const current = await prisma.budgetItem.findUnique({
    where: { id: params.id },
    include: {
      budget: {
        include: { user: { select: { name: true, title: true } } },
      },
    },
  });
  if (!current) return NextResponse.json({ error: "Prestación no encontrada" }, { status: 404 });

  const wasCompleted = current.status === "completed";
  const nowCompleted = status === "completed";
  const patientId    = current.budget.patientId;

  // Compute auto-assignment amount when finalizing
  let autoAmount = 0;
  let insufficientBalance = false;
  if (!wasCompleted && nowCompleted) {
    const [realAgg, autoAgg] = await Promise.all([
      prisma.payment.aggregate({ where: { patientId, isAutoAssignment: false }, _sum: { amount: true } }),
      prisma.payment.aggregate({ where: { patientId, isAutoAssignment: true }, _sum: { amount: true } }),
    ]);
    const paidTotal          = realAgg._sum.amount ?? 0;
    const alreadyAutoAssigned = autoAgg._sum.amount ?? 0;
    const availableCredit    = Math.max(0, paidTotal - alreadyAutoAssigned);
    autoAmount = Math.min(availableCredit, current.total);
    insufficientBalance = availableCredit < current.total;
  }

  // Update the item
  const item = await prisma.budgetItem.update({
    where: { id: params.id },
    data: {
      status,
      sessions:          sessions   ?? undefined,
      directCost:        directCost ?? undefined,
      completedByUserId: nowCompleted ? (completedByUserId ?? null) : null,
      completedAt:       nowCompleted ? new Date().toISOString().slice(0, 10) : null,
    },
  });

  // Create auto-assignment payment when finalizing (even partial)
  if (!wasCompleted && nowCompleted && autoAmount > 0) {
    await prisma.payment.create({
      data: {
        patientId,
        budgetId:        current.budgetId,
        budgetItemId:    current.id,
        userId:          completedByUserId ?? null,
        date:            new Date().toISOString().slice(0, 10),
        amount:          autoAmount,
        method:          "saldo_a_favor",
        notes:           `Completado: ${current.description}`,
        isAutoAssignment: true,
        status:          "completed",
        tuuCommission:   0,
        netAmount:       autoAmount,
      },
    });
  }

  // Remove auto-assignment when reverting
  if (wasCompleted && !nowCompleted) {
    await prisma.payment.deleteMany({
      where: { budgetItemId: current.id, isAutoAssignment: true },
    });
  }

  // Auto-evolution: record every status change in patient history
  try {
    const changedBy = completedByUserId
      ? await prisma.user.findUnique({
          where: { id: completedByUserId },
          select: { name: true, title: true },
        })
      : null;

    const profName    = changedBy ? `${changedBy.title ?? ""} ${changedBy.name}`.trim() : "Sistema";
    const creatorName = current.budget.user?.name ?? "Desconocido";
    const prevLabel   = STATUS_LABELS[current.status] ?? current.status;
    const newLabel    = STATUS_LABELS[status]          ?? status;

    await prisma.evolution.create({
      data: {
        patientId,
        userId:       completedByUserId ?? current.budget.userId,
        date:         new Date().toISOString().slice(0, 10),
        treatment:    `Presup. #${current.budget.number}: ${current.description} — ${prevLabel} → ${newLabel}`,
        observations: `En el presupuesto #${current.budget.number} (creado por ${creatorName}) se modificó el estado de "${prevLabel}" a "${newLabel}" en el tratamiento "${current.description}" por ${profName}.`,
        isSystem:     true,
      },
    });
  } catch {
    // Don't fail the whole request if evolution creation fails
  }

  return NextResponse.json({ ...item, insufficientBalance });
}
