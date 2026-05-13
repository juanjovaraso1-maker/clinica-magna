import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const now = new Date();
  const cutoff90  = new Date(now.getTime() - 90  * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  const cutoff180 = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  const cutoff30  = new Date(now.getTime() - 30  * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  const [patients, appointments, evolutions] = await Promise.all([
    prisma.patient.findMany({
      where: { active: true },
      select: { id:true, firstName:true, lastName:true, birthDate:true, gender:true,
                healthInsurance:true, city:true, createdAt:true },
    }),
    prisma.appointment.findMany({
      select: { patientId:true, date:true, status:true },
    }),
    prisma.evolution.findMany({
      select: { patientId:true, date:true },
    }),
  ]);

  // Age distribution
  const ageGroups = { "0-17":0, "18-30":0, "31-50":0, "51-65":0, "65+":0, "Sin datos":0 };
  patients.forEach(p => {
    if (!p.birthDate) { ageGroups["Sin datos"]++; return; }
    const age = Math.floor((now.getTime() - new Date(p.birthDate).getTime()) / (1000*60*60*24*365.25));
    if      (age < 18) ageGroups["0-17"]++;
    else if (age < 31) ageGroups["18-30"]++;
    else if (age < 51) ageGroups["31-50"]++;
    else if (age < 66) ageGroups["51-65"]++;
    else               ageGroups["65+"]++;
  });
  const ageData = Object.entries(ageGroups)
    .filter(([,v]) => v > 0)
    .map(([name, value]) => ({ name, value }));

  // Gender distribution
  const genderMap: Record<string,number> = {};
  patients.forEach(p => {
    const g = p.gender === "M" ? "Masculino" : p.gender === "F" ? "Femenino" : "No especificado";
    genderMap[g] = (genderMap[g] ?? 0) + 1;
  });
  const genderData = Object.entries(genderMap).map(([name, value]) => ({ name, value }));

  // Insurance distribution (all active patients)
  const insuranceMap: Record<string,number> = {};
  patients.forEach(p => {
    const ins = p.healthInsurance?.trim() || "Sin previsión";
    insuranceMap[ins] = (insuranceMap[ins] ?? 0) + 1;
  });
  const insuranceData = Object.entries(insuranceMap)
    .sort((a,b) => b[1]-a[1])
    .map(([name, value]) => ({ name, value }));

  // City distribution
  const cityMap: Record<string,number> = {};
  patients.forEach(p => {
    const c = p.city?.trim() || "Sin ciudad";
    cityMap[c] = (cityMap[c] ?? 0) + 1;
  });
  const cityData = Object.entries(cityMap)
    .sort((a,b) => b[1]-a[1])
    .slice(0, 8)
    .map(([name, value]) => ({ name, value }));

  // At-risk patients: no evolution or appointment in the last 90 days
  const lastActivityByPatient: Record<string, string> = {};
  appointments.forEach(a => {
    if (!lastActivityByPatient[a.patientId] || a.date > lastActivityByPatient[a.patientId])
      lastActivityByPatient[a.patientId] = a.date;
  });
  evolutions.forEach(e => {
    if (!lastActivityByPatient[e.patientId] || e.date > lastActivityByPatient[e.patientId])
      lastActivityByPatient[e.patientId] = e.date;
  });

  const atRisk = patients
    .filter(p => {
      const last = lastActivityByPatient[p.id];
      return !last || last < cutoff90;
    })
    .map(p => ({
      id: p.id,
      name: `${p.firstName} ${p.lastName}`,
      lastActivity: lastActivityByPatient[p.id] ?? null,
      daysSince: lastActivityByPatient[p.id]
        ? Math.floor((now.getTime() - new Date(lastActivityByPatient[p.id]).getTime()) / (1000*60*60*24))
        : null,
    }))
    .sort((a,b) => (a.lastActivity ?? "0000").localeCompare(b.lastActivity ?? "0000"))
    .slice(0, 20);

  // New patients last 30 days
  const newLast30 = patients.filter(p => p.createdAt.toISOString().split("T")[0] >= cutoff30).length;
  // Returning: patients with 2+ appointments
  const apptCountByPatient: Record<string,number> = {};
  appointments.forEach(a => { apptCountByPatient[a.patientId] = (apptCountByPatient[a.patientId] ?? 0) + 1; });
  const returningCount = Object.values(apptCountByPatient).filter(c => c >= 2).length;
  const newCount       = Object.values(apptCountByPatient).filter(c => c === 1).length;
  const neverAppt      = patients.filter(p => !apptCountByPatient[p.id]).length;

  // At risk counts
  const atRiskCount  = patients.filter(p => { const l = lastActivityByPatient[p.id]; return !l || l < cutoff90; }).length;
  const dormant180   = patients.filter(p => { const l = lastActivityByPatient[p.id]; return !l || l < cutoff180; }).length;

  return NextResponse.json({
    total: patients.length,
    newLast30,
    returningCount,
    newCount,
    neverAppt,
    atRiskCount,
    dormant180,
    ageData,
    genderData,
    insuranceData,
    cityData,
    atRisk,
  });
}
