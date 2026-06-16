import { Request, Response } from "express";
import { marketController } from "../api/controllers/marketController";
import prisma from "../lib/prismaClient";

jest.mock("../lib/prismaClient", () => ({
  market: {
    create: jest.fn(),
    findMany: jest.fn(),
    updateMany: jest.fn(),
    deleteMany: jest.fn(),
    update: jest.fn(),
    findUnique: jest.fn(),
    count: jest.fn(),
  },
}));

describe("Market Controller", () => {
  let mockRes: Partial<Response>;

  beforeEach(() => {
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    jest.clearAllMocks();
  });

  // ─── publishItem ──────────────────────────────────────────────────────────

  it("publishItem: éxito con imagenes → 201", async () => {
    const nuevoItem = { id: "1", titulo: "Libro" };
    (prisma.market.create as jest.Mock).mockResolvedValue(nuevoItem);

    await marketController.publishItem(
      {
        body: {
          titulo: "Libro",
          precio: 50,
          descripcion: "Buen estado",
          categoria: "libros",
          imagenes: ["https://img.com/foto.jpg"],
        },
        user: { id: "u1" },
      } as any,
      mockRes as any,
    );

    expect(mockRes.status).toHaveBeenCalledWith(201);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({ item: nuevoItem }),
    );
  });

  it("publishItem: imagenes vacío → usa imagen por defecto", async () => {
    (prisma.market.create as jest.Mock).mockResolvedValue({ id: "1" });

    await marketController.publishItem(
      {
        body: {
          titulo: "Libro",
          precio: 50,
          descripcion: "Ok",
          categoria: "libros",
          imagenes: [],
        },
        user: { id: "u1" },
      } as any,
      mockRes as any,
    );

    const createCall = (prisma.market.create as jest.Mock).mock.calls[0][0];
    expect(createCall.data.imagenes).toEqual([
      "https://images.unsplash.com/photo-1526304640581-d334cdbbf45e",
    ]);
    expect(mockRes.status).toHaveBeenCalledWith(201);
  });

  it("publishItem: imagenes undefined → usa imagen por defecto", async () => {
    (prisma.market.create as jest.Mock).mockResolvedValue({ id: "1" });

    await marketController.publishItem(
      {
        body: { titulo: "X", precio: 10, descripcion: "Y", categoria: "Z" },
        user: { id: "u1" },
      } as any,
      mockRes as any,
    );

    const createCall = (prisma.market.create as jest.Mock).mock.calls[0][0];
    expect(createCall.data.imagenes).toEqual([
      "https://images.unsplash.com/photo-1526304640581-d334cdbbf45e",
    ]);
  });

  it("publishItem: error de BD → 400", async () => {
    (prisma.market.create as jest.Mock).mockRejectedValue(
      new Error("DB error"),
    );

    await marketController.publishItem(
      {
        body: { titulo: "X", precio: 10, descripcion: "Y", categoria: "Z" },
        user: { id: "u1" },
      } as any,
      mockRes as any,
    );

    expect(mockRes.status).toHaveBeenCalledWith(400);
  });

  // ─── getMarketItems ───────────────────────────────────────────────────────

  it("getMarketItems: éxito → lista con nombreVendedor", async () => {
    (prisma.market.findMany as jest.Mock).mockResolvedValue([
      {
        id: "1",
        titulo: "Libro",
        vendedor: { nombre: "Juan Pérez" },
      },
    ]);

    await marketController.getMarketItems({} as any, mockRes as any);

    expect(mockRes.json).toHaveBeenCalledWith([
      expect.objectContaining({ nombreVendedor: "Juan" }),
    ]);
  });

  it("getMarketItems: error → 500", async () => {
    (prisma.market.findMany as jest.Mock).mockRejectedValue(new Error("fallo"));

    await marketController.getMarketItems({} as any, mockRes as any);

    expect(mockRes.status).toHaveBeenCalledWith(500);
  });

  // ─── updateItem ───────────────────────────────────────────────────────────

  it("updateItem: éxito → mensaje ok", async () => {
    (prisma.market.updateMany as jest.Mock).mockResolvedValue({ count: 1 });

    await marketController.updateItem(
      {
        params: { id: "item1" },
        body: {
          titulo: "Nuevo",
          precio: 100,
          descripcion: "D",
          categoria: "C",
          imagenes: [],
        },
        user: { id: "u1" },
      } as any,
      mockRes as any,
    );

    expect(mockRes.json).toHaveBeenCalledWith({
      message: "Producto actualizado y enviado a revisión",
    });
  });

  it("updateItem: id como array → usa primer elemento", async () => {
    (prisma.market.updateMany as jest.Mock).mockResolvedValue({ count: 1 });

    await marketController.updateItem(
      {
        params: { id: ["item1", "item2"] },
        body: {
          titulo: "T",
          precio: 10,
          descripcion: "D",
          categoria: "C",
          imagenes: [],
        },
        user: { id: "u1" },
      } as any,
      mockRes as any,
    );

    const call = (prisma.market.updateMany as jest.Mock).mock.calls[0][0];
    expect(call.where.id).toBe("item1");
  });

  it("updateItem: count 0 → 404", async () => {
    (prisma.market.updateMany as jest.Mock).mockResolvedValue({ count: 0 });

    await marketController.updateItem(
      {
        params: { id: "item1" },
        body: {},
        user: { id: "u1" },
      } as any,
      mockRes as any,
    );

    expect(mockRes.status).toHaveBeenCalledWith(404);
  });

  it("updateItem: error → 400", async () => {
    (prisma.market.updateMany as jest.Mock).mockRejectedValue(
      new Error("fallo"),
    );

    await marketController.updateItem(
      {
        params: { id: "item1" },
        body: {},
        user: { id: "u1" },
      } as any,
      mockRes as any,
    );

    expect(mockRes.status).toHaveBeenCalledWith(400);
  });

  // ─── deleteItem ───────────────────────────────────────────────────────────

  it("deleteItem: vendedor elimina su propio item → éxito", async () => {
    (prisma.market.deleteMany as jest.Mock).mockResolvedValue({ count: 1 });

    await marketController.deleteItem(
      {
        params: { id: "item1" },
        user: { id: "u1", rol: "Al" },
      } as any,
      mockRes as any,
    );

    expect(mockRes.json).toHaveBeenCalledWith({
      message: "Producto eliminado correctamente",
    });
    // Verifica que la query incluye vendedorId (no es admin)
    const call = (prisma.market.deleteMany as jest.Mock).mock.calls[0][0];
    expect(call.where.vendedorId).toBe("u1");
  });

  it("deleteItem: admin puede eliminar cualquier item", async () => {
    (prisma.market.deleteMany as jest.Mock).mockResolvedValue({ count: 1 });

    await marketController.deleteItem(
      {
        params: { id: "item1" },
        user: { id: "admin1", rol: "A" },
      } as any,
      mockRes as any,
    );

    // Admin: query no incluye vendedorId
    const call = (prisma.market.deleteMany as jest.Mock).mock.calls[0][0];
    expect(call.where.vendedorId).toBeUndefined();
    expect(mockRes.json).toHaveBeenCalledWith({
      message: "Producto eliminado correctamente",
    });
  });

  it("deleteItem: rol A_C también es admin", async () => {
    (prisma.market.deleteMany as jest.Mock).mockResolvedValue({ count: 1 });

    await marketController.deleteItem(
      {
        params: { id: "item1" },
        user: { id: "admin2", rol: "A_C" },
      } as any,
      mockRes as any,
    );

    const call = (prisma.market.deleteMany as jest.Mock).mock.calls[0][0];
    expect(call.where.vendedorId).toBeUndefined();
  });

  it("deleteItem: id como array → usa primer elemento", async () => {
    (prisma.market.deleteMany as jest.Mock).mockResolvedValue({ count: 1 });

    await marketController.deleteItem(
      {
        params: { id: ["item1", "item2"] },
        user: { id: "u1", rol: "Al" },
      } as any,
      mockRes as any,
    );

    const call = (prisma.market.deleteMany as jest.Mock).mock.calls[0][0];
    expect(call.where.id).toBe("item1");
  });

  it("deleteItem: count 0 → 404", async () => {
    (prisma.market.deleteMany as jest.Mock).mockResolvedValue({ count: 0 });

    await marketController.deleteItem(
      {
        params: { id: "item1" },
        user: { id: "u1", rol: "Al" },
      } as any,
      mockRes as any,
    );

    expect(mockRes.status).toHaveBeenCalledWith(404);
  });

  it("deleteItem: error → 400", async () => {
    (prisma.market.deleteMany as jest.Mock).mockRejectedValue(
      new Error("fallo"),
    );

    await marketController.deleteItem(
      {
        params: { id: "item1" },
        user: { id: "u1", rol: "Al" },
      } as any,
      mockRes as any,
    );

    expect(mockRes.status).toHaveBeenCalledWith(400);
  });

  // ─── moderateItem ─────────────────────────────────────────────────────────

  it("moderateItem: éxito → mensaje con estatus", async () => {
    const item = { id: "1", estatus: "activo" };
    (prisma.market.update as jest.Mock).mockResolvedValue(item);

    await marketController.moderateItem(
      {
        params: { id: "item1" },
        body: { estatus: "activo", motivoRechazo: null },
      } as any,
      mockRes as any,
    );

    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "Estatus cambiado a activo correctamente",
      }),
    );
  });

  it("moderateItem: id como array → usa primer elemento", async () => {
    (prisma.market.update as jest.Mock).mockResolvedValue({ id: "1" });

    await marketController.moderateItem(
      {
        params: { id: ["item1", "item2"] },
        body: { estatus: "rechazado", motivoRechazo: "Inapropiado" },
      } as any,
      mockRes as any,
    );

    const call = (prisma.market.update as jest.Mock).mock.calls[0][0];
    expect(call.where.id).toBe("item1");
  });

  it("moderateItem: error → 400", async () => {
    (prisma.market.update as jest.Mock).mockRejectedValue(new Error("fallo"));

    await marketController.moderateItem(
      {
        params: { id: "item1" },
        body: { estatus: "activo" },
      } as any,
      mockRes as any,
    );

    expect(mockRes.status).toHaveBeenCalledWith(400);
  });

  // ─── getMyItems ───────────────────────────────────────────────────────────

  it("getMyItems: éxito → lista de items", async () => {
    const items = [{ id: "1" }, { id: "2" }];
    (prisma.market.findMany as jest.Mock).mockResolvedValue(items);

    await marketController.getMyItems(
      { user: { id: "u1" } } as any,
      mockRes as any,
    );

    expect(mockRes.json).toHaveBeenCalledWith(items);
  });

  it("getMyItems: error → 500", async () => {
    (prisma.market.findMany as jest.Mock).mockRejectedValue(new Error("fallo"));

    await marketController.getMyItems(
      { user: { id: "u1" } } as any,
      mockRes as any,
    );

    expect(mockRes.status).toHaveBeenCalledWith(500);
  });

  // ─── getPendingItems ──────────────────────────────────────────────────────

  it("getPendingItems: éxito → lista pendientes", async () => {
    const items = [{ id: "1", estatus: "pendiente" }];
    (prisma.market.findMany as jest.Mock).mockResolvedValue(items);

    await marketController.getPendingItems({} as any, mockRes as any);

    expect(mockRes.json).toHaveBeenCalledWith(items);
  });

  it("getPendingItems: error → 500", async () => {
    (prisma.market.findMany as jest.Mock).mockRejectedValue(new Error("fallo"));

    await marketController.getPendingItems({} as any, mockRes as any);

    expect(mockRes.status).toHaveBeenCalledWith(500);
  });

  // ─── getMarketStats ───────────────────────────────────────────────────────

  it("getMarketStats: éxito → pendientes y activos", async () => {
    (prisma.market.count as jest.Mock)
      .mockResolvedValueOnce(3) // pendientes
      .mockResolvedValueOnce(7); // activos

    await marketController.getMarketStats({} as any, mockRes as any);

    expect(mockRes.json).toHaveBeenCalledWith({ pendientes: 3, activos: 7 });
  });

  it("getMarketStats: error → 500", async () => {
    (prisma.market.count as jest.Mock).mockRejectedValue(new Error("fallo"));

    await marketController.getMarketStats({} as any, mockRes as any);

    expect(mockRes.status).toHaveBeenCalledWith(500);
  });

  // ─── getItemById ──────────────────────────────────────────────────────────

  it("getItemById: éxito → devuelve item", async () => {
    const item = { id: "item1", titulo: "Libro" };
    (prisma.market.findUnique as jest.Mock).mockResolvedValue(item);

    await marketController.getItemById(
      { params: { id: "item1" } } as any,
      mockRes as any,
    );

    expect(mockRes.json).toHaveBeenCalledWith(item);
  });

  it("getItemById: no encontrado → 404", async () => {
    (prisma.market.findUnique as jest.Mock).mockResolvedValue(null);

    await marketController.getItemById(
      { params: { id: "noexiste" } } as any,
      mockRes as any,
    );

    expect(mockRes.status).toHaveBeenCalledWith(404);
  });

  it("getItemById: id como array → usa primer elemento", async () => {
    const item = { id: "item1" };
    (prisma.market.findUnique as jest.Mock).mockResolvedValue(item);

    await marketController.getItemById(
      { params: { id: ["item1", "item2"] } } as any,
      mockRes as any,
    );

    const call = (prisma.market.findUnique as jest.Mock).mock.calls[0][0];
    expect(call.where.id).toBe("item1");
  });

  it("getItemById: error → 400", async () => {
    (prisma.market.findUnique as jest.Mock).mockRejectedValue(
      new Error("fallo"),
    );

    await marketController.getItemById(
      { params: { id: "item1" } } as any,
      mockRes as any,
    );

    expect(mockRes.status).toHaveBeenCalledWith(400);
  });
});
