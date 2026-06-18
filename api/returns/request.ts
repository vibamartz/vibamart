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
    const { orderId, userId, reason, comments, images, productIds } = req.body || {};

    // 1. Validate fields exist before database operations
    if (!orderId || typeof orderId !== 'string' || !orderId.trim()) {
      return res.status(400).json({ success: false, message: "Order ID missing" });
    }
    if (!userId || typeof userId !== 'string' || !userId.trim()) {
      return res.status(400).json({ success: false, message: "User ID missing" });
    }
    if (!reason || typeof reason !== 'string' || !reason.trim()) {
      return res.status(400).json({ success: false, message: "Return reason missing" });
    }
    if (!images || !Array.isArray(images) || images.length === 0) {
      return res.status(400).json({ success: false, message: "At least one proof image is required" });
    }
    if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
      return res.status(400).json({ success: false, message: "At least one product must be selected for return" });
    }

    // 2. Perform token authentication
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
    if (!orderData || orderData.customerId !== userId) {
      return res.status(403).json({ success: false, message: "Unauthorized to request return for this order" });
    }

    if (orderData.status !== "delivered") {
      return res.status(400).json({ success: false, message: "Can only return delivered orders" });
    }

    console.log("[FIRESTORE READ] Fetching settings document from 'settings' collection with ID 'store'");
    const settingsDoc = await db.collection("settings").doc("store").get();
    const returnWindowDays = settingsDoc.exists && settingsDoc.data()?.returnWindowDays ? settingsDoc.data()?.returnWindowDays : 7;
    
    const deliveredStatus = orderData.statusHistory?.find((s: any) => s.status === "delivered");
    const deliveryDate = deliveredStatus ? new Date(deliveredStatus.timestamp) : new Date(orderData.createdAt); 
    
    const windowMs = returnWindowDays * 24 * 60 * 60 * 1000;
    if (Date.now() - deliveryDate.getTime() > windowMs) {
      return res.status(400).json({ success: false, message: "Return window has expired" });
    }

    // Check for duplicate return requests in the return_requests collection
    console.log(`[FIRESTORE READ] Checking duplicate returns. Querying 'return_requests' where 'orderId' == ${orderId}`);
    const existingReturns = await db.collection("return_requests")
      .where("orderId", "==", orderId)
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
      return res.status(400).json({ success: false, message: "A return request already exists for one or more selected items" });
    }

    let calculatedRefund = 0;
    if (orderData.items && Array.isArray(orderData.items)) {
      orderData.items.forEach((item: any) => {
        if (newProducts.includes(item.productId)) {
          calculatedRefund += (item.price * item.quantity);
        }
      });
    }

    // 3. Save request data in Firestore (return_requests) with the required fields
    const returnReqData = {
      orderId: orderId,
      userId: userId,
      reason: reason,
      status: "Pending",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      productIds: newProducts,
      comments: comments || "",
      images,
      refundAmount: calculatedRefund
    };
    console.log("[FIRESTORE WRITE] Creating return request document in 'return_requests' collection. Data:", JSON.stringify(returnReqData));
    const docRef = await db.collection("return_requests").add(returnReqData);
    const requestId = docRef.id;

    const orderUpdates = {
      status: "return_requested",
      hasReturnRequest: true,
      returnRequestId: requestId,
      statusHistory: admin.firestore.FieldValue.arrayUnion({
        status: "return_requested",
        timestamp: new Date().toISOString(),
        message: "Return requested by customer"
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
        "Return Request Submitted",
        `Your return request for order #${orderId} has been submitted successfully.`,
        orderId
      ).catch(e => console.error("createNotification error:", e)));

      if (customerEmail) {
        notificationPromises.push(sendEmailNotification(
          customerEmail,
          customerName,
          "Return Request Received",
          `We have received your return request for order #${orderId}. Our team will review the details and images provided within 48 hours.`
        ).catch(e => console.error("sendEmailNotification error:", e)));
      }

      notificationPromises.push(createNotification(
        "admin",
        "New Return Request",
        `A new return request has been submitted for order #${orderId}.`,
        orderId
      ).catch(e => console.error("admin createNotification error:", e)));

      await Promise.allSettled(notificationPromises);
    } catch (notifyErr) {
      console.error("Notification service warning:", notifyErr);
    }

    return res.status(200).json({ success: true, message: "Request submitted successfully", requestId });
  } catch (error: any) {
    const errorLocation = getErrorLocation(error);
    console.error("FUNCTION_INVOCATION_FAILED: Return request handler error.");
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

