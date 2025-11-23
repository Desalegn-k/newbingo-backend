
const db = require("../config/db");



exports.directWithdraw = async (req, res) => {
  const { phone, amount, method } = req.body;
  // method = "telebirr" or "cbebirr"

  if (!phone || !amount || !method)
    return res.status(400).json({ msg: "All fields required" });

  try {
    const [rows] = await db.query(
      "SELECT main_balance FROM users WHERE phone = ?",
      [phone]
    );

    if (rows.length === 0)
      return res.status(404).json({ msg: "User not found" });

    const balance = rows[0].main_balance;

    if (balance < amount)
      return res.status(400).json({ msg: "Insufficient balance" });

    // deduct balance
    await db.query(
      "UPDATE users SET main_balance = main_balance - ? WHERE phone = ?",
      [amount, phone]
    );
    // 2️⃣ Insert record into direct_withdraws table
    await db.query(
      `
      INSERT INTO direct_withdraws 
      ( phone ,amount, method)
      VALUES (  ?, ?, ?)
      `,
      [ phone, amount, method ]
    );

    return res.json({ msg: "Direct withdraw successful" });
  } catch (err) {
    console.log(err);
    return res.status(500).json({ msg: "Server error" });
  }
};


// send otp


const { sendOTP } = require("../utils/otpSender");

exports.sendManualWithdrawOTP = async (req, res) => {
  const { phone, amount, bank, accountNumber, accountHolder } = req.body;

  if (!phone || !amount || !bank || !accountNumber || !accountHolder)
    return res.status(400).json({ msg: "All fields required" });

  try {
    // generate OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    // Insert withdrawal request
    const insertSql = `
      INSERT INTO manual_withdraw_requests 
      (user_phone, amount, bank, account_number, account_holder, otp)
      VALUES (?, ?, ?, ?, ?, ?)`;

    await db.query(insertSql, [
      phone,
      amount,
      bank,
      accountNumber,
      accountHolder,
      otp,
    ]);

    await db.query("UPDATE users SET otp = ? WHERE phone = ?", [otp, phone]);
    console.log(`banck verification otp:${otp}`);

    return res.json({ msg: "OTP sent to console" });
  } catch (err) {
    console.log(err);
    return res.status(500).json({ msg: "Server error" });
  }
};



// manual withdraw

exports.verifyManualWithdraw = async (req, res) => {
  const { phone, amount, otp } = req.body;

  if (!phone || !amount || !otp)
    return res.status(400).json({ msg: "All fields required" });

  try {
    const [rows] = await db.query(
      "SELECT main_balance, otp AS savedOTP FROM users WHERE phone = ?",
      [phone]
    );

    if (rows.length === 0)
      return res.status(404).json({ msg: "User not found" });

    const { main_balance, savedOTP } = rows[0];

    if (savedOTP != otp) return res.status(400).json({ msg: "Invalid OTP" });

    if (main_balance < amount)
      return res.status(400).json({ msg: "Insufficient balance" });

    // withdraw
    await db.query(
      "UPDATE users SET main_balance = main_balance - ?, otp = NULL WHERE phone = ?",
      [amount, phone]
    );

    return res.json({ msg: "Manual withdraw successful" });
  } catch (err) {
    console.log(err);
    return res.status(500).json({ msg: "Server error" });
  }
};
