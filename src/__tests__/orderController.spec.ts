import { orderController } from "../api/controllers/orderController";
import prisma from "../lib/prismaClient";
import { Request, Response } from "express";

const mockTxProduct = {
  update: jest.fn(),
  updateMany: jest.fn(),
};

const mockTxOrder = {
  update: jest.fn(),
};

jest.mock("../lib/prismaClient", () => ({
  order: {
    findFirst: jest.fn(),
    upsert: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    count: jest.fn(),
    aggregate: jest.fn(),
    findMany: jest.fn(),
  },
  product: {
    update: jest.fn(),
    updateMany: jest.fn(),
    count: jest.fn(),
  },
  $transaction: jest.fn((cb) =>
    cb({
      product: mockTxProduct,
      order: mockTxOrder,
    }),
  ),
}));

jest.mock("mercadopago", () => ({
  MercadoPagoConfig: jest.fn(),
  Preference: jest.fn().mockImplementation(() => ({
    create: jest.fn().mockResolvedValue({ id: "mp-1", init_point: "url" }),
  })),
}));

describe("Order Controller", () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;

  beforeEach(() => {
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    mockReq = {
      user: { id: "u1", nombre: "Test" } as any,
      app: { get: jest.fn().mockReturnValue({ emit: jest.fn() }) } as any,
      body: {},
      params: {},
      query: {},
    };
    jest.clearAllMocks();
  });

  describe("saveCart", () => {
    it("debe guardar el carrito con un usuario con id normal (200)", async () => {
      mockReq.body = { items: [{ productId: "p1" }], total: 100 };
      (prisma.order.findFirst as jest.Mock).mockResolvedValue({ id: "cart1" });
      (prisma.order.upsert as jest.Mock).mockResolvedValue({
        id: "cart1",
        total: 100,
      });

      await orderController.saveCart(mockReq as Request, mockRes as Response);

      expect(prisma.order.upsert).toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(200);
    });

    it("debe guardar el carrito manejando un id en formato array e inexistencia de carrito previo (200)", async () => {
      mockReq.user = { id: ["u1-array"], nombre: "Test" } as any;
      mockReq.body = { items: [], total: 0 };
      (prisma.order.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.order.upsert as jest.Mock).mockResolvedValue({
        id: "cart2",
        total: 0,
      });

      await orderController.saveCart(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(200);
    });

    it("debe manejar error al guardar el carrito (500)", async () => {
      mockReq.body = { items: [] };
      (prisma.order.findFirst as jest.Mock).mockRejectedValue(
        new Error("DB Error"),
      );

      await orderController.saveCart(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(500);
    });
  });

  describe("getCart", () => {
    it("debe retornar el carrito activo si existe", async () => {
      const mockCart = { id: "c1", items: [] };
      (prisma.order.findFirst as jest.Mock).mockResolvedValue(mockCart);

      await orderController.getCart(mockReq as Request, mockRes as Response);

      expect(mockRes.json).toHaveBeenCalledWith(mockCart);
    });

    it("debe retornar objeto con valores por defecto si no hay carrito activo", async () => {
      (prisma.order.findFirst as jest.Mock).mockResolvedValue(null);

      await orderController.getCart(mockReq as Request, mockRes as Response);

      expect(mockRes.json).toHaveBeenCalledWith({ items: [], total: 0 });
    });

    it("debe manejar error al obtener el carrito (500)", async () => {
      (prisma.order.findFirst as jest.Mock).mockRejectedValue(
        new Error("Error"),
      );

      await orderController.getCart(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(500);
    });
  });

  describe("checkout", () => {
    it("debe fallar (400) si no hay un carrito activo o esta vacio", async () => {
      (prisma.order.findFirst as jest.Mock).mockResolvedValue(null);
      await orderController.checkout(mockReq as Request, mockRes as Response);
      expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    it("debe procesar el checkout con exito (201)", async () => {
      mockReq.body = { metodoPago: "Efectivo" };
      const mockCart = { id: "c1", items: [{ productId: "p1", cantidad: 2 }] };
      (prisma.order.findFirst as jest.Mock).mockResolvedValue(mockCart);
      mockTxOrder.update.mockResolvedValue({
        id: "o1",
        total: 100,
        qrCodeData: "QR-1234",
      });

      await orderController.checkout(mockReq as Request, mockRes as Response);

      expect(mockTxProduct.update).toHaveBeenCalled();
      expect(mockTxOrder.update).toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(201);
    });

    it("debe procesar el checkout con metodo de pago por defecto si no se envia", async () => {
      mockReq.body = {};
      const mockCart = { id: "c1", items: [{ productId: "p1", cantidad: 1 }] };
      (prisma.order.findFirst as jest.Mock).mockResolvedValue(mockCart);
      mockTxOrder.update.mockResolvedValue({
        id: "o1",
        total: 50,
        qrCodeData: "QR-5678",
      });

      await orderController.checkout(mockReq as Request, mockRes as Response);

      expect(mockTxOrder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ metodoPago: "Mercado Pago" }),
        }),
      );
    });

    it("debe manejar error en el proceso de checkout (500)", async () => {
      const mockCart = { id: "c1", items: [{ productId: "p1", cantidad: 2 }] };
      (prisma.order.findFirst as jest.Mock).mockResolvedValue(mockCart);
      mockTxOrder.update.mockRejectedValue(new Error("Transaction failed"));

      await orderController.checkout(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(500);
    });
  });

  describe("createPreference", () => {
    it("debe crear la preferencia de MercadoPago exitosamente", async () => {
      mockReq.body = {
        items: [{ productId: "p1", cantidad: 1, nombre: "Test", precio: 50 }],
      };
      mockTxProduct.updateMany.mockResolvedValue({ count: 1 });

      await orderController.createPreference(
        mockReq as Request,
        mockRes as Response,
      );

      expect(mockRes.json).toHaveBeenCalledWith({
        id: "mp-1",
        url_pago: "url",
      });
    });

    it("debe manejar error si count es 0 debido a stock insuficiente", async () => {
      mockReq.body = {
        items: [{ productId: "p1", cantidad: 1, nombre: "Test" }],
      };
      mockTxProduct.updateMany.mockResolvedValue({ count: 0 });

      await orderController.createPreference(
        mockReq as Request,
        mockRes as Response,
      );

      expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    it("debe manejar error general en la creacion de preferencia (400)", async () => {
      mockReq.body = { items: [] };
      (prisma.$transaction as jest.Mock).mockRejectedValueOnce(
        new Error("Connection Error"),
      );

      await orderController.createPreference(
        mockReq as Request,
        mockRes as Response,
      );

      expect(mockRes.status).toHaveBeenCalledWith(400);
    });
  });

  describe("markAsReady", () => {
    it("debe retornar 400 si el ID no es proporcionado", async () => {
      mockReq.params = { id: "" };

      await orderController.markAsReady(
        mockReq as Request,
        mockRes as Response,
      );

      expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    it("debe aceptar id como array y actualizar el estado a LISTO", async () => {
      mockReq.params = { id: ["o1-array"] as any };
      (prisma.order.update as jest.Mock).mockResolvedValue({
        id: "o1-array",
        status: "LISTO",
      });

      await orderController.markAsReady(
        mockReq as Request,
        mockRes as Response,
      );

      expect(prisma.order.update).toHaveBeenCalledWith({
        where: { id: "o1-array" },
        data: { status: "LISTO" },
      });
      expect(mockRes.json).toHaveBeenCalled();
    });

    it("debe manejar error al marcar como listo (500)", async () => {
      mockReq.params = { id: "o1" };
      (prisma.order.update as jest.Mock).mockRejectedValue(
        new Error("Update failed"),
      );

      await orderController.markAsReady(
        mockReq as Request,
        mockRes as Response,
      );

      expect(mockRes.status).toHaveBeenCalledWith(500);
    });
  });

  describe("verifyOrder", () => {
    it("debe marcar como entregado con exito", async () => {
      mockReq.body = { qrData: "QR-123" };
      (prisma.order.updateMany as jest.Mock).mockResolvedValue({ count: 1 });

      await orderController.verifyOrder(
        mockReq as Request,
        mockRes as Response,
      );

      expect(mockRes.json).toHaveBeenCalledWith({
        message: "Entrega confirmada",
      });
    });

    it("debe manejar error al verificar orden (500)", async () => {
      mockReq.body = { qrData: "QR-123" };
      (prisma.order.updateMany as jest.Mock).mockRejectedValue(
        new Error("Error verification"),
      );

      await orderController.verifyOrder(
        mockReq as Request,
        mockRes as Response,
      );

      expect(mockRes.status).toHaveBeenCalledWith(500);
    });
  });

  describe("getPaidOrders", () => {
    it("debe obtener ordenes con estado PAGADO", async () => {
      (prisma.order.findMany as jest.Mock).mockResolvedValue([
        { id: "o1", status: "PAGADO" },
      ]);

      await orderController.getPaidOrders(
        mockReq as Request,
        mockRes as Response,
      );

      expect(prisma.order.findMany).toHaveBeenCalledWith({
        where: { status: "PAGADO" },
      });
      expect(mockRes.json).toHaveBeenCalledWith([
        { id: "o1", status: "PAGADO" },
      ]);
    });
  });

  describe("getMyOrders", () => {
    it("debe obtener las ordenes del usuario autenticado excluyendo el carrito", async () => {
      (prisma.order.findMany as jest.Mock).mockResolvedValue([]);

      await orderController.getMyOrders(
        mockReq as Request,
        mockRes as Response,
      );

      expect(prisma.order.findMany).toHaveBeenCalledWith({
        where: { userId: "u1", status: { not: "CARRITO" } },
      });
    });

    it("debe funcionar asignando un string vacio si req.user no existe", async () => {
      mockReq.user = undefined;
      (prisma.order.findMany as jest.Mock).mockResolvedValue([]);

      await orderController.getMyOrders(
        mockReq as Request,
        mockRes as Response,
      );

      expect(prisma.order.findMany).toHaveBeenCalledWith({
        where: { userId: "", status: { not: "CARRITO" } },
      });
    });
  });

  describe("getGlobalStats", () => {
    it("debe retornar ingresos en 0 si el valor retornado por la agregacion es nulo", async () => {
      (prisma.order.count as jest.Mock).mockResolvedValue(5);
      (prisma.order.aggregate as jest.Mock).mockResolvedValue({
        _sum: { total: null },
      });
      (prisma.product.count as jest.Mock).mockResolvedValue(1);

      await orderController.getGlobalStats({} as Request, mockRes as Response);

      expect(mockRes.json).toHaveBeenCalledWith({
        pedidos: 5,
        ingresos: 0,
        stock: 1,
      });
    });
  });
});
