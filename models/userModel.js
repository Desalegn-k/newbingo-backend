const db = require("../config/db");

const User = {
  create: async ({ username, phone, password, otp, referral_code }) => {
    const sql = `
      INSERT INTO users (username, phone, password, otp, referral_code)
      VALUES (?, ?, ?, ?, ?)
    `;
    await db.query(sql, [username, phone, password, otp, referral_code]);
  },

  findByPhone: async (phone) => {
    const [rows] = await db.query("SELECT * FROM users WHERE phone = ?", [
      phone,
    ]);
    return rows;
  },

  verifyOTP: async (phone, otp) => {
    const [result] = await db.query(
      "UPDATE users SET is_verified = TRUE WHERE phone = ? AND otp = ?",
      [phone, otp]
    );
    return result;
  },
};

module.exports = User;
