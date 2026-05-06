import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

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
  const file = formData.get("file") as File;
  const patientId = formData.get("patientId") as string;
  const type = (formData.get("type") as string) ?? "other";
  const name = (formData.get("name") as string) || file.name;

  const uploadDir = path.join(process.cwd(), "public", "uploads", patientId);
  await mkdir(uploadDir, { recursive: true });

  const ext = file.name.split(".").pop();
  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const filePath = path.join(uploadDir, fileName);
  await writeFile(filePath, Buffer.from(await file.arrayBuffer()));

  const doc = await prisma.patientDocument.create({
    data: {
      patientId,
      name,
      type,
      fileName: `/uploads/${patientId}/${fileName}`,
      mimeType: file.type,
      size: file.size,
    },
  });
  return NextResponse.json(doc, { status: 201 });
}
