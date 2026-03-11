
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

    // const balance = rows[0].main_balance;
    const balance = Number(rows[0].main_balance);
    const withdrawAmount = Number(amount);

    console.log(balance);
    console.log(amount);

    if (balance < withdrawAmount)
      return res.status(400).json({
        msg: `<p >Insufficient Balance</p>`,
      });
    if (withdrawAmount < 100)
      return res.status(400).json({
        msg: `<p >Minimum withdraw is 100 ETB</p>`,
      });

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
 


    return res.json({
      msg: `<p style="
    color: green;
     background-color:lightgreen;
     border:solid;
     border-radius:10px;
     border-color:green;
      padding:3px
     width:100%;
      
    ">Direct withdraw successful,the balance will be added to your account in few minutes .</p>`,
    });
  } catch (err) {
    console.log(err);
    return res.status(500).json({ msg: "Server error" });
  }
};
// write admin controllers to get withdraw requests
exports.getDirectWithdraws = async (req, res) => {
  try {   
    const [rows] = await db.query("SELECT * FROM direct_withdraws ORDER BY created_at ASC");
    return res.json(rows);
  } catch (err) {     
    console.log(err);
    return res.status(500).json({ msg: "Server error" });
  }           
};
// write admin controllers to get manual withdraw requests
exports.getManualWithdraws = async (req, res) => {
  try {     
    const [rows] = await db.query("SELECT * FROM manual_withdraw_requests ORDER BY created_at ASC");
    return res.json(rows);
  } catch (err) {     
    console.log(err);
    return res.status(500).json({ msg: "Server error" });
  } 
};

// send otp


const { sendOTP } = require("../utils/smsService");

exports.sendManualWithdrawOTP = async (req, res) => {
  const { phone, amount, bank, accountNumber, accountHolder } = req.body;

  if (!phone || !amount || !bank || !accountNumber || !accountHolder)
    return res.status(400).json({ msg: "All fields required" });
    if (isNaN(accountNumber)) {
      return (
        res.status(400).
        json({ msg: "Account number must be a number" })
      );
    }

  try {
    // Check user exists and get balance
    const [userRows] = await db.query(
      "SELECT main_balance FROM users WHERE phone = ?",
      [phone],
    );

    if (userRows.length === 0) {
      return res.status(404).json({ msg: "User not found" });
    }

    const balance = Number(userRows[0].main_balance);
    const withdrawAmount = Number(amount);

    // Validation: minimum amount
    if (withdrawAmount < 100) {
      return res.status(400).json({
        msg: `<p  >Minimum withdraw is 100 ETB</p>`,
      });
    }

    // Validation: sufficient balance
    if (balance < withdrawAmount) {
      return res.status(400).json({
        msg: `<p  >Insufficient Balance</p>`,
      });
    }
    // generate OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    // Insert withdrawal request
     

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
  const { phone, amount, otp, bank, accountNumber, accountHolder } = req.body;

  if (!phone || !amount || !otp || !bank || !accountNumber || !accountHolder)
    return res.status(400).json({ msg: "All fields required" });

  try {
    const [rows] = await db.query(
      "SELECT main_balance, otp AS savedOTP FROM users WHERE phone = ?",
      [phone],
    );

    if (rows.length === 0)
      return res.status(404).json({ msg: "User not found" });

    const { main_balance, savedOTP } = rows[0];

    if (savedOTP != otp) return res.status(400).json({ msg: "Invalid OTP" });

    const balance = Number(main_balance);
    const withdrawAmount = Number(amount);

    if (balance < withdrawAmount)
      return res.status(400).json({
        msg: `<p style="color: red; background-color:pink; border:solid; border-radius:10px; border-color:red; padding:10px; width:350px; margin-left:15px">Insufficient Balance</p>`,
      });

    if (withdrawAmount < 100)
      return res.status(400).json({
        msg: `<p style="color: red !important; background-color:pink; border:solid; border-radius:10px; border-color:red; padding:10px; width:90%;">Minimum withdraw is 100 ETB</p>`,
      });

    // 1. Deduct balance and clear OTP
    await db.query(
      "UPDATE users SET main_balance = main_balance - ?, otp = NULL WHERE phone = ?",
      [amount, phone],
    );

    // 2. Insert the successful withdrawal request (now at the end, after verification)
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
      otp, // the OTP that was just verified
    ]);

    return res.json({
      msg: `<p style="color: green; background-color:lightgreen; border:solid; border-radius:10px; border-color:green; padding:3px; width:100%; ">Bank withdraw successful, the balance will be added to your account in a few minutes.</p>`,
    });
  } catch (err) {
    console.log(err);
    return res.status(500).json({ msg: "Server error" });
  }
};
// update manual withdraw status
exports.updateWithdrawStatus = async (req, res) => {
  const { id, status } = req.body;

  if (!["verified", "rejected"].includes(status)) {
    return res.status(400).json({ message: "Invalid status" });
  }

  try {
    const [result] = await db.query(
      "UPDATE manual_withdraw_requests SET status = ? WHERE id = ? AND status = 'pending'",
      [status, id],
    );

    if (result.affectedRows === 0) {
      return res
        .status(404)
        .json({ message: "Withdraw not found or already processed" });
    }

    res.json({ message: "Status updated successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};
// update direct withdraw status (optional)
exports.updateDirectWithdrawStatus = async (req, res) => {
  const { id, status } = req.body;

  if (!["verified", "rejected"].includes(status)) {
    return res.status(400).json({ message: "Invalid status" });
  }

  try {
    // 1️⃣ Get the withdraw record first
    const [withdrawRows] = await db.query(
      "SELECT * FROM direct_withdraws WHERE id = ? AND status = 'pending'",
      [id],
    );

    if (withdrawRows.length === 0) {
      return res
        .status(404)
        .json({ message: "Withdraw not found or already processed" });
    }

    const withdraw = withdrawRows[0];

    // 2️⃣ If rejected, refund amount back to user's main_balance
    if (status === "rejected") {
      await db.query(
        "UPDATE users SET main_balance = main_balance + ? WHERE phone = ?",
        [withdraw.withdrawAmount, withdraw.user_phone],
      );
    }

    // 3️⃣ Update withdraw status
    await db.query(
      "UPDATE direct_withdraws SET status = ? WHERE id = ?",
      [status, id],
    );

    res.json({ message: `Withdraw ${status} successfully` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};
