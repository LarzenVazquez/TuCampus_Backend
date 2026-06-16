import { Router } from "express";
import { authController } from "../controllers/authController";
import { verifyToken } from "../../middlewares/authMiddleware";
import {
  validateRegister,
  validateLogin,
  validateForgotPassword,
  validateResetPassword,
  validateVerify2FA, // Importamos la nueva validación
} from "../../middlewares/validationMiddleware";
import multer from "multer";

const router = Router();
const upload = multer({ dest: "uploads/profiles/" });

// 1. Rutas Públicas (Sin Token)
router.get("/public-key", authController.getPublicKeyEndpoint);
router.post("/register", validateRegister, authController.register);
router.post("/login", validateLogin, authController.login);
router.post(
  "/forgot-password",
  validateForgotPassword,
  authController.forgotPassword,
);
router.post(
  "/reset-password",
  validateResetPassword,
  authController.resetPassword,
);
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

router.post("/verify-2fa", validateVerify2FA, authController.verify2FA);

router.post("/setup-2fa", verifyToken, authController.setup2FA);

export default router;
