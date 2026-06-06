import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const tokenUserId = (token as any).id as string;
  const tokenRole   = (token as any).role as string;

  // Only the user themselves or an ADMIN can upload a signature
  if (tokenUserId !== params.id && tokenRole !== "ADMIN") {
    return NextResponse.json({ error: "Sin permiso para modificar esta firma" }, { status: 403 });
  }

  const formData = await req.formData();
  const file = formData.get("signature") as File | null;

  if (!file) return NextResponse.json({ error: "No se recibió ningún archivo" }, { status: 400 });

  // Validate file type
  if (!["image/png", "image/jpeg", "image/jpg", "image/webp"].includes(file.type)) {
    return NextResponse.json({ error: "Solo se permiten imágenes PNG, JPG o WebP" }, { status: 400 });
  }

  // Validate file size (2MB max)
  if (file.size > 2 * 1024 * 1024) {
    return NextResponse.json({ error: "La imagen no puede superar 2MB" }, { status: 400 });
  }

  // Convert to base64 data URL for DB storage
  const bytes  = await file.arrayBuffer();
  const base64 = Buffer.from(bytes).toString("base64");
  const dataUrl = `data:${file.type};base64,${base64}`;

  await prisma.user.update({
    where: { id: params.id },
    data: { signatureUrl: dataUrl },
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const tokenUserId = (token as any).id as string;
  const tokenRole   = (token as any).role as string;

  if (tokenUserId !== params.id && tokenRole !== "ADMIN") {
    return NextResponse.json({ error: "Sin permiso para modificar esta firma" }, { status: 403 });
  }

  await prisma.user.update({
    where: { id: params.id },
    data: { signatureUrl: null },
  });

  return NextResponse.json({ ok: true });
}
