const express = require("express");
const router = express.Router();
const iaController = require("../controllers/iaController");
const {
  verifyToken,
  isAdminC, // Solo traemos el de Cafetería
} = require("../../../middlewares/authMiddleware");

// Aquí entran A, AL, A_V porque todos compran, pero solo consultan.
router.get("/ask", verifyToken, iaController.ask);
router.get("/results", verifyToken, iaController.results);

// Estas rutas son PRIVADAS para la empresa de la cafetería.
router.post("/train", verifyToken, isAdminC, iaController.train);
router.post("/reset", verifyToken, isAdminC, iaController.reset);

router.post("/a", iaController.reset);
router.post("/b", iaController.train);

module.exports = router;
