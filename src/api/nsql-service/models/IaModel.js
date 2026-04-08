const mongoose = require("mongoose");

const recommendationSchema = new mongoose.Schema({
  producto_base_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product",
    required: true,
  },
  nombre_producto: { type: String, required: true },
  score_relevancia: { type: Number, required: true },
  segmento_horario: {
    type: String,
    enum: ["mañana", "tarde", "noche"],
    default: "mañana",
  },
  ultima_actualizacion: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Recommendation", recommendationSchema);
