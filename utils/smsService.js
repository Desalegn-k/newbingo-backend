// utils/otpSender.js

// // Simple OTP sender (just logs to console)
// exports.sendOTP = async (phone, otp) => {
//   try {
//     console.log(`📲 OTP sent to to ${phone}: ${otp}`);
//     // Later, integrate Twilio or another SMS API here
//     return true;
//   } catch (error) {
//     console.error("❌ Error sending OTP:", error);
//     throw error;
//   }
// };


const africastalking = require("africastalking");

// Initialize Africa's Talking with your credentials
const credentials = {
  apiKey: process.env.AT_API_KEY,
  username: process.env.AT_USERNAME ||"sandbox", // fallback to sandbox
};

const AT = africastalking(credentials);
const sms = AT.SMS;

/**
 * Generic function to send any SMS message
 * @param {string} phone - Recipient phone number (international format, e.g., +251912345678)
 * @param {string} message - The message content
 * @returns {Promise<object>} - Result with success flag and messageId or error
 */
async function sendSMS(phone, message) {
  try {
    const options = {
      to: [phone],
      message: message,
      from: "desu-bingo", // Alphanumeric sender ID (must be approved in production)
    };

    const response = await sms.send(options);
    console.log(`✅ SMS sent to ${phone}:`, response);
    return {
      success: true,
      messageId: response.SMSMessageData?.Recipients?.[0]?.messageId || null,
    };
  } catch (error) {
    console.error("❌ SMS sending failed:", error);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Send OTP verification code
 * @param {string} phone - Phone number
 * @param {string} otp - The OTP code
 * @returns {Promise<object>}
 */
async function sendOTP(phone, otp) {
  const message = `Your Desu Bingo verification code is: ${otp}. It is valid for 5 minutes.`;
  return sendSMS(phone, message);
}

module.exports = {
  sendSMS,
  sendOTP,
};



// // latter


// // utils/otpSender.js
// const twilio = require("twilio");

// // Twilio credentials (you can hardcode temporarily since you're not using .env)
// const accountSid = "YOUR_TWILIO_SID";
// const authToken = "YOUR_TWILIO_AUTH_TOKEN";
// const twilioNumber = "+1234567890"; // your Twilio phone number

// const client = twilio(accountSid, authToken);

// exports.sendOTP = async (phone, otp) => {
//   try {
//     const message = await client.messages.create({
//       body: `Your OTP code is ${otp}`,
//       from: twilioNumber,
//       to: phone,
//     });

//     console.log(`✅ OTP sent to ${phone}: ${otp}`);
//     return message;
//   } catch (error) {
//     console.error("❌ Error sending OTP:", error);
//     throw error;
//   }
// };

