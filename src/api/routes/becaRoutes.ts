import { Router } from "express";
import { becaController } from "../controllers/becaController";
import {
  verifyToken,
  hasRole,
  isAdmin,
} from "../../middlewares/authMiddleware";

const router = Router();

router.use(verifyToken);

router.post("/solicitudes", hasRole("Al", "A_V"), becaController.crear);
router.get("/solicitudes/mias", becaController.mias);

router.get("/solicitudes/resumen", isAdmin, becaController.resumen);
router.get("/solicitudes", isAdmin, becaController.listar);
router.patch("/solicitudes/:id", isAdmin, becaController.revisar);

export default router;
