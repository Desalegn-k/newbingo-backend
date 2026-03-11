const express = require("express");
const router = express.Router();
const withdrawController = require("../controllers/withdrawController");

router.post("/direct", withdrawController.directWithdraw);
router.post("/manual/send-otp", withdrawController.sendManualWithdrawOTP);
router.post("/manual/verify", withdrawController.verifyManualWithdraw);
// Admin route to get manual withdraw requests
router.get("/admin/manual-withdraws", withdrawController.getManualWithdraws);
// Admin route to get direct withdraw requests
router.get("/admin/direct-withdraws", withdrawController.getDirectWithdraws);
// admin route to approve manual withdraw
router.post("/admin/manual-withdraws/update-status", withdrawController.updateWithdrawStatus);
// admin route to approve direct withdraw
router.post("/admin/direct-withdraws/update-status", withdrawController.updateDirectWithdrawStatus);

module.exports = router;
