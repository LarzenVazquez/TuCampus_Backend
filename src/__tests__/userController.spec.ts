import { userController } from "../api/controllers/userController";
import prisma from "../lib/prismaClient";
import { Request, Response } from "express";

jest.mock("../lib/prismaClient", () => ({
  userFile: { findMany: jest.fn(), create: jest.fn() },
  activityLog: { create: jest.fn() },
  user: { update: jest.fn() },
  $transaction: jest.fn(),
}));

describe("User Controller", () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;

  beforeEach(() => {
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    jest.clearAllMocks();
  });

  describe("getProfileFiles", () => {
    it("debe retornar 401 si req.user no existe", async () => {
      mockReq = { user: undefined };
      await userController.getProfileFiles(
        mockReq as Request,
        mockRes as Response,
      );
      expect(mockRes.status).toHaveBeenCalledWith(401);
    });

    it("debe retornar archivos si el usuario es válido", async () => {
      mockReq = { user: { id: "u1" } as any };
      (prisma.userFile.findMany as jest.Mock).mockResolvedValue([{ id: "f1" }]);
      await userController.getProfileFiles(
        mockReq as Request,
        mockRes as Response,
      );
      expect(mockRes.json).toHaveBeenCalledWith([{ id: "f1" }]);
    });

    it("debe retornar 500 ante error de base de datos", async () => {
      mockReq = { user: { id: "u1" } as any };
      (prisma.userFile.findMany as jest.Mock).mockRejectedValue(
        new Error("DB Error"),
      );
      await userController.getProfileFiles(
        mockReq as Request,
        mockRes as Response,
      );
      expect(mockRes.status).toHaveBeenCalledWith(500);
    });
  });

  describe("uploadProfilePic", () => {
    it("debe registrar foto y log usando transaction", async () => {
      mockReq = {
        user: { id: "u1" } as any,
        body: { fileData: { fileName: "p.jpg", url: "url", hash: "h1" } },
        ip: "127.0.0.1",
      };
      (prisma.$transaction as jest.Mock).mockResolvedValue([{}, {}]);

      await userController.uploadProfilePic(
        mockReq as Request,
        mockRes as Response,
      );
      expect(prisma.$transaction).toHaveBeenCalled();
      expect(mockRes.json).toHaveBeenCalledWith({
        message: "Foto actualizada y registrada exitosamente",
      });
    });

    it("debe retornar 500 si la transacción falla", async () => {
      mockReq = { user: { id: "u1" } as any, body: { fileData: {} } };
      (prisma.$transaction as jest.Mock).mockRejectedValue(
        new Error("Transacción fallida"),
      );
      await userController.uploadProfilePic(
        mockReq as Request,
        mockRes as Response,
      );
      expect(mockRes.status).toHaveBeenCalledWith(500);
    });
  });

  describe("updateProfile", () => {
    it("debe actualizar el nombre del usuario correctamente", async () => {
      mockReq = { user: { id: "u1" } as any, body: { nombre: "Nuevo Nombre" } };
      (prisma.user.update as jest.Mock).mockResolvedValue({});

      await userController.updateProfile(
        mockReq as Request,
        mockRes as Response,
      );
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "u1" },
          data: { nombre: "Nuevo Nombre" },
        }),
      );
      expect(mockRes.status).toHaveBeenCalledWith(200);
    });

    it("debe retornar 500 ante error al actualizar", async () => {
      mockReq = { user: { id: "u1" } as any, body: { nombre: "Error" } };
      (prisma.user.update as jest.Mock).mockRejectedValue(
        new Error("Update fail"),
      );
      await userController.updateProfile(
        mockReq as Request,
        mockRes as Response,
      );
      expect(mockRes.status).toHaveBeenCalledWith(500);
    });
  });
});
