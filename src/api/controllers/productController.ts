import { Request, Response } from "express";
import prisma from "../../lib/prismaClient";
import { ImagenError, normalizarImagen } from "../../services/imageStorage";
import { conIdLegado, listaConIdLegado } from "../../lib/legacyAlias";

const ESTADOS = ["DISPONIBLE", "AGOTADO"];

const leerProducto = (
  body: any,
  parcial = false,
): { data?: Record<string, unknown>; error?: string } => {
  const data: Record<string, unknown> = {};
  const req = (campo: string) => body[campo] !== undefined || !parcial;

  if (req("nombre")) {
    const v = typeof body.nombre === "string" ? body.nombre.trim() : "";
    if (v.length < 2 || v.length > 100)
      return { error: "El nombre debe tener entre 2 y 100 caracteres." };
    data.nombre = v;
  }
  if (body.descripcion !== undefined) {
    data.descripcion =
      typeof body.descripcion === "string"
        ? body.descripcion.trim().slice(0, 1000)
        : null;
  }
  if (req("precio")) {
    const v = Number(body.precio);
    if (!Number.isFinite(v) || v < 0 || v > 100000)
      return { error: "Precio inválido." };
    data.precio = v;
  }
  if (req("categoria")) {
    const v = typeof body.categoria === "string" ? body.categoria.trim() : "";
    if (!v) return { error: "La categoría es obligatoria." };
    data.categoria = v.slice(0, 50);
  }
  if (req("imagenUrl")) {
    const v = typeof body.imagenUrl === "string" ? body.imagenUrl.trim() : "";
    data.imagenUrl = v;
  }
  if (body.stock !== undefined || !parcial) {
    const v = Math.trunc(Number(body.stock ?? 0));
    if (!Number.isFinite(v) || v < 0) return { error: "Stock inválido." };
    data.stock = v;
  }
  if (body.calorias !== undefined) {
    const v = Math.trunc(Number(body.calorias));
    data.calorias = Number.isFinite(v) && v >= 0 ? v : 0;
  }
  if (body.tiempoPrepMin !== undefined) {
    const v = Math.trunc(Number(body.tiempoPrepMin));
    if (!Number.isFinite(v) || v < 1 || v > 180)
      return { error: "Tiempo de preparación inválido (1–180 min)." };
    data.tiempoPrepMin = v;
  }
  if (body.esMenuBeca !== undefined)
    data.esMenuBeca = body.esMenuBeca === true || body.esMenuBeca === "true";
  if (body.estado !== undefined) {
    if (!ESTADOS.includes(body.estado)) return { error: "Estado inválido." };
    data.estado = body.estado;
  }
  return { data };
};

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
        orderBy: { nombre: "asc" },
      });
      res.status(200).json(listaConIdLegado(productos));
    } catch (error: any) {
      res
        .status(500)
        .json({ message: "Error al cargar el menú", error: error.message });
    }
  },

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
            status: { not: "CARRITO" },
            fecha: { gte: inicioDeHoy },
          },
        });
        yaReclamado = !!ordenHoy;
      }

      res
        .status(200)
        .json({ productos: listaConIdLegado(productos), yaReclamado });
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

      const search = req.query.search;
      let whereCondition: any = { categoria: cat, tipo: "Cafeteria" };

      if (search) {
        if (typeof search !== "string" || search.length > 50) {
          res.status(400).json({ message: "Parámetro de búsqueda inválido" });
          return;
        }
        whereCondition.nombre = {
          contains: search.trim(),
          mode: "insensitive",
        };
      }

      const productos = await prisma.product.findMany({
        where: whereCondition,
      });

      res.status(200).json(listaConIdLegado(productos));
    } catch (error: any) {
      res.status(500).json({ message: "Error al filtrar productos" });
    }
  },

  createProduct: async (req: Request, res: Response): Promise<void> => {
    try {
      const { data, error } = leerProducto(req.body);
      if (error) {
        res.status(400).json({ message: error });
        return;
      }
      data!.imagenUrl = await normalizarImagen(data!.imagenUrl, "producto", req.user!.id);
      const nuevoProducto = await prisma.product.create({
        data: {
          ...(data as any),
          estado:
            (data!.estado as string) ||
            ((data!.stock as number) > 0 ? "DISPONIBLE" : "AGOTADO"),
          tipo: "Cafeteria",
          vendedorId: req.user!.id,
        },
      });
      res
        .status(201)
        .json({
          message: "Producto registrado",
          product: conIdLegado(nuevoProducto),
        });
    } catch (error: any) {
      if (error instanceof ImagenError) {
        res.status(error.status).json({ message: error.message });
        return;
      }
      res.status(400).json({ message: "Error al crear", error: error.message });
    }
  },

  getMyItems: async (req: Request, res: Response): Promise<void> => {
    try {
      const productos = await prisma.product.findMany({
        where: { vendedorId: req.user!.id },
        orderBy: { created_at: "desc" },
      });
      res.json(listaConIdLegado(productos));
    } catch (error: any) {
      res.status(500).json({ message: "Error al cargar tus productos" });
    }
  },

  searchProducts: async (req: Request, res: Response): Promise<void> => {
    try {
      const q = ensureString(req.query.q as string)
        .trim()
        .slice(0, 50);
      const productos = await prisma.product.findMany({
        where: {
          tipo: "Cafeteria",
          OR: [
            { nombre: { contains: q, mode: "insensitive" } },
            { descripcion: { contains: q, mode: "insensitive" } },
          ],
        },
      });
      res.status(200).json(listaConIdLegado(productos));
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
      res.json(conIdLegado(producto));
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

      const canEdit =
        producto.vendedorId === req.user!.id ||
        (producto.tipo === "Cafeteria" && req.user!.rol === "A_C") ||
        (producto.tipo === "Marketplace" && req.user!.rol === "A");

      if (!canEdit) {
        res.status(403).json({ message: "No tienes permiso" });
        return;
      }

      const { data, error } = leerProducto(req.body, true);
      if (error) {
        res.status(400).json({ message: error });
        return;
      }
      if (data!.estado === undefined && typeof data!.stock === "number") {
        data!.estado = (data!.stock as number) > 0 ? "DISPONIBLE" : "AGOTADO";
      }
      if (data!.imagenUrl !== undefined) {
        data!.imagenUrl = await normalizarImagen(data!.imagenUrl, "producto", req.user!.id);
      }

      const actualizado = await prisma.product.update({
        where: { id },
        data: data as any,
      });
      res.json({
        message: "Actualizado con éxito",
        product: conIdLegado(actualizado),
      });
    } catch (error: any) {
      if (error instanceof ImagenError) {
        res.status(error.status).json({ message: error.message });
        return;
      }
      res
        .status(400)
        .json({ message: "Error al actualizar", error: error.message });
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

      const usado = await prisma.orderItem.count({ where: { productId: id } });
      if (usado > 0) {
        const retirado = await prisma.product.update({
          where: { id },
          data: { estado: "AGOTADO", stock: 0, esMenuBeca: false },
        });
        res.json({
          message:
            "El producto tiene pedidos en el historial; se marcó como agotado en lugar de eliminarse.",
          archivado: true,
          product: conIdLegado(retirado),
        });
        return;
      }

      await prisma.$transaction([
        prisma.recommendation.deleteMany({ where: { producto_base_id: id } }),
        prisma.product.delete({ where: { id } }),
      ]);
      res.json({ message: "Eliminado correctamente", archivado: false });
    } catch (error: any) {
      res.status(500).json({ message: "Error al eliminar" });
    }
  },
};
