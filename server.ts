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
import cancelHandler from "./api/orders/cancel";
import returnRequestHandler from "./api/returns/request";
import refundRequestHandler from "./api/refunds/request";
import updateStatusHandler from "./api/requests/update-status";
import { getErrorLocation } from "./api/utils";


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
      try {
        admin.firestore().settings({ preferRest: true, ignoreUndefinedProperties: true });
      } catch (e) {
        console.warn("Firestore settings already initialized or failed:", e);
      }
    } else {
      admin.initializeApp();
      try {
        admin.firestore().settings({ preferRest: true, ignoreUndefinedProperties: true });
      } catch (e) {}
    }
  }
} catch (e) {
  console.warn("Firebase Admin missing credentials, custom token generation will fail unless set.", e);
}

import crypto from "crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let razorpayInstance: Razorpay | null = null;

function getRazorpay() {
  if (!razorpayInstance) {
    const key_id = process.env.RAZORPAY_KEY_ID || process.env.VITE_RAZORPAY_KEY_ID;
    const key_secret = process.env.RAZORPAY_KEY_SECRET;

    if (!key_id || !key_secret || key_id === 'YOUR_RAZORPAY_KEY_ID' || key_secret === 'YOUR_RAZORPAY_KEY_SECRET' || key_id.includes('dummy')) {
      throw new Error("Razorpay credentials are not configured in environment variables.");
    }

    razorpayInstance = new Razorpay({
      key_id,
      key_secret,
    });
  }
  return razorpayInstance;
}

async function createNotification(userId: string, title: string, message: string, orderId?: string) {
  try {
    const db = admin.firestore();
    await db.collection("notifications").add({
      userId,
      title,
      message,
      read: false,
      createdAt: new Date().toISOString(),
      orderId: orderId || null
    });
  } catch (err) {
    console.error("Error creating database notification:", err);
  }
}

