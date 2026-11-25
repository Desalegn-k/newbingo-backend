
const db = require("../config/db");
const bcrypt = require("bcryptjs");



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
      return res.status(400).json({ msg: "Insufficient Balance" });
    if (withdrawAmount < 100)
      return res.status(400).json({ msg: "Minimum withdraw is 100 ETB" });

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
      msg: "Direct withdrawal successful. The balance will be added to your account in a few minutes.",
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

exports.getMyWithdrawHistory = async (req, res) => {
  try {
    const [[user]] = await db.query("SELECT phone FROM users WHERE id = ?", [
      req.user.id,
    ]);

    if (!user) return res.status(404).json({ msg: "User not found" });

    const [directWithdraws] = await db.query(
      `SELECT id, amount, method, status, created_at, 'direct' AS withdrawal_type
       FROM direct_withdraws
       WHERE phone = ?
       ORDER BY created_at DESC, id DESC`,
      [user.phone],
    );
    const [manualWithdraws] = await db.query(
      `SELECT id, amount, bank AS method, status, created_at, 'bank' AS withdrawal_type
       FROM manual_withdraw_requests
       WHERE user_phone = ?
       ORDER BY created_at DESC, id DESC`,
      [user.phone],
    );

    const withdrawals = [...directWithdraws, ...manualWithdraws]
      .map((withdrawal) => ({
        ...withdrawal,
        status: withdrawal.status === "verified" ? "success" : withdrawal.status,
      }))
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    res.json(withdrawals);
  } catch (error) {
    console.error("getMyWithdrawHistory error:", error);
    res.status(500).json({ msg: "Unable to load withdrawal history" });
  }
};

exports.requestManualWithdraw = async (req, res) => {
  const { amount, bank, accountNumber, accountHolder, password } = req.body;
  const withdrawAmount = Number(amount);

  if (
    !amount ||
    !bank ||
    !accountNumber ||
    !accountHolder ||
    typeof password !== "string" ||
    !password
  ) {
    return res.status(400).json({ msg: "All fields required" });
  }

  if (!/^\d+$/.test(String(accountNumber))) {
    return res.status(400).json({ msg: "Account number must be a number" });
  }

  if (!Number.isFinite(withdrawAmount) || withdrawAmount < 100) {
    return res.status(400).json({ msg: "Minimum withdraw is 100 ETB" });
  }

  let connection;
  let transactionStarted = false;

  try {
    connection = await db.getConnection();
    await connection.beginTransaction();
    transactionStarted = true;

    const [users] = await connection.query(
      "SELECT phone, password, main_balance FROM users WHERE id = ? FOR UPDATE",
      [req.user.id],
    );
    const user = users[0];

    if (!user) {
      await connection.rollback();
      transactionStarted = false;
      return res.status(404).json({ msg: "User not found" });
    }

    if (!(await bcrypt.compare(password, user.password))) {
      await connection.rollback();
      transactionStarted = false;
      return res.status(401).json({ msg: "Incorrect password" });
    }

    if (Number(user.main_balance) < withdrawAmount) {
      await connection.rollback();
      transactionStarted = false;
      return res.status(400).json({ msg: "Insufficient Balance" });
    }

    await connection.query(
      "UPDATE users SET main_balance = main_balance - ? WHERE id = ?",
      [withdrawAmount, req.user.id],
    );
    await connection.query(
      `INSERT INTO manual_withdraw_requests
       (user_phone, amount, bank, account_number, account_holder, otp)
       VALUES (?, ?, ?, ?, ?, NULL)`,
      [user.phone, withdrawAmount, bank, accountNumber, accountHolder],
    );

    await connection.commit();
    transactionStarted = false;

    return res.json({
      msg: "Bank withdrawal request submitted for admin review.",
    });
  } catch (error) {
    if (transactionStarted) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error("Manual withdrawal rollback failed:", rollbackError);
      }
    }
    console.error("Manual withdrawal request failed:", error);
    return res.status(500).json({ msg: "Server error" });
  } finally {
    if (connection) connection.release();
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
