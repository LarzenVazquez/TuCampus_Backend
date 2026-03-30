const express = require("express");
const router = express.Router();
const adminController = require("../controllers/adminController");
const { verifyToken, isAdmin } = require("../../../middlewares/authMiddleware");

// Middleware global para todas las rutas de este archivo
// IMPORTANTE: Tu middleware isAdmin ahora debe validar que req.user.rol === 'A'
router.use(verifyToken, isAdmin);

// Listado de usuarios con estadísticas
router.get("/users", adminController.getUsers);

// Logs de actividad del sistema
router.get("/logs", adminController.getLogs);

// Actualizar rol y verificado (Para cambios manuales del Admin)
// Se usa PATCH porque solo actualizamos fragmentos del usuario
router.patch("/update-status/:id", adminController.updateUserStatus);

// Verificar vendedor específicamente (Promueve a A_V)
router.patch("/verify-seller/:id", adminController.verifySeller);

// Eliminar usuario
router.delete("/user/:id", adminController.deleteUser);

module.exports = router;
