import { Router } from "express";
import { adminController } from "../controllers/adminController";
import { verifyToken, isAdmin } from "../../middlewares/authMiddleware";

const router = Router();

// Middleware global para todas las rutas de este archivo
// Garantiza que solo el Administrador Maestro (rol 'A') pueda acceder
router.use(verifyToken, isAdmin);

// Listado de usuarios con estadísticas
router.get("/users", adminController.getUsers);

// Crear cuentas de staff (Admin, Cocina, Vendedor). Los alumnos se
// registran ellos mismos por el flujo público, nunca desde aquí.
router.post("/users", adminController.createUser);

// Logs de actividad del sistema
router.get("/logs", adminController.getLogs);

// Actualizar rol y verificado (Para cambios manuales del Admin)
router.patch("/update-status/:id", adminController.updateUserStatus);

// Verificar vendedor específicamente (Promueve a A_V)
router.patch("/verify-seller/:id", adminController.verifySeller);

// Asignar / revocar beca alimenticia
router.patch("/beca/:id", adminController.toggleBeca);

// Activar / desactivar cuenta (reemplaza el borrado físico: nunca se
// elimina un usuario, porque tiene órdenes/productos/logs relacionados
// con ON DELETE RESTRICT).
router.patch("/user/:id/active", adminController.toggleActive);

// Estadísticas generales del sistema
router.get("/stats", adminController.getStats);

export default router;