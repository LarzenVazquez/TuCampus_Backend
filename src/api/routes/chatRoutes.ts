import { Router } from "express";
import { chatController } from "../controllers/chatController";
import { verifyToken } from "../../middlewares/authMiddleware";

const router = Router();

// Rutas de chat (Requieren autenticación)
router.post("/open", verifyToken, chatController.getOrCreateChat);
router.post("/send", verifyToken, chatController.sendMessage);
router.get("/my-inbox", verifyToken, chatController.getMyChats);
router.get("/:chat_id", verifyToken, chatController.getChatById);

export default router;
