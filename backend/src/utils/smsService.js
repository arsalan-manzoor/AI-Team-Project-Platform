/*
 * =========================================================
 * ZYRA — SMS VERIFICATION SERVICE
 * =========================================================
 *
 * Sends mobile verification codes using Twilio.
 *
 * Required environment variables:
 *   TWILIO_ACCOUNT_SID
 *   TWILIO_AUTH_TOKEN
 *
 * Configure either:
 *   TWILIO_PHONE_NUMBER
 *
 * Or:
 *   TWILIO_MESSAGING_SERVICE_SID
 *
 * Never expose Twilio credentials to the frontend.
 * Never log verification codes or authentication tokens.
 */

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID?.trim();
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN?.trim();

const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER?.trim();
const TWILIO_MESSAGING_SERVICE_SID =
  process.env.TWILIO_MESSAGING_SERVICE_SID?.trim();

/**
 * Send a verification code to a mobile number.
 *
 * @param {string} mobileNumber Recipient in E.164 format.
 * Example: +919876543210
 *
 * @param {string} code Six-digit verification code.
 *
 * @returns {Promise<{success: boolean}>}
 */
async function sendMobileVerificationSms(mobileNumber, code) {
  /*
   * Fail safely if Twilio has not been configured.
   * Never pretend that an SMS was sent.
   */
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
    const error = new Error("Mobile verification service is not configured.");

    error.statusCode = 503;
    throw error;
  }

  if (!TWILIO_PHONE_NUMBER && !TWILIO_MESSAGING_SERVICE_SID) {
    const error = new Error(
      "A Twilio phone number or Messaging Service SID is required.",
    );

    error.statusCode = 503;
    throw error;
  }

  /*
   * Validate the recipient's international phone format.
   */
  if (!/^\+[1-9]\d{7,14}$/.test(String(mobileNumber))) {
    const error = new Error("Enter a valid international mobile number.");

    error.statusCode = 400;
    throw error;
  }

  /*
   * Only six-digit numeric codes are accepted.
   */
  if (!/^\d{6}$/.test(String(code))) {
    const error = new Error("Invalid verification code format.");

    error.statusCode = 400;
    throw error;
  }

  const endpoint =
    `https://api.twilio.com/2010-04-01/Accounts/` +
    `${encodeURIComponent(TWILIO_ACCOUNT_SID)}/Messages.json`;

  const message = new URLSearchParams();

  message.set("To", mobileNumber);

  if (TWILIO_MESSAGING_SERVICE_SID) {
    message.set("MessagingServiceSid", TWILIO_MESSAGING_SERVICE_SID);
  } else {
    message.set("From", TWILIO_PHONE_NUMBER);
  }

  message.set(
    "Body",
    `Your ZYRA verification code is ${code}. ` +
      "It expires in 10 minutes. Do not share this code with anyone.",
  );

  const authorization = Buffer.from(
    `${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`,
  ).toString("base64");

  let response;

  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Basic ${authorization}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: message.toString(),
    });
  } catch {
    const error = new Error(
      "Unable to contact the SMS service. Please try again.",
    );

    error.statusCode = 502;
    throw error;
  }

  if (!response.ok) {
    /*
     * Do not return Twilio's raw response to the frontend.
     * It may contain sensitive provider information.
     */
    const error = new Error(
      "The SMS provider could not send the verification code.",
    );

    error.statusCode = 502;
    throw error;
  }

  return {
    success: true,
  };
}

module.exports = {
  sendMobileVerificationSms,
};
