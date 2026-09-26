import { Request, Response } from "express";
import brain from "brain.js";
import prisma from "../../lib/prismaClient";

let net = new brain.NeuralNetwork({ hiddenLayers: [6, 6] });

const getMexicoHour = (): number => {
  const str = new Date().toLocaleString("en-US", {
    timeZone: "America/Mexico_City",
  });
  return new Date(str).getHours();
};

export const train = async (req: Request, res: Response): Promise<void> => {
  try {
    const horaActual = getMexicoHour();
    const productos = await prisma.product.findMany({
      where: { estado: "DISPONIBLE" },
    });

    if (productos.length === 0) {
      res.status(404).json({ error: "No hay productos disponibles" });
      return;
    }

    const trainingData = productos.map((p) => ({
      input: {
        precio: (Number(p.precio) || 0) / 1000,
        stock: (p.stock || 0) > 0 ? 1 : 0,
        horario: horaActual / 24,
        esCafeteria: p.tipo === "Cafeteria" ? 1 : 0,
        ligero: (p.calorias || 0) < 300 ? 1 : 0,
      },
      output: { relevancia: (p.stock || 0) > 2 ? 1 : 0.4 },
    }));

    net.train(trainingData, { iterations: 2000 });

    await prisma.$transaction(
      productos.map((p) => {
        const output = net.run({
          precio: (Number(p.precio) || 0) / 1000,
          stock: (p.stock || 0) > 0 ? 1 : 0,
          horario: horaActual / 24,
          esCafeteria: p.tipo === "Cafeteria" ? 1 : 0,
          ligero: (p.calorias || 0) < 300 ? 1 : 0,
        }) as { relevancia: number };

        return prisma.recommendation.upsert({
          where: {
            producto_base_id_hora_prediccion: {
              producto_base_id: p.id,
              hora_prediccion: horaActual,
            },
          },
          update: {
            score_relevancia: output.relevancia,
            ultima_actualizacion: new Date(),
          },
          create: {
            producto_base_id: p.id,
            hora_prediccion: horaActual,
            score_relevancia: output.relevancia,
            nombre_producto: p.nombre,
            precio: Number(p.precio) || 0,
            categoria: p.categoria || "General",
            imagenUrl: p.imagenUrl || "",
            tipo: p.tipo || "Cafeteria",
            calorias: p.calorias || 0,
          },
        });
      }),
    );

    res.json({
      status: "success",
      message: `IA entrenada con ${productos.length} productos (hora ${horaActual}:00).`,
      items: productos.length,
      hora: horaActual,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

const obtenerSugerencias = async (
  filtroProducto: Record<string, unknown> = {},
  take = 8,
) => {
  const horaActual = getMexicoHour();
  const productoDisponible = {
    estado: "DISPONIBLE",
    stock: { gt: 0 },
    tipo: "Cafeteria",
    ...filtroProducto,
  };

  let sugerencias = await prisma.recommendation.findMany({
    where: { hora_prediccion: horaActual, producto: productoDisponible },
    orderBy: { score_relevancia: "desc" },
    take,
    include: { producto: true },
  });

  if (sugerencias.length === 0) {
    sugerencias = await prisma.recommendation.findMany({
      where: { producto: productoDisponible },
      orderBy: [{ ultima_actualizacion: "desc" }, { score_relevancia: "desc" }],
      distinct: ["producto_base_id"],
      take,
      include: { producto: true },
    });
  }

  return { horaActual, sugerencias };
};

const ask = async (req: Request, res: Response): Promise<void> => {
  try {
    const prompt = String((req.query as any).prompt || "").slice(0, 200);
    const texto = prompt.toLowerCase();

    const numero = texto.match(/\d+/);
    const presupuesto = numero ? parseInt(numero[0], 10) : null;
    const ligero = /ligero|light|saludable|bajo en calor/i.test(texto);
    const rapido = /r[aá]pido|prisa|<\s*10|menos de 10 min/i.test(texto);

    const categorias = await prisma.product.findMany({
      where: { tipo: "Cafeteria" },
      select: { categoria: true },
      distinct: ["categoria"],
    });
    const categoria = categorias
      .map((c) => c.categoria)
      .find((c) => c && texto.includes(c.toLowerCase()));

    const filtro: Record<string, unknown> = {};
    if (presupuesto !== null) filtro.precio = { lte: presupuesto };
    if (ligero) filtro.calorias = { lt: 400 };
    if (rapido) filtro.tiempoPrepMin = { lte: 10 };
    if (categoria) filtro.categoria = categoria;

    const { sugerencias } = await obtenerSugerencias(filtro, 4);

    res.json({
      sugerencias,
      productos: sugerencias.map((s) => s.producto),
      filtros: { presupuesto, ligero, rapido, categoria: categoria ?? null },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

const results = async (_req: Request, res: Response): Promise<void> => {
  try {
    const { horaActual, sugerencias } = await obtenerSugerencias({}, 8);
    res.json({
      hora: horaActual,
      sugerencias,
      productos: sugerencias.map((s) => s.producto),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

const reset = async (_req: Request, res: Response): Promise<void> => {
  try {
    await prisma.recommendation.deleteMany({});
    net = new brain.NeuralNetwork({ hiddenLayers: [6, 6] });
    res.json({ message: "Memoria de IA reiniciada." });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const iaController = {
  ask,
  results,
  train,
  reset,
};
