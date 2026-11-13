// utils/sms.js — pluggable OTP sender.
// SMS_PROVIDER=console (default, logs OTP — free dev mode)
//              msg91 | fast2sms | twilio  (fill the matching keys in .env)
const axios = require('axios');

const PROVIDER = (process.env.SMS_PROVIDER || 'console').toLowerCase();

async function sendOtpSms(mobile, otp) {
  const text = `Your GrowFresh OTP is ${otp}. Valid for 5 minutes.`;

  switch (PROVIDER) {
    case 'msg91': {
      // Requires a DLT-registered template id (India).
      await axios.post(
        'https://control.msg91.com/api/v5/otp',
        {
          template_id: process.env.MSG91_TEMPLATE_ID,
          mobile: `91${mobile}`,
          otp,
        },
        { headers: { authkey: process.env.MSG91_AUTH_KEY } }
      );
      return { provider: 'msg91' };
    }

    case 'fast2sms': {
      await axios.post(
        'https://www.fast2sms.com/dev/bulkV2',
        {
          route: 'otp',
          variables_values: otp,
          numbers: mobile,
        },
        { headers: { authorization: process.env.FAST2SMS_API_KEY } }
      );
      return { provider: 'fast2sms' };
    }

    case 'twilio': {
      const { TWILIO_SID, TWILIO_TOKEN, TWILIO_FROM } = process.env;
      await axios.post(
        `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`,
        new URLSearchParams({ To: `+91${mobile}`, From: TWILIO_FROM, Body: text }),
        { auth: { username: TWILIO_SID, password: TWILIO_TOKEN } }
      );
      return { provider: 'twilio' };
    }

    default:
      console.log(`📩 [SMS:console] OTP for ${mobile} → ${otp}`);
      return { provider: 'console', devOtp: otp };
  }
}

module.exports = { sendOtpSms, PROVIDER };
