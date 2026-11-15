import nodemailer from "nodemailer";
import { initializeFirebaseAdmin } from "../../_utils";
import { storeOtp } from "../../_otpStore";

initializeFirebaseAdmin();

let cachedTransporter: nodemailer.Transporter | null = null;
function getTransporter() {
  if (!cachedTransporter) {
    cachedTransporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || "smtp.gmail.com",
      port: Number(process.env.SMTP_PORT) || 587,
      auth: {
        user: process.env.SMTP_USER || "vibamartz@gmail.com",
        pass: process.env.SMTP_PASS || "",
      },
    });
  }
  return cachedTransporter;
}

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

  const cleanEmail = email.trim().toLowerCase();

  try {
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const ttlMs = 2 * 60 * 1000;

    // Store in reliable OTP store (with automatic background Firestore backup if credentials exist)
    storeOtp(cleanEmail, otp, ttlMs);

    if (process.env.SMTP_HOST && process.env.SMTP_USER) {
      const transporter = getTransporter();
      await transporter.sendMail({
        from: `"ViBa Mart" <${process.env.SMTP_USER}>`,
        to: cleanEmail,
        subject: "Your ViBa Mart Login OTP",
        text: `Your OTP is ${otp}. It is valid for 2 minutes.`,
        html: `
          <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 500px; margin: auto; border: 1px solid #e2e8f0; border-radius: 8px;">
            <h2 style="color: #4f46e5; margin-bottom: 8px;">ViBa Mart Verification</h2>
            <p style="color: #334155; font-size: 15px;">Use the verification code below to complete your login or registration:</p>
            <div style="background-color: #f1f5f9; padding: 14px 24px; font-size: 28px; font-weight: bold; letter-spacing: 6px; text-align: center; color: #1e293b; border-radius: 6px; margin: 20px 0;">
              ${otp}
            </div>
            <p style="color: #64748b; font-size: 13px;">This code is valid for 2 minutes. If you did not request this, please ignore this email.</p>
          </div>
        `,
      });
      console.log(`[Send OTP] Successfully dispatched OTP email to ${cleanEmail}`);
    } else {
      console.log(`[DEVELOPMENT] OTP for ${cleanEmail} is: ${otp}`);
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
