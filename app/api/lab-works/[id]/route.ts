import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const data = await req.json();
  const work = await prisma.labWork.update({ where: { id: params.id }, data });

  // Si se marca como recibido, actualizar la deuda asociada (no la paga, solo la nota)
  if (data.status === "recibido" && work.debtId) {
    await prisma.debt.update({
      where: { id: work.debtId },
      data: { notes: `Trabajo recibido el ${data.receivedDate ?? new Date().toISOString().split("T")[0]}` },
    });
  }

  return NextResponse.json(work);
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const work = await prisma.labWork.findUnique({ where: { id: params.id } });
  if (work?.debtId) {
    await prisma.debt.delete({ where: { id: work.debtId } }).catch(() => {});
  }
  await prisma.labWork.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
