const crypto = require("crypto");
const db = require("../config/db");

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

async function createTelegramRegistrationToken(telegramUserId, phone) {
  const token = crypto.randomBytes(32).toString("hex");

  await db.query(
    "DELETE FROM telegram_registration_tokens WHERE expires_at <= UTC_TIMESTAMP()",
  );
  await db.query(
    `INSERT INTO telegram_registration_tokens
       (token_hash, telegram_user_id, phone, expires_at)
     VALUES (?, ?, ?, DATE_ADD(UTC_TIMESTAMP(), INTERVAL 10 MINUTE))`,
    [hashToken(token), String(telegramUserId), phone],
  );

  return token;
}

async function getTelegramRegistrationByToken(
  token,
  executor = db,
  forUpdate = false,
) {
  if (typeof token !== "string" || !/^[a-f0-9]{64}$/.test(token)) {
    return null;
  }

  const [rows] = await executor.query(
    `SELECT telegram_user_id, phone
     FROM telegram_registration_tokens
     WHERE token_hash = ?
       AND used_at IS NULL
       AND expires_at > UTC_TIMESTAMP()
     LIMIT 1${forUpdate ? " FOR UPDATE" : ""}`,
    [hashToken(token)],
  );

  return rows[0] || null;
}

module.exports = {
  createTelegramRegistrationToken,
  getTelegramRegistrationByToken,
  hashToken,
};
