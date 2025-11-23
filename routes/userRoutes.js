const db = require("../config/db");
const express = require("express");
const router = express.Router();
const { verifyToken } = require("../middleware/authMiddleware");
// const userController = require("../controllers/userController");
const {
  // sendOTP,
  register,
  verifyOTP,
  login,
  getProfile,
  sendResetOTP,
  resetPassword,
  updateProfile,
  createAdmin,
} = require("../controllers/userController");
const verifyAdmin = require("../middleware/verifyAdmin");

// router.post("/send-otp", sendOTP);
router.post("/register", register);
router.post("/verify-otp", verifyOTP);
router.post("/login", login);
//to get user data from the table
// GET /api/auth/me
router.get("/me", verifyToken, async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT id, phone, main_balance, role,username FROM users WHERE id = ?",
      [req.user.id]
    );

    if (rows.length === 0)
      return res.status(404).json({ message: "User not found" });

    return res.json(rows[0]);
  } catch (err) {
    console.log(err);
    return res.status(500).json({ message: "Server error" });
  }
});

// Password reset flow
router.post("/send-reset-otp", sendResetOTP);
router.post("/reset-password", resetPassword);
// protected route
router.get("/get-profile", verifyToken, getProfile);
router.put("/update-profile", verifyToken, updateProfile);

//create admin

router.post("/create-admin", verifyToken, verifyAdmin, createAdmin);

module.exports = router;
