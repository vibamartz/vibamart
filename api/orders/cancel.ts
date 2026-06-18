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

    const { orderId, reason } = body;
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
        { success: false, error: "Unauthorized to cancel this order" },
        { status: 403, headers: getCorsHeaders() }
      );
    }

    const allowedStatuses = ["pending", "confirmed", "packed"];
    if (!allowedStatuses.includes(orderData.status)) {
      return Response.json(
        { success: false, error: `Cannot cancel order in ${orderData.status} status` },
        { status: 400, headers: getCorsHeaders() }
      );
    }

    // Check for duplicate cancellation requests
    const existingCancellations = await db.collection("requests")
      .where("orderId", "==", orderId)
      .where("type", "==", "cancellation")
      .get();

    if (!existingCancellations.empty) {
      return Response.json(
        { success: false, error: "A duplicate cancellation request already exists for this order." },
        { status: 400, headers: getCorsHeaders() }
      );
    }

    // Check if manual cancellation is enabled
    const settingsDoc = await db.collection("settings").doc("store").get();
    const enableManualCancellation = settingsDoc.exists && settingsDoc.data()?.enableManualCancellation === true;

    // Generate unique doc ID
    const docRef = db.collection("requests").doc();
    const requestId = docRef.id;

    const requestDoc = {
      id: requestId,
      requestId,
      orderId,
      customerId: uid,
      userId: uid,
      requestType: 'cancellation',
      type: 'cancellation',
      requestReason: reason,
      reason,
      status: enableManualCancellation ? 'requested' : 'approved',
      createdDate: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedDate: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    await docRef.set(requestDoc);

    if (enableManualCancellation) {
      await orderRef.update({
        status: "cancel_requested",
        cancellationReason: reason,
        statusHistory: admin.firestore.FieldValue.arrayUnion({
          status: "cancel_requested",
          timestamp: new Date().toISOString(),
          message: "Cancellation requested by customer"
        })
      });
    } else {
      // Direct cancel
      const batch = db.batch();
      const productDocs = [];
      if (orderData.items && Array.isArray(orderData.items)) {
        for (const item of orderData.items) {
          if (!item.productId) continue;
          const productRef = db.collection("products").doc(item.productId);
          const productDoc = await productRef.get();
          productDocs.push({ item, productRef, productDoc });
        }
      }

      const updatesByProduct = new Map<string, any>();
      
      for (const { item, productRef, productDoc } of productDocs) {
        if (productDoc.exists) {
          const pData = productDoc.data()!;
          const productId = productRef.id;
          
          if (!updatesByProduct.has(productId)) {
            updatesByProduct.set(productId, {
              ref: productRef,
              updates: { stock: pData.stock || 0 },
              variants: pData.variants ? [...pData.variants] : null
            });
          }
          
          const prodUpdate = updatesByProduct.get(productId);
          prodUpdate.updates.stock += item.quantity;
          
          if (item.variantId && prodUpdate.variants) {
             const variantIndex = prodUpdate.variants.findIndex((v: any) => v.id === item.variantId);
             if (variantIndex !== -1) {
                prodUpdate.variants[variantIndex].stock = (prodUpdate.variants[variantIndex].stock || 0) + item.quantity;
                prodUpdate.updates.variants = prodUpdate.variants;
             }
          }
        }
      }
      
      for (const prodUpdate of updatesByProduct.values()) {
        batch.update(prodUpdate.ref, prodUpdate.updates);
      }
      batch.update(orderRef, {
        status: "cancelled",
        cancellationReason: reason,
        statusHistory: admin.firestore.FieldValue.arrayUnion({
          status: "cancelled",
          timestamp: new Date().toISOString(),
          message: "Cancelled by customer"
        })
      });
      await batch.commit();
    }

    // Notifications & Emails
    const customerEmail = orderData.contactEmail || user.email;
    const customerName = orderData.contactName || "Customer";

    const notificationPromises = [];

    if (enableManualCancellation) {
      notificationPromises.push(createNotification(
        uid,
        "Cancellation Request Submitted",
        `Your cancellation request for order #${orderId} has been submitted successfully.`,
        orderId
      ));
      
      if (customerEmail) {
        notificationPromises.push(sendEmailNotification(
          customerEmail,
          customerName,
          "Order Cancellation Request Received",
          `We have received your cancellation request for order #${orderId}. Reason: ${reason}. It is currently pending review.`
        ));
      }
    } else {
      notificationPromises.push(createNotification(
        uid,
        "Order Cancelled",
        `Your order #${orderId} has been cancelled successfully.`,
        orderId
      ));
      
      if (customerEmail) {
        notificationPromises.push(sendEmailNotification(
          customerEmail,
          customerName,
          "Order Cancelled Successfully",
          `Your order #${orderId} has been successfully cancelled. If you paid online, your refund will be processed within 5-7 business days.`
        ));
      }
    }

    // Admin Notification
    notificationPromises.push(createNotification(
      "admin",
      "New Cancellation Request",
      `A new cancellation request was submitted for order #${orderId}.`,
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
