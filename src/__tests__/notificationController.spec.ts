import { notificationController } from "../api/controllers/notificationController";
import prisma from "../lib/prismaClient";
import { Request, Response } from "express";

// Mock de prisma
jest.mock("../lib/prismaClient", () => ({
  notificacion: {
    findMany: jest.fn(),
    updateMany: jest.fn(),
  },
}));

describe("Notification Controller", () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;

  beforeEach(() => {
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    jest.clearAllMocks();
  });

  describe("getMisNotificaciones", () => {
    it("debería retornar 401 si no hay usuario", async () => {
      mockReq = { user: undefined };
      await notificationController.getMisNotificaciones(
        mockReq as Request,
        mockRes as Response,
      );
      expect(mockRes.status).toHaveBeenCalledWith(401);
    });

    it("debería retornar la lista de notificaciones", async () => {
      mockReq = { user: { id: "user1" } as any };
      const mockNotifs = [{ id: 1, mensaje: "Hola" }];
      (prisma.notificacion.findMany as jest.Mock).mockResolvedValue(mockNotifs);

      await notificationController.getMisNotificaciones(
        mockReq as Request,
        mockRes as Response,
      );

      expect(prisma.notificacion.findMany).toHaveBeenCalledWith({
        where: { userId: "user1" },
        orderBy: { fecha: "desc" },
      });
      expect(mockRes.json).toHaveBeenCalledWith(mockNotifs);
    });

    it("debería manejar errores del servidor", async () => {
      mockReq = { user: { id: "user1" } as any };
      (prisma.notificacion.findMany as jest.Mock).mockRejectedValue(
        new Error("DB Error"),
      );

      await notificationController.getMisNotificaciones(
        mockReq as Request,
        mockRes as Response,
      );
      expect(mockRes.status).toHaveBeenCalledWith(500);
    });
  });

  describe("marcarLeidas", () => {
    it("debería actualizar notificaciones a leidas", async () => {
      mockReq = { user: { id: "user1" } as any };
      (prisma.notificacion.updateMany as jest.Mock).mockResolvedValue({
        count: 1,
      });

      await notificationController.marcarLeidas(
        mockReq as Request,
        mockRes as Response,
      );

      expect(prisma.notificacion.updateMany).toHaveBeenCalledWith({
        where: { userId: "user1", leida: false },
        data: { leida: true },
      });
      expect(mockRes.json).toHaveBeenCalledWith({
        message: "Notificaciones actualizadas",
      });
    });

    it("debería manejar errores en la actualización", async () => {
      mockReq = { user: { id: "user1" } as any };
      (prisma.notificacion.updateMany as jest.Mock).mockRejectedValue(
        new Error("Update fail"),
      );

      await notificationController.marcarLeidas(
        mockReq as Request,
        mockRes as Response,
      );
      expect(mockRes.status).toHaveBeenCalledWith(500);
    });
  });
});
