const mongoose = require("mongoose");

const logSchema = new mongoose.Schema({
  producto_id: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
  cantidad: Number,
  tipo: { type: String, enum: ["entrada", "salida"] },
  motivo: String,
  fecha: { type: Date, default: Date.now },
});

module.exports = mongoose.model("InventoryLog", logSchema);
