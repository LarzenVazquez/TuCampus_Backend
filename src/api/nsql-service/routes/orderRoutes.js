const express = require("express");
const router = express.Router();
const orderController = require("../controllers/orderController");
const {
  verifyToken,
  isAdmin,
  isAdminC,
} = require("../../../middlewares/authMiddleware");
const { checkStock } = require("../../../middlewares/stockMiddleware");

router.get("/cart", verifyToken, orderController.getCart);
router.post("/cart", verifyToken, orderController.saveCart);

router.post("/checkout", verifyToken, checkStock, orderController.checkout);

router.post("/verify-qr", verifyToken, isAdmin, orderController.verifyOrder);

router.get("/kitchen", verifyToken, orderController.getPaidOrders);
router.put("/ready/:id", verifyToken, orderController.markAsReady);
router.get("/me", verifyToken, orderController.getMyOrders);

router.post(
  "/create-preference",
  verifyToken,
  orderController.createPreference,
);

// Esta línea debe coincidir con lo que pide el apiservices.js
router.get("/stats", verifyToken, isAdminC, orderController.getGlobalStats);
module.exports = router;
