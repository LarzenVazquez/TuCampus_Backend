const express = require("express");
const router = express.Router();
// Cambiado a productController si así se llama tu archivo
const orderController = require("../controllers/orderController");
const { verifyToken, isAdmin } = require("../../../middlewares/authMiddleware");
const productController = require("../controllers/cafeController");

// === PRODUCTOS (CAFETERÍA / MARKETPLACE) ===
router.get("/products", productController.getProducts);
router.get("/products/category/:cat", productController.getProductsByCategory);

// Solo Admin/Staff crea o borra
router.post("/products", verifyToken, isAdmin, productController.createProduct);
router.delete(
  "/products/:id",
  verifyToken,
  isAdmin,
  productController.deleteProduct,
);

// === PEDIDOS (ORDERS) ===
router.post("/orders", verifyToken, orderController.createOrder);
router.get("/orders/my", verifyToken, orderController.getMyOrders);
router.get("/orders/:id", verifyToken, orderController.getOrderDetails);

// === GESTIÓN Y REPORTES (ADMIN) ===
// Cambiar estado (preparando, listo, entregado)
router.patch(
  "/orders/status/:id",
  verifyToken,
  isAdmin,
  orderController.updateStatus,
);

// Cancelar pedido
router.put("/orders/cancel/:id", verifyToken, orderController.cancelOrder);

// Reporte diario de ventas
router.get(
  "/admin/report",
  verifyToken,
  isAdmin,
  orderController.getDailyReport,
);

module.exports = router;
