import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const tasks = await prisma.financeTask.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json(tasks);
}

export async function POST(req: NextRequest) {
  const data = await req.json();
  const task = await prisma.financeTask.create({ data });
  return NextResponse.json(task, { status: 201 });
}