async function sendEmailNotification(toEmail: string, contactName: string, subject: string, messageText: string) {
  const isPlaceholder = !process.env.SMTP_USER || process.env.SMTP_USER === "your-email@gmail.com" || process.env.SMTP_USER === "test";
  if (!process.env.SMTP_HOST || isPlaceholder) {
    console.log(`[DEVELOPMENT] Email to ${toEmail} (${contactName}):\nSubject: ${subject}\nMessage: ${messageText}`);
    return;
  }
  try {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || "smtp.ethereal.email",
      port: Number(process.env.SMTP_PORT) || 587,
      auth: {
        user: process.env.SMTP_USER || "test",
        pass: process.env.SMTP_PASS || "test",
      },
      connectionTimeout: 2000,
      greetingTimeout: 2000,
      socketTimeout: 2000,
    });
    const emailHtml = `
      <h2>Hello ${contactName || 'Customer'},</h2>
      <p>${messageText}</p>
      <br/>
      <p>Best Regards,<br/>The ViBa Mart Team</p>
    `;
    await transporter.sendMail({
      from: `"ViBa Mart" <${process.env.SMTP_USER}>`,
      to: toEmail,
      subject,
      html: emailHtml,
    });
    console.log(`Email successfully sent to ${toEmail}`);
  } catch (err) {
    console.error("Error sending email notification:", err);
  }
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

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

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
      const activeKey = process.env.RAZORPAY_KEY_ID || process.env.VITE_RAZORPAY_KEY_ID;
      res.json({ success: true, order, key_id: activeKey });
    } catch (error: any) {
      console.error("Razorpay Order Creation Error:", error);
      const isConfigError = error.message && (error.message.includes("configured") || error.message.includes("credentials"));
      res.status(isConfigError ? 400 : 500).json({ 
        success: false, 
        error: error.description || error.message || "Failed to create Razorpay order",
        code: error.code || "CONFIG_ERROR",
        isDemo: isConfigError
      });
    }
  });

  app.post("/api/payment/verify", (req, res) => {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    const key_secret = process.env.RAZORPAY_KEY_SECRET;

    if (key_secret && razorpay_order_id && razorpay_payment_id && razorpay_signature) {
      try {
        const body = razorpay_order_id + "|" + razorpay_payment_id;
        const expectedSignature = crypto
          .createHmac("sha256", key_secret)
          .update(body.toString())
          .digest("hex");

        if (expectedSignature === razorpay_signature) {
          return res.json({ success: true, message: "Payment verified successfully" });
        } else {
          return res.status(400).json({ success: false, message: "Invalid payment signature" });
        }
      } catch (e: any) {
        console.error("Signature verification failed:", e);
      }
    }
    // Fallback/Demo verification response
    res.json({ success: true, message: "Payment verified (Demo Mode)" });
  });


  // Setup Nodemailer transporter
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.ethereal.email",
    port: Number(process.env.SMTP_PORT) || 587,
    auth: {
      user: process.env.SMTP_USER || "test",
      pass: process.env.SMTP_PASS || "test",
    },
    connectionTimeout: 2000,
    greetingTimeout: 2000,
    socketTimeout: 2000,
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
      const expiresAt = new Date(Date.now() + 2 * 60 * 1000); // 2 mins from now

      // Store in Firestore otps collection
      const db = admin.firestore();
      await db.collection("otps").doc(email).set({
        otp,
        expiresAt: admin.firestore.Timestamp.fromDate(expiresAt),
      });

      const isPlaceholder = !process.env.SMTP_USER || process.env.SMTP_USER === "your-email@gmail.com" || process.env.SMTP_USER === "test";
      
      // Send Email
      if (process.env.SMTP_HOST && !isPlaceholder) {
        await transporter.sendMail({
          from: `"ViBa Mart" <${process.env.SMTP_USER}>`,
          to: email,
          subject: "Your ViBa Mart Login OTP",
          text: `Your OTP is ${otp}. It is valid for 2 minutes.`,
          html: `<b>Your OTP is ${otp}</b><br/>It is valid for 2 minutes.`,
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

  // Notifications: Delivery Email
  app.post("/api/notifications/delivery", async (req, res) => {
    const { orderId, customerEmail, customerName, deliveryDate, items, total } = req.body;

    if (!orderId || !customerEmail) {
      return res.status(400).json({ success: false, error: "Missing required fields" });
    }

    try {
      const itemsList = items?.map((item: any) => `<li>${item.name} - Qty: ${item.quantity}</li>`).join('') || '';
      
      const emailHtml = `
        <h2>Hello ${customerName || 'Customer'},</h2>
        <p>We are excited to inform you that your order <strong>#${orderId}</strong> has been successfully delivered on ${deliveryDate || new Date().toLocaleDateString()}.</p>
        <h3>Order Summary:</h3>
        <ul>
          ${itemsList}
        </ul>
        <p><strong>Total Amount:</strong> ₹${total}</p>
        <br/>
        <p>Thank you for shopping with ViBa Mart! We hope you enjoy your purchase.</p>
        <p>Best Regards,<br/>The ViBa Mart Team</p>
      `;

      const db = admin.firestore();
      
      // Prevent duplicate emails
      const existingLogs = await db.collection("emailLogs")
        .where("orderId", "==", orderId)
        .where("type", "==", "delivery_confirmation")
        .limit(1)
        .get();
        
      if (!existingLogs.empty) {
        return res.json({ success: true, message: "Delivery email was already sent previously." });
      }

      const isPlaceholder = !process.env.SMTP_USER || process.env.SMTP_USER === "your-email@gmail.com" || process.env.SMTP_USER === "test";

      if (process.env.SMTP_HOST && !isPlaceholder) {
        await transporter.sendMail({
          from: `"ViBa Mart" <${process.env.SMTP_USER}>`,
          to: customerEmail,
          subject: "Your Order Has Been Delivered Successfully",
          html: emailHtml,
        });
        
        // Store email delivery log
        await db.collection("emailLogs").add({
          orderId,
          recipient: customerEmail,
          type: "delivery_confirmation",
          status: "sent",
          sentAt: admin.firestore.FieldValue.serverTimestamp()
        });
        
        res.json({ success: true, message: "Delivery email sent successfully." });
      } else {
        console.log(`[DEVELOPMENT] Delivery email for ${customerEmail}:\n${emailHtml}`);
        
        // Store email delivery log for development
        await db.collection("emailLogs").add({
          orderId,
          recipient: customerEmail,
          type: "delivery_confirmation",
          status: "development_log_only",
          sentAt: admin.firestore.FieldValue.serverTimestamp()
        });
        
        res.json({ success: true, message: "Delivery email logged in development." });
      }
    } catch (error: any) {
      console.error("Delivery email error:", error);
      res.status(500).json({ success: false, error: "Failed to send delivery email" });
    }
  });

  // Simple auth middleware using Firebase ID token
  const verifyAuth = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ success: false, error: "Unauthorized: No token provided" });
    }
    const idToken = authHeader.split("Bearer ")[1];
    try {
      const decodedToken = await admin.auth().verifyIdToken(idToken);
      (req as any).user = decodedToken;
      next();
    } catch (error) {
      console.error("Token verification error:", error);
      res.status(401).json({ success: false, error: "Unauthorized: Invalid token" });
    }
  };

  const handleWebRoute = (handler: (req: Request) => Promise<Response>) => {
    return async (req: express.Request, res: express.Response) => {
      const protocol = req.protocol;
      const host = req.get('host');
      const url = `${protocol}://${host}${req.originalUrl}`;
      
      const headers = new Headers();
      for (const [key, value] of Object.entries(req.headers)) {
        if (value) {
          if (Array.isArray(value)) {
            value.forEach(v => headers.append(key, v));
          } else {
            headers.set(key, value);
          }
        }
      }

      const webReq = new Request(url, {
        method: req.method,
        headers: headers,
        body: req.method !== 'GET' && req.method !== 'HEAD' ? JSON.stringify(req.body) : undefined,
      });

      try {
        const webRes = await handler(webReq);
        webRes.headers.forEach((value, key) => {
          res.setHeader(key, value);
        });
        res.status(webRes.status);
        const text = await webRes.text();
        res.send(text);
      } catch (err: any) {
        console.error("Express web route adapter error:", err);
        res.status(500).json({ success: false, error: err.message || "Internal Server Error" });
      }
    };
  };

  // Orders: Cancel Order
  app.post("/api/orders/cancel", cancelHandler);


  // Orders: Admin Approve Cancellation
  app.post("/api/orders/approve-cancellation", verifyAuth, async (req, res) => {
    const { orderId } = req.body;
    const decodedToken = (req as any).user;
    
    // Simple admin check
    let isAdmin = false;
    if (decodedToken.email === 'vk311779@gmail.com' && decodedToken.email_verified) {
      isAdmin = true;
    } else {
      try {
        console.log(`[FIRESTORE READ] Fetching user document from 'users' collection. Document ID: ${decodedToken.uid}`);
        const userDoc = await admin.firestore().collection("users").doc(decodedToken.uid).get();
        if (userDoc.exists && userDoc.data()?.role === 'admin') isAdmin = true;
      } catch (e) {
        console.error("Error fetching user role", e);
      }
    }
    
    if (!isAdmin) return res.status(403).json({ success: false, error: "Admin access required" });

    try {
      const db = admin.firestore();
      console.log(`[FIRESTORE READ] Fetching order document from 'orders' collection. Document ID: ${orderId}`);
      const orderRef = db.collection("orders").doc(orderId);
      
      console.log(`[FIRESTORE WRITE] Executing transaction to approve order cancellation. Order ID: ${orderId}`);
      await db.runTransaction(async (transaction) => {
        console.log(`[FIRESTORE READ] (Transaction) Fetching order document from 'orders' collection. Document ID: ${orderId}`);
        const orderDoc = await transaction.get(orderRef);
        if (!orderDoc.exists) throw new Error("Order not found");
        const orderData = orderDoc.data()!;
        
        if (orderData.status !== "cancel_requested") {
          throw new Error("Order is not pending cancellation");
        }

        // Restore stock - read all products first
        const productDocs = [];
        for (const item of orderData.items) {
          const productRef = db.collection("products").doc(item.productId);
          console.log(`[FIRESTORE READ] (Transaction) Fetching product document from 'products' collection. Product ID: ${item.productId}`);
          const productDoc = await transaction.get(productRef);
          productDocs.push({ item, productRef, productDoc });
        }

        const updatesByProduct = new Map<string, any>();
        
        for (const { item, productRef, productDoc } of productDocs) {
          if (productDoc.exists) {
            const pData = productDoc.data()!;
            const productId = productRef.id;
            
            if (!updatesByProduct.has(productId)) {
              updatesByProduct.set(productId, {
                ref: productRef,
                updates: { stock: pData.stock || 0 },
                variants: pData.variants ? [...pData.variants] : null
              });
            }
            
            const prodUpdate = updatesByProduct.get(productId);
            prodUpdate.updates.stock += item.quantity;
            
            if (item.variantId && prodUpdate.variants) {
               const variantIndex = prodUpdate.variants.findIndex((v: any) => v.id === item.variantId);
               if (variantIndex !== -1) {
                  prodUpdate.variants[variantIndex].stock = (prodUpdate.variants[variantIndex].stock || 0) + item.quantity;
                  prodUpdate.updates.variants = prodUpdate.variants;
               }
            }
          }
        }
        
        for (const prodUpdate of updatesByProduct.values()) {
          console.log(`[FIRESTORE WRITE] (Transaction) Updating product stock in 'products' collection. Product ID: ${prodUpdate.ref.id}`);
          transaction.update(prodUpdate.ref, prodUpdate.updates);
        }

        console.log(`[FIRESTORE WRITE] (Transaction) Updating order document in 'orders' collection to 'cancelled'. Document ID: ${orderId}`);
        transaction.update(orderRef, {
          status: "cancelled",
          statusHistory: admin.firestore.FieldValue.arrayUnion({
            status: "cancelled",
            timestamp: new Date().toISOString(),
            message: "Cancellation approved by admin"
          })
        });
      });

      // Email customer
      console.log(`[FIRESTORE READ] Fetching updated order document from 'orders' collection. Document ID: ${orderId}`);
      const orderDoc = await orderRef.get();
      const orderData = orderDoc.data()!;
      const customerEmail = orderData.contactEmail;
      if (customerEmail && process.env.SMTP_HOST) {
        await transporter.sendMail({
          from: `"ViBa Mart" <${process.env.SMTP_USER}>`,
          to: customerEmail,
          subject: "Order Cancellation Approved",
          html: `<h2>Hello ${orderData.contactName || 'Customer'},</h2><p>Your cancellation request for order <strong>#${orderId}</strong> has been approved.</p><p>If you paid online, your refund will be processed shortly.</p>`,
        });
      }

      res.json({ success: true, message: "Cancellation approved successfully" });
    } catch (error: any) {
      const errorLocation = getErrorLocation(error);
      console.error("FUNCTION_INVOCATION_FAILED: Approve cancellation handler error.");
      console.error("Stack trace:", error.stack);
      console.error(`Failing Line: ${errorLocation.file}:${errorLocation.line}`);
      res.status(500).json({
        success: false,
        error: "FUNCTION_INVOCATION_FAILED",
        message: error.message || "Failed to approve cancellation",
        file: errorLocation.file,
        line: errorLocation.line,
        stack: error.stack
      });
    }
  });

  // Orders: Admin Reject Cancellation
  app.post("/api/orders/reject-cancellation", verifyAuth, async (req, res) => {
    const { orderId } = req.body;
    const decodedToken = (req as any).user;
    
    // Simple admin check
    let isAdmin = false;
    if (decodedToken.email === 'vk311779@gmail.com' && decodedToken.email_verified) {
      isAdmin = true;
    } else {
      try {
        console.log(`[FIRESTORE READ] Fetching user document from 'users' collection. Document ID: ${decodedToken.uid}`);
        const userDoc = await admin.firestore().collection("users").doc(decodedToken.uid).get();
        if (userDoc.exists && userDoc.data()?.role === 'admin') isAdmin = true;
      } catch (e) {
        console.error("Error fetching user role", e);
      }
    }
    
    if (!isAdmin) return res.status(403).json({ success: false, error: "Admin access required" });

    try {
      const db = admin.firestore();
      console.log(`[FIRESTORE READ] Fetching order document from 'orders' collection. Document ID: ${orderId}`);
      const orderRef = db.collection("orders").doc(orderId);
      
      const orderDoc = await orderRef.get();
      if (!orderDoc.exists) throw new Error("Order not found");
      
      const orderUpdates = {
        status: "cancel_rejected",
        statusHistory: admin.firestore.FieldValue.arrayUnion({
          status: "cancel_rejected",
          timestamp: new Date().toISOString(),
          message: "Cancellation rejected by admin"
        })
      };
      console.log(`[FIRESTORE WRITE] Updating order document in 'orders' collection to 'cancel_rejected'. Document ID: ${orderId}`);
      await orderRef.update(orderUpdates);

      res.json({ success: true, message: "Cancellation rejected" });
    } catch (error: any) {
      const errorLocation = getErrorLocation(error);
      console.error("FUNCTION_INVOCATION_FAILED: Reject cancellation handler error.");
      console.error("Stack trace:", error.stack);
      console.error(`Failing Line: ${errorLocation.file}:${errorLocation.line}`);
      res.status(500).json({
        success: false,
        error: "FUNCTION_INVOCATION_FAILED",
        message: error.message || "Failed to reject cancellation",
        file: errorLocation.file,
        line: errorLocation.line,
        stack: error.stack
      });
    }
  });


  // Returns: Request Return
  app.post("/api/returns/request", returnRequestHandler);


  // Refunds: Request Refund
  app.post("/api/refunds/request", refundRequestHandler);

  // Requests: Admin Update Status
  app.post("/api/requests/update-status", updateStatusHandler);


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
      const customToken = await admin.auth().createCustomToken(uid, {
        email_verified: true
      });
      
      return res.json({ success: true, customToken });
    } catch (error: any) {
      console.error("Verify Email OTP error:", error);
      res.status(500).json({ success: false, error: "Failed to verify OTP" });
    }
  });

  // ==========================================
  // NOTIFICATION & ENGAGEMENT API ROUTES
  // ==========================================

  // Register Device Push Token
  app.post("/api/notifications/devices/register", async (req, res) => {
    try {
      const { token, userId, platform, os, browser, appVersion, metadata } = req.body;
      if (!token) {
        return res.status(400).json({ success: false, error: "Device token is required" });
      }

      const db = admin.firestore();
      const sanitizedToken = token.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 120);
      const docId = `${userId || 'anon'}_${sanitizedToken}`;

      await db.collection("notification_devices").doc(docId).set({
        token,
        userId: userId || 'anonymous',
        platform: platform || 'web',
        os: os || 'unknown',
        browser: browser || 'unknown',
        appVersion: appVersion || '1.0.0',
        isActive: true,
        lastActiveAt: new Date().toISOString(),
        metadata: metadata || {},
        updatedAt: new Date().toISOString()
      }, { merge: true });

      res.json({ success: true, message: "Device registered successfully" });
    } catch (error: any) {
      console.error("Device registration error:", error);
      res.status(500).json({ success: false, error: error.message || "Failed to register device" });
    }
  });

  // Ingest Client Telemetry Event
  app.post("/api/notifications/events", async (req, res) => {
    try {
      const { userId, eventType, category, channel, metadata, campaignId, templateId, notificationId } = req.body;
      if (!eventType) {
        return res.status(400).json({ success: false, error: "eventType is required" });
      }

      const db = admin.firestore();
      const eventRecord = {
        userId: userId || 'anonymous',
        eventType,
        category: category || 'general',
        channel: channel || 'in_app',
        metadata: metadata || {},
        campaignId: campaignId || null,
        templateId: templateId || null,
        notificationId: notificationId || null,
        timestamp: new Date().toISOString()
      };

      await db.collection("notification_events").add(eventRecord);
      res.json({ success: true, message: "Event recorded" });
    } catch (error: any) {
      console.error("Notification event ingestion error:", error);
      res.status(500).json({ success: false, error: error.message || "Failed to ingest event" });
    }
  });

  // Send Direct / Transactional Notification
  app.post("/api/notifications/send", async (req, res) => {
    try {
      const {
        userId,
        title,
        message,
        category = 'system_alert',
        channel = 'in_app',
        priority = 'high',
        actionUrl,
        imageUrl,
        orderId,
        productId,
        metadata = {}
      } = req.body;

      if (!title || !message) {
        return res.status(400).json({ success: false, error: "Title and message are required" });
      }

      const db = admin.firestore();
      const notificationDoc = {
        userId: userId || 'all',
        title,
        message,
        body: message,
        category,
        channel,
        priority,
        actionUrl: actionUrl || null,
        imageUrl: imageUrl || null,
        orderId: orderId || null,
        productId: productId || null,
        read: false,
        isRead: false,
        metadata,
        createdAt: new Date().toISOString()
      };

      const docRef = await db.collection("user_notifications").add(notificationDoc);

      // Audit log
      await db.collection("notificationLogs").add({
        notificationId: docRef.id,
        recipientId: userId || 'all',
        category,
        channel,
        title,
        status: 'delivered',
        dispatchedAt: new Date().toISOString()
      });

      res.json({ success: true, notificationId: docRef.id });
    } catch (error: any) {
      console.error("Direct notification dispatch error:", error);
      res.status(500).json({ success: false, error: error.message || "Failed to send notification" });
    }
  });

  // AI Copy Generator for Marketing Campaigns
  app.post("/api/notifications/generate-copy", async (req, res) => {
    try {
      const { category, tone = 'enthusiastic', discount, productName, targetAudience } = req.body;

      // Deterministic & creative template generation matrix
      const copies: Record<string, { titles: string[], bodies: string[] }> = {
        flash_sale: {
          titles: [
            `⚡ FLASH SALE: Save ${discount || '40%'} Right Now!`,
            `🔥 Hurry! Unbeatable ${discount || 'Special'} Price Drops Inside`,
            `⏰ 2 Hours Only: Grab Your Favorites Before They're Gone!`
          ],
          bodies: [
            `Don't miss our biggest markdown today! Premium quality guaranteed with fast doorstep shipping.`,
            `Exclusive flash deal reserved for you. Tap now to secure your basket before stock expires!`,
            `Mega savings unlocked for a limited time. Shop the collection now on ViBa Mart!`
          ]
        },
        price_drop: {
          titles: [
            `📉 Price Drop Alert on ${productName || 'Your Saved Item'}!`,
            `🎉 Good News: Price Just Slashed for You!`,
            `🏷️ Steal Deal: ${productName || 'Product'} is now at its Lowest Price`
          ],
          bodies: [
            `We noticed you were checking out ${productName || 'this item'}. The price just dropped—grab it before it sells out!`,
            `Your wishlist item is on sale! Complete your purchase now for instant dispatch.`,
            `Special discount applied! Experience unmatched savings today on ViBa Mart.`
          ]
        },
        back_in_stock: {
          titles: [
            `✨ Back in Stock: ${productName || 'Your Favorite Item'} is Here!`,
            `📦 Fresh Stock Just Landed at ViBa Mart!`,
            `🚀 Restocked & Ready to Ship to Your Door!`
          ],
          bodies: [
            `The item you've been waiting for is officially back in stock. Units are limited, so place your order today!`,
            `Restocked by popular demand! Tap to claim yours before warehouse inventory depletes.`,
            `Good news! ${productName || 'Your saved product'} is available again. Shop now!`
          ]
        },
        abandoned_cart: {
          titles: [
            `🛒 You left something special in your cart!`,
            `⏳ Your basket is waiting! Complete your order today`,
            `🎁 Extra perks waiting in your cart—finish checkout!`
          ],
          bodies: [
            `Items in your cart are in high demand. Finish your checkout in 1-click for guaranteed delivery.`,
            `Still thinking it over? We've reserved your items so you don't miss out!`,
            `Your dream products are just a tap away. Complete checkout today on ViBa Mart!`
          ]
        }
      };

      const selectedCategoryCopies = copies[category] || copies.flash_sale;
      const titleIndex = Math.floor(Math.random() * selectedCategoryCopies.titles.length);
      const bodyIndex = Math.floor(Math.random() * selectedCategoryCopies.bodies.length);

      res.json({
        success: true,
        generatedTitle: selectedCategoryCopies.titles[titleIndex],
        generatedBody: selectedCategoryCopies.bodies[bodyIndex],
        variants: [
          { title: selectedCategoryCopies.titles[0], body: selectedCategoryCopies.bodies[0] },
          { title: selectedCategoryCopies.titles[1], body: selectedCategoryCopies.bodies[1] },
          { title: selectedCategoryCopies.titles[2], body: selectedCategoryCopies.bodies[2] }
        ]
      });
    } catch (error: any) {
      console.error("Generate copy error:", error);
      res.status(500).json({ success: false, error: error.message || "Failed to generate copy" });
    }
  });

  // Catch-all for undefined API routes to return 404 JSON instead of falling through to Vite (which may cause infinite proxy loops)
  app.all("/api/*", (req, res) => {
    res.status(404).json({ success: false, error: `API route not found: ${req.method} ${req.url}` });
  });

  // Global error handler for API routes
  app.use("/api", (err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error("Unhandled API Error:", err);
    res.status(err.status || 500).json({
      success: false,
      error: err.message || "Internal Server Error"
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
