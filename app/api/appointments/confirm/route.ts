import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");

  const appt = await prisma.appointment.findUnique({
    where: { confirmationToken: token ?? undefined },
    include: { patient: true, user: true },
  });

  if (!appt) return NextResponse.json({ error: "Token inválido" }, { status: 404 });

  if (appt.status === "confirmed") return NextResponse.json({ status: "confirmed", appointment: appt });
  if (appt.status === "cancelled") return NextResponse.json({ status: "cancelled", appointment: appt });
  if (appt.status === "completed") return NextResponse.json({ status: "already", appointment: appt });

  return NextResponse.json({ status: "pending", appointment: appt });
}

export async function POST(req: NextRequest) {
  const { token, action, reason } = await req.json();

  const appt = await prisma.appointment.findUnique({
    where: { confirmationToken: token ?? undefined },
    include: { patient: true, user: true },
  });

  if (!appt) return NextResponse.json({ error: "Token inválido" }, { status: 404 });

  if (appt.status === "completed" || appt.status === "confirmed" || appt.status === "cancelled") {
    return NextResponse.json({ status: "already", appointment: appt });
  }

  if (action === "confirm") {
    const updated = await prisma.appointment.update({
      where: { id: appt.id },
      data: { status: "confirmed", confirmedAt: new Date() },
      include: { patient: true, user: true },
    });
    return NextResponse.json({ status: "confirmed", appointment: updated });
  }

  if (action === "cancel") {
    const updated = await prisma.appointment.update({
      where: { id: appt.id },
      data: {
        status: "cancelled",
        notes: reason ? `Cancelado por paciente: ${reason}` : "Cancelado por paciente vía portal",
      },
      include: { patient: true, user: true },
    });
    return NextResponse.json({ status: "cancelled", appointment: updated });
  }

  return NextResponse.json({ error: "Acción inválida" }, { status: 400 });
}
