import { Request, Response } from "express";
import prisma from "../../lib/prismaClient";

interface AuthenticatedRequest extends Request {
  user?: { id: string; rol: string; email: string; nombre: string };
}

const ensureString = (val: string | string[] | undefined): string =>
  Array.isArray(val) ? val[0] : val || "";

export const productController = {
  getProducts: async (_req: Request, res: Response): Promise<void> => {
    try {
      const productos = await prisma.product.findMany({
        where: { tipo: "Cafeteria" },
      });
      res.status(200).json(productos);
    } catch (error: any) {
      res
        .status(500)
        .json({ message: "Error al cargar el menú", error: error.message });
    }
  },

  // Menú del día habilitado para beca alimenticia. Solo devuelve los
  // productos que la cocina marcó explícitamente con esMenuBeca=true;
  // así el alumno becado nunca ve (ni puede reclamar) el catálogo completo.
  getMenuBeca: async (req: Request, res: Response): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const userId = authReq.user?.id;

      const productos = await prisma.product.findMany({
        where: {
          tipo: "Cafeteria",
          esMenuBeca: true,
          estado: "DISPONIBLE",
          stock: { gt: 0 },
        },
      });

      let yaReclamado = false;
      if (userId) {
        const inicioDeHoy = new Date();
        inicioDeHoy.setHours(0, 0, 0, 0);

        const ordenHoy = await prisma.order.findFirst({
          where: {
            userId,
            tipo: "Beca",
            fecha: { gte: inicioDeHoy },
          },
        });
        yaReclamado = !!ordenHoy;
      }

      res.status(200).json({ productos, yaReclamado });
    } catch (error: any) {
      res.status(500).json({
        message: "Error al cargar el menú de beca",
        error: error.message,
      });
    }
  },

  getProductsByCategory: async (req: Request, res: Response): Promise<void> => {
    try {
      const cat = ensureString(req.params.cat);
      const productos = await prisma.product.findMany({
        where: { categoria: cat, tipo: "Cafeteria" },
      });
      res.status(200).json(productos);
    } catch (error: any) {
      res.status(500).json({ message: "Error al filtrar productos" });
    }
  },

  createProduct: async (req: Request, res: Response): Promise<void> => {
    try {
      const tipoAsignado =
        req.user!.rol === "A_C" ? "Cafeteria" : "Marketplace";
      const nuevoProducto = await prisma.product.create({
        data: {
          ...req.body,
          precio: Number(req.body.precio),
          stock: Number(req.body.stock),
          calorias: Number(req.body.calorias) || 0,
          tipo: tipoAsignado,
          vendedorId: req.user!.id,
        },
      });
      res
        .status(201)
        .json({ message: "Producto registrado", product: nuevoProducto });
    } catch (error: any) {
      res.status(400).json({ message: "Error al crear", error: error.message });
    }
  },

  searchProducts: async (req: Request, res: Response): Promise<void> => {
    try {
      const q = ensureString(req.query.q as string);
      const productos = await prisma.product.findMany({
        where: {
          tipo: "Cafeteria",
          OR: [
            { nombre: { contains: q, mode: "insensitive" } },
            { descripcion: { contains: q, mode: "insensitive" } },
          ],
        },
      });
      res.status(200).json(productos);
    } catch (error: any) {
      res.status(500).json({ message: "Error en la búsqueda" });
    }
  },

  getProductById: async (req: Request, res: Response): Promise<void> => {
    try {
      const id = ensureString(req.params.id);
      const producto = await prisma.product.findUnique({ where: { id } });
      if (!producto) {
        res.status(404).json({ message: "Producto no encontrado" });
        return;
      }
      res.json(producto);
    } catch (error: any) {
      res.status(500).json({ message: "Error al buscar" });
    }
  },

  updateProduct: async (req: Request, res: Response): Promise<void> => {
    try {
      const id = ensureString(req.params.id);
      const producto = await prisma.product.findUnique({ where: { id } });

      if (!producto) {
        res.status(404).json({ message: "No existe" });
        return;
      }

      // Validamos permisos
      const canEdit =
        producto.vendedorId === req.user!.id ||
        (producto.tipo === "Cafeteria" && req.user!.rol === "A_C") ||
        (producto.tipo === "Marketplace" && req.user!.rol === "A");

      if (!canEdit) {
        res.status(403).json({ message: "No tienes permiso" });
        return;
      }

      const actualizado = await prisma.product.update({
        where: { id },
        data: req.body,
      });
      res.json({ message: "Actualizado con éxito", product: actualizado });
    } catch (error: any) {
      res.status(400).json({ message: "Error al actualizar" });
    }
  },

  deleteProduct: async (req: Request, res: Response): Promise<void> => {
    try {
      const id = ensureString(req.params.id);
      const producto = await prisma.product.findUnique({ where: { id } });

      if (!producto) {
        res.status(404).json({ message: "Producto no encontrado" });
        return;
      }

      const canDelete =
        producto.vendedorId === req.user!.id ||
        (producto.tipo === "Cafeteria" && req.user!.rol === "A_C") ||
        (producto.tipo === "Marketplace" && req.user!.rol === "A");

      if (!canDelete) {
        res.status(403).json({ message: "No tienes permiso" });
        return;
      }

      await prisma.product.delete({ where: { id } });
      res.json({ message: "Eliminado correctamente" });
    } catch (error: any) {
      res.status(500).json({ message: "Error al eliminar" });
    }
  },
};
