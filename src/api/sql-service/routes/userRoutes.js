const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController"); // Reutilizamos el getProfile que ya tienes
const { verifyToken } = require("../../../middlewares/authMiddleware");

router.get("/profile", verifyToken, authController.getProfile);

router.get("/check-session", verifyToken, (req, res) => {
  res.json({ valid: true, user: req.user });
});

module.exports = router;
