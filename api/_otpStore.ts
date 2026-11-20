import crypto from "crypto";
import fs from "fs";
import os from "os";
import path from "path";
import admin from "firebase-admin";
import { initializeFirebaseAdmin, ensureApplicationDefaultCredentials } from "./_utils";

initializeFirebaseAdmin();

interface ActiveOtp {
  code: string;
  expiresAt: number;
  verifiedAt?: number;
}

interface OtpRecord {
  otps: ActiveOtp[];
  attempts: number;
}

// Global OTP store persisting across requests in the Node.js process
const globalOtpStore: Map<string, OtpRecord> = (globalThis as any).__viba_otp_store || new Map();
(globalThis as any).__viba_otp_store = globalOtpStore;

// Safe temporary cache file path in system temporary directory
const CACHE_FILE_PATH = path.join(os.tmpdir(), "viba_otp_cache.json");

/**
 * Safely reads the persistent disk OTP cache to recover state across server reloads
 */
function readDiskCache(): Record<string, OtpRecord> {
  try {
    if (fs.existsSync(CACHE_FILE_PATH)) {
      const data = fs.readFileSync(CACHE_FILE_PATH, "utf-8");
      if (data) {
        return JSON.parse(data);
      }
    }
  } catch {
    // Silently ignore disk cache read errors
  }
  return {};
}

/**
 * Safely writes active OTPs to the persistent disk cache, purging expired entries
 */
function writeDiskCache(records: Record<string, OtpRecord>) {
  try {
    const now = Date.now();
    const cleanRecords: Record<string, OtpRecord> = {};

    for (const [email, record] of Object.entries(records)) {
      const validOtps = record.otps.filter(
        (o) => o.expiresAt > now || (o.verifiedAt && now - o.verifiedAt < 60000)
      );
      if (validOtps.length > 0) {
        cleanRecords[email] = {
          otps: validOtps,
          attempts: record.attempts,
        };
      }
    }

    fs.writeFileSync(CACHE_FILE_PATH, JSON.stringify(cleanRecords, null, 2), "utf-8");
  } catch {
    // Silently ignore disk cache write errors on read-only environments
  }
}

export function hasAdminSdkCredentials(): boolean {
  try {
    ensureApplicationDefaultCredentials();
    if (!admin.apps.length) {
      initializeFirebaseAdmin();
    }
    if (!admin.apps.length) return false;
    const rawKey = process.env.FIREBASE_PRIVATE_KEY || "";
    const isServiceAccount = rawKey && !rawKey.includes("your_private_key") && !rawKey.includes("paste_firebase_private_key");
    const adcPath = process.env.GOOGLE_APPLICATION_CREDENTIALS ||
      (process.env.APPDATA ? path.join(process.env.APPDATA, "gcloud", "application_default_credentials.json") : null) ||
      path.join(os.homedir(), ".config", "gcloud", "application_default_credentials.json");
    const hasAdc = !!(adcPath && fs.existsSync(adcPath));
    return Boolean(isServiceAccount || hasAdc);
  } catch {
    return false;
  }
}

export function getDeterministicAuthSecret(email: string): string {
  const secretKey = process.env.AUTH_SECRET || process.env.VITE_FIREBASE_API_KEY || "viba-mart-auth-secret-key-2026";
  return crypto.createHmac("sha256", secretKey).update(email.trim().toLowerCase()).digest("hex") + "!Vb9";
}

