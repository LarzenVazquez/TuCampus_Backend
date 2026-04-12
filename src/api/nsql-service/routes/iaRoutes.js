const express = require("express");
const router = express.Router();
const iaController = require("../controllers/iaController");
const {
  verifyToken,
  isAdminC,
} = require("../../../middlewares/authMiddleware");

router.post("/train", verifyToken, isAdminC, iaController.train);
router.get("/status", verifyToken, isAdminC, iaController.getStatus);
router.delete("/reset", verifyToken, isAdminC, iaController.reset);
router.get("/quick-buy", verifyToken, iaController.predict);

router.get("/ask", verifyToken, iaController.ask);

router.post("/feedback", verifyToken, iaController.registerFeedback);

module.exports = router;
