import admin from "firebase-admin";
import crypto from "crypto";
import {
  initializeFirebaseAdmin,
  getOtpFromMemory,
  deleteOtpFromMemory,
  markOtpUsedInMemory,
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

  const { email, code } = req.body || {};
  if (!email || !code) {
    return res.status(400).json({ success: false, error: "Email address and OTP code are required" });
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  const enteredCode = String(code).trim();

  if (enteredCode.length !== 6 || !/^\d{6}$/.test(enteredCode)) {
    return res.status(400).json({ success: false, error: "Please enter a valid 6-digit OTP code" });
  }

  try {
    // 1. Retrieve OTP record from Memory
    const memEntry = getOtpFromMemory(normalizedEmail);

    // 2. Retrieve OTP record from Firestore if service account configured
    let firestoreData: any = null;
    let firestoreDocRef: any = null;
    if (isValidServiceAccount()) {
      try {
        const db = admin.firestore();
        firestoreDocRef = db.collection("otps").doc(normalizedEmail);
        const docSnap = await firestoreDocRef.get();
        if (docSnap.exists) {
          firestoreData = docSnap.data();
        }
      } catch (dbErr) {
        console.warn("[AUTH OTP] Firestore verification lookup notice:", dbErr);
      }
    }

    // If neither store has any record for this email
    if (!memEntry && !firestoreData) {
      return res.status(400).json({
        success: false,
        error: "No OTP found or it has already been used. Please request a new OTP."
      });
    }

    // Check if OTP was already used
    if ((memEntry && memEntry.used) || (firestoreData && firestoreData.used)) {
      deleteOtpFromMemory(normalizedEmail);
      if (firestoreDocRef) firestoreDocRef.delete().catch(() => {});
      return res.status(400).json({
        success: false,
        error: "This OTP has already been used. Please request a new OTP."
      });
    }

    // Check if expired
    const now = Date.now();
    const isMemExpired = memEntry ? now > memEntry.expiresAt : false;
    const isFsExpired = firestoreData?.expiresAt ? firestoreData.expiresAt.toMillis() < now : false;

    if ((memEntry && isMemExpired) || (!memEntry && isFsExpired)) {
      deleteOtpFromMemory(normalizedEmail);
      if (firestoreDocRef) firestoreDocRef.delete().catch(() => {});
      return res.status(400).json({
        success: false,
        error: "OTP has expired. Please request a new OTP."
      });
    }

    // Check attempt limits (brute-force protection: max 5 attempts)
    const currentAttempts = Math.max(memEntry?.attempts || 0, firestoreData?.attempts || 0);
    if (currentAttempts >= 5) {
      deleteOtpFromMemory(normalizedEmail);
      if (firestoreDocRef) firestoreDocRef.delete().catch(() => {});
      return res.status(400).json({
        success: false,
        error: "Too many failed attempts. This OTP has been invalidated. Please request a new OTP."
      });
    }

    // Match OTP code
    const storedCode = memEntry?.otp || firestoreData?.otp;
    if (storedCode !== enteredCode) {
      // Increment attempt counter
      if (memEntry) memEntry.attempts += 1;
      if (firestoreDocRef) {
        firestoreDocRef.update({ attempts: admin.firestore.FieldValue.increment(1) }).catch(() => {});
      }
      const remainingAttempts = Math.max(0, 5 - (currentAttempts + 1));
      return res.status(400).json({
        success: false,
        error: `Incorrect OTP. Please enter the valid code sent to your email. (${remainingAttempts} attempt(s) left)`
      });
    }

    // Correct OTP! Mark as used and delete immediately to prevent reuse
    markOtpUsedInMemory(normalizedEmail);
    deleteOtpFromMemory(normalizedEmail);
    if (firestoreDocRef) {
      await firestoreDocRef.delete().catch(() => {});
    }

    // Generate fallback deterministic password for direct Firebase Client Auth
    const deterministicPass = "Viba@" + crypto.createHmac('sha256', 'viba_mart_auth_salt').update(normalizedEmail).digest('hex').slice(0, 12) + "99!";
    const safeUid = "user_" + crypto.createHash('md5').update(normalizedEmail).digest('hex').slice(0, 20);

    let customToken: string | null = null;
    let uid = safeUid;

    // Try creating custom token via Firebase Admin if service account is active
    try {
      if (isValidServiceAccount()) {
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
