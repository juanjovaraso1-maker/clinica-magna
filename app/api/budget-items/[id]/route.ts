import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const STATUS_LABELS: Record<string, string> = {
  pending:     "Pendiente",
  in_progress: "En progreso",
  completed:   "Finalizado",
};

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  // Get actor from server session first; fall back to client-provided value
  let actorId: string | null = null;
  try {
    const session = await getServerSession(authOptions);
    actorId = (session?.user as any)?.id ?? null;
  } catch {
    // getServerSession failed — will use client-provided userId
  }

  const body = await req.json();
  const { status, sessions, directCost } = body;
  const completedByUserId: string | null = body.completedByUserId ?? null;

  // Prefer server session; fall back to client-sent value
  const effectiveActorId: string | null = actorId ?? completedByUserId;

  const current = await prisma.budgetItem.findUnique({
    where: { id: params.id },
    include: {
      budget: {
        include: {
          user: { select: { id: true, name: true, title: true } },
        },
      },
    },
  });
  if (!current) return NextResponse.json({ error: "Prestación no encontrada" }, { status: 404 });

  const wasCompleted = current.status === "completed";
  const nowCompleted = status === "completed";
  const patientId    = current.budget.patientId;

  // Use budget creator as last-resort fallback so completedByUserId is never null
  const resolvedActorId: string = effectiveActorId ?? current.budget.userId;

  // Compute auto-assignment amount when finalizing
  let autoAmount = 0;
  let insufficientBalance = false;
  if (!wasCompleted && nowCompleted) {
    const [realAgg, autoAgg] = await Promise.all([
      prisma.payment.aggregate({ where: { patientId, isAutoAssignment: false }, _sum: { amount: true } }),
      prisma.payment.aggregate({ where: { patientId, isAutoAssignment: true }, _sum: { amount: true } }),
    ]);
    const paidTotal           = realAgg._sum.amount ?? 0;
    const alreadyAutoAssigned = autoAgg._sum.amount ?? 0;
    const availableCredit     = Math.max(0, paidTotal - alreadyAutoAssigned);
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
      completedByUserId: nowCompleted ? resolvedActorId : null,
      completedAt:       nowCompleted ? new Date().toISOString().slice(0, 10) : null,
    },
  });

  // Create auto-assignment payment when finalizing
  if (!wasCompleted && nowCompleted && autoAmount > 0) {
    await prisma.payment.create({
      data: {
        patientId,
        budgetId:         current.budgetId,
        budgetItemId:     current.id,
        userId:           resolvedActorId,
        date:             new Date().toISOString().slice(0, 10),
        amount:           autoAmount,
        method:           "saldo_a_favor",
        notes:            `Completado: ${current.description}`,
        isAutoAssignment: true,
        status:           "completed",
        tuuCommission:    0,
        netAmount:        autoAmount,
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
  const prevLabel = STATUS_LABELS[current.status] ?? current.status;
  const newLabel  = STATUS_LABELS[status]          ?? status;

  const changedBy = await prisma.user.findUnique({
    where:  { id: resolvedActorId },
    select: { name: true, title: true },
  });

  const profName = changedBy
    ? `${changedBy.title ?? ""} ${changedBy.name}`.trim()
    : "Sistema";

  const creatorName = current.budget.user
    ? `${current.budget.user.title ?? ""} ${current.budget.user.name}`.trim()
    : "Desconocido";

  await prisma.evolution.create({
    data: {
      patientId,
      userId:       resolvedActorId,
      date:         new Date().toISOString().slice(0, 10),
      treatment:    `Presup. #${current.budget.number}: ${current.description} — ${prevLabel} → ${newLabel}`,
      observations: `En el presupuesto #${current.budget.number} (creado por ${creatorName}) se modificó el estado de "${prevLabel}" a "${newLabel}" en el tratamiento "${current.description}" por ${profName}.`,
      isSystem:     true,
    },
  });

  return NextResponse.json({ ...item, insufficientBalance });
}
