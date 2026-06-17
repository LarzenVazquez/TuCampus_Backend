import { Request, Response, NextFunction } from "express";
import { body, validationResult } from "express-validator";

// --- REGLAS DE VALIDACIÓN ---

export const validateRegister = [
  body("nombre")
    .trim()
    .notEmpty()
    .withMessage("El nombre es obligatorio.")
    .isLength({ min: 2, max: 100 })
    .withMessage("El nombre debe tener entre 2 y 100 caracteres.")
    .escape(), // Escapa caracteres especiales para prevenir XSS

  body("email")
    .trim()
    .notEmpty()
    .withMessage("El correo es obligatorio.")
    .isEmail()
    .withMessage("El correo no es válido.")
    .normalizeEmail(), // Normaliza el email

  body("password")
    .notEmpty()
    .withMessage("La contraseña es obligatoria.")
    .isLength({ min: 8 })
    .withMessage("La contraseña debe tener al menos 8 caracteres."),

  body("matricula")
    .optional()
    .trim()
    .isAlphanumeric()
    .withMessage("La matrícula solo puede contener letras y números.")
    .escape(),

  handleValidationErrors,
];

export const validateLogin = [
  body("email")
    .trim()
    .notEmpty()
    .withMessage("El correo es obligatorio.")
    .isEmail()
    .withMessage("El correo no es válido.")
    .normalizeEmail(),

  body("captchaToken").notEmpty().withMessage("El captcha es obligatorio."),

  handleValidationErrors,
];

export const validateForgotPassword = [
  body("email")
    .trim()
    .notEmpty()
    .withMessage("El correo es obligatorio.")
    .isEmail()
    .withMessage("El correo no es válido.")
    .normalizeEmail(),

  handleValidationErrors,
];

export const validateResetPassword = [
  body("token").notEmpty().withMessage("El token es obligatorio."),

  body("newPassword")
    .notEmpty()
    .withMessage("La nueva contraseña es obligatoria.")
    .isLength({ min: 8 })
    .withMessage("La contraseña debe tener al menos 8 caracteres."),

  handleValidationErrors,
];

// Nueva validación agregada para solucionar el error en las rutas
export const validateVerify2FA = [
  body("userId")
    .trim()
    .notEmpty()
    .withMessage("El ID de usuario es obligatorio.")
    .isUUID()
    .withMessage("El ID de usuario no es un formato válido."),

  body("code")
    .trim()
    .notEmpty()
    .withMessage("El código de verificación es obligatorio.")
    .isLength({ min: 6, max: 6 })
    .withMessage("El código debe tener exactamente 6 dígitos.")
    .isNumeric()
    .withMessage("El código solo debe contener números."),

  handleValidationErrors,
];

// --- MANEJADOR DE ERRORES DE VALIDACIÓN ---
function handleValidationErrors(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({
      message: "Error de validación",
      errors: errors.array().map((e) => e.msg),
    });
    return;
  }
  next();
}
