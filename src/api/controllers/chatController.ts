import { Request, Response } from "express";
import prisma from "../../lib/prismaClient";

export const chatController = {
  getOrCreateChat: async (req: Request, res: Response): Promise<void> => {
    try {
      const { vendedor_id, producto_id } = req.body;
      const comprador_id = req.user.id;

      if (comprador_id === vendedor_id) {
        res.status(400).json({ message: "Es tu propio producto" });
        return;
      }

      let chat = await prisma.chat.findFirst({
        where: {
          compradorId: comprador_id,
          vendedorId: vendedor_id,
          productoId: producto_id,
        },
        include: {
          producto: { select: { nombre: true, imagenUrl: true, precio: true } },
        },
      });

      if (!chat) {
        chat = await prisma.chat.create({
          data: {
            compradorId: comprador_id,
            vendedorId: vendedor_id,
            productoId: producto_id,
          },
          include: {
            producto: {
              select: { nombre: true, imagenUrl: true, precio: true },
            },
          },
        });
      }

      res.json(chat);
    } catch (error: any) {
      res
        .status(500)
        .json({ message: "Error al abrir chat", error: error.message });
    }
  },

  sendMessage: async (req: Request, res: Response): Promise<void> => {
    try {
      const { chat_id, text } = req.body;
      const sender_id = req.user.id;

      const [msg] = await prisma.$transaction([
        prisma.message.create({
          data: { chatId: chat_id, sender_id, text },
        }),
        prisma.chat.update({
          where: { id: chat_id },
          data: { last_update: new Date() },
        }),
      ]);

      res.json(msg);
    } catch (error: any) {
      res
        .status(500)
        .json({ message: "Error al enviar mensaje", error: error.message });
    }
  },

  getMyChats: async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user.id;
      const chats = await prisma.chat.findMany({
        where: { OR: [{ compradorId: userId }, { vendedorId: userId }] },
        include: {
          producto: { select: { titulo: true, imagenes: true } },
        },
        orderBy: { last_update: "desc" },
      });

      res.json(chats);
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
      const userId = req.user.id;

      const chat = await prisma.chat.findFirst({
        where: {
          id: chatId,
          OR: [{ compradorId: userId }, { vendedorId: userId }],
        },
        include: {
          producto: { select: { titulo: true, imagenes: true, precio: true } },
          mensajes: { orderBy: { created_at: "asc" } },
        },
      });

      if (!chat) {
        res
          .status(404)
          .json({ message: "Chat no encontrado o acceso denegado" });
        return;
      }

      res.json(chat);
    } catch (error: any) {
      res
        .status(500)
        .json({ message: "Error al cargar el chat", error: error.message });
    }
  },
};
