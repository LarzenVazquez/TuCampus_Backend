import { Router, Request, Response } from "express";
import { authController } from "../controllers/authController";
import { userController } from "../controllers/userController";
import { verifyToken } from "../../middlewares/authMiddleware";

const router = Router();

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    rol: string;
    email: string;
    nombre: string;
  };
}

router.get("/profile", verifyToken, authController.getProfile);
router.put("/profile", verifyToken, userController.updateProfile);

router.get("/files", verifyToken, userController.getProfileFiles);

router.get("/check-session", verifyToken, (req: Request, res: Response) => {
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
      nombre: authReq.user.nombre,
    },
  });
});

export default router;
