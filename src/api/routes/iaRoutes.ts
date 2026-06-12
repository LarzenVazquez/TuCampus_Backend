import { Router } from "express";
import { iaController } from "../controllers/iaController";
import { verifyToken, isAdminC } from "../../middlewares/authMiddleware";

const router = Router();

// --- RUTAS PÚBLICAS PARA USUARIOS AUTENTICADOS ---
// Accesibles por cualquier rol: A, AL, A_V (todos compran/consultan)
router.get("/ask", verifyToken, iaController.ask);
router.get("/results", verifyToken, iaController.results);

// --- RUTAS PRIVADAS (Solo Admin-C) ---
router.post("/train", verifyToken, isAdminC, iaController.train);
router.post("/reset", verifyToken, isAdminC, iaController.reset);

router.post("/a", iaController.train);

export default router;
