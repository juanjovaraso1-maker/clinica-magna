import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const date      = searchParams.get("date");
  const startDate = searchParams.get("startDate");
  const endDate   = searchParams.get("endDate");

  const where: Record<string, unknown> = {};
  if (date) {
    where.date = date;
  } else if (startDate && endDate) {
    where.date = { gte: startDate, lte: endDate };
  }

  const slots = await prisma.blockedSlot.findMany({ where, orderBy: [{ date: "asc" }, { startTime: "asc" }] });
  return NextResponse.json(slots);
}

export async function POST(req: NextRequest) {
  const { date, startTime, endTime, reason } = await req.json();
  if (!date || !startTime || !endTime) {
    return NextResponse.json({ error: "Faltan campos requeridos" }, { status: 400 });
  }
  const slot = await prisma.blockedSlot.create({ data: { date, startTime, endTime, reason: reason || null } });
  return NextResponse.json(slot, { status: 201 });
}
