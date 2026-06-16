import { Router } from "express";
import { marketController } from "../controllers/marketController";
import { verifyToken, isAdmin, isSeller } from "../../middlewares/authMiddleware";

const router = Router();

// --- RUTAS DE ADMINISTRACIÓN ---
router.get(
  "/admin/pendientes",
  verifyToken,
  isAdmin,
  marketController.getPendingItems,
);
router.get(
  "/admin/stats",
  verifyToken,
  isAdmin,
  marketController.getMarketStats,
);
router.patch(
  "/moderate/:id",
  verifyToken,
  isAdmin,
  marketController.moderateItem,
);

// --- RUTAS PÚBLICAS ---
router.get("/all", marketController.getMarketItems);

// --- RUTAS DE USUARIO (Autenticadas) ---
// Solo Alumno Verificado (A_V) puede publicar en el Marketplace
router.post("/publish", verifyToken, isSeller, marketController.publishItem);
router.get("/my-items", verifyToken, marketController.getMyItems);
router.put("/edit/:id", verifyToken, marketController.updateItem);
router.delete("/remove/:id", verifyToken, marketController.deleteItem);
router.get("/item/:id", verifyToken, marketController.getItemById);

export default router;