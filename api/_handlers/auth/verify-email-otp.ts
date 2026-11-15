import admin from "firebase-admin";
import { initializeFirebaseAdmin } from "../../_utils";
import { verifyOtp, hasAdminSdkCredentials } from "../../_otpStore";

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

  const cleanEmail = String(email).trim().toLowerCase();
  const cleanCode = String(code).trim();

  try {
    const verification = await verifyOtp(cleanEmail, cleanCode);
    if (!verification.valid) {
      return res.status(400).json({
        success: false,
        error: verification.reason || "Invalid or expired OTP code"
      });
    }

    // Attempt to mint customToken if Admin SDK credentials are functional
    let customToken: string | null = null;
    let uid: string | null = null;

    if (hasAdminSdkCredentials()) {
      try {
        let userRecord;
        try {
          userRecord = await admin.auth().getUserByEmail(cleanEmail);
          uid = userRecord.uid;
        } catch (error: any) {
          if (error.code === "auth/user-not-found") {
            const newUser = await admin.auth().createUser({
              email: cleanEmail,
              emailVerified: true,
            });
            uid = newUser.uid;
          } else {
            throw error;
          }
        }
        if (uid) {
          customToken = await admin.auth().createCustomToken(uid, {
            email_verified: true
          });
        }
      } catch (authErr: any) {
        console.warn("[Verify OTP] Custom token creation skipped:", authErr?.message || authErr);
      }
    }

    return res.json({
      success: true,
      email: cleanEmail,
      customToken,
      verified: true
    });
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
