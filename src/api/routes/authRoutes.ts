import { Router } from "express";
import { authController } from "../controllers/authController";
import { verifyToken } from "../../middlewares/authMiddleware";
import multer from "multer";

const router = Router();
const upload = multer({ dest: "uploads/profiles/" });

// 1. Rutas Públicas (Sin Token)
router.get("/public-key", authController.getPublicKeyEndpoint);
router.post("/register", authController.register);
router.post("/login", authController.login);
router.post("/forgot-password", authController.forgotPassword);
router.post("/reset-password", authController.resetPassword);
router.get("/verify-email", authController.verifyEmail);

// 2. Rutas Protegidas (Requieren verifyToken)
router.get("/profile", verifyToken, authController.getProfile);
router.post("/logout", verifyToken, authController.logout);

// Subida de archivos de identidad / Perfil
router.post(
  "/upload-identity",
  verifyToken,
  upload.single("image"),
  authController.uploadSecureFile,
);

// Gestión de seguridad
router.put("/change-password", verifyToken, authController.changePassword);

export default router;
