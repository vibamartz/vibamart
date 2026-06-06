import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import Razorpay from "razorpay";
import dotenv from "dotenv";
import rateLimit from "express-rate-limit";
import twilio from "twilio";
import admin from "firebase-admin";

dotenv.config();

let twilioClient: twilio.Twilio;
try {
  if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
    twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  }
} catch (e) {
  console.warn("Twilio not fully initialized, missing env vars");
}

try {
  if (!admin.apps.length) {
    admin.initializeApp();
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

  // Auth: Send OTP
  app.post("/api/auth/send-otp", async (req, res) => {
    const { phone } = req.body;
    if (!phone) {
      return res.status(400).json({ success: false, error: "Phone number is required" });
    }
    
    if (!twilioClient || !process.env.TWILIO_VERIFY_SERVICE_SID) {
      return res.status(500).json({ success: false, error: "Twilio credentials are not configured on the server" });
    }

    try {
      const verification = await twilioClient.verify.v2
        .services(process.env.TWILIO_VERIFY_SERVICE_SID)
        .verifications.create({ to: phone, channel: "sms" });
      
      res.json({ success: true, status: verification.status });
    } catch (error: any) {
      console.error("Twilio send-otp error:", error);
      res.status(500).json({ success: false, error: error.message || "Failed to send OTP" });
    }
  });

  // Auth: Verify OTP
  app.post("/api/auth/verify-otp", async (req, res) => {
    const { phone, code } = req.body;
    if (!phone || !code) {
      return res.status(400).json({ success: false, error: "Phone and code are required" });
    }

    if (!twilioClient || !process.env.TWILIO_VERIFY_SERVICE_SID) {
      return res.status(500).json({ success: false, error: "Twilio verify service SID is not configured" });
    }

    try {
      const verificationCheck = await twilioClient.verify.v2
        .services(process.env.TWILIO_VERIFY_SERVICE_SID)
        .verificationChecks.create({ to: phone, code });

      if (verificationCheck.status === "approved") {
        // Find or create user in Firebase Auth
        let uid = "";
        try {
          const userRecord = await admin.auth().getUserByPhoneNumber(phone);
          uid = userRecord.uid;
        } catch (error: any) {
          if (error.code === 'auth/user-not-found') {
            const newUser = await admin.auth().createUser({
              phoneNumber: phone,
            });
            uid = newUser.uid;
          } else {
            throw error;
          }
        }

        // Generate Custom Token for frontend to sign in
        const customToken = await admin.auth().createCustomToken(uid);
        
        return res.json({ success: true, customToken });
      } else {
        return res.status(400).json({ success: false, error: "Invalid OTP code" });
      }
    } catch (error: any) {
      console.error("Twilio verify-otp error:", error);
      res.status(500).json({ success: false, error: error.message || "Failed to verify OTP" });
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
