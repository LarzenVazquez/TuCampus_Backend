const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
  {
    nombre: {
      type: String,
      required: true,
    },
    descripcion: {
      type: String,
    },
    precio: {
      type: Number,
      required: true,
    },
    categoria: {
      type: String,
    },
    stock: {
      type: Number,
      default: 0,
    },
    estado: {
      type: String,
      enum: ["DISPONIBLE", "AGOTADO", "OCULTO"],
      default: "DISPONIBLE",
    },
    tipo: {
      type: String,
      default: "Cafeteria",
    },
    imagenUrl: {
      type: String,
      default:
        "https://images.unsplash.com/photo-1509042239860-f550ce710b93?q=80&w=500&auto=format&fit=crop",
    },
  },
  {
    timestamps: true,
    collection: "products", // Asegura que ambos usen la misma tabla en MongoDB
  },
);

module.exports = mongoose.model("Product", productSchema);
