import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const users = await prisma.user.findMany({ orderBy: { name: "asc" } });
  return NextResponse.json(users);
}

export async function POST(req: Request) {
  const body = await req.json();
  const { name, email, role, specialty } = body;
  if (!name || !email) return NextResponse.json({ error: "Nombre y email requeridos" }, { status: 400 });
  const id = `user_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const user = await prisma.user.create({ data: { id, name, email, role: role || "dentist", specialty: specialty || null } });
  return NextResponse.json(user);
}
