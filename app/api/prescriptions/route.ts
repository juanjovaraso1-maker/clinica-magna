import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const patientId = req.nextUrl.searchParams.get("patientId")!;
  const records = await prisma.prescriptionRecord.findMany({
    where: { patientId },
    include: { user: true },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(records);
}

export async function POST(req: NextRequest) {
  const { patientId, userId, date, type, content } = await req.json();
  const record = await prisma.prescriptionRecord.create({
    data: { patientId, userId, date: date ?? new Date().toISOString().split("T")[0], type: type ?? "recipe", content },
    include: { user: true },
  });
  return NextResponse.json(record, { status: 201 });
}
