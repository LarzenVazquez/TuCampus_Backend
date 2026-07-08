import { Router } from "express";
import { productController } from "../controllers/productController";
import { verifyToken, isAdminC } from "../../middlewares/authMiddleware";

const router = Router();

// --- RUTAS PÚBLICAS ---
router.get("/items", productController.getProducts);
router.get("/search", productController.searchProducts);
router.get("/items/category/:cat", productController.getProductsByCategory);

// Menú del día habilitado para beca (requiere sesión para saber quién pregunta)
router.get("/menu-beca", verifyToken, productController.getMenuBeca);

router.get("/items/:id", productController.getProductById);

// --- RUTAS PRIVADAS (Solo Admin-C) ---
router.post("/publish", verifyToken, isAdminC, productController.createProduct);
router.put("/edit/:id", verifyToken, isAdminC, productController.updateProduct);
router.delete(
  "/remove/:id",
  verifyToken,
  isAdminC,
  productController.deleteProduct,
);

export default router;
