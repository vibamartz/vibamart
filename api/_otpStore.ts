import crypto from "crypto";
import fs from "fs";
import os from "os";
import path from "path";
import admin from "firebase-admin";

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
    if (!admin.apps.length) return false;
    const rawKey = process.env.FIREBASE_PRIVATE_KEY || "";
    const isServiceAccount = rawKey && !rawKey.includes("your_private_key") && !rawKey.includes("paste_firebase_private_key");
    const hasAdc = !!(process.env.GOOGLE_APPLICATION_CREDENTIALS || (process.env.APPDATA && fs.existsSync(path.join(process.env.APPDATA, "gcloud", "application_default_credentials.json"))));
    return Boolean(isServiceAccount || hasAdc);
  } catch {
    return false;
  }
}

export function getDeterministicAuthSecret(email: string): string {
  const secretKey = process.env.AUTH_SECRET || process.env.VITE_FIREBASE_API_KEY || "viba-mart-auth-secret-key-2026";
  return crypto.createHmac("sha256", secretKey).update(email.trim().toLowerCase()).digest("hex") + "!Vb9";
}

export function storeOtp(email: string, otp: string, ttlMs: number = 10 * 60 * 1000): number {
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

  // Background sync to Firestore only if real admin credentials exist
  if (hasAdminSdkCredentials()) {
    try {
      const db = admin.firestore();
      db.collection("otps")
        .doc(normalizedEmail)
        .set({
          otp: cleanOtp,
          otps: recentOtps.map((o) => o.code),
          expiresAt: admin.firestore.Timestamp.fromMillis(expiresAt),
        })
        .catch((err) => {
          console.warn("[OtpStore] Firestore OTP write skipped:", err?.message || err);
        });
    } catch {}
  }

  return expiresAt;
}

export async function verifyOtp(email: string, code: string): Promise<{ valid: boolean; reason?: string }> {
  const normalizedEmail = email.trim().toLowerCase();
  const cleanCode = String(code).replace(/\D/g, "").trim();

  if (!cleanCode || cleanCode.length < 6) {
    return { valid: false, reason: "Please enter the complete 6-digit verification code." };
  }

  const now = Date.now();

  // Try memory first, then disk cache
  let memRecord = globalOtpStore.get(normalizedEmail);
  if (!memRecord) {
    const diskData = readDiskCache();
    if (diskData[normalizedEmail]) {
      memRecord = diskData[normalizedEmail];
      globalOtpStore.set(normalizedEmail, memRecord);
    }
  }

  if (memRecord) {
    // Purge expired OTPs (allowing 60s grace period for recently verified codes to absorb rapid duplicate requests)
    memRecord.otps = memRecord.otps.filter(
      (o) => o.expiresAt > now || (o.verifiedAt && now - o.verifiedAt < 60000)
    );

    if (memRecord.otps.length === 0) {
      globalOtpStore.delete(normalizedEmail);
      const diskData = readDiskCache();
      delete diskData[normalizedEmail];
      writeDiskCache(diskData);
      return { valid: false, reason: "OTP has expired. Please request a new one." };
    }

    memRecord.attempts += 1;
    if (memRecord.attempts > 15) {
      globalOtpStore.delete(normalizedEmail);
      const diskData = readDiskCache();
      delete diskData[normalizedEmail];
      writeDiskCache(diskData);
      return { valid: false, reason: "Too many failed attempts. Please request a new OTP." };
    }

    const matchedOtp = memRecord.otps.find((o) => o.code === cleanCode);
    if (matchedOtp) {
      matchedOtp.verifiedAt = matchedOtp.verifiedAt || Date.now();

      // Update disk cache with verification timestamp
      const diskData = readDiskCache();
      diskData[normalizedEmail] = memRecord;
      writeDiskCache(diskData);

      // Schedule removal after 60-second grace window
      const timer = setTimeout(() => {
        const current = globalOtpStore.get(normalizedEmail);
        if (current) {
          current.otps = current.otps.filter((o) => o.code !== cleanCode);
          if (current.otps.length === 0) {
            globalOtpStore.delete(normalizedEmail);
          }
        }
        const updatedDisk = readDiskCache();
        if (updatedDisk[normalizedEmail]) {
          updatedDisk[normalizedEmail].otps = updatedDisk[normalizedEmail].otps.filter(
            (o) => o.code !== cleanCode
          );
          if (updatedDisk[normalizedEmail].otps.length === 0) {
            delete updatedDisk[normalizedEmail];
          }
          writeDiskCache(updatedDisk);
        }
      }, 60000);

      if (timer && typeof (timer as any).unref === "function") {
        (timer as any).unref();
      }

      if (hasAdminSdkCredentials()) {
        try {
          admin.firestore().collection("otps").doc(normalizedEmail).delete().catch(() => {});
        } catch {}
      }
      return { valid: true };
    }

    // Persist attempt increment
    const diskData = readDiskCache();
    diskData[normalizedEmail] = memRecord;
    writeDiskCache(diskData);

    return { valid: false, reason: "Invalid OTP code. Please check your Gmail and try again." };
  }

  // Fallback to Firestore only if not found in memory/disk and admin credentials explicitly exist
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
    } catch {}
  }

  return { valid: false, reason: "No active OTP found. Please request a new OTP." };
}
