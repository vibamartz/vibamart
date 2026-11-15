import admin from "firebase-admin";
import nodemailer from "nodemailer";
import { initializeFirebaseAdmin, storeOtpInMemory, isSmtpConfigured } from "../../_utils";

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
    return res.status(400).json({ success: false, error: "Email is required" });
  }

  const normalizedEmail = email.trim().toLowerCase();

  try {
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes validity

    // 1. Store in memory store (guaranteed reliability)
    storeOtpInMemory(normalizedEmail, otp, 5 * 60 * 1000);

    // 2. Try storing in Firestore if database is ready
    try {
      const db = admin.firestore();
      await db.collection("otps").doc(normalizedEmail).set({
        otp,
        expiresAt: admin.firestore.Timestamp.fromDate(expiresAt),
      });
    } catch (dbErr) {
      console.warn("[AUTH OTP] Firestore store notice (memory store active):", dbErr);
    }

    // 3. Attempt to send via SMTP if real SMTP credentials are provided
    let emailSent = false;
    if (isSmtpConfigured()) {
      try {
        const transporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST || "smtp.gmail.com",
          port: Number(process.env.SMTP_PORT) || 587,
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
          },
          connectionTimeout: 3000,
          greetingTimeout: 3000,
          socketTimeout: 3000,
        });

        await transporter.sendMail({
          from: `"ViBa Mart" <${process.env.SMTP_USER}>`,
          to: normalizedEmail,
          subject: "Your ViBa Mart Login OTP",
          text: `Your OTP is ${otp}. It is valid for 5 minutes.`,
          html: `<b>Your OTP is ${otp}</b><br/>It is valid for 5 minutes.`,
        });
        emailSent = true;
        console.log(`[AUTH OTP] Email sent successfully to ${normalizedEmail}`);
      } catch (smtpErr) {
        console.warn(`[AUTH OTP] SMTP send failed for ${normalizedEmail}, fallback active:`, smtpErr);
      }
    }

    console.log(`\n========================================\n[AUTH OTP] OTP for ${normalizedEmail} is: ${otp}\n========================================\n`);

    res.json({
      success: true,
      status: "pending",
      emailSent,
      devOtp: otp,
      message: emailSent ? "OTP sent to your email" : `Development OTP: ${otp}`
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
