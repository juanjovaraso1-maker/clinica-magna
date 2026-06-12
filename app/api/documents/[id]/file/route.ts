import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSupabaseAdmin, BUCKET } from "@/lib/supabase-storage";

export const dynamic = "force-dynamic";

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const doc = await prisma.patientDocument.findUnique({ where: { id: params.id } });
  if (!doc) return NextResponse.json({ error: "Documento no encontrado" }, { status: 404 });

  // Extract the storage path from the stored public URL
  const marker = `/object/public/${BUCKET}/`;
  const idx = doc.fileName.indexOf(marker);

  // If no service key configured or path not extractable, redirect to public URL directly
  if (idx === -1 || !process.env.SUPABASE_SERVICE_KEY) {
    return NextResponse.redirect(doc.fileName);
  }

  const storagePath = doc.fileName.slice(idx + marker.length);

  // Try to generate a signed URL (works for both public and private buckets)
  try {
    const { data, error } = await getSupabaseAdmin()
      .storage.from(BUCKET)
      .createSignedUrl(storagePath, 3600);

    if (!error && data?.signedUrl) {
      return NextResponse.redirect(data.signedUrl);
    }
  } catch {
    // Fall through to public URL
  }

  // Fallback: redirect to the stored public URL
  return NextResponse.redirect(doc.fileName);
}
