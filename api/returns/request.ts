import admin from "firebase-admin";
import { verifyAuth, getCorsHeaders, createNotification, sendEmailNotification } from "../utils";

export default async function handler(req: Request) {
  try {
    if (req.method === 'OPTIONS') {
      return new Response(null, {
        status: 200,
        headers: getCorsHeaders()
      });
    }
    if (req.method !== 'POST') {
      return Response.json(
        { error: 'Method not allowed' },
        { status: 405, headers: getCorsHeaders() }
      );
    }

    let user;
    try {
      user = await verifyAuth(req);
    } catch (authError: any) {
      return Response.json(
        { success: false, error: authError.message || "Unauthorized" },
        { 
          status: authError.message?.includes("Configuration") ? 500 : 401, 
          headers: getCorsHeaders() 
        }
      );
    }

    let body: any = {};
    try {
      body = await req.json();
    } catch (e) {
      return Response.json(
        { success: false, error: "Invalid JSON body" },
        { status: 400, headers: getCorsHeaders() }
      );
    }

    const { orderId, reason, comments, images, productIds } = body;
    const uid = user.uid;

    if (!orderId || typeof orderId !== 'string' || !orderId.trim()) {
      return Response.json(
        { success: false, error: "Order ID is required and must be a valid string." },
        { status: 400, headers: getCorsHeaders() }
      );
    }
    if (!reason || typeof reason !== 'string' || !reason.trim()) {
      return Response.json(
        { success: false, error: "Reason is required and must be a valid string." },
        { status: 400, headers: getCorsHeaders() }
      );
    }
    if (!images || !Array.isArray(images) || images.length === 0) {
      return Response.json(
        { success: false, error: "At least one proof image is required." },
        { status: 400, headers: getCorsHeaders() }
      );
    }
    if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
      return Response.json(
        { success: false, error: "At least one product must be selected for return." },
        { status: 400, headers: getCorsHeaders() }
      );
    }

    const db = admin.firestore();
    const orderRef = db.collection("orders").doc(orderId);
    
    const orderDoc = await orderRef.get();
    if (!orderDoc.exists) {
      return Response.json(
        { success: false, error: "Order not found" },
        { status: 404, headers: getCorsHeaders() }
      );
    }

    const orderData = orderDoc.data()!;
    if (orderData.customerId !== uid) {
      return Response.json(
        { success: false, error: "Unauthorized to request return for this order" },
        { status: 403, headers: getCorsHeaders() }
      );
    }

    // Only allow returns for delivered orders
    if (orderData.status !== "delivered") {
      return Response.json(
        { success: false, error: "Can only return delivered orders" },
        { status: 400, headers: getCorsHeaders() }
      );
    }

    // Check return window
    const settingsDoc = await db.collection("settings").doc("store").get();
    const returnWindowDays = settingsDoc.exists && settingsDoc.data()?.returnWindowDays ? settingsDoc.data()?.returnWindowDays : 7;
    
    const deliveredStatus = orderData.statusHistory?.find((s: any) => s.status === "delivered");
    const deliveryDate = deliveredStatus ? new Date(deliveredStatus.timestamp) : new Date(orderData.createdAt); 
    
    const windowMs = returnWindowDays * 24 * 60 * 60 * 1000;
    if (Date.now() - deliveryDate.getTime() > windowMs) {
      return Response.json(
        { success: false, error: "Return window has expired" },
        { status: 400, headers: getCorsHeaders() }
      );
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
      return Response.json(
        { success: false, error: "A return request already exists for one or more selected items" },
        { status: 400, headers: getCorsHeaders() }
      );
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

    return Response.json(
      { success: true, message: "Request submitted successfully", requestId },
      { headers: getCorsHeaders() }
    );
  } catch (error: any) {
    console.error(error);

    return Response.json(
      {
        success: false,
        message: error.message || "Internal server error"
      },
      { status: 500 }
    );
  }
}
