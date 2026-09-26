import { Router } from "express";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { authController } from "../controllers/authController";
import { verifyToken } from "../../middlewares/authMiddleware";
import { authLimiter } from "../../middlewares/rateLimiters";
import {
  validateRegister,
  validateLogin,
  validateForgotPassword,
  validateResetPassword,
  validateVerify2FA,
} from "../../middlewares/validationMiddleware";
import multer from "multer";

const router = Router();
const UPLOAD_DIR = path.join(process.cwd(), "uploads", "profiles");
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const EXT_POR_MIME: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

const storage = multer.diskStorage({
  destination: UPLOAD_DIR,
  filename: (_req, file, cb) =>
    cb(
      null,
      `${Date.now()}-${crypto.randomBytes(8).toString("hex")}${EXT_POR_MIME[file.mimetype] || ""}`,
    ),
});

const fileFilter = (
  _req: any,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback,
) => {
  if (EXT_POR_MIME[file.mimetype]) {
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

router.get("/public-key", authController.getPublicKeyEndpoint);
router.post(
  "/register",
  authLimiter,
  validateRegister,
  authController.register,
);
router.post("/login", authLimiter, validateLogin, authController.login);
router.post(
  "/forgot-password",
  authLimiter,
  validateForgotPassword,
  authController.forgotPassword,
);
router.post(
  "/reset-password",
  authLimiter,
  validateResetPassword,
  authController.resetPassword,
);
router.get("/verify-email", authController.verifyEmail);
router.post(
  "/verify-2fa",
  authLimiter,
  validateVerify2FA,
  authController.verify2FA,
);

router.get("/profile", verifyToken, authController.getProfile);
router.post("/logout", verifyToken, authController.logout);

router.post(
  "/upload-identity",
  verifyToken,
  (req: any, res: any, next: any) => {
    upload.single("image")(req, res, (err: any) => {
      if (err instanceof multer.MulterError) {
        return res
          .status(400)
          .json({ message: "Archivo demasiado grande. Máximo 5MB." });
      } else if (err) {
        return res.status(400).json({ message: err.message });
      }
      next();
    });
  },
  authController.uploadSecureFile,
);

router.put("/change-password", verifyToken, authController.changePassword);
router.post("/setup-2fa", verifyToken, authController.setup2FA);

export default router;
