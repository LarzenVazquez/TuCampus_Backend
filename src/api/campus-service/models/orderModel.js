const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema({
  usuario_id: { type: Number, required: true }, // MATCH con ID de MySQL (users.id)
  productos: [
    {
      producto_id: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
      cantidad: { type: Number, required: true },
      precio_unitario: { type: Number, required: true },
    },
  ],
  total: { type: Number, required: true },
  metodo_pago: {
    type: String,
    // Alineado con los pagos reales del proyecto
    enum: ["transferencia", "efectivo", "creditos", "tarjeta"],
    default: "efectivo",
  },
  estado: {
    type: String,
    enum: ["pendiente", "preparando", "listo", "entregado", "cancelado"], // Añadido 'cancelado'
    default: "pendiente",
  },
  fecha: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Order", orderSchema);
