import admin from "firebase-admin";
import crypto from "crypto";
import { initializeFirebaseAdmin, getOtpFromMemory, deleteOtpFromMemory } from "../../_utils";

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
  const enteredCode = String(code).trim();

  try {
    let isValidOtp = false;

    // 1. Check in-memory store
    const memEntry = getOtpFromMemory(normalizedEmail);
    if (memEntry && memEntry.otp === enteredCode) {
      isValidOtp = true;
      deleteOtpFromMemory(normalizedEmail);
    }

    // 2. Check Firestore if not already validated in memory
    if (!isValidOtp) {
      try {
        const db = admin.firestore();
        const otpDocRef = db.collection("otps").doc(normalizedEmail);
        const otpDoc = await otpDocRef.get();

        if (otpDoc.exists) {
          const data = otpDoc.data();
          if (data && data.otp === enteredCode) {
            const now = admin.firestore.Timestamp.now();
            if (data.expiresAt && data.expiresAt.toMillis() >= now.toMillis()) {
              isValidOtp = true;
              await otpDocRef.delete().catch(() => {});
            }
          }
        }
      } catch (dbErr) {
        console.warn("[AUTH OTP] Firestore verification lookup notice:", dbErr);
      }
    }

    if (!isValidOtp) {
      return res.status(400).json({ success: false, error: "Invalid or expired OTP. Please try again." });
    }

    // Generate fallback deterministic password for direct Firebase Client Auth
    const deterministicPass = "Viba@" + crypto.createHmac('sha256', 'viba_mart_auth_salt').update(normalizedEmail).digest('hex').slice(0, 12) + "99!";
    const safeUid = "user_" + crypto.createHash('md5').update(normalizedEmail).digest('hex').slice(0, 20);

    let customToken: string | null = null;
    let uid = safeUid;

    // Try creating custom token via Firebase Admin if service account is active
    try {
      if (admin.apps.length > 0) {
        try {
          const userRecord = await admin.auth().getUserByEmail(normalizedEmail);
          uid = userRecord.uid;
        } catch (userErr: any) {
          if (userErr.code === "auth/user-not-found") {
            try {
              const newUser = await admin.auth().createUser({
                email: normalizedEmail,
                emailVerified: true,
              });
              uid = newUser.uid;
            } catch (createErr) {}
          }
        }

        try {
          customToken = await admin.auth().createCustomToken(uid, {
            email_verified: true
          });
        } catch (tokenErr) {
          console.warn("[AUTH OTP] Custom token generation not active, fallback auth credentials ready");
        }
      }
    } catch (adminErr) {
      console.warn("[AUTH OTP] Admin auth operations notice:", adminErr);
    }

    return res.json({
      success: true,
      customToken: customToken || null,
      uid,
      email: normalizedEmail,
      authFallback: {
        email: normalizedEmail,
        tempPass: deterministicPass,
        uid
      }
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
