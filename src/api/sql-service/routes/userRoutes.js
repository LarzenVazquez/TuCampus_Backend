const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const { verifyToken } = require("../../../middlewares/authMiddleware");

// 1. Obtener perfil completo (incluye fotoUrl y vendedor_verificado)
router.get("/profile", verifyToken, authController.getProfile);

// 2. Validación rápida de sesión
// IMPORTANTE: req.user debe contener el { id, rol, email } extraído del JWT
router.get("/check-session", verifyToken, (req, res) => {
  res.json({
    valid: true,
    user: {
      id: req.user.id,
      rol: req.user.rol, // Aquí llegará 'A', 'Al', etc.
      email: req.user.email,
    },
  });
});

module.exports = router;
