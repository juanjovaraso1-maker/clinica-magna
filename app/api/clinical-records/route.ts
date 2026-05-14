import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const { patientId, bloodType, allergies, currentMedications, medicalBackground, dentalBackground, habits, observations } = await req.json();
  const record = await prisma.clinicalRecord.upsert({
    where: { patientId },
    update: { bloodType, allergies, currentMedications, medicalBackground, dentalBackground, habits, observations },
    create: { patientId, bloodType, allergies, currentMedications, medicalBackground, dentalBackground, habits, observations },
  });
  return NextResponse.json(record);
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const patientId = searchParams.get("patientId");
  if (!patientId) return NextResponse.json({ error: "patientId required" }, { status: 400 });
  await prisma.clinicalRecord.deleteMany({ where: { patientId } });
  return NextResponse.json({ ok: true });
}
