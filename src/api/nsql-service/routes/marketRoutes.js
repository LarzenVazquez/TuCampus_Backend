const express = require("express");
const router = express.Router();
const marketController = require("../controllers/marketController");
const { verifyToken, isAdmin } = require("../../../middlewares/authMiddleware");

router.get("/all", marketController.getMarketItems);

router.post("/publish", verifyToken, marketController.publishItem);

router.get("/my-items", verifyToken, marketController.getMyItems);
router.put("/edit/:id", verifyToken, marketController.updateItem);
router.delete("/remove/:id", verifyToken, marketController.deleteItem);
router.patch(
  "/moderate/:id",
  verifyToken,
  isAdmin,
  marketController.moderateItem,
);
module.exports = router;
