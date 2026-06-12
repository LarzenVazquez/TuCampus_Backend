import { Router } from "express";
import { verifyToken } from "../../middlewares/authMiddleware";
import { notificationController } from "../controllers/notificationController";

const router = Router();

// Rutas para gestionar notificaciones
router.get("/", verifyToken, notificationController.getMisNotificaciones);
router.put("/read", verifyToken, notificationController.marcarLeidas);

export default router;
