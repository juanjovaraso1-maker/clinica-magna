import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const { data } = await req.json();
  const record = await prisma.odontogramRecord.update({
    where: { id: params.id },
    data: { data: JSON.stringify(data) },
  });
  return NextResponse.json({ ...record, data: JSON.parse(record.data) });
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  await prisma.odontogramRecord.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
