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

    if (!orderId || !reason) {
      return res.status(400).json({ success: false, error: "Missing required fields" });
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

      // Check if manual cancellation is enabled
      const settingsDoc = await db.collection("settings").doc("store").get();
      const enableManualCancellation = settingsDoc.exists && settingsDoc.data()?.enableManualCancellation === true;

      const requestDoc = {
        userId: uid,
        orderId,
        type: 'cancellation',
        reason,
        status: enableManualCancellation ? 'requested' : 'approved',
        createdAt: new Date().toISOString()
      };
      
      const docRef = await db.collection("requests").add(requestDoc);

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
          for (const item of orderData.items) {
            const productRef = db.collection("products").doc(item.productId);
            const productDoc = await transaction.get(productRef);
            if (productDoc.exists) {
              const pData = productDoc.data()!;
              let newStock = (pData.stock || 0) + item.quantity;
              let updates: any = { stock: newStock };
              
              if (item.variantId && pData.variants) {
                 const variantIndex = pData.variants.findIndex((v: any) => v.id === item.variantId);
                 if (variantIndex !== -1) {
                    let variants = [...pData.variants];
                    variants[variantIndex].stock = (variants[variantIndex].stock || 0) + item.quantity;
                    updates.variants = variants;
                 }
              }
              transaction.update(productRef, updates);
            }
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

      // Fetch email and send confirmation
      const customerEmail = orderData.contactEmail || (req as any).user.email;
      if (customerEmail) {
        const isPlaceholder = !process.env.SMTP_USER || process.env.SMTP_USER === "your-email@gmail.com" || process.env.SMTP_USER === "test";

        const emailHtml = `<h2>Hello ${orderData.contactName || 'Customer'},</h2>
        <p>Your order <strong>#${orderId}</strong> cancellation request has been ${enableManualCancellation ? 'received and is pending approval' : 'successfully processed'}.</p>
        <p>Reason: ${reason}</p>
        ${!enableManualCancellation ? '<p>If you paid online, your refund will be processed within 5-7 business days.</p>' : ''}`;
        
        if (process.env.SMTP_HOST && !isPlaceholder) {
          await transporter.sendMail({
            from: `"ViBa Mart" <${process.env.SMTP_USER}>`,
            to: customerEmail,
            subject: "Order Cancellation Confirmation",
            html: emailHtml,
          });
        } else {
          console.log(`[DEVELOPMENT] Cancellation email for ${customerEmail}:\n${emailHtml}`);
        }
      }

      res.json({ success: true, message: "Order cancelled successfully", requestId: docRef.id });
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

        // Restore stock
        for (const item of orderData.items) {
          const productRef = db.collection("products").doc(item.productId);
          const productDoc = await transaction.get(productRef);
          if (productDoc.exists) {
            const pData = productDoc.data()!;
            let newStock = (pData.stock || 0) + item.quantity;
            let updates: any = { stock: newStock };
            if (item.variantId && pData.variants) {
               const variantIndex = pData.variants.findIndex((v: any) => v.id === item.variantId);
               if (variantIndex !== -1) {
                  let variants = [...pData.variants];
                  variants[variantIndex].stock = (variants[variantIndex].stock || 0) + item.quantity;
                  updates.variants = variants;
               }
            }
            transaction.update(productRef, updates);
          }
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

    if (!orderId || !reason || !images || images.length === 0) {
      return res.status(400).json({ success: false, error: "Missing required fields (orderId, reason, images)" });
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

      const existingReturns = await db.collection("requests").where("orderId", "==", orderId).where("type", "==", "return").get();
      const newProducts = productIds || orderData.items.map((i: any) => i.productId);
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

      const returnDoc = {
        orderId,
        userId: uid,
        type: 'return',
        reason,
        comments: comments || "",
        images,
        productIds: newProducts,
        status: "requested",
        createdAt: new Date().toISOString(),
        refundAmount: calculatedRefund
      };

      const docRef = await db.collection("requests").add(returnDoc);
      
      const customerEmail = orderData.contactEmail || (req as any).user.email;
      if (customerEmail) {
        const isPlaceholder = !process.env.SMTP_USER || process.env.SMTP_USER === "your-email@gmail.com" || process.env.SMTP_USER === "test";
        const emailHtml = `<h2>Hello ${orderData.contactName || 'Customer'},</h2>
        <p>We have received your return request for order <strong>#${orderId}</strong>.</p>
        <p>Our team will review the details and images provided within 48 hours.</p>`;
        
        if (process.env.SMTP_HOST && !isPlaceholder) {
          await transporter.sendMail({
            from: `"ViBa Mart" <${process.env.SMTP_USER}>`,
            to: customerEmail,
            subject: "Return Request Received",
            html: emailHtml,
          });
        }
      }

      res.json({ success: true, returnId: docRef.id });
    } catch (error: any) {
      console.error("Return request error:", error);
      res.status(500).json({ success: false, error: error.message || "Failed to submit return request" });
    }
  });

  // Refunds: Request Refund
  app.post("/api/refunds/request", verifyAuth, async (req, res) => {
    const { orderId, reason, comments } = req.body;
    const uid = (req as any).user.uid;

    if (!orderId || !reason) {
      return res.status(400).json({ success: false, error: "Missing required fields (orderId, reason)" });
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

      const refundDoc = {
        userId: uid,
        orderId,
        type: 'refund',
        reason,
        comments: comments || "",
        status: "requested",
        createdAt: new Date().toISOString(),
        refundAmount: orderData.total
      };

      const docRef = await db.collection("requests").add(refundDoc);
      res.json({ success: true, requestId: docRef.id });
    } catch (error: any) {
      console.error("Refund request error:", error);
      res.status(500).json({ success: false, error: error.message || "Failed to submit refund request" });
    }
  });

  // Requests: Admin Update Status
  app.post("/api/requests/update-status", verifyAuth, async (req, res) => {
    const { requestId, status, adminNotes } = req.body;
    
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
      
      const updateData: any = { 
        status,
        updatedAt: new Date().toISOString()
      };
      
      if (adminNotes !== undefined) {
        updateData.adminNotes = adminNotes;
      }
      
      await reqRef.update(updateData);
      
      const rData = reqDoc.data()!;
      const orderDoc = await db.collection("orders").doc(rData.orderId).get();
      const orderData = orderDoc.data();

      // Process order changes based on request type
      if (rData.type === 'cancellation') {
          if (status === 'approved') {
              // restore stock
              await db.runTransaction(async (transaction) => {
                  const orderRef = db.collection("orders").doc(rData.orderId);
                  const oDoc = await transaction.get(orderRef);
                  if (oDoc.exists) {
                      const oData = oDoc.data()!;
                      for (const item of oData.items) {
                          const productRef = db.collection("products").doc(item.productId);
                          const productDoc = await transaction.get(productRef);
                          if (productDoc.exists) {
                              const pData = productDoc.data()!;
                              let newStock = (pData.stock || 0) + item.quantity;
                              let updates: any = { stock: newStock };
                              if (item.variantId && pData.variants) {
                                 const variantIndex = pData.variants.findIndex((v: any) => v.id === item.variantId);
                                 if (variantIndex !== -1) {
                                    let variants = [...pData.variants];
                                    variants[variantIndex].stock = (variants[variantIndex].stock || 0) + item.quantity;
                                    updates.variants = variants;
                                 }
                              }
                              transaction.update(productRef, updates);
                          }
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
          } else if (status === 'rejected') {
              await db.collection("orders").doc(rData.orderId).update({
                  status: "cancel_rejected",
                  statusHistory: admin.firestore.FieldValue.arrayUnion({
                      status: "cancel_rejected",
                      timestamp: new Date().toISOString(),
                      message: "Cancellation rejected by admin"
                  })
              });
          }
      } else if (rData.type === 'return') {
          if (status === 'refund_processed' && orderData) {
            await db.collection("orders").doc(rData.orderId).update({
              status: 'refunded',
              statusHistory: admin.firestore.FieldValue.arrayUnion({
                status: "refunded",
                timestamp: new Date().toISOString(),
                message: "Refund processed successfully"
              })
            });
          }
      } else if (rData.type === 'refund') {
          if (status === 'refunded' && orderData) {
            await db.collection("orders").doc(rData.orderId).update({
              status: 'refunded',
              paymentStatus: 'refunded',
              statusHistory: admin.firestore.FieldValue.arrayUnion({
                status: "refunded",
                timestamp: new Date().toISOString(),
                message: "Refund processed successfully"
              })
            });
          }
      }

      if (orderData && (orderData.contactEmail || decodedToken.email)) {
        const customerEmail = orderData.contactEmail || decodedToken.email;
        let subject = "";
        let msg = "";
        
        if (rData.type === 'cancellation') {
             if (status === 'approved') {
                 subject = "Order Cancellation Approved";
                 msg = "Your cancellation request has been approved. If you paid online, your refund will be processed shortly.";
             } else if (status === 'rejected') {
                 subject = "Order Cancellation Rejected";
                 msg = "Your cancellation request has been rejected.";
             }
        } else if (rData.type === 'return') {
            if (status === 'approved') {
              subject = "Return Request Approved";
              msg = "Your return request has been approved. Please pack the items, our delivery partner will pick them up soon.";
            } else if (status === 'rejected') {
              subject = "Return Request Rejected";
              msg = "Unfortunately, your return request has been rejected. Please check your account for details.";
            } else if (status === 'refund_processed') {
              subject = "Refund Processed";
              msg = `Your refund of ₹${rData.refundAmount} has been processed to your original payment method.`;
            }
        } else if (rData.type === 'refund') {
            if (status === 'refunded') {
              subject = "Refund Processed";
              msg = `Your refund of ₹${rData.refundAmount} has been processed to your original payment method.`;
            } else if (status === 'rejected') {
              subject = "Refund Request Rejected";
              msg = "Unfortunately, your refund request has been rejected.";
            }
        }

        if (subject) {
          const isPlaceholder = !process.env.SMTP_USER || process.env.SMTP_USER === "your-email@gmail.com" || process.env.SMTP_USER === "test";
          const emailHtml = `<h2>Hello ${orderData.contactName || 'Customer'},</h2><p>${msg}</p>`;
          if (process.env.SMTP_HOST && !isPlaceholder) {
            await transporter.sendMail({
              from: `"ViBa Mart" <${process.env.SMTP_USER}>`,
              to: customerEmail,
              subject,
              html: emailHtml,
            });
          }
        }
      }

      res.json({ success: true, message: "Status updated" });
    } catch (error: any) {
      console.error("Update request status error:", error);
      res.status(500).json({ success: false, error: error.message });
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
