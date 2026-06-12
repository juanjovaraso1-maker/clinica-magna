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

  if (idx === -1) {
    // Fallback: redirect directly to the stored URL
    return NextResponse.redirect(doc.fileName);
  }

  const storagePath = doc.fileName.slice(idx + marker.length);

  // Generate a signed URL valid for 1 hour (works for public and private buckets)
  const { data, error } = await getSupabaseAdmin()
    .storage.from(BUCKET)
    .createSignedUrl(storagePath, 3600);

  if (error || !data?.signedUrl) {
    // Last resort: redirect to public URL directly
    return NextResponse.redirect(doc.fileName);
  }

  return NextResponse.redirect(data.signedUrl);
}
