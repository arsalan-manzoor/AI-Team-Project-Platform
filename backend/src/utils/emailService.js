const nodemailer = require("nodemailer");

/*
|--------------------------------------------------------------------------
| ZYRA EMAIL TRANSPORTER
|--------------------------------------------------------------------------
*/

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_APP_PASSWORD,
  },
});

/*
|--------------------------------------------------------------------------
| HTML ESCAPING
|--------------------------------------------------------------------------
*/

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/*
|--------------------------------------------------------------------------
| COMMON EMAIL SENDER
|--------------------------------------------------------------------------
*/

async function sendZyraEmail(mailOptions) {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_APP_PASSWORD) {
    throw new Error(
      "Email configuration is missing. Check EMAIL_USER and EMAIL_APP_PASSWORD.",
    );
  }

  if (!mailOptions || typeof mailOptions !== "object") {
    throw new Error("Invalid email configuration.");
  }

  if (!mailOptions.to || !mailOptions.subject) {
    throw new Error("Email recipient and subject are required.");
  }

  if (typeof mailOptions.text !== "string" || !mailOptions.text.trim()) {
    throw new Error(`Email body is empty. Subject: ${mailOptions.subject}`);
  }

  const finalMailOptions = {
    from: process.env.EMAIL_FROM || `"ZYRA" <${process.env.EMAIL_USER}>`,
    to: mailOptions.to,
    subject: mailOptions.subject,
    text: mailOptions.text.trim(),

    ...(typeof mailOptions.html === "string" && mailOptions.html.trim()
      ? { html: mailOptions.html }
      : {}),
  };

  const result = await transporter.sendMail(finalMailOptions);

  console.log(
    `ZYRA email sent successfully to ${mailOptions.to}. Message ID: ${result.messageId}`,
  );

  return result;
}

/*
|--------------------------------------------------------------------------
| 1. EMAIL VERIFICATION
|--------------------------------------------------------------------------
*/

async function sendVerificationEmail(email, name, verificationCode) {
  const recipientName = name || "there";

  if (!email || !verificationCode) {
    throw new Error("Email address and verification code are required.");
  }

  const text = [
    `Hello ${recipientName},`,
    "",
    "Welcome to ZYRA! Please use the following code to verify your email address:",
    `Verification Code: ${verificationCode}`,
    "",
    "This verification code expires in 10 minutes.",
    "If you did not initiate this signup, you can safely ignore this email.",
    "",
    "Regards,",
    "ZYRA Team",
  ].join("\n");

  return sendZyraEmail({
    to: email,
    subject: "Verify your email address - ZYRA",
    text,
  });
}

/*
|--------------------------------------------------------------------------
| 2. COMPANY EMPLOYEE INVITATION
|--------------------------------------------------------------------------
*/

async function sendEmployeeInvitationEmail(
  email,
  name,
  organizationName,
  role,
  temporaryPassword,
  loginUrl,
) {
  const recipientName = name || "there";
  const companyName = organizationName || "Company Workspace";
  const assignedRole = String(role || "USER").replace(/_/g, " ");

  const hasTemporaryPassword =
    typeof temporaryPassword === "string" && temporaryPassword.length > 0;

  if (!email || !loginUrl || !String(loginUrl).trim()) {
    throw new Error(
      "Company invitation email is missing the employee email or Company login URL.",
    );
  }

  if (
    hasTemporaryPassword &&
    Buffer.byteLength(temporaryPassword, "utf8") > 72
  ) {
    throw new Error("The temporary password exceeds the supported length.");
  }

  const accountPasswordLine = hasTemporaryPassword
    ? `Temporary Password: ${temporaryPassword}`
    : "Password: Use your existing ZYRA account password.";

  const loginInstruction = hasTemporaryPassword
    ? "Sign in using your temporary password and change it when prompted."
    : "Sign in using your existing ZYRA account password.";

  const text = [
    `Hello ${recipientName},`,
    "",
    `You have been invited to join ${companyName} on ZYRA as ${assignedRole}.`,
    "",
    `Name: ${recipientName}`,
    `Email: ${email}`,
    accountPasswordLine,
    `Role: ${assignedRole}`,
    `Workspace: ${companyName}`,
    "",
    `Login: ${loginUrl}`,
    "",
    `${loginInstruction} Then open Invitations in your dashboard and accept the invitation to activate your membership.`,
    "",
    "This invitation expires in 48 hours.",
    "",
    "Regards,",
    "ZYRA Team",
  ].join("\n");

  return sendZyraEmail({
    to: email,
    subject: `Your ZYRA Company Workspace Invitation - ${companyName}`,
    text,
  });
}

/*
|--------------------------------------------------------------------------
| 3. INDIVIDUAL WORKSPACE INVITATION
|--------------------------------------------------------------------------
*/

