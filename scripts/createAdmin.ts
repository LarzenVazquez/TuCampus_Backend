import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.join(__dirname, "../.env") });

import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcrypt";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const ADMIN_EMAIL = "admin@uteq.edu.mx";
const ADMIN_PASSWORD = "TuCampuS2026!";
const ADMIN_NOMBRE = "Administrador TuCampus";
// ---------------------------------------------------------

async function main() {
  const existing = await prisma.user.findUnique({
    where: { email: ADMIN_EMAIL },
  });

  if (existing) {
    console.log(`Ya existe un usuario con ese correo (id: ${existing.id}). No se creó nada.`);
    return;
  }

  const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 10);

  const admin = await prisma.user.create({
    data: {
      nombre: ADMIN_NOMBRE,
      email: ADMIN_EMAIL,
      password: hashedPassword,
      rol: "A", // Administrador Maestro
      email_verificado: true, // se salta la verificación de correo
      activo: true,
    },
  });

  console.log("Usuario administrador creado:");
  console.log({ id: admin.id, email: admin.email, rol: admin.rol });
}

main()
  .catch((err) => {
    console.error("Error creando el admin:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });