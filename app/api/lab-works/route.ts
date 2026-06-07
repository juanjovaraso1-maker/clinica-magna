import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const status = req.nextUrl.searchParams.get("status");
  const labName = req.nextUrl.searchParams.get("labName");
  const works = await prisma.labWork.findMany({
    where: {
      ...(status ? { status } : {}),
      ...(labName ? { labName } : {}),
    },
    orderBy: { sentDate: "desc" },
  });
  return NextResponse.json(works);
}

export async function POST(req: NextRequest) {
  const data = await req.json();
  const { autoDebt, ...labData } = data;

  const work = await prisma.labWork.create({ data: labData });

  // Auto-crear deuda para el laboratorio si se solicita
  if (autoDebt !== false && labData.cost > 0) {
    const debt = await prisma.debt.create({
      data: {
        creditor: labData.labName,
        description: `Lab: ${labData.treatmentName} — ${labData.patientName}`,
        totalAmount: labData.cost,
        paidAmount: 0,
        startDate: labData.sentDate,
        notes: `Trabajo de laboratorio registrado automáticamente. ${labData.description ?? ""}`.trim(),
      },
    });
    await prisma.labWork.update({ where: { id: work.id }, data: { debtId: debt.id } });
  }

  return NextResponse.json(work, { status: 201 });
}
