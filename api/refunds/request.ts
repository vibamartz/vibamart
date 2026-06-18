import admin from "firebase-admin";
import { verifyAuth, setCorsHeaders, createNotification, sendEmailNotification, getErrorLocation } from "../utils";

// Make sure firebase is initialized
if (!admin.apps.length) {
  try {
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
  } catch (e) {
    console.warn("Firebase Admin missing credentials", e);
  }
}

export default async function handler(req: any, res: any) {
  setCorsHeaders(req, res);
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    console.log("Request received");
    const { orderId, userId, reason, comments } = req.body || {};

    // 1. Validate fields exist before database operations
    if (!orderId || typeof orderId !== 'string' || !orderId.trim()) {
      return res.status(400).json({ success: false, message: "Order ID missing" });
    }
    if (!userId || typeof userId !== 'string' || !userId.trim()) {
      return res.status(400).json({ success: false, message: "User ID missing" });
    }
    if (!reason || typeof reason !== 'string' || !reason.trim()) {
      return res.status(400).json({ success: false, message: "Refund reason missing" });
    }

    // 2. Perform token authentication and validate customer
    let user;
    try {
      user = await verifyAuth(req);
    } catch (authError: any) {
      console.error("Auth error:", authError);
      return res.status(401).json({ success: false, message: authError.message || "Unauthorized" });
    }

    const uid = user?.uid;
    if (!uid) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    if (uid !== userId && uid !== 'admin') {
      return res.status(403).json({ success: false, message: "Unauthorized user mapping" });
    }

    // 6. Add detailed logging
    console.log("Order ID:", orderId);
    console.log("User ID:", userId);
    console.log("Reason:", reason);

    const db = admin.firestore();
    
    console.log(`[FIRESTORE READ] Fetching order document from 'orders' collection. Document ID: ${orderId}`);
    const orderRef = db.collection("orders").doc(orderId);
    const orderDoc = await orderRef.get();
    if (!orderDoc.exists) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    const orderData = orderDoc.data();
    if (!orderData) {
      return res.status(400).json({ success: false, message: "Order data is null" });
    }

    if (orderData.customerId !== uid && uid !== 'admin') {
      return res.status(403).json({ success: false, message: "Unauthorized to request refund for this order" });
    }

    // Allow refund if cancelled or returned but not yet refunded
    if (orderData.status !== "cancelled" && orderData.status !== "returned") {
      return res.status(400).json({ success: false, message: "Only cancelled or returned orders are eligible for refund" });
    }

    if (orderData.paymentStatus === "refunded") {
      return res.status(400).json({ success: false, message: "Order is already refunded" });
    }

    // Check duplicate refund requests in the refund_requests collection
    console.log(`[FIRESTORE READ] Checking duplicate refunds. Querying 'refund_requests' where 'orderId' == ${orderId}`);
    const existingRefunds = await db.collection("refund_requests")
      .where("orderId", "==", orderId)
      .get();
    if (!existingRefunds.empty) {
      return res.status(400).json({ success: false, message: "A refund request already exists for this order." });
    }

    // 3. Save request data in Firestore (refund_requests) with the required fields
    const refundReqData = {
      orderId: orderId,
      userId: userId,
      reason: reason,
      status: "Pending",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      comments: comments || "",
      refundAmount: orderData.total || 0
    };
    console.log("[FIRESTORE WRITE] Creating refund request document in 'refund_requests' collection. Data:", JSON.stringify(refundReqData));
    const docRef = await db.collection("refund_requests").add(refundReqData);
    const requestId = docRef.id;

    const orderUpdates = {
      status: "refund_requested",
      hasRefundRequest: true,
      refundRequestId: requestId,
      statusHistory: admin.firestore.FieldValue.arrayUnion({
        status: "refund_requested",
        timestamp: new Date().toISOString(),
        message: "Refund requested by customer"
      })
    };
    console.log(`[FIRESTORE WRITE] Updating order document in 'orders' collection. Document ID: ${orderId}. Updates:`, JSON.stringify(orderUpdates));
    await orderRef.update(orderUpdates);

    // 5. Safely execute notifications & emails without crashing the function
    try {
      const customerEmail = orderData.contactEmail || user?.email;
      const customerName = orderData.contactName || "Customer";

      const notificationPromises = [];

      notificationPromises.push(createNotification(
        uid,
        "Refund Request Submitted",
        `Your refund request for order #${orderId} has been submitted successfully.`,
        orderId
      ).catch(e => console.error("createNotification error:", e)));

      if (customerEmail) {
        notificationPromises.push(sendEmailNotification(
          customerEmail,
          customerName,
          "Refund Request Received",
          `We have received your refund request for order #${orderId}. Our team will review the request and get back to you within 48 hours.`
        ).catch(e => console.error("sendEmailNotification error:", e)));
      }

      notificationPromises.push(createNotification(
        "admin",
        "New Refund Request",
        `A new refund request has been submitted for order #${orderId}.`,
        orderId
      ).catch(e => console.error("admin createNotification error:", e)));

      await Promise.allSettled(notificationPromises);
    } catch (notifyErr) {
      console.error("Notification service warning:", notifyErr);
    }

    return res.status(200).json({ success: true, message: "Request submitted successfully", requestId });
  } catch (error: any) {
    const errorLocation = getErrorLocation(error);
    console.error("FUNCTION_INVOCATION_FAILED: Refund request handler error.");
    console.error("Stack trace:", error.stack);
    console.error(`Failing Line: ${errorLocation.file}:${errorLocation.line}`);
    return res.status(500).json({
      success: false,
      error: "FUNCTION_INVOCATION_FAILED",
      message: error.message || "Internal server error",
      file: errorLocation.file,
      line: errorLocation.line,
      stack: error.stack
    });
  }
}

