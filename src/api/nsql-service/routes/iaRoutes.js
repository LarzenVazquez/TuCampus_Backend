const express = require("express");
const router = express.Router();
const iaController = require("../controllers/iaController");

router.post("/train", iaController.train);
router.get("/quick-buy", iaController.predict);
router.get("/predict/:itemId", iaController.predict);

module.exports = router;
