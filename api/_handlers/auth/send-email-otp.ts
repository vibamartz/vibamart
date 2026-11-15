import admin from "firebase-admin";
import crypto from "crypto";
import {
  initializeFirebaseAdmin,
  storeOtpInMemory,
  getOtpFromMemory,
  isSmtpConfigured,
  createMailTransporter,
  isValidServiceAccount,
  setCorsHeaders
} from "../../_utils";

initializeFirebaseAdmin();

export default async function handler(req: any, res: any) {
  setCorsHeaders(req, res);

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const { email } = req.body || {};
  if (!email || typeof email !== 'string') {
    return res.status(400).json({ success: false, error: "Email address is required" });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (!emailRegex.test(normalizedEmail)) {
    return res.status(400).json({ success: false, error: "Please enter a valid email address format" });
  }

  // Rate-limiting resends per email: prevent rapid spamming (cooldown 15s)
  const existingOtp = getOtpFromMemory(normalizedEmail);
  if (existingOtp && !existingOtp.used && Date.now() - existingOtp.createdAt < 15 * 1000) {
    const waitSec = Math.ceil((15 * 1000 - (Date.now() - existingOtp.createdAt)) / 1000);
    return res.status(429).json({
      success: false,
      error: `Please wait ${waitSec} second(s) before requesting another OTP.`
    });
  }

  try {
    // Generate secure 6-digit OTP
    const otp = crypto.randomInt(100000, 1000000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes validity

    // 1. Store in memory store (guaranteed reliability)
    storeOtpInMemory(normalizedEmail, otp, 5 * 60 * 1000);

    // 2. Try storing in Firestore if database is ready
    if (isValidServiceAccount()) {
      try {
        const db = admin.firestore();
        await db.collection("otps").doc(normalizedEmail).set({
          otp,
          createdAt: admin.firestore.Timestamp.now(),
          expiresAt: admin.firestore.Timestamp.fromDate(expiresAt),
          attempts: 0,
          used: false,
        });
      } catch (dbErr) {
        console.warn("[AUTH OTP] Firestore store notice (memory store active):", dbErr);
      }
    }

    // 3. Attempt to send via Gmail / SMTP if configured
    let emailSent = false;
    let emailDeliveryError: string | null = null;

    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ViBa Mart Verification Code</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f3f4f6; padding: 40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 520px; background-color: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.05); border: 1px solid #e5e7eb;" cellspacing="0" cellpadding="0">
          <tr>
            <td style="background: linear-gradient(135deg, #16a34a 0%, #059669 100%); padding: 32px 24px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 26px; font-weight: 900; letter-spacing: -0.5px;">ViBa Mart</h1>
              <p style="margin: 6px 0 0 0; color: #dcfce7; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 1.5px;">Login & Sign Up Verification</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 36px 32px;">
              <h2 style="margin: 0 0 12px 0; color: #111827; font-size: 20px; font-weight: 800;">Your One-Time Password (OTP)</h2>
              <p style="margin: 0 0 24px 0; color: #4b5563; font-size: 15px; line-height: 1.6;">
                Use the verification code below to complete your authentication on ViBa Mart.
              </p>
              <div style="background-color: #f0fdf4; border: 2px dashed #86efac; border-radius: 16px; padding: 20px; text-align: center; margin: 28px 0;">
                <span style="display: inline-block; font-size: 36px; font-weight: 900; letter-spacing: 8px; color: #15803d; font-family: 'Courier New', monospace;">
                  ${otp}
                </span>
                <p style="margin: 8px 0 0 0; color: #166534; font-size: 13px; font-weight: 600;">
                  ⏱️ Valid for 5 minutes
                </p>
              </div>
              <p style="margin: 0 0 16px 0; color: #6b7280; font-size: 13px; line-height: 1.5;">
                <strong>Security Notice:</strong> Never share this code with anyone. ViBa Mart representatives will never ask for your OTP.
              </p>
              <p style="margin: 0; color: #9ca3af; font-size: 12px; line-height: 1.5;">
                If you did not request this OTP, you can safely ignore this email.
              </p>
            </td>
          </tr>
          <tr>
            <td style="background-color: #f9fafb; padding: 20px 32px; border-top: 1px solid #f3f4f6; text-align: center;">
              <p style="margin: 0; color: #9ca3af; font-size: 12px;">
                &copy; ${new Date().getFullYear()} ViBa Mart. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;

    if (isSmtpConfigured()) {
      try {
        const transporter = createMailTransporter();
        await transporter.sendMail({
          from: `"ViBa Mart" <${process.env.SMTP_USER}>`,
          to: normalizedEmail,
          subject: `Your ViBa Mart Verification Code: ${otp}`,
          text: `Your ViBa Mart OTP is ${otp}. It is valid for 5 minutes. Do not share this code with anyone.`,
          html: emailHtml,
        });
        emailSent = true;
        console.log(`[AUTH OTP] Email delivered successfully to ${normalizedEmail}`);
      } catch (smtpErr: any) {
        console.error(`[AUTH OTP] SMTP send failed for ${normalizedEmail}:`, smtpErr);
        emailDeliveryError = smtpErr?.message || "Email delivery failed";
      }
    }

    // If SMTP was configured but sending failed, provide detailed guidance without blocking authentication
    if (isSmtpConfigured() && !emailSent) {
      const isAppPassReq = emailDeliveryError?.includes('534') ||
        emailDeliveryError?.includes('535') ||
        emailDeliveryError?.toLowerCase().includes('password not accepted') ||
        emailDeliveryError?.toLowerCase().includes('badcredentials') ||
        emailDeliveryError?.toLowerCase().includes('application-specific password');

      const guidance = isAppPassReq
        ? "Google requires a 16-character App Password (visit https://myaccount.google.com/apppasswords). Your regular Gmail password cannot be used directly for SMTP."
        : (emailDeliveryError || "SMTP delivery failed");

      console.warn(`[AUTH OTP] Email delivery warning for ${normalizedEmail}: ${guidance}`);

      return res.json({
        success: true,
        status: "pending",
        emailSent: false,
        devOtp: otp,
        smtpError: guidance,
        message: guidance
      });
    }

    console.log(`\n========================================\n[AUTH OTP] OTP for ${normalizedEmail} is: ${otp}\n========================================\n`);

    res.json({
      success: true,
      status: "pending",
      emailSent,
      devOtp: otp,
      message: emailSent
        ? "OTP has been sent to your Gmail address."
        : `Development mode: OTP generated (check server logs: ${otp})`
    });
  } catch (error: any) {
    console.error("Send Email OTP error:", error);
    const errMsg = error?.message || String(error) || "Failed to send OTP";
    res.status(500).json({ 
      success: false, 
      error: errMsg,
      message: errMsg 
    });
  }
}
