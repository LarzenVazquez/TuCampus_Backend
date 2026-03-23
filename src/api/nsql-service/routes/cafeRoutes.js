const express = require("express");
const router = express.Router();
const marketController = require("../controllers/marketController");
const productController = require("../controllers/productController");
const { verifyToken } = require("../../../middlewares/authMiddleware");

// --- RUTAS PÚBLICAS ---
router.get("/all", marketController.getMarketItems); // Ver todo el marketplace
router.get("/items", productController.getProducts); // Ver productos generales
router.get("/search", productController.searchProducts); // Buscador

// --- RUTAS PRIVADAS (Requieren Login) ---
router.post("/publish", verifyToken, marketController.publishItem); // Publicar
router.put("/edit/:id", verifyToken, productController.updateProduct); // Editar mi producto
router.delete("/remove/:id", verifyToken, productController.deleteProduct); // Borrar mi producto

module.exports = router;
