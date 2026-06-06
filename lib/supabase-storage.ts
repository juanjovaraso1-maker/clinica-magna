import { createClient } from "@supabase/supabase-js";

export const BUCKET = "patient-documents";

export function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error("Supabase no configurado: agrega SUPABASE_URL y SUPABASE_SERVICE_KEY en Vercel");
  return createClient(url, key);
}

export function publicUrl(path: string): string {
  return `${process.env.SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`;
}
