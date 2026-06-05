import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Get the admin user
  const admin = await prisma.user.findFirst({ where: { username: "juanjo" } });
  if (!admin) throw new Error("Admin user not found");

  // Create patient
  const patient = await prisma.patient.create({
    data: {
      rut: "12.345.678-9",
      firstName: "María",
      lastName: "González Pérez",
      email: "maria.gonzalez@gmail.com",
      phone: "+56 9 8765 4321",
      birthDate: new Date("1990-03-15"),
      gender: "Mujer",
      address: "Av. Providencia 1234, Dpto. 56",
      city: "Santiago",
      healthInsurance: "Referido",
      notes: "Paciente de prueba con todas las funciones habilitadas.",
    },
  });

  // Clinical record
  await prisma.clinicalRecord.create({
    data: {
      patientId: patient.id,
      bloodType: "O+",
      allergies: "Penicilina, Látex",
      currentMedications: "Losartán 50mg (hipertensión)",
      medicalBackground: "Hipertensión arterial diagnosticada en 2018. Sin cirugías previas.",
      dentalBackground: "Ortodoncia 2010-2012. Extracciones de terceros molares superiores en 2015.",
      habits: "Fumadora ocasional, consume café diariamente.",
      observations: "Paciente ansiosa. Requiere técnica de relajación antes de procedimientos.",
    },
  });

  // Evolutions
  await prisma.evolution.createMany({
    data: [
      {
        patientId: patient.id,
        userId: admin.id,
        date: "2026-04-10",
        diagnosis: "Caries profunda diente 1.6",
        treatment: "Obturación compuesta clase II con resina fotopolimerizable",
        tooth: "1.6",
        observations: "Se realizó anestesia infiltrativa. Paciente toleró bien el procedimiento.",
        cost: 45000,
      },
      {
        patientId: patient.id,
        userId: admin.id,
        date: "2026-05-03",
        diagnosis: "Periodontitis leve generalizada",
        treatment: "Destartraje supragingival ultrasónico + pulido coronal",
        tooth: "",
        observations: "Se instruyó técnica de higiene Bass modificada. Control en 3 meses.",
        cost: 35000,
      },
      {
        patientId: patient.id,
        userId: admin.id,
        date: "2026-05-20",
        diagnosis: "Caries incipiente diente 2.5",
        treatment: "Sellante oclusal preventivo",
        tooth: "2.5",
        observations: "Lesión inicial. Se optó por sellante como tratamiento conservador.",
        cost: 18000,
      },
    ],
  });

  // Budget
  const lastBudget = await prisma.budget.findFirst({ orderBy: { number: "desc" } });
  const nextNum = (lastBudget?.number ?? 0) + 1;

  const budget = await prisma.budget.create({
    data: {
      number: nextNum,
      patientId: patient.id,
      userId: admin.id,
      date: "2026-05-20",
      validUntil: "2026-08-20",
      status: "active",
      subtotal: 320000,
      discount: 20000,
      total: 300000,
      notes: "Plan de tratamiento integral. Incluye endodoncia, corona y blanqueamiento.",
      items: {
        create: [
          {
            description: "Endodoncia diente 1.1",
            tooth: "1.1",
            area: "Superior",
            quantity: 1,
            unitPrice: 120000,
            discount: 0,
            total: 120000,
            status: "completed",
            sessions: 2,
          },
          {
            description: "Corona porcelana diente 1.1",
            tooth: "1.1",
            area: "Superior",
            quantity: 1,
            unitPrice: 150000,
            discount: 20000,
            total: 130000,
            status: "in_progress",
            sessions: 3,
          },
          {
            description: "Blanqueamiento dental LED",
            tooth: "",
            area: "Ambos maxilares",
            quantity: 1,
            unitPrice: 50000,
            discount: 0,
            total: 50000,
            status: "pending",
            sessions: 1,
          },
        ],
      },
    },
  });

  // Payment for that budget
  await prisma.payment.create({
    data: {
      patientId: patient.id,
      budgetId: budget.id,
      date: "2026-05-25",
      amount: 150000,
      method: "transferencia",
      notes: "Abono inicial plan de tratamiento",
      status: "completed",
    },
  });

  // Appointments
  await prisma.appointment.createMany({
    data: [
      {
        patientId: patient.id,
        userId: admin.id,
        date: "2026-04-10",
        startTime: "10:00",
        endTime: "10:30",
        type: "Consulta",
        status: "completed",
        box: 1,
      },
      {
        patientId: patient.id,
        userId: admin.id,
        date: "2026-05-03",
        startTime: "11:00",
        endTime: "11:45",
        type: "Tratamiento",
        status: "completed",
        box: 1,
      },
      {
        patientId: patient.id,
        userId: admin.id,
        date: "2026-06-18",
        startTime: "09:30",
        endTime: "10:15",
        type: "Tratamiento",
        status: "scheduled",
        notes: "Colocación de corona provisional",
        box: 1,
      },
    ],
  });

  // Odontogram record with some conditions
  const odontogramData = {
    teeth: {
      "11": { wholeCond: "endodoncia", surfaces: {}, note: "" },
      "16": { wholeCond: "obturacion", surfaces: { O: { cond: "obturacion" }, M: { cond: "obturacion" } }, note: "" },
      "25": { wholeCond: "", surfaces: { O: { cond: "sellante" } }, note: "" },
      "36": { wholeCond: "", surfaces: { O: { cond: "caries" }, D: { cond: "caries" } }, note: "" },
      "18": { wholeCond: "ausente", surfaces: {}, note: "" },
      "28": { wholeCond: "ausente", surfaces: {}, note: "" },
    },
    observations: "Dentición permanente completa excepto 3os molares. Endodoncia 1.1 en curso.",
  };

  await prisma.odontogramRecord.create({
    data: {
      patientId: patient.id,
      date: "2026-05-20",
      type: "permanent",
      data: JSON.stringify(odontogramData),
    },
  });

  // Prescription
  await prisma.prescriptionRecord.create({
    data: {
      patientId: patient.id,
      userId: admin.id,
      date: "2026-05-03",
      type: "recipe",
      content: JSON.stringify({
        medications: [
          { name: "Amoxicilina 500mg", dosage: "1 cápsula cada 8 horas por 7 días" },
          { name: "Ibuprofeno 400mg", dosage: "1 comprimido cada 8 horas por 3 días, si hay dolor" },
        ],
        instructions: "Tomar con alimentos. Completar el tratamiento antibiótico completo.",
        diagnosis: "Periodontitis. Profilaxis post-destartraje.",
      }),
    },
  });

  console.log(`✅ Paciente de prueba creado: ${patient.firstName} ${patient.lastName} (ID: ${patient.id})`);
  console.log(`   RUT: ${patient.rut}`);
  console.log(`   Url: /pacientes/${patient.id}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
