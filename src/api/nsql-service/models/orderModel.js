const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  items: [
    {
      productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
      nombre: String,
      cantidad: Number,
      precio: Number,
    },
  ],
  total: { type: Number, required: true },
  metodoPago: {
    type: String,
    enum: ["Tarjeta", "Transferencia"],
    default: "Tarjeta",
  },
  status: {
    type: String,
    enum: ["CARRITO", "PAGADO", "ENTREGADO", "CANCELADO"],
    default: "CARRITO",
  },
  qrCodeData: {
    type: String,
    unique: true,
    sparse: true,
    default: null,
  },
  fecha: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Order", orderSchema);
