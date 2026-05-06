import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const search = req.nextUrl.searchParams.get("search") ?? "";
  const patients = await prisma.patient.findMany({
    where: search ? {
      OR: [
        { firstName: { contains: search, mode: "insensitive" } },
        { lastName: { contains: search, mode: "insensitive" } },
        { rut: { contains: search, mode: "insensitive" } },
        { phone: { contains: search, mode: "insensitive" } },
      ],
    } : {},
    orderBy: { lastName: "asc" },
    include: {
      _count: { select: { appointments: true, evolutions: true } },
      appointments: { orderBy: { date: "desc" }, take: 1 },
    },
  });
  return NextResponse.json(patients);
}

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    const { firstName, lastName, rut, email, phone, birthDate, gender, address, city, healthInsurance, insuranceNumber, notes } = data;
    if (!firstName || !lastName || !rut) return NextResponse.json({ error: "Nombre, apellido y RUT son obligatorios" }, { status: 400 });
    const patient = await prisma.patient.create({
      data: { firstName, lastName, rut, email: email || null, phone: phone || null, birthDate: birthDate ? new Date(birthDate) : null, gender: gender || null, address: address || null, city: city || null, healthInsurance: healthInsurance || null, insuranceNumber: insuranceNumber || null, notes: notes || null },
    });
    return NextResponse.json(patient, { status: 201 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error al crear paciente";
    if (msg.includes("Unique constraint")) return NextResponse.json({ error: "Ya existe un paciente con ese RUT" }, { status: 400 });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
