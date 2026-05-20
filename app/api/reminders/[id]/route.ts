import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(_: Request, { params }: { params: { id: string } }) {
  const reminder = await prisma.reminder.update({
    where: { id: params.id },
    data: { cancelled: true },
  });
  return NextResponse.json(reminder);
}
