const db = require("../config/db");

exports.deposit = async (req, res) => {
  const userId = req.user.id;
  const { amount, method } = req.body;

  try {
    if (!amount || !method) {
      return res.status(400).json({ msg: "Amount and method are required" });
    }
    if (isNaN(amount) || amount < 0) {
      return res.status(400).json({ msg: "Amount must be positive number" });
    }

    const [result] = await db.query(
      "INSERT INTO transactions (user_id, type, amount, method, status) VALUES (?, 'deposit', ?, ?, 'pending')",
      [userId, amount, method],
    );

    return res.json({
      success: true,
      transactionId: result.insertId,
      msg: `
        <div style="
          font-family: 'Segoe UI', Roboto, Arial, Helvetica, sans-serif;
          width: 100% !important;
          margin: 0 auto;
          background: #ffffff;
          border-radius: 16px;
          box-shadow: 0 8px 20px rgba(0,0,0,0.06), 0 2px 6px rgba(0,0,0,0.03);
          padding: 24px;
          color: #1e293b;
          line-height: 1.5;
          border: 1px solid #e9eef2;
        ">
          <!-- Header / Status -->
          <div style="
            display: flex;
            align-items: center;
            gap: 12px;
            margin-bottom: 20px;
            padding-bottom: 16px;
            border-bottom: 1px dashed #d0d9e0;
          ">
            <span style="
              background: #f59e0b10;
              color: #b45309;
              font-weight: 600;
              font-size: 14px;
              padding: 6px 14px;
              border-radius: 40px;
              border: 1px solid #fcd34d50;
            ">⏳ በመጠባበቅ ላይ</span>
            <span style="
              font-size: 14px;
              color: #64748b;
            ">የግብይት መለያ: <strong style="color: #0f172a;">${result.insertId}</strong></span>
          </div>

          <!-- Info text -->
          <p style="
            font-size: 15px;
            color: #334155;
            margin: 0 0 24px 0;
            background: #f8fafc;
            padding: 14px 18px;
            border-radius: 14px;
            border-left: 4px solid #3b82f6;
          ">
            የክፍያ ጥያቄ አስቀምጠዋል። እባክዎ ከዚህ በታች ባለው መረጃ ክፍያዎን ይፈጽሙ እና ከታች ባለው ቦታ <strong>TransactionID</strong> ይላኩ።
          </p>

         
          <!-- Telebirr -->
          <div style="
            background: #f1f5f9;
            border-radius: 14px;
            padding: 18px;
            margin-bottom: 16px;
            border: 1px solid #e2e8f0;
          ">
            <div style="
              display: flex;
              align-items: center;
              gap: 10px;
              margin-bottom: 16px;
            ">
              <!-- 🔁 Replaced emoji with actual logo -->
              <img 
                src="/images/telebirr.jpg" 
                alt="Telebirr" 
                style="
                  height: 80px;
                  width: 80px;
                  border-radius: 50%;
                  border: 1px solid #2772d5;
                "
              />
              <span style="
                background: #8DC63F;
                color: white;
                font-weight: 600;
                font-size: 25px;
                padding: 4px 18px;
                border-radius: 20px;
              ">Telebirr</span>
            </div>
            <div style="display: flex; flex-wrap: wrap; gap: 10px;">
              <div style="min-width: 160px;">
                <div style="font-size: 15px; color: #8DC63F; margin-bottom: 2px;">የአካዉንቱ ባለቤት ስም</div>
                <div style="font-weight: 600; font-size: 18px; color: #8DC63F;">Desalegn</div>
              </div>
              <div>
                <div style="font-size: 15px; color: #8DC63F; margin-bottom: 2px;">ስልክ ቁጥር</div>
                <div style="font-weight: 600; font-size: 18px; color: #8DC63F; letter-spacing: 0.5px;">0924644564</div>
              </div>
            </div>
          </div>

          <!-- CBE Birr -->
          <div style="
            background: #f1f5f9;
            border-radius: 14px;
            padding: 18px;
            border: 1px solid #e2e8f0;
          ">
            <div style="
              display: flex;
              align-items: center;
              gap: 10px;
              margin-bottom: 16px;
            ">
              <img 
                src="/images/cbe1.jpg" 
                alt="CBE Birr" 
                style="
                   height: 80px;
                  width: 80px;
                  border-radius: 50%;
                  border: 1px solid #652279;
                "
              />
              <span style="
                background: #652279;
                color: white;
                font-weight: 600;
                font-size: 25px;
                padding: 4px 18px;
                border-radius: 20px;
              ">CBE Birr</span>
            </div>
            <div style="display: flex; flex-wrap: wrap; gap: 20px;">
              <div style="min-width: 200px;">
                <div style="font-size: 15px; color: #9E168D; margin-bottom: 2px;">የአካዉንቱ ባለቤት ስም</div>
                <div style="font-weight: 600; font-size: 18px; color: #9E168D;">Desalegn Kerie Abebe</div>
              </div>
              <div>
                <div style="font-size: 15px; color: #9E168D; margin-bottom: 2px;">አካውንት ቁጥር</div>
                <div style="font-weight: 600; font-size: 18px; color: #9E168D; letter-spacing: 0.5px;">0932655680</div>
              </div>
            </div>
          </div>

          <!-- Footer note (optional) -->
          <div style="
            margin-top: 24px;
            font-size: 13px;
            color: #64748b;
            text-align: center;
            border-top: 1px solid #e2e8f0;
            padding-top: 16px;
          ">
            ክፍያዎን ካጠናቀቁ በኋላ የግብይት መለያዎን (Transaction ID) ወይም ሲከፍሉ የገባውን message  በመጠቀም ማረጋገጫ ከታች ባልው ቦታ ይላኩ።
          </div>
        </div>
      `,
    });
  } catch (err) {
    console.log("Deposit Error:", err);
    return res.status(500).json({ msg: "Server error" });
  }
};

// User submits transaction reference for a pending deposit
exports.submitDepositReference = async (req, res) => {
  const userId = req.user.id;
  const { transactionId, reference } = req.body;

  if (!transactionId || !reference) {
    return res.status(400).json({ msg: "Transaction ID and reference are required" });
  }

  try {
    // Ensure the deposit belongs to this user and is pending
    const [rows] = await db.query(
      "SELECT * FROM transactions WHERE id = ? AND user_id = ? AND type = 'deposit' AND status = 'pending'",
      [transactionId, userId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ msg: "Pending deposit not found" });
    }

    await db.query(
      "UPDATE transactions SET external_ref = ? WHERE id = ?",
      [reference, transactionId]
    );

    res.json({ success: true, msg: "Reference submitted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Server error" });
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
    const [rows] = await db.query(`
      SELECT transactions.*, users.phone 
      FROM transactions 
      JOIN users ON transactions.user_id = users.id 
      WHERE transactions.type='deposit' 
        AND transactions.status='pending'
         
    `);
    res.json(rows);
  } catch (err) {
    console.log(err);
    res.status(500).json({ msg: "Server error" });
  }
};
