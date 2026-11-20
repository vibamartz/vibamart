import dotenv from "dotenv";
dotenv.config();

import admin from "firebase-admin";
import { initializeFirebaseAdmin } from "../../_utils";
import { verifyOtp, hasAdminSdkCredentials, getDeterministicAuthSecret } from "../../_otpStore";

initializeFirebaseAdmin();

/**
 * Safely parses request body across Express, Vite dev middleware, and serverless runtimes
 */
async function parseRequestBody(req: any): Promise<any> {
  if (req.body && typeof req.body === "object") {
    return req.body;
  }
  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  if (typeof req.on === "function") {
    return new Promise((resolve) => {
      let data = "";
      req.on("data", (chunk: any) => {
        data += chunk;
      });
      req.on("end", () => {
        try {
          resolve(data ? JSON.parse(data) : {});
        } catch {
          resolve({});
        }
      });
      req.on("error", () => resolve({}));
    });
  }
  return {};
}

export default async function handler(req: any, res: any) {
  // Ensure standard Express response helper methods exist across all runtimes
  if (typeof res.status !== "function") {
    res.status = function (code: number) {
      res.statusCode = code;
      return res;
    };
  }
  if (typeof res.json !== "function") {
    res.json = function (data: any) {
      if (!res.headersSent) {
        res.setHeader("Content-Type", "application/json");
      }
      res.end(JSON.stringify(data));
      return res;
    };
  }

  // CORS configuration
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS,PATCH,DELETE,POST,PUT");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version"
  );

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  const body = await parseRequestBody(req);
  const { email, code } = body || {};

  if (!email || !code) {
    return res.status(400).json({ success: false, error: "Gmail address and OTP code are required" });
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  const normalizedCode = String(code).replace(/\D/g, "").trim();

  try {
    const result = await verifyOtp(normalizedEmail, normalizedCode);
    if (!result.valid) {
      return res.status(400).json({ success: false, error: result.reason || "Invalid OTP code" });
    }

    const authSecret = getDeterministicAuthSecret(normalizedEmail);
    let uid = "usr_" + Buffer.from(normalizedEmail).toString("hex").slice(0, 24);

    // Sync or provision user in Firebase Auth via Admin SDK so client authentication always succeeds
    try {
      if (admin.apps.length > 0) {
        let userRecord;
        try {
          userRecord = await admin.auth().getUserByEmail(normalizedEmail);
          uid = userRecord.uid;
          await admin.auth().updateUser(uid, {
            password: authSecret,
            emailVerified: true,
          });
        } catch (error: any) {
          if (error.code === "auth/user-not-found") {
            const newUser = await admin.auth().createUser({
              email: normalizedEmail,
              password: authSecret,
              emailVerified: true,
            });
            uid = newUser.uid;
          } else {
            console.warn("[VerifyOtp] Firebase Admin getUser error:", error.message);
          }
        }

        // Try generating custom token if private key / service account signing is configured
        try {
          const customToken = await admin.auth().createCustomToken(uid, {
            email_verified: true,
          });
          return res.json({ success: true, customToken, authSecret, uid, email: normalizedEmail });
        } catch (tokenErr) {
          // Custom token signing not available; fall through to authSecret sign-in
        }
      }
    } catch (adminErr: any) {
      console.warn("[VerifyOtp] Firebase Admin auth sync notice:", adminErr?.message || adminErr);
    }

    // Direct Firebase client authentication credential
    return res.json({
      success: true,
      authSecret,
      uid,
      email: normalizedEmail,
    });
  } catch (error: any) {
    console.error("Verify Email OTP error:", error);
    const errMsg = error?.message || String(error) || "Failed to verify OTP";
    res.status(500).json({
      success: false,
      error: errMsg,
      message: errMsg,
    });
  }
}
