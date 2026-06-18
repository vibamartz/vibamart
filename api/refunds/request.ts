import admin from "firebase-admin";
import { verifyAuth, getCorsHeaders, createNotification, sendEmailNotification, handleNodeRequest } from "../utils";

export async function POST(req: Request) {
  try {
    console.log("Request received");

    // 1. Parse request body safely
    let body: any = {};
    try {
      body = await req.json();
    } catch (e) {
      console.log("Request body: (empty or invalid JSON)");
      console.log("Order ID: undefined");
      console.log("User ID: undefined");
      return Response.json(
        { success: false, error: "Invalid JSON body" },
        { status: 400, headers: getCorsHeaders() }
      );
    }

    console.log("Request body:", body);
    console.log("Order ID:", body.orderId);
    console.log("User ID:", body.userId);

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

    // 2. Perform token authentication
    let user;
    try {
      user = await verifyAuth(req);
    } catch (authError: any) {
      console.error("Auth error:", authError);
      return Response.json(
        { success: false, error: authError.message || "Unauthorized" },
        { 
          status: authError.message?.includes("Configuration") ? 500 : 401, 
          headers: getCorsHeaders() 
        }
      );
    }

    const { orderId, reason, comments } = body;
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
        { success: false, error: "Unauthorized to request refund for this order" },
        { status: 403, headers: getCorsHeaders() }
      );
    }

    // Allow refund if cancelled or returned but not yet refunded
    if (orderData.status !== "cancelled" && orderData.status !== "returned") {
      return Response.json(
        { success: false, error: "Only cancelled or returned orders are eligible for refund" },
        { status: 400, headers: getCorsHeaders() }
      );
    }

    if (orderData.paymentStatus === "refunded") {
      return Response.json(
        { success: false, error: "Order is already refunded" },
        { status: 400, headers: getCorsHeaders() }
      );
    }

    const existingRefunds = await db.collection("requests").where("orderId", "==", orderId).where("type", "==", "refund").get();
    if (!existingRefunds.empty) {
      return Response.json(
        { success: false, error: "A refund request already exists for this order." },
        { status: 400, headers: getCorsHeaders() }
      );
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

    return Response.json(
      { success: true, message: "Request submitted successfully", requestId },
      { headers: getCorsHeaders() }
    );
  } catch (error: any) {
    console.error("FULL ERROR:", error);
    console.error("STACK:", error.stack);

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
