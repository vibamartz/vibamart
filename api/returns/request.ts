import admin from "firebase-admin";
import { verifyAuth, setCorsHeaders, createNotification, sendEmailNotification } from "../utils";



export default async function handler(req: any, res: any) {
  try {
    setCorsHeaders(req, res);
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const user = await verifyAuth(req, res);
    if (!user) return;

    const { orderId, reason, comments, images, productIds } = req.body;
    const uid = user.uid;

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

    const db = admin.firestore();
    const orderRef = db.collection("orders").doc(orderId);
    
    const orderDoc = await orderRef.get();
    if (!orderDoc.exists) {
      return res.status(404).json({ success: false, error: "Order not found" });
    }

    const orderData = orderDoc.data()!;
    if (orderData.customerId !== uid) {
      return res.status(403).json({ success: false, error: "Unauthorized to request return for this order" });
    }

    // Only allow returns for delivered orders
    if (orderData.status !== "delivered") {
      return res.status(400).json({ success: false, error: "Can only return delivered orders" });
    }

    // Check for duplicate return requests
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
    if (orderData.items && Array.isArray(orderData.items)) {
      orderData.items.forEach((item: any) => {
        if (newProducts.includes(item.productId)) {
          calculatedRefund += (item.price * item.quantity);
        }
      });
    }

    // Generate Request ID and create document
    const docRef = db.collection("requests").doc();
    const requestId = docRef.id;

    const requestDoc = {
      id: requestId,
      requestId,
      orderId,
      customerId: uid,
      userId: uid,
      requestType: 'return',
      type: 'return',
      productIds: newProducts,
      requestReason: reason,
      reason,
      comments: comments || "",
      images,
      status: 'requested',
      createdDate: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedDate: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      refundAmount: calculatedRefund
    };

    await docRef.set(requestDoc);

    await orderRef.update({
      status: "return_requested",
      hasReturnRequest: true,
      returnRequestId: requestId,
      statusHistory: admin.firestore.FieldValue.arrayUnion({
        status: "return_requested",
        timestamp: new Date().toISOString(),
        message: "Return requested by customer"
      })
    });

    // Notifications & Emails
    const customerEmail = orderData.contactEmail || user.email;
    const customerName = orderData.contactName || "Customer";

    const notificationPromises = [];

    notificationPromises.push(createNotification(
      uid,
      "Return Request Submitted",
      `Your return request for order #${orderId} has been submitted successfully.`,
      orderId
    ));

    if (customerEmail) {
      notificationPromises.push(sendEmailNotification(
        customerEmail,
        customerName,
        "Return Request Received",
        `We have received your return request for order #${orderId}. Our team will review the details and images provided within 48 hours.`
      ));
    }

    // Admin Notification
    notificationPromises.push(createNotification(
      "admin",
      "New Return Request",
      `A new return request has been submitted for order #${orderId}.`,
      orderId
    ));

    await Promise.allSettled(notificationPromises);

    res.json({ success: true, message: "Request submitted successfully", requestId });
  } catch (error: any) {
    console.error("Return request error:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    res.status(500).json({ success: false, error: errorMessage || "Failed to submit return request" });
  }
}
