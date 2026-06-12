import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { prisma } from "@/lib/prisma";
import { logAudit, getIp } from "@/lib/audit";

async function getUser(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  return token ? { id: (token as any).id as string, name: token.name ?? "" } : null;
}

export async function POST(req: NextRequest) {
  const actor = await getUser(req);
  const data = await req.json();
  const evolution = await prisma.evolution.create({
    data,
    include: { user: true },
  });
  await logAudit({
    userId: actor?.id, userName: actor?.name,
    action: "CREATE", entity: "Evolution", entityId: evolution.id,
    details: { patientId: data.patientId, treatment: data.treatment },
    ip: getIp(req),
  });
  return NextResponse.json(evolution, { status: 201 });
}

export async function PUT(req: NextRequest) {
  const actor = await getUser(req);
  const { id, ...data } = await req.json();
  const { user, patient, ...rest } = data;
  const evolution = await prisma.evolution.update({ where: { id }, data: rest });
  await logAudit({
    userId: actor?.id, userName: actor?.name,
    action: "UPDATE", entity: "Evolution", entityId: id,
    ip: getIp(req),
  });
  return NextResponse.json(evolution);
}

export async function DELETE(req: NextRequest) {
  const actor = await getUser(req);
  const { id } = await req.json();
  // Soft delete — mark as deleted, never destroy clinical data
  const evolution = await prisma.evolution.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
  await logAudit({
    userId: actor?.id, userName: actor?.name,
    action: "DELETE", entity: "Evolution", entityId: id,
    details: { patientId: evolution.patientId, treatment: evolution.treatment },
    ip: getIp(req),
  });
  return NextResponse.json({ ok: true });
}
