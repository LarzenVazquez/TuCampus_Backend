const express = require("express");
const router = express.Router();
const marketController = require("../controllers/marketController");
const productController = require("../controllers/productController");
// Importamos isAdmin para supervisión general
const { verifyToken, isAdmin } = require("../../../middlewares/authMiddleware");

// --- RUTAS PÚBLICAS (Venta entre alumnos) ---
router.get("/all", marketController.getMarketItems);
// Buscador general o específico para marketplace
router.get("/search", productController.searchProducts);

// --- RUTAS PRIVADAS (Alumnos y Admin General) ---
// Cualquier usuario logueado puede publicar sus cosas
router.post("/publish", verifyToken, marketController.publishItem);

// El dueño puede editar o el Admin General puede moderar
router.put("/edit/:id", verifyToken, productController.updateProduct);

// Solo el dueño o el Admin General pueden eliminar
router.delete("/remove/:id", verifyToken, productController.deleteProduct);

module.exports = router;
