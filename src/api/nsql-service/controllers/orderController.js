const Order = require("../models/orderModel");
const Product = require("../models/productModel");
const crypto = require("crypto");
const { MercadoPagoConfig, Preference } = require('mercadopago');
const baseURL = process.env.FRONTEND_URL;

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

      // 1. Buscamos el carrito activo del usuario
      const cart = await Order.findOne({
        userId: req.user.id,
        status: "CARRITO",
      });

      if (!cart || cart.items.length === 0) {
        return res
          .status(400)
          .json({ message: "No tienes un carrito activo para pagar" });
      }

      // 2. Descontamos el stock de la base de datos
      for (const item of cart.items) {
        await Product.findByIdAndUpdate(item.productId, {
          $inc: { stock: -item.cantidad },
        });
      }

      // 3. ✨ MAGIA: Generamos el código único del QR antes de guardar
      // Esto evita que Mongoose lance el error "qrCodeData is required"
      const qrString = "QR-" + crypto.randomBytes(6).toString("hex").toUpperCase();

      // 4. Actualizamos el carrito para convertirlo en una orden pagada
      cart.status = "PAGADO";
      cart.metodoPago = metodoPago || "Mercado Pago";
      cart.qrCodeData = qrString; 

      // 5. Guardamos en la base de datos (Mongoose estará feliz)
      await cart.save();

      // 6. Respondemos al frontend con los datos exactos que necesita para la vista
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
        error: error.message 
      });
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

  getPaidOrders: async (req, res) => {
    try {
      // Buscamos las órdenes pagadas y las ordenamos por fecha (la más vieja primero, para que salga rápido)
      const orders = await Order.find({ status: "PAGADO" }).sort({ fecha: 1 });
      res.json(orders);
    } catch (error) {
      console.error("Error al obtener pedidos de cocina:", error);
      res.status(500).json({ message: "Error al cargar la pantalla de cocina" });
    }
  },


  createPreference: async (req, res) => {
    try {
      // 1. Inicializar Mercado Pago con el token del .env
      const client = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN });
      const preference = new Preference(client);

      // 2. Transformar el carrito del frontend al formato de Mercado Pago
const items = req.body.items.map(item => ({
  title: item.nombre || "Producto",
  unit_price: Number(item.precio) || 0,
  quantity: Number(item.cantidad) || 1,
  currency_id: 'MXN',
  description: item.nombre || "Sin descripción"  // ← AGREGAR ESTO
}));
      
      // 3. Crear la preferencia y definir a dónde regresar tras el pago
      const result = await preference.create({
        body: {
          items: items,
         back_urls: {
    success: `${baseURL}/store/confirmacion.html`, 
    failure: `${baseURL}/store/carrito.html`,
    pending: `${baseURL}/store/carrito.html`
},
          auto_return: "approved"
        }
      });
console.log("✅ Preferencia creada:", {
  id: result.id,
  url_pago: result.init_point,
  init_point: result.init_point
});
      // 4. Devolver el ID al frontend
      res.json({ id: result.id, url_pago: result.init_point});
    } catch (error) {
      console.error("Error en MP:", error);
      res.status(500).json({ message: "Error al crear la preferencia de pago" });
    }
  },

  // Para la cocina: Cambia el estado a LISTO
  markAsReady: async (req, res) => {
    try {
      const order = await Order.findByIdAndUpdate(req.params.id, { status: "LISTO" });
      res.json({ message: "Orden lista para entregar", order });
    } catch (error) {
      res.status(500).json({ message: "Error al actualizar la orden" });
    }
  },

  // Para el alumno: Trae sus pedidos (el más reciente primero)
  getMyOrders: async (req, res) => {
    try {
      const orders = await Order.find({ 
        userId: req.user.id, 
        status: { $ne: "CARRITO" } // Trae todo lo que no sea carrito
      }).sort({ fecha: -1 });
      res.json(orders);
    } catch (error) {
      res.status(500).json({ message: "Error al obtener historial" });
    }
  },

};

module.exports = orderController;
