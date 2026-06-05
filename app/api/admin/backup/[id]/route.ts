import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const record = await prisma.backupRecord.findUnique({ where: { id: params.id } });
  if (!record) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  const date = new Date(record.createdAt).toISOString().slice(0, 10);
  return new NextResponse(record.data, {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="clinica-magna-backup-${date}.json"`,
    },
  });
}
