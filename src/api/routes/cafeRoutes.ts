import { Router } from "express";
import { productController } from "../controllers/productController";
import {
  verifyToken,
  isAdminC,
  hasRole,
} from "../../middlewares/authMiddleware";
import {
  estadoImagenes,
  migrarImagenes,
  recibirImagen,
  subirImagen,
} from "../controllers/imageController";

const router = Router();

router.get("/items", productController.getProducts);
router.get("/search", productController.searchProducts);
router.get("/items/category/:cat", productController.getProductsByCategory);

router.get("/menu-beca", verifyToken, productController.getMenuBeca);

router.get("/my-items", verifyToken, productController.getMyItems);

router.get("/items/:id", productController.getProductById);

router.post(
  "/images",
  verifyToken,
  isAdminC,
  recibirImagen,
  subirImagen("producto"),
);
router.get("/images/estado", verifyToken, hasRole("A_C", "A"), estadoImagenes);
router.post(
  "/images/migrar",
  verifyToken,
  hasRole("A_C", "A"),
  migrarImagenes("producto"),
);

router.post("/publish", verifyToken, isAdminC, productController.createProduct);
router.put("/edit/:id", verifyToken, isAdminC, productController.updateProduct);
router.delete(
  "/remove/:id",
  verifyToken,
  isAdminC,
  productController.deleteProduct,
);

export default router;
