const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const { verifyToken } = require("../../../middlewares/authMiddleware");
const multer = require("multer");

// Configuración de almacenamiento temporal para multer
const upload = multer({ dest: "uploads/profiles/" });

// 1. Rutas Públicas (Sin Token)
router.get("/public-key", authController.getPublicKeyEndpoint);
router.post("/register", authController.register);
router.post("/login", authController.login);
router.post("/forgot-password", authController.forgotPassword);
router.get("/verify-email", authController.verifyEmail);

// 2. Rutas Protegidas (Requieren verifyToken)
// Estas rutas ahora recibirán el rol en formato sigla ('A', 'A_C', 'Al', 'A_V')
router.get("/profile", verifyToken, authController.getProfile);
router.post("/logout", verifyToken, authController.logout);

// Subida de archivos de identidad / Perfil
router.post(
  "/upload-identity",
  verifyToken,
  upload.single("image"),
  authController.uploadSecureFile,
);
// Rutas para recuperación (Olvido)
router.post("/forgot-password", authController.forgotPassword);
router.post("/reset-password", authController.resetPassword);
router.put("/change-password", verifyToken, authController.changePassword);

// Ruta para cambio manual (Logueado)
router.put("/change-password", verifyToken, authController.changePassword);

module.exports = router;
