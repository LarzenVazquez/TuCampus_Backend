import { Router } from "express";
import { verifyToken } from "../../middlewares/authMiddleware";
import { notificationController } from "../controllers/notificationController";

const router = Router();

router.get("/", verifyToken, notificationController.getMisNotificaciones);
router.put("/read", verifyToken, notificationController.marcarLeidas);
router.delete("/", verifyToken, notificationController.limpiar);

export default router;
