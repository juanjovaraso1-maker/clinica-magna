import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const patientId = req.nextUrl.searchParams.get("patientId")!;
  const record = await prisma.odontogramRecord.findUnique({ where: { patientId } });
  return NextResponse.json(record ? JSON.parse(record.data) : {});
}

export async function POST(req: NextRequest) {
  const { patientId, data } = await req.json();
  const record = await prisma.odontogramRecord.upsert({
    where: { patientId },
    update: { data: JSON.stringify(data) },
    create: { patientId, data: JSON.stringify(data) },
  });
  return NextResponse.json(record);
}
