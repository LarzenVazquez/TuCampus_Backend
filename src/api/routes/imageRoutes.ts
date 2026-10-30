import { Router } from "express";
import { servirImagen } from "../controllers/imageController";

const router = Router();

router.get("/:id", servirImagen);

export default router;
