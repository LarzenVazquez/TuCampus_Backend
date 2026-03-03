const mongoose = require("mongoose");

const qrSchema = new mongoose.Schema({
  order_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Order",
    required: true,
  },
  qr_base64: { type: String, required: true }, // El dibujo del QR
  usado: { type: Boolean, default: false },
  fecha_creacion: { type: Date, default: Date.now },
});

module.exports = mongoose.model("QrCode", qrSchema);
