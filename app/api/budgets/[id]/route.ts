import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const STATUS_LABELS: Record<string, string> = {
  pending:     "Pendiente",
  in_progress: "En progreso",
  completed:   "Finalizado",
};

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const budgetId = params.id;
  const { items, patient, user, payments, ...data } = await req.json();

  // Identify the actor making this request
  let actorId: string | null = null;
  try {
    const session = await getServerSession(authOptions);
    actorId = (session?.user as any)?.id ?? null;
  } catch { /* ignore */ }

  if (items) {
    const incomingItems: any[] = items;

    // Load current state: items + budget creator + patient
    const [oldItems, currentBudget] = await Promise.all([
      prisma.budgetItem.findMany({
        where: { budgetId },
      }),
      prisma.budget.findUnique({
        where: { id: budgetId },
        include: {
          user:    { select: { id: true, name: true, title: true } },
          patient: { select: { id: true } },
        },
      }),
    ]);

    if (!currentBudget) {
      return NextResponse.json({ error: "Presupuesto no encontrado" }, { status: 404 });
    }

    const patientId      = currentBudget.patient.id;
    const resolvedActorId = actorId ?? currentBudget.userId;

    // Pre-load actor and creator names (used in every evolution)
    const [actor, creator] = await Promise.all([
      prisma.user.findUnique({ where: { id: resolvedActorId }, select: { name: true, title: true } }),
      currentBudget.userId !== resolvedActorId
        ? prisma.user.findUnique({ where: { id: currentBudget.userId }, select: { name: true, title: true } })
        : Promise.resolve(currentBudget.user),
    ]);
    const profName    = actor    ? `${actor.title    ?? ""} ${actor.name}`.trim()    : "Sistema";
    const creatorName = creator  ? `${creator.title  ?? ""} ${creator.name}`.trim()  : "Desconocido";

    const oldItemMap  = new Map(oldItems.map(i => [i.id, i]));
    const keepIds     = new Set(incomingItems.filter(i => i.id).map((i: any) => i.id as string));
    const today       = new Date().toISOString().slice(0, 10);

    // Wrap all mutations in a transaction — if anything fails, nothing is committed
    await prisma.$transaction(async (tx) => {
      // ── 1. Delete items that were removed from the list ────────────────
      for (const old of oldItems) {
        if (keepIds.has(old.id)) continue;

        if (old.status === "completed") {
          await tx.payment.updateMany({ where: { budgetItemId: old.id, isAutoAssignment: true }, data: { deletedAt: new Date() } });
          await tx.evolution.create({
            data: {
              patientId, userId: resolvedActorId, date: today, isSystem: true,
              treatment:    `Presup. #${currentBudget.number}: ${old.description} — Finalizado → eliminado`,
              observations: `En el presupuesto #${currentBudget.number} (creado por ${creatorName}) se eliminó "${old.description}" que estaba Finalizado — por ${profName}.`,
            },
          });
        }
        await tx.budgetItem.delete({ where: { id: old.id } });
      }

      // ── 2. Upsert each incoming item ──────────────────────────────────
      for (const inc of incomingItems) {
        const old = inc.id ? oldItemMap.get(inc.id) : null;

        if (old) {
          const wasCompleted  = old.status === "completed";
          const nowCompleted  = inc.status === "completed";
          const statusChanged = old.status !== inc.status;

          const newCompletedBy = wasCompleted && nowCompleted ? old.completedByUserId : (nowCompleted ? resolvedActorId : null);
          const newCompletedAt = wasCompleted && nowCompleted ? old.completedAt        : (nowCompleted ? today          : null);

          await tx.budgetItem.update({
            where: { id: old.id },
            data: {
              description: inc.description, tooth: inc.tooth || null, area: inc.area || null,
              quantity: inc.quantity, unitPrice: inc.unitPrice, discount: inc.discount,
              discountAmt: inc.discountAmt ?? 0, total: inc.total,
              status: inc.status || "pending", directCost: inc.directCost ?? 0,
              completedByUserId: newCompletedBy, completedAt: newCompletedAt,
            },
          });

          if (!wasCompleted && nowCompleted) {
            const [realAgg, autoAgg] = await Promise.all([
              tx.payment.aggregate({ where: { patientId, isAutoAssignment: false, deletedAt: null }, _sum: { amount: true } }),
              tx.payment.aggregate({ where: { patientId, isAutoAssignment: true,  deletedAt: null }, _sum: { amount: true } }),
            ]);
            const available  = Math.max(0, (realAgg._sum.amount ?? 0) - (autoAgg._sum.amount ?? 0));
            const autoAmount = Math.min(available, inc.total);
            if (autoAmount > 0) {
              await tx.payment.create({
                data: {
                  patientId, budgetId, budgetItemId: old.id, userId: resolvedActorId,
                  date: today, amount: autoAmount, method: "saldo_a_favor",
                  notes: `Completado: ${inc.description}`, isAutoAssignment: true,
                  status: "completed", tuuCommission: 0, netAmount: autoAmount,
                },
              });
            }
          } else if (wasCompleted && !nowCompleted) {
            await tx.payment.updateMany({ where: { budgetItemId: old.id, isAutoAssignment: true }, data: { deletedAt: new Date() } });
          }

          if (statusChanged) {
            const prevLabel = STATUS_LABELS[old.status] ?? old.status;
            const newLabel  = STATUS_LABELS[inc.status]  ?? inc.status;
            await tx.evolution.create({
              data: {
                patientId, userId: resolvedActorId, date: today, isSystem: true,
                treatment:    `Presup. #${currentBudget.number}: ${inc.description} — ${prevLabel} → ${newLabel}`,
                observations: `En el presupuesto #${currentBudget.number} (creado por ${creatorName}) se modificó "${prevLabel}" → "${newLabel}" en "${inc.description}" por ${profName}.`,
              },
            });
          }
        } else {
          await tx.budgetItem.create({
            data: {
              budgetId, description: inc.description, tooth: inc.tooth || null,
              area: inc.area || null, quantity: inc.quantity, unitPrice: inc.unitPrice,
              discount: inc.discount, discountAmt: inc.discountAmt ?? 0,
              total: inc.total, status: inc.status || "pending", directCost: inc.directCost ?? 0,
            },
          });
        }
      }
    }, { timeout: 30000 });
  }

  const budget = await prisma.budget.update({
    where:   { id: budgetId },
    data,
    include: { patient: true, user: true, items: true, payments: { where: { deletedAt: null } } },
  });
  return NextResponse.json(budget);
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  await prisma.budget.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
