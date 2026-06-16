import { productController } from "../api/controllers/productController";
import prisma from "../lib/prismaClient";
import { Request, Response } from "express";

jest.mock("../lib/prismaClient", () => ({
  product: {
    findMany: jest.fn(),
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
}));

describe("Product Controller", () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;

  beforeEach(() => {
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    jest.clearAllMocks();
  });

  describe("getProducts", () => {
    it("debe retornar lista de productos (200)", async () => {
      (prisma.product.findMany as jest.Mock).mockResolvedValue([{ id: "1" }]);
      await productController.getProducts({} as Request, mockRes as Response);
      expect(mockRes.status).toHaveBeenCalledWith(200);
    });

    it("debe manejar error (500)", async () => {
      (prisma.product.findMany as jest.Mock).mockRejectedValue(
        new Error("DB Error"),
      );
      await productController.getProducts({} as Request, mockRes as Response);
      expect(mockRes.status).toHaveBeenCalledWith(500);
    });
  });

  describe("getProductsByCategory", () => {
    it("debe filtrar por categoria (200)", async () => {
      mockReq = { params: { cat: "Bebidas" } };
      (prisma.product.findMany as jest.Mock).mockResolvedValue([]);
      await productController.getProductsByCategory(
        mockReq as Request,
        mockRes as Response,
      );
      expect(prisma.product.findMany).toHaveBeenCalledWith({
        where: { categoria: "Bebidas", tipo: "Cafeteria" },
      });
    });

    it("debe manejar error (500)", async () => {
      mockReq = { params: { cat: "Bebidas" } };
      (prisma.product.findMany as jest.Mock).mockRejectedValue(
        new Error("DB Error"),
      );
      await productController.getProductsByCategory(
        mockReq as Request,
        mockRes as Response,
      );
      expect(mockRes.status).toHaveBeenCalledWith(500);
    });
  });

  describe("createProduct", () => {
    it("debe crear como Cafeteria si el rol es A_C (201)", async () => {
      mockReq = {
        body: { precio: "10", stock: "5", calorias: "100" },
        user: { id: "u1", rol: "A_C" } as any,
      };
      (prisma.product.create as jest.Mock).mockResolvedValue({});
      await productController.createProduct(
        mockReq as Request,
        mockRes as Response,
      );
      expect(mockRes.status).toHaveBeenCalledWith(201);
    });

    it("debe crear como Marketplace si el rol no es A_C", async () => {
      mockReq = {
        body: { precio: "10", stock: "5" },
        user: { id: "u1", rol: "A" } as any,
      };
      (prisma.product.create as jest.Mock).mockResolvedValue({});
      await productController.createProduct(
        mockReq as Request,
        mockRes as Response,
      );
      expect(prisma.product.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ tipo: "Marketplace" }),
        }),
      );
    });

    it("debe manejar error al crear (400)", async () => {
      mockReq = {
        body: { precio: "10", stock: "5" },
        user: { id: "u1", rol: "A_C" } as any,
      };
      (prisma.product.create as jest.Mock).mockRejectedValue(
        new Error("Bad Request"),
      );
      await productController.createProduct(
        mockReq as Request,
        mockRes as Response,
      );
      expect(mockRes.status).toHaveBeenCalledWith(400);
    });
  });

  describe("searchProducts", () => {
    it("debe retornar productos coincidentes (200)", async () => {
      mockReq = { query: { q: "cafe" } };
      (prisma.product.findMany as jest.Mock).mockResolvedValue([{ id: "1" }]);
      await productController.searchProducts(
        mockReq as Request,
        mockRes as Response,
      );
      expect(mockRes.status).toHaveBeenCalledWith(200);
    });

    it("debe manejar error en busqueda (500)", async () => {
      mockReq = { query: { q: "cafe" } };
      (prisma.product.findMany as jest.Mock).mockRejectedValue(new Error());
      await productController.searchProducts(
        mockReq as Request,
        mockRes as Response,
      );
      expect(mockRes.status).toHaveBeenCalledWith(500);
    });
  });

  describe("getProductById", () => {
    it("debe retornar el producto si existe (200)", async () => {
      mockReq = { params: { id: "1" } };
      (prisma.product.findUnique as jest.Mock).mockResolvedValue({ id: "1" });
      await productController.getProductById(
        mockReq as Request,
        mockRes as Response,
      );
      expect(mockRes.json).toHaveBeenCalledWith({ id: "1" });
    });

    it("debe retornar 404 si no existe", async () => {
      mockReq = { params: { id: "999" } };
      (prisma.product.findUnique as jest.Mock).mockResolvedValue(null);
      await productController.getProductById(
        mockReq as Request,
        mockRes as Response,
      );
      expect(mockRes.status).toHaveBeenCalledWith(404);
    });

    it("debe manejar error (500)", async () => {
      mockReq = { params: { id: "1" } };
      (prisma.product.findUnique as jest.Mock).mockRejectedValue(new Error());
      await productController.getProductById(
        mockReq as Request,
        mockRes as Response,
      );
      expect(mockRes.status).toHaveBeenCalledWith(500);
    });
  });

  describe("updateProduct", () => {
    it("debe actualizar el producto con exito si tiene permisos", async () => {
      mockReq = {
        params: { id: "1" },
        body: { nombre: "Editado" },
        user: { id: "owner", rol: "user" } as any,
      };
      (prisma.product.findUnique as jest.Mock).mockResolvedValue({
        id: "1",
        vendedorId: "owner",
        tipo: "Marketplace",
      });
      (prisma.product.update as jest.Mock).mockResolvedValue({ id: "1" });

      await productController.updateProduct(
        mockReq as Request,
        mockRes as Response,
      );
      expect(prisma.product.update).toHaveBeenCalled();
    });

    it("debe retornar 404 si el producto no existe", async () => {
      mockReq = { params: { id: "1" } };
      (prisma.product.findUnique as jest.Mock).mockResolvedValue(null);

      await productController.updateProduct(
        mockReq as Request,
        mockRes as Response,
      );
      expect(mockRes.status).toHaveBeenCalledWith(404);
    });

    it("debe negar acceso (403) si no es dueño ni admin", async () => {
      mockReq = {
        params: { id: "1" },
        user: { id: "other", rol: "user" } as any,
      };
      (prisma.product.findUnique as jest.Mock).mockResolvedValue({
        id: "1",
        vendedorId: "owner",
        tipo: "Marketplace",
      });

      await productController.updateProduct(
        mockReq as Request,
        mockRes as Response,
      );
      expect(mockRes.status).toHaveBeenCalledWith(403);
    });

    it("debe manejar error al actualizar (400)", async () => {
      mockReq = {
        params: { id: "1" },
        user: { id: "owner", rol: "user" } as any,
      };
      (prisma.product.findUnique as jest.Mock).mockResolvedValue({
        id: "1",
        vendedorId: "owner",
        tipo: "Marketplace",
      });
      (prisma.product.update as jest.Mock).mockRejectedValue(new Error());

      await productController.updateProduct(
        mockReq as Request,
        mockRes as Response,
      );
      expect(mockRes.status).toHaveBeenCalledWith(400);
    });
  });

  describe("deleteProduct", () => {
    it("debe eliminar si es admin (rol A)", async () => {
      mockReq = { params: { id: "1" }, user: { id: "admin", rol: "A" } as any };
      (prisma.product.findUnique as jest.Mock).mockResolvedValue({
        id: "1",
        vendedorId: "owner",
        tipo: "Marketplace",
      });

      await productController.deleteProduct(
        mockReq as Request,
        mockRes as Response,
      );
      expect(prisma.product.delete).toHaveBeenCalled();
    });

    it("debe retornar 404 si el producto no existe", async () => {
      mockReq = { params: { id: "1" } };
      (prisma.product.findUnique as jest.Mock).mockResolvedValue(null);

      await productController.deleteProduct(
        mockReq as Request,
        mockRes as Response,
      );
      expect(mockRes.status).toHaveBeenCalledWith(404);
    });

    it("debe negar acceso (403) si no tiene permisos para eliminar", async () => {
      mockReq = {
        params: { id: "1" },
        user: { id: "other", rol: "user" } as any,
      };
      (prisma.product.findUnique as jest.Mock).mockResolvedValue({
        id: "1",
        vendedorId: "owner",
        tipo: "Marketplace",
      });

      await productController.deleteProduct(
        mockReq as Request,
        mockRes as Response,
      );
      expect(mockRes.status).toHaveBeenCalledWith(403);
    });

    it("debe manejar error al eliminar (500)", async () => {
      mockReq = { params: { id: "1" }, user: { id: "admin", rol: "A" } as any };
      (prisma.product.findUnique as jest.Mock).mockResolvedValue({
        id: "1",
        vendedorId: "owner",
        tipo: "Marketplace",
      });
      (prisma.product.delete as jest.Mock).mockRejectedValue(new Error());

      await productController.deleteProduct(
        mockReq as Request,
        mockRes as Response,
      );
      expect(mockRes.status).toHaveBeenCalledWith(500);
    });
  });
});
