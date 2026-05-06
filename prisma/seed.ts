import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const users = await Promise.all([
    prisma.user.upsert({
      where: { email: "dr.magna@clinicamagna.cl" },
      update: {},
      create: {
        name: "Dr. Carlos Magna",
        email: "dr.magna@clinicamagna.cl",
        role: "admin",
        specialty: "Odontología General",
      },
    }),
    prisma.user.upsert({
      where: { email: "dra.rodriguez@clinicamagna.cl" },
      update: {},
      create: {
        name: "Dra. Ana Rodríguez",
        email: "dra.rodriguez@clinicamagna.cl",
        role: "dentist",
        specialty: "Ortodoncia",
      },
    }),
    prisma.user.upsert({
      where: { email: "recepcion@clinicamagna.cl" },
      update: {},
      create: {
        name: "Patricia Vega",
        email: "recepcion@clinicamagna.cl",
        role: "secretary",
      },
    }),
  ]);

  const patients = await Promise.all([
    prisma.patient.upsert({
      where: { rut: "12.345.678-9" },
      update: {},
      create: {
        rut: "12.345.678-9",
        firstName: "Juan",
        lastName: "González",
        email: "juan.gonzalez@email.com",
        phone: "+56 9 8765 4321",
        birthDate: new Date("1985-03-15"),
        gender: "M",
        address: "Av. Principal 123",
        city: "Santiago",
        healthInsurance: "FONASA",
      },
    }),
    prisma.patient.upsert({
      where: { rut: "15.678.901-2" },
      update: {},
      create: {
        rut: "15.678.901-2",
        firstName: "María",
        lastName: "Pérez",
        email: "maria.perez@email.com",
        phone: "+56 9 7654 3210",
        birthDate: new Date("1992-07-22"),
        gender: "F",
        address: "Calle Los Aromos 456",
        city: "Santiago",
        healthInsurance: "ISAPRE Cruz Blanca",
      },
    }),
    prisma.patient.upsert({
      where: { rut: "9.876.543-1" },
      update: {},
      create: {
        rut: "9.876.543-1",
        firstName: "Carlos",
        lastName: "Muñoz",
        email: "carlos.munoz@email.com",
        phone: "+56 9 6543 2109",
        birthDate: new Date("1978-11-05"),
        gender: "M",
        address: "Pasaje Las Flores 789",
        city: "Providencia",
        healthInsurance: "FONASA",
      },
    }),
    prisma.patient.upsert({
      where: { rut: "18.234.567-K" },
      update: {},
      create: {
        rut: "18.234.567-K",
        firstName: "Sofía",
        lastName: "Ramírez",
        email: "sofia.ramirez@email.com",
        phone: "+56 9 5432 1098",
        birthDate: new Date("1998-04-18"),
        gender: "F",
        address: "Av. Las Condes 1234",
        city: "Las Condes",
        healthInsurance: "ISAPRE Banmédica",
      },
    }),
    prisma.patient.upsert({
      where: { rut: "11.111.111-1" },
      update: {},
      create: {
        rut: "11.111.111-1",
        firstName: "Roberto",
        lastName: "Torres",
        email: "roberto.torres@email.com",
        phone: "+56 9 4321 0987",
        birthDate: new Date("1965-09-30"),
        gender: "M",
        address: "Calle Nueva 567",
        city: "Maipú",
        healthInsurance: "FONASA",
      },
    }),
  ]);

  const today = new Date().toISOString().split("T")[0];
  const userId = users[0].id;

  await Promise.all([
    prisma.appointment.create({
      data: {
        patientId: patients[0].id,
        userId,
        date: today,
        startTime: "09:00",
        endTime: "10:00",
        type: "Consulta General",
        status: "confirmed",
        box: 1,
      },
    }),
    prisma.appointment.create({
      data: {
        patientId: patients[1].id,
        userId,
        date: today,
        startTime: "10:30",
        endTime: "11:30",
        type: "Limpieza Dental",
        status: "scheduled",
        box: 2,
      },
    }),
    prisma.appointment.create({
      data: {
        patientId: patients[2].id,
        userId: users[1].id,
        date: today,
        startTime: "11:00",
        endTime: "12:00",
        type: "Ortodoncia",
        status: "confirmed",
        box: 1,
      },
    }),
    prisma.appointment.create({
      data: {
        patientId: patients[3].id,
        userId,
        date: today,
        startTime: "14:00",
        endTime: "15:00",
        type: "Extracción",
        status: "scheduled",
        box: 1,
      },
    }),
  ]);

  await Promise.all(
    patients.map((p) =>
      prisma.clinicalRecord.upsert({
        where: { patientId: p.id },
        update: {},
        create: {
          patientId: p.id,
          bloodType: ["A+", "B+", "O+", "AB+", "O-"][Math.floor(Math.random() * 5)],
          allergies: p.id === patients[0].id ? "Penicilina" : null,
          medicalBackground: p.id === patients[2].id ? "Hipertensión arterial" : null,
          dentalBackground: "Tratamiento de conducto previo",
        },
      })
    )
  );

  const budget1 = await prisma.budget.create({
    data: {
      number: 1,
      patientId: patients[0].id,
      userId,
      date: today,
      validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      status: "approved",
      subtotal: 450000,
      discount: 0,
      total: 450000,
      items: {
        create: [
          { description: "Corona de porcelana", tooth: "16", quantity: 1, unitPrice: 250000, total: 250000 },
          { description: "Endodoncia molar", tooth: "16", quantity: 1, unitPrice: 120000, total: 120000 },
          { description: "Radiografía periapical", tooth: "16", quantity: 2, unitPrice: 40000, total: 80000 },
        ],
      },
    },
  });

  await prisma.budget.create({
    data: {
      number: 2,
      patientId: patients[1].id,
      userId,
      date: today,
      validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      status: "pending",
      subtotal: 1200000,
      discount: 100000,
      total: 1100000,
      items: {
        create: [
          { description: "Aparato ortodoncia fija superior", quantity: 1, unitPrice: 600000, total: 600000 },
          { description: "Aparato ortodoncia fija inferior", quantity: 1, unitPrice: 600000, total: 600000 },
        ],
      },
    },
  });

  await prisma.payment.create({
    data: {
      patientId: patients[0].id,
      budgetId: budget1.id,
      date: today,
      amount: 225000,
      method: "transferencia",
      status: "completed",
      reference: "TRF-001",
      notes: "50% anticipo presupuesto",
    },
  });

  await prisma.expense.createMany({
    data: [
      { date: today, category: "materiales", description: "Materiales de impresión dental", amount: 85000, provider: "Dental Supply SpA" },
      { date: today, category: "servicios", description: "Cuenta agua y luz", amount: 42000 },
      {
        date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
        category: "arriendo",
        description: "Arriendo mensual consultorio",
        amount: 650000,
        paymentMethod: "transferencia",
      },
    ],
  });

  await prisma.evolution.createMany({
    data: [
      {
        patientId: patients[0].id,
        userId,
        date: today,
        diagnosis: "Caries profunda diente 16",
        treatment: "Endodoncia - 1ra sesión",
        tooth: "16",
        observations: "Paciente toleró bien el procedimiento. Próxima cita en 1 semana.",
        cost: 120000,
      },
      {
        patientId: patients[2].id,
        userId: users[1].id,
        date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
        diagnosis: "Control ortodoncia mensual",
        treatment: "Ajuste de arcos y cambio de ligaduras",
        observations: "Evolución favorable. Se nota cierre de espacios.",
        cost: 45000,
      },
    ],
  });

  console.log("✅ Datos de prueba creados exitosamente");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
