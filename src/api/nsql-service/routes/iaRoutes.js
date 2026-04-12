const express = require("express");
const router = express.Router();
const iaController = require("../controllers/iaController");
const {
  verifyToken,
  isSeller, // Este permite A_V (tus A con esteroides) y A
  isAdminC, // Para que el de Cafetería pueda ver el status si quiere
} = require("../../../middlewares/authMiddleware");

// --- ADMINISTRACIÓN TÉCNICA (Solo A_V y A) ---
// Usamos isSeller porque en tu middleware valida (rol === "A_V" || rol === "A")
router.post("/train", verifyToken, isSeller, iaController.train);
router.delete("/reset", verifyToken, isSeller, iaController.reset);

// --- MONITOREO (A_V, A y también A_C por si ocupa ver el rendimiento) ---
router.get("/status", verifyToken, isSeller, iaController.getStatus);

// --- CONSUMO GENERAL (Cualquiera logueado: AL, A, A_C, A_V) ---
router.get("/quick-buy", verifyToken, iaController.predict);
router.get("/ask", verifyToken, iaController.ask);
router.post("/feedback", verifyToken, iaController.registerFeedback);

module.exports = router;
