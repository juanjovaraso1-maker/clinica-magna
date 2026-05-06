import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import * as XLSX from "xlsx";

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get("file") as File;
  if (!file) return NextResponse.json({ error: "No se envió archivo" }, { status: 400 });

  const buffer = Buffer.from(await file.arrayBuffer());
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet);

  const created: number[] = [];
  for (const row of rows) {
    const name = String(row["Nombre"] ?? row["name"] ?? "").trim();
    const category = String(row["Categoría"] ?? row["Categoria"] ?? row["category"] ?? "General").trim();
    const price = parseFloat(String(row["Precio"] ?? row["price"] ?? "0").replace(/\./g, "").replace(",", "."));
    const description = String(row["Descripción"] ?? row["Descripcion"] ?? row["description"] ?? "").trim();
    if (!name) continue;
    await prisma.treatment.create({ data: { name, category, price: isNaN(price) ? 0 : price, description: description || null } });
    created.push(price);
  }

  return NextResponse.json({ imported: created.length });
}
