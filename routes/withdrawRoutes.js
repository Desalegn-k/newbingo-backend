const express = require("express");
const router = express.Router();
const withdrawController = require("../controllers/withdrawController");

router.post("/direct", withdrawController.directWithdraw);
router.post("/manual/send-otp", withdrawController.sendManualWithdrawOTP);
router.post("/manual/verify", withdrawController.verifyManualWithdraw);

module.exports = router;
