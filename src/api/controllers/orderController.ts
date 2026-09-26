import { Request, Response } from "express";
import prisma from "../../lib/prismaClient";
import crypto from "crypto";
import { MercadoPagoConfig, Preference, Payment } from "mercadopago";
import {
  evaluarSaturacionKDS,
  getUltimaMetricaKDS,
} from "../../services/kdsSaturationService";
import { notificarUsuario } from "../../services/notificationService";
import {
  resolveFrontendBase,
  frontendPaths,
  safeRelativePath,
} from "../../lib/appConfig";

const getUserId = (req: Request): string => {
  const id = req.user?.id;
  return Array.isArray(id) ? id[0] : id || "";
};

const paramId = (req: Request): string => {
  const raw = req.params.id;
  return Array.isArray(raw) ? raw[0] : raw;
};

const nuevoCodigoQR = () =>
  "QR-" + crypto.randomBytes(6).toString("hex").toUpperCase();

const mpClient = () =>
  process.env.MP_ACCESS_TOKEN
    ? new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN })
    : null;

const ESTADOS_ACTIVOS = ["PAGADO", "LISTO"];

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

const emitirEstado = (req: Request, order: any) => {
  req.app.get("io")?.to(order.userId).emit("order_status_update", {
    orderId: order.id,
    status: order.status,
    tipo: order.tipo,
    tiempoEstimadoMin: order.tiempoEstimadoMin,
    fecha: order.fecha,
    fechaListo: order.fechaListo,
    fechaEntregado: order.fechaEntregado,
  });
};

const recalcularKDS = (req: Request, origen: string) =>
  evaluarSaturacionKDS(req.app.get("io")).catch((err) =>
    console.error(`KDS Saturación (${origen}):`, err.message),
  );

const includeOrdenCompleta = {
  items: true,
  user: { select: { id: true, nombre: true } },
} as const;

const serializarOrden = (order: any) => {
  if (!order) return order;
  const { user, ...resto } = order;
  return {
    ...resto,
    usuario: user?.nombre,
    usuarioNombre: user?.nombre,
  };
};

const serializarCarrito = (cart: any) => ({
  id: cart?.id ?? null,
  total: Number(cart?.total ?? 0),
  items: (cart?.items || []).map((i: any) => ({
    productId: i.productId,
    nombre: i.nombre,
    precio: Number(i.precio),
    cantidad: i.cantidad,
    imagenUrl: i.product?.imagenUrl ?? null,
    stock: i.product?.stock ?? null,
    estado: i.product?.estado ?? null,
  })),
});

