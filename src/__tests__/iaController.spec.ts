const mockTrain = jest.fn();
const mockRun = jest.fn().mockReturnValue({ relevancia: 1 });

jest.mock("brain.js", () => ({
  __esModule: true,
  default: {
    NeuralNetwork: jest.fn().mockImplementation(() => ({
      train: mockTrain,
      run: mockRun,
    })),
  },
}));

jest.mock("../lib/prismaClient", () => ({
  product: { findMany: jest.fn() },
  recommendation: {
    deleteMany: jest.fn(),
    findMany: jest.fn(),
    upsert: jest.fn(),
  },
  $transaction: jest.fn().mockResolvedValue([]),
}));

import { iaController } from "../api/controllers/iaController";
import prisma from "../lib/prismaClient";
import { Request, Response } from "express";

describe("IA Controller", () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    mockReq = {
      query: {},
    };
  });

  describe("train", () => {
    it("debería entrenar y guardar recomendaciones con datos válidos y flujos alternativos", async () => {
      (prisma.product.findMany as jest.Mock).mockResolvedValue([
        {
          id: "p1",
          nombre: "Café",
          precio: 30,
          stock: 5,
          tipo: "Cafeteria",
          calorias: 50,
          categoria: "Bebidas",
          imagenUrl: "http://image.com",
        },
        {
          id: "p2",
          nombre: "Combo Pastel",
          precio: null,
          stock: 0,
          tipo: "Marketplace",
          calorias: 450,
          categoria: null,
          imagenUrl: null,
        },
      ]);

      await iaController.train(mockReq as Request, mockRes as Response);

      expect(mockTrain).toHaveBeenCalled();
      expect(prisma.$transaction).toHaveBeenCalled();
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({ status: "success", items: 2 }),
      );
    });

    it("debería retornar 404 si no hay productos disponibles", async () => {
      (prisma.product.findMany as jest.Mock).mockResolvedValue([]);

      await iaController.train(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: "No hay productos disponibles",
      });
    });

    it("debería manejar errores de base de datos o entrenamiento (500)", async () => {
      (prisma.product.findMany as jest.Mock).mockRejectedValue(
        new Error("Error de conexión"),
      );

      await iaController.train(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({ error: "Error de conexión" });
    });
  });

  describe("ask", () => {
    it("debería extraer el presupuesto del prompt numérico correctamente", async () => {
      mockReq.query = { prompt: "tengo un presupuesto de 150 pesos" };
      (prisma.recommendation.findMany as jest.Mock).mockResolvedValue([]);

      await iaController.ask(mockReq as Request, mockRes as Response);

      expect(prisma.recommendation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            producto: { precio: { lte: 150 } },
          }),
        }),
      );
      expect(mockRes.json).toHaveBeenCalledWith({ sugerencias: [] });
    });

    it("debería usar presupuesto por defecto (999) si el prompt no tiene números o está vacío", async () => {
      mockReq.query = { prompt: "recomiéndame algo rico" };
      (prisma.recommendation.findMany as jest.Mock).mockResolvedValue([]);

      await iaController.ask(mockReq as Request, mockRes as Response);

      expect(prisma.recommendation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            producto: { precio: { lte: 999 } },
          }),
        }),
      );
    });

    it("debería funcionar correctamente si el prompt es undefined", async () => {
      mockReq.query = { prompt: undefined as any };
      (prisma.recommendation.findMany as jest.Mock).mockResolvedValue([]);

      await iaController.ask(mockReq as Request, mockRes as Response);

      expect(prisma.recommendation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            producto: { precio: { lte: 999 } },
          }),
        }),
      );
    });

    it("debería manejar errores en la consulta de recomendaciones (500)", async () => {
      mockReq.query = { prompt: "error" };
      (prisma.recommendation.findMany as jest.Mock).mockRejectedValue(
        new Error("Error en query"),
      );

      await iaController.ask(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({ error: "Error en query" });
    });
  });

  describe("reset", () => {
    it("debería reiniciar la memoria de la IA y limpiar las recomendaciones", async () => {
      (prisma.recommendation.deleteMany as jest.Mock).mockResolvedValue({
        count: 0,
      });

      await iaController.reset(mockReq as Request, mockRes as Response);

      expect(prisma.recommendation.deleteMany).toHaveBeenCalled();
      expect(mockRes.json).toHaveBeenCalledWith({
        message: "Memoria de IA reiniciada.",
      });
    });

    it("debería manejar errores al reiniciar la memoria (500)", async () => {
      (prisma.recommendation.deleteMany as jest.Mock).mockRejectedValue(
        new Error("Error al borrar"),
      );

      await iaController.reset(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({ error: "Error al borrar" });
    });
  });

  describe("results", () => {
    it("debería retornar el mensaje de endpoint no implementado", async () => {
      await iaController.results(mockReq as Request, mockRes as Response);

      expect(mockRes.json).toHaveBeenCalledWith({
        message: "Endpoint no implementado aún",
      });
    });
  });
});
