import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const users = await prisma.user.findMany({ where: { active: true }, orderBy: { name: "asc" } });
  return NextResponse.json(users);
}
