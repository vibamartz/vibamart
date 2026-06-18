import admin from "firebase-admin";
import { verifyAuth, setCorsHeaders, createNotification, sendEmailNotification } from "../utils";

export default async function handler(req: any, res: any) {
  try {
    setCorsHeaders(req, res);
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const user = await verifyAuth(req, res);
    if (!user) return;

    const { orderId, reason, comments } = req.body;
    const uid = user.uid;

    if (!orderId || typeof orderId !== 'string' || !orderId.trim()) {
      return res.status(400).json({ success: false, error: "Order ID is required and must be a valid string." });
    }
    if (!reason || typeof reason !== 'string' || !reason.trim()) {
      return res.status(400).json({ success: false, error: "Reason is required and must be a valid string." });
    }

    const db = admin.firestore();
    const orderRef = db.collection("orders").doc(orderId);
    
    const orderDoc = await orderRef.get();
    if (!orderDoc.exists) {
      return res.status(404).json({ success: false, error: "Order not found" });
    }

    const orderData = orderDoc.data()!;
    if (orderData.customerId !== uid) {
      return res.status(403).json({ success: false, error: "Unauthorized to request refund for this order" });
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
      return res.status(400).json({ success: false, error: "A refund request already exists for this order." });
    }

    // Generate Request ID and create document
    const docRef = db.collection("requests").doc();
    const requestId = docRef.id;

    const requestDoc = {
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
      refundAmount: orderData.total || 0
    };

    await docRef.set(requestDoc);

    await orderRef.update({
      status: "refund_requested",
      hasRefundRequest: true,
      refundRequestId: requestId,
      statusHistory: admin.firestore.FieldValue.arrayUnion({
        status: "refund_requested",
        timestamp: new Date().toISOString(),
        message: "Refund requested by customer"
      })
    });

    // Notifications & Emails
    const customerEmail = orderData.contactEmail || user.email;
    const customerName = orderData.contactName || "Customer";

    const notificationPromises = [];

    notificationPromises.push(createNotification(
      uid,
      "Refund Request Submitted",
      `Your refund request for order #${orderId} has been submitted successfully.`,
      orderId
    ));

    if (customerEmail) {
      notificationPromises.push(sendEmailNotification(
        customerEmail,
        customerName,
        "Refund Request Received",
        `We have received your refund request for order #${orderId}. Our team will review the request and get back to you within 48 hours.`
      ));
    }

    // Admin Notification
    notificationPromises.push(createNotification(
      "admin",
      "New Refund Request",
      `A new refund request has been submitted for order #${orderId}.`,
      orderId
    ));

    await Promise.allSettled(notificationPromises);

    res.json({ success: true, message: "Request submitted successfully", requestId });
  } catch (error: any) {
    console.error("Refund request error:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to submit refund request" });
  }
}
