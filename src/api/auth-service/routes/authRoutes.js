const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const { verifyToken } = require("../../../middlewares/authMiddleware");
const multer = require("multer");

const upload = multer({ dest: "uploads/profiles/" });

router.get("/public-key", authController.getPublicKeyEndpoint);
router.post("/register", authController.register);
router.post("/login", authController.login);

router.post("/logout", verifyToken, authController.logout);
router.post(
  "/upload-identity",
  verifyToken,
  upload.single("image"),
  authController.uploadSecureFile,
);

module.exports = router;
