import admin from "firebase-admin";
import { initializeFirebaseAdmin } from "../utils";

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

  const { email, code } = req.body;
  if (!email || !code) {
    return res.status(400).json({ success: false, error: "Email and code are required" });
  }

  try {
    const db = admin.firestore();
    const otpDocRef = db.collection("otps").doc(email);
    const otpDoc = await otpDocRef.get();

    if (!otpDoc.exists) {
      return res.status(400).json({ success: false, error: "OTP expired or not found" });
    }

    const data = otpDoc.data();
    if (!data) return res.status(400).json({ success: false, error: "Invalid OTP" });

    if (data.otp !== code) {
      return res.status(400).json({ success: false, error: "Invalid OTP code" });
    }

    const now = admin.firestore.Timestamp.now();
    if (data.expiresAt.toMillis() < now.toMillis()) {
      await otpDocRef.delete();
      return res.status(400).json({ success: false, error: "OTP has expired" });
    }

    await otpDocRef.delete();

    let uid = "";
    try {
      const userRecord = await admin.auth().getUserByEmail(email);
      uid = userRecord.uid;
    } catch (error: any) {
      if (error.code === "auth/user-not-found") {
        const newUser = await admin.auth().createUser({
          email,
          emailVerified: true,
        });
        uid = newUser.uid;
      } else {
        throw error;
      }
    }

    const customToken = await admin.auth().createCustomToken(uid, {
      email_verified: true
    });
    
    return res.json({ success: true, customToken });
  } catch (error: any) {
    console.error("Verify Email OTP error:", error);
    const errMsg = error?.message || String(error) || "Failed to verify OTP";
    res.status(500).json({ 
      success: false, 
      error: errMsg,
      message: errMsg
    });
  }
}
