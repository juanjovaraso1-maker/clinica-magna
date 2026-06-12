import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { prisma } from "@/lib/prisma";
import { logAudit, getIp } from "@/lib/audit";

async function getActor(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  return token ? { id: (token as any).id as string, name: token.name ?? "" } : null;
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const actor = await getActor(req);
  const { date, amount, method, notes } = await req.json();
  const payment = await prisma.payment.update({
    where: { id: params.id },
    data: { date, amount: parseFloat(String(amount)), method, notes },
    include: { patient: true, budget: true },
  });
  await logAudit({ userId: actor?.id, userName: actor?.name, action: "UPDATE", entity: "Payment", entityId: params.id, details: { amount, method }, ip: getIp(req) });
  return NextResponse.json(payment);
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const actor = await getActor(req);
  const payment = await prisma.payment.findUnique({ where: { id: params.id }, select: { amount: true, method: true, patientId: true } });
  // Soft delete — payment records must be recoverable for audit
  await prisma.payment.update({ where: { id: params.id }, data: { deletedAt: new Date() } });
  await logAudit({ userId: actor?.id, userName: actor?.name, action: "DELETE", entity: "Payment", entityId: params.id, details: { amount: payment?.amount, method: payment?.method }, ip: getIp(req) });
  return NextResponse.json({ ok: true });
}
