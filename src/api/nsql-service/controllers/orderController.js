const Order = require("../models/orderModel");
const Product = require("../models/productModel");
const crypto = require("crypto");

const orderController = {
  saveCart: async (req, res) => {
    try {
      const { items, total } = req.body;

      let cart = await Order.findOne({
        userId: req.user.id,
        status: "CARRITO",
      });

      if (cart) {
        cart.items = items;
        cart.total = total;
        await cart.save();
      } else {
        cart = new Order({
          userId: req.user.id,
          items,
          total,
          status: "CARRITO",
        });
        await cart.save();
      }
      res.status(200).json({ message: "Carrito actualizado", cart });
    } catch (error) {
      res.status(500).json({ message: "Error al guardar carrito" });
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
};

module.exports = orderController;
