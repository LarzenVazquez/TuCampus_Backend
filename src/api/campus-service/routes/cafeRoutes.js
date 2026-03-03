const express = require("express");
const router = express.Router();
const cafeController = require("../controllers/cafeController");
const orderController = require("../controllers/orderController");
const { verifyToken, isAdmin } = require("../../../middlewares/authMiddleware");

// PRODUCTOS
router.get("/products", cafeController.getProducts);
router.get("/products/category/:cat", cafeController.getProductsByCategory);
router.post("/products", verifyToken, isAdmin, cafeController.createProduct);
router.delete(
  "/products/:id",
  verifyToken,
  isAdmin,
  cafeController.deleteProduct,
);

// PEDIDOS
router.post("/orders", verifyToken, orderController.createOrder);
router.get("/orders/my", verifyToken, orderController.getMyOrders);
router.get("/orders/:id", verifyToken, orderController.getOrderDetails);

// GESTIÓN Y REPORTES
router.patch(
  "/orders/status/:id",
  verifyToken,
  isAdmin,
  orderController.updateStatus,
);
router.put("/orders/cancel/:id", verifyToken, orderController.cancelOrder);
router.get(
  "/admin/report",
  verifyToken,
  isAdmin,
  orderController.getDailyReport,
);

module.exports = router;
