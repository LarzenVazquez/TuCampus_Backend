const express = require("express");
const router = express.Router();
const productController = require("../controllers/productController");
const { verifyToken } = require("../../../middlewares/authMiddleware");

router.get("/search/:query", productController.searchProducts);

router.get("/items", productController.getProducts);

router.post("/publish", verifyToken, productController.createProduct);

module.exports = router;
