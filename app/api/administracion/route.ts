import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/administracion?month=2025-05
// Returns users + their commissions + liquidacion data for the given month
export async function GET(req: NextRequest) {
  const month = req.nextUrl.searchParams.get("month") ?? new Date().toISOString().slice(0,7);
  const [year, mon] = month.split("-").map(Number);

  const startDate = `${month}-01`;
  const endDate   = new Date(year, mon, 0).toISOString().split("T")[0]; // last day of month

  const [users, commissionsRow, evolutions] = await Promise.all([
    prisma.user.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.clinicConfig.findUnique({ where: { key: "doctor_commissions" } }),
    prisma.evolution.findMany({
      where: { date: { gte: startDate, lte: endDate } },
      select: { id:true, userId:true, treatment:true, cost:true, date:true, patient:{ select:{ firstName:true, lastName:true } } },
    }),
  ]);

  const commissions: Record<string,{ global:number; categories:Record<string,number> }> =
    commissionsRow?.value ? JSON.parse(commissionsRow.value) : {};

  // Build liquidaciones per user
  const liquidaciones = users.map(u => {
    const uEvos = evolutions.filter(e => e.userId === u.id);
    const comm = commissions[u.id] ?? { global: 0, categories: {} };
    const items = uEvos.map(e => {
      const rate = comm.global ?? 0;
      return { evolutionId:e.id, date:e.date, treatment:e.treatment, cost:e.cost,
               rate, commission: Math.round((e.cost * rate) / 100),
               patientName:`${e.patient.firstName} ${e.patient.lastName}` };
    });
    const totalRevenue    = items.reduce((s,i) => s + i.cost, 0);
    const totalCommission = items.reduce((s,i) => s + i.commission, 0);
    return { userId:u.id, userName:u.name, role:u.role, specialty:u.specialty,
             globalRate: comm.global ?? 0, items, totalRevenue, totalCommission };
  });

  return NextResponse.json({ users, commissions, liquidaciones });
}

// POST /api/administracion — save commission config
export async function POST(req: NextRequest) {
  const { commissions } = await req.json();
  await prisma.clinicConfig.upsert({
    where: { key: "doctor_commissions" },
    update: { value: JSON.stringify(commissions) },
    create: { key: "doctor_commissions", value: JSON.stringify(commissions) },
  });
  return NextResponse.json({ ok: true });
}
