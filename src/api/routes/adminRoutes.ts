import { Router } from "express";
import { adminController } from "../controllers/adminController";
import { verifyToken, isAdmin } from "../../middlewares/authMiddleware";

const router = Router();

// Middleware global para todas las rutas de este archivo
// Garantiza que solo el Administrador Maestro (rol 'A') pueda acceder
router.use(verifyToken, isAdmin);

// Listado de usuarios con estadísticas
router.get("/users", adminController.getUsers);

// Logs de actividad del sistema
router.get("/logs", adminController.getLogs);

// Actualizar rol y verificado (Para cambios manuales del Admin)
router.patch("/update-status/:id", adminController.updateUserStatus);

// Verificar vendedor específicamente (Promueve a A_V)
router.patch("/verify-seller/:id", adminController.verifySeller);

// Eliminar usuario
router.delete("/user/:id", adminController.deleteUser);

// Estadísticas generales del sistema
router.get("/stats", adminController.getStats);

export default router;
