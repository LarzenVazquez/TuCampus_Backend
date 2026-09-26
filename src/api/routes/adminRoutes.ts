import { Router } from "express";
import { adminController } from "../controllers/adminController";
import { verifyToken, isAdmin } from "../../middlewares/authMiddleware";
import { validateCreateStaff } from "../../middlewares/validationMiddleware";

const router = Router();
router.use(verifyToken, isAdmin);
router.get("/users", adminController.getUsers);

router.post("/users", validateCreateStaff, adminController.createUser);

router.get("/logs", adminController.getLogs);

router.patch("/update-status/:id", adminController.updateUserStatus);

router.patch("/verify-seller/:id", adminController.verifySeller);

router.patch("/beca/:id", adminController.toggleBeca);

router.patch("/user/:id/active", adminController.toggleActive);

router.get("/stats", adminController.getStats);

export default router;
