const express = require("express");
const router = express.Router();
const adminController = require("../controllers/adminController");
const { verifyToken, isAdmin } = require("../../../middlewares/authMiddleware");

router.use(verifyToken, isAdmin);

router.get("/users", adminController.getUsers);
router.get("/logs", adminController.getLogs);
router.patch("/verify-seller/:id", adminController.updateUserStatus);

module.exports = router;
