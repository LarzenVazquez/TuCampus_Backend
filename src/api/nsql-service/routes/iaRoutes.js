const express = require("express");
const router = express.Router();
const iaController = require("../Controllers/iaController");

router.post("/train", iaController.train);
router.get("/quick-buy", iaController.predict);
router.get("/predict/:itemId", iaController.predict);

module.exports = router;
