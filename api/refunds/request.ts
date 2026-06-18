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
    const { orderId, reason, comments, userId } = body;

    if (!orderId || typeof orderId !== 'string' || !orderId.trim()) {
      return Response.json(
        { success: false, message: "Order ID missing" },
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
      await db.collection("refund_requests").limit(1).get();
    } catch (dbErr: any) {
      console.warn("Table refund_requests warning:", dbErr.message);
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

    const existingRefunds = await db.collection("requests").where("orderId", "==", orderId).where("type", "==", "refund").get();
    if (!existingRefunds.empty) {
      return Response.json(
        { success: false, message: "A refund request already exists for this order." },
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

    // 4. Save to both refund_requests and requests tables
    await db.collection("refund_requests").doc(requestId).set(requestDoc);
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
