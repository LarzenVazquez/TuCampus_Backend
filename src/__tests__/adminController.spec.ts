import { Request, Response } from "express";
import { adminController } from "../api/controllers/adminController";
import prisma from "../lib/prismaClient";

jest.mock("../lib/prismaClient", () => ({
  user: {
    findMany: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
  activityLog: { create: jest.fn(), findMany: jest.fn() },
  $transaction: jest.fn(),
}));

describe("Admin Controller", () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;

  beforeEach(() => {
    mockRes = { json: jest.fn(), status: jest.fn().mockReturnThis() };
    mockReq = {
      user: { id: "admin-id" } as any,
      ip: "127.0.0.1",
      params: {},
      body: {},
    };
    jest.clearAllMocks();
  });

  describe("getUsers", () => {
    it("debería obtener usuarios", async () => {
      (prisma.user.findMany as jest.Mock).mockResolvedValue([{ id: "1" }]);
      await adminController.getUsers(mockReq as Request, mockRes as Response);
      expect(mockRes.json).toHaveBeenCalled();
    });
    it("debería manejar error 500", async () => {
      (prisma.user.findMany as jest.Mock).mockRejectedValue(new Error("Err"));
      await adminController.getUsers(mockReq as Request, mockRes as Response);
      expect(mockRes.status).toHaveBeenCalledWith(500);
    });
  });

  describe("updateUserStatus", () => {
    it("debería fallar con rol no válido", async () => {
      mockReq.body = { rol: "INVALIDO" };
      await adminController.updateUserStatus(
        mockReq as Request,
        mockRes as Response,
      );
      expect(mockRes.status).toHaveBeenCalledWith(400);
    });
    it("debería actualizar exitosamente", async () => {
      mockReq.params = { id: "1" };
      mockReq.body = { rol: "Al", verificado: true };
      (prisma.$transaction as jest.Mock).mockResolvedValue([{}, {}]);
      await adminController.updateUserStatus(
        mockReq as Request,
        mockRes as Response,
      );
      expect(mockRes.json).toHaveBeenCalledWith({
        message: "Usuario actualizado exitosamente",
      });
    });
    it("debería fallar transacción", async () => {
      mockReq.params = { id: "1" };
      mockReq.body = { rol: "Al" };
      (prisma.$transaction as jest.Mock).mockRejectedValue(new Error("Err"));
      await adminController.updateUserStatus(
        mockReq as Request,
        mockRes as Response,
      );
      expect(mockRes.status).toHaveBeenCalledWith(500);
    });
  });

  describe("verifySeller", () => {
    it("debería verificar vendedor", async () => {
      mockReq.params = { id: "1" };
      (prisma.$transaction as jest.Mock).mockResolvedValue([{}, {}]);
      await adminController.verifySeller(
        mockReq as Request,
        mockRes as Response,
      );
      expect(mockRes.json).toHaveBeenCalled();
    });
    it("debería fallar transacción", async () => {
      (prisma.$transaction as jest.Mock).mockRejectedValue(new Error("Err"));
      await adminController.verifySeller(
        mockReq as Request,
        mockRes as Response,
      );
      expect(mockRes.status).toHaveBeenCalledWith(500);
    });
  });

  describe("getLogs", () => {
    it("debería retornar logs", async () => {
      (prisma.activityLog.findMany as jest.Mock).mockResolvedValue([]);
      await adminController.getLogs(mockReq as Request, mockRes as Response);
      expect(mockRes.json).toHaveBeenCalled();
    });
    it("debería fallar al obtener logs", async () => {
      (prisma.activityLog.findMany as jest.Mock).mockRejectedValue(
        new Error("Err"),
      );
      await adminController.getLogs(mockReq as Request, mockRes as Response);
      expect(mockRes.status).toHaveBeenCalledWith(500);
    });
  });

  describe("deleteUser", () => {
    it("debería eliminar usuario (manejo array)", async () => {
      mockReq.params = { id: ["1"] as any };
      (prisma.$transaction as jest.Mock).mockResolvedValue([{}, {}]);
      await adminController.deleteUser(mockReq as Request, mockRes as Response);
      expect(mockRes.json).toHaveBeenCalledWith({
        message: "Usuario eliminado del sistema",
      });
    });
    it("debería fallar borrado", async () => {
      (prisma.$transaction as jest.Mock).mockRejectedValue(new Error("Err"));
      await adminController.deleteUser(mockReq as Request, mockRes as Response);
      expect(mockRes.status).toHaveBeenCalledWith(500);
    });
  });

  describe("getStats", () => {
    it("debería retornar conteo", async () => {
      (prisma.user.count as jest.Mock).mockResolvedValue(10);
      await adminController.getStats(mockReq as Request, mockRes as Response);
      expect(mockRes.json).toHaveBeenCalledWith({ usuariosTotal: 10 });
    });
    it("debería fallar estadísticas", async () => {
      (prisma.user.count as jest.Mock).mockRejectedValue(new Error("Err"));
      await adminController.getStats(mockReq as Request, mockRes as Response);
      expect(mockRes.status).toHaveBeenCalledWith(500);
    });
  });
});
