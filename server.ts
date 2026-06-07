import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import Razorpay from "razorpay";
import dotenv from "dotenv";
import rateLimit from "express-rate-limit";
import axios from "axios";
import admin from "firebase-admin";
import nodemailer from "nodemailer";

dotenv.config();

try {
  if (!admin.apps.length) {
    if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_PRIVATE_KEY !== 'paste_firebase_private_key_here') {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        }),
      });
    } else {
      admin.initializeApp();
    }
  }
} catch (e) {
  console.warn("Firebase Admin missing credentials, custom token generation will fail unless set.", e);
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let razorpayInstance: Razorpay | null = null;

function getRazorpay() {
  if (!razorpayInstance) {
    const key_id = process.env.RAZORPAY_KEY_ID;
    const key_secret = process.env.RAZORPAY_KEY_SECRET;

    if (!key_id || !key_secret || key_id === 'YOUR_RAZORPAY_KEY_ID' || key_secret === 'YOUR_RAZORPAY_KEY_SECRET') {
      throw new Error("Razorpay credentials are not configured in environment variables.");
    }

    razorpayInstance = new Razorpay({
      key_id,
      key_secret,
      });
  }
  return razorpayInstance;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Apply rate limiter to all requests to prevent DoS attacks (CodeQL Missing rate limiting)
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 200, // Limit each IP to 200 requests per 15 minutes
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many requests from this IP, please try again later." }
  });
  app.use(limiter);

  app.use(express.json());

  // API routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", name: "ViBa Mart API" });
  });

  // Razorpay order creation
  app.post("/api/payment/create-order", async (req, res) => {
    const { amount, currency } = req.body;
    try {
      const razorpay = getRazorpay();
      const options = {
        amount: Math.round(Number(amount) * 100), // amount in the smallest currency unit
        currency: currency || "INR",
        receipt: `receipt_${Date.now()}`,
      };
      console.log("Creating Razorpay order with options:", JSON.stringify(options));
      const order = await razorpay.orders.create(options);
      res.json({ success: true, order, key_id: process.env.RAZORPAY_KEY_ID });
    } catch (error: any) {
      console.error("Razorpay Order Creation Error:", error);
      const isConfigError = error.message && error.message.includes("configured");
      res.status(isConfigError ? 401 : 500).json({ 
        success: false, 
        error: error.description || error.message || "Failed to create Razorpay order",
        code: error.code || "UNKNOWN_ERROR"
      });
    }
  });

  app.post("/api/payment/verify", (req, res) => {
    // Mock Razorpay verification
    res.json({ success: true, message: "Payment verified" });
  });

  // Check notification trigger status
  app.get("/api/notifications/status", (req, res) => {
    res.json({
      running: true,
      timestamp: new Date().toISOString()
    });
  });

  // Setup Nodemailer transporter
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.ethereal.email",
    port: Number(process.env.SMTP_PORT) || 587,
    auth: {
      user: process.env.SMTP_USER || "test",
      pass: process.env.SMTP_PASS || "test",
    },
  });

  // Auth: Send Email OTP
  app.post("/api/auth/send-email-otp", async (req, res) => {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, error: "Email is required" });
    }

    try {
      // Generate 6-digit OTP
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 mins from now

      // Store in Firestore otps collection
      const db = admin.firestore();
      await db.collection("otps").doc(email).set({
        otp,
        expiresAt: admin.firestore.Timestamp.fromDate(expiresAt),
      });

      // Send Email
      if (process.env.SMTP_HOST && process.env.SMTP_USER) {
        await transporter.sendMail({
          from: `"ViBa Mart" <${process.env.SMTP_USER}>`,
          to: email,
          subject: "Your ViBa Mart Login OTP",
          text: `Your OTP is ${otp}. It is valid for 5 minutes.`,
          html: `<b>Your OTP is ${otp}</b><br/>It is valid for 5 minutes.`,
        });
      } else {
        // Fallback for testing when no SMTP is configured
        console.log(`[DEVELOPMENT] OTP for ${email} is: ${otp}`);
      }

      res.json({ success: true, status: "pending" });
    } catch (error: any) {
      console.error("Send Email OTP error:", error);
      res.status(500).json({ success: false, error: "Failed to send OTP" });
    }
  });

  // Auth: Verify Email OTP
  app.post("/api/auth/verify-email-otp", async (req, res) => {
    const { email, code } = req.body;
    if (!email || !code) {
      return res.status(400).json({ success: false, error: "Email and code are required" });
    }

    try {
      const db = admin.firestore();
      const otpDocRef = db.collection("otps").doc(email);
      const otpDoc = await otpDocRef.get();

      if (!otpDoc.exists) {
        return res.status(400).json({ success: false, error: "OTP expired or not found" });
      }

      const data = otpDoc.data();
      if (!data) return res.status(400).json({ success: false, error: "Invalid OTP" });

      if (data.otp !== code) {
        return res.status(400).json({ success: false, error: "Invalid OTP code" });
      }

      const now = admin.firestore.Timestamp.now();
      if (data.expiresAt.toMillis() < now.toMillis()) {
        await otpDocRef.delete();
        return res.status(400).json({ success: false, error: "OTP has expired" });
      }

      // Valid OTP. Delete it.
      await otpDocRef.delete();

      // Find or create user in Firebase Auth
      let uid = "";
      try {
        const userRecord = await admin.auth().getUserByEmail(email);
        uid = userRecord.uid;
      } catch (error: any) {
        if (error.code === "auth/user-not-found") {
          const newUser = await admin.auth().createUser({
            email,
            emailVerified: true,
          });
          uid = newUser.uid;
        } else {
          throw error;
        }
      }

      // Generate Custom Token for frontend to sign in
      const customToken = await admin.auth().createCustomToken(uid);
      
      return res.json({ success: true, customToken });
    } catch (error: any) {
      console.error("Verify Email OTP error:", error);
      res.status(500).json({ success: false, error: "Failed to verify OTP" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
