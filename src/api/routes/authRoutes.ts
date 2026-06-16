import { Router } from "express";
import { authController } from "../controllers/authController";
import { verifyToken } from "../../middlewares/authMiddleware";
import {
  validateRegister,
  validateLogin,
  validateForgotPassword,
  validateResetPassword,
  validateVerify2FA,
} from "../../middlewares/validationMiddleware";
import multer from "multer";

const router = Router();

// --- CONFIGURACIÓN DE MULTER CON VALIDACIÓN DE TIPO MIME Y TAMAÑO (A08 OWASP) ---
const storage = multer.diskStorage({
  destination: "uploads/profiles/",
  filename: (_req, file, cb) =>
    cb(null, Date.now() + "-" + file.originalname),
});

const fileFilter = (
  _req: any,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback,
) => {
  const allowedMimes = ["image/jpeg", "image/png", "image/webp"];
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new Error(
        "Tipo de archivo no permitido. Solo se aceptan JPG, PNG y WEBP.",
      ),
    );
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB máximo
});

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

// Subida de archivos de identidad / Perfil con validación MIME y tamaño
router.post(
  "/upload-identity",
  verifyToken,
  (req: any, res: any, next: any) => {
    upload.single("image")(req, res, (err: any) => {
      if (err instanceof multer.MulterError) {
        return res.status(400).json({ message: "Archivo demasiado grande. Máximo 5MB." });
      } else if (err) {
        return res.status(400).json({ message: err.message });
      }
      next();
    });
  },
  authController.uploadSecureFile,
);

// Gestión de seguridad
router.put("/change-password", verifyToken, authController.changePassword);

router.post("/verify-2fa", validateVerify2FA, authController.verify2FA);

router.post("/setup-2fa", verifyToken, authController.setup2FA);

export default router;