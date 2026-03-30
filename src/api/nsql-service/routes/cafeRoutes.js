const express = require("express");
const router = express.Router();
const productController = require("../controllers/productController");
const {
  verifyToken,
  isAdminC,
} = require("../../../middlewares/authMiddleware");

// --- RUTAS PÚBLICAS (Solo Cafetería) ---
// Obtener todos los productos de la cafetería
router.get("/items", productController.getProducts);

// NUEVA RUTA: Obtener un producto específico por ID (Necesaria para editar)
// Se coloca antes de las rutas con parámetros dinámicos para evitar conflictos
router.get("/items/:id", productController.getProductById);

// Obtener por categoría y búsqueda
router.get("/items/category/:cat", productController.getProductsByCategory);
router.get("/search", productController.searchProducts);

// --- RUTAS PRIVADAS (Solo Admin-C) ---
// Publicar nuevo producto
router.post("/publish", verifyToken, isAdminC, productController.createProduct);

// Editar producto existente
router.put("/edit/:id", verifyToken, isAdminC, productController.updateProduct);

// Eliminar producto
router.delete(
  "/remove/:id",
  verifyToken,
  isAdminC,
  productController.deleteProduct,
);

module.exports = router;
