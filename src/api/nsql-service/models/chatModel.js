const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema({
  sender_id: { type: Number, required: true },
  text: { type: String, required: true },
  read: { type: Boolean, default: false },
  created_at: { type: Date, default: Date.now },
});

const chatSchema = new mongoose.Schema({
  comprador_id: { type: Number, required: true },
  vendedor_id: { type: Number, required: true },
  producto_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Market",
    required: true,
  },
  messages: [messageSchema],
  last_update: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Chat", chatSchema);
