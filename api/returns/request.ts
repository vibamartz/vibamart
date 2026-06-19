import admin from "firebase-admin";
import { verifyAuth, setCorsHeaders, createNotification, sendEmailNotification, getErrorLocation } from "../utils.js";

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
    const { orderId, customOrderId, reason, comments, images, productIds } = req.body || {};
    const targetOrderId = customOrderId || orderId;

    // 1. Validate fields exist before database operations
    if (!targetOrderId || typeof targetOrderId !== 'string' || !targetOrderId.trim()) {
      return res.status(400).json({ success: false, message: "Order ID/Custom Order ID missing" });
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
      return res.status(403).json({ success: false, message: "Unauthorized to request return for this order" });
    }

    if (orderData.status !== "delivered") {
      return res.status(400).json({ success: false, message: "Can only return delivered orders" });
    }

    let settingsDoc;
    try {
      console.log("[FIRESTORE READ] Fetching settings document from 'settings' collection with ID 'store'");
      settingsDoc = await db.collection("settings").doc("store").get();
    } catch (error: any) {
      console.error("FULL ERROR:", error);
      console.error(error.stack);
      return res.status(500).json({ success: false, message: error.message });
    }

    const returnWindowDays = settingsDoc.exists && settingsDoc.data()?.returnWindowDays ? settingsDoc.data()?.returnWindowDays : 7;
    
    const deliveredStatus = orderData.statusHistory?.find((s: any) => s.status === "delivered");
    const deliveryDate = deliveredStatus ? new Date(deliveredStatus.timestamp) : new Date(orderData.createdAt); 
    
    const windowMs = returnWindowDays * 24 * 60 * 60 * 1000;
    if (Date.now() - deliveryDate.getTime() > windowMs) {
      return res.status(400).json({ success: false, message: "Return window has expired" });
    }

    // Check for duplicate return requests in the return collection
    console.log(`[FIRESTORE READ] Checking duplicate returns. Querying 'return' where 'customOrderId' == ${targetOrderId}`);
    let existingReturns;
    try {
      existingReturns = await db.collection("return")
        .where("customOrderId", "==", targetOrderId)
        .get();
    } catch (error: any) {
      console.error("FULL ERROR:", error);
      console.error(error.stack);
      return res.status(500).json({ success: false, message: error.message });
    }
      
    const newProducts = productIds;
    let overlap = false;
    existingReturns.forEach((doc: any) => {
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

    // Add detailed logging
    console.log("Order:", orderData);
    console.log("customOrderId:", orderData.customOrderId || targetOrderId);
    console.log("contactEmail:", orderData.contactEmail);
    console.log("Reason:", reason);

    // 3. Save request data in Firestore (return) with the required fields
    const returnReqData = {
      customOrderId: orderData.customOrderId || targetOrderId,
      contactEmail: orderData.contactEmail || userEmail || "",
      reason: reason,
      status: "Pending",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      productIds: newProducts,
      comments: comments || "",
      images,
      refundAmount: calculatedRefund
    };

    let docRef;
    try {
      console.log("[FIRESTORE WRITE] Creating return request document in 'return' collection. Data:", JSON.stringify(returnReqData));
      docRef = await db.collection("return").add(returnReqData);
    } catch (error: any) {
      console.error("FULL ERROR:", error);
      console.error(error.stack);
      return res.status(500).json({ success: false, message: error.message });
    }

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
        "Return Request Submitted",
        `Your return request for order #${targetOrderId} has been submitted successfully.`,
        targetOrderId
      ).catch(e => console.error("createNotification error:", e)));

      if (customerEmail) {
        notificationPromises.push(sendEmailNotification(
          customerEmail,
          customerName,
          "Return Request Received",
          `We have received your return request for order #${targetOrderId}. Our team will review the details and images provided within 48 hours.`
        ).catch(e => console.error("sendEmailNotification error:", e)));
      }

      notificationPromises.push(createNotification(
        "admin",
        "New Return Request",
        `A new return request has been submitted for order #${targetOrderId}.`,
        targetOrderId
      ).catch(e => console.error("admin createNotification error:", e)));

      await Promise.allSettled(notificationPromises);
    } catch (notifyErr) {
      console.error("Notification service warning:", notifyErr);
    }

    return res.status(200).json({ success: true, message: "Request submitted successfully", requestId });
  } catch (error: any) {
    console.error("Return Request Error:", error);
    if (res && typeof res.status === 'function') {
      return res.status(500).json({
        success: false,
        message: error?.message || "Internal Server Error",
      });
    }
    return Response.json(
      {
        success: false,
        message: error?.message || "Internal Server Error",
      },
      { status: 500 }
    );
  }
}

