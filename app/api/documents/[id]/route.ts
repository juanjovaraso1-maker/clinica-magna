import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { unlink } from "fs/promises";
import path from "path";

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const doc = await prisma.patientDocument.findUnique({ where: { id: params.id } });
  if (doc) {
    try {
      await unlink(path.join(process.cwd(), "public", doc.fileName));
    } catch {}
    await prisma.patientDocument.delete({ where: { id: params.id } });
  }
  return NextResponse.json({ ok: true });
}
