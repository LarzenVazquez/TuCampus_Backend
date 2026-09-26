import { Request, Response, NextFunction } from "express";
import prisma from "../lib/prismaClient";
import { Product } from "@prisma/client";

export const checkStock = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const {
      items,
    }: { items: { productId: string; cantidad: number; nombre: string }[] } =
      req.body;

    if (!Array.isArray(items) || items.length === 0) {
      res.status(400).json({ message: "La orden no contiene productos" });
      return;
    }

    const productIds = items.map((i) => i.productId);

    const productos: Product[] = await prisma.product.findMany({
      where: {
        id: { in: productIds },
      },
    });

    for (const item of items) {
      const producto = productos.find((p: Product) => p.id === item.productId);

      if (!producto) {
        res
          .status(404)
          .json({ message: `El producto ${item.nombre} ya no existe.` });
        return;
      }

      const cantidad = Number(item.cantidad);
      if (!Number.isInteger(cantidad) || cantidad < 1 || cantidad > 50) {
        res.status(400).json({ message: `Cantidad inválida para ${producto.nombre}.` });
        return;
      }

      if (producto.tipo !== "Cafeteria" || producto.estado === "AGOTADO") {
        res.status(400).json({ message: `${producto.nombre} no está disponible por ahora.` });
        return;
      }

      if (producto.stock < cantidad) {
        res.status(400).json({
          message: `Stock insuficiente para ${producto.nombre}. Disponibles: ${producto.stock}`,
        });
        return;
      }
    }

    next();
  } catch (error: any) {
    res
      .status(500)
      .json({ message: "Error al validar stock", error: error.message });
  }
};
