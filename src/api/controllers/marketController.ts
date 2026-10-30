import { Request, Response } from "express";
import prisma from "../../lib/prismaClient";
import { conIdLegado, listaConIdLegado } from "../../lib/legacyAlias";
import { notificarUsuario } from "../../services/notificationService";
import { ImagenError, normalizarImagen } from "../../services/imageStorage";

const MAX_IMAGENES = 6;
const ESTATUS_VALIDOS = [
  "pendiente",
  "activo",
  "vendido",
  "rechazado",
  "bando",
];

const paramId = (req: Request) =>
  Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

const vendedorSelect = {
  vendedor: { select: { id: true, nombre: true } },
} as const;

const conVendedor = (item: any) =>
  conIdLegado({
    ...item,
    nombreVendedor: item.vendedor?.nombre?.split(" ")[0] ?? "Usuario",
  });

/** RNF-16: todas las imágenes del anuncio quedan como archivos propios. */
const imagenesPropias = async (
  data: Record<string, unknown>,
  userId: string,
) => {
  if (!Array.isArray(data.imagenes)) return;
  const rutas = [];
  for (const u of data.imagenes as string[])
    rutas.push(await normalizarImagen(u, "marketplace", userId));
  data.imagenes = Array.from(new Set(rutas.filter(Boolean)));
};

const leerAnuncio = (body: any, parcial = false) => {
  const data: Record<string, unknown> = {};

  if (body.titulo !== undefined || !parcial) {
    const titulo = typeof body.titulo === "string" ? body.titulo.trim() : "";
    if (titulo.length < 3 || titulo.length > 100)
      return { error: "El título debe tener entre 3 y 100 caracteres." };
    data.titulo = titulo;
  }
  if (body.precio !== undefined || !parcial) {
    const precio = Number(body.precio);
    if (!Number.isFinite(precio) || precio <= 0 || precio > 100000)
      return { error: "El precio debe ser un número mayor a 0." };
    data.precio = precio;
  }
  if (body.descripcion !== undefined || !parcial) {
    const descripcion =
      typeof body.descripcion === "string" ? body.descripcion.trim() : "";
    if (descripcion.length > 2000)
      return { error: "La descripción es demasiado larga." };
    data.descripcion = descripcion;
  }
  if (body.categoria !== undefined || !parcial) {
    const categoria =
      typeof body.categoria === "string" && body.categoria.trim()
        ? body.categoria.trim()
        : "Otros";
    data.categoria = categoria.slice(0, 50);
  }
  if (body.imagenes !== undefined || !parcial) {
    const imagenes = Array.isArray(body.imagenes)
      ? body.imagenes.filter((u: unknown) => typeof u === "string" && u.trim())
      : [];
    if (imagenes.length > MAX_IMAGENES)
      return { error: `Puedes subir como máximo ${MAX_IMAGENES} imágenes.` };
    data.imagenes = imagenes;
  }
  return { data };
};

