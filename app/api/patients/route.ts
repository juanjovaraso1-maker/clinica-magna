import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const search = req.nextUrl.searchParams.get("search") ?? "";
  const patients = await prisma.patient.findMany({
    where: search ? {
      OR: [
        { firstName: { contains: search } },
        { lastName: { contains: search } },
        { rut: { contains: search } },
        { phone: { contains: search } },
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
  const data = await req.json();
  const patient = await prisma.patient.create({ data });
  return NextResponse.json(patient, { status: 201 });
}
