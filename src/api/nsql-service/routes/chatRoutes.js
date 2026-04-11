const express = require("express");
const router = express.Router();
const chatController = require("../controllers/chatController");
const { verifyToken } = require("../../../middlewares/authMiddleware");

router.post("/open", verifyToken, chatController.getOrCreateChat);
router.post("/send", verifyToken, chatController.sendMessage);
router.get("/my-inbox", verifyToken, chatController.getMyChats);
router.get("/:chat_id", verifyToken, chatController.getChatById);

module.exports = router;
