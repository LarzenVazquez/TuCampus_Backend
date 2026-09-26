import { Router } from "express";
import { contactoController } from "../controllers/contactoController";
import { verifyToken, isStaff } from "../../middlewares/authMiddleware";
import { contactoLimiter } from "../../middlewares/rateLimiters";
import { validateContacto } from "../../middlewares/validationMiddleware";

const router = Router();

router.post("/", contactoLimiter, validateContacto, contactoController.enviar);

router.get("/", verifyToken, isStaff, contactoController.listar);
router.patch(
  "/:id/respondido",
  verifyToken,
  isStaff,
  contactoController.marcarRespondido,
);

export default router;
