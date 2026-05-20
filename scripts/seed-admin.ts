import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const hashed = await bcrypt.hash("magna2024", 12);

  const user = await prisma.user.upsert({
    where: { username: "juanjo" },
    update: {
      name: "Dr. Juan José Varas",
      password: hashed,
      role: "ADMIN",
      active: true,
    },
    create: {
      username: "juanjo",
      name: "Dr. Juan José Varas",
      password: hashed,
      role: "ADMIN",
      active: true,
    },
  });

  console.log("Admin user ready:", user.name, "| role:", user.role);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
