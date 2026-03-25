const express = require("express");
const router = express.Router();
const productController = require("../controllers/productController");
// Importamos isAdminC para la cafetería
const {
  verifyToken,
  isAdminC,
} = require("../../../middlewares/authMiddleware");

// --- RUTAS PÚBLICAS (Solo Cafetería) ---
// El controlador ya filtra internamente por tipo: "Cafeteria"
router.get("/items", productController.getProducts);
router.get("/items/category/:cat", productController.getProductsByCategory);
router.get("/search", productController.searchProducts);

// --- RUTAS PRIVADAS (Solo Admin-C) ---
// Cambiamos marketController por productController para centralizar la lógica de stock
router.post("/publish", verifyToken, isAdminC, productController.createProduct);
router.put("/edit/:id", verifyToken, isAdminC, productController.updateProduct);
router.delete(
  "/remove/:id",
  verifyToken,
  isAdminC,
  productController.deleteProduct,
);

module.exports = router;
