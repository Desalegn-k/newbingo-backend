const express = require("express");
const router = express.Router();
const { verifyToken } = require("../middleware/authMiddleware");
const depositController = require("../controllers/depositController");
const verifyAdmin = require("../middleware/verifyAdmin");

router.post("/create", verifyToken, depositController.deposit);
router.post(
  "/confirm",
  verifyToken,verifyAdmin,
  depositController.confirmDeposit
);
router.get(
  "/admin/transactions",
  verifyToken,
  verifyAdmin,
  depositController.getPendingDeposits
);


module.exports = router;
