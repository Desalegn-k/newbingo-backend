
const db = require("../config/db");

const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/userModel");
// Import the OTP sender
const { sendOTP } = require('../utils/smsService');

// 1️⃣ Send OTP
// const { sendOTP } = require("../utils/otpSender");
 

// exports.sendOTP = async (req, res) => {
//   try {
//     const { phone } = req.body;
//     if (!phone)
//       return res.status(400).json({ message: "Phone number required" });

//     const otp = Math.floor(1000 + Math.random() * 9000).toString();
//     const users = await User.findByPhone(phone);

//     if (users.length > 0) {
//       await db.query("UPDATE users SET otp = ? WHERE phone = ?", [otp, phone]);
//     } else {
//       await db.query("INSERT INTO users (phone, otp) VALUES (?, ?)", [
//         phone,
//         otp,
//       ]);
//     }

//     // ✅ use the helper function
//     await sendOTP(phone, otp);

//     res.json({ message: "OTP sent successfully" });
//   } catch (error) {
//     console.error(error);
//     res.status(500).json({ message: "Server error" });
//   }
// };

// 2️⃣ Register and send otp
// ✅ Register User & Send OTP (for verification)
 

// ----------------------------------------------------------------------
// Phone validation helper (country‑specific)
// ----------------------------------------------------------------------
function validatePhoneByCountry(fullPhone) {
  const countryRules = {
    "+251": { length: 9, firstDigit: "9" }, // Ethiopia – 9 digits, must start with 9
    "+1":   { length: 10 },                 // USA/Canada – 10 digits
    "+44":  { length: 10 },                 // UK – 10 digits (excluding leading 0)
    "+254": { length: 9 },                  // Kenya – 9 digits
    "+255": { length: 9 },                  // Tanzania – 9 digits
    "+256": { length: 9 },                  // Uganda – 9 digits
  };

  const matchedCode = Object.keys(countryRules).find(code => fullPhone.startsWith(code));
  if (!matchedCode) {
    // Unknown country code – fallback to generic 10‑15 digit (with optional +)
    const genericRegex = /^\+?[0-9]{10,15}$/;
    return genericRegex.test(fullPhone);
  }

  const rule = countryRules[matchedCode];
  const localNumber = fullPhone.slice(matchedCode.length);

  if (!/^\d+$/.test(localNumber)) return false;
  if (localNumber.length !== rule.length) return false;
  if (rule.firstDigit && localNumber[0] !== rule.firstDigit) return false;

  return true;
}

