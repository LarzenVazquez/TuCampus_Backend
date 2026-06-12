import { Router, Request, Response } from "express";
import { authController } from "../controllers/authController";
import { userController } from "../controllers/userController";
import { verifyToken } from "../../middlewares/authMiddleware";

const router = Router();

// Definimos la interfaz localmente para evitar errores globales
interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    rol: string;
    email: string;
    nombre: string;
  };
}

// 1. Obtener perfil completo
router.get("/profile", verifyToken, authController.getProfile);
router.put("/profile", verifyToken, userController.updateProfile);

// 2. Validación rápida de sesión
router.get("/check-session", verifyToken, (req: Request, res: Response) => {
  // Aplicamos el casting aquí
  const authReq = req as AuthenticatedRequest;

  if (!authReq.user) {
    res.status(401).json({ valid: false });
    return;
  }

  res.json({
    valid: true,
    user: {
      id: authReq.user.id,
      rol: authReq.user.rol,
      email: authReq.user.email,
    },
  });
});

export default router;

export { router };
