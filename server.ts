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
      connectionTimeout: 5000,
      greetingTimeout: 5000,
      socketTimeout: 5000,
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


  // Setup Nodemailer transporter
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.ethereal.email",
    port: Number(process.env.SMTP_PORT) || 587,
    auth: {
      user: process.env.SMTP_USER || "test",
      pass: process.env.SMTP_PASS || "test",
    },
    connectionTimeout: 5000,
    greetingTimeout: 5000,
    socketTimeout: 5000,
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

      const isPlaceholder = !process.env.SMTP_USER || process.env.SMTP_USER === "your-email@gmail.com" || process.env.SMTP_USER === "test";
      
      // Send Email
      if (process.env.SMTP_HOST && !isPlaceholder) {
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

  // Orders: Cancel Order
  app.post("/api/orders/cancel", verifyAuth, async (req, res) => {
    const { orderId, reason } = req.body;
    const uid = (req as any).user.uid;

    if (!orderId || typeof orderId !== 'string' || !orderId.trim()) {
      return res.status(400).json({ success: false, error: "Order ID is required and must be a valid string." });
    }
    if (!reason || typeof reason !== 'string' || !reason.trim()) {
      return res.status(400).json({ success: false, error: "Reason is required and must be a valid string." });
    }

    try {
      const db = admin.firestore();
      const orderRef = db.collection("orders").doc(orderId);
      
      const orderDoc = await orderRef.get();
      if (!orderDoc.exists) {
        return res.status(404).json({ success: false, error: "Order not found" });
      }

      const orderData = orderDoc.data()!;
      if (orderData.customerId !== uid) {
        return res.status(403).json({ success: false, error: "Unauthorized to cancel this order" });
      }

      const allowedStatuses = ["pending", "confirmed", "packed"];
      if (!allowedStatuses.includes(orderData.status)) {
        return res.status(400).json({ success: false, error: `Cannot cancel order in ${orderData.status} status` });
      }

      // Check for duplicate cancellation requests
      const existingCancellations = await db.collection("requests")
        .where("orderId", "==", orderId)
        .where("type", "==", "cancellation")
        .get();

      if (!existingCancellations.empty) {
        return res.status(400).json({ success: false, error: "A duplicate cancellation request already exists for this order." });
      }

      // Check if manual cancellation is enabled
      const settingsDoc = await db.collection("settings").doc("store").get();
      const enableManualCancellation = settingsDoc.exists && settingsDoc.data()?.enableManualCancellation === true;

      // Generate unique doc ID
      const docRef = db.collection("requests").doc();
      const requestId = docRef.id;

      const requestDoc = {
        id: requestId,
        requestId,
        orderId,
        customerId: uid,
        userId: uid,
        requestType: 'cancellation',
        type: 'cancellation',
        requestReason: reason,
        reason,
        status: enableManualCancellation ? 'requested' : 'approved',
        createdDate: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedDate: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      await docRef.set(requestDoc);

      if (enableManualCancellation) {
        await orderRef.update({
          status: "cancel_requested",
          cancellationReason: reason,
          statusHistory: admin.firestore.FieldValue.arrayUnion({
            status: "cancel_requested",
            timestamp: new Date().toISOString(),
            message: "Cancellation requested by customer"
          })
        });
      } else {
        // Direct cancel
        await db.runTransaction(async (transaction) => {
          const productDocs = [];
          for (const item of orderData.items) {
            const productRef = db.collection("products").doc(item.productId);
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
            transaction.update(prodUpdate.ref, prodUpdate.updates);
          }
          transaction.update(orderRef, {
            status: "cancelled",
            cancellationReason: reason,
            statusHistory: admin.firestore.FieldValue.arrayUnion({
              status: "cancelled",
              timestamp: new Date().toISOString(),
              message: "Cancelled by customer"
            })
          });
        });
      }

      // Notifications & Emails
      const customerEmail = orderData.contactEmail || (req as any).user.email;
      const customerName = orderData.contactName || "Customer";

      if (enableManualCancellation) {
        await createNotification(
          uid,
          "Cancellation Request Submitted",
          `Your cancellation request for order #${orderId} has been submitted successfully.`,
          orderId
        );
        if (customerEmail) {
          await sendEmailNotification(
            customerEmail,
            customerName,
            "Order Cancellation Request Received",
            `We have received your cancellation request for order #${orderId}. Reason: ${reason}. It is currently pending review.`
          );
        }
      } else {
        await createNotification(
          uid,
          "Order Cancelled",
          `Your order #${orderId} has been cancelled successfully.`,
          orderId
        );
        if (customerEmail) {
          await sendEmailNotification(
            customerEmail,
            customerName,
            "Order Cancelled Successfully",
            `Your order #${orderId} has been successfully cancelled. If you paid online, your refund will be processed within 5-7 business days.`
          );
        }
      }

      // Admin Notification
      await createNotification(
        "admin",
        "New Cancellation Request",
        `A new cancellation request was submitted for order #${orderId}.`,
        orderId
      );

      res.json({ success: true, message: "Order cancelled successfully", requestId });
    } catch (error: any) {
      console.error("Cancel order error:", error);
      res.status(500).json({ success: false, error: error.message || "Failed to cancel order" });
    }
  });

  // Orders: Admin Approve Cancellation
  app.post("/api/orders/approve-cancellation", verifyAuth, async (req, res) => {
    const { orderId } = req.body;
    const decodedToken = (req as any).user;
    
    // Simple admin check
    let isAdmin = false;
    if (decodedToken.email === 'vk311779@gmail.com' && decodedToken.email_verified) {
      isAdmin = true;
    } else {
      const userDoc = await admin.firestore().collection("users").doc(decodedToken.uid).get();
      if (userDoc.exists && userDoc.data()?.role === 'admin') isAdmin = true;
    }
    
    if (!isAdmin) return res.status(403).json({ success: false, error: "Admin access required" });

    try {
      const db = admin.firestore();
      const orderRef = db.collection("orders").doc(orderId);
      
      await db.runTransaction(async (transaction) => {
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
          transaction.update(prodUpdate.ref, prodUpdate.updates);
        }

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
      console.error("Approve cancellation error:", error);
      res.status(500).json({ success: false, error: error.message || "Failed to approve cancellation" });
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
      const userDoc = await admin.firestore().collection("users").doc(decodedToken.uid).get();
      if (userDoc.exists && userDoc.data()?.role === 'admin') isAdmin = true;
    }
    
    if (!isAdmin) return res.status(403).json({ success: false, error: "Admin access required" });

    try {
      const db = admin.firestore();
      const orderRef = db.collection("orders").doc(orderId);
      
      const orderDoc = await orderRef.get();
      if (!orderDoc.exists) throw new Error("Order not found");
      
      await orderRef.update({
        status: "cancel_rejected",
        statusHistory: admin.firestore.FieldValue.arrayUnion({
          status: "cancel_rejected",
          timestamp: new Date().toISOString(),
          message: "Cancellation rejected by admin"
        })
      });

      res.json({ success: true, message: "Cancellation rejected" });
    } catch (error: any) {
      console.error("Reject cancellation error:", error);
      res.status(500).json({ success: false, error: error.message || "Failed to reject cancellation" });
    }
  });

  // Returns: Request Return
  app.post("/api/returns/request", verifyAuth, async (req, res) => {
    const { orderId, reason, comments, images, productIds } = req.body;
    const uid = (req as any).user.uid;

    if (!orderId || typeof orderId !== 'string' || !orderId.trim()) {
      return res.status(400).json({ success: false, error: "Order ID is required and must be a valid string." });
    }
    if (!reason || typeof reason !== 'string' || !reason.trim()) {
      return res.status(400).json({ success: false, error: "Reason is required and must be a valid string." });
    }
    if (!images || !Array.isArray(images) || images.length === 0) {
      return res.status(400).json({ success: false, error: "At least one proof image is required." });
    }
    if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
      return res.status(400).json({ success: false, error: "At least one product must be selected for return." });
    }

    try {
      const db = admin.firestore();
      const orderRef = db.collection("orders").doc(orderId);
      const orderDoc = await orderRef.get();
      
      if (!orderDoc.exists) {
        return res.status(404).json({ success: false, error: "Order not found" });
      }
      
      const orderData = orderDoc.data()!;
      if (orderData.customerId !== uid) {
        return res.status(403).json({ success: false, error: "Unauthorized" });
      }
      
      if (orderData.status !== "delivered") {
        return res.status(400).json({ success: false, error: "Only delivered orders can be returned" });
      }

      const settingsDoc = await db.collection("settings").doc("store").get();
      const returnWindowDays = settingsDoc.exists && settingsDoc.data()?.returnWindowDays ? settingsDoc.data()?.returnWindowDays : 7;
      
      const deliveredStatus = orderData.statusHistory?.find((s: any) => s.status === "delivered");
      const deliveryDate = deliveredStatus ? new Date(deliveredStatus.timestamp) : new Date(orderData.createdAt); 
      
      const windowMs = returnWindowDays * 24 * 60 * 60 * 1000;
      if (Date.now() - deliveryDate.getTime() > windowMs) {
        return res.status(400).json({ success: false, error: "Return window has expired" });
      }

      const existingReturns = await db.collection("requests")
        .where("orderId", "==", orderId)
        .where("type", "==", "return")
        .get();

      const newProducts = productIds;
      let overlap = false;
      existingReturns.forEach(doc => {
        const existingProducts = doc.data().productIds || [];
        if (existingProducts.some((id: string) => newProducts.includes(id))) {
          overlap = true;
        }
      });
      if (overlap) {
        return res.status(400).json({ success: false, error: "A return request already exists for one or more selected items" });
      }

      let calculatedRefund = 0;
      orderData.items.forEach((item: any) => {
        if (newProducts.includes(item.productId)) {
          calculatedRefund += (item.price * item.quantity);
        }
      });

      // Generate Request ID and create document
      const docRef = db.collection("requests").doc();
      const requestId = docRef.id;

      const returnDoc = {
        id: requestId,
        requestId,
        orderId,
        customerId: uid,
        userId: uid,
        requestType: 'return',
        type: 'return',
        requestReason: reason,
        reason,
        comments: comments || "",
        images,
        productIds: newProducts,
        status: "requested",
        createdDate: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedDate: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        refundAmount: calculatedRefund
      };

      await docRef.set(returnDoc);
      
      await orderRef.update({
        hasReturnRequest: true,
        returnRequestId: requestId,
        statusHistory: admin.firestore.FieldValue.arrayUnion({
          status: "return_requested",
          timestamp: new Date().toISOString(),
          message: "Return requested by customer"
        })
      });

      // Notifications
      const customerEmail = orderData.contactEmail || (req as any).user.email;
      const customerName = orderData.contactName || "Customer";

      await createNotification(
        uid,
        "Return Request Submitted",
        `Your return request for order #${orderId} has been submitted successfully.`,
        orderId
      );

      if (customerEmail) {
        await sendEmailNotification(
          customerEmail,
          customerName,
          "Return Request Received",
          `We have received your return request for order #${orderId}. Our team will review the details and images provided within 48 hours.`
        );
      }

      // Admin Notification
      await createNotification(
        "admin",
        "New Return Request",
        `A new return request has been submitted for order #${orderId}.`,
        orderId
      );

      res.json({ success: true, message: "Request submitted successfully", requestId });
    } catch (error: any) {
      console.error("Return request error:", error);
      res.status(500).json({ success: false, error: error.message || "Failed to submit return request" });
    }
  });

  // Refunds: Request Refund
  app.post("/api/refunds/request", verifyAuth, async (req, res) => {
    const { orderId, reason, comments } = req.body;
    const uid = (req as any).user.uid;

    if (!orderId || typeof orderId !== 'string' || !orderId.trim()) {
      return res.status(400).json({ success: false, error: "Order ID is required and must be a valid string." });
    }
    if (!reason || typeof reason !== 'string' || !reason.trim()) {
      return res.status(400).json({ success: false, error: "Reason is required and must be a valid string." });
    }

    try {
      const db = admin.firestore();
      const orderRef = db.collection("orders").doc(orderId);
      const orderDoc = await orderRef.get();
      
      if (!orderDoc.exists) {
        return res.status(404).json({ success: false, error: "Order not found" });
      }
      
      const orderData = orderDoc.data()!;
      if (orderData.customerId !== uid) {
        return res.status(403).json({ success: false, error: "Unauthorized" });
      }
      
      // Allow refund if cancelled or returned but not yet refunded
      if (orderData.status !== "cancelled" && orderData.status !== "returned") {
        return res.status(400).json({ success: false, error: "Only cancelled or returned orders are eligible for refund" });
      }

      if (orderData.paymentStatus === "refunded") {
        return res.status(400).json({ success: false, error: "Order is already refunded" });
      }

      const existingRefunds = await db.collection("requests").where("orderId", "==", orderId).where("type", "==", "refund").get();
      if (!existingRefunds.empty) {
        return res.status(400).json({ success: false, error: "A refund request already exists for this order" });
      }

      // Generate Request ID and create document
      const docRef = db.collection("requests").doc();
      const requestId = docRef.id;

      const refundDoc = {
        id: requestId,
        requestId,
        userId: uid,
        customerId: uid,
        orderId,
        type: 'refund',
        requestType: 'refund',
        reason,
        requestReason: reason,
        comments: comments || "",
        status: "requested",
        createdDate: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedDate: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        refundAmount: orderData.total
      };

      await docRef.set(refundDoc);

      await orderRef.update({
        hasRefundRequest: true,
        refundRequestId: requestId,
        statusHistory: admin.firestore.FieldValue.arrayUnion({
          status: "refund_requested",
          timestamp: new Date().toISOString(),
          message: "Refund requested by customer"
        })
      });

      // Notifications & Emails
      const customerEmail = orderData.contactEmail || (req as any).user.email;
      const customerName = orderData.contactName || "Customer";

      await createNotification(
        uid,
        "Refund Request Submitted",
        `Your refund request for order #${orderId} has been submitted successfully.`,
        orderId
      );

      if (customerEmail) {
        await sendEmailNotification(
          customerEmail,
          customerName,
          "Refund Request Received",
          `We have received your refund request for order #${orderId}. Our team will review the request and get back to you within 48 hours.`
        );
      }

      // Admin Notification
      await createNotification(
        "admin",
        "New Refund Request",
        `A new refund request has been submitted for order #${orderId}.`,
        orderId
      );

      res.json({ success: true, message: "Request submitted successfully", requestId });
    } catch (error: any) {
      console.error("Refund request error:", error);
      res.status(500).json({ success: false, error: error.message || "Failed to submit refund request" });
    }
  });

  // Requests: Admin Update Status
  app.post("/api/requests/update-status", verifyAuth, async (req, res) => {
    const { requestId, status, adminNotes, refundAmount, refundMethod, refundTransactionId, estimatedCompletionDate } = req.body;
    
    if (!requestId || typeof requestId !== 'string' || !requestId.trim()) {
      return res.status(400).json({ success: false, error: "Request ID is required." });
    }
    if (!status || typeof status !== 'string' || !status.trim()) {
      return res.status(400).json({ success: false, error: "Status is required." });
    }

    const decodedToken = (req as any).user;
    let isAdmin = false;
    if (decodedToken.email === 'vk311779@gmail.com' && decodedToken.email_verified) {
      isAdmin = true;
    } else {
      const userDoc = await admin.firestore().collection("users").doc(decodedToken.uid).get();
      if (userDoc.exists && userDoc.data()?.role === 'admin') isAdmin = true;
    }
    
    if (!isAdmin) {
      return res.status(403).json({ success: false, error: "Admin access required" });
    }

    try {
      const db = admin.firestore();
      const reqRef = db.collection("requests").doc(requestId);
      const reqDoc = await reqRef.get();
      
      if (!reqDoc.exists) {
        return res.status(404).json({ success: false, error: "Request not found" });
      }
      
      const rData = reqDoc.data()!;
      const oldStatus = rData.status;
      const orderId = rData.orderId;
      const type = rData.type || rData.requestType;
      const customerId = rData.customerId || rData.userId;

      const orderRef = db.collection("orders").doc(orderId);
      const orderDoc = await orderRef.get();
      
      if (!orderDoc.exists) {
        return res.status(404).json({ success: false, error: "Order not found for this request" });
      }
      const orderData = orderDoc.data()!;

      const updateData: any = { 
        status,
        updatedAt: new Date().toISOString(),
        updatedDate: new Date().toISOString()
      };
      
      if (adminNotes !== undefined) updateData.adminNotes = adminNotes;
      if (refundAmount !== undefined) updateData.refundAmount = Number(refundAmount);
      if (refundMethod !== undefined) updateData.refundMethod = refundMethod;
      if (refundTransactionId !== undefined) updateData.refundTransactionId = refundTransactionId;
      if (estimatedCompletionDate !== undefined) updateData.estimatedCompletionDate = estimatedCompletionDate;

      // Execute database updates inside transaction or sequence
      const isCancellationStockRestore = type === 'cancellation' && 
                                          (status === 'approved' || status === 'cancelled') && 
                                          !(oldStatus === 'approved' || oldStatus === 'cancelled');

      if (isCancellationStockRestore) {
        // Run transaction to restore stock and update order
        await db.runTransaction(async (transaction) => {
          const oDoc = await transaction.get(orderRef);
          if (oDoc.exists) {
            const oData = oDoc.data()!;
            const productDocs = [];
            for (const item of oData.items) {
              const productRef = db.collection("products").doc(item.productId);
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
              transaction.update(prodUpdate.ref, prodUpdate.updates);
            }
            
            transaction.update(orderRef, {
              status: "cancelled",
              statusHistory: admin.firestore.FieldValue.arrayUnion({
                status: "cancelled",
                timestamp: new Date().toISOString(),
                message: "Cancellation approved by admin"
              })
            });
          }
        });
      } else {
        // Sync Order updates based on status transitions
        let orderUpdates: any = {};
        let statusHistoryMessage = "";

        if (type === 'cancellation') {
          if (status === 'rejected') {
            orderUpdates.status = 'confirmed';
            statusHistoryMessage = "Cancellation request rejected by admin";
          } else if (status === 'refund_initiated') {
            orderUpdates.paymentStatus = 'refund_initiated';
            statusHistoryMessage = "Refund initiated for cancellation";
          } else if (status === 'refund_completed') {
            orderUpdates.status = 'cancelled';
            orderUpdates.paymentStatus = 'refunded';
            statusHistoryMessage = "Refund completed successfully";
          }
        } 
        else if (type === 'return') {
          if (status === 'approved') {
            orderUpdates.status = 'return_approved';
            statusHistoryMessage = "Return approved by admin";
          } else if (status === 'pickup_scheduled') {
            orderUpdates.status = 'return_pickup_scheduled';
            statusHistoryMessage = "Return pickup scheduled";
          } else if (status === 'product_received') {
            orderUpdates.status = 'return_received';
            statusHistoryMessage = "Return product received at warehouse";
          } else if (status === 'quality_check') {
            orderUpdates.status = 'return_quality_checked';
            statusHistoryMessage = "Quality check completed successfully";
          } else if (status === 'refund_initiated') {
            orderUpdates.paymentStatus = 'refund_initiated';
            statusHistoryMessage = "Refund initiated for return";
          } else if (status === 'refund_completed' || status === 'refund_processed') {
            orderUpdates.status = 'returned';
            orderUpdates.paymentStatus = 'refunded';
            statusHistoryMessage = "Refund completed successfully";
          } else if (status === 'rejected') {
            orderUpdates.status = 'delivered';
            statusHistoryMessage = "Return request rejected by admin";
          }
        } 
        else if (type === 'refund') {
          if (status === 'under_review') {
            statusHistoryMessage = "Refund request under review";
          } else if (status === 'approved') {
            orderUpdates.status = 'refund_approved';
            statusHistoryMessage = "Refund approved by admin";
          } else if (status === 'processing') {
            statusHistoryMessage = "Refund processing initiated";
          } else if (status === 'refund_sent') {
            orderUpdates.paymentStatus = 'refund_initiated';
            statusHistoryMessage = "Refund sent/initiated";
          } else if (status === 'refunded' || status === 'refund_completed') {
            orderUpdates.status = 'refunded';
            orderUpdates.paymentStatus = 'refunded';
            statusHistoryMessage = "Refund completed successfully";
          } else if (status === 'rejected') {
            statusHistoryMessage = "Refund request rejected by admin";
          }
        }

        if (statusHistoryMessage) {
          orderUpdates.statusHistory = admin.firestore.FieldValue.arrayUnion({
            status: `req_${status}`,
            timestamp: new Date().toISOString(),
            message: statusHistoryMessage
          });
        }

        if (Object.keys(orderUpdates).length > 0) {
          await orderRef.update(orderUpdates);
        }
      }

      await reqRef.update(updateData);

      // Trigger Notifications and Email
      const customerEmail = orderData.contactEmail || decodedToken.email;
      const customerName = orderData.contactName || "Customer";
      const finalRefundAmount = refundAmount || rData.refundAmount || orderData.total || 0;

      let notifTitle = "";
      let notifMessage = "";
      let emailSubject = "";
      let emailBody = "";

      // Map transitions to user-facing notification content
      if (status === 'approved' || status === 'cancelled') {
        notifTitle = "Request Approved";
        notifMessage = `Your ${type} request for order #${orderId} has been approved.`;
        emailSubject = `${type.charAt(0).toUpperCase() + type.slice(1)} Request Approved`;
        emailBody = `Your ${type} request for order #${orderId} has been approved. ` + 
                    (type === 'return' ? "Please pack the items, our delivery partner will pick them up soon." : "We are processing your refund.");
      } else if (status === 'rejected') {
        notifTitle = "Request Rejected";
        notifMessage = `Your ${type} request for order #${orderId} has been rejected.`;
        emailSubject = `${type.charAt(0).toUpperCase() + type.slice(1)} Request Rejected`;
        emailBody = `Your ${type} request for order #${orderId} has been rejected. Admin Notes: ${adminNotes || 'None'}`;
      } else if (status === 'refund_initiated' || status === 'refund_sent' || status === 'processing') {
        notifTitle = "Refund Initiated";
        notifMessage = `Refund of ₹${finalRefundAmount} for order #${orderId} has been initiated.`;
        emailSubject = "Refund Initiated";
        emailBody = `Your refund of ₹${finalRefundAmount} for order #${orderId} has been initiated. Method: ${refundMethod || 'Original Payment Method'}. Estimated completion date: ${estimatedCompletionDate || 'N/A'}.`;
      } else if (status === 'refund_completed' || status === 'refunded' || status === 'refund_processed') {
        notifTitle = "Refund Completed";
        notifMessage = `Refund of ₹${finalRefundAmount} for order #${orderId} has been completed successfully.`;
        emailSubject = "Refund Processed Successfully";
        emailBody = `Your refund of ₹${finalRefundAmount} for order #${orderId} has been successfully completed. Transaction ID: ${refundTransactionId || 'N/A'}. Thank you for shopping with us!`;
      } else if (status === 'pickup_scheduled') {
        notifTitle = "Return Pickup Scheduled";
        notifMessage = `Pickup has been scheduled for return request on order #${orderId}.`;
      } else if (status === 'product_received') {
        notifTitle = "Return Product Received";
        notifMessage = `We have received your return product for order #${orderId}.`;
      } else if (status === 'quality_check') {
        notifTitle = "Quality Check In Progress";
        notifMessage = `Quality check is being performed on your returned items for order #${orderId}.`;
      }

      if (notifTitle) {
        await createNotification(customerId, notifTitle, notifMessage, orderId);
      }

      if (emailSubject && customerEmail) {
        await sendEmailNotification(customerEmail, customerName, emailSubject, emailBody);
      }

      res.json({ success: true, message: "Status updated successfully" });
    } catch (error: any) {
      console.error("Update request status error:", error);
      res.status(500).json({ success: false, error: error.message || "Failed to update request status" });
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
