import admin from "firebase-admin";
import { verifyAuth, getCorsHeaders, createNotification, sendEmailNotification, handleNodeRequest, parseRequestBody } from "../utils";

export async function POST(req: any) {
  try {
    console.log("Request received");

    // Parse request body dynamically
    const body = await parseRequestBody(req);

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

    if (!body || typeof body !== 'object') {
      return Response.json(
        { success: false, message: "Invalid JSON body" },
        { status: 400, headers: getCorsHeaders() }
      );
    }
    
    const { orderId, userId, reason, comments } = body;

    // 1. Validate fields exist before database operations
    if (!orderId || typeof orderId !== 'string' || !orderId.trim()) {
      return Response.json(
        { success: false, message: "Order ID missing" },
        { status: 400, headers: getCorsHeaders() }
      );
    }
    if (!userId || typeof userId !== 'string' || !userId.trim()) {
      return Response.json(
        { success: false, message: "User ID missing" },
        { status: 400, headers: getCorsHeaders() }
      );
    }
    if (!reason || typeof reason !== 'string' || !reason.trim()) {
      return Response.json(
        { success: false, message: "Refund reason missing" },
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
          status: 401, 
          headers: getCorsHeaders() 
        }
      );
    }

    const uid = user?.uid;
    if (!uid) {
      return Response.json(
        { success: false, message: "Unauthorized" },
        { status: 401, headers: getCorsHeaders() }
      );
    }

    if (uid !== userId && uid !== 'admin') {
      return Response.json(
        { success: false, message: "Unauthorized user mapping" },
        { status: 403, headers: getCorsHeaders() }
      );
    }

    // 6. Add detailed logging
    console.log("Order ID:", orderId);
    console.log("User ID:", userId);
    console.log("Reason:", reason);

    const db = admin.firestore();
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
        { success: false, message: "Unauthorized to request refund for this order" },
        { status: 403, headers: getCorsHeaders() }
      );
    }

    // Allow refund if cancelled or returned but not yet refunded
    if (orderData.status !== "cancelled" && orderData.status !== "returned") {
      return Response.json(
        { success: false, message: "Only cancelled or returned orders are eligible for refund" },
        { status: 400, headers: getCorsHeaders() }
      );
    }

    if (orderData.paymentStatus === "refunded") {
      return Response.json(
        { success: false, message: "Order is already refunded" },
        { status: 400, headers: getCorsHeaders() }
      );
    }

    // Check duplicate refund requests in the refund_requests collection
    const existingRefunds = await db.collection("refund_requests")
      .where("orderId", "==", orderId)
      .get();
    if (!existingRefunds.empty) {
      return Response.json(
        { success: false, message: "A refund request already exists for this order." },
        { status: 400, headers: getCorsHeaders() }
      );
    }

    // 3. Save request data in Firestore (refund_requests) with the required fields
    const docRef = await db.collection("refund_requests").add({
      orderId: orderId,
      userId: userId,
      reason: reason,
      status: "Pending",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      comments: comments || "",
      refundAmount: orderData.total || 0
    });
    const requestId = docRef.id;

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

    return Response.json(
      { success: true, message: "Request submitted successfully", requestId },
      { headers: getCorsHeaders() }
    );
  } catch (error: any) {
    console.error("Refund request Error:", error);
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

