const mongoose = require("mongoose");

const recommendationSchema = new mongoose.Schema({
  // Referencia al producto real
  producto_base_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product",
    required: true,
  },

  // Datos espejo para evitar JOINs (mejor rendimiento para la IA)
  nombre_producto: {
    type: String,
    required: true,
  },

  precio: {
    type: Number,
    required: true,
  },

  categoria: {
    type: String,
    default: "General",
  },

  imagenUrl: {
    type: String,
  },

  // --- NUEVOS CAMPOS PARA ANALÍTICA ---
  tipo: {
    type: String,
    default: "Cafeteria", // Ayuda a separar recomendaciones de Cafetería vs Marketplace
  },

  calorias: {
    type: Number,
    default: 0,
  },

  // --- LÓGICA DE LA IA ---
  score_relevancia: {
    type: Number,
    required: true,
  },

  hora_prediccion: {
    type: Number,
    min: 0,
    max: 23,
    required: true,
  },

  // Para saber si la recomendación es "fresca"
  ultima_actualizacion: {
    type: Date,
    default: Date.now,
  },
});

// ÍNDICES: Cruciales para que la búsqueda por hora sea instantánea
recommendationSchema.index({ hora_prediccion: 1, score_relevancia: -1 });
// Índice para búsquedas rápidas por presupuesto y tipo
recommendationSchema.index({ precio: 1, tipo: 1 });

module.exports = mongoose.model("Recommendation", recommendationSchema);
