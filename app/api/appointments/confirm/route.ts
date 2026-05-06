import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  const action = req.nextUrl.searchParams.get("action") ?? "view";

  const appt = await prisma.appointment.findUnique({
    where: { confirmationToken: token ?? undefined },
    include: { patient: true, user: true },
  });

  if (!appt) return NextResponse.json({ error: "Token inválido" }, { status: 404 });

  if (action === "confirm" || action === "reject") {
    if (appt.status === "completed" || appt.status === "cancelled") {
      return NextResponse.json({ status: "already", appointment: appt });
    }
    const newStatus = action === "confirm" ? "confirmed" : "cancelled";
    await prisma.appointment.update({
      where: { id: appt.id },
      data: { status: newStatus, confirmedAt: new Date() },
    });
    return NextResponse.json({ status: action === "confirm" ? "confirmed" : "rejected", appointment: appt });
  }

  return NextResponse.json({ status: "loading", appointment: appt });
}