export const marketController = {
  publishItem: async (req: Request, res: Response): Promise<void> => {
    try {
      const { data, error } = leerAnuncio(req.body);
      if (error) {
        res.status(400).json({ message: error });
        return;
      }
      await imagenesPropias(data!, req.user!.id);

      const nuevoItem = await prisma.market.create({
        data: {
          ...(data as any),
          vendedorId: req.user!.id,
          estatus: "pendiente",
        },
      });

      res.status(201).json({
        message: "Producto enviado a revisión. Estará visible pronto.",
        item: conIdLegado(nuevoItem),
      });
    } catch (error: any) {
      if (error instanceof ImagenError) {
        res.status(error.status).json({ message: error.message });
        return;
      }
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
        include: vendedorSelect,
      });

      res.json(items.map(conVendedor));
    } catch (error: any) {
      res
        .status(500)
        .json({ message: "Error al obtener productos", error: error.message });
    }
  },

  updateItem: async (req: Request, res: Response): Promise<void> => {
    try {
      const id = paramId(req);
      const { data, error } = leerAnuncio(req.body, true);
      if (error) {
        res.status(400).json({ message: error });
        return;
      }
      const propio = await prisma.market.count({
        where: { id, vendedorId: req.user!.id },
      });
      if (propio === 0) {
        res
          .status(404)
          .json({ message: "Producto no encontrado o no tienes permiso" });
        return;
      }
      await imagenesPropias(data!, req.user!.id);

      const soloVendido =
        req.body?.estatus === "vendido" && Object.keys(data!).length === 0;

      const item = await prisma.market.updateMany({
        where: { id, vendedorId: req.user!.id },
        data: soloVendido
          ? { estatus: "vendido" }
          : { ...(data as any), estatus: "pendiente", motivoRechazo: null },
      });

      if (item.count === 0) {
        res
          .status(404)
          .json({ message: "Producto no encontrado o no tienes permiso" });
        return;
      }

      res.json({
        message: soloVendido
          ? "Anuncio marcado como vendido"
          : "Producto actualizado y enviado a revisión",
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

  deleteItem: async (req: Request, res: Response): Promise<void> => {
    try {
      const id = paramId(req);
      const isAdmin = req.user!.rol === "A" || req.user!.rol === "A_C";
      const query = isAdmin ? { id } : { id, vendedorId: req.user!.id };

      const existe = await prisma.market.findFirst({
        where: query,
        select: { id: true },
      });
      if (!existe) {
        res.status(404).json({ message: "No se pudo eliminar el producto" });
        return;
      }

      await prisma.$transaction(async (tx) => {
        const chats = await tx.chat.findMany({
          where: { productoId: id },
          select: { id: true },
        });
        const chatIds = chats.map((c) => c.id);
        if (chatIds.length > 0) {
          await tx.message.deleteMany({ where: { chatId: { in: chatIds } } });
          await tx.chat.deleteMany({ where: { id: { in: chatIds } } });
        }
        await tx.market.delete({ where: { id } });
      });

      res.json({ message: "Producto eliminado correctamente" });
    } catch (error: any) {
      res
        .status(400)
        .json({ message: "Error al eliminar", error: error.message });
    }
  },

  moderateItem: async (req: Request, res: Response): Promise<void> => {
    try {
      const id = paramId(req);
      const { estatus, motivoRechazo } = req.body as {
        estatus?: string;
        motivoRechazo?: string;
      };

      if (!estatus || !ESTATUS_VALIDOS.includes(estatus)) {
        res.status(400).json({ message: "Estatus no válido." });
        return;
      }

      const item = await prisma.$transaction(async (tx) => {
        const actualizado = await tx.market.update({
          where: { id },
          data: {
            estatus,
            motivoRechazo:
              estatus === "rechazado"
                ? (motivoRechazo || "").slice(0, 300) || null
                : null,
          },
        });
        await tx.activityLog.create({
          data: {
            userId: req.user!.id,
            accion: `MARKET_${estatus.toUpperCase()}`,
            descripcion: `Moderó el anuncio "${actualizado.titulo}" -> ${estatus}${estatus === "rechazado" && motivoRechazo ? ` (${motivoRechazo})` : ""}`,
            ip_address: req.ip,
          },
        });
        return actualizado;
      });

      const mensajes: Record<string, string> = {
        activo: `Tu anuncio "${item.titulo}" fue aprobado y ya está visible.`,
        rechazado: `Tu anuncio "${item.titulo}" fue rechazado${item.motivoRechazo ? `: ${item.motivoRechazo}` : "."}`,
        bando: `Tu anuncio "${item.titulo}" fue suspendido por moderación.`,
      };
      if (mensajes[estatus])
        notificarUsuario(req.app.get("io"), item.vendedorId, mensajes[estatus]);

      res.json({
        message: `Estatus cambiado a ${estatus} correctamente`,
        item: conIdLegado(item),
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
        orderBy: { fechaPublicacion: "desc" },
      });
      res.json(listaConIdLegado(items));
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
        include: vendedorSelect,
      });
      res.json(items.map(conVendedor));
    } catch (error: any) {
      res.status(500).json({
        message: "Error al obtener productos pendientes",
        error: error.message,
      });
    }
  },

  getMarketStats: async (_req: Request, res: Response): Promise<void> => {
    try {
      const [pendientes, activos, vendidos, rechazados] = await Promise.all([
        prisma.market.count({ where: { estatus: "pendiente" } }),
        prisma.market.count({ where: { estatus: "activo" } }),
        prisma.market.count({ where: { estatus: "vendido" } }),
        prisma.market.count({ where: { estatus: "rechazado" } }),
      ]);
      res.json({ pendientes, activos, vendidos, rechazados });
    } catch (error: any) {
      res.status(500).json({ message: "Error en stats de market" });
    }
  },

  getItemById: async (req: Request, res: Response): Promise<void> => {
    try {
      const id = paramId(req);
      const item = await prisma.market.findUnique({
        where: { id },
        include: vendedorSelect,
      });

      const esDueno = item?.vendedorId === req.user?.id;
      const esStaff = req.user?.rol === "A" || req.user?.rol === "A_C";
      if (
        !item ||
        (item.estatus !== "activo" &&
          item.estatus !== "vendido" &&
          !esDueno &&
          !esStaff)
      ) {
        res.status(404).json({ message: "Producto no encontrado" });
        return;
      }
      res.json(conVendedor(item));
    } catch (error: any) {
      res
        .status(400)
        .json({ message: "Error al obtener el detalle", error: error.message });
    }
  },
};
