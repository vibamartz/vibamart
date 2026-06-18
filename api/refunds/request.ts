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
    const { orderId, customOrderId, reason, comments } = req.body || {};
    const targetOrderId = customOrderId || orderId;

    // 1. Validate fields exist before database operations
    if (!targetOrderId || typeof targetOrderId !== 'string' || !targetOrderId.trim()) {
      return res.status(400).json({ success: false, message: "Order ID/Custom Order ID missing" });
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
    const userEmail = user?.email;
    if (!uid) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const db = admin.firestore();

    // Fetch order document
    let orderDoc;
    try {
      console.log(`[FIRESTORE READ] Fetching order document from 'orders' collection. Document ID: ${targetOrderId}`);
      orderDoc = await db.collection("orders").doc(targetOrderId).get();
    } catch (error: any) {
      console.error("FULL ERROR:", error);
      console.error(error.stack);
      return res.status(500).json({ success: false, message: error.message });
    }

    if (!orderDoc.exists) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    const orderData = orderDoc.data();
    if (!orderData) {
      return res.status(400).json({ success: false, message: "Order data is null" });
    }

    // Check if user is admin
    let isAdmin = false;
    if (userEmail === 'vk311779@gmail.com') {
      isAdmin = true;
    } else {
      try {
        const userDoc = await db.collection("users").doc(uid).get();
        if (userDoc.exists && userDoc.data()?.role === 'admin') {
          isAdmin = true;
        }
      } catch (adminErr) {
        console.error("Admin check warning:", adminErr);
      }
    }

    // Check if owner using contactEmail
    const isOwner = userEmail && orderData.contactEmail && userEmail.toLowerCase() === orderData.contactEmail.toLowerCase();

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ success: false, message: "Unauthorized to request refund for this order" });
    }

    // Allow refund if cancelled or returned but not yet refunded
    if (orderData.status !== "cancelled" && orderData.status !== "returned") {
      return res.status(400).json({ success: false, message: "Only cancelled or returned orders are eligible for refund" });
    }

    if (orderData.paymentStatus === "refunded") {
      return res.status(400).json({ success: false, message: "Order is already refunded" });
    }

    // Check duplicate refund requests in the refund collection
    console.log(`[FIRESTORE READ] Checking duplicate refunds. Querying 'refund' where 'customOrderId' == ${targetOrderId}`);
    let existingRefunds;
    try {
      existingRefunds = await db.collection("refund")
        .where("customOrderId", "==", targetOrderId)
        .get();
    } catch (error: any) {
      console.error("FULL ERROR:", error);
      console.error(error.stack);
      return res.status(500).json({ success: false, message: error.message });
    }

    if (!existingRefunds.empty) {
      return res.status(400).json({ success: false, message: "A refund request already exists for this order." });
    }

    // Add detailed logging
    console.log("Order:", orderData);
    console.log("customOrderId:", orderData.customOrderId || targetOrderId);
    console.log("contactEmail:", orderData.contactEmail);
    console.log("Reason:", reason);

    // 3. Save request data in Firestore (refund) with the required fields
    const refundReqData = {
      customOrderId: orderData.customOrderId || targetOrderId,
      contactEmail: orderData.contactEmail || userEmail || "",
      reason: reason,
      status: "Pending",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      comments: comments || "",
      refundAmount: orderData.total || 0
    };

    let docRef;
    try {
      console.log("[FIRESTORE WRITE] Creating refund request document in 'refund' collection. Data:", JSON.stringify(refundReqData));
      docRef = await db.collection("refund").add(refundReqData);
    } catch (error: any) {
      console.error("FULL ERROR:", error);
      console.error(error.stack);
      return res.status(500).json({ success: false, message: error.message });
    }

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
    try {
      console.log(`[FIRESTORE WRITE] Updating order document in 'orders' collection. Document ID: ${targetOrderId}. Updates:`, JSON.stringify(orderUpdates));
      await db.collection("orders").doc(targetOrderId).update(orderUpdates);
    } catch (error: any) {
      console.error("FULL ERROR:", error);
      console.error(error.stack);
      return res.status(500).json({ success: false, message: error.message });
    }

    // 5. Safely execute notifications & emails without crashing the function
    try {
      const customerEmail = orderData.contactEmail || userEmail;
      const customerName = orderData.contactName || "Customer";

      const notificationPromises = [];

      notificationPromises.push(createNotification(
        uid,
        "Refund Request Submitted",
        `Your refund request for order #${targetOrderId} has been submitted successfully.`,
        targetOrderId
      ).catch(e => console.error("createNotification error:", e)));

      if (customerEmail) {
        notificationPromises.push(sendEmailNotification(
          customerEmail,
          customerName,
          "Refund Request Received",
          `We have received your refund request for order #${targetOrderId}. Our team will review the request and get back to you within 48 hours.`
        ).catch(e => console.error("sendEmailNotification error:", e)));
      }

      notificationPromises.push(createNotification(
        "admin",
        "New Refund Request",
        `A new refund request has been submitted for order #${targetOrderId}.`,
        targetOrderId
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

