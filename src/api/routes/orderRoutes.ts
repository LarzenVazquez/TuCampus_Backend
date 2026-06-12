import { Router } from "express";
import { orderController } from "../controllers/orderController";
import {
  verifyToken,
  isAdmin,
  isAdminC,
} from "../../middlewares/authMiddleware";
import { checkStock } from "../../middlewares/stockMiddleware";

const router = Router();

// --- RUTAS DE CARRITO ---
router.get("/cart", verifyToken, orderController.getCart);
router.post("/cart", verifyToken, orderController.saveCart);

// --- RUTAS DE PAGO ---
router.post(
  "/create-preference",
  verifyToken,
  checkStock,
  orderController.createPreference,
);

router.post("/checkout", verifyToken, orderController.checkout);

// --- RUTAS DE COCINA Y PEDIDOS ---
router.post("/verify-qr", verifyToken, isAdmin, orderController.verifyOrder);
router.get("/kitchen", verifyToken, orderController.getPaidOrders);
router.put("/ready/:id", verifyToken, orderController.markAsReady);

// --- RUTAS DE USUARIO ---
router.get("/me", verifyToken, orderController.getMyOrders);

// --- ESTADÍSTICAS ---
router.get("/stats", verifyToken, isAdminC, orderController.getGlobalStats);

export default router;