// ----------------------------------------------------------------------
// Register new user
// ----------------------------------------------------------------------
exports.register = async (req, res) => {
  try {
    const { username, phone, password } = req.body;

    if (!username || !phone || !password)
      return res.status(400).json({ message: "All fields required" });

    // ---- Phone validation ----
    if (!validatePhoneByCountry(phone)) {
      return res.status(400).json({
        message: "Invalid phone number format for the selected country.",
      });
    }

    // Check if phone already exists
    const [user] = await db.query("SELECT * FROM users WHERE phone = ?", [
      phone,
    ]);
    if (user.length > 0)
      return res.status(400).json({ message: "Phone already registered" });

    // Generate OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Generate referral code
    function generateReferralCode(length = 9) {
      const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
      let code = "";
      for (let i = 0; i < length; i++) {
        const randomIndex = Math.floor(Math.random() * chars.length);
        code += chars[randomIndex];
      }
      return code;
    }
    const referralCode = generateReferralCode();

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert user
    await db.query(
      "INSERT INTO users (username, phone, password, otp, referral_code, is_verified) VALUES (?, ?, ?, ?, ?, ?)",
      [username, phone, hashedPassword, otp, referralCode, 0],
    );

    // 🔥 Send OTP via SMS
    const smsResult = await sendOTP(phone, otp);

    if (smsResult.success) {
      console.log(`📲 OTP sent to ${phone}`);
    } else {
      console.error(`⚠️ OTP delivery failed for ${phone}: ${smsResult.error}`);
      // Optionally, you could delete the user or mark that SMS failed.
      // For now, we still return success to the client because the user is created.
    }

    console.log(`📲 Registration OTP for ${phone}: ${otp}`);

    res.status(200).json({
      success: true,
      message: "User registered successfully, OTP sent to console",
      phone,
    });
  } catch (error) {
    console.error("❌ Registration Error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// ----------------------------------------------------------------------
// Login (optional validation added)
// ----------------------------------------------------------------------
exports.login = async (req, res) => {
  try {
    const { phone, password } = req.body;

    if (!phone || !password)
      return res.status(400).json({ message: "Phone and password required" });

    // Optional: validate phone format (same helper)
    if (!validatePhoneByCountry(phone)) {
      return res.status(400).json({ message: "Invalid phone number format." });
    }

    const users = await User.findByPhone(phone);
    if (users.length === 0)
      return res.status(400).json({ message: "User not found" });

    const user = users[0];

    if (!user.is_verified)
      return res.status(403).json({ message: "Please verify your OTP first" });

    const isMatch = bcrypt.compareSync(password, user.password);
    if (!isMatch)
      return res.status(400).json({ message: "Incorrect password" });

    const token = jwt.sign(
      {
        id: user.id,
        phone: user.phone,
        main_balance: user.main_balance,
        role: user.role,
      },
      "secret123",
      { expiresIn: "1d" }
    );

    res.json({
      message: "Login successful",
      token,
      main_balance: user.main_balance,
      role: user.role,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

// ... rest of your controller (getProfile, updateProfile, etc.) remains unchanged
// get all users 

exports.getAllUsers = async (req, res) => {
  try {
    const [rows] = await db.query("SELECT * FROM users");
    return res.json(rows);
  } catch (err) {
    console.log(err);
    return res.status(500).json({ msg: "Server error" });
  }
};

//admin controller
// const db = require("../config/db");
// const bcrypt = require("bcryptjs");

exports.createAdmin = async (req, res) => {
  const { username, phone, password } = req.body;

  if (!username || !phone || !password)
    return res.status(400).json({ msg: "All fields required" });

  try {
    const hashed = bcrypt.hashSync(password, 10);

    await db.query(
      "INSERT INTO users (username, phone, password, role, is_verified) VALUES (?, ?, ?, 'admin', 1)",
      [username, phone, hashed]
    );

    return res.json({ msg: "Admin account created successfully" });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ msg: "Server error" });
  }
};

// 3️⃣ Verify OTP
exports.verifyOTP = async (req, res) => {
  try {
    const { phone, otp } = req.body;
    if (!phone || !otp)
      return res.status(400).json({ message: "Phone and OTP required" });

    const result = await User.verifyOTP(phone, otp);
    if (result.affectedRows === 0)
      return res.status(400).json({ message: "Invalid OTP" });

    res.json({ message: "Phone verified successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

 

exports.login = async (req, res) => {
  try {
    const { phone, password } = req.body;

    if (!phone || !password)
      return res.status(400).json({ message: "Phone and password required" });

    const users = await User.findByPhone(phone);
    if (users.length === 0)
      return res.status(400).json({ message: "User not found" });

    const user = users[0];

    if (!user.is_verified)
      return res.status(403).json({ message: "Please verify your OTP first" });

    const isMatch = bcrypt.compareSync(password, user.password);
    if (!isMatch)
      return res.status(400).json({ message: "Incorrect password" });

    // ⭐ ADD ROLE TO TOKEN HERE ⭐
    const token = jwt.sign(
      {
        id: user.id,
        phone: user.phone,
        main_balance: user.main_balance,

        role: user.role, // 👈 added role
        
      },
      "secret123",
      { expiresIn: "1d" }
    );

    res.json({
      message: "Login successful",
      token,
      main_balance: user.main_balance,
      role: user.role,
      //  optional: send role back to frontend
 
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};



// ✅ Controller: Get logged-in user profile
exports.getProfile = async (req, res) => {
  try {
    const [users] = await db.query(
      "SELECT id, username, phone, referral_code FROM users WHERE id = ?",
      [req.user.id]
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    res.status(200).json({
      success: true,
      message: "Profile fetched successfully",
      user: users[0]
    });
  } catch (error) {
    console.error("❌ Error fetching profile:", error);
    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
};


// ✅ Update Profile (username, phone)
exports.updateProfile = async (req, res) => {
  const { username, phone } = req.body;
  const userId = req.user.id;

  try {
    await db.query("UPDATE users SET username = ?, phone = ? WHERE id = ?", [username, phone, userId]);
    res.status(200).json({ success: true, message: "Profile updated successfully" });
  } catch (error) {
    console.error("❌ Update Profile Error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ✅ Send OTP for Password Reset
exports.sendResetOTP = async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ message: "Phone number required" });

    const [user] = await db.query("SELECT * FROM users WHERE phone = ?", [phone]);
    if (user.length === 0)
      return res.status(404).json({ success: false, message: "User not found" });

    const otp = Math.floor(1000 + Math.random() * 9000).toString();
    await db.query("UPDATE users SET otp = ? WHERE phone = ?", [otp, phone]);

    await sendOTP(phone, otp);
    res.status(200).json({ success: true, message: "OTP sent successfully for password reset" });
  } catch (error) {
    console.error("❌ Send Reset OTP Error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};


// ✅ Update Profile (username, phone)
exports.updateProfile = async (req, res) => {
  const { username, phone } = req.body;
  const userId = req.user.id;

  try {
    if (!username || !phone) {
      return res.status(400).json({ success: false, message: "Username and phone are required" });
    }

    await db.query(
      "UPDATE users SET username = ?, phone = ? WHERE id = ?",
      [username, phone, userId]
    );

    res.status(200).json({
      success: true,
      message: "Profile updated successfully",
    });
  } catch (error) {
    console.error("❌ Update Profile Error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};



// ✅ Reset Password
exports.resetPassword = async (req, res) => {
  const { phone, otp, password } = req.body;

  try {
    if (!phone || !otp || !password) {
      return res.status(400).json({
        success: false,
        message: "Phone, OTP, and new password are required",
      });
    }

    const [user] = await db.query("SELECT * FROM users WHERE phone = ?", [phone]);

    if (user.length === 0)
      return res.status(404).json({ success: false, message: "User not found" });

    if (user[0].otp != otp)
      return res.status(400).json({ success: false, message: "Invalid OTP" });

    const hashedPassword = await bcrypt.hash(password, 10);

    await db.query("UPDATE users SET password = ?, otp = NULL WHERE phone = ?", [
      hashedPassword,
      phone,
    ]);

    res.status(200).json({
      success: true,
      message: "Password reset successfully",
    });
  } catch (error) {
    console.error("❌ Reset Password Error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};