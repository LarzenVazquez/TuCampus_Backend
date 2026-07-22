import { Request, Response } from "express";
import prisma from "../../lib/prismaClient";
import crypto from "crypto";
import { MercadoPagoConfig, Preference } from "mercadopago";
import {
  evaluarSaturacionKDS,
  getUltimaMetricaKDS,
} from "../../services/kdsSaturationService";

interface AuthenticatedRequest extends Request {
  user?: { id: string; rol: string; email: string; nombre: string };
}

const baseURL = process.env.FRONTEND_URL;

const getUserId = (req: Request): string => {
  const id = req.user?.id;
  return Array.isArray(id) ? id[0] : id || "";
};

// --- Cálculo de tiempo estimado de preparación ---
// Heurística simple: la cocina prepara los distintos platillos en paralelo,
// así que se toma el tiempo del producto más tardado como base y se suma un
// pequeño colchón por cada artículo adicional (mismos cocineros, más pasos).
const calcularTiempoEstimado = (
  items: { productId: string; cantidad: number }[],
  productos: { id: string; tiempoPrepMin: number }[],
): number => {
  let base = 0;
  let totalArticulos = 0;

  for (const item of items) {
    const producto = productos.find((p) => p.id === item.productId);
    const tiempo = producto?.tiempoPrepMin ?? 8;
    base = Math.max(base, tiempo);
    totalArticulos += item.cantidad;
  }

  const colchon = Math.max(0, totalArticulos - 1) * 1.5;
  return Math.round(base + colchon);
};