export const orderController = {
  saveCart: async (req: Request, res: Response): Promise<Response> => {
    try {
      const { items } = req.body as { items?: any[] };
      const userId = getUserId(req);

      if (!userId) {
        return res.status(401).json({ message: "Usuario no identificado" });
      }
      if (!Array.isArray(items)) {
        return res
          .status(400)
          .json({ message: "La lista de items es inválida" });
      }

      const cantidades = new Map<string, number>();
      for (const item of items) {
        const productId =
          typeof item?.productId === "string" ? item.productId : null;
        const cantidad = Math.trunc(Number(item?.cantidad));
        if (
          !productId ||
          !Number.isFinite(cantidad) ||
          cantidad < 1 ||
          cantidad > 50
        ) {
          return res
            .status(400)
            .json({ message: "Hay un artículo con cantidad inválida." });
        }
        cantidades.set(productId, (cantidades.get(productId) || 0) + cantidad);
      }

      const productosDB = await prisma.product.findMany({
        where: { id: { in: [...cantidades.keys()] }, tipo: "Cafeteria" },
      });

      const itemsCompletos = [...cantidades.entries()].map(
        ([productId, cantidad]) => {
          const prod = productosDB.find((p) => p.id === productId);
          if (!prod)
            throw new Error(
              `Un producto de tu carrito ya no existe en el catálogo.`,
            );
          return {
            productId,
            cantidad,
            nombre: prod.nombre,
            precio: prod.precio,
          };
        },
      );

      const total = itemsCompletos.reduce(
        (acc, i) => acc + Number(i.precio) * i.cantidad,
        0,
      );

      const existingCart = await prisma.order.findFirst({
        where: { userId, status: "CARRITO" },
      });
      const cart = existingCart
        ? await prisma.order.update({
            where: { id: existingCart.id },
            data: { total, items: { deleteMany: {}, create: itemsCompletos } },
            include: { items: { include: { product: true } } },
          })
        : await prisma.order.create({
            data: {
              userId,
              total,
              status: "CARRITO",
              items: { create: itemsCompletos },
            },
            include: { items: { include: { product: true } } },
          });

      return res
        .status(200)
        .json({ message: "Carrito guardado", cart: serializarCarrito(cart) });
    } catch (error: any) {
      console.error("DEBUG ERROR SAVE CART:", error);
      return res
        .status(400)
        .json({
          message: error.message || "Error al guardar",
          error: error.message,
        });
    }
  },

  getCart: async (req: Request, res: Response): Promise<void> => {
    try {
      const cart = await prisma.order.findFirst({
        where: { userId: getUserId(req), status: "CARRITO" },
        include: { items: { include: { product: true } } },
      });
      res.json(serializarCarrito(cart));
    } catch (error) {
      res.status(500).json({ message: "Error al obtener carrito" });
    }
  },
  createPreference: async (req: Request, res: Response): Promise<void> => {
    const userId = getUserId(req);
    const { items } = req.body as { items: any[] };
    const reservados: { productId: string; cantidad: number }[] = [];

    try {
      const client = mpClient();
      if (!client) {
        res
          .status(503)
          .json({
            message:
              "El pago con Mercado Pago no está configurado en el servidor.",
          });
        return;
      }
      const productIds = items.map((i: any) => i.productId);
      const productosDB = await prisma.product.findMany({
        where: { id: { in: productIds } },
      });

      await prisma.$transaction(async (tx) => {
        for (const item of items) {
          const cantidad = Math.trunc(Number(item.cantidad));
          const product = await tx.product.updateMany({
            where: { id: item.productId, stock: { gte: cantidad } },
            data: {
              stock: { decrement: cantidad },
              reservado: { increment: cantidad },
            },
          });
          if (product.count === 0) {
            const nombre =
              productosDB.find((p) => p.id === item.productId)?.nombre ||
              item.nombre;
            throw new Error(`Stock insuficiente para ${nombre}`);
          }
          reservados.push({ productId: item.productId, cantidad });
        }
      });

      const base = resolveFrontendBase(req);
      const rutas = (req.body?.returnPaths || {}) as Record<string, unknown>;
      const success = safeRelativePath(
        rutas.success,
        frontendPaths.paymentSuccess,
      );
      const failure = safeRelativePath(
        rutas.failure,
        frontendPaths.paymentFailure,
      );
      const pending = safeRelativePath(rutas.pending, failure);

      const cart = await prisma.order.findFirst({
        where: { userId, status: "CARRITO" },
        select: { id: true },
      });

      const preference = new Preference(client);
      const result = await preference.create({
        body: {
          items: items.map((i: any) => {
            const productoDB = productosDB.find((p) => p.id === i.productId);
            return {
              id: i.productId,
              title: productoDB?.nombre || i.nombre,
              unit_price: Number(productoDB?.precio ?? 0),
              quantity: Math.trunc(Number(i.cantidad)),
              currency_id: "MXN",
            };
          }),
          external_reference: cart?.id,
          back_urls: {
            success: `${base}${success}`,
            failure: `${base}${failure}`,
            pending: `${base}${pending}`,
          },
          auto_return: "approved",
        },
      });

      res.json({
        id: result.id,
        preferenceId: result.id,
        url_pago: result.init_point,
        init_point: result.init_point,
      });
    } catch (error: any) {
      if (reservados.length > 0) {
        await prisma
          .$transaction(
            reservados.map((r) =>
              prisma.product.update({
                where: { id: r.productId },
                data: {
                  stock: { increment: r.cantidad },
                  reservado: { decrement: r.cantidad },
                },
              }),
            ),
          )
          .catch((e) =>
            console.error("No se pudo liberar la reserva:", e.message),
          );
      }
      res.status(400).json({ message: error.message });
    }
  },

  checkout: async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = getUserId(req);
      const { metodoPago } = req.body;
      const paymentId = req.body?.paymentId ?? req.body?.payment_id;

      const cart = await prisma.order.findFirst({
        where: { userId, status: "CARRITO" },
        include: { items: true },
      });

      if (!cart || cart.items.length === 0) {
        const hace15min = new Date(Date.now() - 15 * 60 * 1000);
        const reciente = await prisma.order.findFirst({
          where: {
            userId,
            tipo: "Normal",
            status: { in: ESTADOS_ACTIVOS },
            fecha: { gte: hace15min },
          },
          orderBy: { fecha: "desc" },
          include: { items: true },
        });
        if (reciente) {
          res.status(200).json({
            status: "success",
            yaProcesada: true,
            qrData: reciente.qrCodeData,
            orderId: reciente.id,
            tiempoEstimadoMin: reciente.tiempoEstimadoMin,
            total: Number(reciente.total),
            order: reciente,
          });
          return;
        }
        res.status(400).json({ message: "No tienes un carrito activo" });
        return;
      }

      if (paymentId) {
        const client = mpClient();
        if (client) {
          try {
            const pago = await new Payment(client).get({
              id: String(paymentId),
            });
            if (pago.status !== "approved") {
              res
                .status(402)
                .json({ message: "Mercado Pago no ha aprobado este pago." });
              return;
            }
          } catch {
            res
              .status(400)
              .json({
                message: "No se pudo verificar el pago con Mercado Pago.",
              });
            return;
          }
        }
      }

      const productos = await prisma.product.findMany({
        where: { id: { in: cart.items.map((i) => i.productId) } },
        select: { id: true, tiempoPrepMin: true },
      });
      const tiempoEstimadoMin = calcularTiempoEstimado(cart.items, productos);

      const order = await prisma.$transaction(async (tx) => {
        for (const item of cart.items) {
          const liberado = await tx.product.updateMany({
            where: { id: item.productId, reservado: { gte: item.cantidad } },
            data: { reservado: { decrement: item.cantidad } },
          });
          if (liberado.count === 0) {
            const descontado = await tx.product.updateMany({
              where: { id: item.productId, stock: { gte: item.cantidad } },
              data: { stock: { decrement: item.cantidad } },
            });
            if (descontado.count === 0) {
              throw new Error(`Stock insuficiente para ${item.nombre}`);
            }
          }
        }
        return await tx.order.update({
          where: { id: cart.id },
          data: {
            status: "PAGADO",
            metodoPago: metodoPago || "Mercado Pago",
            qrCodeData: nuevoCodigoQR(),
            fecha: new Date(),
            tiempoEstimadoMin,
          },
          include: includeOrdenCompleta,
        });
      });

      await prisma.product.updateMany({
        where: {
          id: { in: cart.items.map((i) => i.productId) },
          stock: { lte: 0 },
        },
        data: { estado: "AGOTADO" },
      });

      const io = req.app.get("io");
      io?.emit("nueva_orden_kds", {
        ...serializarOrden(order),
        usuario: order.user?.nombre || req.user?.nombre,
      });
      emitirEstado(req, order);
      recalcularKDS(req, "checkout");

      res.status(201).json({
        status: "success",
        qrData: order.qrCodeData,
        orderId: order.id,
        tiempoEstimadoMin,
        total: Number(order.total),
        order: serializarOrden(order),
      });
    } catch (error: any) {
      res
        .status(500)
        .json({
          message: error.message || "Error en checkout",
          error: error.message,
        });
    }
  },

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

      if (!producto || !producto.esMenuBeca || producto.tipo !== "Cafeteria") {
        res.status(403).json({
          message: "Ese producto no forma parte del menú de beca de hoy.",
        });
        return;
      }

      const tiempoEstimadoMin = producto.tiempoPrepMin;

      const order = await prisma.$transaction(async (tx) => {
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
            qrCodeData: nuevoCodigoQR(),
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
          include: includeOrdenCompleta,
        });
      });

      const io = req.app.get("io");
      io?.emit("nueva_orden_kds", {
        ...serializarOrden(order),
        usuario: order.user?.nombre || req.user?.nombre,
      });
      emitirEstado(req, order);
      recalcularKDS(req, "becaCheckout");

      res.status(201).json({
        status: "success",
        qrData: order.qrCodeData,
        orderId: order.id,
        tiempoEstimadoMin,
        total: 0,
        order: serializarOrden(order),
      });
    } catch (error: any) {
      res
        .status(500)
        .json({ message: error.message || "Error al reclamar tu beca" });
    }
  },

  markAsReady: async (req: Request, res: Response): Promise<void> => {
    const orderId = paramId(req);
    if (!orderId) {
      res.status(400).json({ message: "ID no proporcionado" });
      return;
    }

    try {
      const actual = await prisma.order.findUnique({ where: { id: orderId } });
      if (!actual) {
        res.status(404).json({ message: "Orden no encontrada" });
        return;
      }
      if (actual.status !== "PAGADO") {
        res
          .status(409)
          .json({ message: `La orden ya está en estado ${actual.status}.` });
        return;
      }

      const order = await prisma.order.update({
        where: { id: orderId },
        data: { status: "LISTO", fechaListo: new Date() },
        include: includeOrdenCompleta,
      });

      const io = req.app.get("io");
      const mensaje = "¡Tu pedido está listo! Pasa a recogerlo a la cafetería.";
      io?.to(order.userId).emit("orden_lista", { orderId: order.id, mensaje });
      emitirEstado(req, order);
      notificarUsuario(io, order.userId, ` ${mensaje}`, { orderId: order.id });
      recalcularKDS(req, "markAsReady");

      res.json({ message: "Orden lista", order: serializarOrden(order) });
    } catch (error) {
      res.status(500).json({ message: "Error al actualizar" });
    }
  },

  verifyOrder: async (req: Request, res: Response): Promise<void> => {
    try {
      const raw = req.body?.qrData ?? req.body?.qrCodeData;
      const qrData = typeof raw === "string" ? raw.trim().toUpperCase() : "";
      if (!qrData) {
        res.status(400).json({ message: "Falta el código QR de la orden." });
        return;
      }

      const pedido = await prisma.order.findFirst({
        where: { qrCodeData: qrData, status: { in: ESTADOS_ACTIVOS } },
      });
      if (!pedido) {
        res
          .status(404)
          .json({ message: "QR inválido o la orden ya fue entregada." });
        return;
      }

      const order = await prisma.order.update({
        where: { id: pedido.id },
        data: {
          status: "ENTREGADO",
          fechaEntregado: new Date(),
          fechaListo: pedido.fechaListo ?? new Date(),
        },
        include: includeOrdenCompleta,
      });

      emitirEstado(req, order);
      recalcularKDS(req, "verifyOrder");

      res.json({
        message: "Entrega confirmada",
        order: serializarOrden(order),
      });
    } catch (error) {
      res.status(500).json({ message: "Error al verificar" });
    }
  },

  getPaidOrders: async (_req: Request, res: Response): Promise<void> => {
    try {
      const orders = await prisma.order.findMany({
        where: { status: "PAGADO" },
        include: includeOrdenCompleta,
        orderBy: { fecha: "asc" },
      });
      res.json(orders.map(serializarOrden));
    } catch (error) {
      res.status(500).json({ message: "Error al cargar las comandas" });
    }
  },

  /** GET /orders/ready — órdenes LISTO esperando ser recogidas (columna del KDS). */
  getReadyOrders: async (_req: Request, res: Response): Promise<void> => {
    try {
      const orders = await prisma.order.findMany({
        where: { status: "LISTO" },
        include: includeOrdenCompleta,
        orderBy: { fechaListo: "asc" },
      });
      res.json(orders.map(serializarOrden));
    } catch (error) {
      res.status(500).json({ message: "Error al cargar las órdenes listas" });
    }
  },
  getOrdenActiva: async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        res.status(401).json({ message: "No autorizado" });
        return;
      }

      const orden = await prisma.order.findFirst({
        where: { userId, status: { in: ESTADOS_ACTIVOS } },
        orderBy: { fecha: "desc" },
        include: { items: { include: { product: true } } },
      });

      res.status(200).json({ ordenActiva: orden ?? null });
    } catch (error: any) {
      res.status(500).json({
        message: "Error al obtener orden activa",
        error: error.message,
      });
    }
  },

  getMyOrders: async (req: Request, res: Response): Promise<void> => {
    try {
      const orders = await prisma.order.findMany({
        where: { userId: getUserId(req), status: { not: "CARRITO" } },
        include: { items: true },
        orderBy: { fecha: "desc" },
      });
      res.json(orders);
    } catch (error) {
      res.status(500).json({ message: "Error al cargar tus pedidos" });
    }
  },

  getOrderById: async (req: Request, res: Response): Promise<void> => {
    try {
      const order = await prisma.order.findUnique({
        where: { id: paramId(req) },
        include: includeOrdenCompleta,
      });
      const esStaff = req.user?.rol === "A" || req.user?.rol === "A_C";
      if (
        !order ||
        order.status === "CARRITO" ||
        (order.userId !== req.user?.id && !esStaff)
      ) {
        res.status(404).json({ message: "Orden no encontrada" });
        return;
      }
      res.json(serializarOrden(order));
    } catch (error) {
      res.status(500).json({ message: "Error al obtener la orden" });
    }
  },

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
    try {
      const hoy = new Date();
      hoy.setHours(0, 0, 0, 0);
      const noCarrito = { status: { not: "CARRITO" } };

      const [
        pedidos,
        ingresos,
        ingresosHoy,
        stock,
        enCola,
        listos,
        entregadosHoy,
      ] = await Promise.all([
        prisma.order.count({ where: { ...noCarrito, fecha: { gte: hoy } } }),
        prisma.order.aggregate({ where: noCarrito, _sum: { total: true } }),
        prisma.order.aggregate({
          where: { ...noCarrito, fecha: { gte: hoy } },
          _sum: { total: true },
        }),
        prisma.product.count({
          where: { tipo: "Cafeteria", stock: { lt: 5 } },
        }),
        prisma.order.count({ where: { status: "PAGADO" } }),
        prisma.order.count({ where: { status: "LISTO" } }),
        prisma.order.findMany({
          where: { fecha: { gte: hoy }, fechaListo: { not: null } },
          select: { fecha: true, fechaListo: true },
        }),
      ]);

      const tiempos = entregadosHoy
        .map((o) => (o.fechaListo!.getTime() - o.fecha.getTime()) / 60000)
        .filter((m) => m >= 0 && m < 240);
      const tiempoPromedioMin = tiempos.length
        ? Math.round(
            (tiempos.reduce((a, b) => a + b, 0) / tiempos.length) * 10,
          ) / 10
        : null;

      res.json({
        pedidos,
        ordenesHoy: pedidos,
        ingresos: Number(ingresos._sum.total || 0),
        ingresosHoy: Number(ingresosHoy._sum.total || 0),
        stock,
        stockBajo: stock,
        enCola,
        listos,
        tiempoPromedioMin,
      });
    } catch (error) {
      res.status(500).json({ message: "Error al calcular estadísticas" });
    }
  },
};
