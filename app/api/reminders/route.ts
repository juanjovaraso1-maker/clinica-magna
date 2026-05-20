import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const reminders = await prisma.reminder.findMany({
    where: { cancelled: false },
    include: { patient: { select: { firstName: true, lastName: true, email: true } } },
    orderBy: { sendDate: "asc" },
  });
  return NextResponse.json(reminders);
}

export async function POST(req: Request) {
  const { patientId, months, evolutionId } = await req.json();
  if (!patientId || !months) {
    return NextResponse.json({ error: "Faltan datos." }, { status: 400 });
  }

  const sendDate = new Date();
  sendDate.setMonth(sendDate.getMonth() + parseInt(months));
  const sendDateStr = sendDate.toISOString().split("T")[0];

  const reminder = await prisma.reminder.create({
    data: { patientId, months: parseInt(months), sendDate: sendDateStr, evolutionId: evolutionId ?? null },
  });
  return NextResponse.json(reminder);
}
