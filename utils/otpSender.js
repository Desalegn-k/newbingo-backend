// utils/otpSender.js

// Simple OTP sender (just logs to console)
exports.sendOTP = async (phone, otp) => {
  try {
    console.log(`📲 OTP sent to ${phone}: ${otp}`);
    // Later, integrate Twilio or another SMS API here
    return true;
  } catch (error) {
    console.error("❌ Error sending OTP:", error);
    throw error;
  }
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