async function sendIndividualInvitationEmail(
  email,
  name,
  workspaceName,
  role,
  temporaryPassword,
  loginUrl,
) {
  const recipientName = name || "there";
  const assignedWorkspace = workspaceName || "Individual Workspace";
  const assignedRole = String(role || "USER").replace(/_/g, " ");

  if (!email || !temporaryPassword || !loginUrl || !String(loginUrl).trim()) {
    throw new Error(
      "Individual invitation email is missing required account information or login URL.",
    );
  }

  const text = [
    `Hello ${recipientName},`,
    "",
    `You have been invited to join ${assignedWorkspace} on ZYRA as ${assignedRole}.`,
    "",
    `Name: ${recipientName}`,
    `Email: ${email}`,
    `Temporary Password: ${temporaryPassword}`,
    `Role: ${assignedRole}`,
    `Workspace: ${assignedWorkspace}`,
    "",
    `Login: ${loginUrl}`,
    "",
    "Sign in using your temporary password and change it when prompted. Then open Invitations in your dashboard and accept the invitation to activate your workspace and project membership.",
    "",
    "This invitation expires in 48 hours.",
    "",
    "Regards,",
    "ZYRA Team",
  ].join("\n");

  return sendZyraEmail({
    to: email,
    subject: `Your ZYRA Individual Workspace Invitation - ${assignedWorkspace}`,
    text,
  });
}

/*
|--------------------------------------------------------------------------
| 4. PASSWORD RESET EMAIL
|--------------------------------------------------------------------------
*/

async function sendPasswordResetEmail(email, name, resetUrl) {
  const recipientName = name || "there";

  if (!email || !resetUrl) {
    throw new Error("Email address and password reset URL are required.");
  }

  const safeName = escapeHtml(recipientName);
  const safeResetUrl = escapeHtml(resetUrl);

  const text = [
    `Hello ${recipientName},`,
    "",
    "We received a request to reset your ZYRA account password.",
    "",
    `Reset your password here: ${resetUrl}`,
    "",
    "This password reset link expires in 20 minutes.",
    "If you did not request a password reset, you can ignore this email. Your existing password will remain unchanged.",
    "",
    "Regards,",
    "ZYRA Team",
  ].join("\n");

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>ZYRA Password Reset</title>
</head>

<body style="margin:0;padding:15px;background:#f4f6f9;font-family:Arial,Helvetica,sans-serif;color:#202b3b;">

  <div style="max-width:520px;margin:0 auto;background:#ffffff;border:1px solid #e3e8ef;border-radius:10px;overflow:hidden;">

    <div style="padding:17px 22px;background:#111827;color:#ffffff;">
      <h1 style="margin:0;font-size:22px;">ZYRA</h1>
      <p style="margin:4px 0 0;color:#a9bacd;font-size:12px;">Intelligent Project Workspace</p>
    </div>

    <div style="padding:22px;">

      <p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:#475569;">
        Hello ${safeName},
      </p>

      <p style="margin:0 0 17px;font-size:14px;line-height:1.6;color:#475569;">
        We received a request to reset your ZYRA account password. Click the button below to continue.
      </p>

      <div style="text-align:center;margin:18px 0;">
        <a
          href="${safeResetUrl}"
          target="_blank"
          rel="noopener noreferrer"
          style="display:inline-block;padding:11px 23px;color:#ffffff;background:#087e8b;border-radius:7px;text-decoration:none;font-size:14px;font-weight:bold;"
        >
          Reset Password
        </a>
      </div>

      <p style="margin:14px 0;font-size:12px;line-height:1.6;color:#64748b;">
        Or copy this link into your browser:
        <br />
        <a href="${safeResetUrl}" style="color:#087e8b;overflow-wrap:anywhere;">
          ${safeResetUrl}
        </a>
      </p>

      <p style="margin:12px 0;font-size:12px;line-height:1.6;color:#64748b;">
        This link expires in 20 minutes. If you did not request a password reset, you can ignore this email. Your existing password will remain unchanged.
      </p>

      <p style="margin:16px 0 0;font-size:13px;line-height:1.6;color:#64748b;">
        Regards,<br />
        <strong>ZYRA Team</strong>
      </p>

    </div>

    <div style="padding:11px;text-align:center;background:#f8fafc;border-top:1px solid #e3e8ef;color:#94a3b8;font-size:10px;">
      © ${new Date().getFullYear()} ZYRA. All rights reserved.
    </div>

  </div>

</body>
</html>
`;

  return sendZyraEmail({
    to: email,
    subject: "Reset your ZYRA password",
    text,
    html,
  });
}

/*
|--------------------------------------------------------------------------
| EXPORT EMAIL FUNCTIONS
|--------------------------------------------------------------------------
*/

module.exports = {
  sendVerificationEmail,
  sendEmployeeInvitationEmail,
  sendIndividualInvitationEmail,
  sendPasswordResetEmail,
};
