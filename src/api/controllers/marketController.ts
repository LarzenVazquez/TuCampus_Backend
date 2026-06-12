import { Request, Response } from "express";
import prisma from "../../lib/prismaClient";

export const marketController = {
  publishItem: async (req: Request, res: Response): Promise<void> => {
    try {
      const { titulo, precio, descripcion, categoria, imagenes } = req.body;
      const userId = req.user!.id;

      const nuevoItem = await prisma.market.create({
        data: {
          vendedorId: userId,
          titulo,
          precio,
          descripcion,
          categoria,
          imagenes:
            imagenes && imagenes.length > 0
              ? imagenes
              : [
                  "https://images.unsplash.com/photo-1526304640581-d334cdbbf45e",
                ],
          estatus: "pendiente",
        },
      });

      res.status(201).json({
        message: "Producto enviado a revisión. Estará visible pronto.",
        item: nuevoItem,
      });
    } catch (error: any) {
      res
        .status(400)
        .json({ message: "Error al publicar", error: error.message });
    }
  },

  getMarketItems: async (_req: Request, res: Response): Promise<void> => {
    try {
      const items = await prisma.market.findMany({
        where: { estatus: "activo" },
        orderBy: { fechaPublicacion: "desc" },
        include: { vendedor: { select: { nombre: true } } },
      });

      const itemsConNombre = items.map((item) => ({
        ...item,
        nombreVendedor: item.vendedor.nombre.split(" ")[0],
      }));

      res.json(itemsConNombre);
    } catch (error: any) {
      res
        .status(500)
        .json({ message: "Error al obtener productos", error: error.message });
    }
  },

  updateItem: async (req: Request, res: Response): Promise<void> => {
    try {
      const id = Array.isArray(req.params.id)
        ? req.params.id[0]
        : req.params.id;
      const { titulo, precio, descripcion, categoria, imagenes } = req.body;

      const item = await prisma.market.updateMany({
        where: { id, vendedorId: req.user!.id },
        data: {
          titulo,
          precio,
          descripcion,
          categoria,
          imagenes,
          estatus: "pendiente",
        },
      });

      if (item.count === 0) {
        res
          .status(404)
          .json({ message: "Producto no encontrado o no tienes permiso" });
        return;
      }

      res.json({ message: "Producto actualizado y enviado a revisión" });
    } catch (error: any) {
      res
        .status(400)
        .json({ message: "Error al actualizar", error: error.message });
    }
  },

  deleteItem: async (req: Request, res: Response): Promise<void> => {
    try {
      const id = Array.isArray(req.params.id)
        ? req.params.id[0]
        : req.params.id;
      const isAdmin = req.user!.rol === "A" || req.user!.rol === "A_C";

      const query = isAdmin ? { id } : { id, vendedorId: req.user!.id };

      const deleted = await prisma.market.deleteMany({ where: query });

      if (deleted.count === 0) {
        res.status(404).json({ message: "No se pudo eliminar el producto" });
        return;
      }

      res.json({ message: "Producto eliminado correctamente" });
    } catch (error: any) {
      res
        .status(400)
        .json({ message: "Error al eliminar", error: error.message });
    }
  },

  moderateItem: async (req: Request, res: Response): Promise<void> => {
    try {
      const id = Array.isArray(req.params.id)
        ? req.params.id[0]
        : req.params.id;
      const { estatus, motivoRechazo } = req.body;

      const item = await prisma.market.update({
        where: { id },
        data: { estatus, motivoRechazo },
      });

      res.json({
        message: `Estatus cambiado a ${estatus} correctamente`,
        item,
      });
    } catch (error: any) {
      res
        .status(400)
        .json({ message: "Error en la moderación", error: error.message });
    }
  },

  getMyItems: async (req: Request, res: Response): Promise<void> => {
    try {
      const items = await prisma.market.findMany({
        where: { vendedorId: req.user!.id },
      });
      res.json(items);
    } catch (error: any) {
      res.status(500).json({
        message: "Error al obtener tus anuncios",
        error: error.message,
      });
    }
  },

  getPendingItems: async (_req: Request, res: Response): Promise<void> => {
    try {
      const items = await prisma.market.findMany({
        where: { estatus: "pendiente" },
        orderBy: { fechaPublicacion: "desc" },
      });
      res.json(items);
    } catch (error: any) {
      res.status(500).json({
        message: "Error al obtener productos pendientes",
        error: error.message,
      });
    }
  },

  getMarketStats: async (_req: Request, res: Response): Promise<void> => {
    try {
      const pendientes = await prisma.market.count({
        where: { estatus: "pendiente" },
      });
      const activos = await prisma.market.count({
        where: { estatus: "activo" },
      });
      res.json({ pendientes, activos });
    } catch (error: any) {
      res.status(500).json({ message: "Error en stats de market" });
    }
  },

  getItemById: async (req: Request, res: Response): Promise<void> => {
    try {
      const id = Array.isArray(req.params.id)
        ? req.params.id[0]
        : req.params.id;
      const item = await prisma.market.findUnique({ where: { id } });

      if (!item) {
        res.status(404).json({ message: "Producto no encontrado" });
        return;
      }
      res.json(item);
    } catch (error: any) {
      res
        .status(400)
        .json({ message: "Error al obtener el detalle", error: error.message });
    }
  },
};
