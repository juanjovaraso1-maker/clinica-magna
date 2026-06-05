import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const patientId = req.nextUrl.searchParams.get("patientId")!;
  const records = await prisma.odontogramRecord.findMany({
    where: { patientId },
    orderBy: { date: "desc" },
  });
  return NextResponse.json(records.map(r => ({ ...r, data: JSON.parse(r.data) })));
}

export async function POST(req: NextRequest) {
  const { patientId, date, type, data } = await req.json();
  const today = new Date().toISOString().split("T")[0];
  const record = await prisma.odontogramRecord.create({
    data: {
      patientId,
      date: date ?? today,
      type: type ?? "permanent",
      data: JSON.stringify(data ?? {}),
    },
  });
  return NextResponse.json({ ...record, data: JSON.parse(record.data) }, { status: 201 });
}
