import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSupabaseAdmin, BUCKET, publicUrl } from "@/lib/supabase-storage";

export async function GET(req: NextRequest) {
  const patientId = req.nextUrl.searchParams.get("patientId");
  if (!patientId) return NextResponse.json([], { status: 200 });
  const docs = await prisma.patientDocument.findMany({
    where: { patientId },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(docs);
}

const ALLOWED_MIME = new Set([
  "image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);
const MAX_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file     = formData.get("file") as File;
  const patientId = formData.get("patientId") as string;
  const type     = (formData.get("type") as string) ?? "other";
  const name     = (formData.get("name") as string) || file.name;

  // Validate presence
  if (!file || !patientId) {
    return NextResponse.json({ error: "Archivo y paciente son requeridos" }, { status: 400 });
  }

  // Validate MIME type
  if (!ALLOWED_MIME.has(file.type)) {
    return NextResponse.json(
      { error: `Tipo de archivo no permitido: ${file.type}. Solo se aceptan PDF, imágenes y documentos Word.` },
      { status: 400 }
    );
  }

  // Validate size
  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json(
      { error: `El archivo supera el límite de 20 MB (${(file.size / 1024 / 1024).toFixed(1)} MB).` },
      { status: 400 }
    );
  }

  const ext      = file.name.split(".").pop()?.toLowerCase() ?? "bin";
  const storagePath = `${patientId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

  const { error } = await getSupabaseAdmin().storage
    .from(BUCKET)
    .upload(storagePath, Buffer.from(await file.arrayBuffer()), {
      contentType: file.type,
      upsert: false,
    });

  if (error) {
    console.error("Supabase upload error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const doc = await prisma.patientDocument.create({
    data: {
      patientId,
      name,
      type,
      fileName: publicUrl(storagePath),
      mimeType: file.type,
      size: file.size,
    },
  });

  return NextResponse.json(doc, { status: 201 });
}
