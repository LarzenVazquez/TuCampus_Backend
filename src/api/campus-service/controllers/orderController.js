const Order = require("../models/orderModel");
const Product = require("../models/productModel");
const QrService = require("../../../services/qrService");
const EmailService = require("../../../services/emailService");
const {
  successResponse,
  errorResponse,
} = require("../../../utils/responseHandler");
const { formatCurrency, formatDate } = require("../../../utils/formatter");

const createOrder = async (req, res) => {
  try {
    const { productos, metodo_pago } = req.body;
    const usuario_id = req.user.id;
    const usuario_email = req.user.email;
    let totalCalculado = 0;

    for (let item of productos) {
      const producto = await Product.findById(item.producto_id);
      if (!producto) {
        return errorResponse(
          res,
          `Producto ${item.producto_id} no encontrado`,
          404,
        );
      }

      item.precio_unitario = producto.precio;
      totalCalculado += producto.precio * item.cantidad;

      await Product.findByIdAndUpdate(item.producto_id, {
        $inc: { stock: -item.cantidad },
      });
    }

    const nuevaOrden = new Order({
      usuario_id,
      productos,
      total: totalCalculado,
      metodo_pago,
    });

    const ordenGuardada = await nuevaOrden.save();

    if (usuario_email) {
      await EmailService.sendOrderConfirmation(usuario_email, ordenGuardada);
    }

    successResponse(
      res,
      ordenGuardada,
      "Pedido procesado y correo enviado con éxito",
      201,
    );
  } catch (error) {
    errorResponse(res, "Error al procesar pedido: " + error.message);
  }
};

const getMyOrders = async (req, res) => {
  try {
    const ordenes = await Order.find({ usuario_id: req.user.id }).populate(
      "productos.producto_id",
    );
    successResponse(res, ordenes, "Historial de pedidos obtenido");
  } catch (error) {
    errorResponse(res, "Error al obtener historial: " + error.message);
  }
};

const getOrderDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const order = await Order.findById(id).populate("productos.producto_id");
    if (!order) return errorResponse(res, "Pedido no encontrado", 404);

    const qrCode = await QrService.generateOrderQR(order._id);

    // Formateamos datos para la vista
    const responseData = {
      order,
      totalMXN: formatCurrency(order.total),
      fechaFormateada: formatDate(order.fecha),
      qrCode,
    };

    successResponse(res, responseData, "Detalles del pedido");
  } catch (error) {
    errorResponse(res, error.message);
  }
};

const updateStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { estado } = req.body;
    const order = await Order.findByIdAndUpdate(id, { estado }, { new: true });

    const msg =
      estado === "listo"
        ? "¡Tu pedido está listo para recoger!"
        : `Pedido actualizado a: ${estado}`;
    successResponse(res, order, msg);
  } catch (error) {
    errorResponse(res, error.message);
  }
};

const cancelOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return errorResponse(res, "Pedido no encontrado", 404);
    if (order.estado !== "pendiente")
      return errorResponse(
        res,
        "No se puede cancelar un pedido en proceso",
        400,
      );

    order.estado = "cancelado";
    await order.save();
    successResponse(res, null, "Pedido cancelado con éxito");
  } catch (error) {
    errorResponse(res, error.message);
  }
};

const getDailyReport = async (req, res) => {
  try {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const report = await Order.aggregate([
      { $match: { fecha: { $gte: start }, estado: "entregado" } },
      {
        $group: {
          _id: null,
          totalVentas: { $sum: "$total" },
          cantidad: { $sum: 1 },
        },
      },
    ]);

    const finalReport = report[0] || { totalVentas: 0, cantidad: 0 };
    finalReport.totalVentasMXN = formatCurrency(finalReport.totalVentas);

    successResponse(res, finalReport, "Reporte de ventas diarias generado");
  } catch (error) {
    errorResponse(res, error.message);
  }
};

module.exports = {
  createOrder,
  getMyOrders,
  getOrderDetails,
  updateStatus,
  cancelOrder,
  getDailyReport,
};
