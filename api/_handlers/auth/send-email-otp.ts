import nodemailer from "nodemailer";
import { initializeFirebaseAdmin } from "../../_utils";
import { storeOtp } from "../../_otpStore";

initializeFirebaseAdmin();

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.ethereal.email",
  port: Number(process.env.SMTP_PORT) || 587,
  auth: {
    user: process.env.SMTP_USER || "test",
    pass: process.env.SMTP_PASS || "test",
  },
});

export default async function handler(req: any, res: any) {
  // CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email } = req.body;
  if (!email || typeof email !== 'string') {
    return res.status(400).json({ success: false, error: "Email is required" });
  }

  const normalizedEmail = email.trim().toLowerCase();

  try {
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    storeOtp(normalizedEmail, otp);

    const isPlaceholder = !process.env.SMTP_USER || process.env.SMTP_USER === "your-email@gmail.com" || process.env.SMTP_USER === "test";

    if (process.env.SMTP_HOST && !isPlaceholder) {
      try {
        await transporter.sendMail({
          from: `"ViBa Mart" <${process.env.SMTP_USER}>`,
          to: normalizedEmail,
          subject: "Your ViBa Mart Login OTP",
          text: `Your OTP is ${otp}. It is valid for 2 minutes.`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 12px;">
              <h2 style="color: #16a34a; margin-bottom: 8px;">ViBa Mart Verification</h2>
              <p style="color: #4b5563; font-size: 15px;">Your one-time verification code is:</p>
              <div style="font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #111827; padding: 16px; background-color: #f0fdf4; border: 1px dashed #22c55e; border-radius: 8px; text-align: center; margin: 20px 0;">
                ${otp}
              </div>
              <p style="color: #6b7280; font-size: 13px;">This code will expire in 2 minutes. If you did not request this OTP, please ignore this email.</p>
            </div>
          `,
        });
        console.log(`[Auth] OTP email successfully sent to ${normalizedEmail}`);
      } catch (mailErr: any) {
        console.error("[Auth] Nodemailer sendMail error:", mailErr.message);
        console.log(`[DEVELOPMENT] OTP for ${normalizedEmail} is: ${otp}`);
      }
    } else {
      console.log(`[DEVELOPMENT] OTP for ${normalizedEmail} is: ${otp}`);
    }

    res.json({ success: true, status: "pending" });
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
