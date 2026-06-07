import admin from "firebase-admin";
import nodemailer from "nodemailer";

if (!admin.apps.length) {
  try {
    if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_PRIVATE_KEY !== 'paste_firebase_private_key_here') {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        }),
      });
    } else {
      admin.initializeApp();
    }
  } catch (e) {
    console.warn("Firebase Admin missing credentials, custom token generation will fail unless set.", e);
  }
}

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
  if (!email) {
    return res.status(400).json({ success: false, error: "Email is required" });
  }

  try {
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    const db = admin.firestore();
    await db.collection("otps").doc(email).set({
      otp,
      expiresAt: admin.firestore.Timestamp.fromDate(expiresAt),
    });

    if (process.env.SMTP_HOST && process.env.SMTP_USER) {
      await transporter.sendMail({
        from: `"ViBa Mart" <${process.env.SMTP_USER}>`,
        to: email,
        subject: "Your ViBa Mart Login OTP",
        text: `Your OTP is ${otp}. It is valid for 5 minutes.`,
        html: `<b>Your OTP is ${otp}</b><br/>It is valid for 5 minutes.`,
      });
    } else {
      console.log(`[DEVELOPMENT] OTP for ${email} is: ${otp}`);
    }

    res.json({ success: true, status: "pending" });
  } catch (error: any) {
    console.error("Send Email OTP error:", error);
    res.status(500).json({ success: false, error: "Failed to send OTP" });
  }
}
