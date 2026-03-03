const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController"); // <-- Verifica esta ruta
const { verifyToken } = require("../../../middlewares/authMiddleware");

router.post("/register", authController.register);
router.post("/login", authController.login);
router.put("/profile", verifyToken, authController.updateProfile);

module.exports = router;
