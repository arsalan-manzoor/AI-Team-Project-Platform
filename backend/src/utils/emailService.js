const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_APP_PASSWORD,
  },
});

async function sendVerificationEmail(email, name, verificationCode) {
  const info = await transporter.sendMail({
    from: `"ZYRA" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: "Verify your ZYRA account",
    text: `Hi ${name},

Your ZYRA verification code is: ${verificationCode}

This code will expire in 10 minutes.

If you did not create a ZYRA account, you can ignore this email.

— ZYRA Team`,
  });

  console.log("Verification email sent:", info.messageId);
}

/*
|--------------------------------------------------------------------------
| Employee Invitation Email
|--------------------------------------------------------------------------
*/

async function sendEmployeeInvitationEmail(
  email,
  name,
  organizationName,
  role,
  invitationUrl,
) {
  const info = await transporter.sendMail({
    from: `"ZYRA" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: `You're invited to join ${organizationName} on ZYRA`,
    text: `Hi ${name},

You have been invited to join ${organizationName} on ZYRA.

Your assigned role will be: ${role}

Accept your invitation using the link below:

${invitationUrl}

This invitation will expire after the configured invitation period.

If you were not expecting this invitation, you can safely ignore this email.

— ZYRA Team`,
  });

  console.log("Employee invitation email sent:", info.messageId);
}

module.exports = {
  sendVerificationEmail,
  sendEmployeeInvitationEmail,
};
