import "dotenv/config";
import prisma from "../src/lib/prismaClient";
import {
  migrarImagenesProductos,
  ResultadoMigracion,
} from "../src/services/imageStorage";

const imprimir = (titulo: string, r: ResultadoMigracion) => {
  console.log(`\n${titulo}: ${r.migradas} de ${r.revisadas} migradas`);
  for (const f of r.fallidas)
    console.log(`  - ${f.nombre} (${f.id}): ${f.error} [${f.url}]`);
};

async function main() {
  console.log(
    `Almacenamiento: ${(process.env.IMAGE_STORAGE || "db").toLowerCase()}`,
  );
  imprimir("Productos de cafetería (RNF-15)", await migrarImagenesProductos());
}

main()
  .catch((e) => {
    console.error("La migración falló:", e.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
