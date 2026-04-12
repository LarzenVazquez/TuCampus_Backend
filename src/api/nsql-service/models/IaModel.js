const mongoose = require("mongoose");

const recommendationSchema = new mongoose.Schema({
  producto_base_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product",
    required: true,
  },

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

  clics_interaccion: {
    type: Number,
    default: 0,
  },
  ventas_vinculadas: {
    type: Number,
    default: 0,
  },

  ultima_actualizacion: {
    type: Date,
    default: Date.now,
  },
});

recommendationSchema.index({ hora_prediccion: 1, precio: 1 });
recommendationSchema.index({ producto_base_id: 1 });

module.exports = mongoose.model("Recommendation", recommendationSchema);
