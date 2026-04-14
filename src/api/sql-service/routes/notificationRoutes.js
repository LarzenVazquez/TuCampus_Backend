const express = require("express");
const router = express.Router();
const { verifyToken } = require("../../../middlewares/authMiddleware");
const notificationController = require("../controllers/notificationController");

router.get("/", verifyToken, notificationController.getMisNotificaciones);
router.put("/read", verifyToken, notificationController.marcarLeidas);

module.exports = router;