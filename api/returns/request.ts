import admin from "firebase-admin";
import { verifyAuth, getCorsHeaders, createNotification, sendEmailNotification, handleNodeRequest, parseRequestBody } from "../utils";

export async function POST(req: any) {
  try {
    console.log("Request received");

    // Parse request body dynamically and log all request data
    const body = await parseRequestBody(req);
    console.log("Request body:", body);
    console.log("Order ID:", body?.orderId);
    console.log("User ID:", body?.userId);
    console.log("Reason:", body?.reason);

    if (req.method === 'OPTIONS') {
      return new Response(null, {
        status: 200,
        headers: getCorsHeaders()
      });
    }
    if (req.method !== 'POST') {
      return Response.json(
        { success: false, error: 'Method not allowed' },
        { status: 405, headers: getCorsHeaders() }
      );
    }

    // 1. Validate inputs before database operations
    if (!body || typeof body !== 'object') {
      return Response.json(
        { success: false, message: "Invalid JSON body" },
        { status: 400, headers: getCorsHeaders() }
      );
    }
    const { orderId, reason, comments, images, productIds, userId } = body;

    if (!orderId || typeof orderId !== 'string' || !orderId.trim()) {
      return Response.json(
        { success: false, message: "Order ID missing" },
        { status: 400, headers: getCorsHeaders() }
      );
    }
    if (!reason || typeof reason !== 'string' || !reason.trim()) {
      return Response.json(
        { success: false, message: "Return reason missing" },
        { status: 400, headers: getCorsHeaders() }
      );
    }
    if (!images || !Array.isArray(images) || images.length === 0) {
      return Response.json(
        { success: false, message: "At least one proof image is required" },
        { status: 400, headers: getCorsHeaders() }
      );
    }
    if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
      return Response.json(
        { success: false, message: "At least one product must be selected for return" },
        { status: 400, headers: getCorsHeaders() }
      );
    }

    // 2. Perform token authentication and validate customer
    let user;
    try {
      user = await verifyAuth(req);
    } catch (authError: any) {
      console.error("Auth error:", authError);
      return Response.json(
        { success: false, message: authError.message || "Unauthorized" },
        { 
          status: authError.message?.includes("Configuration") ? 500 : 401, 
          headers: getCorsHeaders() 
        }
      );
    }

    const uid = user?.uid || userId;
    if (!uid) {
      return Response.json(
        { success: false, message: "User ID required" },
        { status: 400, headers: getCorsHeaders() }
      );
    }

    // 3. Ensure database connection and tables (collections) exist/are writable
    const db = admin.firestore();
    try {
      await db.collection("return_requests").limit(1).get();
    } catch (dbErr: any) {
      console.warn("Table return_requests warning:", dbErr.message);
    }

    const orderRef = db.collection("orders").doc(orderId);
    const orderDoc = await orderRef.get();
    if (!orderDoc.exists) {
      return Response.json(
        { success: false, message: "Order not found" },
        { status: 404, headers: getCorsHeaders() }
      );
    }

    const orderData = orderDoc.data();
    if (!orderData) {
      return Response.json(
        { success: false, message: "Order data is null" },
        { status: 400, headers: getCorsHeaders() }
      );
    }

    if (orderData.customerId !== uid && uid !== 'admin') {
      return Response.json(
        { success: false, message: "Unauthorized to request return for this order" },
        { status: 403, headers: getCorsHeaders() }
      );
    }

    // Only allow returns for delivered orders
    if (orderData.status !== "delivered") {
      return Response.json(
        { success: false, message: "Can only return delivered orders" },
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
        { success: false, message: "Return window has expired" },
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
        { success: false, message: "A return request already exists for one or more selected items" },
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

    // 4. Save to both return_requests and requests tables
    await db.collection("return_requests").doc(requestId).set(requestDoc);
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

    return Response.json(
      { success: true, message: "Request submitted successfully", requestId },
      { headers: getCorsHeaders() }
    );
  } catch (error: any) {
    console.error("Return request Error:", error);
    console.error(error.stack);

    return Response.json(
      {
        success: false,
        message: error.message || "Internal server error"
      },
      { status: 500, headers: getCorsHeaders() }
    );
  }
}

export default async function handler(req: any, res?: any) {
  if (res && typeof res.status === 'function') {
    return handleNodeRequest(POST, req, res);
  }
  return POST(req);
}
