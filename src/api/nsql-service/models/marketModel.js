const mongoose = require("mongoose");

const marketSchema = new mongoose.Schema({
  vendedorId: {
    type: Number,
    required: true,
  },
  nombreVendedor: String,
  titulo: {
    type: String,
    required: true,
    trim: true,
  },
  descripcion: {
    type: String,
    required: true,
  },
  precio: {
    type: Number,
    required: true,
  },
  categoria: {
    type: String,
    enum: ["Libros", "Electronica", "Ropa", "Otros"],
    default: "Otros",
  },
  imagenes: [String],
  estatus: {
    type: String,
    enum: ["pendiente", "activo", "vendido", "rechazado", "baneado"],
    default: "pendiente",
  },
  motivoRechazo: String,
  fechaPublicacion: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("Market", marketSchema);
