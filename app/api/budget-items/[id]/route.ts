import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const { status, sessions, directCost } = await req.json();
  const item = await prisma.budgetItem.update({
    where: { id: params.id },
    data: { status, sessions: sessions ?? undefined, directCost: directCost ?? undefined },
  });
  return NextResponse.json(item);
}
