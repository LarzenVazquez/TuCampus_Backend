import { chatController } from "../api/controllers/chatController";
import prisma from "../lib/prismaClient";
import { Request, Response } from "express";

// Mock del cliente de prisma
jest.mock("../lib/prismaClient", () => ({
  chat: {
    findFirst: jest.fn(),
    create: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
  },
  message: {
    create: jest.fn(),
  },
  $transaction: jest.fn(),
}));

describe("Chat Controller", () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;

  beforeEach(() => {
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    jest.clearAllMocks();
  });

  describe("getOrCreateChat", () => {
    it("debería devolver un chat existente", async () => {
      mockReq = {
        body: { vendedor_id: "v2", producto_id: "p1" },
        user: { id: "c1" } as any,
      };
      const mockChat = { id: "chat1", compradorId: "c1" };
      (prisma.chat.findFirst as jest.Mock).mockResolvedValue(mockChat);

      await chatController.getOrCreateChat(
        mockReq as Request,
        mockRes as Response,
      );

      expect(mockRes.json).toHaveBeenCalledWith(mockChat);
    });

    it("debería fallar si comprador es el mismo que vendedor", async () => {
      mockReq = {
        body: { vendedor_id: "c1", producto_id: "p1" },
        user: { id: "c1" } as any,
      };

      await chatController.getOrCreateChat(
        mockReq as Request,
        mockRes as Response,
      );

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        message: "Es tu propio producto",
      });
    });
  });

  describe("sendMessage", () => {
    it("debería enviar mensaje y actualizar chat usando transacciones", async () => {
      mockReq = {
        body: { chat_id: "chat1", text: "Hola" },
        user: { id: "c1" } as any,
      };
      const mockMsg = { id: "m1", text: "Hola" };
      (prisma.$transaction as jest.Mock).mockResolvedValue([
        mockMsg,
        { id: "chat1" },
      ]);

      await chatController.sendMessage(mockReq as Request, mockRes as Response);

      expect(mockRes.json).toHaveBeenCalledWith(mockMsg);
    });
  });

  describe("getMyChats", () => {
    it("debería listar los chats del usuario", async () => {
      mockReq = { user: { id: "u1" } as any };
      const mockChats = [{ id: "chat1" }];
      (prisma.chat.findMany as jest.Mock).mockResolvedValue(mockChats);

      await chatController.getMyChats(mockReq as Request, mockRes as Response);

      expect(mockRes.json).toHaveBeenCalledWith(mockChats);
    });
  });

  describe("getChatById", () => {
    it("debería retornar 404 si el chat no existe o no pertenece al usuario", async () => {
      mockReq = { params: { chat_id: "no-existe" }, user: { id: "u1" } as any };
      (prisma.chat.findFirst as jest.Mock).mockResolvedValue(null);

      await chatController.getChatById(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(404);
    });

    it("debería retornar el chat si existe", async () => {
      mockReq = { params: { chat_id: "chat1" }, user: { id: "u1" } as any };
      const mockChat = { id: "chat1", mensajes: [] };
      (prisma.chat.findFirst as jest.Mock).mockResolvedValue(mockChat);

      await chatController.getChatById(mockReq as Request, mockRes as Response);

      expect(mockRes.json).toHaveBeenCalledWith(mockChat);
    });
  });
  describe("Cobertura adicional para chatController", () => {
    it("getOrCreateChat: debería manejar errores (cobertura catch)", async () => {
      mockReq = { body: { vendedor_id: "v2" }, user: { id: "c1" } as any };
      (prisma.chat.findFirst as jest.Mock).mockRejectedValue(
        new Error("DB fail"),
      );

      await chatController.getOrCreateChat(
        mockReq as Request,
        mockRes as Response,
      );

      expect(mockRes.status).toHaveBeenCalledWith(500);
    });

    it("sendMessage: debería manejar errores (cobertura catch)", async () => {
      mockReq = { body: { chat_id: "1" }, user: { id: "1" } as any };
      (prisma.$transaction as jest.Mock).mockRejectedValue(
        new Error("Transacción fallida"),
      );

      await chatController.sendMessage(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(500);
    });

    it("getMyChats: debería manejar errores (cobertura catch)", async () => {
      mockReq = { user: { id: "1" } as any };
      (prisma.chat.findMany as jest.Mock).mockRejectedValue(
        new Error("DB fail"),
      );

      await chatController.getMyChats(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(500);
    });

    it("getChatById: debería manejar errores (cobertura catch)", async () => {
      mockReq = { params: { chat_id: "1" }, user: { id: "1" } as any };
      (prisma.chat.findFirst as jest.Mock).mockRejectedValue(
        new Error("DB fail"),
      );

      await chatController.getChatById(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(500);
    });

    it("getChatById: debería manejar caso de array en chat_id (cobertura de línea)", async () => {
      // Cobertura para: const chatId = Array.isArray(chat_id) ? chat_id[0] : chat_id;
      mockReq = { params: { chat_id: ["1"] as any }, user: { id: "1" } as any };
      (prisma.chat.findFirst as jest.Mock).mockResolvedValue(null);

      await chatController.getChatById(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(404);
    });
  });
  it("getOrCreateChat: debería retornar 400 si comprador es igual a vendedor", async () => {
    mockReq = {
      body: { vendedor_id: "user1", producto_id: "prod1" },
      user: { id: "user1" } as any, // Mismo ID
    };

    await chatController.getOrCreateChat(
      mockReq as Request,
      mockRes as Response,
    );

    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.json).toHaveBeenCalledWith({
      message: "Es tu propio producto",
    });
  });
});
