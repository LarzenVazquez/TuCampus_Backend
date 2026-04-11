const Chat = require("../models/chatModel");

const chatController = {
  getOrCreateChat: async (req, res) => {
    try {
      const { vendedor_id, producto_id } = req.body;
      const comprador_id = req.user.id;

      if (comprador_id == vendedor_id) {
        return res.status(400).json({ message: "Es tu propio producto" });
      }

      let chat = await Chat.findOne({
        comprador_id,
        vendedor_id,
        producto_id,
      }).populate("producto_id", "titulo imagenes precio");

      if (!chat) {
        chat = new Chat({
          comprador_id,
          vendedor_id,
          producto_id,
          messages: [],
        });
        await chat.save();
      }

      res.json(chat);
    } catch (error) {
      res
        .status(500)
        .json({ message: "Error al abrir chat", error: error.message });
    }
  },

  // Enviar mensaje
  sendMessage: async (req, res) => {
    try {
      const { chat_id, text } = req.body;
      const sender_id = req.user.id;

      const chat = await Chat.findByIdAndUpdate(
        chat_id,
        {
          $push: { messages: { sender_id, text } },
          $set: { last_update: Date.now() },
        },
        { new: true },
      );

      if (!chat) return res.status(404).json({ message: "Chat no encontrado" });

      const lastMsg = chat.messages[chat.messages.length - 1];
      res.json(lastMsg);
    } catch (error) {
      res
        .status(500)
        .json({ message: "Error al enviar", error: error.message });
    }
  },

  getMyChats: async (req, res) => {
    try {
      const userId = req.user.id;
      const chats = await Chat.find({
        $or: [{ comprador_id: userId }, { vendedor_id: userId }],
      })
        .populate("producto_id", "titulo imagenes")
        .sort({ last_update: -1 });

      res.json(chats);
    } catch (error) {
      res.status(500).json({ message: "Error al cargar chats" });
    }
  },
  // Obtener un chat específico por su ID (Para abrirlo desde la bandeja de entrada)
  getChatById: async (req, res) => {
    try {
      const { chat_id } = req.params;
      const userId = req.user.id;

      // Buscamos el chat y verificamos que el usuario sea parte de él (comprador o vendedor)
      const chat = await Chat.findOne({
        _id: chat_id,
        $or: [{ comprador_id: userId }, { vendedor_id: userId }]
      }).populate("producto_id", "titulo imagenes precio");

      if (!chat) {
        return res.status(404).json({ message: "Chat no encontrado o acceso denegado" });
      }

      res.json(chat);
    } catch (error) {
      res.status(500).json({ message: "Error al cargar el chat", error: error.message });
    }
  },
};

module.exports = chatController;
