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

// --- BECA ALIMENTICIA (gratuito, valida es_becado + 1 consumo/día) ---
// No usa checkStock porque opera sobre el carrito ya guardado en BD, no
// sobre un body con items; la validación de stock ocurre dentro del
// controlador de forma atómica.
router.post("/beca/checkout", verifyToken, orderController.becaCheckout);

// --- RUTAS DE COCINA Y PEDIDOS ---
router.post("/verify-qr", verifyToken, isAdmin, orderController.verifyOrder);
router.get("/kitchen", verifyToken, orderController.getPaidOrders);
router.put("/ready/:id", verifyToken, orderController.markAsReady);

// --- RUTAS DE USUARIO ---
router.get("/me", verifyToken, orderController.getMyOrders);

// --- ESTADÍSTICAS ---
router.get("/stats", verifyToken, isAdminC, orderController.getGlobalStats);

// --- MODELO DE SATURACIÓN DEL KDS (dO/dt = lambda - mu) ---
router.get(
  "/kds/metrics",
  verifyToken,
  isAdminC,
  orderController.getKdsMetrics,
);

router.get("/activa", verifyToken, orderController.getOrdenActiva);

export default router;
