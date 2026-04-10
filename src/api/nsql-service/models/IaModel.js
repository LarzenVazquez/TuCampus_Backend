const mongoose = require("mongoose");

const recommendationSchema = new mongoose.Schema({
  producto_base_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product",
    required: true,
  },
  nombre_producto: { type: String, required: true },
  score_relevancia: { type: Number, required: true },
  hora_prediccion: {
    type: Number,
    min: 0,
    max: 23,
    required: true,
  },
  ultima_actualizacion: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Recommendation", recommendationSchema);
