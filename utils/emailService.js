const nodemailer = require("nodemailer");

let transporter;

function getTransporter() {
  if (transporter) return transporter;

  const { SMTP_HOST, SMTP_USER, SMTP_PASS } = process.env;
  const port = Number(process.env.SMTP_PORT || 587);

  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    throw new Error("SMTP_HOST, SMTP_USER, and SMTP_PASS must be configured");
  }

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("SMTP_PORT must be a valid port number");
  }

  const secure =
    process.env.SMTP_SECURE === undefined
      ? port === 465
      : process.env.SMTP_SECURE.toLowerCase() === "true";

  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port,
    secure,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 20000,
  });

  return transporter;
}

async function sendWithResend(email, otp, purpose) {
  const { RESEND_API_KEY, MAIL_FROM } = process.env;

  if (!RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY must be configured");
  }
  if (!MAIL_FROM) {
    throw new Error("MAIL_FROM must be configured for Resend");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: MAIL_FROM,
        to: [email],
        subject: `Desu Bingo ${purpose} code`,
        text: `Your Desu Bingo ${purpose} code is ${otp}.`,
      }),
      signal: controller.signal,
    });

    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(
        `Resend API request failed (${response.status}): ${
          result.message || response.statusText
        }`,
      );
    }
  } finally {
    clearTimeout(timeout);
  }
}

async function sendOtpEmail(email, otp, purpose) {
  if (!email || !otp || !purpose) {
    throw new Error("Email, OTP, and purpose are required");
  }

  if (process.env.RESEND_API_KEY) {
    await sendWithResend(email, otp, purpose);
    return;
  }

  const from = process.env.MAIL_FROM || process.env.SMTP_USER;
  if (!from) {
    throw new Error("MAIL_FROM or SMTP_USER must be configured");
  }

  await getTransporter().sendMail({
    from,
    to: email,
    subject: `Desu Bingo ${purpose} code`,
    text: `Your Desu Bingo ${purpose} code is ${otp}.`,
  });
}

module.exports = { sendOtpEmail };
