import { Router } from "express";
import { iaController } from "../controllers/iaController";
import { verifyToken, isAdminC } from "../../middlewares/authMiddleware";

const router = Router();

router.get("/ask", verifyToken, iaController.ask);
router.get("/results", verifyToken, iaController.results);

router.post("/train", verifyToken, isAdminC, iaController.train);
router.post("/reset", verifyToken, isAdminC, iaController.reset);

export default router;
