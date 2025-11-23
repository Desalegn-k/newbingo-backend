const db = require("../config/db");

exports.deposit = async (req, res) => {
  const userId = req.user.id; // from JWT
  const { amount, method } = req.body;

  try {
    if (!amount || !method) {
      return res.status(400).json({ msg: "Amount and method are required" });
    }

    // save transaction as pending
    await db.query(
      "INSERT INTO transactions (user_id, type, amount, method, status) VALUES (?, 'deposit', ?, ?, 'pending')",
      [userId, amount, method]
    );

    return res.json({
      success: true,
      msg: `
    <p style="
      font-family: Arial, sans-serif;
      font-size: 20px;
         background: linear-gradient(to right,aqua,   orange,rgb(0, 255, 4));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
      line-height: 1.5;
      background-color: #f9f9f9;
      padding: 10px;
      border: 1px solid #ddd;
      border-radius: 5px;
    ">
      Deposit request created. Please complete the payment on your phone using the following information:<br><br>
      <strong>Telebirr</strong><br>
      Account Name: Desalegn<br>
      Phone Number: 0924644564<br><br>
      <strong>CBE Birr</strong><br>
      Account Name: Desalegn Kerie Abebe<br>
      Account Number: 0932655680
    </p>
  `,
    });

  } catch (err) {
    console.log("Deposit Error:", err);
    return res.status(500).json({ msg: "Server error" });
  }
};



exports.confirmDeposit = async (req, res) => {
  const { transactionId } = req.body;

  try {
    const [rows] = await db.query("SELECT * FROM transactions WHERE id = ?", [
      transactionId,
    ]);

    if (rows.length === 0)
      return res.status(404).json({ msg: "Transaction not found" });

    const transaction = rows[0];

    if (transaction.status !== "pending")
      return res.status(400).json({ msg: "Transaction already processed" });

    // Add to balance
    await db.query(
      "UPDATE users SET main_balance = main_balance + ? WHERE id = ?",
      [transaction.amount, transaction.user_id]
    );

    // update transaction
    await db.query("UPDATE transactions SET status = 'success' WHERE id = ?", [
      transactionId,
    ]);

    return res.json({ success: true, msg: "Deposit confirmed" });
  } catch (err) {
    console.log(err);
    return res.status(500).json({ msg: "Server error" });
  }
};


exports.getPendingDeposits = async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT * FROM transactions WHERE type='deposit' AND status='pending'"
    );
    res.json(rows);
  } catch (err) {
    console.log(err);
    res.status(500).json({ msg: "Server error" });
  }
};
