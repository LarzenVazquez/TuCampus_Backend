const express = require("express");
const router = express.Router();
const orderController = require("../controllers/orderController");
const { verifyToken, isAdmin } = require("../../../middlewares/authMiddleware");

const { checkStock } = require("../../../middlewares/stockMiddleware");

router.get("/cart", verifyToken, orderController.getCart);
router.post("/cart", verifyToken, orderController.saveCart);

router.post("/checkout", verifyToken, checkStock, orderController.checkout);

router.post("/verify-qr", verifyToken, isAdmin, orderController.verifyOrder);
router.post("/create-preference", orderController.createPreference);

module.exports = router;
