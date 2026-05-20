import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type");
  const logs = await prisma.emailLog.findMany({
    where: type ? { type } : undefined,
    orderBy: { sentAt: "desc" },
    take: 100,
  });
  return NextResponse.json(logs);
}
