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
  try {
    const { patientId, userId, date, type, content } = await req.json();
    if (!patientId || !userId) return NextResponse.json({ error: "patientId and userId are required" }, { status: 400 });
    const record = await prisma.prescriptionRecord.create({
      data: {
        patientId,
        userId,
        date: date ?? new Date().toISOString().split("T")[0],
        type: type ?? "recipe",
        content,
      },
      include: { user: true },
    });
    return NextResponse.json(record, { status: 201 });
  } catch (e: any) {
    console.error("POST /api/prescriptions error:", e);
    return NextResponse.json({ error: e?.message ?? "Internal error" }, { status: 500 });
  }
}
