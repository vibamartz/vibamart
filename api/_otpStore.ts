import crypto from "crypto";
import admin from "firebase-admin";

interface ActiveOtp {
  code: string;
  expiresAt: number;
}

interface OtpRecord {
  otps: ActiveOtp[];
  attempts: number;
}

// Global OTP store persisting across requests in the Node.js process
const globalOtpStore: Map<string, OtpRecord> = (globalThis as any).__viba_otp_store || new Map();
(globalThis as any).__viba_otp_store = globalOtpStore;

export function hasAdminSdkCredentials(): boolean {
  try {
    const rawKey = process.env.FIREBASE_PRIVATE_KEY || '';
    const rawEmail = process.env.FIREBASE_CLIENT_EMAIL || '';
    const projectId = process.env.FIREBASE_PROJECT_ID || '';
    if (!rawKey || !rawEmail || !projectId) return false;
    if (rawKey.includes('your_private_key') || rawKey.includes('paste_firebase_private_key')) return false;
    if (rawEmail.includes('your_project') || rawEmail.includes('your_firebase_client_email') || rawEmail.includes('example.com')) return false;
    return admin.apps.length > 0;
  } catch (e) {
    return false;
  }
}

export function getDeterministicAuthSecret(email: string): string {
  const secretKey = process.env.AUTH_SECRET || process.env.VITE_FIREBASE_API_KEY || 'viba-mart-auth-secret-key-2026';
  return crypto.createHmac('sha256', secretKey).update(email.trim().toLowerCase()).digest('hex') + '!Vb9';
}

export function storeOtp(email: string, otp: string, ttlMs: number = 10 * 60 * 1000): number {
  const normalizedEmail = email.trim().toLowerCase();
  const cleanOtp = String(otp).replace(/\D/g, '').trim();
  const now = Date.now();
  const expiresAt = now + ttlMs;

  const existing = globalOtpStore.get(normalizedEmail);
  const activeOtps = existing 
    ? existing.otps.filter(o => o.expiresAt > now)
    : [];

  // Append new OTP, preserve existing active OTPs for resend grace, keep up to 5 valid recent OTPs
  activeOtps.push({ code: cleanOtp, expiresAt });
  const recentOtps = activeOtps.slice(-5);

  globalOtpStore.set(normalizedEmail, {
    otps: recentOtps,
    attempts: 0,
  });

  // Background sync to Firestore only if real admin credentials exist
  if (hasAdminSdkCredentials()) {
    try {
      const db = admin.firestore();
      db.collection("otps").doc(normalizedEmail).set({
        otp: cleanOtp,
        otps: recentOtps.map(o => o.code),
        expiresAt: admin.firestore.Timestamp.fromMillis(expiresAt),
      }).catch(err => {
        console.warn("[OtpStore] Firestore OTP write skipped:", err?.message || err);
      });
    } catch (e) {}
  }

  return expiresAt;
}

export async function verifyOtp(email: string, code: string): Promise<{ valid: boolean; reason?: string }> {
  const normalizedEmail = email.trim().toLowerCase();
  const cleanCode = String(code).replace(/\D/g, '').trim();

  if (!cleanCode || cleanCode.length < 6) {
    return { valid: false, reason: "Please enter the complete 6-digit OTP code." };
  }

  const now = Date.now();
  const memRecord = globalOtpStore.get(normalizedEmail);

  if (memRecord) {
    // Purge expired OTPs
    memRecord.otps = memRecord.otps.filter(o => o.expiresAt > now);

    if (memRecord.otps.length === 0) {
      globalOtpStore.delete(normalizedEmail);
      return { valid: false, reason: "OTP has expired. Please request a new one." };
    }

    memRecord.attempts += 1;
    if (memRecord.attempts > 10) {
      globalOtpStore.delete(normalizedEmail);
      return { valid: false, reason: "Too many failed attempts. Please request a new OTP." };
    }

    const matched = memRecord.otps.some(o => o.code === cleanCode);
    if (matched) {
      globalOtpStore.delete(normalizedEmail);
      if (hasAdminSdkCredentials()) {
        try {
          admin.firestore().collection("otps").doc(normalizedEmail).delete().catch(() => {});
        } catch (e) {}
      }
      return { valid: true };
    }

    return { valid: false, reason: "Invalid OTP code. Please check your Gmail and try again." };
  }

  // Fallback to Firestore only if not found in memory and admin credentials explicitly exist
  if (hasAdminSdkCredentials()) {
    try {
      const db = admin.firestore();
      const otpDocRef = db.collection("otps").doc(normalizedEmail);
      const otpDoc = await otpDocRef.get();
      if (otpDoc.exists) {
        const data = otpDoc.data();
        const nowTs = admin.firestore.Timestamp.now();
        if (data && data.expiresAt && data.expiresAt.toMillis() >= nowTs.toMillis()) {
          const isMatch = data.otp === cleanCode || (Array.isArray(data.otps) && data.otps.includes(cleanCode));
          if (isMatch) {
            await otpDocRef.delete().catch(() => {});
            return { valid: true };
          }
        }
      }
    } catch (e) {}
  }

  return { valid: false, reason: "No active OTP found. Please request a new OTP." };
}
