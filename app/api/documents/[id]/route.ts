import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSupabaseAdmin, BUCKET } from "@/lib/supabase-storage";

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const doc = await prisma.patientDocument.findUnique({ where: { id: params.id } });
  if (doc) {
    // Extract storage path from public URL (everything after /public/{BUCKET}/)
    const marker = `/object/public/${BUCKET}/`;
    const idx = doc.fileName.indexOf(marker);
    if (idx !== -1) {
      const storagePath = doc.fileName.slice(idx + marker.length);
      await getSupabaseAdmin().storage.from(BUCKET).remove([storagePath]);
    }
    await prisma.patientDocument.delete({ where: { id: params.id } });
  }
  return NextResponse.json({ ok: true });
}
