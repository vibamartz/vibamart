import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import Razorpay from "razorpay";
import dotenv from "dotenv";
import rateLimit from "express-rate-limit";
import whatsappOrderHandler from "./api/notifications/whatsapp-order";

dotenv.config();

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

  // WhatsApp Notification
  app.post("/api/notifications/whatsapp-order", async (req, res) => {
    await whatsappOrderHandler(req, res);
  });

  // Check notification trigger status
  app.get("/api/notifications/status", (req, res) => {
    const token = process.env.WHATSAPP_API_TOKEN;
    const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    const isConfigured = !!(token && phoneId && token !== 'YOUR_TOKEN' && phoneId !== 'YOUR_PHONE_ID');
    res.json({
      running: true,
      whatsappConfigured: isConfigured,
      timestamp: new Date().toISOString()
    });
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
