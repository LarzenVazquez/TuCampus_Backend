import { Request, Response } from "express";
import prisma from "../../lib/prismaClient";
import crypto from "crypto";
import { MercadoPagoConfig, Preference } from "mercadopago";

const baseURL = process.env.FRONTEND_URL;

const getUserId = (req: Request): string => {
  const id = req.user?.id;
  return Array.isArray(id) ? id[0] : id || "";
};

export const orderController = {
  saveCart: async (req: Request, res: Response): Promise<void> => {
    try {
      const { items, total } = req.body;
      const userId = getUserId(req);

      const existingCart = await prisma.order.findFirst({
        where: { userId, status: "CARRITO" },
      });
      const cart = await prisma.order.upsert({
        where: {
          id: existingCart?.id ?? "none",
        },
        create: {
          userId,
          total,
          status: "CARRITO",
          items: { create: items },
        },
        update: {
          total,
          items: { deleteMany: {}, create: items },
        },
      });
      res.status(200).json({ message: "Carrito guardado", cart });
    } catch (error: any) {
      res
        .status(500)
        .json({ message: "Error al guardar", error: error.message });
    }
  },

  getCart: async (req: Request, res: Response): Promise<void> => {
    try {
      const cart = await prisma.order.findFirst({
        where: { userId: getUserId(req), status: "CARRITO" },
        include: { items: true },
      });
      res.json(cart || { items: [], total: 0 });
    } catch (error) {
      res.status(500).json({ message: "Error al obtener carrito" });
    }
  },

  checkout: async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = getUserId(req);
      const { metodoPago } = req.body;
      const cart = await prisma.order.findFirst({
        where: { userId, status: "CARRITO" },
        include: { items: true },
      });

      if (!cart || cart.items.length === 0) {
        res.status(400).json({ message: "No tienes un carrito activo" });
        return;
      }

      const order = await prisma.$transaction(async (tx) => {
        for (const item of cart.items) {
          await tx.product.update({
            where: { id: item.productId },
            data: { reservado: { decrement: item.cantidad } },
          });
        }
        return await tx.order.update({
          where: { id: cart.id },
          data: {
            status: "PAGADO",
            metodoPago: metodoPago || "Mercado Pago",
            qrCodeData:
              "QR-" + crypto.randomBytes(6).toString("hex").toUpperCase(),
            fecha: new Date(),
          },
        });
      });

      const io = req.app.get("io");
      io?.emit("nueva_orden_kds", {
        id: order.id,
        usuario: req.user?.nombre,
        total: order.total,
      });
      res.status(201).json({
        status: "success",
        qrData: order.qrCodeData,
        orderId: order.id,
      });
    } catch (error: any) {
      res
        .status(500)
        .json({ message: "Error en checkout", error: error.message });
    }
  },

  createPreference: async (req: Request, res: Response): Promise<void> => {
    try {
      const { items } = req.body;

      // Recalcular precios desde la BD, nunca confiar en el cliente (A08 OWASP)
      const productIds = items.map((i: any) => i.productId);
      const productosDB = await prisma.product.findMany({
        where: { id: { in: productIds } },
      });

      await prisma.$transaction(async (tx) => {
        for (const item of items) {
          const product = await tx.product.updateMany({
            where: { id: item.productId, stock: { gte: item.cantidad } },
            data: {
              stock: { decrement: item.cantidad },
              reservado: { increment: item.cantidad },
            },
          });
          if (product.count === 0)
            throw new Error(`Stock insuficiente para ${item.nombre}`);
        }
      });

      const client = new MercadoPagoConfig({
        accessToken: process.env.MP_ACCESS_TOKEN!,
      });
      const preference = new Preference(client);
      const result = await preference.create({
        body: {
          items: items.map((i: any) => {
            // Precio siempre de la BD, nunca del cliente
            const productoDB = productosDB.find((p) => p.id === i.productId);
            const precioReal = Number(productoDB?.precio || i.precio);
            return {
              title: i.nombre,
              unit_price: precioReal,
              quantity: i.cantidad,
              currency_id: "MXN",
            };
          }),
          back_urls: {
            success: `${baseURL}/store/confirmacion.html`,
            failure: `${baseURL}/store/carrito.html`,
            pending: `${baseURL}/store/carrito.html`,
          },
          auto_return: "approved",
        },
      });
      res.json({ id: result.id, url_pago: result.init_point });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  },

  markAsReady: async (req: Request, res: Response): Promise<void> => {
    const rawId = req.params.id;
    const orderId = Array.isArray(rawId) ? rawId[0] : rawId;

    if (!orderId) {
      res.status(400).json({ message: "ID no proporcionado" });
      return;
    }

    try {
      const order = await prisma.order.update({
        where: { id: orderId },
        data: { status: "LISTO" },
      });
      res.json({ message: "Orden lista", order });
    } catch (error) {
      res.status(500).json({ message: "Error al actualizar" });
    }
  },

  verifyOrder: async (req: Request, res: Response): Promise<void> => {
    try {
      const { qrData } = req.body;
      const order = await prisma.order.updateMany({
        where: { qrCodeData: qrData, status: { in: ["PAGADO", "LISTO"] } },
        data: { status: "ENTREGADO" },
      });
      res.json({ message: "Entrega confirmada" });
    } catch (error) {
      res.status(500).json({ message: "Error al verificar" });
    }
  },

  getPaidOrders: async (req: Request, res: Response): Promise<void> => {
    const orders = await prisma.order.findMany({ where: { status: "PAGADO" } });
    res.json(orders);
  },

  getMyOrders: async (req: Request, res: Response): Promise<void> => {
    const orders = await prisma.order.findMany({
      where: { userId: getUserId(req), status: { not: "CARRITO" } },
    });
    res.json(orders);
  },

  getGlobalStats: async (_req: Request, res: Response): Promise<void> => {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const [pedidos, ingresos, stock] = await Promise.all([
      prisma.order.count({ where: { fecha: { gte: hoy } } }),
      prisma.order.aggregate({ _sum: { total: true } }),
      prisma.product.count({ where: { stock: { lt: 5 } } }),
    ]);
    res.json({ pedidos, ingresos: ingresos._sum.total || 0, stock });
  },
};