import "dotenv/config";
import bcrypt from "bcrypt";
import prisma from "../src/lib/prismaClient";

const IMG_PLACEHOLDER =
  "https://images.pexels.com/photos/14018214/pexels-photo-14018214.png";

const matriculaDe = (email: string) => email.split("@")[0];

async function seedUsers() {
  const usuarios = [
    {
      nombre: "ROXANA HERRERA",
      email: "2024171035@uteq.edu.mx",
      password: "Menta12.",
      rol: "A",
    },
    {
      nombre: "LARZEN VAZQUEZ",
      email: "2024171016@uteq.edu.mx",
      password: "Huesos12.",
      rol: "A_C",
    },
    {
      nombre: "ANDREA VASQUEZ",
      email: "2023148002@uteq.edu.mx",
      password: "Nieve12.",
      rol: "A_V",
      vendedor_verificado: true,
    },
    {
      nombre: "Mauricio Alcantara",
      email: "2024171010@uteq.edu.mx",
      password: "Miau123.",
      rol: "Al",
      es_becado: true,
    },
    {
      nombre: "Jose Lopez",
      email: "2023371214@uteq.edu.mx",
      password: "Limon12.",
      rol: "Al",
    },
    {
      nombre: "Ricardo Porras",
      email: "2024171008@uteq.edu.mx",
      password: "Salsa12.",
      rol: "Al",
    },
  ];

  const creados: Record<string, string> = {};

  for (const u of usuarios) {
    const hashedPassword = await bcrypt.hash(u.password, 10);

    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: {
        nombre: u.nombre,
        password: hashedPassword,
        rol: u.rol,
        matricula: matriculaDe(u.email),
        email_verificado: true,
        activo: true,
        vendedor_verificado: u.vendedor_verificado ?? false,
        es_becado: u.es_becado ?? false,
      },
      create: {
        nombre: u.nombre,
        email: u.email,
        password: hashedPassword,
        matricula: matriculaDe(u.email),
        rol: u.rol,
        email_verificado: true,
        activo: true,
        vendedor_verificado: u.vendedor_verificado ?? false,
        es_becado: u.es_becado ?? false,
      },
    });

    creados[u.rol] = user.id;
    console.log(`Usuario ${u.rol.padEnd(4)} -> ${u.email} (${user.id})`);
  }

  return creados;
}

async function seedProducts(vendedorId: string) {
  const productos = [
    {
      nombre: "Torta de Jamón",
      categoria: "Comida",
      precio: 45,
      calorias: 520,
      stock: 20,
      tiempoPrepMin: 8,
    },
    {
      nombre: "Torta de Milanesa",
      categoria: "Comida",
      precio: 55,
      calorias: 680,
      stock: 15,
      tiempoPrepMin: 10,
    },
    {
      nombre: "Sándwich",
      categoria: "Comida",
      precio: 50,
      calorias: 450,
      stock: 15,
      tiempoPrepMin: 7,
    },
    {
      nombre: "Hot Dog Sencillo",
      categoria: "Comida",
      precio: 35,
      calorias: 400,
      stock: 25,
      tiempoPrepMin: 6,
    },
    {
      nombre: "Burrito de Frijol con Queso",
      categoria: "Comida",
      precio: 40,
      calorias: 480,
      stock: 20,
      tiempoPrepMin: 8,
      esMenuBeca: true,
    },
    {
      nombre: "Ensalada de Pollo",
      categoria: "Comida",
      precio: 60,
      calorias: 350,
      stock: 10,
      tiempoPrepMin: 9,
    },
    {
      nombre: "Quesadilla de Queso",
      categoria: "Comida",
      precio: 30,
      calorias: 380,
      stock: 25,
      tiempoPrepMin: 6,
      esMenuBeca: true,
    },
    {
      nombre: "Café Americano",
      categoria: "Bebidas",
      precio: 25,
      calorias: 5,
      stock: 40,
      tiempoPrepMin: 4,
    },
    {
      nombre: "Capuchino",
      categoria: "Bebidas",
      precio: 35,
      calorias: 120,
      stock: 30,
      tiempoPrepMin: 5,
    },
    {
      nombre: "Agua de Horchata",
      categoria: "Bebidas",
      precio: 20,
      calorias: 150,
      stock: 30,
      tiempoPrepMin: 3,
    },
    {
      nombre: "Refresco de Lata",
      categoria: "Bebidas",
      precio: 22,
      calorias: 140,
      stock: 50,
      tiempoPrepMin: 1,
    },
    {
      nombre: "Jugo de Naranja Natural",
      categoria: "Bebidas",
      precio: 28,
      calorias: 110,
      stock: 20,
      tiempoPrepMin: 4,
    },
  ];

  for (const p of productos) {
    const existente = await prisma.product.findFirst({
      where: { nombre: p.nombre, vendedorId },
    });

    if (existente) {
      await prisma.product.update({
        where: { id: existente.id },
        data: {
          precio: p.precio,
          calorias: p.calorias,
          categoria: p.categoria,
          stock: p.stock,
          estado: "DISPONIBLE",
          tipo: "Cafeteria",
          imagenUrl: IMG_PLACEHOLDER,
          tiempoPrepMin: p.tiempoPrepMin,
          esMenuBeca: p.esMenuBeca ?? false,
        },
      });
      console.log(`Producto actualizado: ${p.nombre}`);
      continue;
    }

    await prisma.product.create({
      data: {
        nombre: p.nombre,
        descripcion: `${p.nombre} — producto de prueba generado por el seed.`,
        precio: p.precio,
        calorias: p.calorias,
        categoria: p.categoria,
        stock: p.stock,
        estado: "DISPONIBLE",
        tipo: "Cafeteria",
        imagenUrl: IMG_PLACEHOLDER,
        tiempoPrepMin: p.tiempoPrepMin,
        esMenuBeca: p.esMenuBeca ?? false,
        vendedorId,
      },
    });
    console.log(`Producto creado: ${p.nombre}`);
  }
}

async function main() {
  console.log("Sembrando usuarios...");
  const idsPorRol = await seedUsers();

  console.log("\nSembrando productos de cafetería...");
  await seedProducts(idsPorRol["A_C"]);

  console.log("\nSeed completado.");
  console.log(`
Credenciales de prueba (todas ya con email_verificado = true):
  Admin maestro (A)        -> 2024171035@uteq.edu.mx / Menta12.
  Cafetería (A_C)          -> 2024171016@uteq.edu.mx / Huesos12.
  Alumno vendedor (A_V)    -> 2023148002@uteq.edu.mx / Nieve12.
  Alumno normal, becado    -> 2024171010@uteq.edu.mx / Miau123.
  Alumno normal            -> 2023371214@uteq.edu.mx / Limon12.
  Alumno normal            -> 2024171008@uteq.edu.mx / Salsa12.
`);
}

main()
  .catch((e) => {
    console.error("Error al ejecutar el seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
