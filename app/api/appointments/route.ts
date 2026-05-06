import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const date = req.nextUrl.searchParams.get("date");
  const where = date ? { date } : {};
  const appointments = await prisma.appointment.findMany({
    where,
    include: { patient: true, user: true },
    orderBy: [{ date: "asc" }, { startTime: "asc" }],
  });
  return NextResponse.json(appointments);
}

export async function POST(req: NextRequest) {
  const data = await req.json();
  const appointment = await prisma.appointment.create({
    data,
    include: { patient: true, user: true },
  });
  return NextResponse.json(appointment, { status: 201 });
}
