const express = require("express");
const router = express.Router();
const productController = require("../controllers/productController");
const {
  verifyToken,
  isSeller,
} = require("../../../middlewares/authMiddleware");

// 1. Rutas Públicas (Cualquiera puede ver productos)
router.get("/search/:query", productController.searchProducts);
router.get("/items", productController.getProducts);

// 2. Rutas Protegidas (Solo Alumnos Vendedores o Admins)
// Se añade 'isSeller' para validar que el rol sea 'A_V' o 'A'
router.post("/publish", verifyToken, isSeller, productController.createProduct);

// 3. Ruta para mis productos (Gestión del vendedor)
router.get("/my-items", verifyToken, productController.getMyProducts);

module.exports = router;
