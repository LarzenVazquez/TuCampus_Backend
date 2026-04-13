const Order = require("../models/orderModel");
const Product = require("../models/productModel");
const mongoose = require("mongoose");
const crypto = require("crypto");
const { MercadoPagoConfig, Preference } = require("mercadopago");
const baseURL = process.env.FRONTEND_URL;

const orderController = {
  saveCart: async (req, res) => {
    try {
      const { items, total } = req.body;
      const userId = req.user.id;

      let cart = await Order.findOne({
        userId: userId,
        status: "CARRITO",
      });

      if (cart) {
        cart.items = items;
        cart.total = total;
        await cart.save();
      } else {
        cart = new Order({
          userId: userId,
          items,
          total,
          status: "CARRITO",
          qrCodeData: null,
        });
        await cart.save();
      }

      res.status(200).json({ message: "Carrito guardado", cart });
    } catch (error) {
      console.error("ERROR EN SAVECART:", error);
      res.status(500).json({ message: "Error al guardar carrito", error: error.message });
    }
  },

  getCart: async (req, res) => {
    try {
      const cart = await Order.findOne({
        userId: req.user.id,
        status: "CARRITO",
      });
      res.json(cart || { items: [], total: 0 });
    } catch (error) {
      res.status(500).json({ message: "Error al obtener carrito" });
    }
  },

  checkout: async (req, res) => {
    try {
      const { metodoPago } = req.body;

      const cart = await Order.findOne({
        userId: req.user.id,
        status: "CARRITO",
      });

      if (!cart || cart.items.length === 0) {
        return res.status(400).json({ message: "No tienes un carrito activo para pagar" });
      }

      for (const item of cart.items) {
        await Product.findByIdAndUpdate(item.productId, {
          $inc: { stock: -item.cantidad },
        });
      }

      const qrString = "QR-" + crypto.randomBytes(6).toString("hex").toUpperCase();

      cart.status = "PAGADO";
      cart.metodoPago = metodoPago || "Mercado Pago";
      cart.qrCodeData = qrString;
      cart.fecha = new Date(); // Aseguramos que tenga fecha para el KDS

      await cart.save();

      // --- 🚀 INTEGRACIÓN WEBSOCKET: AVISAR A LA COCINA (KDS) ---
      const io = req.app.get("io");
      if (io) {
        io.emit("nueva_orden_kds", {
          id: cart._id,
          usuario: req.user.nombre, // Nombre del alumno que viene del token
          items: cart.items,
          total: cart.total,
          fecha: cart.fecha
        });
        console.log(`Socket: Orden ${cart._id} enviada al KDS`);
      }
      // --------------------------------------------------------

      res.status(201).json({
        status: "success",
        message: "¡Pago exitoso y stock actualizado!",
        qrData: cart.qrCodeData,
        orderId: cart._id,
      });
    } catch (error) {
      console.error("Error en Checkout:", error);
      res.status(500).json({
        message: "Error en el proceso de pago",
        error: error.message,
      });
    }
  },

  // Para la cocina: Cambia el estado a LISTO y avisa al alumno
  markAsReady: async (req, res) => {
    try {
      // Buscamos y actualizamos para obtener el userId del dueño del pedido
      const order = await Order.findByIdAndUpdate(
        req.params.id, 
        { status: "LISTO" },
        { new: true } // Para que nos devuelva el objeto ya actualizado
      );

      if (!order) {
        return res.status(404).json({ message: "Orden no encontrada" });
      }

      // --- 🔔 INTEGRACIÓN WEBSOCKET: NOTIFICAR AL ALUMNO ---
      const io = req.app.get("io");
      if (io) {
        // Mandamos el mensaje SOLO al "cuarto" privado de ese alumno
        io.to(order.userId.toString()).emit("orden_lista", {
          ordenId: order._id,
          status: "LISTO",
          mensaje: "¡Tu pedido está listo! ☕ Pasa a recogerlo a la cafetería."
        });
        console.log(`Socket: Notificación de orden lista enviada al usuario ${order.userId}`);
      }
      // ----------------------------------------------------

      res.json({ message: "Orden lista para entregar", order });
    } catch (error) {
      console.error("Error en markAsReady:", error);
      res.status(500).json({ message: "Error al actualizar la orden" });
    }
  },

  verifyOrder: async (req, res) => {
    try {
      const { qrData } = req.body;
      const order = await Order.findOne({
        qrCodeData: qrData,
        status: { $in: ["PAGADO", "LISTO"] } // Puede ser entregado desde ambos estados
      });

      if (!order)
        return res.status(404).json({ message: "QR inválido o pedido ya entregado" });

      order.status = "ENTREGADO";
      await order.save();
      res.json({ message: "Entrega confirmada", items: order.items });
    } catch (error) {
      res.status(500).json({ message: "Error al verificar" });
    }
  },

  getPaidOrders: async (req, res) => {
    try {
      const orders = await Order.find({ status: "PAGADO" }).sort({ fecha: 1 });
      res.json(orders);
    } catch (error) {
      res.status(500).json({ message: "Error al cargar la pantalla de cocina" });
    }
  },

  createPreference: async (req, res) => {
    try {
      const client = new MercadoPagoConfig({
        accessToken: process.env.MP_ACCESS_TOKEN,
      });
      const preference = new Preference(client);

      const items = req.body.items.map((item) => ({
        title: item.nombre || "Producto",
        unit_price: Number(item.precio) || 0,
        quantity: Number(item.cantidad) || 1,
        currency_id: "MXN",
        description: item.nombre || "Sin descripción",
      }));

      const result = await preference.create({
        body: {
          items: items,
          back_urls: {
            success: `${baseURL}/store/confirmacion.html`,
            failure: `${baseURL}/store/carrito.html`,
            pending: `${baseURL}/store/carrito.html`,
          },
          auto_return: "approved",
        },
      });
      res.json({ id: result.id, url_pago: result.init_point });
    } catch (error) {
      res.status(500).json({ message: "Error al crear la preferencia de pago" });
    }
  },

  getMyOrders: async (req, res) => {
    try {
      const orders = await Order.find({
        userId: req.user.id,
        status: { $ne: "CARRITO" },
      }).sort({ fecha: -1 });
      res.json(orders);
    } catch (error) {
      res.status(500).json({ message: "Error al obtener historial" });
    }
  },

  getGlobalStats: async (req, res) => {
    try {
      const hoy = new Date();
      hoy.setHours(0, 0, 0, 0);

      const [pedidosHoy, ingresos, stockBajo, marketPendiente] =
        await Promise.all([
          Order.countDocuments({
            fecha: { $gte: hoy },
            status: { $in: ["PAGADO", "LISTO", "ENTREGADO"] },
          }),
          Order.aggregate([
            { $match: { status: { $in: ["PAGADO", "LISTO", "ENTREGADO"] } } },
            { $group: { _id: null, total: { $sum: "$total" } } },
          ]),
          Product.countDocuments({ stock: { $lt: 5 } }),
          mongoose.model("Market").countDocuments({ estado: "PENDIENTE" }).catch(() => 0),
        ]);

      res.json({
        pedidosHoy,
        ingresosTotales: ingresos[0]?.total || 0,
        stockBajo,
        marketPendiente,
      });
    } catch (error) {
      res.status(500).json({ message: "Error al obtener estadísticas de operación" });
    }
  },
};

module.exports = orderController;