export async function storeOtp(email: string, otp: string, ttlMs: number = 10 * 60 * 1000): Promise<number> {
  const normalizedEmail = email.trim().toLowerCase();
  const cleanOtp = String(otp).replace(/\D/g, "").trim();
  const now = Date.now();
  const expiresAt = now + ttlMs;

  // Retrieve existing from memory or disk cache
  let existing = globalOtpStore.get(normalizedEmail);
  if (!existing) {
    const diskCache = readDiskCache();
    if (diskCache[normalizedEmail]) {
      existing = diskCache[normalizedEmail];
    }
  }

  const activeOtps = existing
    ? existing.otps.filter((o) => o.expiresAt > now)
    : [];

  // Append new OTP, preserve existing active OTPs for resend grace, keep up to 5 valid recent OTPs
  activeOtps.push({ code: cleanOtp, expiresAt });
  const recentOtps = activeOtps.slice(-5);

  const newRecord: OtpRecord = {
    otps: recentOtps,
    attempts: 0,
  };

  globalOtpStore.set(normalizedEmail, newRecord);

  // Sync to disk cache
  const diskData = readDiskCache();
  diskData[normalizedEmail] = newRecord;
  writeDiskCache(diskData);

  // Synchronize to Firestore
  if (hasAdminSdkCredentials()) {
    try {
      const db = admin.firestore();
      await db.collection("otps")
        .doc(normalizedEmail)
        .set({
          otp: cleanOtp,
          otps: recentOtps.map((o) => o.code),
          expiresAt: admin.firestore.Timestamp.fromMillis(expiresAt),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
    } catch (err: any) {
      console.error("[OtpStore] Failed to synchronize OTP with Firestore:", err?.message || err);
      throw new Error(`Database synchronization failed: ${err?.message || "Unable to sync OTP record"}`);
    }
  }

  return expiresAt;
}

// Concurrent request deduplication map
const inFlightVerifications = new Map<string, Promise<{ valid: boolean; reason?: string }>>();

export async function verifyOtp(email: string, code: string): Promise<{ valid: boolean; reason?: string }> {
  const normalizedEmail = email.trim().toLowerCase();
  const cleanCode = String(code).replace(/\D/g, "").trim();

  if (!cleanCode || cleanCode.length < 6) {
    return { valid: false, reason: "Please enter the complete 6-digit verification code." };
  }

  const requestKey = `${normalizedEmail}_${cleanCode}`;
  if (inFlightVerifications.has(requestKey)) {
    return inFlightVerifications.get(requestKey)!;
  }

  const verifyPromise = (async (): Promise<{ valid: boolean; reason?: string }> => {
    const now = Date.now();

    // 1. Try memory first, then disk cache
    let memRecord = globalOtpStore.get(normalizedEmail);
    if (!memRecord) {
      const diskData = readDiskCache();
      if (diskData[normalizedEmail]) {
        memRecord = diskData[normalizedEmail];
        globalOtpStore.set(normalizedEmail, memRecord);
      }
    }

    if (memRecord) {
      // Purge expired OTPs
      memRecord.otps = memRecord.otps.filter((o) => o.expiresAt > now);

      if (memRecord.otps.length === 0) {
        globalOtpStore.delete(normalizedEmail);
        const diskData = readDiskCache();
        delete diskData[normalizedEmail];
        writeDiskCache(diskData);
        return { valid: false, reason: "OTP has expired. Please request a new one." };
      }

      memRecord.attempts = (memRecord.attempts || 0) + 1;
      if (memRecord.attempts > 15) {
        globalOtpStore.delete(normalizedEmail);
        const diskData = readDiskCache();
        delete diskData[normalizedEmail];
        writeDiskCache(diskData);
        return { valid: false, reason: "Too many failed attempts. Please request a new OTP." };
      }

      const matchIndex = memRecord.otps.findIndex((o) => o.code === cleanCode);
      if (matchIndex >= 0) {
        // Enforce strict one-time usage: immediately remove the verified code
        memRecord.otps.splice(matchIndex, 1);
        if (memRecord.otps.length === 0) {
          globalOtpStore.delete(normalizedEmail);
          const diskData = readDiskCache();
          delete diskData[normalizedEmail];
          writeDiskCache(diskData);
        } else {
          globalOtpStore.set(normalizedEmail, memRecord);
          const diskData = readDiskCache();
          diskData[normalizedEmail] = memRecord;
          writeDiskCache(diskData);
        }

        // Clean up from Firestore
        if (hasAdminSdkCredentials()) {
          try {
            await admin.firestore().collection("otps").doc(normalizedEmail).delete();
          } catch (delErr: any) {
            console.warn("[OtpStore] Firestore OTP cleanup notice:", delErr?.message || delErr);
          }
        }

        return { valid: true };
      }

      // Code didn't match memory; persist attempt increment
      const diskData = readDiskCache();
      diskData[normalizedEmail] = memRecord;
      writeDiskCache(diskData);

      return { valid: false, reason: "Invalid OTP code. Please check your Gmail and try again." };
    }

    // 2. Fallback to Firestore if not found in memory/disk and admin credentials explicitly exist
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
              await otpDocRef.delete();
              return { valid: true };
            }
          }
        }
      } catch (fsErr: any) {
        console.warn("[OtpStore] Firestore fallback verification notice:", fsErr?.message || fsErr);
      }
    }

    return { valid: false, reason: "No active OTP found. Please request a new OTP." };
  })();

  inFlightVerifications.set(requestKey, verifyPromise);
  try {
    return await verifyPromise;
  } finally {
    inFlightVerifications.delete(requestKey);
  }
}
