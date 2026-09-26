import { Request, Response } from "express";
import prisma from "../../lib/prismaClient";
import { notificarUsuario } from "../../services/notificationService";

const pick = (...values: unknown[]): string | undefined => {
  for (const v of values) {
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return undefined;
};

const participantesSelect = { select: { id: true, nombre: true } } as const;
const productoSelect = {
  select: {
    id: true,
    titulo: true,
    imagenes: true,
    precio: true,
    estatus: true,
  },
} as const;

const serializarMensaje = (m: any) => ({ ...m, _id: m.id });

const serializarChat = (chat: any) => ({
  ...chat,
  mensajes: (chat.mensajes || []).map(serializarMensaje),
  _id: chat.id,
  messages: (chat.mensajes || []).map(serializarMensaje),
  producto_id: chat.producto,
  vendedor_id: chat.vendedorId,
  comprador_id: chat.compradorId,
});

export const chatController = {
  getOrCreateChat: async (req: Request, res: Response): Promise<void> => {
    try {
      const productoId = pick(req.body?.productoId, req.body?.producto_id);
      const compradorId = req.user!.id;

      if (!productoId) {
        res.status(400).json({ message: "Falta el artículo del Marketplace." });
        return;
      }

      const articulo = await prisma.market.findUnique({
        where: { id: productoId },
      });
      if (!articulo) {
        res.status(404).json({ message: "El artículo ya no existe." });
        return;
      }
      const vendedorId = articulo.vendedorId;

      if (compradorId === vendedorId) {
        res.status(400).json({ message: "Es tu propio producto" });
        return;
      }

      const include = {
        producto: productoSelect,
        comprador: participantesSelect,
        vendedor: participantesSelect,
        mensajes: { orderBy: { created_at: "asc" as const } },
      };

      let chat = await prisma.chat.findFirst({
        where: { compradorId, vendedorId, productoId },
        include,
      });

      if (!chat) {
        if (articulo.estatus !== "activo") {
          res
            .status(400)
            .json({ message: "Este artículo ya no está disponible." });
          return;
        }
        chat = await prisma.chat.create({
          data: { compradorId, vendedorId, productoId },
          include,
        });
      }

      res.json(serializarChat(chat));
    } catch (error: any) {
      res
        .status(500)
        .json({ message: "Error al abrir chat", error: error.message });
    }
  },

  sendMessage: async (req: Request, res: Response): Promise<void> => {
    try {
      const chatId = pick(req.body?.chatId, req.body?.chat_id);
      const texto = pick(
        req.body?.contenido,
        req.body?.text,
        req.body?.mensaje,
      );
      const senderId = req.user!.id;

      if (!chatId || !texto) {
        res.status(400).json({ message: "El mensaje no puede estar vacío." });
        return;
      }
      if (texto.length > 1000) {
        res
          .status(400)
          .json({ message: "El mensaje no puede superar 1000 caracteres." });
        return;
      }

      const chat = await prisma.chat.findFirst({
        where: {
          id: chatId,
          OR: [{ compradorId: senderId }, { vendedorId: senderId }],
        },
        include: { producto: { select: { titulo: true } } },
      });
      if (!chat) {
        res
          .status(404)
          .json({ message: "Chat no encontrado o acceso denegado" });
        return;
      }

      const [msg] = await prisma.$transaction([
        prisma.message.create({
          data: { chatId, sender_id: senderId, text: texto },
        }),
        prisma.chat.update({
          where: { id: chatId },
          data: { last_update: new Date() },
        }),
      ]);

      const destinatarioId =
        chat.compradorId === senderId ? chat.vendedorId : chat.compradorId;
      const io = req.app.get("io");
      const mensaje = serializarMensaje(msg);

      io?.to(destinatarioId).emit("nuevo_mensaje", {
        chatId,
        message: mensaje,
      });
      io?.to(destinatarioId).emit("receive_message", {
        chatId,
        senderId,
        text: msg.text,
        created_at: msg.created_at,
        message: mensaje,
      });

      const aviso = `💬 Nuevo mensaje sobre "${chat.producto?.titulo || "un artículo"}"`;
      const yaAvisado = await prisma.notificacion.findFirst({
        where: { userId: destinatarioId, leida: false, mensaje: aviso },
        select: { id: true },
      });
      if (!yaAvisado) notificarUsuario(io, destinatarioId, aviso, { chatId });

      res.json(mensaje);
    } catch (error: any) {
      res
        .status(500)
        .json({ message: "Error al enviar mensaje", error: error.message });
    }
  },

  getMyChats: async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user!.id;
      const chats = await prisma.chat.findMany({
        where: { OR: [{ compradorId: userId }, { vendedorId: userId }] },
        include: {
          producto: productoSelect,
          comprador: participantesSelect,
          vendedor: participantesSelect,
          mensajes: { orderBy: { created_at: "desc" }, take: 1 },
          _count: {
            select: {
              mensajes: { where: { read: false, sender_id: { not: userId } } },
            },
          },
        },
        orderBy: { last_update: "desc" },
      });

      res.json(
        chats.map(({ _count, ...chat }) => ({
          ...serializarChat(chat),
          noLeidos: _count.mensajes,
        })),
      );
    } catch (error: any) {
      res
        .status(500)
        .json({ message: "Error al cargar chats", error: error.message });
    }
  },

  getChatById: async (req: Request, res: Response): Promise<void> => {
    try {
      const { chat_id } = req.params;
      const chatId = Array.isArray(chat_id) ? chat_id[0] : chat_id;
      const userId = req.user!.id;

      const chat = await prisma.chat.findFirst({
        where: {
          id: chatId,
          OR: [{ compradorId: userId }, { vendedorId: userId }],
        },
        include: {
          producto: productoSelect,
          comprador: participantesSelect,
          vendedor: participantesSelect,
          mensajes: { orderBy: { created_at: "asc" } },
        },
      });

      if (!chat) {
        res
          .status(404)
          .json({ message: "Chat no encontrado o acceso denegado" });
        return;
      }

      await prisma.message.updateMany({
        where: { chatId, read: false, sender_id: { not: userId } },
        data: { read: true },
      });

      res.json(serializarChat(chat));
    } catch (error: any) {
      res
        .status(500)
        .json({ message: "Error al cargar el chat", error: error.message });
    }
  },
};
