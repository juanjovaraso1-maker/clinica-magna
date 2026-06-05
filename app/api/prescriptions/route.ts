import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
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
    const session = await getServerSession(authOptions);
    const { patientId, userId: bodyUserId, date, type, content } = await req.json();
    const userId = bodyUserId || (session?.user as any)?.id;
    if (!patientId || !userId) return NextResponse.json({ error: "patientId y userId son requeridos. Por favor recarga la página o vuelve a iniciar sesión." }, { status: 400 });
    const userExists = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!userExists) return NextResponse.json({ error: "El usuario de sesión no existe en la base de datos. Por favor cierra sesión y vuelve a ingresar." }, { status: 400 });
    const record = await prisma.prescriptionRecord.create({
      data: {
        patientId,
        userId,
        date: date ?? new Date().toISOString().split("T")[0],
        type: type ?? "recipe",
        content: content ?? "",
      },
      include: { user: true },
    });
    return NextResponse.json(record, { status: 201 });
  } catch (e: any) {
    console.error("POST /api/prescriptions error:", e);
    return NextResponse.json({ error: e?.message ?? "Internal error" }, { status: 500 });
  }
}
