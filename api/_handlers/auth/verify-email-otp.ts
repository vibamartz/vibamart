import dotenv from "dotenv";
dotenv.config();

import admin from "firebase-admin";
import { initializeFirebaseAdmin } from "../../_utils";
import { verifyOtp, hasAdminSdkCredentials, getDeterministicAuthSecret } from "../../_otpStore";

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

  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch (e) {
      body = {};
    }
  }

  const email = body?.email || req.query?.email;
  const code = body?.code || req.query?.code || body?.otp || req.query?.otp;

  if (!email || !code) {
    return res.status(400).json({ success: false, error: "Email and OTP code are required" });
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  const normalizedCode = String(code).replace(/\D/g, '').trim();

  try {
    const result = await verifyOtp(normalizedEmail, normalizedCode);
    if (!result.valid) {
      return res.status(400).json({ success: false, error: result.reason || "Invalid OTP code" });
    }

    // If Admin SDK credentials are fully configured, generate custom token
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

        const customToken = await admin.auth().createCustomToken(uid, {
          email_verified: true
        });
        
        return res.json({ success: true, customToken });
      } catch (adminErr) {
        console.warn("[VerifyOtp] Admin SDK custom token failed, falling back to auth secret:", adminErr);
      }
    }

    // Direct Firebase client authentication credential
    const authSecret = getDeterministicAuthSecret(normalizedEmail);
    const deterministicUid = 'usr_' + Buffer.from(normalizedEmail).toString('hex').slice(0, 24);
    return res.json({ 
      success: true, 
      authSecret,
      uid: deterministicUid,
      email: normalizedEmail 
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
