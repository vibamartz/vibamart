import nodemailer from "nodemailer";
import { initializeFirebaseAdmin } from "../../_utils";
import { storeOtp } from "../../_otpStore";

initializeFirebaseAdmin();

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
    return res.status(400).json({ success: false, error: "Valid email is required" });
  }

  const normalizedEmail = email.trim().toLowerCase();

  try {
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    storeOtp(normalizedEmail, otp);

    const isPlaceholderSmtp = !process.env.SMTP_USER || 
      process.env.SMTP_USER === "your-email@gmail.com" || 
      process.env.SMTP_USER === "test" || 
      process.env.SMTP_USER.includes("example.com");

    let emailSent = false;
    if (process.env.SMTP_HOST && !isPlaceholderSmtp) {
      try {
        const transporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST,
          port: Number(process.env.SMTP_PORT) || 587,
          secure: Number(process.env.SMTP_PORT) === 465,
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
          },
          connectionTimeout: 4000,
        });

        await transporter.sendMail({
          from: `"ViBa Mart" <${process.env.SMTP_USER}>`,
          to: normalizedEmail,
          subject: "Your ViBa Mart Login OTP",
          text: `Your OTP is ${otp}. It is valid for 2 minutes.`,
          html: `<div style="font-family:sans-serif;padding:20px;"><h2>ViBa Mart Verification</h2><p>Your one-time login code is:</p><h1 style="color:#16a34a;letter-spacing:4px;">${otp}</h1><p>This code is valid for 2 minutes.</p></div>`,
        });
        emailSent = true;
        console.log(`[ViBa Mart] Sent OTP email to ${normalizedEmail} (Code: ${otp})`);
      } catch (smtpErr: any) {
        console.warn(`[ViBa Mart] SMTP send failed (${smtpErr?.message || smtpErr}), logging OTP to console:`);
        console.log(`========================================`);
        console.log(`[ViBa Mart OTP] Verification Code for ${normalizedEmail}: ${otp}`);
        console.log(`========================================`);
      }
    } else {
      console.log(`========================================`);
      console.log(`[ViBa Mart OTP] Verification Code for ${normalizedEmail}: ${otp}`);
      console.log(`========================================`);
    }

    res.json({ 
      success: true, 
      status: "pending",
      devOtp: (!emailSent) ? otp : undefined 
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
