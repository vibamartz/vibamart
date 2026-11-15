import admin from "firebase-admin";
import { initializeFirebaseAdmin } from "../../_utils";
import { verifyOtp, getDeterministicAuthSecret, hasAdminSdkCredentials } from "../../_otpStore";

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

  const normalizedEmail = email.trim().toLowerCase();
  const normalizedCode = String(code).trim();

  try {
    const verificationResult = await verifyOtp(normalizedEmail, normalizedCode);
    if (!verificationResult.valid) {
      return res.status(400).json({ 
        success: false, 
        error: verificationResult.reason || "Invalid OTP code. Please try again." 
      });
    }

    const authSecret = getDeterministicAuthSecret(normalizedEmail);

    let customToken: string | null = null;
    if (hasAdminSdkCredentials()) {
      try {
        let uid = "";
        try {
          const userRecord = await admin.auth().getUserByEmail(normalizedEmail);
          uid = userRecord.uid;
        } catch (error: any) {
          if (error.code === "auth/user-not-found") {
            const newUser = await admin.auth().createUser({
              email: normalizedEmail,
              emailVerified: true,
            });
            uid = newUser.uid;
          } else {
            throw error;
          }
        }

        customToken = await admin.auth().createCustomToken(uid, {
          email_verified: true
        });
      } catch (tokenErr) {
        console.warn("[Auth] Custom token generation skipped:", tokenErr);
      }
    }

    return res.json({ 
      success: true, 
      email: normalizedEmail,
      authSecret,
      customToken 
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
