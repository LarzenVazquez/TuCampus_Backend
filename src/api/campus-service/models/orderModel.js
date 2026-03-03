const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema({
  usuario_id: { type: Number, required: true }, // ID que viene de MySQL
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
    enum: ["transferencia", "efectivo", "creditos"],
    default: "efectivo",
  },
  estado: {
    type: String,
    enum: ["pendiente", "preparando", "listo", "entregado"],
    default: "pendiente",
  },
  fecha: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Order", orderSchema);
