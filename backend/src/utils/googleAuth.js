const { OAuth2Client } = require("google-auth-library");

const client = new OAuth2Client();

async function verifyGoogleToken(idToken) {
  const ticket = await client.verifyIdToken({
    idToken,
    audience: process.env.GOOGLE_CLIENT_ID,
  });

  const payload = ticket.getPayload();

  return payload;
}

module.exports = {
  verifyGoogleToken,
};
