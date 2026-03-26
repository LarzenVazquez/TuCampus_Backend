const Order = require("../models/orderModel");
const Product = require("../models/productModel");
const crypto = require("crypto");
const { MercadoPagoConfig, Preference } = require('mercadopago');

const orderController = {
  saveCart: async (req, res) => {
    try {
      const { items, total } = req.body;
      const userId = req.user.id; // Asegúrate de que esto sea lo que llega del token

      // Buscamos si el usuario ya tiene un carrito
      let cart = await Order.findOne({
        userId: userId,
        status: "CARRITO",
      });

      if (cart) {
        cart.items = items;
        cart.total = total;
        // No tocamos qrCodeData aquí, se queda como null
        await cart.save();
      } else {
        cart = new Order({
          userId: userId,
          items,
          total,
          status: "CARRITO",
          qrCodeData: null, // Definirlo explícitamente como null
        });
        await cart.save();
      }

      res.status(200).json({ message: "Carrito guardado", cart });
    } catch (error) {
      console.error("ERROR EN SAVECART:", error);
      res
        .status(500)
        .json({ message: "Error al guardar carrito", error: error.message });
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
        return res
          .status(400)
          .json({ message: "No tienes un carrito activo para pagar" });
      }

      const pagoExitoso = true;

      if (pagoExitoso) {
        for (const item of cart.items) {
          await Product.findByIdAndUpdate(item.productId, {
            $inc: { stock: -item.cantidad },
          });
        }
        const qrString = crypto
          .createHash("sha256")
          .update(`${req.user.id}-${Date.now()}-${cart.total}`)
          .digest("hex");
        cart.status = "PAGADO";
        cart.metodoPago = metodoPago;
        cart.qrCodeData = qrString;
        await cart.save();

        res.status(201).json({
          status: "success",
          message: "¡Pago exitoso y stock actualizado!",
          qrData: qrString,
          orderId: cart._id,
        });
      }
    } catch (error) {
      console.error("Error en Checkout:", error);
      res.status(500).json({ message: "Error en el proceso de pago" });
    }
  },

  verifyOrder: async (req, res) => {
    try {
      const { qrData } = req.body;
      const order = await Order.findOne({
        qrCodeData: qrData,
        status: "PAGADO",
      });

      if (!order)
        return res
          .status(404)
          .json({ message: "QR inválido o pedido ya entregado" });

      order.status = "ENTREGADO";
      await order.save();
      res.json({ message: "Entrega confirmada", items: order.items });
    } catch (error) {
      res.status(500).json({ message: "Error al verificar" });
    }
  },
  createPreference: async (req, res) => {
    try {
      // 1. Inicializar Mercado Pago con el token del .env
      const client = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN });
      const preference = new Preference(client);

      // 2. Transformar el carrito del frontend al formato de Mercado Pago
      const items = req.body.items.map(item => ({
        title: item.nombre,
        unit_price: Number(item.precio),
        quantity: Number(item.cantidad),
        currency_id: 'MXN'
      }));

      // 3. Crear la preferencia y definir a dónde regresar tras el pago
      const result = await preference.create({
        body: {
          items: items,
          back_urls: {
            success: "http://localhost:5173/store/confirmacion.html", 
            failure: "http://localhost:5173/store/carrito.html",
            pending: "http://localhost:5173/store/carrito.html"
          },
          // auto_return: "approved"
        }
      });

      // 4. Devolver el ID al frontend
      res.json({ id: result.id, url_pago: result.sandbox_init_point});
    } catch (error) {
      console.error("Error en MP:", error);
      res.status(500).json({ message: "Error al crear la preferencia de pago" });
    }
  }

};

module.exports = orderController;
