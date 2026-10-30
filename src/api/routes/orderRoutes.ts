import { Router } from "express";
import { orderController } from "../controllers/orderController";
import {
  verifyToken,
  hasRole,
  isAdminC,
} from "../../middlewares/authMiddleware";
import { checkStock } from "../../middlewares/stockMiddleware";

const router = Router();

router.use(verifyToken);

router.get("/cart", orderController.getCart);
router.post("/cart", orderController.saveCart);

router.post("/create-preference", checkStock, orderController.createPreference);
router.post("/checkout", orderController.checkout);

router.post("/beca/checkout", orderController.becaCheckout);

router.get("/kitchen", isAdminC, orderController.getPaidOrders);
router.get("/ready", isAdminC, orderController.getReadyOrders);
router.put("/ready/:id", isAdminC, orderController.markAsReady);
router.get("/qr/:codigo", hasRole("A_C", "A"), orderController.getOrderByQR);
router.post("/verify-qr", hasRole("A_C", "A"), orderController.verifyOrder);

router.get("/stats", isAdminC, orderController.getGlobalStats);
router.get("/kds/metrics", isAdminC, orderController.getKdsMetrics);

router.get("/me", orderController.getMyOrders);
router.get("/activa", orderController.getOrdenActiva);

router.get("/:id", orderController.getOrderById);

export default router;
