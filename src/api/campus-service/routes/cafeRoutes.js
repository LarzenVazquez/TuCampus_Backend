const express = require("express");
const router = express.Router();
const productController = require("../controllers/productController");
const { verifyToken, isAdmin } = require("../../../middlewares/authMiddleware");

// Rutas de productos
router.get("/products", productController.getProducts);
router.get("/products/category/:cat", productController.getProductsByCategory);
router.post("/products", verifyToken, isAdmin, productController.createProduct);
router.delete(
  "/products/:id",
  verifyToken,
  isAdmin,
  productController.deleteProduct,
);

module.exports = router;
