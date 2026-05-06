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
