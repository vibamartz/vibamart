import dotenv from "dotenv";
dotenv.config();

import admin from "firebase-admin";
import { initializeFirebaseAdmin } from "../../_utils";
import { verifyOtp, hasAdminSdkCredentials, getDeterministicAuthSecret } from "../../_otpStore";

initializeFirebaseAdmin();

export default async function handler(req: any, res: any) {
  // Ensure standard Express helper methods exist on res across all runtime environments
  if (typeof res.status !== 'function') {
    res.status = function(code: number) {
      res.statusCode = code;
      return res;
    };
  }
  if (typeof res.json !== 'function') {
    res.json = function(data: any) {
      if (!res.headersSent) {
        res.setHeader('Content-Type', 'application/json');
      }
      res.end(JSON.stringify(data));
      return res;
    };
  }
  if (typeof res.send !== 'function') {
    res.send = function(data: any) {
      res.end(data);
      return res;
    };
  }

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
  if (!body && typeof req.on === 'function') {
    body = await new Promise((resolve) => {
      let data = '';
      req.on('data', (chunk: any) => { data += chunk; });
      req.on('end', () => {
        try {
          resolve(data ? JSON.parse(data) : {});
        } catch (e) {
          resolve({});
        }
      });
      req.on('error', () => resolve({}));
    });
  } else if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch (e) {}
  }

  const { email, code } = body || {};
  if (!email || !code) {
    return res.status(400).json({ success: false, error: "Email and 6-digit OTP code are required" });
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  const normalizedCode = String(code).replace(/\D/g, '').trim();

  if (normalizedCode.length < 6) {
    return res.status(400).json({ success: false, error: "Please enter the complete 6-digit OTP code." });
  }

  try {
    const result = await verifyOtp(normalizedEmail, normalizedCode);
    if (!result.valid) {
      return res.status(400).json({ 
        success: false, 
        error: result.reason || "Invalid OTP code. Please check your Gmail and try again.",
        message: result.reason || "Invalid OTP code. Please check your Gmail and try again."
      });
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
