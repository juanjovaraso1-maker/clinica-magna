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

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file     = formData.get("file") as File;
  const patientId = formData.get("patientId") as string;
  const type     = (formData.get("type") as string) ?? "other";
  const name     = (formData.get("name") as string) || file.name;

  const ext      = file.name.split(".").pop();
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
