const mongoose = require("mongoose");

const productSchema = new mongoose.Schema({
  nombre: { type: String, required: true, trim: true },
  descripcion: { type: String, required: true },
  precio: { type: Number, required: true },
  categoria: {
    type: String,
    enum: ["cafeteria", "marketplace", "comida", "bebida", "snack"],
    default: "cafeteria",
  },
  stock: { type: Number, default: 0 },
  imagen: { type: String },
  disponible: { type: Boolean, default: true },
  fecha_creacion: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Product", productSchema);