export const orderController = {
  saveCart: async (req: Request, res: Response): Promise<Response> => {
    try {
      const { items, total } = req.body;
      const userId = getUserId(req);

      if (!userId) {
        return res.status(401).json({ message: "Usuario no identificado" });
      }

      if (!items || !Array.isArray(items) || items.length === 0) {
        return res
          .status(400)
          .json({ message: "La lista de items es inválida o está vacía" });
      }

      // 1. Obtener detalles de productos para cumplir con el esquema (nombre, precio)
      const productIds = items.map((i: any) => i.productId);
      const productosDB = await prisma.product.findMany({
        where: { id: { in: productIds } },
      });

      // 2. Mapear items con los datos requeridos por Prisma
      const itemsCompletos = items.map((item: any) => {
        const prod = productosDB.find((p) => p.id === item.productId);
        if (!prod)
          throw new Error(
            `Producto ${item.productId} no encontrado en catálogo`,
          );

        return {
          productId: item.productId,
          cantidad: item.cantidad,
          nombre: prod.nombre,
          precio: prod.precio,
        };
      });

      const existingCart = await prisma.order.findFirst({
        where: { userId, status: "CARRITO" },
      });

      let cart;
      if (existingCart) {
        // ACTUALIZAR EXISTENTE
        cart = await prisma.order.update({
          where: { id: existingCart.id },
          data: {
            total,
            items: {
              deleteMany: {},
              create: itemsCompletos,
            },
          },
        });
      } else {
        // CREAR NUEVO
        cart = await prisma.order.create({
          data: {
            userId,
            total,
            status: "CARRITO",
            items: { create: itemsCompletos },
          },
        });
      }

      return res.status(200).json({ message: "Carrito guardado", cart });
    } catch (error: any) {
      console.error("DEBUG ERROR SAVE CART:", error);
      return res
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

      const productos = await prisma.product.findMany({
        where: { id: { in: cart.items.map((i) => i.productId) } },
        select: { id: true, tiempoPrepMin: true },
      });
      const tiempoEstimadoMin = calcularTiempoEstimado(cart.items, productos);

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
            tiempoEstimadoMin,
          },
        });
      });

      const io = req.app.get("io");
      // Aviso global al KDS de cocina: llegó una orden nueva.
      io?.emit("nueva_orden_kds", {
        id: order.id,
        usuario: req.user?.nombre,
        total: order.total,
      });
      // Aviso dirigido SOLO al alumno dueño de la orden, para que su
      // tracker (barra de progreso) arranque en tiempo real sin polling.
      io?.to(userId).emit("order_status_update", {
        orderId: order.id,
        status: order.status,
        tipo: order.tipo,
        tiempoEstimadoMin: order.tiempoEstimadoMin,
        fecha: order.fecha,
      });

      // Nueva orden PAGADO => entra al KDS: recalcula lambda(t) de inmediato
      // en lugar de esperar al siguiente tick del cron (dO/dt en tiempo real).
      evaluarSaturacionKDS(io).catch((err) =>
        console.error("KDS Saturación (checkout):", err.message),
      );

      res.status(201).json({
        status: "success",
        qrData: order.qrCodeData,
        orderId: order.id,
        tiempoEstimadoMin,
      });
    } catch (error: any) {
      res
        .status(500)
        .json({ message: "Error en checkout", error: error.message });
    }
  },

  // --- Reclamo de beca alimenticia (gratuito, un consumo por día) ---
  // Importante: esto NO usa el carrito de compras normal. El alumno becado
  // solo puede reclamar el/los platillo(s) que la cocina marcó como
  // "menú de beca" (Product.esMenuBeca = true), nunca productos arbitrarios
  // del catálogo ni del marketplace.
  becaCheckout: async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = getUserId(req);
      const { productId } = req.body as { productId?: string };

      if (!productId) {
        res
          .status(400)
          .json({ message: "Selecciona un platillo del menú del día." });
        return;
      }

      const usuario = await prisma.user.findUnique({ where: { id: userId } });
      if (!usuario || !usuario.es_becado) {
        res.status(403).json({
          message: "Tu cuenta no cuenta con una beca alimenticia activa.",
        });
        return;
      }

      // Regla de negocio: un solo consumo de beca por día (CURRENT_DATE)
      const inicioDeHoy = new Date();
      inicioDeHoy.setHours(0, 0, 0, 0);
      const yaReclamoHoy = await prisma.order.findFirst({
        where: {
          userId,
          tipo: "Beca",
          status: { not: "CARRITO" },
          fecha: { gte: inicioDeHoy },
        },
      });
      if (yaReclamoHoy) {
        res.status(409).json({
          message: "Ya reclamaste tu beca alimenticia de hoy. Vuelve mañana.",
        });
        return;
      }

      const producto = await prisma.product.findUnique({
        where: { id: productId },
      });

      // El producto debe existir y estar explícitamente habilitado como
      // menú de beca por la cocina; así se bloquea cualquier intento de
      // reclamar algo fuera del menú del día autorizado.
      if (!producto || !producto.esMenuBeca || producto.tipo !== "Cafeteria") {
        res.status(403).json({
          message: "Ese producto no forma parte del menú de beca de hoy.",
        });
        return;
      }

      const tiempoEstimadoMin = producto.tiempoPrepMin;

      const order = await prisma.$transaction(async (tx) => {
        // Descuento de stock atómico y seguro ante concurrencia (no hay
        // reserva previa porque este flujo nunca pasa por Mercado Pago).
        const actualizado = await tx.product.updateMany({
          where: { id: producto.id, stock: { gte: 1 } },
          data: { stock: { decrement: 1 } },
        });
        if (actualizado.count === 0) {
          throw new Error("El menú de beca de hoy ya se agotó.");
        }

        return tx.order.create({
          data: {
            userId,
            status: "PAGADO",
            tipo: "Beca",
            metodoPago: "Beca alimenticia",
            total: 0,
            qrCodeData:
              "QR-" + crypto.randomBytes(6).toString("hex").toUpperCase(),
            fecha: new Date(),
            tiempoEstimadoMin,
            items: {
              create: {
                productId: producto.id,
                nombre: producto.nombre,
                cantidad: 1,
                precio: 0,
              },
            },
          },
        });
      });

      const io = req.app.get("io");
      io?.emit("nueva_orden_kds", {
        id: order.id,
        usuario: req.user?.nombre,
        total: 0,
        tipo: "Beca",
      });
      io?.to(userId).emit("order_status_update", {
        orderId: order.id,
        status: order.status,
        tipo: order.tipo,
        tiempoEstimadoMin: order.tiempoEstimadoMin,
        fecha: order.fecha,
      });

      // Reclamo de beca también entra a la cola del KDS: mismo tratamiento
      // que el checkout normal para el cómputo de lambda(t).
      evaluarSaturacionKDS(io).catch((err) =>
        console.error("KDS Saturación (becaCheckout):", err.message),
      );

      res.status(201).json({
        status: "success",
        qrData: order.qrCodeData,
        orderId: order.id,
        tiempoEstimadoMin,
      });
    } catch (error: any) {
      res
        .status(500)
        .json({ message: error.message || "Error al reclamar tu beca" });
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
        data: { status: "LISTO", fechaListo: new Date() },
      });

      // Notifica en tiempo real solo al alumno dueño de la orden.
      const io = req.app.get("io");
      io?.to(order.userId).emit("orden_lista", {
        orderId: order.id,
        mensaje: "¡Tu pedido está listo! Pasa a recogerlo a la cafetería.",
      });
      io?.to(order.userId).emit("order_status_update", {
        orderId: order.id,
        status: order.status,
        tipo: order.tipo,
        tiempoEstimadoMin: order.tiempoEstimadoMin,
        fecha: order.fecha,
      });

      // El A_C acaba de despachar una comanda (afecta mu): recalcula el
      // balance de flujo para levantar el aviso restrictivo si ya se alivió.
      evaluarSaturacionKDS(io).catch((err) =>
        console.error("KDS Saturación (markAsReady):", err.message),
      );

      res.json({ message: "Orden lista", order });
    } catch (error) {
      res.status(500).json({ message: "Error al actualizar" });
    }
  },

  verifyOrder: async (req: Request, res: Response): Promise<void> => {
    try {
      const { qrData } = req.body;

      const pedido = await prisma.order.findFirst({
        where: { qrCodeData: qrData, status: { in: ["PAGADO", "LISTO"] } },
      });
      if (!pedido) {
        res
          .status(404)
          .json({ message: "QR inválido o la orden ya fue entregada." });
        return;
      }

      const order = await prisma.order.update({
        where: { id: pedido.id },
        data: { status: "ENTREGADO", fechaEntregado: new Date() },
      });

      const io = req.app.get("io");
      io?.to(order.userId).emit("order_status_update", {
        orderId: order.id,
        status: order.status,
        tipo: order.tipo,
        tiempoEstimadoMin: order.tiempoEstimadoMin,
        fecha: order.fecha,
      });

      evaluarSaturacionKDS(io).catch((err) =>
        console.error("KDS Saturación (verifyOrder):", err.message),
      );

      res.json({ message: "Entrega confirmada" });
    } catch (error) {
      res.status(500).json({ message: "Error al verificar" });
    }
  },

  getOrdenActiva: async (req: Request, res: Response): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const userId = authReq.user?.id;
      if (!userId) {
        res.status(401).json({ message: "No autorizado" });
        return;
      }

      const orden = await prisma.order.findFirst({
        where: {
          userId,
          status: { notIn: ["ENTREGADO"] },
        },
        orderBy: { fecha: "desc" },
        include: {
          items: { include: { product: true } },
        },
      });

      if (!orden) {
        res.status(200).json({ ordenActiva: null });
        return;
      }

      res.status(200).json({ ordenActiva: orden });
    } catch (error: any) {
      res.status(500).json({
        message: "Error al obtener orden activa",
        error: error.message,
      });
    }
  },

  // Usada por el KDS de cocina (admin/kds.html). Necesita incluir `items`
  // porque cocinaController.js pinta cada platillo del ticket con
  // `pedido.items.map(...)` — sin este include, `items` llega undefined.
  getPaidOrders: async (req: Request, res: Response): Promise<void> => {
    const orders = await prisma.order.findMany({
      where: { status: "PAGADO" },
      include: { items: true },
      orderBy: { fecha: "asc" },
    });
    res.json(orders);
  },

  getMyOrders: async (req: Request, res: Response): Promise<void> => {
    const orders = await prisma.order.findMany({
      where: { userId: getUserId(req), status: { not: "CARRITO" } },
    });
    res.json(orders);
  },

  // --- Modelo matemático de saturación del KDS (dO/dt = lambda - mu) ---
  // Expone la métrica más reciente para alimentar un widget en el
  // dashboard del Administrador de Cocina. Si aún no hay ninguna corrida
  // en memoria (arranque en frío), fuerza un cálculo inmediato.
  getKdsMetrics: async (req: Request, res: Response): Promise<void> => {
    try {
      const io = req.app.get("io");
      const metrica = getUltimaMetricaKDS() ?? (await evaluarSaturacionKDS(io));
      res.json(metrica);
    } catch (error: any) {
      res.status(500).json({
        message: "Error al calcular métricas del KDS",
        error: error.message,
      });
    }
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