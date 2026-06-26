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

    res.json({ status: "success", items: productos.length, hora: horaActual });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

const ask = async (req: Request, res: Response): Promise<void> => {
  try {
    const { prompt } = req.query as { prompt: string };
    const horaActual = getMexicoHour();
    let presupuesto = 999;
    if (prompt) {
      const regex = /\d+/;
      const match = regex.exec(prompt);
      if (match) {
        presupuesto = Number.parseInt(match[0]);
      }
    }

    const sugerencias = await prisma.recommendation.findMany({
      where: {
        hora_prediccion: horaActual,
        producto: { precio: { lte: presupuesto } },
      },
      orderBy: { score_relevancia: "desc" },
      take: 4,
      include: { producto: true },
    });

    res.json({ sugerencias });
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

const results = async (req: Request, res: Response): Promise<void> => {
  res.json({ message: "Endpoint no implementado aún" });
};

export const iaController = {
  ask,
  results,
  train,
  reset,
};
