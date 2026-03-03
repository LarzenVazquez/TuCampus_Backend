const mongoose = require("mongoose");

const productSchema = new mongoose.Schema({
  nombre: { type: String, required: true, trim: true },
  descripcion: { type: String, required: true },
  precio: { type: Number, required: true },
  categoria: {
    type: String,
    enum: ["comida", "bebida", "snack", "market"],
    default: "comida",
  },
  stock: { type: Number, default: 0 },
  imagen: { type: String }, // URL de la imagen
  disponible: { type: Boolean, default: true },
  fecha_creacion: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Product", productSchema);
